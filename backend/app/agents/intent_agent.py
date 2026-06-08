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
    "product_category": "string (e.g., earphone, phone, laptop, camera, TV)",
    "product_name": "string or null (specific product name if mentioned)",
    "specifications": ["list of desired specs"],
    "budget_range": {{"min_price": 0, "max_price": 999999, "currency": "INR"}},
    "usage_context": "string (e.g., gaming, music, office, travel) or general",
    "brand_preferences": ["brands the user prefers"],
    "urgency": "immediate or can_wait or flexible",
    "is_specific_product": false,
    "is_greeting": false,
    "is_complete": true,
    "missing_fields": [],
    "required_fields": [{{"name": "budget", "question": "What is your budget in INR?", "type": "price"}}],
    "optional_fields": [{{"name": "screen_size", "question": "Preferred screen size?", "type": "text"}}, {{"name": "panel_type", "question": "Display type preference?", "type": "text"}}],
    "confidence_score": 0.8
}}

CRITICAL REQUIREMENT: ALWAYS include both required_fields and optional_fields arrays. They must NEVER be empty if product_category is known.

RULES FOR FIELD GENERATION:

**REQUIRED FIELDS** (absolute must-haves):
- For ALL products: budget is ALWAYS required (price type) with question "What is your budget in INR?"
- If product type is clear (TV, Laptop, etc.), only ask for budget

**OPTIONAL FIELDS** (enhance search, ALWAYS include these):
- For TV: screen_size (32 inch, 43 inch, 55 inch, 65 inch), panel_type (LED, QLED, OLED), refresh_rate, smart_tv_needed, hdr_support
- For Laptop: processor_brand, ram_size, storage_type, gpu, display_refresh, screen_size
- For Headphones: connection_type, noise_cancellation, water_resistance, battery_life
- For Phone: processor_brand, storage_size, camera_quality, battery_capacity, display_type
- For Earbuds: noise_cancellation, water_resistance, battery_life, charging_case

WHEN TO POPULATE:
- If product_category is NOT unknown, ALWAYS generate 3-5 optional_fields for that category
- Never duplicate between required_fields and optional_fields
- Skip optional fields the user already mentioned

GENERAL RULES:
1. Extract ALL information the user already provided.
2. Never return null for usage_context - use general if not mentioned.
3. Never return 0 for max_price - use 999999 if no budget specified.
4. If user says hello/greeting: is_greeting=true, product_category=unknown, put greeting question in required_fields.
5. Set is_complete=true ONLY if: (a) product_category known, (b) budget_range has specific limits, (c) all required fields filled.
6. Use types: text, number, price, yes_no, multiselect.
7. If user says budget like 50000 INR, treat as max_price (min=0).
8. is_specific_product=true ONLY if exact product name AND model number mentioned.

Respond with ONLY the JSON object, no text before or after."""


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

        # If LLM marked as incomplete and generated required_fields, use those
        if not result.is_complete:
            if result.required_fields:
                logger.info(f"Using LLM-generated required fields: {[f.name for f in result.required_fields]}")
            else:
                # Fallback: if no fields generated but incomplete, enforce basic budget check
                cat = (result.product_category or "").lower()
                if not result.is_greeting and result.product_category != "unknown":
                    is_budget_provided = result.budget_range and (result.budget_range.max_price < 999999 or result.budget_range.min_price > 0)
                    if not is_budget_provided:
                        from app.models.schemas import DynamicField
                        result.required_fields.append(DynamicField(
                            name="budget",
                            question=f"What is your budget or price range for the {result.product_category}?",
                            type="price"
                        ))
        else:
            # If marked complete, verify budget is truly set
            if result.budget_range.max_price >= 999999 and result.budget_range.min_price == 0:
                result.is_complete = False
                from app.models.schemas import DynamicField
                result.required_fields.append(DynamicField(
                    name="budget",
                    question=f"What is your budget or price range for the {result.product_category}?",
                    type="price"
                ))

        logger.info(
            f"Intent extracted: category={result.product_category}, "
            f"specific={result.is_specific_product}, complete={result.is_complete}, "
            f"confidence={result.confidence_score}"
        )
        
        # Log user query intent details
        logger.info(f"user_queried=\"{user_message}\"")
        
        # Log missing fields
        missing_field_names = []
        if not result.is_complete and result.required_fields:
            missing_field_names = [f.name for f in result.required_fields if f.name]
        logger.info(f"missing_fields={missing_field_names}")
        
        # Log final requirements
        final_reqs = {
            "product_category": result.product_category,
            "budget_range": result.budget_range.model_dump() if result.budget_range else None,
            "usage_context": result.usage_context,
            "brand_preferences": result.brand_preferences,
            "specifications": result.specifications
        }
        logger.info(f"final_requirements={final_reqs}")
        
        return result

    except Exception as e:
        logger.error(f"Intent agent error: {e}")
        # Return minimal intent so the pipeline can ask follow-up
        from app.models.schemas import DynamicField
        return IntentOutput(
            product_category="unknown",
            usage_context=user_message,
            confidence_score=0.1,
            is_complete=False,
            is_greeting=False,
            required_fields=[
                DynamicField(
                    name="product_category",
                    question="What type of product are you looking for? (e.g., TV, Laptop, Phone, Headphones)",
                    type="text"
                )
            ],
            optional_fields=[],
            missing_fields=[]  # Deprecated, use required_fields instead
        )
