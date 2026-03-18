"""
Operator dashboard API routes.

GET  /api/v1/operator/stats    — KPI counters + recent recommendation log
POST /api/v1/operator/scenario — Switch mock insurer scenario without restart
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import insurer_adapter
from database import get_db
from models import Policy, Quote, Recommendation
from schemas import OperatorStatsResponse, RecommendationLog, ScenarioUpdateRequest

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/operator/stats", response_model=OperatorStatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db)) -> OperatorStatsResponse:
    # Total recommendations
    total_recs = (await db.execute(select(func.count(Recommendation.id)))).scalar() or 0

    # Total quotes
    total_quotes = (await db.execute(select(func.count(Quote.id)))).scalar() or 0

    # Total issued policies
    total_issued = (
        await db.execute(
            select(func.count(Policy.id)).where(Policy.status == "issued")
        )
    ).scalar() or 0

    # Recent 20 recommendations (newest first)
    recent_result = await db.execute(
        select(Recommendation)
        .order_by(Recommendation.created_at.desc())
        .limit(20)
    )
    recent_recs = recent_result.scalars().all()

    logs = [
        RecommendationLog(
            recommendation_id=r.id,
            deal_id=r.deal_id,
            merchant=r.merchant,
            product_id=r.product_id,
            score=r.score,
            langsmith_trace_url=r.langsmith_trace_url,
            created_at=r.created_at,
        )
        for r in recent_recs
    ]

    return OperatorStatsResponse(
        total_recommendations=total_recs,
        total_quotes=total_quotes,
        total_policies_issued=total_issued,
        current_scenario=insurer_adapter.get_scenario(),
        recent_recommendations=logs,
    )


@router.post("/operator/scenario")
async def update_scenario(body: ScenarioUpdateRequest) -> dict:
    insurer_adapter.set_scenario(body.scenario)
    logger.info("Operator updated scenario → %s", body.scenario)
    return {
        "status":   "ok",
        "scenario": body.scenario,
        "message":  f"Mock insurer scenario set to '{body.scenario}'",
    }
