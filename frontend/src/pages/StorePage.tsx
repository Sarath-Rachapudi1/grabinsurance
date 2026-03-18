import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getStore } from "../data/stores";
import { getCouponsByStore } from "../data/coupons";
import StoreHeader from "../components/StoreHeader";
import FilterSidebar from "../components/FilterSidebar";
import CouponCard from "../components/CouponCard";

export default function StorePage() {
  const { storeId } = useParams<{ storeId: string }>();
  const store = storeId ? getStore(storeId) : undefined;

  const [activeTab,    setActiveTab]    = useState<"all" | "coupons" | "offers">("all");
  const [existingUser, setExistingUser] = useState(false);
  const [selected,     setSelected]    = useState<Set<string>>(new Set());

  if (!store) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-lg">Store not found.</p>
        <Link to="/" className="text-green-600 hover:underline mt-2 inline-block">
          ← Back to Home
        </Link>
      </div>
    );
  }

  const allCoupons = getCouponsByStore(store.id);

  function handleToggle(cat: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  // Tab filter: "coupons" = has a code, "offers" = no code needed (ctaLabel !== "REVEAL PROMO CODE")
  const tabFiltered = allCoupons.filter((c) => {
    if (activeTab === "coupons") return c.ctaLabel === "REVEAL PROMO CODE";
    if (activeTab === "offers")  return c.ctaLabel !== "REVEAL PROMO CODE";
    return true;
  });

  // Category sidebar filter (store.categories are descriptive strings — we match badge/title loosely)
  const displayed = selected.size === 0 ? tabFiltered : tabFiltered;
  // Note: category sidebar filters are decorative here — all coupons belong to the store's
  // primary category. Real filtering would require per-coupon sub-category tags.

  return (
    <div className="max-w-7xl mx-auto px-4 py-5">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-4 flex items-center gap-1">
        <Link to="/" className="hover:text-green-600">Home</Link>
        <span>›</span>
        <Link to="/stores" className="hover:text-green-600">Stores</Link>
        <span>›</span>
        <span className="text-gray-600 font-medium">{store.name} Coupons</span>
      </nav>

      {/* Store header */}
      <StoreHeader
        store={store}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        existingUser={existingUser}
        onExistingUserToggle={() => setExistingUser((v) => !v)}
      />

      {/* Body: sidebar + coupon list */}
      <div className="flex gap-5 items-start">
        {/* Sidebar */}
        <FilterSidebar
          categories={store.categories}
          selected={selected}
          onToggle={handleToggle}
          onClearAll={() => setSelected(new Set())}
        />

        {/* Coupon list */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 mb-3">
            Showing <span className="font-semibold text-gray-700">{displayed.length}</span> coupons
            for <span className="font-semibold text-gray-700">{store.name}</span>
          </p>

          {displayed.length === 0 ? (
            <p className="text-center text-gray-400 py-16">No coupons match your filter.</p>
          ) : (
            <div className="space-y-3">
              {displayed.map((coupon) => (
                <CouponCard key={coupon.id} coupon={coupon} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
