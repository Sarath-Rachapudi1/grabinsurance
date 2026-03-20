/**
 * useInsurance — fetches an insurance recommendation for a deal.
 *
 * Design decisions (per 08-FRONTEND.md):
 * - Silent failure: if API is down, `recommendation` stays null; widget never shows.
 * - 3 second AbortController timeout matches the backend guard.
 * - The hook never blocks the coupon reveal — it fires in parallel.
 */
import { useState, useCallback } from "react";
import { apiFetch } from "../api";
import type { Coupon, InsuranceRecommendation, RecommendResponse } from "../types";

interface UseInsuranceResult {
  recommendation:    InsuranceRecommendation | null;
  recommendationId:  string | null;
  langsmithUrl:      string | null;
  isLoading:         boolean;
  fetchInsurance:    (coupon: Coupon) => void;
}

export function useInsurance(): UseInsuranceResult {
  const [recommendation,   setRecommendation]   = useState<InsuranceRecommendation | null>(null);
  const [recommendationId, setRecommendationId] = useState<string | null>(null);
  const [langsmithUrl,     setLangsmithUrl]     = useState<string | null>(null);
  const [isLoading,        setIsLoading]        = useState(false);

  const fetchInsurance = useCallback((coupon: Coupon) => {
    const userId    = sessionStorage.getItem("grabon_session_id") ?? "anon";
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 25000);

    setIsLoading(true);
    setRecommendation(null);
    setRecommendationId(null);

    apiFetch<RecommendResponse>("/api/v1/recommend", {
      method:  "POST",
      body:    JSON.stringify({
        user_id:       userId,
        deal_id:       coupon.id,
        deal_category: coupon.category,
        merchant:      coupon.storeName,
        deal_title:    coupon.title,
        discount_pct:  coupon.discount_pct,
      }),
      signal: controller.signal,
    })
      .then((data) => {
        setRecommendationId(data.recommendation_id);
        setRecommendation(data.recommendation);
        setLangsmithUrl(data.langsmith_trace_url);
      })
      .catch(() => {
        // Silent failure — insurance never blocks the coupon journey
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setIsLoading(false);
      });
  }, []);

  return { recommendation, recommendationId, langsmithUrl, isLoading, fetchInsurance };
}
