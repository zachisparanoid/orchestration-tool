import { agents } from "@/lib/db/repos";
import { AgentsExplorer } from "@/components/AgentsExplorer";
import { SeedButton } from "@/components/SeedButton";

export const dynamic = "force-dynamic";

export default function AgentsPage() {
  const all = agents.list();
  if (all.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Agents</h1>
        <p className="text-sm text-text-secondary">
          The catalog is empty. Seed the database with 110+ starter agents to get going.
        </p>
        <SeedButton />
      </div>
    );
  }
  return <AgentsExplorer agents={all} />;
}
