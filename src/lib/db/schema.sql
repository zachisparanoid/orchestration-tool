-- Agent orchestration database schema.
-- Designed for append-only event log + denormalized state for fast reads.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS agents (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  role            TEXT NOT NULL,
  description     TEXT NOT NULL,
  model           TEXT NOT NULL,
  system_prompt   TEXT NOT NULL,
  capabilities    TEXT NOT NULL,        -- JSON array of strings
  tools           TEXT NOT NULL,        -- JSON array of strings
  tags            TEXT NOT NULL,        -- JSON array of strings
  temperature     REAL NOT NULL DEFAULT 0.7,
  max_tokens      INTEGER NOT NULL DEFAULT 2048,
  avatar          TEXT NOT NULL,        -- single emoji or short string
  color           TEXT NOT NULL,        -- hex color for UI
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role);

CREATE TABLE IF NOT EXISTS workflows (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  -- nodes: [{ id, agentId, label, prompt, inputsFrom: [nodeId], settings }]
  nodes           TEXT NOT NULL,
  -- edges: [{ from, to }]  -- DAG edges
  edges           TEXT NOT NULL,
  -- shape: "pipeline" | "parallel" | "fanout" | "dag"
  shape           TEXT NOT NULL DEFAULT 'dag',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id              TEXT PRIMARY KEY,
  workflow_id     TEXT,                 -- nullable for ad-hoc runs
  workflow_snapshot TEXT NOT NULL,      -- frozen workflow JSON at run time
  input           TEXT NOT NULL,        -- the prompt/input that kicked off the run
  status          TEXT NOT NULL,        -- queued|running|completed|failed|cancelled
  started_at      INTEGER,
  completed_at    INTEGER,
  total_tokens    INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs(workflow_id);

CREATE TABLE IF NOT EXISTS task_executions (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL,
  node_id         TEXT NOT NULL,        -- node id within the workflow snapshot
  agent_id        TEXT NOT NULL,
  status          TEXT NOT NULL,        -- pending|running|completed|failed|skipped
  input           TEXT NOT NULL,
  output          TEXT,
  error           TEXT,
  tokens_in       INTEGER NOT NULL DEFAULT 0,
  tokens_out      INTEGER NOT NULL DEFAULT 0,
  started_at      INTEGER,
  completed_at    INTEGER,
  attempt         INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_executions_run ON task_executions(run_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON task_executions(status);

-- Append-only event log for live SSE streaming and post-hoc audit.
CREATE TABLE IF NOT EXISTS events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id          TEXT NOT NULL,
  execution_id    TEXT,
  type            TEXT NOT NULL,        -- run.* | task.* | log
  payload         TEXT NOT NULL,        -- JSON
  timestamp       INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id, id);
