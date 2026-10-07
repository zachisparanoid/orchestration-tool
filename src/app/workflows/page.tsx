import Link from "next/link";
import { workflows, agents } from "@/lib/db/repos";
import { Plus, GitBranch, Play, Trash2 } from "lucide-react";
import { WorkflowsList } from "@/components/WorkflowsList";

export const dynamic = "force-dynamic";

export default function WorkflowsPage() {
  const ws = workflows.list();
  const ags = agents.list();

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <GitBranch className="h-5 w-5 text-accent" /> Workflows
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            DAGs of agents. Each node consumes the run input and any upstream outputs.
          </p>
        </div>
        <Link href="/workflows/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New workflow
        </Link>
      </div>

      <WorkflowsList workflows={ws} agents={ags} />
    </div>
  );
}
