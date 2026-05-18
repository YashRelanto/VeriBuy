import requests
from loguru import logger
from .bot_detector import BotDetector
from .comment_ranker import rank_comments
from app.services.search_service import search_reddit_threads
from app.guardrails import review_fraud_signals, sanitize_untrusted_text

# Subreddit routing based on category
CATEGORY_SUBREDDITS = {
    "laptop": ["GadgetsIndia", "IndianGaming", "LaptopDealsIndia", "SuggestALaptop"],
    "smartphone": ["IndiaTech", "GadgetsIndia"],
    "phone": ["IndiaTech", "GadgetsIndia"],
    "headphones": ["headphones", "IndiaTech", "HeadphoneAdvice"],
    "earphone": ["headphones", "IndiaTech", "HeadphoneAdvice"],
    "earbuds": ["headphones", "IndiaTech", "HeadphoneAdvice"],
    "espresso": ["IndianFood", "espresso", "Coffee"],
    "coffee": ["IndianFood", "espresso", "Coffee"],
    "chair": ["IndianWorkspaces", "IndianGaming", "HomeImprovement", "OfficeChairs"],
    "ergonomic": ["IndianWorkspaces", "IndianGaming", "HomeImprovement", "OfficeChairs"],
    "desk": ["IndianWorkspaces", "HomeImprovement", "battlestations"],
    "camera": ["IndianPhotography", "GadgetsIndia"],
    "monitor": ["IndianGaming", "GadgetsIndia", "monitors"],
    "tablet": ["GadgetsIndia", "IndiaTech"],
    "tv": ["IndianGaming", "GadgetsIndia", "hometheater"],
    "watch": ["GadgetsIndia", "IndiaTech"],
    "speaker": ["IndiaTech", "GadgetsIndia", "BudgetAudiophile"],
    "keyboard": ["IndianGaming", "MechanicalKeyboards"],
    "mouse": ["IndianGaming", "MouseReview"],
    "general": ["india", "IndianGaming", "GadgetsIndia", "IndiaTech"]
}

def _build_search_query(intent: dict, user_query: str) -> str:
    """Build a focused search query from intent + user query."""
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
    
    # Add "review" and "India" to focus results
    parts.append("review India")
    
    query = " ".join(parts)
    
    # Fallback: if we built nothing useful, use the original user query
    if len(query.strip()) < 5:
        query = user_query + " review India"
    
    return query


def extract_comments_from_thread(thread_url: str) -> list[dict]:
    """Fetch and parse comments from a Reddit thread JSON URL."""
    # Append .json?sort=top
    json_url = f"{thread_url}.json?sort=top"
    try:
        response = requests.get(json_url, headers={"User-Agent": "VeriBuy-Agent/1.0"}, timeout=10)
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
                            "body": sanitize_untrusted_text(body, max_chars=1200),
                            "score": comment_data.get("score", 0),
                            "author": "[masked]"
                        })
        return comments
    except Exception as e:
        logger.error(f"Failed to fetch Reddit thread {thread_url}: {e}")
        return []

async def run_reddit_agent(intent: dict, user_query: str = "") -> dict:
    """Main pipeline for Reddit Intelligence."""
    category = intent.get("product_category", "general").lower()
    
    # Build a proper search query from intent fields
    query = _build_search_query(intent, user_query)
    
    # Find matching subreddits — check partial matches too
    subreddits = CATEGORY_SUBREDDITS.get("general")
    for key, subs in CATEGORY_SUBREDDITS.items():
        if key in category or category in key:
            subreddits = subs
            break
    
    logger.info(f"Reddit Agent: Searching {subreddits} for '{query}'")
    
    threads = await search_reddit_threads(query, subreddits, num_results=3)
    
    bot_detector = BotDetector()
    all_ranked_comments = []
    
    for thread in threads:
        logger.info(f"Fetching thread: {thread['title']}")
        raw_comments = extract_comments_from_thread(thread["url"])
        ranked = rank_comments(raw_comments, bot_detector)
        
        for r in ranked:
            all_ranked_comments.append({
                "thread_title": thread["title"],
                "thread_url": thread["url"],
                "comment": sanitize_untrusted_text(r["text"], max_chars=800),
                "upvotes": r["upvotes"],
                "rank_score": r["rank_score"],
                "risk_flags": review_fraud_signals(r["text"]),
                "source_type": "reddit"
            })
            
    # Sort global comments and pick top 10 overall
    all_ranked_comments.sort(key=lambda x: x["rank_score"], reverse=True)
    top_comments = all_ranked_comments[:10]
    
    return {
        "status": "success",
        "threads_analyzed": len(threads),
        "top_comments": top_comments,
        "guardrails": {
            "source_type": "reddit",
            "content_sanitized": True,
            "note": "Reddit comments are treated as untrusted community evidence, not factual claims."
        }
    }
