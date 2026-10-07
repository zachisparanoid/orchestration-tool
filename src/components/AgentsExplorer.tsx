"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Boxes } from "lucide-react";
import type { Agent } from "@/lib/types";
import { cn } from "@/lib/cn";

const ALL = "__all__";

export function AgentsExplorer({ agents }: { agents: Agent[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(ALL);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of agents) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [agents]);

  const filtered = useMemo(() => {
    const qq = q.toLowerCase();
    return agents.filter((a) => {
      if (cat !== ALL && a.category !== cat) return false;
      if (!qq) return true;
      return (
        a.name.toLowerCase().includes(qq) ||
        a.role.toLowerCase().includes(qq) ||
        a.description.toLowerCase().includes(qq) ||
        a.tags.some((t) => t.toLowerCase().includes(qq)) ||
        a.capabilities.some((c) => c.toLowerCase().includes(qq))
      );
    });
  }, [agents, q, cat]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Boxes className="h-5 w-5 text-accent" /> Agent Fleet
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {filtered.length} of {agents.length} agents shown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search agents, capabilities, tags…"
              className="input pl-8"
              style={{ width: 320 }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <CategoryChip label="All" count={agents.length} active={cat === ALL} onClick={() => setCat(ALL)} />
        {categories.map(([c, n]) => (
          <CategoryChip key={c} label={c} count={n} active={cat === c} onClick={() => setCat(c)} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((a) => (
          <AgentCard key={a.id} a={a} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="card p-12 text-center text-sm text-text-muted">No agents match those filters.</div>
      )}
    </div>
  );
}

function CategoryChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "badge border-border-subtle text-text-secondary transition-colors hover:border-border",
        active && "border-accent bg-accent-subtle text-text-primary",
      )}
    >
      {label}
      <span className="text-text-muted">·</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

function AgentCard({ a }: { a: Agent }) {
  return (
    <Link
      href={`/agents/${a.id}`}
      className="card group flex h-full flex-col p-3 transition-colors hover:border-border hover:bg-bg-surface/80"
    >
      <div className="flex items-start gap-2.5">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-lg"
          style={{ background: a.color + "22", border: `1px solid ${a.color}44` }}
        >
          {a.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-text-primary group-hover:text-accent">{a.name}</div>
          <div className="truncate text-xs text-text-secondary">{a.role}</div>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-text-muted">{a.description}</p>
      <div className="mt-auto pt-2.5">
        <div className="flex flex-wrap gap-1">
          <span className="badge border-border-subtle text-text-muted" style={{ color: a.color, borderColor: a.color + "44" }}>
            {a.category}
          </span>
          {a.capabilities.slice(0, 2).map((c) => (
            <span key={c} className="badge border-border-subtle text-text-muted">{c}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
