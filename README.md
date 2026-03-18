# GrabInsurance

Embedded micro-insurance at deal redemption — GrabOn TPM Challenge 2025.

A vibe-coded GrabOn clone with a FastAPI backend, LangChain + LangSmith scoring,
and a FastMCP server for Claude Desktop integration.

---

## Quick Start (< 5 minutes)

```bash
git clone <repo-url>
cd grabinsurance

# Copy env file and fill in your API keys
cp .env.example .env

# Start backend + frontend
docker compose up backend frontend
```

| Service   | URL                               |
|-----------|-----------------------------------|
| Frontend  | http://localhost:3000             |
| API docs  | http://localhost:8000/docs        |
| Operator  | http://localhost:3000/operator    |

---

## Without Docker (local dev)

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Architecture

```
User clicks "Get Deal"
      │
      ├──▶ Coupon code reveals immediately (never blocked)
      │
      └──▶ POST /api/v1/recommend
                │
                ├── Rule-based scoring (no API key needed)
                └── Claude Haiku via LangChain (ANTHROPIC_API_KEY set)
                        │
                        └── LangSmith trace (LANGCHAIN_API_KEY set)
                │
                ▼
          InsuranceCard widget slides in
                │
          "Add Protection" → POST /api/v1/quote → /api/v1/policy/issue
                                                        │
                                              Background: MockInsurerAdapter
                                                        │
                                              POST /api/v1/webhook/insurer
```

---

## LangSmith Setup

1. Create account at https://smith.langchain.com
2. Generate API key
3. Add to `.env`:
   ```
   LANGCHAIN_API_KEY=lsv2_...
   LANGCHAIN_TRACING_V2=true
   LANGCHAIN_PROJECT=grabinsurance-demo
   ```
4. Every recommendation scoring call will appear in your LangSmith project.

---

## MCP Server (Claude Desktop)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "grabinsurance": {
      "command": "python",
      "args": ["/absolute/path/to/grabinsurance/mcp-server/server.py"],
      "env": {
        "GRABINSURANCE_BACKEND_URL": "http://localhost:8000"
      }
    }
  }
}
```

Install MCP deps:
```bash
cd mcp-server
pip install -r requirements.txt
```

**Available tools:**
- `recommend_insurance` — give Claude a deal context, get insurance recommendation
- `quote_insurance` — get a priced quote from a recommendation

---

## Demo Scenarios

Switch scenarios from the Operator Dashboard at `/operator` — no restart needed.

| Scenario      | What happens                                      |
|---------------|---------------------------------------------------|
| `normal`      | Happy path — insurance card shows, policy issued  |
| `timeout`     | Quote API hangs — card suppressed, coupon works   |
| `decline`     | User ineligible — card suppressed silently        |
| `policy_fail` | Webhook fires twice — idempotency deduplicates    |

---

## Tests

```bash
cd backend
pytest tests/ -v
```

Four test cases: travel recommend, food suppress, quote round-trip, webhook idempotency.

---

## Environment Variables

| Variable                  | Default                            | Description                          |
|---------------------------|------------------------------------|--------------------------------------|
| `ANTHROPIC_API_KEY`       | _(blank)_                          | Leave blank for rule-based mock      |
| `LANGCHAIN_API_KEY`       | _(blank)_                          | Leave blank to disable tracing       |
| `LANGCHAIN_TRACING_V2`    | `false`                            | Enable LangSmith tracing             |
| `LANGCHAIN_PROJECT`       | `grabinsurance-dev`                | LangSmith project name               |
| `DATABASE_URL`            | `sqlite+aiosqlite:///./grabinsurance.db` | SQLite for demo; swap for Postgres |
| `MOCK_INSURER_SCENARIO`   | `normal`                           | Starting scenario                    |
| `WEBHOOK_BASE_URL`        | `http://localhost:8000`            | Where the mock insurer fires callbacks |

---

## Docs

Implementation notes live in `docs/`:

| File                      | Contents                            |
|---------------------------|-------------------------------------|
| `00-PROJECT-OVERVIEW.md`  | Architecture + design decisions     |
| `01-BACKEND-SETUP.md`     | Setup, Docker, testing              |
| `02-DATABASE.md`          | SQLAlchemy models                   |
| `03-SCHEMAS.md`           | Pydantic schemas (API contract)     |
| `04-PRODUCTS.md`          | Insurance product catalogue         |
| `05-LANGCHAIN-CHAIN.md`   | LLM scoring chain                   |
| `06-INSURER-ADAPTER.md`   | Mock insurer + webhook flow         |
| `07-ROUTES.md`            | All API routes                      |
| `08-FRONTEND.md`          | React frontend                      |
