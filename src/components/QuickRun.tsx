"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Play, X, Loader2, Search } from "lucide-react";
import type { Agent } from "@/lib/types";
import { cn } from "@/lib/cn";

export function QuickRun({ agents }: { agents: Agent[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [shape, setShape] = useState<"parallel" | "pipeline">("parallel");
  const [running, setRunning] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("__all__");

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of agents) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [agents]);

  const filtered = useMemo(() => {
    const qq = q.toLowerCase();
    return agents.filter((a) => {
      if (cat !== "__all__" && a.category !== cat) return false;
      if (!qq) return true;
      return (
        a.name.toLowerCase().includes(qq) ||
        a.role.toLowerCase().includes(qq) ||
        a.capabilities.some((c) => c.toLowerCase().includes(qq))
      );
    });
  }, [agents, q, cat]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function go() {
    if (!prompt.trim() || selected.length === 0) return;
    setRunning(true);
    const r = await fetch("/api/quick-run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: prompt, agentIds: selected, shape }),
    });
    const j = await r.json();
    setRunning(false);
    if (j.run) router.push(`/runs/${j.run.id}`);
  }

  const selectedAgents = selected
    .map((id) => agents.find((a) => a.id === id))
    .filter((a): a is Agent => !!a);

  return (
    <div className="grid h-[calc(100vh-0px)] grid-cols-1 lg:grid-cols-[1fr,360px]">
      <div className="space-y-3 overflow-y-auto p-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Zap className="h-5 w-5 text-status-running" /> Quick Run
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Pick a panel of agents, write one prompt, get parallel (or chained) responses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search agents…"
              className="input pl-8"
              style={{ width: 280 }}
            />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="input" style={{ width: 200 }}>
            <option value="__all__">All categories</option>
            {categories.map(([c, n]) => (
              <option key={c} value={c}>{c} ({n})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => {
            const isSelected = selected.includes(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                className={cn(
                  "card flex items-start gap-2.5 p-2.5 text-left transition-colors hover:bg-bg-surface/80",
                  isSelected && "border-accent bg-accent-subtle",
                )}
              >
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded text-base"
                  style={{ background: a.color + "22", border: `1px solid ${a.color}44` }}
                >
                  {a.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-text-primary">{a.name}</div>
                  <div className="truncate text-[11px] text-text-secondary">{a.role}</div>
                </div>
                <div
                  className={cn(
                    "h-4 w-4 shrink-0 rounded border",
                    isSelected ? "border-accent bg-accent text-white" : "border-border",
                  )}
                >
                  {isSelected && <svg viewBox="0 0 16 16" className="h-full w-full fill-white"><path d="M6.6 11.6 3.4 8.4l1-1L6.6 9.6l5-5 1 1z" /></svg>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="sticky top-0 flex h-screen flex-col border-l border-border-subtle bg-bg-surface/40 p-4 backdrop-blur">
        <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Panel ({selected.length})</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedAgents.length === 0 ? (
            <span className="text-xs text-text-muted">Select agents on the left.</span>
          ) : (
            selectedAgents.map((a) => (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                className="badge border-border text-text-secondary hover:border-status-error hover:text-status-error"
                title="Remove"
              >
                {a.avatar} {a.name}
                <X className="h-3 w-3" />
              </button>
            ))
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Shape</span>
          <div className="flex overflow-hidden rounded-md border">
            <button
              onClick={() => setShape("parallel")}
              className={cn("px-3 py-1.5 text-xs", shape === "parallel" ? "bg-accent text-white" : "text-text-secondary")}
            >
              Parallel
            </button>
            <button
              onClick={() => setShape("pipeline")}
              className={cn("border-l px-3 py-1.5 text-xs", shape === "pipeline" ? "bg-accent text-white" : "text-text-secondary")}
            >
              Pipeline
            </button>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-text-muted">
          {shape === "parallel"
            ? "All agents see the same input, run at the same time."
            : "Each agent sees the input plus the previous agent's output."}
        </p>

        <label className="mt-4 block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-text-muted">Prompt</span>
          <textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What should the panel work on?"
            className="input mt-1 min-h-[160px]"
          />
        </label>

        <button
          onClick={go}
          disabled={running || !prompt.trim() || selected.length === 0}
          className="btn-primary mt-3 w-full justify-center disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run on {selected.length || 0} agent{selected.length === 1 ? "" : "s"}
        </button>
      </aside>
    </div>
  );
}
