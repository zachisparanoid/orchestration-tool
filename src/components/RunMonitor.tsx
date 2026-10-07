"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { StopCircle, Hash, Clock, ListChecks } from "lucide-react";
import type { Run, TaskExecution, Agent, ExecutionStatus, RunStatus } from "@/lib/types";
import { DagPreview } from "./DagPreview";

interface State {
  run: Run;
  execsByNode: Map<string, TaskExecution>;
  liveOutput: Map<string, string>;
  selectedNode: string | null;
}

type Action =
  | { type: "set_selected"; id: string | null }
  | { type: "task_pending"; nodeId: string; agentId: string }
  | { type: "task_started"; nodeId: string }
  | { type: "task_delta"; nodeId: string; text: string }
  | { type: "task_completed"; nodeId: string; preview: string; tokensIn: number; tokensOut: number }
  | { type: "task_failed"; nodeId: string; error?: string }
  | { type: "run_status"; status: RunStatus };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set_selected":
      return { ...state, selectedNode: action.id };
    case "task_pending": {
      const map = new Map(state.execsByNode);
      const ex = map.get(action.nodeId);
      if (ex) map.set(action.nodeId, { ...ex, status: "pending" });
      return { ...state, execsByNode: map };
    }
    case "task_started": {
      const map = new Map(state.execsByNode);
      const ex = map.get(action.nodeId);
      if (ex) map.set(action.nodeId, { ...ex, status: "running", startedAt: Date.now() });
      const out = new Map(state.liveOutput);
      out.set(action.nodeId, "");
      return { ...state, execsByNode: map, liveOutput: out, selectedNode: state.selectedNode ?? action.nodeId };
    }
    case "task_delta": {
      const out = new Map(state.liveOutput);
      out.set(action.nodeId, (out.get(action.nodeId) ?? "") + action.text);
      return { ...state, liveOutput: out };
    }
    case "task_completed": {
      const map = new Map(state.execsByNode);
      const ex = map.get(action.nodeId);
      if (ex) map.set(action.nodeId, {
        ...ex, status: "completed", completedAt: Date.now(),
        tokensIn: action.tokensIn, tokensOut: action.tokensOut,
        output: state.liveOutput.get(action.nodeId) ?? action.preview,
      });
      return { ...state, execsByNode: map };
    }
    case "task_failed": {
      const map = new Map(state.execsByNode);
      const ex = map.get(action.nodeId);
      if (ex) map.set(action.nodeId, { ...ex, status: "failed", error: action.error ?? "failed", completedAt: Date.now() });
      return { ...state, execsByNode: map };
    }
    case "run_status":
      return { ...state, run: { ...state.run, status: action.status } };
  }
}

