/**
 * Convenience endpoint that triggers the seed from the running app
 * (so the user doesn't need a separate terminal for `npm run seed`).
 */
import { NextResponse } from "next/server";
import { agents, workflows } from "@/lib/db/repos";
import { buildSeedAgents } from "@/lib/seed/agents";
import { seedWorkflows } from "@/lib/seed/workflows";

export const dynamic = "force-dynamic";

export async function POST() {
  const seedAgents = buildSeedAgents();
  for (const a of seedAgents) agents.upsert(a);
  for (const w of seedWorkflows) workflows.upsert(w);
  return NextResponse.json({
    agents: agents.count(),
    workflows: workflows.list().length,
  });
}
