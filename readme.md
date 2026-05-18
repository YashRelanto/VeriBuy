# AI Cart Negotiator & Price Intelligence Platform
 
## Overview
 
AI Cart Negotiator is an AI-powered shopping intelligence platform that helps users make smarter purchasing decisions on e-commerce platforms like Amazon, Flipkart, Croma, and more.
 
Instead of relying solely on manipulated marketplace ratings and sponsored listings, the platform aggregates signals from:
- Reddit communities
- YouTube review transcripts
- Marketplace reviews
- Historical pricing trends
- Seller reputation
- Community sentiment
 
The system then generates a transparent AI-driven recommendation with detailed reasoning, trust scores, and price intelligence.
 
---
 
# Problem Statement
 
Modern e-commerce platforms are optimized for:
- conversions
- ad revenue
- sponsored listings
 
rather than helping users make informed decisions.
 
Users currently face:
- Fake reviews
- Scam sellers
- Price uncertainty
- Choice overload
- Decision fatigue
- Lack of trustworthy product comparisons
 
Existing tools only provide:
- cashback
- coupons
- simple price tracking
 
but not:
- AI reasoning
- fake review detection
- community intelligence
- launch predictions
- real-world usage analysis
 
---
 
# Solution
 
AI Cart Negotiator acts as an intelligent trust layer on top of existing marketplaces.
 
The platform:
- Scrapes product information
- Detects fake reviews
- Analyzes Reddit discussions
- Summarizes YouTube reviews
- Tracks historical pricing
- Predicts buying windows
- Generates AI-powered recommendations
 
Users can interact conversationally with the platform and receive transparent, explainable buying guidance.
 
---
 
# Core Features
 
## 1. Conversational Shopping Assistant
 
Users can naturally ask:
 
- "Best gaming laptop under 90k"
- "Should I buy this now?"
- "Compare iPhone vs Samsung"
- "Is this seller trustworthy?"
- "What are Reddit users saying about this product?"
 
The AI understands:
- budget
- priorities
- use case
- urgency
- brand preferences
 
and responds conversationally.
 
---
 
## 2. Product Discovery Engine
 
Searches products across:
- Amazon
- Flipkart
- Croma
- Reliance Digital
 
Extracts:
- specs
- pricing
- ratings
- seller information
- availability
 
---
 
## 3. Fake Review Detection
 
Analyzes:
- repetitive review patterns
- suspicious rating spikes
- AI-generated review signatures
- account clustering
- spam behavior
 
Outputs:
- fake review probability
- trust score
- reasoning explanation
 
---
 
## 4. Reddit Community Intelligence
 
Scrapes and analyzes discussions from:
- r/IndianGaming
- r/GadgetsIndia
- r/buildapc
- r/Android
- r/laptops
 
Extracts:
- recurring complaints
- long-term durability insights
- thermal issues
- battery degradation
- real-world usage experiences
 
---
 
## 5. YouTube Review Intelligence
 
Extracts and summarizes review transcripts.
 
Finds:
- creator consensus
- benchmark observations
- hidden issues
- performance summaries
 
---
 
## 6. Price Intelligence
 
Tracks:
- historical pricing
- sale cycles
- price volatility
- competitor pricing
 
Generates:
- over/underpriced indicators
- expected future pricing
- buy/wait suggestions
 
Example:
> "Current price is 14% above monthly average. Waiting for the next sale cycle may save ₹7,000."
 
---
 
## 7. AI Buy Confidence Score
 
Combines:
- fake review analysis
- community sentiment
- seller trust
- pricing intelligence
- performance insights
 
into a final:
- Buy
- Wait
- Avoid
- Better Alternative
 
recommendation.
 
---
 
## 8. Smart Price Alerts
 
Users can:
- track products
- monitor price drops
- receive launch alerts
- get better alternative suggestions
 
Example alerts:
- "Price expected to drop during Prime Day."
- "New version launching next month."
- "Seller trust score has decreased."
- "Better value product detected."
 
---
 
# End User Flow
 
## Step 1 — User Opens Dashboard
 
