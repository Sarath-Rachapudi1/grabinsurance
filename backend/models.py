"""
SQLAlchemy ORM models.
Tables are created automatically on startup via init_db().
No Alembic migrations — assignment scope.
"""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Recommendation(Base):
    __tablename__ = "recommendations"

    id                  = Column(String,  primary_key=True)          # UUID4
    user_id             = Column(String,  nullable=False, index=True)
    deal_id             = Column(String,  nullable=False)
    deal_category       = Column(String,  nullable=False)
    merchant            = Column(String,  nullable=False)
    product_id          = Column(String,  nullable=False)
    score               = Column(Float,   nullable=False)
    langsmith_trace_url = Column(String,  nullable=True)
    created_at          = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    quotes = relationship("Quote", back_populates="recommendation", lazy="select")


class Quote(Base):
    __tablename__ = "quotes"

    id                    = Column(String,   primary_key=True)          # UUID4
    recommendation_id     = Column(String,   ForeignKey("recommendations.id"), nullable=False)
    user_id               = Column(String,   nullable=False, index=True)
    product_id            = Column(String,   nullable=False)
    premium_paise         = Column(Integer,  nullable=False)
    coverage_amount_paise = Column(Integer,  nullable=False)
    valid_until           = Column(DateTime, nullable=False)
    created_at            = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    recommendation = relationship("Recommendation", back_populates="quotes")
    policy         = relationship("Policy", back_populates="quote", uselist=False, lazy="select")


class Policy(Base):
    __tablename__ = "policies"

    id               = Column(String,   primary_key=True)              # UUID4
    quote_id         = Column(String,   ForeignKey("quotes.id"), unique=True, nullable=False)
    idempotency_key  = Column(String,   unique=True, nullable=False)
    status           = Column(String,   nullable=False, default="pending")
    insurer_ref      = Column(String,   nullable=True)
    issued_at        = Column(DateTime, nullable=True)
    created_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    quote = relationship("Quote", back_populates="policy")
