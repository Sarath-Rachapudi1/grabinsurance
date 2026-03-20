import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { STORES } from "../data/stores";

export default function Navbar() {
  const [query,      setQuery]      = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const navigate = useNavigate();

  const results = query.length > 1
    ? STORES.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  function handleStoreClick(storeId: string) {
    setShowSearch(false);
    setQuery("");
    navigate(`/stores/${storeId}`);
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        {/* ── Primary nav row ─────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-16 gap-4">

            {/* Logo */}
            <Link to="/" className="flex-shrink-0 mr-2">
              <div className="leading-none">
                <span className="font-black text-2xl text-gray-900">Grab</span>
                <span className="font-black text-2xl text-green-600">On</span>
              </div>
              <p className="text-[9px] text-gray-400 font-medium tracking-widest -mt-0.5">
                SAVE ON EVERYTHING
              </p>
            </Link>

            {/* Search bar */}
            <div className="flex-1 max-w-2xl relative">
              <div
                className="flex items-center border border-gray-300 rounded-full
                           px-4 py-2.5 gap-2 cursor-text bg-white hover:border-gray-400 transition-colors"
                onClick={() => setShowSearch(true)}
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setShowSearch(true); }}
                  onFocus={() => setShowSearch(true)}
                  placeholder="Search for brands, categories"
                  className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="text-gray-400 hover:text-gray-600 text-lg">
                    ×
                  </button>
                )}
              </div>

              {/* Search results dropdown */}
              {showSearch && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200
                                rounded-xl shadow-xl z-50 overflow-hidden">
                  <p className="text-[11px] text-gray-400 font-semibold uppercase px-4 py-2 border-b">
                    Stores
                  </p>
                  {results.map((store) => (
                    <button
                      key={store.id}
                      onClick={() => handleStoreClick(store.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                    >
                      <div className={`w-8 h-8 rounded-lg ${store.logoColor} border border-gray-200 flex items-center
                                       justify-center flex-shrink-0 overflow-hidden`}>
                        <span className={`font-black text-[9px] text-center leading-tight ${store.logoBrandColor}`}>
                          {store.logoInitials}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{store.name}</p>
                        <p className="text-xs text-gray-400">
                          {store.couponCount} Coupons | {store.verifiedCount} Verified
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-5 ml-2 flex-shrink-0">
              {/* Country selector */}
              <div className="hidden sm:flex items-center gap-1 text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                <span className="font-medium">IN</span>
                <span className="text-gray-400">▾</span>
              </div>

              {/* Bell */}
              <div className="relative cursor-pointer">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px]
                                  rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  2
                </span>
              </div>

              {/* User */}
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center
                                text-white font-bold text-sm">
                  S
                </div>
                <span className="hidden md:block text-sm text-gray-700">Hi, Sara...</span>
              </div>
            </div>
          </div>

          {/* ── Secondary nav row ─────────────────────────────────────────── */}
          <div className="flex items-center h-9 border-t border-gray-100 gap-6 text-sm overflow-x-auto">
            <Link to="/stores" className="text-gray-700 hover:text-green-600 whitespace-nowrap font-medium">
              Stores
            </Link>
            <Link to="/categories" className="text-gray-700 hover:text-green-600 whitespace-nowrap font-medium">
              Categories
            </Link>
            <a href="#" className="flex items-center gap-1 text-gray-700 hover:text-green-600 whitespace-nowrap font-medium">
              March Sales
              <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">New</span>
            </a>
            <a href="#" className="text-gray-700 hover:text-green-600 whitespace-nowrap font-medium">
              Indulge
            </a>

            <div className="ml-auto flex items-center gap-4 flex-shrink-0">
              <a href="#" className="text-gray-600 hover:text-green-600 text-sm whitespace-nowrap">
                Submit Coupon
              </a>
              <a href="#" className="text-gray-600 hover:text-green-600 text-sm whitespace-nowrap">
                Deals Of The Day
              </a>
              <Link
                to="/operator"
                className="bg-[#1a2744] text-white text-xs font-semibold px-4 py-1.5 rounded
                           hover:bg-[#243656] transition-colors whitespace-nowrap"
              >
                Ugadi Offers
              </Link>
              <Link
                to="/visualizer"
                className="flex items-center gap-1 bg-purple-700 text-white text-xs font-semibold
                           px-3 py-1.5 rounded hover:bg-purple-800 transition-colors whitespace-nowrap"
                title="Backend Pipeline Visualizer"
              >
                Visualizer
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── Search overlay backdrop ──────────────────────────────────────── */}
      {showSearch && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => { setShowSearch(false); setQuery(""); }}
        />
      )}
    </>
  );
}
