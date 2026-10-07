import { NextResponse } from "next/server";
import { agents } from "@/lib/db/repos";
import { nanoid } from "nanoid";
import type { Agent } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ agents: agents.list() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Agent>;
  if (!body.name || !body.category || !body.role) {
    return NextResponse.json({ error: "name, category, role required" }, { status: 400 });
  }
  const now = Date.now();
  const a: Agent = {
    id: `agent_${nanoid(8)}`,
    name: body.name,
    category: body.category,
    role: body.role,
    description: body.description ?? "",
    model: body.model ?? process.env.DEFAULT_MODEL ?? "claude-sonnet-4-6",
    systemPrompt: body.systemPrompt ?? `You are a ${body.role}.`,
    capabilities: body.capabilities ?? [],
    tools: body.tools ?? [],
    tags: body.tags ?? [],
    temperature: body.temperature ?? 0.7,
    maxTokens: body.maxTokens ?? 2048,
    avatar: body.avatar ?? "🤖",
    color: body.color ?? "#7c5cff",
    createdAt: now,
    updatedAt: now,
  };
  agents.upsert(a);
  return NextResponse.json({ agent: a }, { status: 201 });
}
