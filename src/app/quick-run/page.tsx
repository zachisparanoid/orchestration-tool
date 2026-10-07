import { agents } from "@/lib/db/repos";
import { QuickRun } from "@/components/QuickRun";
import { SeedButton } from "@/components/SeedButton";

export const dynamic = "force-dynamic";

export default function QuickRunPage() {
  const all = agents.list();
  if (all.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Quick Run</h1>
        <p className="text-sm text-text-secondary">
          Seed your agents first, then come back here to run a prompt across a hand-picked panel.
        </p>
        <SeedButton />
      </div>
    );
  }
  return <QuickRun agents={all} />;
}
