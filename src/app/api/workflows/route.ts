import { NextResponse } from "next/server";
import { workflows } from "@/lib/db/repos";
import { nanoid } from "nanoid";
import type { Workflow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ workflows: workflows.list() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Workflow>;
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const now = Date.now();
  const w: Workflow = {
    id: body.id ?? `wf_${nanoid(8)}`,
    name: body.name,
    description: body.description ?? "",
    nodes: body.nodes ?? [],
    edges: body.edges ?? [],
    shape: body.shape ?? "dag",
    createdAt: now,
    updatedAt: now,
  };
  workflows.upsert(w);
  return NextResponse.json({ workflow: w }, { status: 201 });
}
