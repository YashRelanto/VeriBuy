"""
VeriBuy FastAPI Backend — Main Application Entry Point.
"""

import json
import uuid
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from loguru import logger

from app.config import get_settings
from app.models.schemas import ChatRequest, AgentEvent
from app.agents.orchestrator import run_agent_pipeline
from app.services.llm_service import check_huggingface_health


# ── Logging Configuration ──────────────────────────────────
logger.remove()
logger.add(sys.stderr, level="INFO")
logger.add("logs/veribuy.log", rotation="10 MB", retention="10 days", level="DEBUG")

# ── In-memory stores ──────────────────────────────────────
conversations: dict[str, list[dict]] = {}
research_results: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle events.
    """
    logger.info("🚀 VeriBuy Backend starting...")

    hf_ok = await check_huggingface_health()
    if hf_ok:
        settings = get_settings()
        logger.info(f"✅ HuggingFace API connected — model: {settings.intent_model}")
    else:
        logger.warning("⚠️ HuggingFace API key not detected — LLM calls will fail")

    yield
    logger.info("👋 VeriBuy Backend shutting down")


app = FastAPI(
    title="VeriBuy API",
    description="AI Product Research & Recommendation Platform",
    version="1.0.0",
    lifespan=lifespan
)

# ── CORS ───────────────────────────────────────────────────
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for Vercel deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health Check ───────────────────────────────────────────

@app.get("/health")
async def health_check():
    hf_ok = await check_huggingface_health()
    return {
        "status": "healthy",
        "huggingface": "connected" if hf_ok else "disconnected",
        "model": settings.intent_model,
        "version": "1.0.0"
    }


@app.get("/")
async def root():
    return {"message": "VeriBuy API is running"}


# ── Chat Endpoint (SSE Streaming) ─────────────────────────

@app.post("/api/v1/chat")
async def chat(request: ChatRequest):
    """
    Main chat endpoint. Returns SSE stream of agent events.
    """
    logger.info(f"User queried: {request.message}")

    conv_id = request.conversation_id or str(uuid.uuid4())
    if conv_id not in conversations:
        conversations[conv_id] = []

    conversations[conv_id].append({
        "role": "user",
        "content": request.message
    })

    async def event_stream():
        try:
            yield {
                "event": "conversation_id",
                "data": json.dumps({"conversation_id": conv_id})
            }

            full_response = ""

            async for event in run_agent_pipeline(
                user_message=request.message,
                conversation_history=conversations[conv_id]
            ):
                logger.info(
                    f"Agent Activity — {event.agent or 'system'}: "
                    f"{event.event_type} — {event.message or ''}"
                )

                event_data = {
                    "event_type": event.event_type,
                    "agent": event.agent,
                    "data": event.data,
                    "message": event.message
                }

                yield {
                    "event": event.event_type,
                    "data": json.dumps(event_data, default=str)
                }

                if event.event_type == "token":
                    full_response += event.data.get("content", "")

                if event.event_type == "final_result":
                    research_results[conv_id] = event.data

            if full_response:
                conversations[conv_id].append({
                    "role": "assistant",
                    "content": full_response
                })

        except Exception as e:
            logger.error(f"Chat stream error: {e}")
            yield {
                "event": "error",
                "data": json.dumps({"message": str(e)})
            }

    return EventSourceResponse(event_stream())


# ── Conversations API ─────────────────────────────────────

@app.get("/api/v1/conversations")
async def list_conversations():
    return {
        "conversations": [
            {
                "id": conv_id,
                "message_count": len(messages),
                "last_message": messages[-1]["content"][:100] if messages else ""
            }
            for conv_id, messages in conversations.items()
        ]
    }


@app.get("/api/v1/conversations/{conv_id}")
async def get_conversation(conv_id: str):
    if conv_id not in conversations:
        return JSONResponse(status_code=404, content={"error": "Conversation not found"})
    return {"id": conv_id, "messages": conversations[conv_id]}


# ── Research Results API ──────────────────────────────────

@app.get("/api/v1/research/{conv_id}")
async def get_research(conv_id: str):
    if conv_id not in research_results:
        return JSONResponse(status_code=404, content={"error": "No research results found"})
    return research_results[conv_id]


# ── Run Server ────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
