"""
Mock insurer adapter.

Simulates an external insurance API with configurable failure scenarios.
The scenario can be changed at runtime via the operator route — no restart needed.

Scenarios:
  normal      — lognormal latency ~800ms, 95% success rate
  timeout     — sleeps 31s (caller should time out)
  decline     — immediately fires policy_declined webhook
  policy_fail — fires webhook twice (tests idempotency deduplication)
"""
from __future__ import annotations

import asyncio
import logging
import math
import random
import uuid
from datetime import datetime, timezone

import httpx

import event_bus
from config import settings

logger = logging.getLogger(__name__)

# ── Mutable scenario state ─────────────────────────────────────────────────────
# Module-level variable — mutated by operator route. Safe for single-process demo.
_current_scenario: str = settings.MOCK_INSURER_SCENARIO


def get_scenario() -> str:
    return _current_scenario


def set_scenario(scenario: str) -> None:
    global _current_scenario
    _current_scenario = scenario
    logger.info("Mock insurer scenario updated → %s", scenario)


# ── Latency simulation ─────────────────────────────────────────────────────────

def _simulated_latency(scenario: str) -> float:
    """Return sleep duration in seconds for the given scenario."""
    if scenario == "timeout":
        return 31.0  # exceeds any reasonable timeout
    # Lognormal: μ=ln(0.8), σ=0.6  → mean ~0.8s, occasional spikes to ~3s
    mu = math.log(0.8)
    sigma = 0.6
    return max(0.1, random.lognormvariate(mu, sigma))


# ── Webhook helper ─────────────────────────────────────────────────────────────

async def _fire_webhook(payload: dict, base_url: str) -> None:
    """POST the insurer callback to our own webhook endpoint."""
    url = f"{base_url}/api/v1/webhook/insurer"
    await event_bus.emit("step.webhook_firing", {
        "quote_id":    payload.get("quote_id"),
        "event":       payload.get("event"),
        "insurer_ref": payload.get("insurer_ref"),
        "url":         url,
    })
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            logger.debug("Webhook fired → %s  status=%s", url, response.status_code)
    except Exception as exc:
        logger.error("Webhook delivery failed: %s", exc)


# ── Main entry point ──────────────────────────────────────────────────────────

async def issue_policy(quote_id: str, user_id: str) -> None:
    """
    Simulate async policy issuance. Runs as a FastAPI BackgroundTask.
    Fires webhook callback(s) after simulated latency.
    """
    scenario = _current_scenario
    latency  = _simulated_latency(scenario)

    logger.info(
        "Mock insurer: quote=%s  scenario=%s  latency=%.2fs",
        quote_id, scenario, latency,
    )

    await event_bus.emit("step.insurer_processing", {
        "quote_id":          quote_id,
        "scenario":          scenario,
        "simulated_latency": round(latency, 2),
        "note": (
            "Sleeping 31s — will appear as timeout to caller"
            if scenario == "timeout"
            else f"Simulating insurer response in ~{latency:.1f}s"
        ),
    })

    await asyncio.sleep(latency)

    base_url    = settings.WEBHOOK_BASE_URL
    insurer_ref = f"INS-{uuid.uuid4().hex[:8].upper()}"

    match scenario:
        case "decline":
            payload = {
                "quote_id":    quote_id,
                "event":       "policy_declined",
                "insurer_ref": None,
                "issued_at":   None,
                "reason":      "Risk assessment failed — deal category not eligible.",
            }
            await _fire_webhook(payload, base_url)

        case "policy_fail":
            # Fire same webhook twice — backend idempotency must deduplicate
            payload = {
                "quote_id":    quote_id,
                "event":       "policy_issued",
                "insurer_ref": insurer_ref,
                "issued_at":   datetime.now(timezone.utc).isoformat(),
                "reason":      None,
            }
            logger.info("policy_fail scenario: firing duplicate webhooks for quote=%s", quote_id)
            await _fire_webhook(payload, base_url)
            await asyncio.sleep(0.5)   # tiny gap between duplicates
            await _fire_webhook(payload, base_url)

        case _:  # normal (+ timeout falls through here if caller already timed out)
            # 5% random decline even in normal scenario — keeps demo realistic
            if random.random() < 0.05:
                payload = {
                    "quote_id":    quote_id,
                    "event":       "policy_declined",
                    "insurer_ref": None,
                    "issued_at":   None,
                    "reason":      "Automated underwriting decline.",
                }
            else:
                payload = {
                    "quote_id":    quote_id,
                    "event":       "policy_issued",
                    "insurer_ref": insurer_ref,
                    "issued_at":   datetime.now(timezone.utc).isoformat(),
                    "reason":      None,
                }
            await _fire_webhook(payload, base_url)