export function RunMonitor({
  initialRun,
  initialExecutions,
  agents,
}: {
  initialRun: Run;
  initialExecutions: TaskExecution[];
  agents: Agent[];
}) {
  const router = useRouter();
  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const wf = initialRun.workflowSnapshot;

  const initialState: State = {
    run: initialRun,
    execsByNode: new Map(initialExecutions.map((e) => [e.nodeId, e])),
    liveOutput: new Map(initialExecutions.map((e) => [e.nodeId, e.output ?? ""])),
    selectedNode: initialExecutions.find((e) => e.status === "running")?.nodeId
      ?? wf.nodes[0]?.id ?? null,
  };
  const [state, dispatch] = useReducer(reducer, initialState);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const terminal = new Set<RunStatus>(["completed", "failed", "cancelled"]);
    if (terminal.has(initialRun.status)) return;
    const es = new EventSource(`/api/runs/${initialRun.id}/stream`);

    es.addEventListener("task.pending", (e) => {
      const p = JSON.parse((e as MessageEvent).data).payload;
      dispatch({ type: "task_pending", nodeId: p.nodeId, agentId: p.agentId });
    });
    es.addEventListener("task.started", (e) => {
      const p = JSON.parse((e as MessageEvent).data).payload;
      dispatch({ type: "task_started", nodeId: p.nodeId });
    });
    es.addEventListener("task.delta", (e) => {
      const p = JSON.parse((e as MessageEvent).data).payload;
      dispatch({ type: "task_delta", nodeId: p.nodeId, text: p.text });
    });
    es.addEventListener("task.completed", (e) => {
      const p = JSON.parse((e as MessageEvent).data).payload;
      dispatch({ type: "task_completed", nodeId: p.nodeId, preview: p.preview, tokensIn: p.tokensIn, tokensOut: p.tokensOut });
    });
    es.addEventListener("task.failed", (e) => {
      const p = JSON.parse((e as MessageEvent).data).payload;
      dispatch({ type: "task_failed", nodeId: p.nodeId, error: p.error });
    });
    es.addEventListener("run.completed", () => dispatch({ type: "run_status", status: "completed" }));
    es.addEventListener("run.failed", () => dispatch({ type: "run_status", status: "failed" }));
    es.addEventListener("run.cancelled", () => dispatch({ type: "run_status", status: "cancelled" }));
    es.addEventListener("end", () => { es.close(); router.refresh(); });
    es.onerror = () => { es.close(); };

    return () => es.close();
  }, [initialRun.id, initialRun.status, router]);

  async function cancel() {
    setCancelling(true);
    await fetch(`/api/runs/${initialRun.id}`, { method: "DELETE" });
    setCancelling(false);
  }

  const statusByNode = new Map<string, ExecutionStatus | "idle">();
  for (const node of wf.nodes) {
    const ex = state.execsByNode.get(node.id);
    statusByNode.set(node.id, ex?.status ?? "idle");
  }

  const selectedExec = state.selectedNode ? state.execsByNode.get(state.selectedNode) : null;
  const selectedNode = state.selectedNode ? wf.nodes.find((n) => n.id === state.selectedNode) : null;
  const selectedOutput = state.selectedNode ? state.liveOutput.get(state.selectedNode) ?? "" : "";
  const selectedAgent = selectedNode ? agentById.get(selectedNode.agentId) : null;

  const isLive = state.run.status === "running" || state.run.status === "queued";
  const totalTokens = Array.from(state.execsByNode.values()).reduce((acc, e) => acc + e.tokensIn + e.tokensOut, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-text-muted font-mono">{state.run.id}</div>
          <h1 className="text-xl font-semibold">{wf.name}</h1>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">{state.run.input}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className="badge"
            style={{
              borderColor: statusColor(state.run.status) + "44",
              color: statusColor(state.run.status),
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor(state.run.status) }} />
            {state.run.status}
          </span>
          {isLive && (
            <button onClick={cancel} disabled={cancelling} className="btn-secondary text-xs">
              <StopCircle className="h-3.5 w-3.5" />Cancel
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" />{wf.nodes.length} nodes</span>
        <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{totalTokens.toLocaleString()} tokens</span>
        {state.run.startedAt && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            started {fmtRel(state.run.startedAt)}
          </span>
        )}
      </div>

      <div className="card">
        <DagPreview workflow={wf} agentById={agentById} statusByNode={statusByNode} selectedNodeId={state.selectedNode} onSelectNode={(id) => dispatch({ type: "set_selected", id })} />
      </div>

      {selectedNode && (
        <div className="card">
          <div className="flex items-center justify-between border-b border-border-subtle p-3">
            <div className="flex items-center gap-3">
              {selectedAgent && (
                <span className="grid h-9 w-9 place-items-center rounded text-lg" style={{ background: selectedAgent.color + "22", border: `1px solid ${selectedAgent.color}44` }}>
                  {selectedAgent.avatar}
                </span>
              )}
              <div>
                <div className="text-sm font-semibold">{selectedNode.label}</div>
                <div className="text-xs text-text-muted">{selectedAgent?.role ?? selectedNode.agentId}</div>
              </div>
            </div>
            {selectedExec && (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className="badge" style={{ borderColor: statusColor(selectedExec.status) + "44", color: statusColor(selectedExec.status) }}>
                  {selectedExec.status}
                </span>
                <span>{(selectedExec.tokensIn + selectedExec.tokensOut).toLocaleString()} tok</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
            <div className="border-r border-border-subtle">
              <div className="border-b border-border-subtle px-3 py-2 text-xs uppercase tracking-wide text-text-muted">Input</div>
              <pre className="max-h-[480px] overflow-auto p-3 font-mono text-xs leading-relaxed text-text-secondary whitespace-pre-wrap">
                {selectedExec?.input || selectedNode.prompt}
              </pre>
            </div>
            <div>
              <div className="border-b border-border-subtle px-3 py-2 text-xs uppercase tracking-wide text-text-muted">
                Output
                {selectedExec?.status === "running" && (
                  <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-status-running" />
                )}
              </div>
              <div className="prose-mini max-h-[480px] overflow-auto p-3">
                {selectedExec?.error ? (
                  <pre className="text-xs text-status-error whitespace-pre-wrap">{selectedExec.error}</pre>
                ) : (
                  <Markdown text={selectedOutput || "(no output yet)"} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Minimal Markdown renderer for streaming agent output. We deliberately keep
 * it tiny and dependency-free — we only need headings, lists, bold/italic,
 * and inline code to make output readable while it streams.
 */
function Markdown({ text }: { text: string }) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderMarkdown(s: string): string {
  const escape = (x: string) => x.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  } as Record<string, string>)[c]!);
  const lines = s.split("\n");
  const out: string[] = [];
  let inList = false;
  for (let raw of lines) {
    const line = escape(raw);
    if (/^\s*$/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("");
      continue;
    }
    let m = /^###\s+(.*)$/.exec(line);
    if (m) { if (inList) { out.push("</ul>"); inList = false; } out.push(`<h3>${inline(m[1])}</h3>`); continue; }
    m = /^##\s+(.*)$/.exec(line);
    if (m) { if (inList) { out.push("</ul>"); inList = false; } out.push(`<h2>${inline(m[1])}</h2>`); continue; }
    m = /^#\s+(.*)$/.exec(line);
    if (m) { if (inList) { out.push("</ul>"); inList = false; } out.push(`<h1>${inline(m[1])}</h1>`); continue; }
    m = /^[-*]\s+(.*)$/.exec(line);
    if (m) { if (!inList) { out.push("<ul>"); inList = true; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    m = /^\d+\.\s+(.*)$/.exec(line);
    if (m) { if (!inList) { out.push("<ul>"); inList = true; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if (inList) { out.push("</ul>"); inList = false; }
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
}

function statusColor(s: string) {
  switch (s) {
    case "completed": return "#34c759";
    case "running": return "#f5a623";
    case "queued":
    case "pending": return "#3aa6ff";
    case "failed": return "#ff4d6d";
    case "cancelled":
    case "skipped":
    case "idle": return "#a0a0aa";
    default: return "#a0a0aa";
  }
}

function fmtRel(t: number): string {
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return new Date(t).toLocaleString();
}
