"""
Core API test suite — 4 scenarios from the build guide checklist.

Run with: pytest backend/tests/ -v
"""
import pytest


# ── 1. Recommend — travel deal → returns a product ─────────────────────────────

@pytest.mark.asyncio
async def test_recommend_travel(async_client):
    """Travel deal should return a matching insurance product."""
    response = await async_client.post("/api/v1/recommend", json={
        "user_id":       "test-user-001",
        "deal_id":       "t1",
        "deal_category": "travel",
        "merchant":      "MakeMyTrip",
        "deal_title":    "Flat 15% off on Domestic Flights",
        "discount_pct":  15,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["recommendation"] is not None
    assert data["recommendation"]["product_id"].startswith("TRAVEL_")
    assert data["recommendation_id"] is not None


# ── 2. Recommend — food deal → suppressed (no product match) ──────────────────

@pytest.mark.asyncio
async def test_recommend_suppressed_for_food(async_client):
    """Food deals have no matching product — recommendation should be None."""
    response = await async_client.post("/api/v1/recommend", json={
        "user_id":       "test-user-002",
        "deal_id":       "fd1",
        "deal_category": "food",
        "merchant":      "Swiggy",
        "deal_title":    "60% off on first order",
        "discount_pct":  60,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["recommendation"] is None


# ── 3. Quote — valid recommendation → returns a quote ─────────────────────────

@pytest.mark.asyncio
async def test_quote_after_recommend(async_client):
    """A valid recommendation should produce a quote with correct product pricing."""
    # Step 1: get a recommendation
    rec_resp = await async_client.post("/api/v1/recommend", json={
        "user_id":       "test-user-003",
        "deal_id":       "e1",
        "deal_category": "electronics",
        "merchant":      "Amazon",
        "deal_title":    "10% off on Smartphones",
        "discount_pct":  10,
    })
    assert rec_resp.status_code == 200
    rec = rec_resp.json()
    assert rec["recommendation"] is not None

    # Step 2: create a quote
    quote_resp = await async_client.post("/api/v1/quote", json={
        "recommendation_id": rec["recommendation_id"],
        "user_id":           "test-user-003",
        "product_id":        rec["recommendation"]["product_id"],
    })
    assert quote_resp.status_code == 200
    quote = quote_resp.json()
    assert quote["quote_id"] is not None
    assert quote["premium_paise"] > 0
    assert quote["coverage_amount_paise"] > 0


# ── 4. Webhook idempotency — duplicate payload → deduplicated ─────────────────

@pytest.mark.asyncio
async def test_webhook_idempotency(async_client):
    """
    Same webhook payload sent twice must not create duplicate policies.
    Second call returns {"status": "deduplicated"}.
    """
    # Step 1: recommend → quote → issue policy
    rec_resp = await async_client.post("/api/v1/recommend", json={
        "user_id":       "test-user-004",
        "deal_id":       "t2",
        "deal_category": "travel",
        "merchant":      "MakeMyTrip",
        "deal_title":    "Up to 40% off on Hotels",
        "discount_pct":  40,
    })
    rec = rec_resp.json()
    assert rec["recommendation"] is not None

    quote_resp = await async_client.post("/api/v1/quote", json={
        "recommendation_id": rec["recommendation_id"],
        "user_id":           "test-user-004",
        "product_id":        rec["recommendation"]["product_id"],
    })
    quote = quote_resp.json()

    policy_resp = await async_client.post("/api/v1/policy/issue", json={
        "quote_id":    quote["quote_id"],
        "user_id":     "test-user-004",
        "payment_ref": "stub-pay-ref-001",
    })
    assert policy_resp.status_code == 200
    assert policy_resp.json()["status"] == "pending"

    # Step 2: send webhook (first time)
    webhook_payload = {
        "quote_id":    quote["quote_id"],
        "event":       "policy_issued",
        "insurer_ref": "INS-TEST-0001",
        "issued_at":   "2026-03-17T10:00:00Z",
        "reason":      None,
    }
    r1 = await async_client.post("/api/v1/webhook/insurer", json=webhook_payload)
    assert r1.status_code == 200
    assert r1.json()["status"] == "ok"

    # Step 3: send identical webhook again → must be deduplicated
    r2 = await async_client.post("/api/v1/webhook/insurer", json=webhook_payload)
    assert r2.status_code == 200
    assert r2.json()["status"] == "deduplicated"
