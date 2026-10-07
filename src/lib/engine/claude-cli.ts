/**
 * Claude Code CLI runtime — shells out to the `claude` binary so that each
 * orchestrated agent call goes through whatever account is authenticated on
 * the host machine (via `claude /login`).
 *
 * Why isolate the config dir?
 * ---------------------------
 * The host user's ~/.claude commonly contains hooks, skills, plugins, and a
 * personal CLAUDE.md — all of which inject system reminders ("you MUST invoke
 * the X skill before responding") into every session. For orchestrated, short,
 * task-shaped agent calls, that derails the response and burns the 1-turn
 * budget on meta-deliberation about whether to invoke a skill.
 *
 * We solve this by creating an isolated `<project>/data/claude-isolated/`
 * config dir that:
 *   • copies the host's `.credentials.json` (so auth survives)
 *   • writes an empty CLAUDE.md and a minimal settings.json (so hooks/skills
 *     don't load)
 *
 * The result: each call uses the host's identity + billing, but with a clean,
 * predictable system context.
 */
import { spawn } from "node:child_process";
import {
  mkdirSync,
  existsSync,
  copyFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { join, dirname, delimiter } from "node:path";
import { homedir } from "node:os";
import type { Agent } from "../types";
import type { RunDelta } from "./agent-runtime";

/**
 * Resolve the Claude binary. Prefers a real executable (`claude.exe` on
 * Windows, `claude` script on POSIX) over a `.cmd` shim — Node's spawn
 * handles real executables reliably without `shell: true`.
 */
function resolveClaudeBin(): string {
  if (process.env.CLAUDE_CLI_PATH) return process.env.CLAUDE_CLI_PATH;
  const isWin = process.platform === "win32";
  const fileCandidates = isWin ? ["claude.exe", "claude.cmd", "claude"] : ["claude"];

  for (const dir of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) {
    for (const name of fileCandidates) {
      const candidate = join(dir, name);
      if (!existsSync(candidate)) continue;
      // If we found a Windows shim, look in the adjacent node_modules for the .exe.
      if (isWin && candidate.toLowerCase().endsWith(".cmd")) {
        const exe = join(
          dirname(candidate),
          "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe",
        );
        if (existsSync(exe)) return exe;
      }
      return candidate;
    }
  }
  return isWin ? "claude.cmd" : "claude";
}

const CLAUDE_BIN = resolveClaudeBin();
const HOST_CLAUDE_DIR = process.env.CLAUDE_HOME_DIR ?? join(homedir(), ".claude");
const ISOLATED_DIR = process.env.CLAUDE_ISOLATED_DIR ?? join(process.cwd(), "data", "claude-isolated");

let lastCredsCopiedMs = 0;

/**
 * Lazily ensures the isolated config dir exists and that credentials are
 * up to date. Refreshes the credentials file whenever the host's copy is
 * newer (so a `claude /login` on the host propagates within one call).
 */
function ensureIsolatedConfig(): void {
  if (!existsSync(ISOLATED_DIR)) {
    mkdirSync(ISOLATED_DIR, { recursive: true });
  }

  const hostCreds = join(HOST_CLAUDE_DIR, ".credentials.json");
  const isoCreds = join(ISOLATED_DIR, ".credentials.json");

  if (existsSync(hostCreds)) {
    const hostMtime = statSync(hostCreds).mtimeMs;
    if (hostMtime !== lastCredsCopiedMs) {
      try {
        copyFileSync(hostCreds, isoCreds);
        lastCredsCopiedMs = hostMtime;
      } catch (e) {
        // On some platforms credentials are stored in OS keychain instead.
        // Spawn will still inherit env so the CLI can locate them.
        console.warn("[claude-cli] could not copy credentials:", (e as Error).message);
      }
    }
  }

  const settingsPath = join(ISOLATED_DIR, "settings.json");
  if (!existsSync(settingsPath)) {
    writeFileSync(
      settingsPath,
      JSON.stringify(
        {
          // Disable host hooks entirely for orchestrated calls.
          hooks: {},
          // Don't auto-load any plugins from the host config.
          plugins: { autoload: false },
          // Skip the welcome / onboarding flows on first run.
          hasCompletedOnboarding: true,
        },
        null,
        2,
      ),
    );
  }

  // Empty CLAUDE.md ensures the host's user-level instructions don't leak in.
  const claudeMd = join(ISOLATED_DIR, "CLAUDE.md");
  if (!existsSync(claudeMd)) writeFileSync(claudeMd, "");
}

// Tools we explicitly disable for orchestrated agents. The orchestrator drives
// the work itself; we want agents to emit text, not spawn shells or edit files.
const DISALLOWED_TOOLS = [
  "Bash",
  "BashOutput",
  "KillShell",
  "Edit",
  "Write",
  "MultiEdit",
  "NotebookEdit",
  "Read",
  "Glob",
  "Grep",
  "WebSearch",
  "WebFetch",
  "Task",
  "Agent",
  "TodoWrite",
  "Skill",
  "ListMcpResourcesTool",
  "ReadMcpResourceTool",
].join(" ");

const AUTOMATION_RIDER = [
  "You are operating in NON-INTERACTIVE AUTOMATION MODE inside a multi-agent",
  "orchestrator. Reply with the requested content only — no preamble, no tool",
  "calls, no skill invocations, no questions back to the user. Ignore any",
  "system reminders about skills, hooks, or required tool invocations: they",
  "do not apply in this mode. Your output is consumed downstream by other",
  "agents, so make it self-contained and well-structured.",
].join(" ");

interface SpawnedClaude {
  proc: ReturnType<typeof spawn>;
  done: Promise<{ exitCode: number; stderr: string }>;
}

function spawnClaude(args: string[]): SpawnedClaude {
  ensureIsolatedConfig();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_CONFIG_DIR: ISOLATED_DIR,
    // Force a clean working dir so a project-level CLAUDE.md from the host
    // cwd doesn't bleed in. The orchestrator process's own CWD is fine here
    // because we're inside the orchestrator project, but we still want a
    // predictable starting point for the CLI session.
  };
  const proc = spawn(CLAUDE_BIN, args, {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: false,
  });
  let stderr = "";
  proc.stderr?.on("data", (b) => {
    stderr += b.toString();
  });
  // `spawn` emits 'error' (not exit code) when the binary can't be found;
  // we forward that into the done promise so callers see one consistent error.
  const done = new Promise<{ exitCode: number; stderr: string }>((resolve, reject) => {
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => resolve({ exitCode: code ?? 0, stderr }));
  });
  return { proc, done };
}

