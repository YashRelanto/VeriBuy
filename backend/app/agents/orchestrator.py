"""Orchestrator — LangGraph Multi-Agent Pipeline."""

import json
from typing import AsyncGenerator
from loguru import logger

from app.models.schemas import AgentEvent
from app.agents.graph import research_graph
from app.guardrails import insufficient_evidence_message

async def run_agent_pipeline(
    user_message: str,
    conversation_history: list[dict] = None
) -> AsyncGenerator[AgentEvent, None]:
    """Run the LangGraph pipeline, yielding SSE events."""
    if conversation_history is None:
        conversation_history = []

    state = {
        "query": user_message,
        "conversation_history": conversation_history,
        "intent": None,
        "market": None,
        "reddit": None,
        "youtube": None,
        "missing_fields": None,
        "errors": []
    }

    # Start Intent
    yield AgentEvent(
        event_type="agent_start",
        agent="intent",
        message="Understanding your requirements..."
    )

    # Collect final results as we stream
    final_intent = None
    final_market = None
    final_reddit = None
    final_youtube = None

    # Stream graph execution — only runs the graph ONCE
    async for step in research_graph.astream(state):
        if "intent" in step:
            intent_result = step["intent"]
            final_intent = intent_result.get("intent")
            
            if intent_result.get("errors"):
                yield AgentEvent(
                    event_type="error",
                    agent="intent",
                    message="Error understanding query."
                )
                return
                
            yield AgentEvent(
                event_type="agent_complete",
                agent="intent",
                data=final_intent or {},
                message=f"Identified: {(final_intent or {}).get('product_category')}"
            )
            
            if intent_result.get("missing_fields"):
                missing = intent_result["missing_fields"]
                questions = [mf["question"] for mf in missing]
                yield AgentEvent(
                    event_type="followup_needed",
                    agent="intent",
                    data={
                        "missing_fields": missing,
                        "partial_intent": final_intent
                    },
                    message="I need a bit more info: " + " ".join(questions)
                )
                yield AgentEvent(event_type="done", data={"status": "awaiting_input"})
                return

            # Intent successful — announce parallel agents starting
            yield AgentEvent(event_type="agent_start", agent="market", message="Searching across platforms...")
            yield AgentEvent(event_type="agent_start", agent="reddit", message="Scanning Reddit discussions...")
            yield AgentEvent(event_type="agent_start", agent="youtube", message="Analyzing YouTube reviews...")

        elif "market" in step:
            final_market = step["market"].get("market")
            yield AgentEvent(
                event_type="agent_complete",
                agent="market",
                data=final_market or {},
                message=f"Found {(final_market or {}).get('total_found', 0)} products"
            )
            
        elif "reddit" in step:
            final_reddit = step["reddit"].get("reddit")
            yield AgentEvent(
                event_type="agent_complete",
                agent="reddit",
                data=final_reddit or {},
                message=f"Analyzed {(final_reddit or {}).get('threads_analyzed', 0)} Reddit threads"
            )
            
        elif "youtube" in step:
            final_youtube = step["youtube"].get("youtube")
            yield AgentEvent(
                event_type="agent_complete",
                agent="youtube",
                data=final_youtube or {},
                message=f"Analyzed {(final_youtube or {}).get('videos_analyzed', 0)} YouTube videos"
            )

    # Use collected results (no second graph invocation!)
    if final_market and not final_market.get("products"):
        no_result_text = "I couldn't find products matching your criteria. Try broadening your search."
        for i in range(0, len(no_result_text), 3):
            yield AgentEvent(event_type="token", data={"content": no_result_text[i:i+3]})
        yield AgentEvent(event_type="done", data={"status": "complete"})
        return
        
    # Format summary text for the chat
    summary_text = _format_summary(final_intent, final_market, final_reddit, final_youtube)
    for i in range(0, len(summary_text), 3):
        yield AgentEvent(
            event_type="token",
            data={"content": summary_text[i:i+3]}
        )

    # Run deal finder for the top pick
    best_deals = []
    if final_market and final_market.get("products"):
        top_product = final_market["products"][0]
        yield AgentEvent(event_type="agent_start", agent="market", message=f"Finding cross-platform deals for {top_product['name'][:30]}...")
        
        from app.agents.market_agent import find_best_deals
        max_budget = None
        if final_intent:
            max_budget = (final_intent.get("budget_range") or {}).get("max_price")
        best_deals = await find_best_deals(top_product["name"], max_budget=max_budget)
        
        if best_deals:
            yield AgentEvent(
                event_type="agent_complete",
                agent="market",
                data={"deals": best_deals},
                message=f"Found {len(best_deals)} cross-platform deals"
            )

    yield AgentEvent(
        event_type="final_result",
        data={
            "intent": final_intent,
            "market": final_market,
            "reddit": final_reddit,
            "youtube": final_youtube,
            "best_deals": best_deals,
            "guardrails": _build_guardrail_summary(final_market, final_reddit, final_youtube)
        },
        message="Research complete! See the dashboard for details."
    )
    yield AgentEvent(event_type="done", data={"status": "complete"})


