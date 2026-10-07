import { notFound } from "next/navigation";
import { agents } from "@/lib/db/repos";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { AgentEditor } from "@/components/AgentEditor";

export const dynamic = "force-dynamic";

export default async function AgentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = agents.get(id);
  if (!a) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <Link href="/agents" className="btn-ghost text-xs"><ChevronLeft className="h-3 w-3" />Back to fleet</Link>
      <AgentEditor agent={a} />
    </div>
  );
}
