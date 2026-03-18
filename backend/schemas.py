"""
Pydantic v2 schemas — all API request/response contracts.
Never return raw ORM objects from routes; always serialise through these.

Monetary values: always integer paise (1 INR = 100 paise).
Datetimes: always UTC, serialised as ISO-8601.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ── Recommend ─────────────────────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    user_id:       str = Field(..., description="Opaque user identifier")
    deal_id:       str = Field(..., description="Unique deal/coupon ID")
    deal_category: str = Field(..., description="travel|electronics|fashion|food|lifestyle")
    merchant:      str = Field(..., description="Merchant name e.g. MakeMyTrip")
    deal_title:    str = Field(..., description="Human-readable deal title")
    discount_pct:  int = Field(..., ge=1, le=100, description="Discount percentage")


class InsuranceRecommendation(BaseModel):
    product_id:            str
    product_name:          str
    tagline:               str
    premium_paise:         int  = Field(..., ge=0)
    coverage_amount_paise: int  = Field(..., ge=0)
    coverage_bullets:      list[str]
    exclusions:            list[str]
    irdai_reg_number:      str
    policy_wording_url:    str
    score:                 float = Field(..., ge=0.0, le=1.0)


class RecommendResponse(BaseModel):
    recommendation_id:   str
    recommendation:      InsuranceRecommendation | None  # None = no match
    langsmith_trace_url: str | None = None


# ── Quote ─────────────────────────────────────────────────────────────────────

class QuoteRequest(BaseModel):
    recommendation_id: str
    user_id:           str
    product_id:        str


class QuoteResponse(BaseModel):
    quote_id:              str
    product_id:            str
    premium_paise:         int
    coverage_amount_paise: int
    valid_until:           datetime


# ── Policy ────────────────────────────────────────────────────────────────────

class PolicyIssueRequest(BaseModel):
    quote_id:    str
    user_id:     str
    payment_ref: str = Field(..., description="Stub payment reference — not validated")


class PolicyIssueResponse(BaseModel):
    policy_id: str
    status:    str   # pending | issued | declined | failed
    message:   str


# ── Insurer Webhook ───────────────────────────────────────────────────────────

class InsurerWebhookPayload(BaseModel):
    quote_id:    str
    event:       Literal["policy_issued", "policy_declined", "policy_failed"]
    insurer_ref: str | None   = None
    issued_at:   datetime | None = None
    reason:      str | None   = None


# ── Policy list (My Policies page) ────────────────────────────────────────────

class PolicyRecord(BaseModel):
    policy_id:             str
    quote_id:              str
    product_id:            str
    premium_paise:         int
    status:                str   # pending | issued | declined | failed
    insurer_ref:           str | None
    issued_at:             datetime | None
    created_at:            datetime

    model_config = {"from_attributes": True}


# ── Operator ──────────────────────────────────────────────────────────────────

class ScenarioUpdateRequest(BaseModel):
    scenario: Literal["normal", "timeout", "decline", "policy_fail"]


class RecommendationLog(BaseModel):
    recommendation_id:   str
    deal_id:             str
    merchant:            str
    product_id:          str
    score:               float
    langsmith_trace_url: str | None
    created_at:          datetime

    model_config = {"from_attributes": True}


class OperatorStatsResponse(BaseModel):
    total_recommendations:  int
    total_quotes:           int
    total_policies_issued:  int
    current_scenario:       str
    recent_recommendations: list[RecommendationLog]
