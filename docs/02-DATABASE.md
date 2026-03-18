# 02 — Database Layer

## Design

SQLite via async SQLAlchemy. Three tables:

```
recommendations          quotes                   policies
─────────────────        ──────────────────       ──────────────────────
id (PK)                  id (PK)                  id (PK)
user_id                  recommendation_id (FK)   quote_id (FK, unique)
deal_id                  user_id                  idempotency_key (unique)
deal_category            product_id               status
merchant                 premium_paise            insurer_ref
product_id               coverage_amount_paise    issued_at
score                    valid_until              created_at
langsmith_trace_url      created_at
created_at
```

`idempotency_key` on policies prevents duplicate issuance when the mock insurer
fires duplicate webhooks.

---

## File: `backend/models.py`

```python
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime, timezone

class Base(DeclarativeBase):
    pass

class Recommendation(Base):
    __tablename__ = "recommendations"
    id                 = Column(String, primary_key=True)   # UUID
    user_id            = Column(String, nullable=False)
    deal_id            = Column(String, nullable=False)
    deal_category      = Column(String, nullable=False)
    merchant           = Column(String, nullable=False)
    product_id         = Column(String, nullable=False)
    score              = Column(Float, nullable=False)
    langsmith_trace_url= Column(String, nullable=True)
    created_at         = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Quote(Base):
    __tablename__ = "quotes"
    id                     = Column(String, primary_key=True)  # UUID
    recommendation_id      = Column(String, ForeignKey("recommendations.id"))
    user_id                = Column(String, nullable=False)
    product_id             = Column(String, nullable=False)
    premium_paise          = Column(Integer, nullable=False)
    coverage_amount_paise  = Column(Integer, nullable=False)
    valid_until            = Column(DateTime, nullable=False)
    created_at             = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Policy(Base):
    __tablename__ = "policies"
    id               = Column(String, primary_key=True)  # UUID
    quote_id         = Column(String, ForeignKey("quotes.id"), unique=True)
    idempotency_key  = Column(String, unique=True, nullable=False)
    status           = Column(String, nullable=False, default="pending")
    insurer_ref      = Column(String, nullable=True)
    issued_at        = Column(DateTime, nullable=True)
    created_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))
```

---

## File: `backend/database.py`

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from models import Base
from config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,          # set True to log SQL during debugging
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)

async def init_db():
    """Create all tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    """FastAPI dependency — yields an async session."""
    async with AsyncSessionLocal() as session:
        yield session
```

Call `await init_db()` once in the FastAPI lifespan hook — tables are
created automatically. No Alembic migrations needed for assignment scope.
