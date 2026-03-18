"""
GrabInsurance — FastAPI application entry point.

Start with: uvicorn main:app --reload --port 8000
Auto-docs:  http://localhost:8000/docs
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from routes import events, operator, policy, quote, recommend, webhook

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan ───────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting GrabInsurance backend…")
    await init_db()
    logger.info("Database initialised ✓")
    logger.info(
        "LLM scoring: %s | LangSmith tracing: %s",
        "GPT-4o-mini" if settings.llm_enabled else "rule-based mock",
        "enabled" if settings.LANGCHAIN_TRACING_V2 else "disabled",
    )
    yield
    logger.info("Shutting down…")


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="GrabInsurance API",
    description="Embedded micro-insurance at deal redemption — GrabOn TPM Challenge 2025",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ─────────────────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(recommend.router, prefix=API_PREFIX, tags=["Recommend"])
app.include_router(quote.router,     prefix=API_PREFIX, tags=["Quote"])
app.include_router(policy.router,    prefix=API_PREFIX, tags=["Policy"])
app.include_router(webhook.router,   prefix=API_PREFIX, tags=["Webhook"])
app.include_router(operator.router,  prefix=API_PREFIX, tags=["Operator"])
app.include_router(events.router,    prefix=API_PREFIX, tags=["Visualizer"])


# ── Root redirect → Swagger UI ─────────────────────────────────────────────────
from fastapi.responses import RedirectResponse

@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/api/v1/health", tags=["Health"])
async def health() -> dict:
    return {
        "status":          "ok",
        "llm_enabled":     settings.llm_enabled,
        "tracing_enabled": settings.LANGCHAIN_TRACING_V2,
        "scenario":        settings.MOCK_INSURER_SCENARIO,
    }
