"""
Pydantic models for all agent I/O and API contracts.
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


# ── Enums ──────────────────────────────────────────────────

class Urgency(str, Enum):
    IMMEDIATE = "immediate"
    CAN_WAIT = "can_wait"
    FLEXIBLE = "flexible"


# ── Agent 1: Intent & Context ─────────────────────────────

class BudgetRange(BaseModel):
    min_price: float = Field(0, description="Minimum budget in INR")
    max_price: float = Field(999999, description="Maximum budget in INR")
    currency: str = Field("INR")


class MissingField(BaseModel):
    field_name: str
    question: str


class DynamicField(BaseModel):
    """A dynamically generated field for ambiguity resolution."""
    name: str = Field(..., description="Field identifier")
    question: str = Field(..., description="Question to ask the user")
    type: str = Field("text", description="Field type: text, number, price, yes_no")


class IntentOutput(BaseModel):
    """Output from Agent 1 — Intent & Context Understanding."""
    product_category: str = Field(..., description="e.g., earphone, phone, laptop")
    product_name: Optional[str] = Field(None, description="Specific product name if mentioned")
    specifications: list[str] = Field(default_factory=list)
    budget_range: BudgetRange = Field(default_factory=BudgetRange)
    usage_context: str = Field("general", description="e.g., gaming, music, office")
    brand_preferences: list[str] = Field(default_factory=list)
    urgency: Urgency = Field(Urgency.FLEXIBLE)
    is_specific_product: bool = Field(False, description="True if asking about ONE specific product")
    is_greeting: bool = Field(False, description="True if the user is just saying hello or being conversational")
    is_complete: bool = Field(False, description="True if enough info to search")
    missing_fields: list[MissingField] = Field(default_factory=list)
    required_fields: list[DynamicField] = Field(default_factory=list, description="Dynamically generated required fields for ambiguity resolution")
    optional_fields: list[DynamicField] = Field(default_factory=list, description="Dynamically generated optional fields for better search")
    confidence_score: float = Field(0.0, ge=0.0, le=1.0)


# ── Agent 2: Market & Pricing ─────────────────────────────

class ProductResult(BaseModel):
    """A single product found by the Market Agent."""
    name: str
    brand: str = ""
    model: str = ""
    price: float = 0
    currency: str = "INR"
    platform: str = ""
    specs: dict[str, str] = Field(default_factory=dict)
    rating: Optional[float] = None
    review_count: Optional[int] = None
    url: str = ""
    direct_url: str = Field("", description="Direct marketplace URL (not Google redirect)")
    image_url: Optional[str] = None
    availability: str = "in_stock"
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    confidence_score: float = Field(0.5, ge=0.0, le=1.0)
    trust_score: float = Field(0.5, ge=0.0, le=1.0)
    source_types: list[str] = Field(default_factory=list)
    source_diversity_score: float = Field(0.0, ge=0.0, le=1.0)
    risk_flags: list[str] = Field(default_factory=list)
    is_trusted: bool = True
    disclaimer: Optional[str] = None
    relevance_score: float = Field(1.0, ge=0.0, le=1.0)
    relevance_reason: Optional[str] = None
    is_exact_match: bool = True



class MarketOutput(BaseModel):
    """Output from Agent 2 — Market & Pricing Intelligence."""
    products: list[ProductResult] = Field(default_factory=list)
    search_query_used: str = ""
    platforms_searched: list[str] = Field(default_factory=list)
    total_found: int = 0


# ── Chat API Models ───────────────────────────────────────

class ChatMessage(BaseModel):
    role: str = "user"
    content: str


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class AgentEvent(BaseModel):
    """SSE event emitted during agent processing."""
    event_type: str  # agent_start, agent_complete, followup_needed, token, final_result, error
    agent: Optional[str] = None
    data: dict = Field(default_factory=dict)
    message: Optional[str] = None
