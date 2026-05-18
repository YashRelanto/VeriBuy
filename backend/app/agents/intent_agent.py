"""Agent 1 — Intent & Context Understanding Agent.

LangChain chain that extracts structured intent from user queries.
Validates output with IntentOutput Pydantic model.
"""

from loguru import logger
from app.models.schemas import IntentOutput, MissingField, BudgetRange
from app.services.llm_service import create_chain, parse_and_validate


INTENT_SYSTEM_PROMPT = """You are an expert product research assistant. Extract structured information from the user's query.

You MUST respond with ONLY valid JSON matching this schema:
{{
    "product_category": "string (e.g., earphone, phone, laptop, camera)",
    "product_name": "string or null (specific product name if mentioned, e.g. 'Sony WH-1000XM5')",
    "specifications": ["list of desired specs the user mentioned"],
    "budget_range": {{"min_price": 0, "max_price": 999999, "currency": "INR"}},
    "usage_context": "string (e.g., gaming, music, office, travel)",
    "brand_preferences": ["brands the user prefers"],
    "urgency": "immediate | can_wait | flexible",
    "is_specific_product": false,
    "is_complete": true,
    "missing_fields": [{{"field_name": "budget", "question": "What is your budget for the earphone?"}}],
    "confidence_score": 0.8
}}

RULES:
1. Extract ALL information the user has ALREADY provided.
2. "product_category" is REQUIRED — always extract or infer it.
3. "budget_range" is important — if not mentioned, set is_complete=false and add to missing_fields.
4. "usage_context" — if not mentioned, set to "general" (do NOT ask about it).
5. Set "is_specific_product" to true ONLY if user asks about ONE specific product by name.
6. Set "is_complete" to true if product_category AND budget_range are available.
7. Only add to "missing_fields" if absolutely essential info is missing (only budget if not given).
8. "specifications", "brand_preferences", "urgency" are OPTIONAL — never ask for them.

9. If the user gives one budget number, like "4000 INR" or "under 4000", treat it as max_price and set min_price to 0.

Respond with ONLY the JSON object, no other text."""


def _normalize_budget(result: IntentOutput) -> IntentOutput:
    """Treat a single stated budget as an upper limit, not an exact price."""
    budget = result.budget_range
    if budget.min_price > 0 and budget.min_price == budget.max_price:
        logger.info(
            "Normalizing exact budget range "
            f"{budget.min_price}-{budget.max_price} to 0-{budget.max_price}"
        )
        budget.min_price = 0
    return result


async def run_intent_agent(user_message: str, conversation_history: list[dict] = None) -> IntentOutput:
    """Extract intent from user query using LangChain chain + Pydantic validation."""

    chain = create_chain(INTENT_SYSTEM_PROMPT, temperature=0.2)

    # Build context from conversation history
    context = ""
    if conversation_history:
        for msg in conversation_history[-6:]:
            context += f"{msg['role']}: {msg['content']}\n"

    full_input = f"{context}\nCurrent query: {user_message}" if context else user_message

    try:
        # Run the LangChain chain
        raw_response = await chain.ainvoke({"input": full_input})
        logger.debug(f"Intent chain raw response: {raw_response[:300]}")

        # Validate with Pydantic
        result = parse_and_validate(raw_response, IntentOutput)
        result = _normalize_budget(result)

        logger.info(
            f"Intent extracted: category={result.product_category}, "
            f"specific={result.is_specific_product}, complete={result.is_complete}, "
            f"confidence={result.confidence_score}"
        )
        return result

    except Exception as e:
        logger.error(f"Intent agent error: {e}")
        # Return minimal intent so the pipeline can ask follow-up
        return IntentOutput(
            product_category="unknown",
            usage_context=user_message,
            confidence_score=0.1,
            is_complete=False,
            missing_fields=[
                MissingField(
                    field_name="product_category",
                    question="What type of product are you looking for?"
                )
            ]
        )
