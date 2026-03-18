# 06 — Mock Insurer Adapter

## Responsibility

Simulates an external insurance API. Called when a user triggers policy
issuance. Fires a webhook back to our own backend asynchronously.

## Four Scenarios (controlled via env var or operator API)

| Scenario      | Behaviour                                                     |
|---------------|---------------------------------------------------------------|
| `normal`      | Lognormal latency ~800ms, 95% success, webhook fires once     |
| `timeout`     | Sleeps 31s → caller times out; no webhook fired               |
| `decline`     | Returns `policy_declined` immediately                         |
| `policy_fail` | Fires webhook twice (tests idempotency key deduplication)     |

---

## Latency Model

```python
import random, math

def _simulated_latency(scenario: str) -> float:
    if scenario == "timeout":
        return 31.0
    # Lognormal: mean ~800ms, occasional spikes up to ~3s
    mu, sigma = math.log(0.8), 0.6
    return max(0.1, random.lognormvariate(mu, sigma))
```

---

## Webhook Callback

The adapter calls `POST {WEBHOOK_BASE_URL}/api/v1/webhook/insurer` after the
simulated delay. This mimics real async insurer APIs (Digit, Acko, etc.)

```python
async def _fire_webhook(payload: dict, base_url: str):
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.post(f"{base_url}/api/v1/webhook/insurer", json=payload)
```

For `policy_fail` scenario, this fires twice with the same `quote_id` to test
idempotency enforcement on the webhook handler.

---

## Idempotency Key Format

```
{quote_id}::{user_id}::{unix_timestamp_seconds}
```

The webhook handler checks `Policy.idempotency_key` before inserting.
If a key already exists → return 200 (silently deduplicate), no new row.

---

## Error Budget

The adapter uses a configurable error rate (default 5%) that randomly declines
even in `normal` scenario. This keeps the demo realistic and exercises the
decline UI path naturally.
