import Link from "next/link";
import { runs } from "@/lib/db/repos";
import { Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default function RunsPage() {
  const list = runs.list(100);
  return (
    <div className="space-y-4 p-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <Activity className="h-5 w-5 text-accent" /> Runs
      </h1>
      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm text-text-muted">
          No runs yet. Trigger one from a <Link href="/workflows" className="text-accent">workflow</Link> or via <Link href="/quick-run" className="text-accent">Quick Run</Link>.
        </div>
      ) : (
        <div className="card divide-y divide-border-subtle">
          {list.map((r) => (
            <Link key={r.id} href={`/runs/${r.id}`} className="flex items-center justify-between p-3 transition-colors hover:bg-bg-elevated">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-text-muted">{r.id}</span>
                  <span className="text-text-primary">{r.workflowSnapshot.name}</span>
                </div>
                <div className="mt-0.5 truncate text-xs text-text-secondary">
                  {r.input.slice(0, 200)}
                </div>
              </div>
              <div className="flex items-center gap-3 pl-4">
                <span className="text-xs text-text-muted tabular-nums">{r.totalTokens.toLocaleString()} tok</span>
                <span
                  className="badge"
                  style={{
                    borderColor: statusColor(r.status) + "44",
                    color: statusColor(r.status),
                  }}
                >
                  {r.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
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
