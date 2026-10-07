import { agents } from "@/lib/db/repos";
import { WorkflowEditor } from "@/components/WorkflowEditor";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default function NewWorkflowPage() {
  const ags = agents.list();
  return (
    <div className="space-y-4 p-6">
      <Link href="/workflows" className="btn-ghost text-xs"><ChevronLeft className="h-3 w-3" />Back</Link>
      <WorkflowEditor mode="create" agents={ags} />
    </div>
  );
}
