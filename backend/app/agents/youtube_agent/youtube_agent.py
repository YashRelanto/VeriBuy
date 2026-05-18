import json
from pydantic import BaseModel, Field
from loguru import logger

from .youtube_config import TRUSTED_CHANNELS
from .transcript_extractor import extract_and_clean_transcript
from app.services.llm_service import create_chain, parse_and_validate
from app.services.search_service import search_youtube_videos
from app.guardrails import sanitize_untrusted_text


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


def _build_search_query(intent: dict, user_query: str) -> str:
    """Build a focused YouTube search query from intent fields."""
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


def _format_transcripts_for_llm(videos: list[dict], max_chars_per_video: int = 2200) -> str:
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

    return parse_and_validate(raw_response, YouTubeAnalysisOutput)


async def run_youtube_agent(intent: dict, user_query: str = "") -> dict:
    """Find, rank, transcribe, and analyze long-form YouTube product reviews."""
    query = _build_search_query(intent, user_query)

    logger.info(f"YouTube Agent: Searching top long-form videos for '{query}'")

    videos = await search_youtube_videos(query, TRUSTED_CHANNELS, num_results=10)

    analyzed_videos = []
    transcript_count = 0
    for video in videos[:10]:
        video_id = video.get("video_id")
        if not video_id:
            continue

        logger.info(f"Fetching transcript for video: {video['title']}")
        transcript = extract_and_clean_transcript(video_id)

        if transcript:
            transcript_count += 1
            analyzed_videos.append({
                "title": video.get("title", ""),
                "url": video.get("url", ""),
                "video_id": video_id,
                "channel": video.get("channel", ""),
                "duration": video.get("duration", ""),
                "rank_score": video.get("rank_score", 0),
                "rank_reasons": video.get("rank_reasons", []),
                "evidence_type": "transcript",
                "transcript_snippet": transcript[:1200],
                "transcript": transcript,
            })
            continue

        metadata_text = " ".join([
            sanitize_untrusted_text(video.get("title", ""), max_chars=250),
            video.get("channel", ""),
            video.get("duration", ""),
            sanitize_untrusted_text(video.get("snippet", ""), max_chars=1000),
            " ".join(video.get("rank_reasons", []) or []),
        ]).strip()
        if metadata_text:
            analyzed_videos.append({
                "title": sanitize_untrusted_text(video.get("title", ""), max_chars=250),
                "url": video.get("url", ""),
                "video_id": video_id,
                "channel": video.get("channel", ""),
                "duration": video.get("duration", ""),
                "rank_score": video.get("rank_score", 0),
                "rank_reasons": video.get("rank_reasons", []),
                "evidence_type": "metadata",
                "transcript_snippet": sanitize_untrusted_text(video.get("snippet", ""), max_chars=1000),
                "metadata_text": metadata_text,
            })

    analysis = YouTubeAnalysisOutput()
    if analyzed_videos:
        try:
            analysis = await _analyze_transcripts(intent, user_query, analyzed_videos)
        except Exception as e:
            logger.error(f"YouTube transcript analysis failed: {e}")

    return {
        "status": "success",
        "videos_found": len(videos),
        "videos_analyzed": transcript_count,
        "videos_considered": len(analyzed_videos),
        "evidence_mode": "transcript" if transcript_count else "metadata_fallback",
        "top_videos": videos[:10],
        "transcripts": [
            {
                key: value
                for key, value in video.items()
                if key != "transcript"
            }
            for video in analyzed_videos
        ],
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
