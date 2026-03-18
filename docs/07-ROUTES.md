# 07 — API Routes

## Route Map

```
POST   /api/v1/recommend              → recommend.py
POST   /api/v1/quote                  → quote.py
POST   /api/v1/policy/issue           → policy.py
POST   /api/v1/webhook/insurer        → webhook.py
GET    /api/v1/operator/stats         → operator.py
POST   /api/v1/operator/scenario      → operator.py
GET    /api/v1/events/stream          → events.py  (SSE — pipeline visualizer)
GET    /api/v1/health                 → main.py (inline)
GET    /                              → redirect to /docs
```

---

## events.py — SSE Pipeline Visualizer

`GET /api/v1/events/stream` — Server-Sent Events stream for the frontend visualizer.

### Event bus architecture

`backend/event_bus.py` is a module-level pub/sub:
- All connected SSE clients share a list of `asyncio.Queue` subscribers
- Every backend operation calls `await event_bus.emit(type, data)`
- `emit()` uses `put_nowait` — never blocks request handlers
- Queues are cleaned up via `unsubscribe()` when the SSE connection closes

### Events emitted per pipeline step

| Source | Event type | When |
|---|---|---|
| `recommend.py` | `request.source` | First — browser or MCP detected via user_id |
| `recommend.py` | `pipeline.start` | Deal context (merchant, category, discount) |
| `recommend.py` | `step.products_found` | Eligible products looked up by category |
| `recommend.py` | `step.scoring_start` | About to call scoring chain |
| `langchain_chain.py` | `scoring.mode` | Always "llm" (rule-based removed 2026-03-18) |
| `langchain_chain.py` | `llm.prompt_sent` | System + user message sent to Claude Haiku |
| `langchain_chain.py` | `llm.response_raw` | Raw JSON text + token counts from Claude |
| `langchain_chain.py` | `scoring.result` | Parsed product scores, sorted descending |
| `langchain_chain.py` | `scoring.error` | Claude timeout or non-JSON response |
| `recommend.py` | `recommend.complete` | Winner selected, rec persisted |
| `recommend.py` | `recommend.suppressed` | No match or Claude error |
| `quote.py` | `request.source` | MCP source emitted if quote from MCP user |
| `quote.py` | `step.quote_created` | Quote row written with premium |
| `policy.py` | `step.policy_initiated` | Policy row created, background task started |
| `insurer_adapter.py` | `step.insurer_processing` | Scenario + simulated latency |
| `insurer_adapter.py` | `step.webhook_firing` | About to POST callback to webhook endpoint |
| `webhook.py` | `step.webhook_received` | Callback arrived from insurer |
| `webhook.py` | `step.policy_updated` | Policy status finalized (issued/declined/failed) |
| `webhook.py` | `step.webhook_deduplicated` | Idempotency dedup triggered |

**Decision (2026-03-17):** Root URL `/` now redirects to `/docs` (was 404).
**Decision (2026-03-18):** Added `request.source`, `llm.prompt_sent`, `llm.response_raw`, `scoring.error` events.

---

## recommend.py — Core Flow

```
1. Validate RecommendRequest
2. get_eligible_products(deal_category)
3. If empty → return RecommendResponse(recommendation=None)
4. score_products(products, deal) via langchain_chain
5. Pick highest score product
6. Persist Recommendation to DB
7. Return RecommendResponse with product + langsmith_trace_url
```

Timeout guard: wrap scoring in `asyncio.wait_for(..., timeout=10.0)`.
On timeout → recommendation suppressed (returns null). No rule-based fallback.
**Rule-based scoring removed 2026-03-18 — always uses Claude Haiku.**

---

## quote.py — Quote Generation

```
1. Validate QuoteRequest
2. Fetch recommendation from DB → 404 if not found
3. Fetch product from catalogue
4. Generate quote_id (UUID4)
5. valid_until = now + 30 minutes
6. Persist Quote to DB
7. Return QuoteResponse
```

---

## policy.py — Policy Issuance

```
1. Validate PolicyIssueRequest
2. Fetch quote from DB → 404 if not found or expired
3. Check quote not already used (unique FK on policies.quote_id)
4. Create Policy row with status="pending"
5. Fire insurer_adapter.issue_policy() as background task
6. Return PolicyIssueResponse(status="pending")
```

The insurer response arrives later via webhook — client polls or uses
optimistic UI.

---

## webhook.py — Idempotent Handler

```
1. Parse InsurerWebhookPayload
2. Fetch Policy by quote_id → 404 if not found
3. Check idempotency_key against DB
   - If exists → return 200 immediately (duplicate, skip)
4. Update Policy.status, Policy.insurer_ref, Policy.issued_at
5. Commit → return 200
```

Always return 200 to the insurer (even on error) — prevents retry storms.
Log errors internally but don't surface them to the insurer callback.

---

## operator.py — Dashboard Support

```
GET /api/v1/operator/stats
  → total_recommendations, total_quotes, total_policies_issued
  → current_scenario (from in-memory state)
  → last 20 recommendations with langsmith_trace_url

POST /api/v1/operator/scenario
  Body: { "scenario": "normal|timeout|decline|policy_fail" }
  → Updates in-memory scenario (no restart needed)
  → Returns confirmation
```

The scenario state is a module-level variable in `insurer_adapter.py`:
```python
_current_scenario: str = settings.MOCK_INSURER_SCENARIO
```
The operator route mutates it directly. Safe for single-process demo use.

**Decision (2026-03-17):** SQLAlchemy 2.x `session.execute()` requires a `Select`
construct, not a bare `Function`. Count queries wrapped in `select()`:
```python
# Correct pattern
await db.execute(select(func.count(Recommendation.id)))
```

---

## GET /api/v1/policies

Added to `policy.py` for the "My Policies" frontend page.

```
GET /api/v1/policies?user_id={uid}
  → list of Policy rows for that user (newest first)
  → joins Quote to get product_id + premium_paise
```

Response schema: `list[PolicyRecord]` — see schemas.py.

---

## Error Handling Convention

All routes use consistent error responses:

```python
# helpers/errors.py
from fastapi import HTTPException

def not_found(entity: str, id: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{entity} '{id}' not found")

def conflict(msg: str) -> HTTPException:
    return HTTPException(status_code=409, detail=msg)

def bad_request(msg: str) -> HTTPException:
    return HTTPException(status_code=422, detail=msg)
```
