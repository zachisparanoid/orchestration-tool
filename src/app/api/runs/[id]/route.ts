import { NextResponse } from "next/server";
import { runs, executions } from "@/lib/db/repos";
import { cancelRun } from "@/lib/engine/orchestrator";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = runs.get(id);
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  const exec = executions.listByRun(id);
  return NextResponse.json({ run: r, executions: exec });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cancelled = cancelRun(id);
  return NextResponse.json({ cancelled });
}
