import { getDb } from "./client";
import type {
  Agent,
  Workflow,
  Run,
  TaskExecution,
  OrchestrationEvent,
  EventType,
  ExecutionStatus,
  RunStatus,
} from "../types";

// --- Agents ---

interface AgentRow {
  id: string;
  name: string;
  category: string;
  role: string;
  description: string;
  model: string;
  system_prompt: string;
  capabilities: string;
  tools: string;
  tags: string;
  temperature: number;
  max_tokens: number;
  avatar: string;
  color: string;
  created_at: number;
  updated_at: number;
}

function rowToAgent(r: AgentRow): Agent {
  return {
    id: r.id,
    name: r.name,
    category: r.category as Agent["category"],
    role: r.role,
    description: r.description,
    model: r.model,
    systemPrompt: r.system_prompt,
    capabilities: JSON.parse(r.capabilities),
    tools: JSON.parse(r.tools),
    tags: JSON.parse(r.tags),
    temperature: r.temperature,
    maxTokens: r.max_tokens,
    avatar: r.avatar,
    color: r.color,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const agents = {
  list(): Agent[] {
    return (getDb().prepare("SELECT * FROM agents ORDER BY name").all() as AgentRow[]).map(rowToAgent);
  },
  get(id: string): Agent | null {
    const row = getDb().prepare("SELECT * FROM agents WHERE id = ?").get(id) as AgentRow | undefined;
    return row ? rowToAgent(row) : null;
  },
  upsert(a: Agent) {
    getDb()
      .prepare(
        `INSERT INTO agents (id, name, category, role, description, model, system_prompt, capabilities, tools, tags, temperature, max_tokens, avatar, color, created_at, updated_at)
         VALUES (@id, @name, @category, @role, @description, @model, @system_prompt, @capabilities, @tools, @tags, @temperature, @max_tokens, @avatar, @color, @created_at, @updated_at)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name, category=excluded.category, role=excluded.role, description=excluded.description,
           model=excluded.model, system_prompt=excluded.system_prompt, capabilities=excluded.capabilities,
           tools=excluded.tools, tags=excluded.tags, temperature=excluded.temperature, max_tokens=excluded.max_tokens,
           avatar=excluded.avatar, color=excluded.color, updated_at=excluded.updated_at`,
      )
      .run({
        id: a.id,
        name: a.name,
        category: a.category,
        role: a.role,
        description: a.description,
        model: a.model,
        system_prompt: a.systemPrompt,
        capabilities: JSON.stringify(a.capabilities),
        tools: JSON.stringify(a.tools),
        tags: JSON.stringify(a.tags),
        temperature: a.temperature,
        max_tokens: a.maxTokens,
        avatar: a.avatar,
        color: a.color,
        created_at: a.createdAt,
        updated_at: a.updatedAt,
      });
  },
  remove(id: string) {
    getDb().prepare("DELETE FROM agents WHERE id = ?").run(id);
  },
  count(): number {
    return (getDb().prepare("SELECT COUNT(*) as c FROM agents").get() as { c: number }).c;
  },
};

// --- Workflows ---

interface WorkflowRow {
  id: string;
  name: string;
  description: string;
  nodes: string;
  edges: string;
  shape: string;
  created_at: number;
  updated_at: number;
}

function rowToWorkflow(r: WorkflowRow): Workflow {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    nodes: JSON.parse(r.nodes),
    edges: JSON.parse(r.edges),
    shape: r.shape as Workflow["shape"],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const workflows = {
  list(): Workflow[] {
    return (getDb().prepare("SELECT * FROM workflows ORDER BY updated_at DESC").all() as WorkflowRow[]).map(
      rowToWorkflow,
    );
  },
  get(id: string): Workflow | null {
    const row = getDb().prepare("SELECT * FROM workflows WHERE id = ?").get(id) as WorkflowRow | undefined;
    return row ? rowToWorkflow(row) : null;
  },
  upsert(w: Workflow) {
    getDb()
      .prepare(
        `INSERT INTO workflows (id, name, description, nodes, edges, shape, created_at, updated_at)
         VALUES (@id, @name, @description, @nodes, @edges, @shape, @created_at, @updated_at)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name, description=excluded.description, nodes=excluded.nodes,
           edges=excluded.edges, shape=excluded.shape, updated_at=excluded.updated_at`,
      )
      .run({
        id: w.id,
        name: w.name,
        description: w.description,
        nodes: JSON.stringify(w.nodes),
        edges: JSON.stringify(w.edges),
        shape: w.shape,
        created_at: w.createdAt,
        updated_at: w.updatedAt,
      });
  },
  remove(id: string) {
    getDb().prepare("DELETE FROM workflows WHERE id = ?").run(id);
  },
};

// --- Runs ---

interface RunRow {
  id: string;
  workflow_id: string | null;
  workflow_snapshot: string;
  input: string;
  status: string;
  started_at: number | null;
  completed_at: number | null;
  total_tokens: number;
  created_at: number;
}

function rowToRun(r: RunRow): Run {
  return {
    id: r.id,
    workflowId: r.workflow_id,
    workflowSnapshot: JSON.parse(r.workflow_snapshot),
    input: r.input,
    status: r.status as RunStatus,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    totalTokens: r.total_tokens,
    createdAt: r.created_at,
  };
}

export const runs = {
  list(limit = 50): Run[] {
    return (
      getDb().prepare("SELECT * FROM runs ORDER BY created_at DESC LIMIT ?").all(limit) as RunRow[]
    ).map(rowToRun);
  },
  get(id: string): Run | null {
    const row = getDb().prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunRow | undefined;
    return row ? rowToRun(row) : null;
  },
  create(r: Run) {
    getDb()
      .prepare(
        `INSERT INTO runs (id, workflow_id, workflow_snapshot, input, status, started_at, completed_at, total_tokens, created_at)
         VALUES (@id, @workflow_id, @workflow_snapshot, @input, @status, @started_at, @completed_at, @total_tokens, @created_at)`,
      )
      .run({
        id: r.id,
        workflow_id: r.workflowId,
        workflow_snapshot: JSON.stringify(r.workflowSnapshot),
        input: r.input,
        status: r.status,
        started_at: r.startedAt,
        completed_at: r.completedAt,
        total_tokens: r.totalTokens,
        created_at: r.createdAt,
      });
  },
  updateStatus(id: string, status: RunStatus, fields: Partial<Pick<Run, "startedAt" | "completedAt" | "totalTokens">> = {}) {
    const sets: string[] = ["status = ?"];
    const vals: unknown[] = [status];
    if (fields.startedAt !== undefined) {
      sets.push("started_at = ?");
      vals.push(fields.startedAt);
    }
    if (fields.completedAt !== undefined) {
      sets.push("completed_at = ?");
      vals.push(fields.completedAt);
    }
    if (fields.totalTokens !== undefined) {
      sets.push("total_tokens = ?");
      vals.push(fields.totalTokens);
    }
    vals.push(id);
    getDb().prepare(`UPDATE runs SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  },
  addTokens(id: string, delta: number) {
    getDb().prepare("UPDATE runs SET total_tokens = total_tokens + ? WHERE id = ?").run(delta, id);
  },
};

// --- Executions ---

interface ExecRow {
  id: string;
  run_id: string;
  node_id: string;
  agent_id: string;
  status: string;
  input: string;
  output: string | null;
  error: string | null;
  tokens_in: number;
  tokens_out: number;
  started_at: number | null;
  completed_at: number | null;
  attempt: number;
}

function rowToExec(r: ExecRow): TaskExecution {
  return {
    id: r.id,
    runId: r.run_id,
    nodeId: r.node_id,
    agentId: r.agent_id,
    status: r.status as ExecutionStatus,
    input: r.input,
    output: r.output,
    error: r.error,
    tokensIn: r.tokens_in,
    tokensOut: r.tokens_out,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    attempt: r.attempt,
  };
}

export const executions = {
  listByRun(runId: string): TaskExecution[] {
    return (
      getDb().prepare("SELECT * FROM task_executions WHERE run_id = ? ORDER BY started_at NULLS LAST, id").all(runId) as ExecRow[]
    ).map(rowToExec);
  },
  get(id: string): TaskExecution | null {
    const row = getDb().prepare("SELECT * FROM task_executions WHERE id = ?").get(id) as ExecRow | undefined;
    return row ? rowToExec(row) : null;
  },
  create(e: TaskExecution) {
    getDb()
      .prepare(
        `INSERT INTO task_executions (id, run_id, node_id, agent_id, status, input, output, error, tokens_in, tokens_out, started_at, completed_at, attempt)
         VALUES (@id, @run_id, @node_id, @agent_id, @status, @input, @output, @error, @tokens_in, @tokens_out, @started_at, @completed_at, @attempt)`,
      )
      .run({
        id: e.id,
        run_id: e.runId,
        node_id: e.nodeId,
        agent_id: e.agentId,
        status: e.status,
        input: e.input,
        output: e.output,
        error: e.error,
        tokens_in: e.tokensIn,
        tokens_out: e.tokensOut,
        started_at: e.startedAt,
        completed_at: e.completedAt,
        attempt: e.attempt,
      });
  },
  update(id: string, patch: Partial<TaskExecution>) {
    const map: Record<string, string> = {
      status: "status",
      output: "output",
      error: "error",
      tokensIn: "tokens_in",
      tokensOut: "tokens_out",
      startedAt: "started_at",
      completedAt: "completed_at",
      attempt: "attempt",
    };
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (map[k]) {
        sets.push(`${map[k]} = ?`);
        vals.push(v as unknown);
      }
    }
    if (!sets.length) return;
    vals.push(id);
    getDb().prepare(`UPDATE task_executions SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  },
};

// --- Events ---

interface EventRow {
  id: number;
  run_id: string;
  execution_id: string | null;
  type: string;
  payload: string;
  timestamp: number;
}

function rowToEvent(r: EventRow): OrchestrationEvent {
  return {
    id: r.id,
    runId: r.run_id,
    executionId: r.execution_id,
    type: r.type as EventType,
    payload: JSON.parse(r.payload),
    timestamp: r.timestamp,
  };
}

export const events = {
  append(runId: string, type: EventType, payload: Record<string, unknown>, executionId: string | null = null) {
    const result = getDb()
      .prepare(
        `INSERT INTO events (run_id, execution_id, type, payload, timestamp) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(runId, executionId, type, JSON.stringify(payload), Date.now());
    return Number(result.lastInsertRowid);
  },
  listByRun(runId: string, sinceId = 0): OrchestrationEvent[] {
    return (
      getDb()
        .prepare("SELECT * FROM events WHERE run_id = ? AND id > ? ORDER BY id ASC")
        .all(runId, sinceId) as EventRow[]
    ).map(rowToEvent);
  },
};
