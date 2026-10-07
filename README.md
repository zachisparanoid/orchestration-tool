# Orchestrator — 100+ Agent Fleet

A self-contained web app for orchestrating **103+ specialized agents** through composable workflows.
Define agents, wire them into DAGs, fire prompts, and watch results stream in real time.

![status](https://img.shields.io/badge/status-ready-7c5cff)
![next](https://img.shields.io/badge/Next.js-15-black)
![runtime](https://img.shields.io/badge/runtime-Node%2020+-3aa6ff)

## Features

- **Agent Catalog** — 103 hand-curated agents across 16 categories (research, engineering, data, content, design, security, QA, product, finance, legal, education, creative, …). Every field is editable in the UI.
- **Workflow Editor** — build DAGs of agents with auto-rendered preview. Reference upstream outputs in any node prompt via `{{node:<id>}}`.
- **Quick Run** — pick any subset of agents, write one prompt, run them in *parallel* or *pipeline*. Great for cross-functional opinions on a single artifact.
- **Live Execution Monitor** — Server-Sent Events stream every token of every agent into the UI; click a node to inspect its input/output as it streams.
- **3-mode runtime** — auto-detects the best available backend:
  1. **CLI mode** — shells out to the `claude` binary, using the host's Claude Code login (counts against your Pro/Max subscription, not per-token API billing).
  2. **API mode** — uses the Anthropic SDK with `ANTHROPIC_API_KEY`.
  3. **Mock mode** — deterministic synthetic output for offline demos.
- **Append-only event log** — every state change is captured for audit and replay. The UI is *derived* from the event stream.
- **Concurrency control** — global semaphore caps parallel agent calls (`MAX_CONCURRENCY`, default 12) so you don't get rate-limited.

## Quickstart

```bash
# 1. Install
npm install

# 2. Authenticate
#    Option A (recommended) — use your Claude Code subscription:
claude /login   # if not already authenticated on this host

#    Option B — use a direct API key:
cp .env.example .env
#    then set ANTHROPIC_API_KEY=...

# 3. Run dev server
npm run dev
```

Open <http://localhost:3000>, click **Seed agents & workflows**, and you're live.
The runtime mode badge in the header confirms which backend is active.

### CLI mode caveats

- **Per-agent `temperature` / `maxTokens` are ignored** — the CLI doesn't expose those flags. The model still picks them sensibly.
- **Hooks and skills are bypassed** — the orchestrator runs each agent through an isolated config dir (`data/claude-isolated/`) that copies your credentials but skips the host's `~/.claude/CLAUDE.md`, hooks, plugins, and skills. This keeps responses focused on the task rather than meta-deliberation about whether to invoke a skill.
- **Tools are disabled** — orchestrated agents emit text only (`--disallowedTools` covers Bash/Read/Write/etc.). The orchestrator drives the work; agents respond.

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) | Server Components render the 100+ card grid fast; route handlers host the SSE stream. |
| Language | TypeScript (strict) | Catch wiring mistakes at compile time. |
| Styling | Tailwind CSS | Dark-only design tokens; tiny CSS surface. |
| DB | SQLite via `better-sqlite3` | Synchronous, embedded, file-backed — perfect for single-host orchestration. |
| AI | `@anthropic-ai/sdk` (streaming) | Token deltas piped straight into SSE. |
| Realtime | Server-Sent Events | One-way `server → client` over plain HTTP; survives reconnects via cursor on `events` table. |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│   ├─ /agents   (Server Component — renders fleet from SQLite)│
│   ├─ /workflows (DAG editor — form + SVG preview)            │
│   ├─ /quick-run (panel picker + one-shot run)                │
│   └─ /runs/[id] (EventSource subscribes to SSE stream)       │
└──────────────────────────────────────────────────────────────┘
                       │ fetch / SSE
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Next.js App Router (/api/*)                                 │
│   ├─ POST /api/runs       → createRun + executeRun (async)   │
│   ├─ GET  /api/runs/[id]/stream  → SSE: tails events table   │
│   ├─ /api/agents, /workflows, /quick-run, /seed              │
└──────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Orchestration engine                                        │
│   • Topological-level DAG executor                           │
│   • Counting semaphore (MAX_CONCURRENCY)                     │
│   • Agent runtime: live (Anthropic SDK) or mock fallback     │
│   • Emits run.* / task.* / log events to SQLite              │
└──────────────────────────────────────────────────────────────┘
                       │
                       ▼
              ┌────────────────────┐
              │ data/orchestration.db (SQLite, WAL) │
              │ agents · workflows · runs ·         │
              │ task_executions · events            │
              └────────────────────┘
```

### Data model

- **Agent** — persona + model config. Editable in `/agents/[id]`.
- **Workflow** — template: `nodes[]` (each pointing at an agent + prompt template) and `edges[]` (DAG).
- **Run** — instance of a workflow. Stores a *frozen* `workflowSnapshot` so edits to the workflow don't rewrite history.
- **TaskExecution** — one node of one run.
- **Event** — append-only log driving the live UI and audit trail.

### Workflow prompt templating

Inside a node's `prompt` field, two interpolations are available:

- `{{input}}` — the run's input
- `{{node:<nodeId>}}` — the output of an upstream node

Example:

```text
Synthesize these findings into a one-page brief:

## Research
{{node:scout}}

## Market
{{node:market}}
```

## Environment

| Var | Default | Purpose |
| --- | --- | --- |
| `RUNTIME` | _(auto)_ | Force backend: `cli`, `api`, or `mock`. |
| `CLAUDE_CLI_PATH` | _(auto-resolved)_ | Override path to the `claude` binary. |
| `CLAUDE_HOME_DIR` | `$HOME/.claude` | Host's authenticated Claude Code config dir. |
| `CLAUDE_ISOLATED_DIR` | `./data/claude-isolated` | Where orchestrator runs Claude (clean of hooks/skills). |
| `ANTHROPIC_API_KEY` | _(unset)_ | Enables API mode. Fallback if CLI not available. |
| `DEFAULT_MODEL` | `claude-sonnet-4-6` | Used when an agent record doesn't override. |
| `MAX_CONCURRENCY` | `12` | Cap of parallel agent calls (across all runs). |
| `DB_PATH` | `./data/orchestration.db` | SQLite file location. |

## Project layout

```
src/
├─ app/
│  ├─ api/              # Route handlers (REST + SSE)
│  │  ├─ agents/        # CRUD
│  │  ├─ workflows/     # CRUD
│  │  ├─ runs/          # create + stream
│  │  ├─ quick-run/     # ad-hoc panel run
│  │  ├─ seed/          # one-click seed
│  │  └─ stats/         # dashboard counters
│  ├─ agents/           # Fleet + agent detail
│  ├─ workflows/        # List, new, edit
│  ├─ quick-run/        # Panel UI
│  ├─ runs/             # List + live monitor
│  ├─ layout.tsx
│  ├─ globals.css
│  └─ page.tsx          # Overview
├─ components/          # Sidebar, editors, monitors, DAG preview
└─ lib/
   ├─ db/               # SQLite client + repositories + schema
   ├─ engine/           # Orchestrator, agent runtime, semaphore
   ├─ seed/             # Starter agents + workflows
   └─ types.ts
```

## Scripts

```bash
npm run dev    # next dev (HMR)
npm run build  # next build
npm start      # next start (production)
npm run seed   # populate DB with starter agents + workflows
```

## Deploying to a dedicated host (CLI mode)

The CLI mode pattern works well when you want the orchestrator to use a *specific* Claude Code account — perhaps a dedicated subscription separate from your personal one. The pattern:

1. Provision a Linux host (any distro with Node 20+).
2. Install Claude Code: `curl -fsSL https://claude.ai/install.sh | bash` (or via npm).
3. `claude /login` with the account you want the orchestrator to use. This writes `~/.claude/.credentials.json`.
4. Copy the project to the host and `npm install`.
5. `npm run seed` once.
6. Start: `npm run build && npm start -- -p 3000` (or `npm run dev` for live reload).
7. The orchestrator auto-detects the CLI at startup and serves all agent calls through it. Billing → that Claude account, no API key needed.

Each run still uses the isolated config dir under `data/claude-isolated/`, so the host user's Claude Code settings, hooks, and skills don't bleed in.

To run it as a service, put it under `pm2` or write a systemd unit. The DB is just a file under `data/`, so backup/restore is `cp orchestration.db elsewhere`.

## Notes & limitations

- **Single host**: SQLite is fine for a single dev machine. For multi-host, swap to Postgres + a pub-sub bus and the rest of the architecture stays put.
- **No auth**: this is a local-first tool. Add a reverse proxy with basic auth if exposing remotely.
- **Tool use**: the `tools` field on agents is metadata only — the engine doesn't invoke MCP tools yet. Wiring `mcp` / built-in tools into the SDK call is a clean follow-on.
- **Cycle protection**: the editor refuses to create cycles. The engine also skips downstream nodes if an upstream dependency fails.
