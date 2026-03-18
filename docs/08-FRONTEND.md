# 08 — Frontend

## Stack

React 18 + Vite + TypeScript + Tailwind CSS (CDN via `index.html`).

---

## Current State (as of 2026-03-17)

### What is built

| File | Purpose |
|---|---|
| `src/App.tsx` | Routes: `/`, `/deals/:merchantId`, `/my-policies`, `/operator` |
| `src/api.ts` | `apiFetch()` helper, `VITE_API_BASE` config |
| `src/types.ts` | `Deal`, `InsuranceRecommendation`, `QuoteResponse`, `PolicyResponse`, `PolicyRecord` |
| `src/data/deals.ts` | 11 deals across 6 merchants |
| `src/hooks/useInsurance.ts` | Calls `/api/v1/recommend` on deal click; 3s timeout; silent failure |
| `src/components/DealCard.tsx` | Basic coupon card with reveal + insurance widget |
| `src/components/InsuranceCard.tsx` | Insurance widget (card → checkout → confirmed stages) |
| `src/components/Navbar.tsx` | Simple orange GrabOn-style nav |
| `src/components/OperatorDashboard.tsx` | Operator dashboard with KPI cards + scenario selector |
| `src/pages/Home.tsx` | Category filter bar + deal grid |
| `src/pages/MerchantPage.tsx` | Filtered deal listing per merchant |
| `src/pages/MyPolicies.tsx` | List of user's policies |

### Current data model

```typescript
interface Deal {
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
```

---

## GrabOn Clone Redesign (2026-03-17)

### Reference screenshots
The redesign matches the real GrabOn.in UI:
1. **Homepage** — announcement bar + navbar + hero banner + "Popular Offers of the Day" grid
2. **Search overlay** — store cards grid
3. **Store page** — header (dark navy) + left filter sidebar + coupon card list
4. **Coupon reveal** — code in dashed box + COPY CODE button → **insurance widget integrates here**

### Color palette

| Token | Value | Usage |
|---|---|---|
| Announcement bar | `#c0392b` / `bg-red-700` | Top promo bar |
| GrabOn green | `#27ae60` / `bg-green-600` | CTA buttons, accents |
| Dark navy | `#1a2744` / `bg-[#1a2744]` | Store page header, secondary buttons |
| Badge exclusive | `#145a32` / `bg-green-900` | "GRABON EXCLUSIVE" badge |
| Badge recommended | `#1c1c1c` / `bg-gray-900` | "RECOMMENDED" badge |
| Copy code blue | `#2563eb` / `bg-blue-600` | COPY CODE button |
| Card border accent | `#27ae60` / `border-l-4 border-green-500` | Left border on coupon cards |

### New data models

```typescript
// src/data/stores.ts
interface Store {
  id: string;
  name: string;
  logoEmoji: string;
  logoColor: string;        // Tailwind bg class for logo placeholder
  categories: string[];     // For filter sidebar
  primaryCategory: "travel" | "electronics" | "fashion" | "food" | "lifestyle";
  couponCount: number;
  verifiedCount: number;
  rating: number;
  ratingCount: number;
}

// src/data/coupons.ts
interface Coupon {
  id: string;
  storeId: string;
  storeName: string;
  category: "travel" | "electronics" | "fashion" | "food" | "lifestyle";
  badge: "exclusive" | "recommended" | null;
  title: string;          // Bold uppercase — e.g. "FESTIVE SPECIAL"
  description: string;
  code: string;
  ctaLabel: string;       // "REVEAL PROMO CODE" | "BOOK NOW" | "GET DEAL"
  discount_pct: number;
  validTill: string;
  verified: boolean;
  comments: number;
}
```

### New file structure

```
frontend/src/
├── data/
│   ├── stores.ts        ← store catalog (9 stores)
│   └── coupons.ts       ← coupon catalog (3-5 per store)
├── hooks/
│   └── useInsurance.ts  ← updated to accept Coupon type
├── components/
│   ├── AnnouncementBar.tsx    ← red top bar with promo text + BOOK NOW
│   ├── Navbar.tsx             ← REDESIGNED: GrabOn white nav + search + secondary nav
│   ├── HeroBanner.tsx         ← hero carousel placeholder
│   ├── StoreCard.tsx          ← store card for homepage grid
│   ├── CouponCard.tsx         ← GrabOn-style coupon card (replaces DealCard)
│   ├── StoreHeader.tsx        ← dark navy store page header + tabs
│   ├── FilterSidebar.tsx      ← category filter panel
│   ├── InsuranceCard.tsx      ← (unchanged — integrates into CouponCard reveal)
│   └── OperatorDashboard.tsx  ← (unchanged)
└── pages/
    ├── Home.tsx              ← REDESIGNED: stores grid + popular coupons
    ├── StorePage.tsx         ← NEW: sidebar + coupon list (replaces MerchantPage)
    ├── MyPolicies.tsx        ← (unchanged)
    └── VisualizerPage.tsx    ← NEW: real-time SSE pipeline visualizer
```

