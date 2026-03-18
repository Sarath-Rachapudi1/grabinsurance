"""
Async SQLAlchemy engine and session factory.
Usage:
    - Call `await init_db()` once in FastAPI lifespan to create tables.
    - Use `get_db` as a FastAPI dependency to get a session per request.
"""
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from config import settings
from models import Base

# Single engine instance (shared across all requests)
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,   # flip to True to log raw SQL during debugging
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def init_db() -> None:
    """Create all tables on first run. Idempotent — safe to call every startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """FastAPI dependency — yields one AsyncSession per HTTP request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
