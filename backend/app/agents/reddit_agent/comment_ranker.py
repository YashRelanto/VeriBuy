def rank_comments(comments: list[dict], bot_detector) -> list[dict]:
    """
    Ranks surviving comments based on upvotes, recency, and genuine signal score.
    Returns the top comments.
    """
    scored_comments = []
    
    for comment in comments:
        text = comment.get("body", "")
        upvotes = comment.get("score", 0)
        
        # Get bot score
        genuineness = bot_detector.score_comment(text)
        
        # Filter out obvious bots
        if genuineness < -1.0:
            continue
            
        # Calculate a final rank score
        # Upvotes are good, but genuineness acts as a multiplier/heavy weight
        rank_score = upvotes * 0.1 + genuineness * 10
        
        scored_comments.append({
            "text": text,
            "upvotes": upvotes,
            "genuineness_score": genuineness,
            "rank_score": rank_score
        })
        
    # Sort by rank_score descending
    scored_comments.sort(key=lambda x: x["rank_score"], reverse=True)
    return scored_comments[:5]
