import asyncio
import traceback
from app.agents.intent_agent import run_intent_agent

async def main():
    try:
        res = await run_intent_agent('Best coding laptops with 32GB RAM')
        print(res)
    except Exception as e:
        print("ERROR OCCURRED:")
        traceback.print_exc()

asyncio.run(main())
