import json
import re
from pydantic import BaseModel, Field
from loguru import logger

from .youtube_config import TRUSTED_CHANNELS
from .transcript_extractor import extract_and_clean_transcript
from app.services.llm_service import create_chain
from app.services.search_service import search_youtube_videos
from app.guardrails import sanitize_untrusted_text


MAX_YOUTUBE_SEARCH_RESULTS = 6
MAX_YOUTUBE_ANALYZED_VIDEOS = 4
MAX_YOUTUBE_TRANSCRIPT_CHARS = 1800
MAX_YOUTUBE_METADATA_CHARS = 600
MIN_UNTRUSTED_CHANNEL_VIEWS = 100000


class YouTubeProductRecommendation(BaseModel):
    name: str
    category: str = ""
    mentioned_by: list[str] = Field(default_factory=list)
    sentiment: str = "mixed"
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    best_for: str = ""
    why_recommended: str = ""
    confidence_score: float = Field(0.0, ge=0.0, le=1.0)


class YouTubeAnalysisOutput(BaseModel):
    summary: str = ""
    recurring_themes: list[str] = Field(default_factory=list)
    products_recommended: list[YouTubeProductRecommendation] = Field(default_factory=list)
    products_to_avoid: list[YouTubeProductRecommendation] = Field(default_factory=list)
    buying_advice: list[str] = Field(default_factory=list)


YOUTUBE_ANALYSIS_PROMPT = """You are a product research analyst. Analyze YouTube review evidence and extract product-level recommendations.

User intent:
- Category: {category}
- Usage: {usage}
- Budget: {budget}
- User query: {user_query}

YouTube evidence:
{transcripts}

Return ONLY valid JSON matching this schema:
{{
  "summary": "brief synthesis of what creators collectively say or what the ranked video metadata indicates",
  "recurring_themes": ["theme repeated across videos"],
  "products_recommended": [
    {{
      "name": "specific product/model name",
      "category": "product category",
      "mentioned_by": ["video title or channel"],
      "sentiment": "positive | mixed | negative",
      "pros": ["specific pro from transcript or video metadata"],
      "cons": ["specific con from transcript or video metadata"],
      "best_for": "who should buy it",
      "why_recommended": "evidence-based reason",
      "confidence_score": 0.0
    }}
  ],
  "products_to_avoid": [
    {{
      "name": "specific product/model name",
      "category": "product category",
      "mentioned_by": ["video title or channel"],
      "sentiment": "negative",
      "pros": [],
      "cons": ["specific issue"],
      "best_for": "",
      "why_recommended": "why to avoid or be cautious",
      "confidence_score": 0.0
    }}
  ],
  "buying_advice": ["actionable advice grounded in the available YouTube evidence"]
}}

Rules:
- Recommend only products or models actually mentioned in the provided evidence.
- Prefer products mentioned positively by multiple videos or clearly present in top-ranked long-form videos.
- If a product has mixed feedback, say "mixed" and include both pros and cons.
- Do not invent prices unless the evidence explicitly mentions them.
- Lower confidence when evidence_type is "metadata" instead of "transcript".
- Keep recommendations relevant to the user's category and usage.
- If evidence is insufficient or only metadata-based, explicitly say confidence is limited.
- Do not quote unsafe, toxic, scam, or personal content from transcripts.
"""


def _build_search_query(intent: dict, user_query: str, products: list[dict] = None) -> str:
    """Build a focused YouTube search query from intent fields and discovered products."""
    if products:
        top_names = []
        for p in products[:2]:
            name = p.get("name") or p.get("title") or ""
            if name:
                clean_name = " ".join(name.split()[:5])
                top_names.append(f'"{clean_name}"')
        if top_names:
            query_term = " OR ".join(top_names)
            trusted_str = " ".join(TRUSTED_CHANNELS[:3])
            return f"({query_term}) reviews youtube {trusted_str}"

    parts = []

    if intent.get("product_name"):
        parts.append(intent["product_name"])

    category = intent.get("product_category", "")
    if category:
        parts.append(category)

    for brand in intent.get("brand_preferences", [])[:2]:
        parts.append(brand)

    usage = intent.get("usage_context", "general")
    if usage != "general":
        parts.append(f"for {usage}")

    query = " ".join(parts)
    if len(query.strip()) < 5:
        query = user_query
    return query


def _format_transcripts_for_llm(videos: list[dict], max_chars_per_video: int = MAX_YOUTUBE_TRANSCRIPT_CHARS) -> str:
    blocks = []
    for index, video in enumerate(videos, 1):
        evidence_text = video.get("transcript") or video.get("metadata_text", "")
        if not evidence_text:
            continue
        blocks.append(
            f"[Video {index}]\n"
            f"Title: {video.get('title', '')}\n"
            f"Channel: {video.get('channel', '')}\n"
            f"URL: {video.get('url', '')}\n"
            f"Evidence type: {video.get('evidence_type', 'transcript')}\n"
            f"Evidence: {sanitize_untrusted_text(evidence_text, max_chars=max_chars_per_video)}\n"
        )
    return "\n\n".join(blocks)


