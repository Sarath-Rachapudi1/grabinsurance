import type { Coupon } from "../types";

export const COUPONS: Coupon[] = [
  // ── REDBUS ────────────────────────────────────────────────────────────────
  {
    id: "rb-001", storeId: "redbus", storeName: "Redbus",
    category: "travel", badge: "exclusive",
    title: "GRABON EXCLUSIVE",
    description: "Exclusive Offer — Get Up To Rs 500 OFF On Your Bus Ticket Bookings",
    code: "GRAB500", ctaLabel: "REVEAL PROMO CODE",
    discount_pct: 15, validTill: "31st Mar, 26", verified: true, comments: 0,
  },
  {
    id: "rb-002", storeId: "redbus", storeName: "Redbus",
    category: "travel", badge: "recommended",
    title: "FESTIVE SPECIAL",
    description: "Festive Sale: Flat 12% OFF Up To Rs 250 + 12% Cashback On Bus Ticket Bookings!",
    code: "RBUS12CB", ctaLabel: "BOOK NOW",
    discount_pct: 12, validTill: "31st Mar, 26", verified: true, comments: 0,
  },
  {
    id: "rb-003", storeId: "redbus", storeName: "Redbus",
    category: "travel", badge: null,
    title: "STARTING AT RS 645",
    description: "Book bus tickets at starting price of Rs 645. No coupon code required.",
    code: "RBUSDEAL", ctaLabel: "BOOK NOW",
    discount_pct: 10, validTill: "30th Apr, 26", verified: true, comments: 2,
  },

  // ── MAKEMYTRIP ────────────────────────────────────────────────────────────
  {
    id: "mmt-001", storeId: "makemytrip", storeName: "MakeMyTrip",
    category: "travel", badge: "exclusive",
    title: "FLAT 15% OFF FLIGHTS",
    description: "Flat 15% off on all domestic flight bookings. Valid on bookings above Rs 3,000.",
    code: "MMTFLY15", ctaLabel: "REVEAL PROMO CODE",
    discount_pct: 15, validTill: "31st Mar, 26", verified: true, comments: 3,
  },
  {
    id: "mmt-002", storeId: "makemytrip", storeName: "MakeMyTrip",
    category: "travel", badge: "recommended",
    title: "UP TO 40% OFF HOTELS",
    description: "Weekend getaway deals. Up to 40% off on hotel bookings. Valid on 2+ night stays.",
    code: "MMTHOTEL", ctaLabel: "BOOK NOW",
    discount_pct: 40, validTill: "15th Apr, 26", verified: true, comments: 1,
  },
  {
    id: "mmt-003", storeId: "makemytrip", storeName: "MakeMyTrip",
    category: "travel", badge: null,
    title: "INTERNATIONAL FLIGHTS DEAL",
    description: "Extra 12% off on international flight bookings. Book 7 days in advance.",
    code: "MMT12INT", ctaLabel: "REVEAL PROMO CODE",
    discount_pct: 12, validTill: "20th Apr, 26", verified: true, comments: 0,
  },

  // ── EASEMYTRIP ────────────────────────────────────────────────────────────
  {
    id: "emt-001", storeId: "easemytrip", storeName: "EaseMyTrip",
    category: "travel", badge: "exclusive",
    title: "FLAT 10% OFF ALL FLIGHTS",
    description: "Get flat 10% discount on domestic and international flights. Min booking Rs 2,000.",
    code: "EMT10ALL", ctaLabel: "REVEAL PROMO CODE",
    discount_pct: 10, validTill: "31st Mar, 26", verified: true, comments: 4,
  },
  {
    id: "emt-002", storeId: "easemytrip", storeName: "EaseMyTrip",
    category: "travel", badge: null,
    title: "BUS TICKETS FROM RS 99",
    description: "Book intercity bus tickets starting at Rs 99. All routes covered.",
    code: "EMTBUS99", ctaLabel: "BOOK NOW",
    discount_pct: 20, validTill: "30th Apr, 26", verified: true, comments: 1,
  },

  // ── AMAZON ────────────────────────────────────────────────────────────────
  {
    id: "amz-001", storeId: "amazon", storeName: "Amazon",
    category: "electronics", badge: "exclusive",
    title: "10% OFF ON SMARTPHONES",
    description: "10% off on Samsung, OnePlus, Apple smartphones. Min purchase Rs 10,000.",
    code: "AMAZPHONE", ctaLabel: "REVEAL PROMO CODE",
    discount_pct: 10, validTill: "31st Mar, 26", verified: true, comments: 5,
  },
  {
    id: "amz-002", storeId: "amazon", storeName: "Amazon",
    category: "electronics", badge: "recommended",
    title: "UP TO 30% OFF ELECTRONICS",
    description: "Great Indian Sale — up to 30% off on televisions, ACs, and large appliances.",
    code: "AMAZSALE", ctaLabel: "GET DEAL",
    discount_pct: 30, validTill: "2nd Apr, 26", verified: true, comments: 12,
  },
  {
    id: "amz-003", storeId: "amazon", storeName: "Amazon",
    category: "electronics", badge: null,
    title: "RS 5000 OFF ON LAPTOPS",
    description: "Instant bank discount of Rs 5,000 on select laptops. HDFC/ICICI cards.",
    code: "AMZLAP5K", ctaLabel: "REVEAL PROMO CODE",
    discount_pct: 12, validTill: "31st Mar, 26", verified: true, comments: 3,
  },

  // ── FLIPKART ──────────────────────────────────────────────────────────────
  {
    id: "fk-001", storeId: "flipkart", storeName: "Flipkart",
    category: "electronics", badge: "exclusive",
    title: "BIG BILLION DAY SPECIAL",
    description: "Up to Rs 5,000 off on laptops. Dell, HP, Lenovo. Min purchase Rs 40,000.",
    code: "FKLAPTOP", ctaLabel: "REVEAL PROMO CODE",
    discount_pct: 12, validTill: "5th Apr, 26", verified: true, comments: 8,
  },
  {
    id: "fk-002", storeId: "flipkart", storeName: "Flipkart",
    category: "electronics", badge: "recommended",
    title: "15% OFF ON TABLETS",
    description: "15% off on iPad and Android tablets this weekend. Axis Bank extra 5% off.",
    code: "FKTAB15", ctaLabel: "GET DEAL",
    discount_pct: 15, validTill: "31st Mar, 26", verified: true, comments: 2,
  },

  // ── MYNTRA ────────────────────────────────────────────────────────────────
  {
    id: "myn-001", storeId: "myntra", storeName: "Myntra",
    category: "fashion", badge: "exclusive",
    title: "END OF REASON SALE",
    description: "40–80% off on top fashion brands. Free delivery on orders above Rs 799.",
    code: "MYNEOS80", ctaLabel: "REVEAL PROMO CODE",
    discount_pct: 80, validTill: "7th Apr, 26", verified: true, comments: 15,
  },
  {
    id: "myn-002", storeId: "myntra", storeName: "Myntra",
    category: "fashion", badge: "recommended",
    title: "EXTRA 20% OFF FOOTWEAR",
    description: "Extra 20% off on Nike, Adidas, Puma, Reebok footwear. Min cart Rs 1,499.",
    code: "MYNFOOT20", ctaLabel: "GET DEAL",
    discount_pct: 20, validTill: "31st Mar, 26", verified: true, comments: 6,
  },

  // ── SWIGGY ────────────────────────────────────────────────────────────────
  {
    id: "sw-001", storeId: "swiggy", storeName: "Swiggy",
    category: "food", badge: "exclusive",
    title: "60% OFF FIRST 3 ORDERS",
    description: "New users only: 60% off up to Rs 120 on first 3 orders. Min order Rs 199.",
    code: "SWIG60NEW", ctaLabel: "REVEAL PROMO CODE",
    discount_pct: 60, validTill: "30th Apr, 26", verified: true, comments: 9,
  },
  {
    id: "sw-002", storeId: "swiggy", storeName: "Swiggy",
    category: "food", badge: null,
    title: "RS 100 OFF WEEKENDS",
    description: "Rs 100 off on weekend orders above Rs 399. All restaurants included.",
    code: "SWIGWKND", ctaLabel: "BOOK NOW",
    discount_pct: 15, validTill: "31st Mar, 26", verified: true, comments: 4,
  },

  // ── ZOMATO ────────────────────────────────────────────────────────────────
  {
    id: "zm-001", storeId: "zomato", storeName: "Zomato",
    category: "food", badge: "recommended",
    title: "FLAT RS 75 OFF",
    description: "Flat Rs 75 off on orders above Rs 299. Use Zomato Pay. Once per day.",
    code: "ZOM75PAY", ctaLabel: "REVEAL PROMO CODE",
    discount_pct: 15, validTill: "Ongoing", verified: true, comments: 11,
  },
];

export function getCouponsByStore(storeId: string): Coupon[] {
  return COUPONS.filter((c) => c.storeId === storeId);
}

export function getPopularCoupons(limit = 6): Coupon[] {
  // Return a mix: prioritise exclusive + recommended, spread across categories
  return COUPONS.filter((c) => c.badge !== null).slice(0, limit);
}
