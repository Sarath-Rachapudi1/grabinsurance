import type { Store } from "../types";

interface Props {
  store: Store;
  activeTab: "all" | "coupons" | "offers";
  onTabChange: (tab: "all" | "coupons" | "offers") => void;
  existingUser: boolean;
  onExistingUserToggle: () => void;
}

const TABS: { key: "all" | "coupons" | "offers"; label: string }[] = [
  { key: "all",     label: "All"     },
  { key: "coupons", label: "Coupons" },
  { key: "offers",  label: "Offers"  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`text-base ${star <= Math.round(rating) ? "text-yellow-400" : "text-gray-500"}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function StoreHeader({
  store,
  activeTab,
  onTabChange,
  existingUser,
  onExistingUserToggle,
}: Props) {
  return (
    <div className="bg-[#1a2744] text-white rounded-xl overflow-hidden mb-5">
      {/* Top section: logo + info */}
      <div className="px-6 pt-6 pb-4 flex items-start gap-5">
        {/* Logo */}
        <div className={`w-20 h-20 rounded-xl ${store.logoColor} flex items-center justify-center
                          text-4xl flex-shrink-0 shadow-md`}>
          {store.logoEmoji}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black leading-tight">{store.name} Coupons</h1>
          <div className="flex items-center gap-3 mt-1">
            <StarRating rating={store.rating} />
            <span className="text-yellow-400 font-bold text-sm">{store.rating.toFixed(1)}</span>
            <span className="text-gray-400 text-xs">({store.ratingCount.toLocaleString()} ratings)</span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="text-green-400 font-semibold">{store.couponCount} Coupons</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-300">{store.verifiedCount} Verified Offers</span>
          </div>
        </div>

        {/* Existing User toggle */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className="text-xs text-gray-400">Existing User?</span>
          <button
            onClick={onExistingUserToggle}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              existingUser ? "bg-green-500" : "bg-gray-600"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                existingUser ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-t border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? "text-green-400 border-b-2 border-green-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