### Insurance integration point

The insurance widget attaches at the **coupon reveal moment** inside `CouponCard.tsx`:

```
User clicks "REVEAL PROMO CODE"
        │
        ├── Coupon code appears in dashed box with COPY CODE button
        │
        └── fetchInsurance(coupon) fires in parallel
                │
                ├── Loading: blue shimmer below the code
                └── Result: InsuranceCard slides in below coupon code
                           (before the footer metadata)
```

This mirrors the real user intent: "I just unlocked a flight deal → I should protect this trip."
Insurance is shown only for categories with a matching product (travel, electronics, fashion).
Food deals: widget never appears (suppressed by backend).

### CouponCard component flow

```
[default state]
┌──────────────────────────────────────────────────────────────────┐
│ [GRABON EXCLUSIVE]                              ✓ Verified        │
├──────────────────────────────────────────────────────────────────┤
│ FESTIVE SPECIAL                   [REVEAL PROMO CODE ░░░░░00]     │
│ Flat 12% OFF on Bus Ticket Bookings...                            │
├──────────────────────────────────────────────────────────────────┤
│ Show Details • 💬 0 • ⏰ Valid till 31 Mar 26           👍  📤    │
└──────────────────────────────────────────────────────────────────┘

[revealed state]
┌──────────────────────────────────────────────────────────────────┐
│ [GRABON EXCLUSIVE]                              ✓ Verified        │
├──────────────────────────────────────────────────────────────────┤
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐   [COPY CODE] (blue)           │
│    RBUS100                                                        │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘                                 │
│                                                                   │
│ [insurance loading shimmer / InsuranceCard]                       │
├──────────────────────────────────────────────────────────────────┤
│ Show Details • 💬 0 • ⏰ Valid till 31 Mar 26           👍  📤    │
└──────────────────────────────────────────────────────────────────┘
```

### Components built (2026-03-17)

| Component | Status | Notes |
|---|---|---|
| `AnnouncementBar.tsx` | ✅ | Red promo bar |
| `Navbar.tsx` | ✅ | GrabOn white nav + live search + secondary nav |
| `HeroBanner.tsx` | ✅ | 3-slide carousel + side banner |
| `StoreCard.tsx` | ✅ | Homepage grid card → links to `/stores/:id` |
| `CouponCard.tsx` | ✅ | Split CTA + reveal + insurance integration zone |
| `StoreHeader.tsx` | ✅ | Dark navy header + star rating + tabs + existing user toggle |
| `FilterSidebar.tsx` | ✅ | Checkbox filter sidebar with Clear All |
| `StorePage.tsx` | ✅ | Breadcrumb + StoreHeader + FilterSidebar + CouponCard list |
| `Home.tsx` | ✅ | HeroBanner + category pills + stores grid + popular coupons |
| `App.tsx` | ✅ | Routes: `/`, `/stores`, `/stores/:storeId`, `/my-policies`, `/operator`, `/visualizer` |
| `VisualizerPage.tsx` | ✅ | Real-time SSE pipeline visualizer — MCP source, AI prompt/response, full flow |

### Route map

| Path | Component | Purpose |
|---|---|---|
| `/` | `Home` | Homepage |
| `/stores` | `Home` | Same as homepage (future: stores directory) |
| `/stores/:storeId` | `StorePage` | Per-store coupon listing |
| `/my-policies` | `MyPolicies` | User's issued policies |
| `/operator` | `OperatorDashboard` | Internal KPI + scenario selector |

### IRDAI Compliance Checklist

- [x] Explicit opt-in button (no pre-checked box)
- [x] Exclusions visible before purchase
- [x] IRDAI registration number displayed
- [x] Policy wording URL linked
- [x] "No thanks" always visible and easy to click
- [x] No language like "guaranteed", "assured", "best"
