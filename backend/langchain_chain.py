"""
Insurance relevance scoring chain — LLM only (GPT-4o-mini via LangChain).

Uses OpenAI's GPT-4o-mini for fast, cost-effective relevance scoring.
No rule-based fallback — if LLM is unavailable, recommendation is suppressed.

Events emitted (visible in Pipeline Visualizer):
  scoring.mode       — always "llm", model name shown
  llm.prompt_sent    — system + user message sent to GPT-4o-mini
  llm.response_raw   — raw JSON text + token counts from OpenAI
  scoring.result     — parsed product scores, sorted descending
  scoring.error      — timeout or non-JSON response (rec suppressed)
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import event_bus
from config import settings

logger = logging.getLogger(__name__)

MODEL = "gpt-4o-mini"

# ── Prompt ────────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are an insurance relevance scorer for GrabInsurance, \
embedded in GrabOn — India's largest coupon platform. Your job is to score \
how relevant each insurance product is to a given deal.

Rules:
- Score each product from 0.0 (not relevant) to 1.0 (highly relevant)
- Consider: deal category, merchant type, user intent, financial risk
- Return ONLY valid JSON — no markdown, no explanation
- Format: [{"product_id": "...", "score": 0.0}, ...]"""

_USER_TEMPLATE = """Deal:
- Category: {category}
- Merchant: {merchant}
- Title: {title}
- Discount: {discount}%

Products to score:
{products_json}

Return JSON array with product_id and score (0.0-1.0) for each product."""


# ── LLM call ──────────────────────────────────────────────────────────────────

async def _llm_score(
    products:     list[dict],
    category:     str,
    merchant:     str,
    title:        str,
    discount_pct: int,
) -> list[tuple[dict, float]]:
    """Call GPT-4o-mini via LangChain and return ranked (product, score) pairs."""
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage, SystemMessage

    products_summary = [
        {
            "product_id":   p["product_id"],
            "product_name": p["product_name"],
            "tagline":      p["tagline"],
            "categories":   p["eligible_categories"],
        }
        for p in products
    ]

    user_message = _USER_TEMPLATE.format(
        category=category,
        merchant=merchant,
        title=title,
        discount=discount_pct,
        products_json=json.dumps(products_summary, indent=2),
    )

    # Emit prompt to visualizer before calling OpenAI
    await event_bus.emit("llm.prompt_sent", {
        "model":          MODEL,
        "system_prompt":  _SYSTEM_PROMPT,
        "user_message":   user_message,
        "products_count": len(products),
    })

    llm = ChatOpenAI(
        model=MODEL,
        api_key=settings.OPENAI_API_KEY,
        temperature=0,
        max_tokens=512,
    )

    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=user_message),
    ]

    response = await llm.ainvoke(messages)
    raw = response.content.strip()

    # Emit raw response to visualizer
    usage = response.response_metadata.get("token_usage", {}) if hasattr(response, "response_metadata") else {}
    await event_bus.emit("llm.response_raw", {
        "raw_text":      raw,
        "input_tokens":  usage.get("prompt_tokens"),
        "output_tokens": usage.get("completion_tokens"),
    })

    # Parse JSON
    try:
        scored_list = json.loads(raw)
        score_map   = {item["product_id"]: float(item["score"]) for item in scored_list}
        scored      = [(p, score_map.get(p["product_id"], 0.0)) for p in products]
        return sorted(scored, key=lambda x: x[1], reverse=True)
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        logger.warning("GPT-4o-mini returned unparseable output (%s) — suppressing", exc)
        await event_bus.emit("scoring.error", {
            "reason":   f"Non-JSON response from GPT-4o-mini: {exc}",
            "raw_text": raw[:300],
        })
        return []


# ── Public API ────────────────────────────────────────────────────────────────

async def score_products(
    products:      list[dict],
    deal_category: str,
    merchant:      str,
    deal_title:    str,
    discount_pct:  int,
    timeout:       float = 10.0,
) -> tuple[list[tuple[dict, float]], str | None]:
    """
    Score eligible insurance products for a deal using GPT-4o-mini.

    Returns:
        scored_products:     sorted list of (product_dict, score). Empty → suppressed.
        langsmith_trace_url: URL if LangSmith tracing is enabled, else None.
    """
    if not products:
        return [], None

    if not settings.OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY is not set — cannot score products")
        await event_bus.emit("scoring.error", {
            "reason": "OPENAI_API_KEY not configured. Add it to .env to enable AI scoring.",
        })
        return [], None

    await event_bus.emit("scoring.mode", {
        "mode":    "llm",
        "model":   MODEL,
        "tracing": settings.LANGCHAIN_TRACING_V2,
    })

    langsmith_url: str | None = None

    try:
        if settings.LANGCHAIN_TRACING_V2:
            from langsmith import traceable

            @traceable(name="grabinsurance.score_products", project_name=settings.LANGCHAIN_PROJECT)
            async def _traced(**kwargs: Any) -> list[tuple[dict, float]]:
                return await _llm_score(**kwargs)

            scored = await asyncio.wait_for(
                _traced(
                    products=products,
                    category=deal_category,
                    merchant=merchant,
                    title=deal_title,
                    discount_pct=discount_pct,
                ),
                timeout=timeout,
            )
            try:
                from langsmith import get_current_run_tree
                run = get_current_run_tree()
                if run:
                    langsmith_url = f"https://smith.langchain.com/public/{run.id}/r"
            except Exception:
                pass
        else:
            scored = await asyncio.wait_for(
                _llm_score(
                    products=products,
                    category=deal_category,
                    merchant=merchant,
                    title=deal_title,
                    discount_pct=discount_pct,
                ),
                timeout=timeout,
            )

        await event_bus.emit("scoring.result", {
            "mode":          "llm",
            "model":         MODEL,
            "scores":        [
                {"product_id": p["product_id"], "score": round(s, 3)}
                for p, s in scored
            ],
            "langsmith_url": langsmith_url,
        })
        return scored, langsmith_url

    except asyncio.TimeoutError:
        logger.warning("GPT-4o-mini scoring timed out after %.1fs — suppressing", timeout)
        await event_bus.emit("scoring.error", {
            "reason":  f"GPT-4o-mini did not respond within {timeout}s — recommendation suppressed",
            "timeout": timeout,
        })
        return [], None

    except Exception as exc:
        logger.error("GPT-4o-mini scoring error: %s — suppressing", exc)
        await event_bus.emit("scoring.error", {
            "reason": str(exc),
        })
        return [], None
