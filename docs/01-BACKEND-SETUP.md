# 01 — Backend Setup

## File: `backend/requirements.txt`

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
aiosqlite==0.20.0
pydantic==2.7.1
pydantic-settings==2.2.1
httpx==0.27.0
langchain==0.2.1
langchain-anthropic==0.1.13
langsmith==0.1.63
python-dotenv==1.0.1
```

All pinned for reproducibility. No poetry/pipenv — plain pip for simplicity.

---

## File: `backend/Dockerfile`

Multi-stage is overkill for assignment scope. Single stage:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

`--reload` is intentional — we want hot-reload during development.

---

## File: `backend/config.py`

Central settings via `pydantic-settings` — reads from `.env` automatically.

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./grabinsurance.db"
    ANTHROPIC_API_KEY: str = ""
    LANGCHAIN_API_KEY: str = ""
    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_PROJECT: str = "grabinsurance-dev"
    MOCK_INSURER_SCENARIO: str = "normal"
    WEBHOOK_BASE_URL: str = "http://localhost:8000"
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
```

Import `settings` anywhere — no `os.getenv()` scattered across files.

---

## Local Dev (without Docker)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs auto-generated at: http://localhost:8000/docs

---

## Testing

Added 2026-03-17. Test deps added to `requirements.txt`:
```
pytest==8.2.0
pytest-asyncio==0.23.7
anyio==4.3.0
```

Run tests (from repo root):
```bash
cd backend
pytest tests/ -v
```

### Test suite: `tests/test_api.py`

Four cases that match the build guide checklist:

| Test | What it validates |
|------|-------------------|
| `test_recommend_travel` | Travel deal returns a TRAVEL_ product |
| `test_recommend_suppressed_for_food` | Food deal → `recommendation: null` |
| `test_quote_after_recommend` | Recommend → Quote round-trip with correct pricing |
| `test_webhook_idempotency` | Duplicate webhook → second call returns `deduplicated` |

Uses `httpx.ASGITransport` + in-memory SQLite — no running server needed.
`conftest.py` overrides `get_db` dependency per test function.
