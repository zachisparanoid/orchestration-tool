import { notFound } from "next/navigation";
import { runs, executions, agents } from "@/lib/db/repos";
import { RunMonitor } from "@/components/RunMonitor";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RunDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = runs.get(id);
  if (!run) notFound();
  const execs = executions.listByRun(id);
  const ags = agents.list();
  return (
    <div className="space-y-3 p-6">
      <Link href="/runs" className="btn-ghost text-xs"><ChevronLeft className="h-3 w-3" />All runs</Link>
      <RunMonitor initialRun={run} initialExecutions={execs} agents={ags} />
    </div>
  );
}
