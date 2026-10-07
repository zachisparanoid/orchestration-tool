import Link from "next/link";
import { agents, runs, workflows } from "@/lib/db/repos";
import { getRuntimeMode } from "@/lib/engine/agent-runtime";
import { Boxes, GitBranch, Activity, Zap, ArrowRight, Sparkles } from "lucide-react";
import { SeedButton } from "@/components/SeedButton";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const runtimeMode = await getRuntimeMode();
  const all = agents.list();
  const byCat: Record<string, number> = {};
  for (const a of all) byCat[a.category] = (byCat[a.category] ?? 0) + 1;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  const recentRuns = runs.list(8);
  const wfs = workflows.list();

  const empty = all.length === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Mission Control</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Compose, dispatch, and observe a fleet of <span className="text-text-primary">{all.length}</span> specialized agents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RuntimeBadge mode={runtimeMode} />
        </div>
      </header>

      {empty && (
        <div className="card-elevated p-6">
          <div className="flex items-start gap-4">
            <Sparkles className="mt-0.5 h-5 w-5 text-accent" />
            <div className="flex-1">
              <h2 className="text-base font-semibold">Get started</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Seed your database with 110+ pre-configured agents and 4 sample workflows. Idempotent — safe to re-run.
              </p>
              <div className="mt-3"><SeedButton /></div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Agents" value={all.length} icon={Boxes} href="/agents" />
        <StatCard label="Workflows" value={wfs.length} icon={GitBranch} href="/workflows" />
        <StatCard label="Recent runs" value={recentRuns.length} icon={Activity} href="/runs" />
        <StatCard label="Categories" value={Object.keys(byCat).length} icon={Sparkles} href="/agents" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Agent distribution</h2>
            <Link href="/agents" className="btn-ghost text-xs">
              Browse fleet <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {cats.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">No agents seeded yet.</p>
          ) : (
            <div className="space-y-2">
              {cats.map(([cat, n]) => (
                <div key={cat} className="flex items-center gap-3">
                  <div className="w-24 text-xs uppercase tracking-wide text-text-secondary">{cat}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-elevated">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-status-paused"
                      style={{ width: `${Math.min(100, (n / all.length) * 100 * 2)}%` }}
                    />
                  </div>
                  <div className="w-8 text-right text-xs text-text-secondary">{n}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold">Quick actions</h2>
          <div className="space-y-2">
            <Link href="/quick-run" className="card-elevated flex items-center justify-between p-3 transition-colors hover:bg-bg-subtle">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4 text-status-running" /> Quick Run
                </div>
                <div className="mt-0.5 text-xs text-text-muted">Pick agents, ask a question, get parallel answers.</div>
              </div>
              <ArrowRight className="h-4 w-4 text-text-muted" />
            </Link>
            <Link href="/workflows" className="card-elevated flex items-center justify-between p-3 transition-colors hover:bg-bg-subtle">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <GitBranch className="h-4 w-4 text-accent" /> Workflows
                </div>
                <div className="mt-0.5 text-xs text-text-muted">Build DAGs of agents that feed each other.</div>
              </div>
              <ArrowRight className="h-4 w-4 text-text-muted" />
            </Link>
            <Link href="/runs" className="card-elevated flex items-center justify-between p-3 transition-colors hover:bg-bg-subtle">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Activity className="h-4 w-4 text-status-success" /> Recent Runs
                </div>
                <div className="mt-0.5 text-xs text-text-muted">Watch live progress and inspect history.</div>
              </div>
              <ArrowRight className="h-4 w-4 text-text-muted" />
            </Link>
          </div>
        </div>
      </div>

      {recentRuns.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent runs</h2>
            <Link href="/runs" className="btn-ghost text-xs">View all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <ul className="divide-y divide-border-subtle">
            {recentRuns.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <Link href={`/runs/${r.id}`} className="flex-1 truncate text-sm text-text-primary hover:text-accent">
                  <span className="font-mono text-text-muted">{r.id}</span>{" "}
                  <span className="text-text-secondary">·</span>{" "}
                  {r.workflowSnapshot.name}
                </Link>
                <span
                  className="badge ml-3"
                  style={{
                    borderColor: statusColor(r.status) + "44",
                    color: statusColor(r.status),
                  }}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, href }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; href: string }) {
  return (
    <Link href={href} className="card p-4 transition-colors hover:bg-bg-surface/80">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-text-muted">{label}</span>
        <Icon className="h-4 w-4 text-text-muted" />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">{value}</div>
    </Link>
  );
}

function RuntimeBadge({ mode }: { mode: "cli" | "api" | "mock" }) {
  const palette = {
    cli:  { color: "#34c759", label: "Live (Claude Code CLI)" },
    api:  { color: "#3aa6ff", label: "Live (Anthropic API)" },
    mock: { color: "#a0a0aa", label: "Mock mode" },
  }[mode];
  return (
    <span
      className="badge"
      style={{ borderColor: palette.color + "44", color: palette.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: palette.color }} />
      {palette.label}
    </span>
  );
}

function statusColor(s: string) {
  switch (s) {
    case "completed": return "#34c759";
    case "running": return "#f5a623";
    case "queued": return "#3aa6ff";
    case "failed": return "#ff4d6d";
    case "cancelled": return "#a0a0aa";
    default: return "#a0a0aa";
  }
}
