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
embedded in GrabOn — India's largest coupon and deals platform in India.

Your task: score how relevant each insurance product is for a customer about \
to use a specific deal. Return ONLY a valid JSON array — no markdown, no prose.

=== SCORING RUBRIC ===
0.90–1.00  Perfect fit — product is purpose-built for this merchant/category
           (e.g. TRAVEL_BUS_V1 for a RedBus deal, FOOD_ORDER_V1 for Swiggy)
0.70–0.89  Strong fit — product covers the core risk of this deal type
0.50–0.69  Moderate fit — product is relevant but not the ideal choice
0.30–0.49  Weak fit — tangentially relevant; score only if nothing else fits
0.00–0.29  Not relevant — product does not address this deal's risk at all

=== MERCHANT AFFINITY RULES ===
- RedBus / Abhibus → prefer bus-journey products (TRAVEL_BUS_V1 > TRAVEL_BASIC_V1)
- MakeMyTrip / EaseMyTrip / Yatra → prefer flight products (FLIGHT_DELAY_V1, TRAVEL_PREMIUM_V1)
- OYO / Goibibo hotels → prefer hotel cancellation (HOTEL_PROTECT_V1)
- Swiggy / Zomato → prefer food-order products (FOOD_ORDER_V1 > GROCERY_PROTECT_V1)
- Blinkit / Instamart / BigBasket → prefer grocery products (GROCERY_PROTECT_V1)
- Amazon / Flipkart electronics → prefer device protection (GADGET_PROTECT_V1, LAPTOP_PROTECT_V1)
- Apple / Samsung / OnePlus → prefer premium device (GADGET_PREMIUM_V1 > GADGET_PROTECT_V1)
- Myntra / Ajio / Nykaa → prefer fashion/beauty products (FASHION_RETURN_V1, BEAUTY_PROTECT_V1)
- Luxury fashion merchants → prefer LUXURY_FASHION_V1
- International travel deals → prefer TRAVEL_INTERNATIONAL_V1

=== CATEGORY DEFAULTS (when merchant signal is weak) ===
- travel       → TRAVEL_BASIC_V1 (0.7), FLIGHT_DELAY_V1 (0.6), HOTEL_PROTECT_V1 (0.55)
- electronics  → GADGET_PROTECT_V1 (0.75), SCREEN_GUARD_V1 (0.6)
- fashion      → FASHION_RETURN_V1 (0.75), FASHION_DELIVERY_V1 (0.6)
- food         → FOOD_ORDER_V1 (0.8), GROCERY_PROTECT_V1 (0.5)
- lifestyle    → LIFESTYLE_BASIC_V1 (0.65), SUBSCRIPTION_PROTECT_V1 (0.55)

=== CROSS-CATEGORY PRODUCTS ===
PERSONAL_ACCIDENT_V1 and CYBER_PROTECT_V1 apply to multiple categories — \
score them 0.4–0.6 when the primary product scores ≥0.7, as a secondary option.
PURCHASE_PROTECT_V1 is a generic safety net — score 0.3–0.5 if nothing else fits.

=== FORMAT ===
Return ONLY: [{"product_id": "...", "score": 0.00}, ...]
Every product in the input must appear in the output. No extra keys. No markdown."""

_USER_TEMPLATE = """=== DEAL ===
Category : {category}
Merchant : {merchant}
Title    : {title}
Discount : {discount}%

=== PRODUCTS TO SCORE ===
{products_json}

Score every product. Return a JSON array — one object per product with \
"product_id" and "score" (float 0.00–1.00). No markdown, no explanation."""


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
            "product_id":     p["product_id"],
            "product_name":   p["product_name"],
            "tagline":        p["tagline"],
            "categories":     p["eligible_categories"],
            "merchant_hints": p.get("merchant_hints", []),
            "coverage_short": p.get("coverage_bullets", [""])[0] if p.get("coverage_bullets") else "",
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
        max_tokens=1024,
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
    timeout:       float = 20.0,
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
