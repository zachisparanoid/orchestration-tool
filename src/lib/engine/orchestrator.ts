/**
 * Workflow orchestrator. Executes a DAG of agent tasks using topological
 * levels — nodes with no remaining dependencies run in parallel (capped by a
 * semaphore), then their successors unblock.
 *
 * The orchestrator is fire-and-forget from the API route's perspective: the
 * route creates the run row, kicks off `executeRun(runId)` without awaiting,
 * and returns immediately. Clients tail progress via the events SSE stream.
 */
import { nanoid } from "nanoid";
import { agents, runs, executions, events, workflows } from "../db/repos";
import { Semaphore } from "./semaphore";
import { runAgent } from "./agent-runtime";
import type { Run, Workflow, WorkflowNode, TaskExecution } from "../types";

const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY ?? "12");
const sem = new Semaphore(MAX_CONCURRENCY);

const liveRuns = new Map<string, AbortController>();

export function isRunLive(runId: string): boolean {
  return liveRuns.has(runId);
}

export function cancelRun(runId: string): boolean {
  const ctrl = liveRuns.get(runId);
  if (!ctrl) return false;
  ctrl.abort();
  return true;
}

export function createRun(input: {
  workflowId?: string;
  workflowSnapshot?: Workflow;
  input: string;
}): Run {
  let snapshot = input.workflowSnapshot;
  if (!snapshot && input.workflowId) {
    const w = workflows.get(input.workflowId);
    if (!w) throw new Error(`workflow not found: ${input.workflowId}`);
    snapshot = w;
  }
  if (!snapshot) throw new Error("workflowSnapshot or workflowId required");

  const run: Run = {
    id: nanoid(10),
    workflowId: input.workflowId ?? null,
    workflowSnapshot: snapshot,
    input: input.input,
    status: "queued",
    startedAt: null,
    completedAt: null,
    totalTokens: 0,
    createdAt: Date.now(),
  };
  runs.create(run);
  events.append(run.id, "run.queued", { workflow: snapshot.name, input: input.input });
  return run;
}

