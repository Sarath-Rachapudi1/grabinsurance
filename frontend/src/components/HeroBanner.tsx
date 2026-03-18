import { useState } from "react";
import { Link } from "react-router-dom";

const SLIDES = [
  {
    id: 1,
    bg: "from-blue-50 to-indigo-100",
    badge: "NEW OFFER",
    badgeBg: "bg-blue-600",
    headline: "Get 10% OFF",
    sub: "on Business Starter Plan For 3 Months | New Users",
    cta: "Start Free Trial",
    ctaHref: "#",
    logoText: "Google Workspace",
    logoBg: "bg-white",
  },
  {
    id: 2,
    bg: "from-orange-50 to-red-100",
    badge: "TRAVEL DEAL",
    badgeBg: "bg-red-600",
    headline: "Up to 40% OFF",
    sub: "on Domestic Hotel Bookings | This Weekend Only",
    cta: "Book Now",
    ctaHref: "/stores/makemytrip",
    logoText: "MakeMyTrip",
    logoBg: "bg-red-500",
  },
  {
    id: 3,
    bg: "from-yellow-50 to-amber-100",
    badge: "ELECTRONICS",
    badgeBg: "bg-yellow-600",
    headline: "Rs 5,000 OFF",
    sub: "on Laptops & Computers | Great Indian Sale",
    cta: "Shop Now",
    ctaHref: "/stores/amazon",
    logoText: "Amazon",
    logoBg: "bg-yellow-500",
  },
];

export default function HeroBanner() {
  const [active, setActive] = useState(0);
  const slide = SLIDES[active];

  return (
    <div className="flex gap-4 mb-6">
      {/* Main banner */}
      <div className={`flex-1 rounded-xl bg-gradient-to-br ${slide.bg} p-6 flex items-center
                       justify-between overflow-hidden relative min-h-[180px]`}>
        <div className="z-10">
          <span className={`text-white text-[10px] font-bold px-2.5 py-1 rounded ${slide.badgeBg} mb-3 inline-block`}>
            {slide.badge}
          </span>
          <h2 className="text-3xl font-black text-gray-800 leading-none">{slide.headline}</h2>
          <p className="text-gray-600 text-sm mt-1 mb-4 max-w-xs">{slide.sub}</p>
          <Link
            to={slide.ctaHref}
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold
                       text-sm px-6 py-2.5 rounded-lg transition-colors"
          >
            {slide.cta}
          </Link>
        </div>

        {/* Logo placeholder */}
        <div className={`w-24 h-24 rounded-xl ${slide.logoBg} shadow-md flex items-center
                          justify-center text-center p-3 flex-shrink-0`}>
          <span className="text-xs font-bold text-gray-700 leading-tight">{slide.logoText}</span>
        </div>

        {/* Slide dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === active ? "bg-blue-600 w-4" : "bg-gray-300"}`}
            />
          ))}
        </div>
      </div>

      {/* Side banner */}
      <div className="hidden lg:flex w-64 rounded-xl bg-[#f5f0e8] flex-col overflow-hidden border border-gray-200">
        <div className="bg-black p-3 flex items-center gap-2">
          <span className="text-white font-bold text-lg">Uber</span>
        </div>
        <div className="flex-1 p-4 flex flex-col justify-between">
          <p className="font-semibold text-gray-800 text-sm leading-snug">
            Exclusive Offer: Flat 50% OFF On Your First 3 Rides
          </p>
          <Link
            to="/stores/uber"
            className="mt-3 w-full bg-black text-white font-bold text-sm py-2.5 rounded
                       text-center hover:bg-gray-800 transition-colors"
          >
            GRAB NOW
          </Link>
        </div>
      </div>
    </div>
  );
}
