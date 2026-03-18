import { useState, useEffect } from "react";
import { apiFetch } from "../api";
import type { PolicyRecord } from "../types";

const STATUS_STYLE: Record<string, string> = {
  issued:   "bg-green-100 text-green-700",
  pending:  "bg-yellow-100 text-yellow-700",
  declined: "bg-red-100 text-red-600",
  failed:   "bg-red-100 text-red-600",
};

export default function MyPolicies() {
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [loading,  setLoading]  = useState(true);

  const userId = sessionStorage.getItem("grabon_session_id") ?? "anon";

  useEffect(() => {
    apiFetch<PolicyRecord[]>(`/api/v1/policies?user_id=${encodeURIComponent(userId)}`)
      .then(setPolicies)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  if (!policies.length) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-sm">No policies yet.</p>
        <a href="/" className="text-orange-500 underline mt-3 inline-block text-sm">
          Browse deals to get covered
        </a>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-5">My Policies</h1>
      <div className="space-y-3">
        {policies.map((p) => (
          <div key={p.policy_id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-sm text-gray-800">{p.product_id.replace(/_/g, " ")}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  ₹{(p.premium_paise / 100).toFixed(0)} · #{p.policy_id.slice(0, 12).toUpperCase()}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLE[p.status] ?? "bg-gray-100 text-gray-500"}`}>
                {p.status}
              </span>
            </div>
            {p.insurer_ref && (
              <p className="text-xs text-gray-400 mt-2">Ref: {p.insurer_ref}</p>
            )}
            {p.issued_at && (
              <p className="text-xs text-gray-400">
                Issued: {new Date(p.issued_at).toLocaleString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
