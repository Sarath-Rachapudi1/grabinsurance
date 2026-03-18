# 03 — Pydantic Schemas

All API request/response contracts live in `schemas.py`.
Never return raw ORM objects — always go through these.

---

## Recommend

```python
# POST /api/v1/recommend
class RecommendRequest(BaseModel):
    user_id: str
    deal_id: str
    deal_category: str        # travel | electronics | fashion | food | lifestyle
    merchant: str
    deal_title: str
    discount_pct: int

class InsuranceRecommendation(BaseModel):
    product_id: str
    product_name: str
    tagline: str
    premium_paise: int        # always in paise (1 INR = 100 paise)
    coverage_amount_paise: int
    coverage_bullets: list[str]
    exclusions: list[str]
    irdai_reg_number: str
    policy_wording_url: str
    score: float              # 0.0 – 1.0

class RecommendResponse(BaseModel):
    recommendation_id: str
    recommendation: InsuranceRecommendation | None   # None = no match
    langsmith_trace_url: str | None
```

---

## Quote

```python
# POST /api/v1/quote
class QuoteRequest(BaseModel):
    recommendation_id: str
    user_id: str
    product_id: str

class QuoteResponse(BaseModel):
    quote_id: str
    product_id: str
    premium_paise: int
    coverage_amount_paise: int
    valid_until: datetime
```

---

## Policy

```python
# POST /api/v1/policy/issue
class PolicyIssueRequest(BaseModel):
    quote_id: str
    user_id: str
    # Payment stub — real payment handled externally
    payment_ref: str

class PolicyIssueResponse(BaseModel):
    policy_id: str
    status: str               # pending | issued | declined | failed
    message: str
```

---

## Webhook (Insurer → Backend)

```python
# POST /api/v1/webhook/insurer
class InsurerWebhookPayload(BaseModel):
    quote_id: str
    event: str                # policy_issued | policy_declined | policy_failed
    insurer_ref: str | None
    issued_at: datetime | None
    reason: str | None
```

---

## Policy List (My Policies page)

Added 2026-03-17 for the frontend My Policies route.

```python
# GET /api/v1/policies?user_id={uid}
class PolicyRecord(BaseModel):
    policy_id: str
    quote_id: str
    product_id: str
    premium_paise: int
    status: str               # pending | issued | declined | failed
    insurer_ref: str | None
    issued_at: datetime | None
    created_at: datetime
```

Joins `policies` → `quotes` to retrieve `product_id` and `premium_paise`
without an extra catalogue lookup on the frontend.

---

## Operator

```python
class ScenarioUpdateRequest(BaseModel):
    scenario: Literal["normal", "timeout", "decline", "policy_fail"]

class RecommendationLog(BaseModel):
    recommendation_id: str
    deal_id: str
    merchant: str
    product_id: str
    score: float
    langsmith_trace_url: str | None
    created_at: datetime

class OperatorStatsResponse(BaseModel):
    total_recommendations: int
    total_quotes: int
    total_policies_issued: int
    current_scenario: str
    recent_recommendations: list[RecommendationLog]
```

---

## Notes

- All monetary values in **paise** (integer) — no float currency arithmetic.
- `datetime` fields always stored as UTC; serialised as ISO-8601.
- `None` on `recommendation` means no insurance product matched the deal
  category — frontend should silently skip the widget.
