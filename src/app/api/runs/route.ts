import { NextResponse } from "next/server";
import { runs } from "@/lib/db/repos";
import { createRun, executeRun } from "@/lib/engine/orchestrator";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ runs: runs.list(100) });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { workflowId?: string; input?: string };
  if (!body.workflowId || !body.input) {
    return NextResponse.json({ error: "workflowId and input required" }, { status: 400 });
  }
  try {
    const run = createRun({ workflowId: body.workflowId, input: body.input });
    // Fire-and-forget execution. Errors are recorded into the events table.
    executeRun(run.id).catch((err) => {
      console.error("run failed", run.id, err);
    });
    return NextResponse.json({ run }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
