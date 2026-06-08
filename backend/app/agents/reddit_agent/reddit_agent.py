import requests
import re
from loguru import logger
from .bot_detector import BotDetector
from .comment_ranker import rank_comments
from app.services.search_service import search_reddit_threads
from app.guardrails import review_fraud_signals, sanitize_untrusted_text
from app.services.llm_service import create_chain
import json

MAX_REDDIT_THREADS = 3
MAX_COMMENTS_PER_THREAD = 5
MAX_TOP_COMMENTS_FOR_LLM = 6
MAX_REDDIT_COMMENT_CHARS = 500


def _fallback_reddit_analysis(top_comments: list[dict]) -> dict:
    """Build a small deterministic summary when the LLM returns non-JSON."""
    if not top_comments:
        return {"summary": "No sufficient comments found.", "pros": [], "cons": []}

    snippets = [
        sanitize_untrusted_text(comment.get("comment", ""), max_chars=160)
        for comment in top_comments[:3]
        if comment.get("comment")
    ]
    sources = {
        comment.get("thread_title", "")
        for comment in top_comments
        if comment.get("thread_title")
    }
    return {
        "summary": (
            f"Reddit evidence was found across {len(sources)} thread(s), "
            "but the LLM returned non-JSON analysis. Top evidence: "
            + " | ".join(snippets)
        ),
        "pros": [],
        "cons": [],
    }


def _parse_reddit_analysis(raw_response: str, top_comments: list[dict]) -> dict:
    text = (raw_response or "").strip()
    if not text:
        return _fallback_reddit_analysis(top_comments)

    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        text = match.group()

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return {
                "summary": str(parsed.get("summary") or ""),
                "pros": parsed.get("pros") if isinstance(parsed.get("pros"), list) else [],
                "cons": parsed.get("cons") if isinstance(parsed.get("cons"), list) else [],
            }
    except json.JSONDecodeError:
        logger.warning(f"Reddit LLM returned non-JSON analysis: {raw_response[:240]}")

    return _fallback_reddit_analysis(top_comments)


def _build_search_query(intent: dict, user_query: str, products: list[dict] = None) -> str:
    """Build a Reddit-focused search query from intent + discovered products.
    
    Query format: "{product_names} reviews reddit"
    """
    if products:
        top_names = []
        for p in products[:2]:
            name = p.get("name") or p.get("title") or ""
            if name:
                clean_name = " ".join(name.split()[:5])
                top_names.append(f'"{clean_name}"')
        if top_names:
            query_term = " OR ".join(top_names)
            return f"({query_term}) reviews reddit"

    parts = []
    
    # Use product name if specific
    if intent.get("product_name"):
        parts.append(intent["product_name"])
    
    # Always include category
    category = intent.get("product_category", "")
    if category:
        parts.append(category)
    
    # Add brand preferences
    for brand in intent.get("brand_preferences", [])[:2]:
        parts.append(brand)
    
    # Add usage context
    usage = intent.get("usage_context", "general")
    if usage != "general":
        parts.append(usage)
    
    # Add "reddit reviews" to focus results
    parts.append("reddit reviews")
    
    query = " ".join(parts)
    
    # Fallback: if we built nothing useful, use the original user query
    if len(query.strip()) < 5:
        query = user_query + " reddit reviews"
    
    return query


