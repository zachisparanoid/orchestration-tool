/**
 * Quick-run endpoint: create a one-shot ad-hoc workflow from a list of
 * agentIds and a prompt, then execute it. Useful for "send this prompt to
 * a hand-picked panel of agents" without saving a workflow.
 */
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createRun, executeRun } from "@/lib/engine/orchestrator";
import type { Workflow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    input: string;
    agentIds: string[];
    shape?: "parallel" | "pipeline";
  };
  if (!body.input || !body.agentIds?.length) {
    return NextResponse.json({ error: "input and agentIds required" }, { status: 400 });
  }
  const shape = body.shape ?? "parallel";
  const now = Date.now();

  const wf: Workflow = {
    id: `wf_adhoc_${nanoid(6)}`,
    name: `Ad-hoc (${body.agentIds.length} agents, ${shape})`,
    description: "Quick-run panel",
    shape,
    nodes: body.agentIds.map((agentId, i) => ({
      id: `n${i}`,
      agentId,
      label: `Agent ${i + 1}`,
      prompt: shape === "pipeline" && i > 0
        ? `Continue the work on: {{input}}\n\n## Prior output\n{{node:n${i - 1}}}`
        : `{{input}}`,
      inputsFrom: shape === "pipeline" && i > 0 ? [`n${i - 1}`] : [],
    })),
    edges: shape === "pipeline"
      ? body.agentIds.slice(1).map((_, i) => ({ from: `n${i}`, to: `n${i + 1}` }))
      : [],
    createdAt: now,
    updatedAt: now,
  };

  const run = createRun({ workflowSnapshot: wf, input: body.input });
  executeRun(run.id).catch((err) => console.error("ad-hoc run failed", run.id, err));
  return NextResponse.json({ run }, { status: 201 });
}