def _youtube_creator_log(videos: list[dict]) -> list[dict]:
    """Log exact YouTube sources found for this product query."""
    return [
        {
            "title": video.get("title", ""),
            "channel": video.get("channel") or "unknown",
            "url": video.get("url", ""),
            "video_id": video.get("video_id", ""),
            "view_count": video.get("view_count"),
            "rank_score": video.get("rank_score", 0),
        }
        for video in videos
    ]


def _extract_markdown_section(text: str, heading: str) -> str:
    pattern = rf"\*\*{re.escape(heading)}:?\*\*\s*(.*?)(?=\n\*\*|\Z)"
    match = re.search(pattern, text, flags=re.DOTALL | re.IGNORECASE)
    if not match:
        return ""
    return sanitize_untrusted_text(match.group(1).strip(), max_chars=700)


def _extract_markdown_list(text: str, heading: str, max_items: int = 5) -> list[str]:
    section = _extract_markdown_section(text, heading)
    if not section:
        return []

    items = []
    for line in section.splitlines():
        item = re.sub(r"^\s*(?:[-*]|\d+[.)])\s*", "", line).strip()
        if item:
            items.append(sanitize_untrusted_text(item, max_chars=180))
        if len(items) >= max_items:
            break
    return items


def _fallback_youtube_analysis(raw_response: str, analyzed_videos: list[dict]) -> YouTubeAnalysisOutput:
    text = (raw_response or "").strip()
    summary = _extract_markdown_section(text, "Summary")
    recurring_themes = _extract_markdown_list(text, "Recurring Themes")
    buying_advice = _extract_markdown_list(text, "Buying Advice")

    if not summary:
        titles = [
            sanitize_untrusted_text(video.get("title", ""), max_chars=120)
            for video in analyzed_videos[:3]
            if video.get("title")
        ]
        summary = (
            "YouTube evidence was found, but the LLM returned non-JSON analysis. "
            f"Videos considered: {' | '.join(titles)}"
        )

    return YouTubeAnalysisOutput(
        summary=summary,
        recurring_themes=recurring_themes,
        buying_advice=buying_advice,
    )


def _parse_youtube_analysis(raw_response: str, analyzed_videos: list[dict]) -> YouTubeAnalysisOutput:
    text = (raw_response or "").strip()
    if not text:
        return _fallback_youtube_analysis(raw_response, analyzed_videos)

    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if not match:
        logger.warning(f"YouTube LLM returned non-JSON analysis: {raw_response[:240]}")
        return _fallback_youtube_analysis(raw_response, analyzed_videos)

    try:
        return YouTubeAnalysisOutput(**json.loads(match.group()))
    except Exception as e:
        logger.warning(f"YouTube LLM JSON validation failed: {e}")
        return _fallback_youtube_analysis(raw_response, analyzed_videos)


async def _analyze_transcripts(
    intent: dict,
    user_query: str,
    analyzed_videos: list[dict]
) -> YouTubeAnalysisOutput:
    transcript_context = _format_transcripts_for_llm(analyzed_videos)
    if not transcript_context:
        return YouTubeAnalysisOutput()

    budget = intent.get("budget_range") or {}
    chain = create_chain(YOUTUBE_ANALYSIS_PROMPT, temperature=0.2)

    raw_response = await chain.ainvoke({
        "category": intent.get("product_category", ""),
        "usage": intent.get("usage_context", "general"),
        "budget": f"{budget.get('min_price', 0)} to {budget.get('max_price', 999999)} {budget.get('currency', 'INR')}",
        "user_query": user_query,
        "transcripts": transcript_context,
        "input": "Analyze these transcripts and produce product recommendations."
    })

    return _parse_youtube_analysis(raw_response, analyzed_videos)


