import { Link } from "react-router-dom";
import HeroBanner from "../components/HeroBanner";
import StoreCard from "../components/StoreCard";
import CouponCard from "../components/CouponCard";
import { STORES } from "../data/stores";
import { getPopularCoupons } from "../data/coupons";

const POPULAR_COUPONS = getPopularCoupons(6);

const CATEGORY_ICONS: Record<string, string> = {
  Travel:       "✈️",
  Electronics:  "📱",
  Fashion:      "👗",
  Food:         "🍔",
  Lifestyle:    "💄",
  Beauty:       "💅",
  Grocery:      "🛒",
};

const CATEGORIES = [
  { label: "Travel",      emoji: "✈️",  href: "/?category=travel"      },
  { label: "Electronics", emoji: "📱",  href: "/?category=electronics"  },
  { label: "Fashion",     emoji: "👗",  href: "/?category=fashion"      },
  { label: "Food",        emoji: "🍔",  href: "/?category=food"         },
  { label: "Lifestyle",   emoji: "💄",  href: "/?category=lifestyle"    },
];

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-5">

      {/* ── Hero banner ─────────────────────────────────────────────────────── */}
      <HeroBanner />

      {/* ── Category pills ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.label}
            to={cat.href}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200
                       bg-white text-sm font-medium text-gray-700 hover:border-green-400
                       hover:text-green-700 whitespace-nowrap transition-colors shadow-sm"
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </Link>
        ))}
      </div>

      {/* ── Popular stores grid ─────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black text-gray-800">Top Stores</h2>
          <Link to="/stores" className="text-xs text-green-600 hover:underline font-medium">
            View All →
          </Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
          {STORES.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      </section>

      {/* ── Popular coupons ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black text-gray-800">Popular Offers of the Day</h2>
          <span className="text-xs text-gray-400">Updated today</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {POPULAR_COUPONS.map((coupon) => (
            <CouponCard key={coupon.id} coupon={coupon} compact />
          ))}
        </div>
      </section>
    </div>
  );
}
