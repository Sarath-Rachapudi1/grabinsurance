// ── Store ─────────────────────────────────────────────────────────────────────

export interface Store {
  id: string;
  name: string;
  logoEmoji: string;
  logoColor: string;        // Tailwind bg class
  primaryCategory: "travel" | "electronics" | "fashion" | "food" | "lifestyle";
  categories: string[];     // For filter sidebar labels
  couponCount: number;
  verifiedCount: number;
  rating: number;
  ratingCount: number;
}

// ── Coupon ────────────────────────────────────────────────────────────────────

export interface Coupon {
  id: string;
  storeId: string;
  storeName: string;
  category: "travel" | "electronics" | "fashion" | "food" | "lifestyle";
  badge: "exclusive" | "recommended" | null;
  title: string;        // e.g. "FESTIVE SPECIAL"
  description: string;
  code: string;
  ctaLabel: string;     // "REVEAL PROMO CODE" | "BOOK NOW" | "GET DEAL"
  discount_pct: number;
  validTill: string;
  verified: boolean;
  comments: number;
}

// ── Deal (legacy, kept for DealCard compatibility) ────────────────────────────

export interface Deal {
  id: string;
  merchant: string;
  merchantId: string;
  category: "travel" | "electronics" | "fashion" | "food" | "lifestyle";
  title: string;
  discount_pct: number;
  coupon_code: string;
  logo_emoji: string;
  store_url: string;
}

// ── Insurance API ─────────────────────────────────────────────────────────────

export interface InsuranceRecommendation {
  product_id:            string;
  product_name:          string;
  tagline:               string;
  premium_paise:         number;
  coverage_amount_paise: number;
  coverage_bullets:      string[];
  exclusions:            string[];
  irdai_reg_number:      string;
  policy_wording_url:    string;
  score:                 number;
}

export interface RecommendResponse {
  recommendation_id:   string;
  recommendation:      InsuranceRecommendation | null;
  langsmith_trace_url: string | null;
}

export interface QuoteResponse {
  quote_id:              string;
  product_id:            string;
  premium_paise:         number;
  coverage_amount_paise: number;
  valid_until:           string;
}

export interface PolicyResponse {
  policy_id: string;
  status:    string;
  message:   string;
}

export interface PolicyRecord {
  policy_id:             string;
  quote_id:              string;
  product_id:            string;
  premium_paise:         number;
  status:                string;
  insurer_ref:           string | null;
  issued_at:             string | null;
  created_at:            string;
}