Dashboard displays:
- conversational chatbot
- trending deals
- tracked products
- recommended products
- recent launches
- price drop alerts
 
---
 
## Step 2 — User Starts Conversation
 
Example:
> "I need a gaming laptop for AI/ML under 80k."
 
AI extracts:
- budget
- category
- purpose
- performance expectations
 
---
 
## Step 3 — Multi-Agent Pipeline Activates
 
The platform visually shows:
- Intent Agent
- Discovery Agent
- Review Analyzer
- Reddit Intelligence Agent
- YouTube Intelligence Agent
- Price Intelligence Agent
- Recommendation Agent
 
Users can see:
- live reasoning
- AI decisions
- trust calculations
 
---
 
## Step 4 — AI Recommendation Dashboard
 
Displays:
- product cards
- comparison tables
- community sentiment
- fake review warnings
- seller trust
- price trends
- recommendation reasoning
 
---
 
## Step 5 — Product Tracking
 
Users can:
- save products
- create watchlists
- receive alerts
- monitor future pricing
 
---
 
# MVP Features
 
The hackathon MVP includes:
 
- Conversational chatbot
- Product scraping
- Fake review detection
- Reddit analysis
- YouTube transcript summarization
- Price intelligence
- Buy confidence scoring
- Product comparison dashboard
- Smart price alerts
 
---
 
# Advanced Features (Future Scope)
 
## Browser Extension
 
Overlay AI insights directly on:
- Amazon
- Flipkart
- product pages
 
Features:
- fake review warnings
- better alternatives
- community trust scores
 
---
 
## Voice Shopping Assistant
 
Voice-enabled conversational shopping.
 
---
 
## AI Negotiation Layer
 
Automatically:
- applies coupons
- finds discounts
- stacks offers
- suggests optimal payment methods
 
---
 
## Predictive Launch Intelligence
 
Predicts:
- upcoming launches
- refresh cycles
- future price drops
 
---
 
# Tech Stack
 
# Frontend
 
## Framework
- Next.js 15
- TypeScript
 
## Styling
- Tailwind CSS
- shadcn/ui
 
## Animations
- Framer Motion
 
## Charts & Visualization
- Recharts
- Tremor
 
---
 
# Backend
 
## Framework
- FastAPI
 
## Language
- Python
 
## API Layer
- REST APIs
- WebSockets
- Server-Sent Events
 
---
 
# AI Stack
 
## Conversational Models (SLMs)
 
Recommended:
- Llama 3 8B
- Phi-3 Mini
- Gemma 2B
 
---
 
## Embedding Models
 
- BGE-small-en
- E5-small
- SentenceTransformers
 
---
 
## NLP Models
 
### Fake Review Detection
- DistilBERT
- MiniLM
- DeBERTa-v3-small
 
### Sentiment Analysis
- RoBERTa
 
---
 
# AI Orchestration
 
- LangGraph
- LangChain
 
---
 
# Databases
 
## Primary Database
PostgreSQL
 
Stores:
- users
- products
- alerts
- conversations
- watchlists
 
---
 
## Vector Database
Qdrant / Weaviate
 
Stores:
- embeddings
- Reddit knowledge
- transcript embeddings
- semantic search indexes
 
---
 
## Cache Layer
Redis
 
Used for:
- caching
- session memory
- fast retrieval
- rate limiting
 
---
 
# Web Scraping Stack
 
## Tools
- Playwright
- Scrapy
- BrightData
 
---
 
# AI Agent Architecture
 
## 1. Intent Agent
Extracts:
- budget
- category
- priorities
 
---
 
## 2. Product Discovery Agent
Finds products across marketplaces.
 
---
 
## 3. Fake Review Analyzer
Detects review manipulation.
 
---
 
## 4. Reddit Intelligence Agent
Analyzes community sentiment.
 
---
 
## 5. YouTube Intelligence Agent
Processes review transcripts.
 
---
 
## 6. Price Intelligence Agent
Tracks trends and predicts pricing.
 
---
 
## 7. Recommendation Agent
Generates final AI recommendation.
 
---
 
# Database Schema
 
## users
 
```sql
id
name
email
preferences
created_at