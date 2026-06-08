#!/usr/bin/env python3
"""Test script to verify intent agent correctly handles TV queries with consolidated required/optional fields."""

import asyncio
import json
from app.agents.intent_agent import run_intent_agent

async def test_tv_intent():
    """Test that 'I need to buy a TV' generates budget only as required, with optional fields separate."""
    
    test_cases = [
        "I need to buy a TV",
        "Looking for a TV",
        "I want a gaming TV",
    ]
    
    for query in test_cases:
        print(f"\n{'='*70}")
        print(f"Query: {query}")
        print('='*70)
        
        try:
            result = await run_intent_agent(query)
            
            print(f"Product Category: {result.product_category}")
            print(f"Is Complete: {result.is_complete}")
            print(f"Confidence: {result.confidence_score}")
            
            print(f"\n*** REQUIRED FIELDS ({len(result.required_fields)} total) ***")
            if result.required_fields:
                for field in result.required_fields:
                    print(f"  • {field.name} ({field.type})")
                    print(f"    Question: {field.question}")
            else:
                print("  (none)")
            
            print(f"\n*** OPTIONAL FIELDS ({len(result.optional_fields)} total) ***")
            if result.optional_fields:
                for field in result.optional_fields:
                    print(f"  • {field.name} ({field.type})")
                    print(f"    Question: {field.question}")
            else:
                print("  (none)")
            
            # Verify requirement
            if result.product_category == "TV" and result.required_fields:
                required_names = [f.name for f in result.required_fields]
                if "budget" in required_names and len(required_names) == 1:
                    print("\n[PASS] Only budget is required for TV (no screen_size, panel_type, etc.)")
                else:
                    print(f"\n[WARN] Expected only budget, got: {required_names}")
            
        except Exception as e:
            print(f"[ERROR] {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_tv_intent())
