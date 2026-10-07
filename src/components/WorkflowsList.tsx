"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Trash2, GitBranch } from "lucide-react";
import { useState } from "react";
import type { Workflow, Agent } from "@/lib/types";
import { DagPreview } from "./DagPreview";

export function WorkflowsList({ workflows, agents }: { workflows: Workflow[]; agents: Agent[] }) {
  const router = useRouter();
  const agentById = new Map(agents.map((a) => [a.id, a]));

  async function remove(id: string) {
    if (!confirm("Delete workflow?")) return;
    await fetch(`/api/workflows/${id}`, { method: "DELETE" });
    router.refresh();
  }

  if (workflows.length === 0) {
    return (
      <div className="card p-10 text-center text-sm text-text-muted">
        No workflows yet. Click <span className="text-text-primary">New workflow</span> to create one.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {workflows.map((w) => (
        <div key={w.id} className="card overflow-hidden">
          <div className="border-b border-border-subtle p-3">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/workflows/${w.id}`} className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-text-primary hover:text-accent">{w.name}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{w.description}</div>
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                <RunButton workflow={w} />
                <button onClick={() => remove(w.id)} className="btn-ghost text-status-error">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
              <span className="badge border-border-subtle">{w.shape}</span>
              <span>· {w.nodes.length} nodes</span>
              <span>· {w.edges.length} edges</span>
            </div>
          </div>
          <DagPreview workflow={w} agentById={agentById} />
        </div>
      ))}
    </div>
  );
}

function RunButton({ workflow }: { workflow: Workflow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function go() {
    const input = prompt(`Run "${workflow.name}" — enter input:`);
    if (!input) return;
    setBusy(true);
    const r = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflowId: workflow.id, input }),
    });
    const j = await r.json();
    setBusy(false);
    if (j.run) router.push(`/runs/${j.run.id}`);
  }

  return (
    <button onClick={go} disabled={busy} className="btn-secondary text-xs">
      <Play className="h-3.5 w-3.5" />Run
    </button>
  );
}