def extract_comments_from_thread(thread_url: str, max_comments: int = MAX_COMMENTS_PER_THREAD) -> list[dict]:
    """Fetch and parse comments from a Reddit thread JSON URL."""
    # Append .json?sort=top
    json_url = f"{thread_url}.json?sort=top"
    try:
        # Devvit app style User-Agent
        headers = {
            "User-Agent": "devvit-app:veribuy-reddit-intel:v1.0 (by /u/veribuy-dev)"
        }
        response = requests.get(json_url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        comments = []
        if len(data) > 1 and "data" in data[1]:
            children = data[1]["data"].get("children", [])
            for child in children:
                if child.get("kind") == "t1": # It's a comment
                    comment_data = child.get("data", {})
                    body = comment_data.get("body", "")
                    if body and body != "[deleted]" and body != "[removed]":
                        comments.append({
                            "body": sanitize_untrusted_text(body, max_chars=MAX_REDDIT_COMMENT_CHARS),
                            "score": comment_data.get("score", 0),
                            "author": "[masked]"
                        })
                        if len(comments) >= max_comments:
                            break
        return comments
    except Exception as e:
        logger.error(f"Failed to fetch Reddit thread {thread_url}: {e}")
        return []

async def run_reddit_agent(intent: dict, user_query: str = "", products: list[dict] = None) -> dict:
    """Main pipeline for Reddit Intelligence using Serper API with site:reddit.com filter."""
    
    # Build a proper search query from intent fields and discovered products
    query = _build_search_query(intent, user_query, products)
    
    logger.info(f"Reddit Agent: Searching Reddit for '{query}'")
    
    # Use Serper API to search Reddit threads (via site:reddit.com filter)
    threads = await search_reddit_threads(query, num_results=MAX_REDDIT_THREADS)
    
    if not threads:
        logger.info("No Reddit threads found for the query")
        logger.info(f"sources_found={{\"reddit\": false}}")
        logger.info(f"reddit_products={{}}")
        return {
            "status": "success",
            "threads_analyzed": 0,
            "top_comments": [],
            "analysis": {"summary": "No Reddit discussions found.", "pros": [], "cons": []},
            "rejection_reasons": ["No Reddit threads found matching the product"],
            "guardrails": {
                "source_type": "reddit",
                "content_sanitized": True,
                "note": "Reddit comments are treated as untrusted community evidence, not factual claims."
            }
        }
    
    bot_detector = BotDetector()
    all_ranked_comments = []
    threads_analyzed = 0
    rejection_reasons = []
    
    for thread in threads:
        logger.info(f"Fetching thread: {thread['title']}")
        raw_comments = extract_comments_from_thread(thread["url"])
        
        # Fallback to Serper search snippet if block occurs (Reddit returns 403)
        if not raw_comments and thread.get("snippet"):
            logger.info(f"Comment extraction failed for {thread['title']}. Falling back to Serper snippet.")
            rejection_reasons.append(f"Could not extract live comments from '{thread['title']}' - using snippet instead")
            raw_comments = [{
                "body": thread["snippet"],
                "score": 5,
                "author": "[masked]"
            }]
        
        if not raw_comments:
            rejection_reasons.append(f"Insufficient comments found in thread: {thread['title']}")
            continue

        threads_analyzed += 1
        ranked = rank_comments(raw_comments, bot_detector)
        
        for r in ranked:
            all_ranked_comments.append({
                "thread_title": thread["title"],
                "thread_url": thread["url"],
                "comment": sanitize_untrusted_text(r["text"], max_chars=MAX_REDDIT_COMMENT_CHARS),
                "upvotes": r["upvotes"],
                "rank_score": r["rank_score"],
                "risk_flags": review_fraud_signals(r["text"]),
                "source_type": "reddit"
            })
            
    # Sort global comments and keep only the highest-signal comments for the LLM.
    all_ranked_comments.sort(key=lambda x: x["rank_score"], reverse=True)
    top_comments = all_ranked_comments[:MAX_TOP_COMMENTS_FOR_LLM]
    
    # Send all top comments to LLM in one batch call
    analysis = {"summary": "No sufficient comments found.", "pros": [], "cons": []}
    if top_comments:
        comments_text = "\n\n".join([
            f"Comment {i+1}: {sanitize_untrusted_text(c['comment'], max_chars=MAX_REDDIT_COMMENT_CHARS)}"
            for i, c in enumerate(top_comments)
        ])
        prompt = """You are an expert product researcher. Analyze the following Reddit comments regarding a product query.
Summarize the sentiment, pros, and cons.
Format your response as ONLY valid JSON:
{{
    "summary": "Overall sentiment and consensus...",
    "pros": ["pro1", "pro2"],
    "cons": ["con1", "con2"]
}}

Comments:
""" + comments_text
        
        try:
            chain = create_chain(prompt)
            raw_res = await chain.ainvoke({"input": "Analyze these comments."})
            analysis = _parse_reddit_analysis(raw_res, top_comments)
        except Exception as e:
            logger.error(f"Reddit LLM analysis failed: {e}")
            analysis = _fallback_reddit_analysis(top_comments)
    
    # Log source findings
    sources_found = {"reddit": threads_analyzed > 0}
    logger.info(f"sources_found={sources_found}")
    
    # Log reddit product-to-url mapping
    reddit_products_mapping = {}
    if top_comments:
        # Extract unique thread URLs and titles
        unique_threads = {}
        for comment in top_comments:
            thread_url = comment.get("thread_url", "")
            thread_title = comment.get("thread_title", "")
            if thread_url and thread_title not in unique_threads:
                unique_threads[thread_title] = thread_url
        for thread_title, thread_url in unique_threads.items():
            reddit_products_mapping[thread_title] = thread_url
    logger.info(f"reddit_products={reddit_products_mapping}")
    
    return {
        "status": "success",
        "threads_analyzed": threads_analyzed,
        "top_comments": top_comments,
        "analysis": analysis,
        "rejection_reasons": rejection_reasons,
        "guardrails": {
            "source_type": "reddit",
            "content_sanitized": True,
            "note": "Reddit comments are treated as untrusted community evidence, not factual claims."
        }
    }