def _format_summary(intent, market, reddit, youtube) -> str:
    """Format a chat-friendly summary of results."""
    lines = []
    
    if intent and market and market.get("products"):
        products = market["products"]
        lines.append(f"\n\n## Found {market.get('total_found')} options for {intent.get('product_category')}\n\n")
        for i, p in enumerate(products[:3], 1):
            price = p.get('price', 0)
            lines.append(f"**{i}. {p.get('name')}** — ₹{price:,.0f}")
            if p.get('platform'):
                lines.append(f" ({p.get('platform')})")
            lines.append("\n")
            
    if reddit and reddit.get("top_comments"):
        lines.append("\n**Reddit Highlights:**\n")
        for c in reddit["top_comments"][:2]:
            lines.append(f"- \"{c['comment'][:150]}...\"\n")
            
    if youtube and youtube.get("transcripts"):
        lines.append("\n**YouTube Insights:**\n")
        for v in youtube["transcripts"][:2]:
            lines.append(f"- *{v['title']}*: {v['transcript_snippet'][:100]}...\n")

    if youtube and youtube.get("recommendations"):
        lines.append("\n**YouTube-backed recommendations:**\n")
        for product in youtube["recommendations"][:3]:
            name = product.get("name", "Unknown product")
            reason = product.get("why_recommended") or product.get("best_for", "")
            lines.append(f"- **{name}**")
            if reason:
                lines.append(f": {reason[:160]}")
            lines.append("\n")

    buying_advice = (youtube or {}).get("analysis", {}).get("buying_advice", [])
    if buying_advice:
        lines.append("\n**Creator buying advice:**\n")
        for advice in buying_advice[:2]:
            lines.append(f"- {advice}\n")

    lines.append("\n📊 *Check the dashboard for detailed comparisons.*\n")
    return "".join(lines)


# Guardrail-aware formatter overrides the legacy formatter above.
def _format_summary(intent, market, reddit, youtube) -> str:
    """Format a chat-friendly summary with confidence, trust, and risk notes."""
    lines = []

    if intent and market and market.get("products"):
        products = market["products"]
        lines.append(f"\n\n## Found {market.get('total_found')} evidence-backed options for {intent.get('product_category')}\n\n")
        for i, p in enumerate(products[:3], 1):
            price = p.get("price", 0)
            lines.append(f"**{i}. {p.get('name')}** - INR {price:,.0f}")
            if p.get("platform"):
                lines.append(f" ({p.get('platform')})")
            if p.get("confidence_score") is not None and p.get("trust_score") is not None:
                lines.append(f" - confidence {p.get('confidence_score'):.0%}, trust {p.get('trust_score'):.0%}")
            if p.get("risk_flags"):
                lines.append(f"\n  Risk notes: {', '.join(p.get('risk_flags')[:2])}")
            lines.append("\n")
    elif market and not market.get("products"):
        lines.append(f"\n\n{insufficient_evidence_message()}\n")

    if reddit and reddit.get("top_comments"):
        lines.append("\n**Reddit Highlights:**\n")
        for c in reddit["top_comments"][:2]:
            risk = c.get("risk_flags") or []
            suffix = f" Risk: {', '.join(risk[:1])}." if risk else ""
            lines.append(f"- \"{c['comment'][:150]}...\"{suffix}\n")

    if youtube and youtube.get("transcripts"):
        evidence_mode = youtube.get("evidence_mode", "transcript")
        lines.append(f"\n**YouTube Insights ({evidence_mode}):**\n")
        for v in youtube["transcripts"][:2]:
            lines.append(f"- *{v['title']}*: {v.get('transcript_snippet', '')[:100]}...\n")

    if youtube and youtube.get("recommendations"):
        lines.append("\n**YouTube-backed recommendations:**\n")
        for product in youtube["recommendations"][:3]:
            name = product.get("name", "Unknown product")
            reason = product.get("why_recommended") or product.get("best_for", "")
            confidence = product.get("confidence_score")
            lines.append(f"- **{name}**")
            if confidence is not None:
                lines.append(f" ({confidence:.0%} confidence)")
            if reason:
                lines.append(f": {reason[:160]}")
            lines.append("\n")

    buying_advice = (youtube or {}).get("analysis", {}).get("buying_advice", [])
    if buying_advice:
        lines.append("\n**Creator buying advice:**\n")
        for advice in buying_advice[:2]:
            lines.append(f"- {advice}\n")

    lines.append("\n*Claims are based only on retrieved evidence. Metadata-only insights are lower confidence.*\n")
    lines.append("\nCheck the dashboard for detailed comparisons.\n")
    return "".join(lines)


def _build_guardrail_summary(market, reddit, youtube) -> dict:
    products = (market or {}).get("products", [])
    risk_flags = sorted({
        flag
        for product in products
        for flag in product.get("risk_flags", [])
    })
    source_types = sorted({
        source
        for product in products
        for source in product.get("source_types", [])
    })
    if reddit and reddit.get("top_comments"):
        source_types.append("reddit")
    if youtube and (youtube.get("transcripts") or youtube.get("top_videos")):
        source_types.append("youtube")

    return {
        "claims_policy": "No product claim is treated as factual unless supported by retrieved evidence.",
        "scraped_content_policy": "Scraped content is untrusted context, never instructions.",
        "source_types": sorted(set(source_types)),
        "risk_flags": risk_flags,
        "uncertainty_note": "Confidence is reduced for metadata-only evidence, missing prices, or low source diversity.",
        "privacy_note": "Sensitive personal data is masked from scraped community content."
    }
