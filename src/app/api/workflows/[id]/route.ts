import { NextResponse } from "next/server";
import { workflows } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = workflows.get(id);
  if (!w) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ workflow: w });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = workflows.get(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  const patch = (await req.json()) as Partial<typeof existing>;
  const merged = { ...existing, ...patch, id: existing.id, updatedAt: Date.now() };
  workflows.upsert(merged);
  return NextResponse.json({ workflow: merged });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  workflows.remove(id);
  return NextResponse.json({ ok: true });
}
