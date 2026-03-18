"""
POST /api/v1/recommend

Core recommendation route. Given a deal, returns the best-matching
insurance product (or null if no match exists).
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

import event_bus
from database import get_db
from langchain_chain import score_products
from models import Recommendation
from products import get_eligible_products, get_product
from schemas import InsuranceRecommendation, RecommendRequest, RecommendResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(
    body: RecommendRequest,
    db: AsyncSession = Depends(get_db),
) -> RecommendResponse:

    # ── Step 1: Detect request source (MCP vs browser) ────────────────────────
    is_mcp = body.user_id.startswith("mcp-")
    await event_bus.emit("request.source", {
        "source":       "mcp" if is_mcp else "browser",
        "user_id":      body.user_id,
        "description":  (
            "Request from MCP tool (Claude Desktop → recommend_insurance())"
            if is_mcp else
            "Request from browser (user clicked REVEAL PROMO CODE)"
        ),
    })

    # ── Step 2: Pipeline starts ────────────────────────────────────────────────
    await event_bus.emit("pipeline.start", {
        "user_id":      body.user_id,
        "deal_id":      body.deal_id,
        "category":     body.deal_category,
        "merchant":     body.merchant,
        "deal_title":   body.deal_title,
        "discount_pct": body.discount_pct,
        "source":       "mcp" if is_mcp else "browser",
    })

    # ── Step 2: Find eligible products ────────────────────────────────────────
    eligible = get_eligible_products(body.deal_category)

    await event_bus.emit("step.products_found", {
        "category":  body.deal_category,
        "products":  [p["product_id"] for p in eligible],
        "count":     len(eligible),
    })

    if not eligible:
        logger.debug("No eligible products for category=%s", body.deal_category)
        rec_id = str(uuid.uuid4())
        db.add(Recommendation(
            id=rec_id,
            user_id=body.user_id,
            deal_id=body.deal_id,
            deal_category=body.deal_category,
            merchant=body.merchant,
            product_id="NONE",
            score=0.0,
            langsmith_trace_url=None,
        ))
        await event_bus.emit("recommend.suppressed", {
            "rec_id":   rec_id,
            "reason":   f"No insurance products mapped to category '{body.deal_category}'",
            "category": body.deal_category,
        })
        return RecommendResponse(
            recommendation_id=rec_id,
            recommendation=None,
            langsmith_trace_url=None,
        )

    # ── Step 3: Score eligible products (AI or rule-based) ────────────────────
    await event_bus.emit("step.scoring_start", {
        "products": [p["product_id"] for p in eligible],
        "merchant": body.merchant,
        "category": body.deal_category,
    })

    scored, langsmith_url = await score_products(
        products=eligible,
        deal_category=body.deal_category,
        merchant=body.merchant,
        deal_title=body.deal_title,
        discount_pct=body.discount_pct,
    )

    # ── Step 4: Pick top scorer ───────────────────────────────────────────────
    best_product, best_score = scored[0] if scored else (None, 0.0)

    await event_bus.emit("step.scoring_result", {
        "scores": [
            {"product_id": p["product_id"], "score": round(s, 3)}
            for p, s in scored
        ],
        "winner":          best_product["product_id"] if best_product else None,
        "winner_score":    round(best_score, 3),
        "langsmith_url":   langsmith_url,
        "threshold":       0.3,
        "above_threshold": best_score >= 0.3,
    })

    if best_product is None or best_score < 0.3:
        rec_id = str(uuid.uuid4())
        db.add(Recommendation(
            id=rec_id,
            user_id=body.user_id,
            deal_id=body.deal_id,
            deal_category=body.deal_category,
            merchant=body.merchant,
            product_id="BELOW_THRESHOLD",
            score=best_score,
            langsmith_trace_url=langsmith_url,
        ))
        await event_bus.emit("recommend.suppressed", {
            "rec_id":  rec_id,
            "reason":  f"Best score {best_score:.2f} is below threshold 0.30",
            "score":   best_score,
        })
        return RecommendResponse(
            recommendation_id=rec_id,
            recommendation=None,
            langsmith_trace_url=langsmith_url,
        )

    # ── Step 5: Persist recommendation ───────────────────────────────────────
    rec_id = str(uuid.uuid4())
    db.add(Recommendation(
        id=rec_id,
        user_id=body.user_id,
        deal_id=body.deal_id,
        deal_category=body.deal_category,
        merchant=body.merchant,
        product_id=best_product["product_id"],
        score=best_score,
        langsmith_trace_url=langsmith_url,
    ))

    logger.info(
        "Recommendation: user=%s deal=%s product=%s score=%.2f",
        body.user_id, body.deal_id, best_product["product_id"], best_score,
    )

    recommendation = InsuranceRecommendation(
        product_id=best_product["product_id"],
        product_name=best_product["product_name"],
        tagline=best_product["tagline"],
        premium_paise=best_product["premium_paise"],
        coverage_amount_paise=best_product["coverage_amount_paise"],
        coverage_bullets=best_product["coverage_bullets"],
        exclusions=best_product["exclusions"],
        irdai_reg_number=best_product["irdai_reg_number"],
        policy_wording_url=best_product["policy_wording_url"],
        score=best_score,
    )

    await event_bus.emit("recommend.complete", {
        "rec_id":       rec_id,
        "product_id":   best_product["product_id"],
        "product_name": best_product["product_name"],
        "score":        round(best_score, 3),
        "premium_inr":  best_product["premium_paise"] / 100,
        "langsmith_url": langsmith_url,
        "widget_shown": True,
    })

    return RecommendResponse(
        recommendation_id=rec_id,
        recommendation=recommendation,
        langsmith_trace_url=langsmith_url,
    )
