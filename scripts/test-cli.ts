/**
 * Quick smoke test for the Claude CLI runtime. Picks the first seeded agent,
 * sends a short prompt, prints streamed deltas.
 *
 *   npx tsx scripts/test-cli.ts "your prompt here"
 */
import { runAgent, getRuntimeMode } from "../src/lib/engine/agent-runtime";
import { buildSeedAgents } from "../src/lib/seed/agents";

async function main() {
  const prompt = process.argv.slice(2).join(" ") || "In one short sentence, what does a market analyst do?";
  const mode = await getRuntimeMode();
  console.log(`[mode] ${mode}`);
  const agent = buildSeedAgents().find((a) => a.name === "Market Analyst")!;
  agent.model = "claude-haiku-4-5-20251001"; // fast for smoke test
  console.log(`[agent] ${agent.name} (${agent.model})`);
  console.log(`[prompt] ${prompt}\n`);

  let chunks = 0;
  let chars = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  const t0 = Date.now();

  for await (const delta of runAgent(agent, prompt)) {
    if (delta.type === "text" && delta.text) {
      chunks++;
      chars += delta.text.length;
      process.stdout.write(delta.text);
    } else if (delta.type === "done") {
      tokensIn = delta.tokensIn ?? 0;
      tokensOut = delta.tokensOut ?? 0;
    }
  }
  const dt = Date.now() - t0;
  console.log(`\n\n[stats] ${chunks} deltas, ${chars} chars, ${tokensIn}+${tokensOut} tokens, ${dt}ms`);
}

main().catch((e) => {
  console.error("[error]", e);
  process.exit(1);
});
