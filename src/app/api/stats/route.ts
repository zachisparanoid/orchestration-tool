import { NextResponse } from "next/server";
import { agents, runs } from "@/lib/db/repos";
import { getRuntimeMode } from "@/lib/engine/agent-runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const all = agents.list();
  const byCategory: Record<string, number> = {};
  for (const a of all) byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
  const recent = runs.list(20);
  const active = recent.filter((r) => r.status === "running" || r.status === "queued").length;
  const completed = recent.filter((r) => r.status === "completed").length;
  const failed = recent.filter((r) => r.status === "failed").length;
  const runtimeMode = await getRuntimeMode();
  return NextResponse.json({
    agents: all.length,
    byCategory,
    recentRuns: recent.length,
    active,
    completed,
    failed,
    runtimeMode,
  });
}
