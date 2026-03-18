"""
GrabInsurance MCP Server — two tools for Claude Desktop.

Tools:
  recommend_insurance  — given a deal context, returns the best insurance product
  quote_insurance      — given a recommendation, returns a priced quote

Run (stdio mode for Claude Desktop):
  python mcp-server/server.py

Configure in Claude Desktop (claude_desktop_config.json):
  {
    "mcpServers": {
      "grabinsurance": {
        "command": "python",
        "args": ["/path/to/grabinsurance/mcp-server/server.py"],
        "env": {
          "GRABINSURANCE_BACKEND_URL": "http://localhost:8000"
        }
      }
    }
  }
"""
from __future__ import annotations

import os
import uuid

import httpx
from dotenv import load_dotenv
from fastmcp import FastMCP

load_dotenv()

BACKEND_URL = os.getenv("GRABINSURANCE_BACKEND_URL", "http://localhost:8000")
MCP_USER_ID = "mcp-claude-desktop"   # fixed user for MCP-originated requests

mcp = FastMCP("GrabInsurance")


# ── Tool 1: recommend_insurance ───────────────────────────────────────────────

@mcp.tool()
async def recommend_insurance(
    merchant:      str,
    deal_category: str,
    deal_title:    str,
    discount_pct:  int = 0,
) -> dict:
    """
    Recommend an insurance product for a deal context.

    Args:
        merchant:      Merchant name (e.g. "MakeMyTrip", "Amazon").
        deal_category: Deal category — travel | electronics | fashion | food | lifestyle.
        deal_title:    Human-readable deal title (used for LLM scoring context).
        discount_pct:  Discount percentage (0–100). Default 0.

    Returns:
        dict with recommendation details or a message if no product matches.
    """
    deal_id = f"mcp-{uuid.uuid4().hex[:8]}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{BACKEND_URL}/api/v1/recommend",
            json={
                "user_id":       MCP_USER_ID,
                "deal_id":       deal_id,
                "deal_category": deal_category,
                "merchant":      merchant,
                "deal_title":    deal_title,
                "discount_pct":  discount_pct,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    rec = data.get("recommendation")
    if rec is None:
        return {
            "matched":  False,
            "message":  f"No insurance product available for {deal_category} deals from {merchant}.",
        }

    return {
        "matched":            True,
        "recommendation_id":  data["recommendation_id"],
        "product_id":         rec["product_id"],
        "product_name":       rec["product_name"],
        "tagline":            rec["tagline"],
        "premium_inr":        rec["premium_paise"] / 100,
        "coverage_bullets":   rec["coverage_bullets"],
        "exclusions":         rec["exclusions"],
        "irdai_reg_number":   rec["irdai_reg_number"],
        "confidence_score":   rec["score"],
    }


# ── Tool 2: quote_insurance ───────────────────────────────────────────────────

@mcp.tool()
async def quote_insurance(
    recommendation_id: str,
    product_id:        str,
) -> dict:
    """
    Get a priced, time-bound quote from a recommendation.

    Args:
        recommendation_id: ID returned by recommend_insurance.
        product_id:        Product ID from the recommendation.

    Returns:
        dict with quote_id, premium, GST, total, and validity.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{BACKEND_URL}/api/v1/quote",
            json={
                "recommendation_id": recommendation_id,
                "user_id":           MCP_USER_ID,
                "product_id":        product_id,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    premium_inr = data["premium_paise"] / 100
    gst_inr     = round(premium_inr * 0.18, 2)
    total_inr   = round(premium_inr + gst_inr, 2)

    return {
        "quote_id":    data["quote_id"],
        "product_id":  data["product_id"],
        "premium_inr": premium_inr,
        "gst_inr":     gst_inr,
        "total_inr":   total_inr,
        "valid_until": data["valid_until"],
    }


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run()
