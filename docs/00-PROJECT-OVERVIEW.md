# GrabInsurance — Project Overview

## What We're Building

A **GrabOn clone** with embedded micro-insurance. When a user reveals a coupon
code, the site runs an AI scoring call (Claude Haiku) and recommends a contextual
insurance product in a slide-in widget — no separate journey, no sign-up friction.

Two entry points — same backend pipeline:

```
Browser (GrabOn UI)                        MCP (Claude Desktop)
  │                                           │
  │  User clicks "REVEAL PROMO CODE"          │  recommend_insurance() tool call
  │                                           │  mcp-server/server.py
  └──────────────┬────────────────────────────┘
                 │
         POST /api/v1/recommend
                 │
         Claude Haiku (LangChain)
         scores eligible products 0.0–1.0
                 │
         InsuranceCard widget shown (browser)
         or result returned to Claude Desktop (MCP)
```

---

## Tech Stack

| Layer          | Technology                                  |
|----------------|---------------------------------------------|
| Frontend       | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend        | FastAPI (Python 3.11) async                 |
| Database       | SQLite via SQLAlchemy 2.x async             |
| AI Scoring     | Claude Haiku via LangChain (LLM only)       |
| Observability  | LangSmith tracing + SSE Pipeline Visualizer |
| Mock Insurer   | Internal adapter (4 scenarios, stochastic)  |
| MCP            | FastMCP stdio server for Claude Desktop     |

---

## Repository Layout

```
grabinsurance/
├── .env                      ← API keys + config (not committed)
├── .env.example
├── docker-compose.yml
├── docs/
│   ├── 00-PROJECT-OVERVIEW.md
│   ├── 01-BACKEND-SETUP.md
│   ├── 02-DATABASE.md
│   ├── 03-SCHEMAS.md
│   ├── 04-PRODUCTS.md
│   ├── 05-LANGCHAIN-CHAIN.md ← LLM only; prompt/response documented
│   ├── 06-INSURER-ADAPTER.md
│   ├── 07-ROUTES.md          ← includes SSE visualizer events table
│   └── 08-FRONTEND.md        ← GrabOn clone design + visualizer page
├── backend/
│   ├── main.py               ← FastAPI app; / → /docs redirect
│   ├── config.py             ← pydantic-settings; reads .env + ../.env
│   ├── database.py           ← async SQLAlchemy engine + get_db
│   ├── models.py             ← ORM: Recommendation, Quote, Policy
│   ├── schemas.py            ← Pydantic request/response models
│   ├── products.json         ← 4 insurance products catalogue
│   ├── products.py           ← get_eligible_products(), get_product()
│   ├── langchain_chain.py    ← Claude Haiku scoring (LLM only, no fallback)
│   ├── insurer_adapter.py    ← mock insurer + webhook; 4 scenarios
│   ├── event_bus.py          ← asyncio pub/sub for SSE visualizer
│   ├── tests/
│   │   ├── conftest.py       ← in-memory SQLite fixture
│   │   └── test_api.py       ← 4 pytest cases
│   └── routes/
│       ├── recommend.py      ← POST /api/v1/recommend + MCP source detection
│       ├── quote.py          ← POST /api/v1/quote
│       ├── policy.py         ← POST /api/v1/policy/issue + GET /api/v1/policies
│       ├── webhook.py        ← POST /api/v1/webhook/insurer (idempotent)
│       ├── operator.py       ← GET+POST /api/v1/operator/*
│       └── events.py         ← GET /api/v1/events/stream (SSE)
├── mcp-server/
│   ├── server.py             ← FastMCP: recommend_insurance + quote_insurance
│   └── requirements.txt
└── frontend/
    ├── package.json
    ├── vite.config.ts        ← proxy /api → localhost:8000; port 3000
    ├── index.html            ← Tailwind CDN
    └── src/
        ├── main.tsx          ← session ID via crypto.randomUUID()
        ├── App.tsx           ← routes: / /stores/:id /my-policies /operator /visualizer
        ├── api.ts
        ├── types.ts          ← Store, Coupon, InsuranceRecommendation, ...
        ├── data/
        │   ├── stores.ts     ← 9 stores
        │   └── coupons.ts    ← 17 coupons; getCouponsByStore(), getPopularCoupons()
        ├── hooks/
        │   └── useInsurance.ts ← 3s timeout, silent failure, fires in parallel
        ├── components/
        │   ├── AnnouncementBar.tsx
        │   ├── Navbar.tsx          ← search + 🔭 Visualizer link
        │   ├── HeroBanner.tsx
        │   ├── StoreCard.tsx
        │   ├── CouponCard.tsx      ← split CTA + insurance integration zone
        │   ├── StoreHeader.tsx
        │   ├── FilterSidebar.tsx
        │   ├── InsuranceCard.tsx   ← 3-stage: card → checkout → confirmed
        │   └── OperatorDashboard.tsx
        └── pages/
            ├── Home.tsx            ← hero + stores grid + popular coupons
            ├── StorePage.tsx       ← breadcrumb + sidebar + coupon list
            ├── MyPolicies.tsx
            └── VisualizerPage.tsx  ← real-time SSE pipeline visualizer
```

---

## Key Design Decisions

| Decision              | Choice                          | Reason                                        |
|-----------------------|---------------------------------|-----------------------------------------------|
| Database              | SQLite async                    | Zero-config, file-based, demo-ready           |
| AI Scoring            | Claude Haiku — LLM only         | Rule-based removed; LLM always used           |
| LLM failure handling  | Suppress recommendation         | Silent wrong rec worse than no rec            |
| MCP source detection  | user_id prefix "mcp-"           | Same endpoint; source visible in visualizer   |
| Failure scenarios     | Env var + operator API          | Demo-able without restarts                    |
| Idempotency           | Terminal-state check on Policy  | Prevents duplicate policy on webhook retry    |
| IRDAI compliance      | Hardcoded disclosure            | Non-negotiable even in assignment scope       |
| Tailwind              | CDN in index.html               | No build step needed                          |
| Insurance integration | At coupon reveal moment         | Natural user intent: I just unlocked a deal   |
| Visualizer            | SSE event bus                   | Zero-overhead; non-blocking; drop on slow sub |

---

## Key Changes by Date

### 2026-03-17
- GrabOn UI redesign: AnnouncementBar, Navbar, HeroBanner, StoreCard, CouponCard, StoreHeader, FilterSidebar, StorePage, Home
- MCP server: FastMCP with `recommend_insurance` + `quote_insurance` tools
- Backend tests: 4 pytest cases with in-memory SQLite

### 2026-03-18
- **Rule-based scoring removed** — `langchain_chain.py` is LLM-only
- **Pipeline Visualizer** — SSE event bus (`event_bus.py`) + `/api/v1/events/stream`
- **MCP source detection** — `request.source` event emitted from `recommend.py`
- **AI prompt/response visible** — `llm.prompt_sent` + `llm.response_raw` events
- Root `/` now redirects to `/docs` (was 404)

---

## Running Locally

```bash
# Backend
cd grabinsurance/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd grabinsurance/frontend
npm install && npm run dev     # → http://localhost:3000

# Visualizer
open http://localhost:3000/visualizer

# MCP server (Claude Desktop)
python grabinsurance/mcp-server/server.py
```
