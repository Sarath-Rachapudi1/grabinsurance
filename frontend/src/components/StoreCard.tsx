import { Link } from "react-router-dom";
import type { Store } from "../types";

interface Props {
  store: Store;
}

export default function StoreCard({ store }: Props) {
  return (
    <Link
      to={`/stores/${store.id}`}
      className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center
                 text-center hover:shadow-md hover:border-green-400 transition-all group"
    >
      {/* Logo */}
      <div className={`w-16 h-16 rounded-xl ${store.logoColor} border border-gray-200 flex items-center justify-center
                        p-2 mb-3 shadow-sm overflow-hidden`}>
        <span className={`font-black text-xs text-center leading-tight ${store.logoBrandColor}`}>
          {store.logoInitials}
        </span>
      </div>

      {/* Name */}
      <p className="font-bold text-gray-800 text-sm group-hover:text-green-700 transition-colors">
        {store.name}
      </p>

      {/* Stats */}
      <p className="text-xs text-gray-400 mt-1">
        {store.couponCount} Coupons | {store.verifiedCount} Offers
      </p>
    </Link>
  );
}
