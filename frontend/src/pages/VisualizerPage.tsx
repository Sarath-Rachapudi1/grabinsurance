/**
 * VisualizerPage — Real-time backend pipeline visualizer.
 * Monochrome terminal-style UI with phase grouping, step numbers, and elapsed time.
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

interface McpToolCall {
  tool:      string;
  arguments: Record<string, unknown>;
  result:    Record<string, unknown> | null;
  ts:        number;
}

// ── Pipeline definition ───────────────────────────────────────────────────────

const PHASES = [
  {
    label: "INPUT",
    steps: [
      { id: "source",        label: "Request Source",      desc: "Browser or MCP tool call" },
      { id: "deal_click",    label: "Deal Context",         desc: "Merchant · category · discount" },
      { id: "products",      label: "Eligible Products",    desc: "Products matched by category" },
    ],
  },
  {
    label: "AI SCORING",
    steps: [
      { id: "llm_prompt",    label: "GPT-4o-mini Prompt",   desc: "System + user message assembled", ai: true },
      { id: "llm_response",  label: "GPT-4o-mini Response", desc: "Raw JSON scores returned",         ai: true },
      { id: "scoring",       label: "Score Rankings",       desc: "Products ranked by relevance",     ai: true },
    ],
  },
  {
    label: "POLICY",
    steps: [
      { id: "recommendation",label: "Recommendation",       desc: "Best product selected" },
      { id: "quote",         label: "Quote Generated",      desc: "30-min priced quote" },
      { id: "policy_init",   label: "Policy Initiated",     desc: "Async insurer call started" },
      { id: "insurer",       label: "Insurer Processing",   desc: "Mock insurer simulating scenario" },
      { id: "webhook",       label: "Webhook Callback",     desc: "Insurer fires async result" },
      { id: "policy_final",  label: "Policy Final",         desc: "Issued · Declined · Error" },
    ],
  },
] as const;

type StepId = "source" | "deal_click" | "products" | "llm_prompt" | "llm_response" |
              "scoring" | "recommendation" | "quote" | "policy_init" | "insurer" |
              "webhook" | "policy_final";

const ALL_STEPS = PHASES.flatMap((p) => p.steps);

const INITIAL: Record<StepId, StepState> = Object.fromEntries(
  ALL_STEPS.map((s) => [s.id, { status: "idle", detail: null, ts: null, payload: null }])
) as Record<StepId, StepState>;

// ── Event → step mapper ───────────────────────────────────────────────────────

function applyEvent(
  steps: Record<StepId, StepState>,
  event: PipelineEvent,
): Record<StepId, StepState> {
  const next = { ...steps };
  const d = event.data;
  const set = (id: StepId, status: StepStatus, detail: string | null) => {
    next[id] = { status, detail, ts: event.ts, payload: d };
  };

  switch (event.type) {
    case "request.source":
      (Object.keys(next) as StepId[]).forEach((k) => {
        next[k] = { status: "idle", detail: null, ts: null, payload: null };
      });
      set("source", "success",
        d.source === "mcp"
          ? "MCP · Claude Desktop → recommend_insurance()"
          : "Browser · User clicked REVEAL PROMO CODE"
      );
      break;

    case "pipeline.start":
      set("deal_click", "success",
        `${String(d.merchant)} · ${String(d.category)} · ${String(d.discount_pct)}% off`
      );
      break;

    case "step.products_found":
      set("products",
        (d.count as number) > 0 ? "success" : "suppressed",
        (d.count as number) > 0
          ? `${d.count} products: ${(d.products as string[]).join(", ")}`
          : `No products for category "${d.category}"`
      );
      break;

    case "scoring.mode":
      set("llm_prompt", "active", "Assembling prompt...");
      break;

    case "llm.prompt_sent":
      set("llm_prompt", "success", `${d.products_count} products · ${String(d.model)}`);
      set("llm_response", "active", "Awaiting GPT-4o-mini...");
      break;

    case "llm.response_raw":
      set("llm_response", "success",
        [d.input_tokens && `↑${d.input_tokens}`, d.output_tokens && `↓${d.output_tokens}`]
          .filter(Boolean).join("  ") + " tokens" || "Response received"
      );
      break;

    case "scoring.result":
      set("scoring", "success",
        (d.scores as { product_id: string; score: number }[])
          .map((s) => `${s.product_id.split("_")[0]}: ${s.score}`)
          .join("  ·  ")
      );
      break;

    case "scoring.error":
      set("llm_response", "error", `Error: ${String(d.reason).slice(0, 80)}`);
      set("scoring", "error", "LLM failed — recommendation suppressed");
      break;

    case "recommend.complete":
      set("recommendation", "success",
        `${String(d.product_name)}  ·  score ${d.score}  ·  ₹${d.premium_inr}`
      );
      break;

    case "recommend.suppressed":
      set("recommendation", "suppressed", `Suppressed — ${String(d.reason)}`);
      (["quote", "policy_init", "insurer", "webhook", "policy_final"] as StepId[])
        .forEach((id) => set(id, "idle", null));
      break;

    case "step.quote_created":
      set("quote", "success", `₹${d.premium_inr} · coverage ₹${d.coverage_inr} · 30 min`);
      break;

    case "step.policy_initiated":
      set("policy_init", "active", `${String(d.policy_id).slice(0, 8)}… → pending`);
      break;

    case "step.insurer_processing":
      set("insurer", "active", `scenario: ${String(d.scenario)}  ~${d.simulated_latency}s`);
      break;

    case "step.webhook_firing":
    case "step.webhook_received":
      set("webhook", "active", `event: ${String(d.event)}  ref: ${String(d.insurer_ref ?? "—")}`);
      break;

    case "step.webhook_deduplicated":
      set("webhook", "suppressed", `Duplicate — dedup (already: ${d.current_status})`);
      break;

    case "step.policy_updated": {
      const st = String(d.new_status);
      set("insurer",      "success", "Insurer responded");
      set("webhook",      "success", `${st}  ref: ${String(d.insurer_ref ?? "—")}`);
      set("policy_init",  "success", `→ ${st}`);
      set("policy_final", st === "issued" ? "success" : "error",
        `${st.toUpperCase()}${d.insurer_ref ? `  ref: ${d.insurer_ref}` : ""}`
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

function fmtElapsed(start: number, end: number) {
  const ms = Math.round((end - start) * 1000);
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

const STATUS_STYLES: Record<StepStatus, { dot: string; card: string; text: string; tag: string; tagLabel: string }> = {
  idle:       { dot: "bg-zinc-800 border-zinc-700",                    card: "border-zinc-800/60",       text: "text-zinc-600",  tag: "border-zinc-800 text-zinc-700",       tagLabel: "IDLE" },
  active:     { dot: "bg-white border-white shadow-white/40 shadow-sm animate-pulse", card: "border-zinc-400 bg-zinc-900/40", text: "text-white",    tag: "border-zinc-300 text-white font-bold", tagLabel: "RUN"  },
  success:    { dot: "bg-zinc-400 border-zinc-400",                    card: "border-zinc-700",           text: "text-zinc-400",  tag: "border-zinc-600 text-zinc-400",       tagLabel: "OK"   },
  error:      { dot: "bg-zinc-500 border-zinc-500",                    card: "border-zinc-600 bg-zinc-900/20", text: "text-zinc-400", tag: "border-zinc-500 text-zinc-400",  tagLabel: "ERR"  },
  suppressed: { dot: "bg-zinc-700 border-zinc-700",                    card: "border-zinc-800/40",        text: "text-zinc-600",  tag: "border-zinc-800 text-zinc-600",       tagLabel: "SKIP" },
};

function EventTypeBadge({ type }: { type: string }) {
  // Group by event category — use brightness/contrast not hue
  const brightness =
    type.startsWith("llm.")       ? "text-white font-bold" :
    type.startsWith("scoring")    ? "text-zinc-200" :
    type.startsWith("step.policy")? "text-zinc-300" :
    type.startsWith("step.")      ? "text-zinc-400" :
    type.startsWith("pipeline")   ? "text-zinc-300" :
    type === "request.source"     ? "text-white" :
    type.includes("recommend")    ? "text-zinc-300" :
    "text-zinc-500";
  return <span className={`font-mono font-bold ${brightness}`}>{type}</span>;
}

// ── MCP Tool call panel ───────────────────────────────────────────────────────

const TOOL_DOCS: Record<string, { desc: string; returns: string }> = {
  recommend_insurance: {
    desc: "Recommends an insurance product for a deal context using GPT-4o-mini scoring.",
    returns: "{ matched, recommendation_id, product_id, product_name, premium_inr, confidence_score }",
  },
  quote_insurance: {
    desc: "Gets a time-bound priced quote from a recommendation. Valid for 30 minutes.",
    returns: "{ quote_id, product_id, premium_inr, gst_inr, total_inr, valid_until }",
  },
};

function McpCallCard({ call, index }: { call: McpToolCall; index: number }) {
  const [tab, setTab] = useState<"call" | "result">("call");
  const doc = TOOL_DOCS[call.tool];

  // Build a Python-style function call string
  const argStr = Object.entries(call.arguments)
    .map(([k, v]) => `    ${k}=${JSON.stringify(v)}`)
    .join(",\n");
  const callStr = `await ${call.tool}(\n${argStr}\n)`;

  const resultStr = call.result
    ? JSON.stringify(call.result, null, 2)
    : null;

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden text-[11px] font-mono">
      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-950 border-b border-zinc-800">
        <span className="text-[9px] text-zinc-600 font-bold">#{index + 1}</span>
        <span className="text-white font-bold">{call.tool}</span>
        <span className="text-[9px] border border-zinc-700 text-zinc-500 px-1.5 py-0.5 rounded">
          MCP TOOL
        </span>
        {call.result !== null && (
          <span className="text-[9px] border border-zinc-600 text-zinc-400 px-1.5 py-0.5 rounded ml-auto">
            {call.result.matched === false ? "NO MATCH" : "RETURNED"}
          </span>
        )}
        {call.result === null && (
          <span className="text-[9px] border border-zinc-700 text-zinc-600 px-1.5 py-0.5 rounded ml-auto animate-pulse">
            AWAITING
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-900 bg-black">
        {(["call", "result"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
              tab === t
                ? "text-white border-b-2 border-white -mb-px"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {t === "call" ? "Tool Call" : "Result"}
            {t === "result" && call.result === null && (
              <span className="ml-1 text-zinc-700">...</span>
            )}
          </button>
        ))}
        {doc && (
          <span className="ml-auto px-3 py-1.5 text-[9px] text-zinc-700 truncate max-w-[50%]">
            {doc.desc}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="bg-black">
        {tab === "call" ? (
          <div className="p-3">
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-2">Python equivalent</p>
            <pre className="text-zinc-300 leading-relaxed">{callStr}</pre>
            {doc && (
              <p className="text-[9px] text-zinc-700 mt-3 pt-2 border-t border-zinc-900">
                returns → {doc.returns}
              </p>
            )}
          </div>
        ) : (
          <div className="p-3">
            {resultStr ? (
              <>
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-2">Response to Claude Desktop</p>
                <pre className="text-zinc-300 leading-relaxed">{resultStr}</pre>
              </>
            ) : (
              <div className="flex items-center gap-2 py-3 text-zinc-600">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Waiting for backend response...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function McpPanel({ calls }: { calls: McpToolCall[] }) {
  if (calls.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {calls.map((call, i) => (
        <McpCallCard key={`${call.tool}-${i}`} call={call} index={i} />
      ))}
    </div>
  );
}

// ── AI Prompt / Response panel ────────────────────────────────────────────────

function AiPanel({ steps }: { steps: Record<StepId, StepState> }) {
  const [tab, setTab] = useState<"prompt" | "response">("response");
  const prompt   = steps["llm_prompt"];
  const response = steps["llm_response"];

  if (prompt.status === "idle") return null;

  const systemPrompt = prompt.payload?.system_prompt as string | undefined;
  const userMessage  = prompt.payload?.user_message  as string | undefined;
  const rawResponse  = response.payload?.raw_text    as string | undefined;

  let formatted = rawResponse ?? "";
  try { formatted = JSON.stringify(JSON.parse(rawResponse ?? ""), null, 2); } catch { /**/ }

  const inTok  = response.payload?.input_tokens  as number | undefined;
  const outTok = response.payload?.output_tokens as number | undefined;

  return (
    <div className="mt-2 border border-zinc-800 rounded-lg overflow-hidden text-[11px] font-mono">
      {/* Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-950">
        {(["prompt", "response"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              tab === t
                ? "text-white border-b-2 border-white -mb-px"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {t}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 px-3">
          <span className="text-zinc-700">gpt-4o-mini</span>
          {inTok && outTok && (
            <span className="text-zinc-700">↑{inTok} ↓{outTok} tokens</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-black max-h-52 overflow-y-auto">
        {tab === "prompt" ? (
          <div className="divide-y divide-zinc-900">
            {systemPrompt && (
              <div className="p-3">
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5">SYSTEM</p>
                <pre className="text-zinc-500 whitespace-pre-wrap leading-relaxed text-[10px]">{systemPrompt}</pre>
              </div>
            )}
            {userMessage && (
              <div className="p-3">
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5">USER</p>
                <pre className="text-zinc-400 whitespace-pre-wrap leading-relaxed text-[10px]">{userMessage}</pre>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3">
            {formatted ? (
              <>
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5">RESPONSE JSON</p>
                <pre className="text-zinc-300 leading-relaxed text-[10px]">{formatted}</pre>
              </>
            ) : response.status === "active" ? (
              <div className="flex items-center gap-2 py-4 text-zinc-600">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Waiting for GPT-4o-mini...
              </div>
            ) : (
              <span className="text-zinc-700">No response yet</span>
            )}
          </div>
        )}
      </div>
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
  const [pipelineStart, setPipelineStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now() / 1000);
  const [mcpCalls, setMcpCalls] = useState<McpToolCall[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Tick for elapsed time display
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/v1/events/stream");

    es.onopen = () => { setConnected(true); setLastError(null); };

    es.onmessage = (e) => {
      try {
        const event: PipelineEvent = JSON.parse(e.data as string);
        if (event.type === "connected") return;

        if (event.type === "request.source") {
          setPipelineStart(event.ts);
          // Reset MCP calls on each new pipeline
          if (event.data.source === "mcp") {
            setMcpCalls([]);
          }
        }

        if (event.type === "mcp.tool_call") {
          const d = event.data as { tool: string; arguments: Record<string, unknown> };
          setMcpCalls((prev) => [
            ...prev,
            { tool: d.tool, arguments: d.arguments, result: null, ts: event.ts },
          ]);
        }

        if (event.type === "mcp.tool_result") {
          const d = event.data as { tool: string; result: Record<string, unknown> };
          setMcpCalls((prev) =>
            prev.map((c) =>
              c.tool === d.tool && c.result === null
                ? { ...c, result: d.result }
                : c
            )
          );
        }

        setEventLog((prev) => [event, ...prev].slice(0, 300));
        setEventCount((n) => n + 1);
        setSteps((prev) => applyEvent(prev, event));
      } catch { /**/ }
    };

    es.onerror = () => {
      setConnected(false);
      setLastError("Connection lost — reconnecting automatically...");
    };

    return () => es.close();
  }, []);

  const sourceState  = steps["source"];
  const isMcp        = sourceState.payload?.source === "mcp";
  const hasSource    = sourceState.status !== "idle";
  const completedCount = Object.values(steps).filter((s) => s.status !== "idle").length;
  const progress     = (completedCount / ALL_STEPS.length) * 100;

  // Assign step numbers across phases
  let stepNum = 0;

  return (
    <div className="h-screen bg-zinc-950 text-white font-mono flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between flex-shrink-0 bg-black">
        <div className="flex items-center gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">
                GrabInsurance
              </span>
              <span className="text-zinc-700">/</span>
              <span className="text-white text-[10px] uppercase tracking-[0.2em] font-bold">
                Pipeline Visualizer
              </span>
            </div>
            <p className="text-zinc-600 text-[10px] mt-0.5">
              SSE stream · GPT-4o-mini scoring · MCP + browser sources
            </p>
          </div>

          {/* Progress bar */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="w-32 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-500">
              {completedCount}/{ALL_STEPS.length} steps
            </span>
            {pipelineStart && (
              <span className="text-[10px] text-zinc-600">
                {fmtElapsed(pipelineStart, now)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Source pill */}
          {hasSource && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono ${
              isMcp
                ? "border-zinc-500 text-zinc-300 bg-zinc-900"
                : "border-zinc-700 text-zinc-400"
            }`}>
              {isMcp ? "MCP" : "browser"}
            </div>
          )}

          {/* Model */}
          <div className="border border-zinc-800 px-2.5 py-1 rounded text-[10px] text-zinc-500">
            gpt-4o-mini
          </div>

          {/* Live indicator */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono ${
            connected ? "border-zinc-700 text-zinc-400" : "border-zinc-800 text-zinc-700"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              connected ? "bg-white animate-pulse" : "bg-zinc-700"
            }`} />
            {connected ? "live" : "offline"}
          </div>

          <button
            onClick={() => {
              setEventLog([]);
              setSteps(INITIAL);
              setEventCount(0);
              setPipelineStart(null);
              setMcpCalls([]);
            }}
            className="px-2.5 py-1 rounded border border-zinc-800 text-[10px] text-zinc-600
                       hover:text-white hover:border-zinc-600 transition-colors"
          >
            clear
          </button>
        </div>
      </div>

      {lastError && (
        <div className="border-b border-zinc-800 px-6 py-1.5 text-zinc-500 text-[10px] bg-black flex-shrink-0">
          ! {lastError}
        </div>
      )}

      <div className="flex flex-1 min-h-0">

        {/* ── Left: Pipeline ───────────────────────────────────────────────── */}
        <div className="w-[54%] border-r border-zinc-800/60 overflow-y-auto">
          <div className="px-5 py-4">

            {/* MCP banner */}
            {isMcp && (
              <div className="mb-4 px-4 py-3 border border-zinc-700 rounded-lg bg-zinc-900/60">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  <span className="text-[10px] text-white font-bold uppercase tracking-widest">
                    MCP Request
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 leading-relaxed ml-3.5">
                  Claude Desktop called{" "}
                  <code className="text-zinc-300 bg-zinc-800 px-1 rounded">recommend_insurance()</code>
                  {" "}in{" "}
                  <code className="text-zinc-300 bg-zinc-800 px-1 rounded">mcp-server/server.py</code>.
                  {" "}Identical pipeline as browser.
                </p>
              </div>
            )}

            {/* Phases */}
            {PHASES.map((phase) => (
              <div key={phase.label} className="mb-5">
                {/* Phase header */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em]">
                    {phase.label}
                  </span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>

                <div className="space-y-1">
                  {phase.steps.map((step, idxInPhase) => {
                    stepNum++;
                    const n     = stepNum;
                    const state = steps[step.id as StepId];
                    const s     = STATUS_STYLES[state.status];
                    const isLast = idxInPhase === phase.steps.length - 1;

                    return (
                      <div key={step.id}>
                        <div className="flex gap-3 items-stretch">
                          {/* Number + connector */}
                          <div className="flex flex-col items-center flex-shrink-0 w-7 pt-3">
                            <span className={`text-[9px] font-mono font-bold w-5 text-right flex-shrink-0 ${
                              state.status === "idle" ? "text-zinc-700" : "text-zinc-400"
                            }`}>
                              {String(n).padStart(2, "0")}
                            </span>
                            {!isLast && (
                              <div className={`w-px flex-1 mt-1 min-h-[6px] ${
                                state.status !== "idle" ? "bg-zinc-700" : "bg-zinc-800/50"
                              }`} />
                            )}
                          </div>

                          {/* Dot */}
                          <div className="flex flex-col items-center flex-shrink-0 pt-3.5">
                            <div className={`w-2 h-2 rounded-full border flex-shrink-0 ${s.dot}`} />
                            {!isLast && (
                              <div className={`w-px flex-1 mt-1 min-h-[6px] ${
                                state.status !== "idle" ? "bg-zinc-700" : "bg-zinc-800/50"
                              }`} />
                            )}
                          </div>

                          {/* Card */}
                          <div className={`flex-1 rounded-lg border px-3 py-2.5 mb-1 transition-all ${s.card} ${
                            step.ai ? "border-l-[3px]" : ""
                          } ${state.status === "active" ? "shadow-sm shadow-white/5" : ""}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[11px] font-bold ${
                                    state.status === "idle" ? "text-zinc-600" : "text-white"
                                  }`}>
                                    {step.label}
                                  </span>
                                  {step.ai && (
                                    <span className="text-[8px] border border-zinc-700 text-zinc-500 px-1 py-0.5 rounded tracking-wider">
                                      AI
                                    </span>
                                  )}
                                  {step.id === "source" && isMcp && state.status !== "idle" && (
                                    <span className="text-[8px] border border-zinc-600 text-zinc-400 px-1 py-0.5 rounded tracking-wider">
                                      MCP
                                    </span>
                                  )}
                                </div>
                                <p className={`text-[10px] leading-snug mt-0.5 ${
                                  state.status === "idle" || !state.detail
                                    ? "text-zinc-700"
                                    : s.text
                                }`}>
                                  {state.detail ?? step.desc}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                {state.ts && pipelineStart && (
                                  <span className="text-[9px] text-zinc-700">
                                    +{fmtElapsed(pipelineStart, state.ts)}
                                  </span>
                                )}
                                <span className={`text-[9px] border px-1.5 py-0.5 rounded font-mono ${s.tag}`}>
                                  {s.tagLabel}
                                </span>
                              </div>
                            </div>

                            {/* Score badges */}
                            {step.id === "scoring" && Boolean(state.payload?.scores) && (
                              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-zinc-800">
                                {(state.payload!.scores as { product_id: string; score: number }[])
                                  .sort((a, b) => b.score - a.score)
                                  .map((sc, i) => (
                                    <span
                                      key={sc.product_id}
                                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                                        i === 0
                                          ? "border-zinc-500 text-white bg-zinc-800"
                                          : "border-zinc-800 text-zinc-500"
                                      }`}
                                    >
                                      {i === 0 && <span className="mr-1 text-[8px]">▲</span>}
                                      {sc.product_id.replace(/_V\d+$/, "")}
                                      <span className={`ml-1 font-bold ${i === 0 ? "text-white" : "text-zinc-400"}`}>
                                        {sc.score}
                                      </span>
                                    </span>
                                  ))
                                }
                              </div>
                            )}

                            {/* Recommendation details */}
                            {step.id === "recommendation" && state.status === "success" && Boolean(state.payload?.product_id) && (
                              <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-zinc-800">
                                <span className="text-[10px] border border-zinc-600 text-zinc-300 px-2 py-0.5 rounded font-mono">
                                  {String(state.payload!.product_id)}
                                </span>
                                {Boolean(state.payload?.premium_inr) && (
                                  <span className="text-[10px] text-zinc-500">
                                    ₹{String(state.payload!.premium_inr)} premium
                                  </span>
                                )}
                                {Boolean(state.payload?.langsmith_url) && (
                                  <a
                                    href={String(state.payload!.langsmith_url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-zinc-600 hover:text-zinc-300 underline"
                                  >
                                    langsmith
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Policy final badge */}
                            {step.id === "policy_final" && Boolean(state.payload?.new_status) && (
                              <div className="mt-2 pt-2 border-t border-zinc-800">
                                <span className={`text-[11px] font-bold font-mono border px-2 py-0.5 rounded ${
                                  state.payload!.new_status === "issued"
                                    ? "border-zinc-500 text-white"
                                    : "border-zinc-700 text-zinc-500"
                                }`}>
                                  {String(state.payload!.new_status).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* MCP panel after source step */}
                        {step.id === "source" && isMcp && (
                          <div className="ml-10 mb-1">
                            <McpPanel calls={mcpCalls} />
                          </div>
                        )}

                        {/* AI panel after scoring */}
                        {step.id === "scoring" && (
                          <div className="ml-10 mb-1">
                            <AiPanel steps={steps} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Architecture reference */}
            <div className="mt-2 border border-zinc-900 rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-zinc-900 bg-zinc-950">
                <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">
                  Request paths
                </span>
              </div>
              <div className="grid grid-cols-2 divide-x divide-zinc-900">
                {[
                  {
                    title: "Browser",
                    lines: [
                      "REVEAL PROMO CODE click",
                      "useInsurance() hook",
                      "POST /api/v1/recommend",
                      "  → GPT-4o-mini scores",
                      "InsuranceCard shown",
                      "POST /api/v1/quote",
                      "POST /api/v1/policy/issue",
                      "← Webhook callback",
                    ],
                  },
                  {
                    title: "MCP",
                    lines: [
                      "Claude Desktop",
                      "mcp-server/server.py",
                      "recommend_insurance()",
                      "POST /api/v1/recommend",
                      "  → same GPT-4o-mini",
                      "quote_insurance()",
                      "POST /api/v1/quote",
                      'user_id = "mcp-..."',
                    ],
                  },
                ].map(({ title, lines }) => (
                  <div key={title} className="p-3">
                    <p className="text-[9px] text-zinc-500 font-bold mb-2 uppercase tracking-wider">{title}</p>
                    <div className="space-y-0.5">
                      {lines.map((l, i) => (
                        <div key={i} className={`text-[9px] ${l.startsWith("  ") ? "text-zinc-500" : "text-zinc-700"}`}>
                          {l}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Event log ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-black">
          {/* Log header */}
          <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                Live Event Stream
              </span>
              {connected && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              )}
            </div>
            <span className="text-[10px] text-zinc-700 font-mono">{eventCount} events</span>
          </div>

          {/* Events */}
          <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {eventLog.length === 0 ? (
              <div className="text-center py-20 text-zinc-700 text-[11px] space-y-2">
                <div className="font-bold text-zinc-600">Waiting for events</div>
                <p>Reveal a coupon in the GrabOn UI</p>
                <p>or call the MCP tool from Claude Desktop</p>
              </div>
            ) : (
              eventLog.map((ev, i) => (
                <div
                  key={i}
                  className="border border-zinc-900 rounded-lg p-2.5 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="text-[9px] text-zinc-700 font-mono flex-shrink-0">{fmtTime(ev.ts)}</span>
                    <EventTypeBadge type={ev.type} />
                  </div>
                  <div className="space-y-0.5 ml-[60px]">
                    {Object.entries(ev.data).map(([k, v]) => {
                      const raw   = v !== null && typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
                      const shown = raw.length > 100 ? raw.slice(0, 100) + "…" : raw;
                      const isLong = k === "system_prompt" || k === "user_message" || k === "raw_text";
                      return (
                        <div key={k} className="flex gap-1.5 text-[10px] font-mono">
                          <span className="text-zinc-700 flex-shrink-0">{k}:</span>
                          <span className={isLong ? "text-zinc-600 italic" : "text-zinc-500"}>
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

          {/* Scenario reference */}
          <div className="border-t border-zinc-800 px-4 py-2.5 flex-shrink-0">
            <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest mb-1.5">
              Insurer scenarios  ·  set MOCK_INSURER_SCENARIO in .env
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
              {[
                { name: "normal",      note: "~800ms · 95% issued" },
                { name: "timeout",     note: "31s sleep" },
                { name: "decline",     note: "instant decline" },
                { name: "policy_fail", note: "dup webhook → dedup" },
              ].map((s) => (
                <div key={s.name} className="flex items-center gap-1.5 text-[9px] font-mono">
                  <span className="text-zinc-500 font-bold">{s.name}</span>
                  <span className="text-zinc-800">{s.note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