export async function executeRun(runId: string): Promise<void> {
  const run = runs.get(runId);
  if (!run) throw new Error(`run not found: ${runId}`);
  const wf = run.workflowSnapshot;

  // Build dependency map: nodeId -> set of upstream nodeIds.
  const depMap = new Map<string, Set<string>>();
  for (const n of wf.nodes) depMap.set(n.id, new Set());
  for (const e of wf.edges) {
    if (!depMap.has(e.to)) depMap.set(e.to, new Set());
    depMap.get(e.to)!.add(e.from);
  }

  // Pre-create execution rows so the UI can render the planned graph immediately.
  const execByNode = new Map<string, TaskExecution>();
  for (const node of wf.nodes) {
    const e: TaskExecution = {
      id: nanoid(10),
      runId,
      nodeId: node.id,
      agentId: node.agentId,
      status: "pending",
      input: "",
      output: null,
      error: null,
      tokensIn: 0,
      tokensOut: 0,
      startedAt: null,
      completedAt: null,
      attempt: 1,
    };
    executions.create(e);
    execByNode.set(node.id, e);
    events.append(runId, "task.pending", { nodeId: node.id, agentId: node.agentId, label: node.label }, e.id);
  }

  const ctrl = new AbortController();
  liveRuns.set(runId, ctrl);
  runs.updateStatus(runId, "running", { startedAt: Date.now() });
  events.append(runId, "run.started", {});

  const outputsByNode = new Map<string, string>();
  const failed = new Set<string>();
  let anyFailed = false;

  try {
    // Iterate topological levels until all nodes are settled.
    while (depMap.size > 0) {
      const ready: WorkflowNode[] = [];
      for (const node of wf.nodes) {
        if (!depMap.has(node.id)) continue;
        const deps = depMap.get(node.id)!;
        if (deps.size === 0) ready.push(node);
      }
      if (ready.length === 0) {
        // Cycle or all remaining nodes blocked by failed upstream. Skip them.
        for (const node of wf.nodes) {
          if (depMap.has(node.id)) {
            const ex = execByNode.get(node.id)!;
            executions.update(ex.id, { status: "skipped", completedAt: Date.now() });
            events.append(runId, "task.failed", { nodeId: node.id, reason: "upstream failed or cycle" }, ex.id);
            depMap.delete(node.id);
          }
        }
        break;
      }

      await Promise.all(
        ready.map(async (node) => {
          // Remove from pending map up front so we don't re-pick it.
          depMap.delete(node.id);
          if (ctrl.signal.aborted) return;

          // If any dependency failed, skip this node.
          const upstreamFailed = node.inputsFrom.some((id) => failed.has(id));
          const ex = execByNode.get(node.id)!;
          if (upstreamFailed) {
            executions.update(ex.id, { status: "skipped", completedAt: Date.now() });
            events.append(runId, "task.failed", { nodeId: node.id, reason: "upstream failed" }, ex.id);
            failed.add(node.id);
            anyFailed = true;
            return;
          }

          const release = await sem.acquire();
          try {
            await runSingleNode(run, node, outputsByNode, ex);
            // Successor unblock
            for (const e of wf.edges) {
              if (e.from === node.id && depMap.has(e.to)) {
                depMap.get(e.to)!.delete(node.id);
              }
            }
          } catch (err) {
            failed.add(node.id);
            anyFailed = true;
            const msg = err instanceof Error ? err.message : String(err);
            executions.update(ex.id, { status: "failed", error: msg, completedAt: Date.now() });
            events.append(runId, "task.failed", { nodeId: node.id, error: msg }, ex.id);
            // Don't propagate edges from a failed node — successors will be skipped on next loop iter.
            for (const e of wf.edges) {
              if (e.from === node.id && depMap.has(e.to)) {
                depMap.get(e.to)!.delete(node.id);
              }
            }
          } finally {
            release();
          }
        }),
      );

      if (ctrl.signal.aborted) {
        runs.updateStatus(runId, "cancelled", { completedAt: Date.now() });
        events.append(runId, "run.cancelled", {});
        return;
      }
    }

    runs.updateStatus(runId, anyFailed ? "failed" : "completed", { completedAt: Date.now() });
    events.append(runId, anyFailed ? "run.failed" : "run.completed", {});
  } finally {
    liveRuns.delete(runId);
  }
}

async function runSingleNode(
  run: Run,
  node: WorkflowNode,
  outputsByNode: Map<string, string>,
  exec: TaskExecution,
): Promise<void> {
  const agent = agents.get(node.agentId);
  if (!agent) throw new Error(`agent not found: ${node.agentId}`);

  const userMsg = renderPrompt(node.prompt, run.input, outputsByNode);
  executions.update(exec.id, {
    status: "running",
    input: userMsg,
    startedAt: Date.now(),
  });
  events.append(run.id, "task.started", { nodeId: node.id, agentId: agent.id, label: node.label }, exec.id);

  let buffer = "";
  let tokensIn = 0;
  let tokensOut = 0;

  for await (const delta of runAgent(agent, userMsg)) {
    if (delta.type === "text" && delta.text) {
      buffer += delta.text;
      events.append(run.id, "task.delta", { nodeId: node.id, text: delta.text }, exec.id);
    } else if (delta.type === "done") {
      tokensIn = delta.tokensIn ?? 0;
      tokensOut = delta.tokensOut ?? 0;
    }
  }

  executions.update(exec.id, {
    status: "completed",
    output: buffer,
    tokensIn,
    tokensOut,
    completedAt: Date.now(),
  });
  runs.addTokens(run.id, tokensIn + tokensOut);
  outputsByNode.set(node.id, buffer);
  events.append(
    run.id,
    "task.completed",
    {
      nodeId: node.id,
      tokensIn,
      tokensOut,
      preview: buffer.slice(0, 280),
    },
    exec.id,
  );
}

function renderPrompt(template: string, runInput: string, outputs: Map<string, string>): string {
  let out = template.replaceAll("{{input}}", runInput);
  out = out.replace(/\{\{node:([a-zA-Z0-9_-]+)\}\}/g, (_, id) => outputs.get(id) ?? "");
  return out;
}
