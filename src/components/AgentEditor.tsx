"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, Play, Loader2 } from "lucide-react";
import type { Agent } from "@/lib/types";

export function AgentEditor({ agent }: { agent: Agent }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Agent>(agent);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPrompt, setTestPrompt] = useState("Tell me how you'd approach a new task in your role.");
  const [testOutput, setTestOutput] = useState<string>("");

  async function save() {
    setSaving(true);
    await fetch(`/api/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    setSaving(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete agent "${draft.name}"?`)) return;
    await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
    router.push("/agents");
  }

  async function testRun() {
    setTesting(true);
    setTestOutput("");
    const r = await fetch("/api/quick-run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: testPrompt, agentIds: [agent.id], shape: "parallel" }),
    });
    const j = await r.json();
    if (!j.run) {
      setTesting(false);
      setTestOutput(`error: ${j.error ?? "unknown"}`);
      return;
    }
    const es = new EventSource(`/api/runs/${j.run.id}/stream`);
    let buffer = "";
    es.addEventListener("task.delta", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data);
      buffer += data.payload.text ?? "";
      setTestOutput(buffer);
    });
    es.addEventListener("end", () => { es.close(); setTesting(false); });
    es.onerror = () => { es.close(); setTesting(false); };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div
          className="grid h-14 w-14 place-items-center rounded-lg text-2xl"
          style={{ background: draft.color + "22", border: `1px solid ${draft.color}44` }}
        >
          {draft.avatar}
        </div>
        <div className="flex-1">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="input bg-transparent text-lg font-semibold"
          />
          <input
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            className="input mt-2 bg-transparent text-sm text-text-secondary"
          />
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save
          </button>
          <button onClick={remove} className="btn-ghost text-status-error hover:bg-status-error/10">
            <Trash2 className="h-4 w-4" />Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Category">
          <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Agent["category"] })} className="input" />
        </Field>
        <Field label="Model">
          <input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} className="input" />
        </Field>
        <Field label="Temperature">
          <input
            type="number" step="0.05" min="0" max="2"
            value={draft.temperature}
            onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })}
            className="input"
          />
        </Field>
        <Field label="Max tokens">
          <input
            type="number" step="64" min="64"
            value={draft.maxTokens}
            onChange={(e) => setDraft({ ...draft, maxTokens: Number(e.target.value) })}
            className="input"
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className="input min-h-[64px]"
        />
      </Field>

      <Field label="System prompt">
        <textarea
          value={draft.systemPrompt}
          onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
          className="input min-h-[180px] font-mono text-xs"
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Capabilities (comma-separated)">
          <input
            value={draft.capabilities.join(", ")}
            onChange={(e) => setDraft({ ...draft, capabilities: splitList(e.target.value) })}
            className="input"
          />
        </Field>
        <Field label="Tools (comma-separated)">
          <input
            value={draft.tools.join(", ")}
            onChange={(e) => setDraft({ ...draft, tools: splitList(e.target.value) })}
            className="input"
          />
        </Field>
        <Field label="Tags (comma-separated)">
          <input
            value={draft.tags.join(", ")}
            onChange={(e) => setDraft({ ...draft, tags: splitList(e.target.value) })}
            className="input"
          />
        </Field>
      </div>

      <div className="card p-4">
        <h2 className="mb-2 text-sm font-semibold">Test this agent</h2>
        <textarea
          value={testPrompt}
          onChange={(e) => setTestPrompt(e.target.value)}
          className="input min-h-[64px]"
        />
        <div className="mt-2 flex justify-end">
          <button onClick={testRun} disabled={testing} className="btn-secondary">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Run
          </button>
        </div>
        {testOutput && (
          <pre className="mt-3 whitespace-pre-wrap rounded-md border border-border-subtle bg-bg-base p-3 text-xs text-text-secondary">
            {testOutput}
          </pre>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-text-muted">{label}</span>
      {children}
    </label>
  );
}

function splitList(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
