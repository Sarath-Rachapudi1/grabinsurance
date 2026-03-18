/**
 * Operator Dashboard — /operator route.
 * Shows KPI cards, scenario selector, and recent recommendation log.
 * Per 08-FRONTEND.md: scenario selector is the key feature for failure demos.
 */
import { useState, useEffect } from "react";
import { apiFetch } from "../api";

interface Stats {
  total_recommendations:  number;
  total_quotes:           number;
  total_policies_issued:  number;
  current_scenario:       string;
  recent_recommendations: RecoLog[];
}

interface RecoLog {
  recommendation_id:   string;
  deal_id:             string;
  merchant:            string;
  product_id:          string;
  score:               number;
  langsmith_trace_url: string | null;
  created_at:          string;
}

const SCENARIOS = [
  { value: "normal",      label: "Normal — happy path" },
  { value: "timeout",     label: "Timeout — quote API hangs" },
  { value: "decline",     label: "Decline — user ineligible" },
  { value: "policy_fail", label: "Policy Fail — idempotency demo" },
];

export default function OperatorDashboard() {
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [scenario, setScenario] = useState("normal");
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    apiFetch<Stats>("/api/v1/operator/stats")
      .then((s) => {
        setStats(s);
        setScenario(s.current_scenario);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleScenarioChange(value: string) {
    setScenario(value);
    await apiFetch("/api/v1/operator/scenario", {
      method: "POST",
      body:   JSON.stringify({ scenario: value }),
    });
  }

  if (loading) {
    return <p className="text-gray-400 text-sm p-8">Loading dashboard…</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">GrabInsurance — Operator</h1>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <KPI label="Recommendations" value={stats?.total_recommendations ?? 0} color="blue" />
        <KPI label="Quotes"          value={stats?.total_quotes ?? 0}          color="indigo" />
        <KPI label="Policies Issued" value={stats?.total_policies_issued ?? 0} color="green" />
      </div>

      {/* Scenario selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-700 mb-3 text-sm">Demo Scenario</h2>
        <select
          value={scenario}
          onChange={(e) => handleScenarioChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {SCENARIOS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-2">
          Takes effect on the next deal click — no restart needed.
        </p>
      </div>

      {/* Recent recommendations log */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700 text-sm">Recent Recommendations</h2>
        </div>
        {!stats?.recent_recommendations.length ? (
          <p className="text-gray-400 text-xs p-4">No recommendations yet. Click a deal on the homepage.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">Merchant</th>
                <th className="px-4 py-2 text-left">Product</th>
                <th className="px-4 py-2 text-right">Score</th>
                <th className="px-4 py-2 text-left">Trace</th>
                <th className="px-4 py-2 text-left">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.recent_recommendations.map((r) => (
                <tr key={r.recommendation_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-700">{r.merchant}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {r.product_id === "NONE" || r.product_id === "BELOW_THRESHOLD"
                      ? <span className="text-gray-300 italic">suppressed</span>
                      : r.product_id}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {(r.score * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-2">
                    {r.langsmith_trace_url
                      ? <a href={r.langsmith_trace_url} target="_blank" rel="noreferrer"
                           className="text-purple-500 hover:underline">View ↗</a>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-2 text-gray-400">
                    {new Date(r.created_at).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue:   "text-blue-600 bg-blue-50 border-blue-100",
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
    green:  "text-green-600 bg-green-50 border-green-100",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] ?? ""}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-1 opacity-70">{label}</p>
    </div>
  );
}
