/**
 * Seed script: populates the database with the starter agent catalog and
 * starter workflows. Idempotent — re-running upserts records.
 *
 *   npm run seed
 */
import { agents as agentsRepo, workflows as workflowsRepo } from "../src/lib/db/repos";
import { buildSeedAgents } from "../src/lib/seed/agents";
import { seedWorkflows } from "../src/lib/seed/workflows";

function main() {
  const all = buildSeedAgents();
  let nUpserted = 0;
  for (const a of all) {
    agentsRepo.upsert(a);
    nUpserted++;
  }
  console.log(`Seeded ${nUpserted} agents.`);

  let wfn = 0;
  for (const w of seedWorkflows) {
    workflowsRepo.upsert(w);
    wfn++;
  }
  console.log(`Seeded ${wfn} workflows.`);

  const total = agentsRepo.count();
  console.log(`Total agents in DB: ${total}`);
}

main();
