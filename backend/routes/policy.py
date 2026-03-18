"""
POST /api/v1/policy/issue

Initiates async policy issuance via mock insurer.
Returns immediately with status=pending; real result arrives via webhook.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import event_bus
from database import get_db
from insurer_adapter import issue_policy
from models import Policy, Quote
from schemas import PolicyIssueRequest, PolicyIssueResponse, PolicyRecord

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/policy/issue", response_model=PolicyIssueResponse)
async def issue(
    body: PolicyIssueRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> PolicyIssueResponse:
    # 1. Fetch and validate the quote
    result = await db.execute(
        select(Quote).where(Quote.id == body.quote_id)
    )
    quote = result.scalar_one_or_none()

    if quote is None:
        raise HTTPException(status_code=404, detail=f"Quote '{body.quote_id}' not found.")

    if quote.user_id != body.user_id:
        raise HTTPException(status_code=403, detail="User mismatch.")

    # 2. Check quote expiry
    now = datetime.now(timezone.utc)
    valid_until = quote.valid_until
    if valid_until.tzinfo is None:
        valid_until = valid_until.replace(tzinfo=timezone.utc)

    if now > valid_until:
        raise HTTPException(status_code=422, detail="Quote has expired. Please request a new quote.")

    # 3. Check for existing policy on this quote (prevent double-issuance)
    existing = await db.execute(
        select(Policy).where(Policy.quote_id == body.quote_id)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail="Policy already issued or in progress for this quote.",
        )

    # 4. Create policy row with status=pending
    policy_id       = str(uuid.uuid4())
    idempotency_key = f"{body.quote_id}::{body.user_id}::{int(now.timestamp())}"

    policy = Policy(
        id=policy_id,
        quote_id=body.quote_id,
        idempotency_key=idempotency_key,
        status="pending",
    )
    db.add(policy)

    logger.info(
        "Policy initiated: id=%s quote=%s user=%s",
        policy_id, body.quote_id, body.user_id,
    )

    await event_bus.emit("step.policy_initiated", {
        "policy_id":  policy_id,
        "quote_id":   body.quote_id,
        "user_id":    body.user_id,
        "status":     "pending",
        "message":    "Policy row created; handing off to insurer adapter (async)",
    })

    # 5. Kick off async insurer call (returns immediately to client)
    background_tasks.add_task(issue_policy, body.quote_id, body.user_id)

    return PolicyIssueResponse(
        policy_id=policy_id,
        status="pending",
        message="Policy issuance initiated. You will be notified once confirmed.",
    )


@router.get("/policies", response_model=list[PolicyRecord])
async def list_policies(
    user_id: str = Query(..., description="User identifier"),
    db: AsyncSession = Depends(get_db),
) -> list[PolicyRecord]:
    """Return all policies for a user, newest first. Used by the My Policies page."""
    result = await db.execute(
        select(Policy, Quote)
        .join(Quote, Policy.quote_id == Quote.id)
        .where(Quote.user_id == user_id)
        .order_by(Policy.created_at.desc())
    )
    rows = result.all()

    return [
        PolicyRecord(
            policy_id=policy.id,
            quote_id=policy.quote_id,
            product_id=quote.product_id,
            premium_paise=quote.premium_paise,
            status=policy.status,
            insurer_ref=policy.insurer_ref,
            issued_at=policy.issued_at,
            created_at=policy.created_at,
        )
        for policy, quote in rows
    ]
