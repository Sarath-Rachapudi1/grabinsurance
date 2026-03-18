# 05 — LangChain Scoring Chain

## Responsibility

Given a deal (category, merchant, discount%) and a list of eligible insurance
products, score them 0.0–1.0 using GPT-4o-mini and return the highest scorer.

## Mode: LLM Only (rule-based removed 2026-03-18; switched to OpenAI 2026-03-18)

All recommendations use GPT-4o-mini via LangChain + `langchain-openai`. There is no rule-based fallback.
If the LLM is unavailable or times out, the recommendation is suppressed cleanly
(returns empty list → no InsuranceCard shown). This is intentional:
a silent wrong recommendation is worse than no recommendation.

| Condition                     | Behaviour                              |
|-------------------------------|----------------------------------------|
| `OPENAI_API_KEY` set          | GPT-4o-mini scores products            |
| `OPENAI_API_KEY` empty        | Error emitted to visualizer, rec=null  |
| GPT-4o-mini timeout (>10s)   | Rec suppressed, `scoring.error` emitted|
| GPT-4o-mini returns non-JSON  | Rec suppressed, `scoring.error` emitted|

---

## What GPT-4o-mini receives

### System prompt
```
You are an insurance relevance scorer for GrabInsurance, embedded
in GrabOn — India's largest coupon platform. Your job is to score how relevant
each insurance product is to a given deal.

Rules:
- Score each product from 0.0 (not relevant) to 1.0 (highly relevant)
- Consider: deal category, merchant type, user intent, financial risk
- Return ONLY valid JSON — no markdown, no explanation
- Format: [{"product_id": "...", "score": 0.0}, ...]
```

### User message (per request)
```
Deal:
- Category: travel
- Merchant: MakeMyTrip
- Title: FLAT 15% OFF FLIGHTS
- Discount: 15%

Products to score:
[
  {"product_id": "TRAVEL_PREMIUM_V1", "product_name": "...", "tagline": "...", "categories": ["travel"]},
  {"product_id": "TRAVEL_BASIC_V1",   "product_name": "...", ...}
]

Return JSON array with product_id and score (0.0-1.0) for each product.
```

### Claude response (example)
```json
[
  {"product_id": "TRAVEL_PREMIUM_V1", "score": 0.95},
  {"product_id": "TRAVEL_BASIC_V1",   "score": 0.80}
]
```

---

## Events emitted (Pipeline Visualizer)

| Event             | When                                      | Key fields                     |
|-------------------|-------------------------------------------|--------------------------------|
| `scoring.mode`    | Before calling Claude                     | mode="llm", model, tracing     |
| `llm.prompt_sent` | Prompt assembled, about to call LangChain | system_prompt, user_message    |
| `llm.response_raw`| Claude responded                          | raw_text, input_tokens, output_tokens |
| `scoring.result`  | JSON parsed successfully                  | scores[], langsmith_url        |
| `scoring.error`   | Timeout or non-JSON response              | reason                         |

---

## LangSmith Tracing

When `LANGCHAIN_TRACING_V2=true` and `LANGCHAIN_API_KEY` is set, every
`score_products()` call is traced in LangSmith under the project
`grabinsurance-dev`. The trace URL is returned in `RecommendResponse.langsmith_trace_url`
and shown in the Pipeline Visualizer as a clickable link.

---

## MCP vs Browser — same chain

Whether the request comes from the browser (user revealing a coupon) or
from Claude Desktop via the MCP tool `recommend_insurance()`, the identical
`score_products()` call is made. The `request.source` event distinguishes them.
