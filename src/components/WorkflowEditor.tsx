"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { Save, Play, Plus, Trash2, ArrowRight, Loader2 } from "lucide-react";
import type { Workflow, WorkflowNode, WorkflowEdge, Agent } from "@/lib/types";
import { DagPreview } from "./DagPreview";

type Mode = "create" | "edit";

const EMPTY: Workflow = {
  id: "",
  name: "Untitled workflow",
  description: "",
  shape: "dag",
  nodes: [],
  edges: [],
  createdAt: 0,
  updatedAt: 0,
};

export function WorkflowEditor({ mode, workflow, agents }: { mode: Mode; workflow?: Workflow; agents: Agent[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Workflow>(workflow ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [runInput, setRunInput] = useState("");
  const [running, setRunning] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [agentSearch, setAgentSearch] = useState("");

  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const selectedNode = draft.nodes.find((n) => n.id === selectedNodeId) ?? null;

  function addNode(agent: Agent) {
    const id = `n_${nanoid(5)}`;
    const node: WorkflowNode = {
      id,
      agentId: agent.id,
      label: agent.name,
      prompt: "{{input}}",
      inputsFrom: [],
    };
    setDraft({ ...draft, nodes: [...draft.nodes, node] });
    setSelectedNodeId(id);
  }
  function removeNode(id: string) {
    setDraft({
      ...draft,
      nodes: draft.nodes.filter((n) => n.id !== id),
      edges: draft.edges.filter((e) => e.from !== id && e.to !== id),
    });
    if (selectedNodeId === id) setSelectedNodeId(null);
  }
  function updateNode(id: string, patch: Partial<WorkflowNode>) {
    setDraft({
      ...draft,
      nodes: draft.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    });
  }
  function toggleEdge(from: string, to: string) {
    if (from === to) return;
    const exists = draft.edges.some((e) => e.from === from && e.to === to);
    let nextEdges: WorkflowEdge[];
    let nextNodes = draft.nodes;
    if (exists) {
      nextEdges = draft.edges.filter((e) => !(e.from === from && e.to === to));
      nextNodes = draft.nodes.map((n) => (n.id === to ? { ...n, inputsFrom: n.inputsFrom.filter((x) => x !== from) } : n));
    } else {
      // Prevent simple cycle: don't allow if `to` already reaches `from`.
      if (reaches(draft.edges, to, from)) return;
      nextEdges = [...draft.edges, { from, to }];
      nextNodes = draft.nodes.map((n) =>
        n.id === to && !n.inputsFrom.includes(from) ? { ...n, inputsFrom: [...n.inputsFrom, from] } : n,
      );
    }
    setDraft({ ...draft, nodes: nextNodes, edges: nextEdges });
  }

  async function save(): Promise<Workflow | null> {
    setSaving(true);
    try {
      if (mode === "create") {
        const r = await fetch("/api/workflows", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        });
        const j = await r.json();
        if (j.workflow) {
          router.replace(`/workflows/${j.workflow.id}`);
          return j.workflow;
        }
      } else {
        const r = await fetch(`/api/workflows/${draft.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        });
        const j = await r.json();
        router.refresh();
        return j.workflow;
      }
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    if (!runInput.trim()) return;
    setRunning(true);
    const saved = mode === "create" ? await save() : draft;
    if (!saved?.id) { setRunning(false); return; }
    const r = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflowId: saved.id, input: runInput }),
    });
    const j = await r.json();
    setRunning(false);
    if (j.run) router.push(`/runs/${j.run.id}`);
  }

  const filteredAgents = agents.filter((a) => {
    const q = agentSearch.toLowerCase();
    if (!q) return true;
    return a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q) || a.category.includes(q);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 space-y-1">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="input bg-transparent text-lg font-semibold"
          />
          <input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className="input bg-transparent text-sm text-text-secondary"
            placeholder="What does this workflow do?"
          />
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={() => save()} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <div className="border-b border-border-subtle p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Agents</div>
            <input
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              placeholder="Search agents…"
              className="input"
            />
          </div>
          <div className="max-h-[480px] space-y-0.5 overflow-y-auto p-2">
            {filteredAgents.map((a) => (
              <button
                key={a.id}
                onClick={() => addNode(a)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-bg-elevated"
              >
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-sm"
                  style={{ background: a.color + "22", border: `1px solid ${a.color}44` }}
                >
                  {a.avatar}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-text-primary">{a.name}</div>
                  <div className="truncate text-text-muted">{a.role}</div>
                </div>
                <Plus className="h-3 w-3 text-text-muted" />
              </button>
            ))}
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="border-b border-border-subtle p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Graph</div>
              <div className="text-xs text-text-muted">
                {draft.nodes.length} nodes · {draft.edges.length} edges
              </div>
            </div>
          </div>
          <DagPreview workflow={draft} agentById={agentById} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
        </div>
      </div>

      {selectedNode && (
        <NodeInspector
          node={selectedNode}
          nodes={draft.nodes}
          edges={draft.edges}
          agent={agentById.get(selectedNode.agentId)}
          onChange={(patch) => updateNode(selectedNode.id, patch)}
          onRemove={() => removeNode(selectedNode.id)}
          onToggleEdge={toggleEdge}
        />
      )}

      <div className="card p-4">
        <h2 className="text-sm font-semibold">Run this workflow</h2>
        <p className="mt-0.5 text-xs text-text-muted">
          The input becomes <code className="kbd">{`{{input}}`}</code> in each node prompt. Upstream node outputs are available as
          <code className="kbd">{`{{node:<id>}}`}</code>.
        </p>
        <textarea
          value={runInput}
          onChange={(e) => setRunInput(e.target.value)}
          placeholder="Enter the input that will be sent to the workflow…"
          className="input mt-2 min-h-[80px]"
        />
        <div className="mt-2 flex justify-end">
          <button onClick={runNow} disabled={running || draft.nodes.length === 0} className="btn-primary">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Run
          </button>
        </div>
      </div>
    </div>
  );
}

function NodeInspector({
  node,
  nodes,
  edges,
  agent,
  onChange,
  onRemove,
  onToggleEdge,
}: {
  node: WorkflowNode;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  agent?: Agent;
  onChange: (patch: Partial<WorkflowNode>) => void;
  onRemove: () => void;
  onToggleEdge: (from: string, to: string) => void;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {agent && (
            <span className="grid h-9 w-9 place-items-center rounded text-lg" style={{ background: agent.color + "22", border: `1px solid ${agent.color}44` }}>
              {agent.avatar}
            </span>
          )}
          <div>
            <div className="text-sm font-semibold">{agent?.name ?? node.agentId}</div>
            <div className="text-xs text-text-muted">node id: <span className="font-mono">{node.id}</span></div>
          </div>
        </div>
        <button onClick={onRemove} className="btn-ghost text-status-error"><Trash2 className="h-4 w-4" />Remove</button>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Node label</span>
        <input value={node.label} onChange={(e) => onChange({ label: e.target.value })} className="input" />
      </label>

      <label className="mt-2 block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Prompt template</span>
        <textarea
          value={node.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          className="input min-h-[140px] font-mono text-xs"
        />
      </label>

      <div className="mt-3">
        <span className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Incoming edges</span>
        <div className="flex flex-wrap gap-1.5">
          {nodes.filter((n) => n.id !== node.id).map((src) => {
            const linked = edges.some((e) => e.from === src.id && e.to === node.id);
            return (
              <button
                key={src.id}
                onClick={() => onToggleEdge(src.id, node.id)}
                className={`badge ${linked ? "border-accent bg-accent-subtle text-text-primary" : "border-border-subtle text-text-muted hover:border-border"}`}
              >
                <ArrowRight className="h-3 w-3" />{src.label}
              </button>
            );
          })}
          {nodes.length <= 1 && <span className="text-xs text-text-muted">Add another node to wire edges.</span>}
        </div>
      </div>
    </div>
  );
}

function reaches(edges: WorkflowEdge[], start: string, target: string): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  const stack = [start];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const v of adj.get(id) ?? []) stack.push(v);
  }
  return false;
}
