/**
 * InsuranceCard — slide-in widget shown after "Get Deal" click.
 *
 * IRDAI compliance (per 08-FRONTEND.md):
 * - Explicit opt-in button only (no pre-checked box)
 * - Exclusions always visible before purchase
 * - IRDAI reg number displayed
 * - Policy wording URL linked
 * - "No thanks" always visible and easy to tap
 */
import { useState } from "react";
import type { InsuranceRecommendation, QuoteResponse, PolicyResponse } from "../types";
import { apiFetch } from "../api";

interface Props {
  recommendation:   InsuranceRecommendation;
  recommendationId: string;
  onDismiss:        () => void;
}

type Stage = "card" | "checkout" | "confirmed" | "error";

export default function InsuranceCard({ recommendation, recommendationId, onDismiss }: Props) {
  const [stage,    setStage]    = useState<Stage>("card");
  const [quote,    setQuote]    = useState<QuoteResponse | null>(null);
  const [policy,   setPolicy]   = useState<PolicyResponse | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [errMsg,   setErrMsg]   = useState("");

  const userId = sessionStorage.getItem("grabon_session_id") ?? "anon";

  async function handleAddProtection() {
    setLoading(true);
    try {
      const q = await apiFetch<QuoteResponse>("/api/v1/quote", {
        method: "POST",
        body: JSON.stringify({
          recommendation_id: recommendationId,
          user_id:           userId,
          product_id:        recommendation.product_id,
        }),
      });
      setQuote(q);
      setStage("checkout");
    } catch {
      setErrMsg("Could not get quote. Please try again.");
      setStage("error");
    } finally {
      setLoading(false);
    }
  }

  async function handlePayAndActivate() {
    if (!quote) return;
    setLoading(true);
    try {
      const p = await apiFetch<PolicyResponse>("/api/v1/policy/issue", {
        method: "POST",
        body: JSON.stringify({
          quote_id:    quote.quote_id,
          user_id:     userId,
          payment_ref: `stub-${Date.now()}`,
        }),
      });
      setPolicy(p);
      setStage("confirmed");
    } catch {
      setErrMsg("Payment failed. Please try again.");
      setStage("error");
    } finally {
      setLoading(false);
    }
  }

  const premiumINR = (recommendation.premium_paise / 100).toFixed(0);
  const gstINR     = ((recommendation.premium_paise * 0.18) / 100).toFixed(2);
  const totalINR   = ((recommendation.premium_paise * 1.18) / 100).toFixed(2);

  // ── Confirmed state ──────────────────────────────────────────────────────
  if (stage === "confirmed") {
    return (
      <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-4 animate-slideDown">
        <p className="text-green-700 font-semibold text-sm">✓ You&apos;re covered!</p>
        <p className="text-xs text-green-600 mt-1">
          Policy #{policy?.policy_id?.slice(0, 12).toUpperCase()} · Pending confirmation
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Check <a href="/my-policies" className="underline text-blue-500">My Policies</a> for status.
        </p>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 animate-slideDown">
        <p className="text-red-600 text-xs">{errMsg}</p>
        <button onClick={onDismiss} className="text-xs text-gray-400 mt-2 underline">
          Dismiss
        </button>
      </div>
    );
  }

  // ── Checkout state ───────────────────────────────────────────────────────
  if (stage === "checkout" && quote) {
    return (
      <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4 animate-slideDown">
        <p className="font-semibold text-sm text-blue-800 mb-2">
          Confirm Protection
        </p>
        <div className="text-xs text-gray-600 space-y-1 mb-3">
          <div className="flex justify-between">
            <span>Premium</span><span>₹{premiumINR}</span>
          </div>
          <div className="flex justify-between">
            <span>GST (18%)</span><span>₹{gstINR}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-800 border-t pt-1 mt-1">
            <span>Total</span><span>₹{totalINR}</span>
          </div>
        </div>
        <button
          onClick={handlePayAndActivate}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white
                     font-semibold text-sm py-2 rounded-lg transition-colors"
        >
          {loading ? "Processing…" : `Pay ₹${totalINR} & Activate`}
        </button>
        <button
          onClick={() => setStage("card")}
          className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600"
        >
          Back
        </button>
      </div>
    );
  }

  // ── Main card ────────────────────────────────────────────────────────────
  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50
                    p-4 animate-slideDown">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🛡️</span>
          <div>
            <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">
              Add Protection
            </p>
            <p className="text-sm font-semibold text-gray-800 leading-tight">
              {recommendation.product_name}
            </p>
            <p className="text-xs text-gray-500">{recommendation.tagline}</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-2"
          aria-label="No thanks"
        >
          ×
        </button>
      </div>

      {/* Coverage bullets */}
      <ul className="space-y-1 mb-2">
        {recommendation.coverage_bullets.slice(0, 3).map((b, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
            <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
            {b}
          </li>
        ))}
      </ul>

      {/* Exclusions — IRDAI requirement: must be visible before purchase */}
      <p className="text-[11px] text-gray-400 mb-3">
        Not covered: {recommendation.exclusions.slice(0, 2).join(" · ")}
      </p>

      {/* CTA */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleAddProtection}
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white
                     font-semibold text-sm py-2 px-3 rounded-lg transition-colors"
        >
          {loading ? "Getting quote…" : `Protect — ₹${premiumINR}`}
        </button>
        <a
          href={recommendation.policy_wording_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-500 hover:underline whitespace-nowrap"
        >
          Policy terms
        </a>
      </div>

      {/* Compliance footer — IRDAI reg number required */}
      <p className="text-[10px] text-gray-400 mt-2">
        By {recommendation.irdai_reg_number}
      </p>
    </div>
  );
}
