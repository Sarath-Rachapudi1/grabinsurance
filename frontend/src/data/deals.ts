import type { Deal } from "../types";

export const DEALS: Deal[] = [
  // ── TRAVEL ─────────────────────────────────────────────────────────────────
  {
    id: "t1", merchant: "MakeMyTrip", merchantId: "makemytrip",
    category: "travel",
    title: "Flat 15% off on Domestic Flights",
    discount_pct: 15, coupon_code: "MMTFLY15",
    logo_emoji: "✈️", store_url: "https://www.makemytrip.com",
  },
  {
    id: "t2", merchant: "MakeMyTrip", merchantId: "makemytrip",
    category: "travel",
    title: "Up to 40% off on Hotels",
    discount_pct: 40, coupon_code: "MMTHOTEL",
    logo_emoji: "🏨", store_url: "https://www.makemytrip.com",
  },
  {
    id: "t3", merchant: "RedBus", merchantId: "redbus",
    category: "travel",
    title: "₹100 off on Bus Tickets",
    discount_pct: 10, coupon_code: "RBUS100",
    logo_emoji: "🚌", store_url: "https://www.redbus.in",
  },
  {
    id: "t4", merchant: "EaseMyTrip", merchantId: "easemytrip",
    category: "travel",
    title: "Extra 12% off on International Flights",
    discount_pct: 12, coupon_code: "EMT12INT",
    logo_emoji: "🌍", store_url: "https://www.easemytrip.com",
  },

  // ── ELECTRONICS ────────────────────────────────────────────────────────────
  {
    id: "e1", merchant: "Amazon", merchantId: "amazon",
    category: "electronics",
    title: "10% off on Smartphones",
    discount_pct: 10, coupon_code: "AMAZPHONE",
    logo_emoji: "📦", store_url: "https://www.amazon.in",
  },
  {
    id: "e2", merchant: "Flipkart", merchantId: "flipkart",
    category: "electronics",
    title: "Up to ₹5,000 off on Laptops",
    discount_pct: 12, coupon_code: "FKLAPTOP",
    logo_emoji: "💻", store_url: "https://www.flipkart.com",
  },
  {
    id: "e3", merchant: "Croma", merchantId: "croma",
    category: "electronics",
    title: "15% off on Tablets",
    discount_pct: 15, coupon_code: "CROMATAB",
    logo_emoji: "📱", store_url: "https://www.croma.com",
  },

  // ── FASHION ────────────────────────────────────────────────────────────────
  {
    id: "f1", merchant: "Myntra", merchantId: "myntra",
    category: "fashion",
    title: "40–80% off End of Season Sale",
    discount_pct: 80, coupon_code: "MYNEOS80",
    logo_emoji: "👗", store_url: "https://www.myntra.com",
  },
  {
    id: "f2", merchant: "Ajio", merchantId: "ajio",
    category: "fashion",
    title: "Extra 20% off on Footwear",
    discount_pct: 20, coupon_code: "AJIOFOOT",
    logo_emoji: "👟", store_url: "https://www.ajio.com",
  },

  // ── FOOD ───────────────────────────────────────────────────────────────────
  {
    id: "fd1", merchant: "Swiggy", merchantId: "swiggy",
    category: "food",
    title: "60% off up to ₹120 on first 3 orders",
    discount_pct: 60, coupon_code: "SWIG60NEW",
    logo_emoji: "🍔", store_url: "https://www.swiggy.com",
  },
  {
    id: "fd2", merchant: "Zomato", merchantId: "zomato",
    category: "food",
    title: "Flat ₹75 off on orders above ₹299",
    discount_pct: 15, coupon_code: "ZOM75PAY",
    logo_emoji: "🍕", store_url: "https://www.zomato.com",
  },
];

export const MERCHANTS = [...new Set(DEALS.map((d) => d.merchantId))];

export function getDealsByMerchant(merchantId: string): Deal[] {
  return DEALS.filter((d) => d.merchantId === merchantId);
}
