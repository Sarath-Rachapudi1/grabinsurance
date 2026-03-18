"""
POST /api/v1/quote

Generates a time-bound quote from a recommendation.
Quote expires in 30 minutes.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import event_bus
from database import get_db
from models import Recommendation, Quote
from products import get_product
from schemas import QuoteRequest, QuoteResponse

router = APIRouter()
logger = logging.getLogger(__name__)

QUOTE_VALIDITY_MINUTES = 30


@router.post("/quote", response_model=QuoteResponse)
async def create_quote(
    body: QuoteRequest,
    db: AsyncSession = Depends(get_db),
) -> QuoteResponse:
    # Emit MCP source if applicable
    if body.user_id.startswith("mcp-"):
        await event_bus.emit("request.source", {
            "source":      "mcp",
            "user_id":     body.user_id,
            "description": "Quote request from MCP tool (Claude Desktop → quote_insurance())",
        })

    # 1. Fetch the recommendation
    result = await db.execute(
        select(Recommendation).where(Recommendation.id == body.recommendation_id)
    )
    rec = result.scalar_one_or_none()

    if rec is None:
        raise HTTPException(
            status_code=404,
            detail=f"Recommendation '{body.recommendation_id}' not found.",
        )

    # 2. Verify user matches (basic guard)
    if rec.user_id != body.user_id:
        raise HTTPException(status_code=403, detail="User mismatch.")

    # 3. Verify product exists in catalogue
    product = get_product(body.product_id)
    if product is None:
        raise HTTPException(
            status_code=404,
            detail=f"Product '{body.product_id}' not found in catalogue.",
        )

    # 4. Create quote
    quote_id    = str(uuid.uuid4())
    valid_until = datetime.now(timezone.utc) + timedelta(minutes=QUOTE_VALIDITY_MINUTES)

    db.add(Quote(
        id=quote_id,
        recommendation_id=body.recommendation_id,
        user_id=body.user_id,
        product_id=body.product_id,
        premium_paise=product["premium_paise"],
        coverage_amount_paise=product["coverage_amount_paise"],
        valid_until=valid_until,
    ))

    logger.info(
        "Quote created: id=%s user=%s product=%s premium=%d paise",
        quote_id, body.user_id, body.product_id, product["premium_paise"],
    )

    await event_bus.emit("step.quote_created", {
        "quote_id":            quote_id,
        "product_id":          body.product_id,
        "product_name":        product["product_name"],
        "premium_inr":         product["premium_paise"] / 100,
        "coverage_inr":        product["coverage_amount_paise"] / 100,
        "valid_until":         valid_until.isoformat(),
        "recommendation_id":   body.recommendation_id,
    })

    return QuoteResponse(
        quote_id=quote_id,
        product_id=body.product_id,
        premium_paise=product["premium_paise"],
        coverage_amount_paise=product["coverage_amount_paise"],
        valid_until=valid_until,
    )