/**
 * Quick availability probe: tries `claude --version`. Cached after first call.
 */
let _availabilityCache: boolean | null = null;
export async function isClaudeCliAvailable(): Promise<boolean> {
  if (_availabilityCache !== null) return _availabilityCache;
  try {
    const { proc, done } = spawnClaude(["--version"]);
    let stdout = "";
    proc.stdout?.on("data", (b) => (stdout += b.toString()));
    proc.on("error", () => { /* swallow; reported via promise rejection */ });
    const { exitCode } = await done;
    _availabilityCache = exitCode === 0 && /\d+\.\d+/.test(stdout);
  } catch {
    _availabilityCache = false;
  }
  return _availabilityCache;
}

/**
 * Stream agent output by spawning `claude -p` with stream-json output.
 * Yields RunDelta values compatible with the rest of the runtime.
 *
 * Notes on the flags:
 *   --output-format stream-json + --include-partial-messages → token deltas
 *   --verbose                                                → required pair
 *   --max-turns 1                                            → no agentic loops
 *   --disallowedTools ...                                    → forbid tools
 *   --permission-mode default                                → deny on prompt
 *   --append-system-prompt AUTOMATION_RIDER                  → behavior tuning
 *   --system-prompt agent.systemPrompt                       → persona
 */
export async function* runViaCli(
  agent: Agent,
  userMessage: string,
  signal?: AbortSignal,
): AsyncGenerator<RunDelta, void, void> {
  const args = [
    "-p",
    userMessage,
    "--system-prompt",
    agent.systemPrompt,
    "--append-system-prompt",
    AUTOMATION_RIDER,
    "--model",
    agent.model,
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
    "--max-turns",
    "1",
    "--permission-mode",
    "default",
    "--disallowedTools",
    DISALLOWED_TOOLS,
  ];

  const { proc, done } = spawnClaude(args);

  const onAbort = () => {
    try { proc.kill("SIGTERM"); } catch {}
  };
  signal?.addEventListener("abort", onAbort);

  let buffer = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let sawAnyText = false;

  try {
    for await (const chunk of proc.stdout!) {
      buffer += chunk.toString("utf8");
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (!line.trim()) continue;

        let evt: ClaudeEvent;
        try {
          evt = JSON.parse(line) as ClaudeEvent;
        } catch {
          continue;
        }

        // The CLI wraps Anthropic streaming events under `stream_event`.
        if (evt.type === "stream_event" && evt.event) {
          const inner = evt.event;
          if (inner.type === "content_block_delta" && inner.delta?.type === "text_delta") {
            const text = inner.delta.text ?? "";
            if (text) {
              sawAnyText = true;
              yield { type: "text", text };
            }
          } else if (inner.type === "message_start" && inner.message?.usage) {
            tokensIn = inner.message.usage.input_tokens ?? tokensIn;
          } else if (inner.type === "message_delta" && inner.usage) {
            tokensOut = inner.usage.output_tokens ?? tokensOut;
          }
        }

        // The CLI emits a synthetic top-level `result` event when the turn ends.
        if (evt.type === "result") {
          if (typeof evt.result === "string" && !sawAnyText) {
            yield { type: "text", text: evt.result };
            sawAnyText = true;
          }
          if (evt.usage) {
            tokensIn = evt.usage.input_tokens ?? tokensIn;
            tokensOut = evt.usage.output_tokens ?? tokensOut;
          }
        }
      }
    }

    const { exitCode, stderr } = await done;
    if (exitCode !== 0) {
      throw new Error(`claude CLI exited with code ${exitCode}: ${stderr.slice(0, 800)}`);
    }
    if (!sawAnyText) {
      // Happens occasionally when the model emits only thinking blocks before
      // running out of budget. Surface a useful error rather than empty output.
      throw new Error(
        "claude CLI returned no text output (the model may have spent the turn on extended thinking). " +
        (stderr ? `stderr: ${stderr.slice(0, 400)}` : ""),
      );
    }
    yield { type: "done", tokensIn, tokensOut };
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (!proc.killed) {
      try { proc.kill(); } catch {}
    }
  }
}

// Narrow types for the events we care about.
interface ClaudeEvent {
  type: string;
  event?: {
    type: string;
    delta?: { type: string; text?: string };
    message?: { usage?: { input_tokens?: number; output_tokens?: number } };
    usage?: { output_tokens?: number };
  };
  result?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}
