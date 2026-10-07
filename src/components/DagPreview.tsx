"use client";

/**
 * Lightweight SVG DAG renderer. Groups nodes into topological levels (left to
 * right), draws straight bezier-ish edges between levels. Used in the workflow
 * list, editor, and run monitor — same primitive, different data.
 */
import type { Workflow, Agent, TaskExecution } from "@/lib/types";

type NodeStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "idle";

interface Props {
  workflow: Workflow;
  agentById: Map<string, Agent>;
  statusByNode?: Map<string, NodeStatus>;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  compact?: boolean;
}

const NODE_W = 180;
const NODE_H = 56;
const COL_GAP = 50;
const ROW_GAP = 16;

export function DagPreview({ workflow, agentById, statusByNode, selectedNodeId, onSelectNode, compact }: Props) {
  const levels = topoLevels(workflow);

  const cols = levels.length;
  const rows = Math.max(1, ...levels.map((l) => l.length));
  const w = cols * NODE_W + Math.max(0, cols - 1) * COL_GAP + 32;
  const h = rows * NODE_H + Math.max(0, rows - 1) * ROW_GAP + 32;

  // Compute per-node coordinates.
  const pos = new Map<string, { x: number; y: number }>();
  levels.forEach((level, col) => {
    const colHeight = level.length * NODE_H + (level.length - 1) * ROW_GAP;
    const yOffset = (h - colHeight) / 2;
    level.forEach((nodeId, row) => {
      const x = 16 + col * (NODE_W + COL_GAP);
      const y = yOffset + row * (NODE_H + ROW_GAP);
      pos.set(nodeId, { x, y });
    });
  });

  if (workflow.nodes.length === 0) {
    return (
      <div className="grid h-32 place-items-center text-xs text-text-muted">No nodes yet.</div>
    );
  }

  return (
    <div className="overflow-x-auto p-3">
      <svg width={w} height={h} className="block">
        {/* Edges */}
        {workflow.edges.map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          const x1 = a.x + NODE_W;
          const y1 = a.y + NODE_H / 2;
          const x2 = b.x;
          const y2 = b.y + NODE_H / 2;
          const cx = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="#3a3a46"
              strokeWidth="1.5"
              markerEnd="url(#arrow)"
            />
          );
        })}
        <defs>
          <marker id="arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#5a5a66" />
          </marker>
        </defs>
        {/* Nodes */}
        {workflow.nodes.map((node) => {
          const p = pos.get(node.id)!;
          const agent = agentById.get(node.agentId);
          const status = statusByNode?.get(node.id) ?? "idle";
          const stroke = statusStroke(status);
          const ring = selectedNodeId === node.id ? "#7c5cff" : stroke;
          const fill = agent?.color ?? "#7c5cff";
          return (
            <g
              key={node.id}
              transform={`translate(${p.x}, ${p.y})`}
              className={onSelectNode ? "cursor-pointer" : ""}
              onClick={() => onSelectNode?.(node.id === selectedNodeId ? null : node.id)}
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill="#17171c"
                stroke={ring}
                strokeWidth={selectedNodeId === node.id ? 2 : 1}
              />
              <rect x={0} y={0} width={4} height={NODE_H} fill={fill} rx={2} />
              <text x={14} y={20} fontSize="11" fontWeight={600} fill="#e8e8ea">
                {clip(node.label || agent?.name || node.id, 26)}
              </text>
              <text x={14} y={36} fontSize="10" fill="#a0a0aa">
                {agent ? clip(agent.role, 28) : node.agentId}
              </text>
              <circle cx={NODE_W - 12} cy={14} r={4} fill={stroke}>
                {status === "running" && <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />}
              </circle>
              <text x={NODE_W - 22} y={44} textAnchor="end" fontSize="9" fill="#6c6c78">
                {status}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function statusStroke(s: NodeStatus): string {
  switch (s) {
    case "running":   return "#f5a623";
    case "completed": return "#34c759";
    case "failed":    return "#ff4d6d";
    case "pending":   return "#3aa6ff";
    case "skipped":   return "#6c6c78";
    default:          return "#2e2e38";
  }
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function topoLevels(wf: Workflow): string[][] {
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of wf.nodes) {
    inDeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of wf.edges) {
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
    adj.get(e.from)?.push(e.to);
  }
  const levels: string[][] = [];
  let frontier = wf.nodes.filter((n) => (inDeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const seen = new Set<string>();
  while (frontier.length) {
    levels.push(frontier);
    for (const id of frontier) seen.add(id);
    const next: string[] = [];
    for (const id of frontier) {
      for (const v of adj.get(id) ?? []) {
        inDeg.set(v, (inDeg.get(v) ?? 0) - 1);
        if ((inDeg.get(v) ?? 0) === 0 && !seen.has(v)) next.push(v);
      }
    }
    frontier = next;
  }
  // Catch any orphans (e.g., cycles).
  const orphans = wf.nodes.filter((n) => !seen.has(n.id)).map((n) => n.id);
  if (orphans.length) levels.push(orphans);
  return levels;
}

export function buildStatusMap(executions: TaskExecution[] | undefined): Map<string, NodeStatus> {
  const m = new Map<string, NodeStatus>();
  if (!executions) return m;
  for (const e of executions) m.set(e.nodeId, e.status as NodeStatus);
  return m;
}
