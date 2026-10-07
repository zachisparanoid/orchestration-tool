import { notFound } from "next/navigation";
import { workflows, agents } from "@/lib/db/repos";
import { WorkflowEditor } from "@/components/WorkflowEditor";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkflowDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = workflows.get(id);
  if (!w) notFound();
  const ags = agents.list();
  return (
    <div className="space-y-4 p-6">
      <Link href="/workflows" className="btn-ghost text-xs"><ChevronLeft className="h-3 w-3" />Back</Link>
      <WorkflowEditor mode="edit" workflow={w} agents={ags} />
    </div>
  );
}
