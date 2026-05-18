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

# 2. Node Functions
async def intent_node(state: ResearchState):
    logger.info("Graph: Running intent node")
    try:
        intent = await run_intent_agent(state["query"], state["conversation_history"])
        intent_dict = intent.model_dump()
        
        missing = None
        if not intent.is_complete and intent.missing_fields:
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
        # Pass the original user query so reddit searches for the right thing
        reddit = await run_reddit_agent(state["intent"], state["query"])
        return {"reddit": reddit}
    except Exception as e:
        logger.error(f"Reddit node failed: {e}")
        return {"errors": [f"Reddit error: {str(e)}"]}

async def youtube_node(state: ResearchState):
    logger.info("Graph: Running youtube node")
    if not state.get("intent"):
        return {}
    try:
        # Pass the original user query so youtube searches for the right thing
        youtube = await run_youtube_agent(state["intent"], state["query"])
        return {"youtube": youtube}
    except Exception as e:
        logger.error(f"YouTube node failed: {e}")
        return {"errors": [f"YouTube error: {str(e)}"]}

# 3. Routing Logic
def route_after_intent(state: ResearchState) -> Sequence[str]:
    if state.get("errors"):
        return ["__end__"]
    if state.get("missing_fields"):
        # Needs follow up, skip research
        return ["__end__"]
    
    # Run all three in parallel
    return ["market", "reddit", "youtube"]

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
        "market": "market",
        "reddit": "reddit",
        "youtube": "youtube"
    }
)

workflow.add_edge("market", END)
workflow.add_edge("reddit", END)
workflow.add_edge("youtube", END)

research_graph = workflow.compile()
