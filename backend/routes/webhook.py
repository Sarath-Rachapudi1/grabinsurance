"""
POST /api/v1/webhook/insurer

Idempotent handler for insurer callbacks.
Always returns 200 — even on error — to prevent insurer retry storms.
Duplicate webhooks (same idempotency_key) are silently deduplicated.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import event_bus
from database import get_db
from models import Policy, Quote
from schemas import InsurerWebhookPayload

router = APIRouter()
logger = logging.getLogger(__name__)

_EVENT_TO_STATUS = {
    "policy_issued":   "issued",
    "policy_declined": "declined",
    "policy_failed":   "failed",
}


@router.post("/webhook/insurer", status_code=200)
async def insurer_webhook(
    payload: InsurerWebhookPayload,
    db: AsyncSession = Depends(get_db),
) -> dict:
    logger.info(
        "Webhook received: quote=%s event=%s insurer_ref=%s",
        payload.quote_id, payload.event, payload.insurer_ref,
    )

    await event_bus.emit("step.webhook_received", {
        "quote_id":    payload.quote_id,
        "event":       payload.event,
        "insurer_ref": payload.insurer_ref,
    })

    # 1. Fetch policy by quote_id
    result = await db.execute(
        select(Policy).where(Policy.quote_id == payload.quote_id)
    )
    policy = result.scalar_one_or_none()

    if policy is None:
        logger.warning("Webhook: no policy found for quote_id=%s — ignoring", payload.quote_id)
        return {"status": "ignored", "reason": "no_matching_policy"}

    # 2. Idempotency check — if status already terminal, skip
    if policy.status in ("issued", "declined", "failed"):
        logger.info(
            "Webhook: policy=%s already in terminal state=%s — deduplicated",
            policy.id, policy.status,
        )
        await event_bus.emit("step.webhook_deduplicated", {
            "policy_id":    policy.id,
            "quote_id":     payload.quote_id,
            "current_status": policy.status,
            "note":         "Duplicate webhook — idempotency check passed, skipping",
        })
        return {"status": "deduplicated"}

    # 3. Update policy
    new_status = _EVENT_TO_STATUS.get(payload.event, "failed")
    policy.status = new_status

    if payload.insurer_ref:
        policy.insurer_ref = payload.insurer_ref

    if payload.event == "policy_issued":
        policy.issued_at = (
            payload.issued_at
            if payload.issued_at
            else datetime.now(timezone.utc)
        )

    try:
        await db.flush()
        logger.info(
            "Policy updated: id=%s quote=%s status=%s",
            policy.id, payload.quote_id, new_status,
        )
        await event_bus.emit("step.policy_updated", {
            "policy_id":   policy.id,
            "quote_id":    payload.quote_id,
            "new_status":  new_status,
            "insurer_ref": payload.insurer_ref,
            "issued_at":   policy.issued_at.isoformat() if policy.issued_at else None,
        })
    except IntegrityError:
        await db.rollback()
        logger.warning("Webhook: IntegrityError on policy update — likely duplicate write")
        return {"status": "deduplicated"}

    return {"status": "ok", "policy_id": policy.id, "new_status": new_status}
