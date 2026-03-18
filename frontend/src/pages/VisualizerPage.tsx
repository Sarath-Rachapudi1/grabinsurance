/**
 * VisualizerPage — Real-time backend pipeline visualizer.
 *
 * Connects to GET /api/v1/events/stream (Server-Sent Events).
 *
 * Shows:
 *  - REQUEST SOURCE: Browser (GrabOn UI) vs MCP (Claude Desktop tool call)
 *  - AI SCORING: The actual prompt sent to GPT-4o-mini + raw JSON response
 *  - FULL PIPELINE: every step from deal click → policy final
 *
 * All events emitted by the backend:
 *   request.source       → who triggered the pipeline
 *   pipeline.start       → deal context
 *   step.products_found  → eligible products by category
 *   scoring.mode         → always "llm" now (rule-based removed)
 *   llm.prompt_sent      → system prompt + user message sent to Claude
 *   llm.response_raw     → Claude's raw JSON response + token counts
 *   scoring.result       → parsed scores, sorted
 *   scoring.error        → Claude timeout or non-JSON response
 *   recommend.complete   → winner product selected, widget shown
 *   recommend.suppressed → no match or error
 *   step.quote_created   → quote with premium
 *   step.policy_initiated→ policy pending
 *   step.insurer_processing → scenario + latency
 *   step.webhook_firing  → about to call back
 *   step.webhook_received→ callback arrived
 *   step.policy_updated  → final status
 */
