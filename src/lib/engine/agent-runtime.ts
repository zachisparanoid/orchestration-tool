/**
 * Agent runtime: dispatches each agent call to the best available backend.
 *
 * Backend selection (highest priority first):
 *   1. "cli"  — `RUNTIME=cli` or auto-detected `claude` binary. Uses the
 *               host's Claude Code auth (subscription, not per-token API key).
 *   2. "api"  — `ANTHROPIC_API_KEY` set. Uses Anthropic SDK directly.
 *   3. "mock" — deterministic synthetic output. Lets the app demo end-to-end
 *               without any credentials.
 *
 * Why an async generator: lets the engine `for await (const delta of run())`
 * and forward each chunk to listeners without buffering the whole response.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Agent } from "../types";
import { isClaudeCliAvailable, runViaCli } from "./claude-cli";

export interface RunDelta {
  type: "text" | "done";
  text?: string;
  tokensIn?: number;
  tokensOut?: number;
}

export type RuntimeMode = "cli" | "api" | "mock";

const HAS_API_KEY = Boolean(process.env.ANTHROPIC_API_KEY);
const FORCED = (process.env.RUNTIME ?? "").toLowerCase() as RuntimeMode | "";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return _client;
}

let _modePromise: Promise<RuntimeMode> | null = null;
export function getRuntimeMode(): Promise<RuntimeMode> {
  if (_modePromise) return _modePromise;
  _modePromise = (async () => {
    if (FORCED === "cli" || FORCED === "api" || FORCED === "mock") return FORCED;
    if (await isClaudeCliAvailable()) return "cli";
    if (HAS_API_KEY) return "api";
    return "mock";
  })();
  return _modePromise;
}

export async function* runAgent(
  agent: Agent,
  userMessage: string,
  signal?: AbortSignal,
): AsyncGenerator<RunDelta, void, void> {
  const mode = await getRuntimeMode();
  if (mode === "cli") {
    yield* runViaCli(agent, userMessage, signal);
    return;
  }
  if (mode === "api") {
    yield* runReal(agent, userMessage, signal);
    return;
  }
  yield* runMock(agent, userMessage, signal);
}

async function* runReal(
  agent: Agent,
  userMessage: string,
  signal?: AbortSignal,
): AsyncGenerator<RunDelta, void, void> {
  const stream = client().messages.stream({
    model: agent.model,
    max_tokens: agent.maxTokens,
    temperature: agent.temperature,
    system: agent.systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  for await (const event of stream) {
    if (signal?.aborted) {
      stream.controller.abort();
      throw new DOMException("Aborted", "AbortError");
    }
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "text", text: event.delta.text };
    }
  }
  const final = await stream.finalMessage();
  yield {
    type: "done",
    tokensIn: final.usage.input_tokens,
    tokensOut: final.usage.output_tokens,
  };
}

/**
 * Deterministic mock generator. Produces a plausible response shaped by the
 * agent's persona — useful for offline demos and CI. Streams ~30 token chunks
 * with realistic pacing.
 */
async function* runMock(
  agent: Agent,
  userMessage: string,
  signal?: AbortSignal,
): AsyncGenerator<RunDelta, void, void> {
  const lines = buildMockResponse(agent, userMessage);
  const text = lines.join("\n");
  const chunks = chunkText(text, 24);
  let tokensOut = 0;
  for (const chunk of chunks) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await sleep(40 + Math.random() * 80);
    tokensOut += Math.ceil(chunk.length / 4);
    yield { type: "text", text: chunk };
  }
  yield {
    type: "done",
    tokensIn: Math.ceil(userMessage.length / 4) + Math.ceil(agent.systemPrompt.length / 4),
    tokensOut,
  };
}

function buildMockResponse(agent: Agent, input: string): string[] {
  const trimmed = input.length > 220 ? input.slice(0, 220) + "…" : input;
  const cap = agent.capabilities.slice(0, 3).join(", ");
  const tag = agent.tags[0] ?? agent.category;
  return [
    `${agent.avatar} **${agent.name}** — ${agent.role}`,
    "",
    `Working on: "${trimmed}"`,
    "",
    `## Approach`,
    `Applying ${cap || agent.role} to the task with a ${tag} lens.`,
    "",
    `## Findings`,
    `1. Decomposed the request into ${3 + (input.length % 4)} concrete sub-questions.`,
    `2. Cross-checked against domain heuristics for ${agent.category}.`,
    `3. Identified the dominant constraint: balancing speed vs. completeness.`,
    "",
    `## Recommendation`,
    mockRecommendation(agent),
    "",
    `_Generated in MOCK mode — set RUNTIME=cli or ANTHROPIC_API_KEY to enable live calls._`,
  ];
}

function mockRecommendation(agent: Agent): string {
  const r = {
    research: "Start with a literature scan, then narrow to 3 hypotheses worth testing.",
    engineering: "Build a thin vertical slice end-to-end before optimizing any single layer.",
    data: "Pin down the metric definition first; without that, the dashboard is noise.",
    content: "Lead with the strongest concrete example; abstract framing kills attention.",
    design: "Prototype the unhappy paths — they expose more layout debt than the happy path.",
    marketing: "Anchor on the user's job-to-be-done, then test the riskiest hook first.",
    operations: "Automate the second occurrence, not the first. Write the runbook today.",
    security: "Threat-model before patching. Surface area shrinks faster than defenses grow.",
    qa: "Cover the boundary conditions: empty, max, malformed, concurrent.",
    analysis: "Beware spurious correlation — split the cohort and re-run the test.",
    product: "Cut scope until the smallest version still proves the bet.",
    support: "Resolve the immediate issue, then file the systemic fix as a follow-up.",
    finance: "Stress-test the model with -30% revenue. If it breaks, the plan is fragile.",
    legal: "Identify the indemnity vector first. Boilerplate hides the real exposure.",
    education: "Worked examples before abstraction; learners climb scaffolds, not cliffs.",
    creative: "Generate ten variations, then ruthlessly cut to two and force-rank.",
  }[agent.category];
  return r ?? "Move forward with a small, reversible step and measure the result.";
}

function chunkText(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Synchronous best-effort label for UI display. The real authoritative value
 * is `getRuntimeMode()` (async) but we want a no-await getter for SSR.
 */
export const RUNTIME_MODE: RuntimeMode =
  FORCED === "cli" || FORCED === "api" || FORCED === "mock"
    ? FORCED
    : HAS_API_KEY
    ? "api"
    : "mock"; // CLI auto-detection happens lazily; UI will refresh on first call
