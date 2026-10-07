import { NextResponse } from "next/server";
import { agents } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = agents.get(id);
  if (!a) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ agent: a });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = agents.get(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  const patch = (await req.json()) as Partial<typeof existing>;
  const merged = { ...existing, ...patch, id: existing.id, updatedAt: Date.now() };
  agents.upsert(merged);
  return NextResponse.json({ agent: merged });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  agents.remove(id);
  return NextResponse.json({ ok: true });
}
