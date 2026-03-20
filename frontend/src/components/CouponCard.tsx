/**
 * CouponCard — GrabOn-style coupon card with insurance integration.
 *
 * Layout (per GrabOn reference UI):
 *   ┌ header: badge + verified ─────────────────────────────────────────┐
 *   │ body:   title/description (left)  +  CTA button (right)           │
 *   └ footer: metadata + icons ─────────────────────────────────────────┘
 *
 * On "REVEAL PROMO CODE" click:
 *   - Code shown in dashed box
 *   - fetchInsurance(coupon) fires in parallel (never blocks reveal)
 *   - InsuranceCard slides in below the code
 *
 * Insurance integration point: between code reveal and footer.
 * Insurance is ONLY shown when backend returns a recommendation.
 * Food deals: recommendation is null → widget never renders.
 */
import { useState } from "react";
import type { Coupon } from "../types";
import InsuranceCard from "./InsuranceCard";
import { useInsurance } from "../hooks/useInsurance";

interface Props {
  coupon: Coupon;
  compact?: boolean; // when true, used in homepage grid (no sidebar)
}

const BADGE_STYLES: Record<string, string> = {
  exclusive:   "bg-green-900 text-white",
  recommended: "bg-gray-900 text-white",
};

const BADGE_LABELS: Record<string, string> = {
  exclusive:   "GRABON EXCLUSIVE",
  recommended: "RECOMMENDED",
};

export default function CouponCard({ coupon, compact = false }: Props) {
  const [revealed,  setRevealed]  = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [copied,    setCopied]    = useState(false);

  const { recommendation, recommendationId, isLoading, fetchInsurance } = useInsurance();

  function handleReveal() {
    if (revealed) return;
    setRevealed(true);
    fetchInsurance(coupon);
  }

  function handleCopy() {
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden
                    hover:shadow-md transition-shadow border-l-4 border-l-green-500">

      {/* ── Header row ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        {coupon.badge ? (
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded ${BADGE_STYLES[coupon.badge]}`}>
            {BADGE_LABELS[coupon.badge]}
          </span>
        ) : (
          <span />
        )}
        {coupon.verified && (
          <span className="text-[11px] font-semibold text-green-600 flex items-center gap-1">
            ✓ Verified
          </span>
        )}
      </div>

      {/* ── Body row ───────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-3 px-4 py-4 ${compact ? "flex-col sm:flex-row" : ""}`}>

        {/* Text (left) */}
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-gray-900 text-base leading-tight tracking-wide mb-1">
            {coupon.title}
          </h3>
          <p className="text-sm text-gray-500 leading-snug line-clamp-2">{coupon.description}</p>
        </div>

        {/* CTA (right) */}
        <div className="flex-shrink-0">
          {coupon.ctaLabel === "REVEAL PROMO CODE" ? (
            /* ── Promo code coupon ── split reveal button → code box */
            !revealed ? (
              <button
                onClick={handleReveal}
                className="flex items-stretch rounded-lg overflow-hidden shadow-sm
                           hover:shadow-md transition-shadow group"
              >
                <span className="bg-green-600 group-hover:bg-green-700 text-white font-bold
                                 text-xs px-4 py-3 transition-colors whitespace-nowrap">
                  {coupon.ctaLabel}
                </span>
                <span className="bg-green-600 group-hover:bg-green-700 border-l border-green-500
                                 text-white text-xs px-3 py-3 transition-colors select-none"
                      style={{ filter: "blur(3px)", letterSpacing: "0.05em" }}>
                  ····{coupon.code.slice(-2)}
                </span>
              </button>
            ) : (
              <div className="flex items-stretch rounded-lg overflow-hidden shadow-sm w-48">
                <div className="flex-1 border-2 border-dashed border-gray-400 bg-gray-50
                                flex items-center justify-center px-3 py-2.5">
                  <code className="font-mono font-bold text-gray-800 text-sm tracking-widest">
                    {coupon.code}
                  </code>
                </div>
                <button
                  onClick={handleCopy}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold
                             px-3 py-2.5 transition-colors whitespace-nowrap"
                >
                  {copied ? "✓" : "COPY"}
                </button>
              </div>
            )
          ) : (
            /* ── Direct deal (GET DEAL / BOOK NOW) ── single plain button */
            <button
              onClick={handleReveal}
              className="bg-green-600 hover:bg-green-700 text-white font-bold
                         text-xs px-5 py-3 rounded-lg transition-colors shadow-sm
                         hover:shadow-md whitespace-nowrap"
            >
              {coupon.ctaLabel}
            </button>
          )}
        </div>
      </div>

      {/* ── Insurance widget ── appears between body and footer after reveal */}
      {revealed && !dismissed && (
        <div className="px-4 pb-2">
          {isLoading && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 animate-pulse">
              <div className="h-2.5 bg-blue-100 rounded w-2/3 mb-2" />
              <div className="h-2.5 bg-blue-100 rounded w-1/2" />
            </div>
          )}
          {!isLoading && recommendation && recommendationId && (
            <InsuranceCard
              recommendation={recommendation}
              recommendationId={recommendationId}
              onDismiss={() => setDismissed(true)}
            />
          )}
        </div>
      )}

      {/* ── Footer row ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <button className="hover:text-green-600 font-medium transition-colors">
            Show Details
          </button>
          <span>•</span>
          <span className="flex items-center gap-1">
            Comments ({coupon.comments})
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            Valid till {coupon.validTill}
          </span>
        </div>
        <div className="flex items-center gap-3 text-gray-400">
          <button className="hover:text-green-600 transition-colors" title="Helpful">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
          </button>
          <button className="hover:text-blue-500 transition-colors" title="Share">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
