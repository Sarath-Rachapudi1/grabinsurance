"""
Insurance product catalogue loader.
Reads products.json once at import time; thread-safe for read-only access.
"""
import json
import pathlib

_CATALOGUE: list[dict] = json.loads(
    (pathlib.Path(__file__).parent / "products.json").read_text(encoding="utf-8")
)


def get_all_products() -> list[dict]:
    """Return full catalogue."""
    return _CATALOGUE


def get_eligible_products(category: str) -> list[dict]:
    """Return products that support the given deal category."""
    return [p for p in _CATALOGUE if category in p["eligible_categories"]]


def get_product(product_id: str) -> dict | None:
    """Return a single product by ID, or None if not found."""
    return next((p for p in _CATALOGUE if p["product_id"] == product_id), None)