async def run_youtube_agent(intent: dict, user_query: str = "", products: list[dict] = None) -> dict:
    """Find, rank, transcribe, and analyze long-form YouTube product reviews.
    
    Filters:
    - Trusted channels (from TRUSTED_CHANNELS list) — no view count requirement
    - Other channels — must have 100K+ views
    - Rejected videos are tracked with reasons
    """
    query = _build_search_query(intent, user_query, products)

    logger.info(f"YouTube Agent: Searching top long-form videos for '{query}'")

    videos = await search_youtube_videos(query, TRUSTED_CHANNELS, num_results=MAX_YOUTUBE_SEARCH_RESULTS)
    logger.info(f"youtube_creators_found={_youtube_creator_log(videos)}")

    analyzed_videos = []
    transcript_count = 0
    videos_rejected = []
    
    for video in videos[:MAX_YOUTUBE_SEARCH_RESULTS]:
        if len(analyzed_videos) >= MAX_YOUTUBE_ANALYZED_VIDEOS:
            break

        video_id = video.get("video_id")
        channel = video.get("channel", "")
        view_count = video.get("view_count")
        is_trusted_channel = channel in TRUSTED_CHANNELS
        
        if not video_id:
            continue
        
        # Trusted channels are exempt. Unknown view counts are allowed because
        # Serper often omits them; known low-view videos are rejected.
        if (
            not is_trusted_channel
            and view_count is not None
            and view_count > 0
            and view_count < MIN_UNTRUSTED_CHANNEL_VIEWS
        ):
            videos_rejected.append({
                "title": video.get("title", ""),
                "reason": f"Less than 100K views ({view_count:,})",
                "channel": channel
            })
            logger.info(f"Filtering video '{video.get('title')}' from channel '{channel}': {view_count} views < 100K")
            continue

        logger.info(f"Fetching transcript for video: {video['title']}")
        transcript = extract_and_clean_transcript(video_id, max_chars=MAX_YOUTUBE_TRANSCRIPT_CHARS)

        if transcript:
            transcript_count += 1
            analyzed_videos.append({
                "title": video.get("title", ""),
                "url": video.get("url", ""),
                "video_id": video_id,
                "channel": channel,
                "duration": video.get("duration", ""),
                "view_count": view_count,
                "is_trusted_channel": is_trusted_channel,
                "rank_score": video.get("rank_score", 0),
                "rank_reasons": video.get("rank_reasons", []),
                "evidence_type": "transcript",
                "transcript_snippet": transcript[:MAX_YOUTUBE_METADATA_CHARS],
                "transcript": transcript,
            })
            continue

        metadata_text = " ".join([
            sanitize_untrusted_text(video.get("title", ""), max_chars=250),
            channel,
            video.get("duration", ""),
            sanitize_untrusted_text(video.get("snippet", ""), max_chars=MAX_YOUTUBE_METADATA_CHARS),
            " ".join(video.get("rank_reasons", []) or []),
        ]).strip()
        if metadata_text:
            analyzed_videos.append({
                "title": sanitize_untrusted_text(video.get("title", ""), max_chars=250),
                "url": video.get("url", ""),
                "video_id": video_id,
                "channel": channel,
                "duration": video.get("duration", ""),
                "view_count": view_count,
                "is_trusted_channel": is_trusted_channel,
                "rank_score": video.get("rank_score", 0),
                "rank_reasons": video.get("rank_reasons", []),
                "evidence_type": "metadata",
                "transcript_snippet": sanitize_untrusted_text(video.get("snippet", ""), max_chars=MAX_YOUTUBE_METADATA_CHARS),
                "metadata_text": sanitize_untrusted_text(metadata_text, max_chars=MAX_YOUTUBE_METADATA_CHARS),
            })

    analysis = YouTubeAnalysisOutput()
    if analyzed_videos:
        try:
            analysis = await _analyze_transcripts(intent, user_query, analyzed_videos)
        except Exception as e:
            logger.error(f"YouTube transcript analysis failed: {e}")

    rejection_reasons = [v["reason"] for v in videos_rejected] if videos_rejected else []
    
    # Log source findings
    sources_found = {"youtube": len(analyzed_videos) > 0}
    logger.info(f"sources_found={sources_found}")
    
    # Log youtube product-to-url mapping
    youtube_products_mapping = {}
    if videos:
        # Extract unique video URLs and titles
        unique_videos = {}
        for video in videos:
            video_url = video.get("url", "")
            video_title = video.get("title", "")
            if video_url and video_title not in unique_videos:
                unique_videos[video_title] = video_url
        for video_title, video_url in unique_videos.items():
            youtube_products_mapping[video_title] = video_url
    logger.info(f"youtube_products={youtube_products_mapping}")

    return {
        "status": "success",
        "videos_found": len(videos),
        "videos_analyzed": transcript_count,
        "videos_considered": len(analyzed_videos),
        "evidence_mode": "transcript" if transcript_count else "metadata_fallback",
        "top_videos": videos[:MAX_YOUTUBE_SEARCH_RESULTS],
        "creators_found": _youtube_creator_log(videos),
        "transcripts": [
            {
                key: value
                for key, value in video.items()
                if key != "transcript"
            }
            for video in analyzed_videos
        ],
        "videos_rejected": videos_rejected,
        "rejection_reasons": rejection_reasons,
        "analysis": analysis.model_dump(mode="json"),
        "recommendations": [
            item.model_dump(mode="json")
            for item in analysis.products_recommended
        ],
        "avoid": [
            item.model_dump(mode="json")
            for item in analysis.products_to_avoid
        ],
        "guardrails": {
            "source_type": "youtube",
            "content_sanitized": True,
            "evidence_mode": "transcript" if transcript_count else "metadata_fallback",
            "note": "YouTube transcripts and metadata are treated as untrusted evidence, not instructions."
        },
    }
