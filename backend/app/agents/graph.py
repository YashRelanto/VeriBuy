import operator
from typing import TypedDict, Annotated, Sequence
from langgraph.graph import StateGraph, START, END

from app.agents.intent_agent import run_intent_agent
from app.agents.market_agent import run_market_agent
from app.agents.reddit_agent.reddit_agent import run_reddit_agent
from app.agents.youtube_agent.youtube_agent import run_youtube_agent
from loguru import logger

# 1. Define Graph State
class ResearchState(TypedDict):
    query: str
    conversation_history: list[dict]
    
    # Results from agents
    intent: dict | None
    market: dict | None
    reddit: dict | None
    youtube: dict | None
    
    # Flow control
    missing_fields: list[dict] | None
    errors: Annotated[list[str], operator.add]
    
    # Rejection tracking across agents
    rejection_reasons: dict[str, list[str]] | None

# 2. Node Functions
async def intent_node(state: ResearchState):
    logger.info("Graph: Running intent node")
    try:
        intent = await run_intent_agent(state["query"], state["conversation_history"])
        intent_dict = intent.model_dump()
        
        # Use new dynamic fields system (required_fields/optional_fields)
        # Fall back to missing_fields only if required_fields is empty
        missing = None
        if not intent.is_complete:
            if intent.required_fields:
                logger.info(f"Using LLM-generated required fields: {[f.name for f in intent.required_fields]}")
                missing = [f.model_dump() for f in intent.required_fields]
            elif intent.missing_fields:
                missing = [mf.model_dump() for mf in intent.missing_fields]
            
        return {"intent": intent_dict, "missing_fields": missing}
    except Exception as e:
        logger.error(f"Intent node failed: {e}")
        return {"errors": [f"Intent error: {str(e)}"]}

async def market_node(state: ResearchState):
    logger.info("Graph: Running market node")
    if not state.get("intent"):
        return {}
    try:
        # Re-wrap intent dict into IntentOutput for market agent
        from app.models.schemas import IntentOutput
        intent_data = IntentOutput(**state["intent"])
        market = await run_market_agent(intent_data)
        return {"market": market.model_dump(mode="json")}
    except Exception as e:
        logger.error(f"Market node failed: {e}")
        return {"errors": [f"Market error: {str(e)}"]}

async def reddit_node(state: ResearchState):
    logger.info("Graph: Running reddit node")
    if not state.get("intent"):
        return {}
    try:
        market_data = state.get("market") or {}
        products = market_data.get("products") or []
        # Pass the original user query and the discovered products
        reddit = await run_reddit_agent(state["intent"], state["query"], products)
        return {"reddit": reddit}
    except Exception as e:
        logger.error(f"Reddit node failed: {e}")
        return {"errors": [f"Reddit error: {str(e)}"]}

async def youtube_node(state: ResearchState):
    logger.info("Graph: Running youtube node")
    if not state.get("intent"):
        return {}
    try:
        market_data = state.get("market") or {}
        products = market_data.get("products") or []
        # Pass the original user query and the discovered products
        youtube = await run_youtube_agent(state["intent"], state["query"], products)
        return {"youtube": youtube}
    except Exception as e:
        logger.error(f"YouTube node failed: {e}")
        return {"errors": [f"YouTube error: {str(e)}"]}

# 3. Routing Logic
def route_after_intent(state: ResearchState) -> Sequence[str]:
    if state.get("errors"):
        return ["__end__"]
        
    intent = state.get("intent") or {}
    if intent.get("is_greeting"):
        return ["__end__"]
        
    if state.get("missing_fields"):
        # Needs follow up, skip research
        return ["__end__"]
    
    # Run market analysis first
    return ["market"]

def route_after_market(state: ResearchState) -> Sequence[str]:
    if state.get("errors"):
        return ["__end__"]
    market = state.get("market") or {}
    if not market.get("products"):
        return ["__end__"]
    # Run both review agents in parallel
    return ["reddit", "youtube"]

# 4. Build Graph
workflow = StateGraph(ResearchState)

workflow.add_node("intent", intent_node)
workflow.add_node("market", market_node)
workflow.add_node("reddit", reddit_node)
workflow.add_node("youtube", youtube_node)

workflow.add_edge(START, "intent")

workflow.add_conditional_edges(
    "intent",
    route_after_intent,
    {
        "__end__": END,
        "market": "market"
    }
)

workflow.add_conditional_edges(
    "market",
    route_after_market,
    {
        "__end__": END,
        "reddit": "reddit",
        "youtube": "youtube"
    }
)

workflow.add_edge("reddit", END)
workflow.add_edge("youtube", END)

research_graph = workflow.compile()
