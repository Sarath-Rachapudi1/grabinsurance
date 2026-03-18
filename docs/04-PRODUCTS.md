# 04 — Insurance Product Catalogue

## File: `backend/products.json`

Four products, each mapped to one or more deal categories.
The scoring chain ranks all eligible products; highest score wins.

```
TRAVEL_BASIC_V1      → travel
TRAVEL_PREMIUM_V1    → travel
GADGET_PROTECT_V1    → electronics
PURCHASE_PROTECT_V1  → electronics | fashion | lifestyle
```

### Product Schema

```json
{
  "product_id": "string",
  "product_name": "string",
  "tagline": "string",
  "eligible_categories": ["string"],
  "premium_paise": 0,
  "coverage_amount_paise": 0,
  "coverage_bullets": ["string"],
  "exclusions": ["string"],
  "irdai_reg_number": "string",
  "policy_wording_url": "string"
}
```

### Loading Pattern

```python
# In a helper module (products.py)
import json, pathlib

_CATALOGUE: list[dict] = json.loads(
    (pathlib.Path(__file__).parent / "products.json").read_text()
)

def get_eligible_products(category: str) -> list[dict]:
    return [p for p in _CATALOGUE if category in p["eligible_categories"]]

def get_product(product_id: str) -> dict | None:
    return next((p for p in _CATALOGUE if p["product_id"] == product_id), None)
```

Never hardcode product data in route handlers — always load from the catalogue.
This makes it trivial to add/change products for the demo.