import { useState, useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PipelineEvent {
  type: string;
  ts:   number;
  data: Record<string, unknown>;
}

type StepStatus = "idle" | "active" | "success" | "error" | "suppressed";

interface StepState {
  status:  StepStatus;
  detail:  string | null;
  ts:      number | null;
  payload: Record<string, unknown> | null;
}

// ── Pipeline steps ────────────────────────────────────────────────────────────

const STEPS = [
  { id: "source",       label: "Request Source",        icon: "📡",  desc: "Browser or MCP Claude Desktop" },
  { id: "deal_click",   label: "Deal Context",          icon: "🛍️",  desc: "Merchant, category, discount" },
  { id: "products",     label: "Eligible Products",     icon: "📦",  desc: "Products matched to category" },
  { id: "llm_prompt",   label: "GPT-4o-mini Prompt",   icon: "✍️",  desc: "Prompt sent to GPT-4o-mini" },
  { id: "llm_response", label: "GPT-4o-mini Response", icon: "🤖",  desc: "Raw JSON from GPT-4o-mini" },
  { id: "scoring",      label: "Score Rankings",        icon: "📊",  desc: "Products ranked by relevance" },
  { id: "recommendation",label:"Recommendation",        icon: "💡",  desc: "Best product selected" },
  { id: "quote",        label: "Quote Generated",       icon: "📋",  desc: "30-min priced quote" },
  { id: "policy_init",  label: "Policy Initiated",      icon: "⚡",  desc: "Async insurer call started" },
  { id: "insurer",      label: "Insurer Processing",    icon: "🏦",  desc: "Mock insurer simulating" },
  { id: "webhook",      label: "Webhook Callback",      icon: "📡",  desc: "Insurer fires async result" },
  { id: "policy_final", label: "Policy Final",          icon: "🎯",  desc: "Status: issued / declined" },
] as const;

type StepId = typeof STEPS[number]["id"];

const INITIAL: Record<StepId, StepState> = Object.fromEntries(
  STEPS.map((s) => [s.id, { status: "idle", detail: null, ts: null, payload: null }])
) as Record<StepId, StepState>;

// ── Event → step mapper ───────────────────────────────────────────────────────

function applyEvent(
  steps: Record<StepId, StepState>,
  event: PipelineEvent,
): Record<StepId, StepState> {
  const next = { ...steps };
  const d    = event.data;

  const set = (id: StepId, status: StepStatus, detail: string | null) => {
    next[id] = { status, detail, ts: event.ts, payload: d };
  };

  switch (event.type) {

    case "request.source":
      // Reset everything on each new request
      (Object.keys(next) as StepId[]).forEach((k) => {
        next[k] = { status: "idle", detail: null, ts: null, payload: null };
      });
      const isMcp = d.source === "mcp";
      set("source",
        "success",
        isMcp
          ? "MCP · Claude Desktop → recommend_insurance()"
          : "Browser · User clicked REVEAL PROMO CODE"
      );
      break;

    case "pipeline.start":
      set("deal_click", "success",
        `${String(d.merchant)} · ${String(d.category)} · ${String(d.discount_pct)}% off · "${String(d.deal_title)}"`
      );
      break;

    case "step.products_found":
      set("products",
        (d.count as number) > 0 ? "success" : "suppressed",
        (d.count as number) > 0
          ? `${d.count} found: ${(d.products as string[]).join(", ")}`
          : `No products mapped to category "${d.category}"`
      );
      break;

    case "scoring.mode":
      set("llm_prompt", "active", "Preparing prompt for GPT-4o-mini…");
      break;

    case "llm.prompt_sent":
      set("llm_prompt", "success",
        `${d.products_count} products · model: ${String(d.model)}`
      );
      set("llm_response", "active", "Waiting for GPT-4o-mini…");
      break;

    case "llm.response_raw":
      set("llm_response", "success",
        [
          d.input_tokens  ? `↑ ${d.input_tokens} tokens in` : null,
          d.output_tokens ? `↓ ${d.output_tokens} tokens out` : null,
        ].filter(Boolean).join("  ·  ") || "Response received"
      );
      break;

    case "scoring.result":
      set("scoring", "success",
        (d.scores as { product_id: string; score: number }[])
          .map((s) => `${s.product_id}: ${s.score}`)
          .join("  ·  ")
      );
      break;

    case "scoring.error":
      set("llm_response", "error", `GPT error: ${String(d.reason)}`);
      set("scoring",      "error", "Scoring failed — recommendation suppressed");
      break;

    case "recommend.complete":
      set("recommendation", "success",
        `${String(d.product_name)}  ·  score: ${d.score}  ·  ₹${d.premium_inr}`
      );
      break;

    case "recommend.suppressed":
      set("recommendation", "suppressed", `Suppressed — ${String(d.reason)}`);
      (["quote", "policy_init", "insurer", "webhook", "policy_final"] as StepId[])
        .forEach((id) => set(id, "idle", null));
      break;

    case "step.quote_created":
      set("quote", "success",
        `₹${d.premium_inr} · coverage ₹${d.coverage_inr} · valid 30 min`
      );
      break;

    case "step.policy_initiated":
      set("policy_init", "active",
        `Policy ${String(d.policy_id).slice(0, 8)}… → pending`
      );
      break;

    case "step.insurer_processing":
      set("insurer", "active",
        `Scenario: ${String(d.scenario)} · ~${d.simulated_latency}s`
      );
      break;

    case "step.webhook_firing":
    case "step.webhook_received":
      set("webhook", "active",
        `Event: ${String(d.event)} · ref: ${String(d.insurer_ref ?? "—")}`
      );
      break;

    case "step.webhook_deduplicated":
      set("webhook", "suppressed",
        `Duplicate webhook — idempotency dedup (status already: ${d.current_status})`
      );
      break;

    case "step.policy_updated": {
      const st = String(d.new_status);
      set("insurer",      "success", "Insurer responded");
      set("webhook",      "success", `Event: ${st} · ref: ${String(d.insurer_ref ?? "—")}`);
      set("policy_init",  "success", `→ ${st}`);
      set("policy_final", st === "issued" ? "success" : "error",
        `${st.toUpperCase()}${d.insurer_ref ? ` · ref: ${d.insurer_ref}` : ""}`
      );
      break;
    }
  }

  return next;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString("en-IN", {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function stepBorder(s: StepStatus) {
  return {
    idle:       "border-gray-800 bg-gray-900/50",
    active:     "border-yellow-500 bg-yellow-900/15",
    success:    "border-green-600 bg-green-900/15",
    error:      "border-red-600 bg-red-900/15",
    suppressed: "border-gray-600 bg-gray-900/30",
  }[s];
}

function stepDot(s: StepStatus) {
  return {
    idle:       "border-gray-700 bg-gray-800",
    active:     "border-yellow-400 bg-yellow-400 shadow-yellow-400/50 shadow-md animate-pulse",
    success:    "border-green-500 bg-green-500",
    error:      "border-red-500 bg-red-500",
    suppressed: "border-gray-500 bg-gray-600",
  }[s];
}

function stepText(s: StepStatus) {
  return {
    idle:       "text-gray-600",
    active:     "text-yellow-300",
    success:    "text-green-300",
    error:      "text-red-300",
    suppressed: "text-gray-500",
  }[s];
}

function eventColor(type: string) {
  if (type === "connected")               return "text-blue-400";
  if (type === "request.source")          return "text-purple-400";
  if (type.startsWith("pipeline"))        return "text-indigo-400";
  if (type.startsWith("llm."))            return "text-yellow-300";
  if (type.startsWith("scoring"))         return "text-yellow-500";
  if (type.includes("recommend"))         return "text-green-400";
  if (type.startsWith("step.quote"))      return "text-cyan-400";
  if (type.startsWith("step.policy"))     return "text-orange-400";
  if (type.startsWith("step.insurer"))    return "text-pink-400";
  if (type.startsWith("step.webhook"))    return "text-indigo-400";
  return "text-gray-400";
}

// ── AI Prompt/Response panel ──────────────────────────────────────────────────

function AiDetailPanel({ steps }: { steps: Record<StepId, StepState> }) {
  const promptState   = steps["llm_prompt"];
  const responseState = steps["llm_response"];
  const [showPrompt, setShowPrompt] = useState(false);

  if (promptState.status === "idle") return null;

  const systemPrompt = promptState.payload?.system_prompt as string | undefined;
  const userMessage  = promptState.payload?.user_message  as string | undefined;
  const rawResponse  = responseState.payload?.raw_text     as string | undefined;

  // Format the raw response JSON nicely
  let formattedResponse = rawResponse ?? "";
  try {
    formattedResponse = JSON.stringify(JSON.parse(rawResponse ?? ""), null, 2);
  } catch { /* use raw */ }

  return (
    <div className="mt-3 rounded-lg border border-yellow-800 bg-yellow-900/10 overflow-hidden">
      <div className="px-3 py-2 border-b border-yellow-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-xs font-bold">🤖 GPT-4o-mini</span>
          <span className="text-yellow-700 text-xs">gpt-4o-mini</span>
        </div>
        <button
          onClick={() => setShowPrompt((v) => !v)}
          className="text-[10px] text-yellow-600 hover:text-yellow-400 transition-colors"
        >
          {showPrompt ? "Hide prompt ▲" : "Show prompt ▼"}
        </button>
      </div>

      {showPrompt && systemPrompt && (
        <div className="border-b border-yellow-900/50">
          <div className="px-3 py-1.5 bg-yellow-900/20">
            <p className="text-[10px] text-yellow-700 font-bold uppercase tracking-wider mb-1">
              System Prompt
            </p>
            <pre className="text-[10px] text-yellow-200/70 whitespace-pre-wrap leading-relaxed font-mono">
              {systemPrompt}
            </pre>
          </div>
          {userMessage && (
            <div className="px-3 py-1.5">
              <p className="text-[10px] text-yellow-700 font-bold uppercase tracking-wider mb-1">
                User Message
              </p>
              <pre className="text-[10px] text-yellow-200/70 whitespace-pre-wrap leading-relaxed font-mono">
                {userMessage}
              </pre>
            </div>
          )}
        </div>
      )}

      {formattedResponse && (
        <div className="px-3 py-2">
          <p className="text-[10px] text-yellow-700 font-bold uppercase tracking-wider mb-1">
            Claude Response
          </p>
          <pre className="text-[10px] text-green-300 font-mono leading-relaxed">
            {formattedResponse}
          </pre>
          {Boolean(responseState.payload?.input_tokens) && (
            <div className="flex gap-3 mt-1.5">
              <span className="text-[10px] text-gray-600">
                ↑ {String(responseState.payload?.input_tokens)} tokens in
              </span>
              <span className="text-[10px] text-gray-600">
                ↓ {String(responseState.payload?.output_tokens)} tokens out
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VisualizerPage() {
  const [connected,  setConnected]  = useState(false);
  const [steps,      setSteps]      = useState<Record<StepId, StepState>>(INITIAL);
  const [eventLog,   setEventLog]   = useState<PipelineEvent[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [lastError,  setLastError]  = useState<string | null>(null);

  useEffect(() => {
    const url = "/api/v1/events/stream";
    const es  = new EventSource(url);

    es.onopen = () => { setConnected(true); setLastError(null); };

    es.onmessage = (e) => {
      try {
        const event: PipelineEvent = JSON.parse(e.data as string);
        if (event.type === "connected") return;
        setEventLog((prev) => [event, ...prev].slice(0, 300));
        setEventCount((n) => n + 1);
        setSteps((prev) => applyEvent(prev, event));
      } catch { /* malformed */ }
    };

    es.onerror = () => {
      setConnected(false);
      setLastError("Connection lost — browser will retry automatically");
    };

    return () => es.close();
  }, []);

  const sourceState = steps["source"];
  const isMcp       = sourceState.payload?.source === "mcp";
  const hasSource   = sourceState.status !== "idle";

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔭</span>
          <div>
            <h1 className="font-black text-white text-sm leading-none tracking-wide">
              Backend Pipeline Visualizer
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">
              Real-time SSE · every AI call, MCP request, and policy event
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Source indicator */}
          {hasSource && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${
              isMcp
                ? "bg-purple-900/50 border-purple-600 text-purple-300"
                : "bg-blue-900/50 border-blue-600 text-blue-300"
            }`}>
              {isMcp ? "🔌 MCP · Claude Desktop" : "🌐 Browser · GrabOn UI"}
            </div>
          )}

          {/* AI mode */}
          <div className="flex items-center gap-1.5 bg-yellow-900/30 border border-yellow-800 px-3 py-1 rounded-full">
            <span className="text-yellow-400 text-xs">🤖</span>
            <span className="text-yellow-300 text-xs font-semibold">GPT-4o-mini</span>
            <span className="text-yellow-700 text-xs">LLM only</span>
          </div>

          {/* Connection */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${
            connected
              ? "bg-green-900/40 border-green-700 text-green-400"
              : "bg-red-900/40 border-red-700 text-red-400"
          }`}>
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-500"}`} />
            {connected ? "Live" : "Reconnecting…"}
          </div>

          <button
            onClick={() => { setEventLog([]); setSteps(INITIAL); setEventCount(0); }}
            className="text-xs text-gray-500 hover:text-white border border-gray-700
                       hover:border-gray-500 px-3 py-1 rounded transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {lastError && (
        <div className="bg-red-900/20 border-b border-red-900 px-6 py-2 text-red-400 text-xs">
          ⚠ {lastError}
        </div>
      )}

      <div className="flex h-[calc(100vh-57px)]">

        {/* ── Left: Pipeline ───────────────────────────────────────────────── */}
        <div className="w-[55%] border-r border-gray-800 overflow-y-auto">
          <div className="px-5 py-4">

            {/* MCP explanation banner */}
            {isMcp && (
              <div className="mb-4 p-3 rounded-lg bg-purple-900/20 border border-purple-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-purple-400 font-bold text-xs">🔌 MCP Request</span>
                </div>
                <p className="text-xs text-purple-300/80 leading-relaxed">
                  This request came from <strong>Claude Desktop</strong> using the MCP tool
                  <code className="mx-1 px-1 bg-purple-900/50 rounded text-purple-200">recommend_insurance()</code>
                  defined in <code className="px-1 bg-purple-900/50 rounded text-purple-200">mcp-server/server.py</code>.
                  Claude Desktop called the tool autonomously — the same backend pipeline runs regardless of source.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                Pipeline Steps
              </h2>
              <span className="text-[10px] text-gray-700 font-mono">
                {Object.values(steps).filter((s) => s.status !== "idle").length}/{STEPS.length} reached
              </span>
            </div>

            <div className="space-y-1.5">
              {STEPS.map((step, idx) => {
                const state = steps[step.id];
                const isAiStep = step.id === "llm_prompt" || step.id === "llm_response" || step.id === "scoring";

                return (
                  <div key={step.id}>
                    <div className="flex gap-2.5">
                      {/* Dot + connector */}
                      <div className="flex flex-col items-center flex-shrink-0 w-3">
                        <div className={`w-3 h-3 rounded-full border-2 mt-3 flex-shrink-0 ${stepDot(state.status)}`} />
                        {idx < STEPS.length - 1 && (
                          <div className={`w-px flex-1 mt-1 min-h-[8px] ${
                            state.status !== "idle" ? "bg-gray-700" : "bg-gray-800"
                          }`} />
                        )}
                      </div>

                      {/* Card */}
                      <div className={`flex-1 rounded-lg border px-3 py-2 mb-0.5 transition-colors ${stepBorder(state.status)} ${
                        isAiStep ? "border-l-2 border-l-yellow-600" : ""
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="text-sm flex-shrink-0">{step.icon}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`font-semibold text-xs ${
                                  state.status === "idle" ? "text-gray-600" : "text-white"
                                }`}>
                                  {step.label}
                                </span>
                                {isAiStep && state.status !== "idle" && (
                                  <span className="text-[9px] bg-yellow-900/50 border border-yellow-800 text-yellow-400 px-1.5 rounded font-bold">
                                    AI
                                  </span>
                                )}
                                {step.id === "source" && isMcp && state.status !== "idle" && (
                                  <span className="text-[9px] bg-purple-900/50 border border-purple-700 text-purple-300 px-1.5 rounded font-bold">
                                    MCP
                                  </span>
                                )}
                              </div>
                              {state.status === "idle" ? (
                                <p className="text-[10px] text-gray-700 leading-tight">{step.desc}</p>
                              ) : state.detail ? (
                                <p className={`text-[10px] leading-snug mt-0.5 ${stepText(state.status)}`}>
                                  {state.detail}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          {state.ts && (
                            <span className="text-[9px] text-gray-700 flex-shrink-0 font-mono">
                              {fmtTime(state.ts)}
                            </span>
                          )}
                        </div>

                        {/* Score badges on scoring step */}
                        {step.id === "scoring" && Boolean(state.payload?.scores) && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {(state.payload!.scores as { product_id: string; score: number }[]).map((s) => (
                              <span
                                key={s.product_id}
                                className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                                  s.score >= 0.8
                                    ? "bg-green-900/40 border-green-700 text-green-300"
                                    : s.score >= 0.5
                                      ? "bg-yellow-900/40 border-yellow-700 text-yellow-300"
                                      : "bg-gray-800 border-gray-700 text-gray-500"
                                }`}
                              >
                                {s.product_id} <strong>{s.score}</strong>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Recommendation chip */}
                        {step.id === "recommendation" && Boolean(state.payload?.product_id) && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] bg-green-900/40 border border-green-700 text-green-300 px-2 py-0.5 rounded font-mono font-bold">
                              {String(state.payload!.product_id)}
                            </span>
                            {Boolean(state.payload?.langsmith_url) && (
                              <a
                                href={String(state.payload!.langsmith_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-blue-400 hover:underline"
                              >
                                🔗 LangSmith trace
                              </a>
                            )}
                          </div>
                        )}

                        {/* Policy final status */}
                        {step.id === "policy_final" && Boolean(state.payload?.new_status) && (
                          <div className="mt-1.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              state.payload!.new_status === "issued"
                                ? "bg-green-900/50 border border-green-700 text-green-300"
                                : "bg-red-900/50 border border-red-700 text-red-300"
                            }`}>
                              {String(state.payload!.new_status).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI detail panel — appears after the scoring step */}
                    {step.id === "scoring" && (
                      <div className="ml-5.5 pl-2">
                        <AiDetailPanel steps={steps} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Architecture diagram */}
            <div className="mt-5 p-3 bg-gray-900 border border-gray-800 rounded-lg">
              <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mb-2">
                How it works
              </p>
              <div className="grid grid-cols-2 gap-x-4 text-[10px] font-mono">
                <div>
                  <p className="text-blue-400 font-bold mb-1">🌐 Browser Path</p>
                  <div className="text-gray-600 space-y-0.5">
                    <div>CouponCard → REVEAL click</div>
                    <div>useInsurance hook</div>
                    <div>POST /api/v1/recommend</div>
                    <div className="text-yellow-600">  ↓ GPT-4o-mini scores</div>
                    <div>InsuranceCard widget shown</div>
                    <div>POST /api/v1/quote</div>
                    <div>POST /api/v1/policy/issue</div>
                    <div>← Webhook callback</div>
                  </div>
                </div>
                <div>
                  <p className="text-purple-400 font-bold mb-1">🔌 MCP Path</p>
                  <div className="text-gray-600 space-y-0.5">
                    <div>Claude Desktop</div>
                    <div>mcp-server/server.py</div>
                    <div>recommend_insurance()</div>
                    <div>POST /api/v1/recommend</div>
                    <div className="text-yellow-600">  ↓ same GPT-4o-mini</div>
                    <div>quote_insurance()</div>
                    <div>POST /api/v1/quote</div>
                    <div className="text-purple-600">user_id = "mcp-claude-desktop"</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Event log ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
            <h2 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
              Live Event Stream
            </h2>
            <span className="text-[10px] text-gray-700 font-mono">{eventCount} events</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 font-mono text-[10px]">
            {eventLog.length === 0 ? (
              <div className="text-gray-700 text-center py-16 text-xs">
                <div className="text-4xl mb-3 opacity-50">🔭</div>
                <p>Waiting for backend events…</p>
                <p className="mt-2 text-gray-800">
                  Reveal a coupon in the GrabOn UI<br/>
                  or call the MCP tool from Claude Desktop
                </p>
              </div>
            ) : (
              eventLog.map((ev, i) => (
                <div key={i} className="border-b border-gray-900 pb-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-gray-700 w-18 flex-shrink-0">{fmtTime(ev.ts)}</span>
                    <span className={`font-bold ${eventColor(ev.type)}`}>{ev.type}</span>
                  </div>
                  <div className="pl-[76px] text-gray-600 space-y-0.5">
                    {Object.entries(ev.data).map(([k, v]) => {
                      // Truncate long strings (prompts / responses)
                      const raw   = v !== null && typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
                      const shown = raw.length > 120 ? raw.slice(0, 120) + "…" : raw;
                      return (
                        <div key={k}>
                          <span className="text-gray-700">{k}: </span>
                          <span className={
                            k === "system_prompt" || k === "user_message" || k === "raw_text"
                              ? "text-yellow-700"
                              : "text-gray-500"
                          }>
                            {shown}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Scenario bar */}
          <div className="border-t border-gray-800 px-4 py-2.5 bg-gray-900/50">
            <p className="text-[9px] text-gray-700 font-bold uppercase tracking-widest mb-1">
              Insurer Scenarios (Operator Dashboard)
            </p>
            <div className="flex gap-3 flex-wrap">
              {[
                { name: "normal",      color: "text-green-500",  note: "~800ms, 95% success" },
                { name: "timeout",     color: "text-yellow-500", note: "31s sleep" },
                { name: "decline",     color: "text-red-400",    note: "instant decline" },
                { name: "policy_fail", color: "text-purple-400", note: "duplicate webhook → dedup" },
              ].map((s) => (
                <span key={s.name} className="flex items-center gap-1">
                  <span className={`font-bold ${s.color}`}>{s.name}</span>
                  <span className="text-gray-800">— {s.note}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
