// Shared types for the orchestration system.

export type AgentCategory =
  | "research"
  | "engineering"
  | "data"
  | "content"
  | "design"
  | "marketing"
  | "operations"
  | "security"
  | "qa"
  | "analysis"
  | "product"
  | "support"
  | "finance"
  | "legal"
  | "education"
  | "creative";

export interface Agent {
  id: string;
  name: string;
  category: AgentCategory;
  role: string;
  description: string;
  model: string;
  systemPrompt: string;
  capabilities: string[];
  tools: string[];
  tags: string[];
  temperature: number;
  maxTokens: number;
  avatar: string;
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowNode {
  id: string;
  agentId: string;
  label: string;
  // The prompt template; `{{input}}` is the run input, `{{node:<id>}}` references upstream outputs.
  prompt: string;
  // Node IDs whose outputs should be concatenated into context.
  inputsFrom: string[];
}

export interface WorkflowEdge {
  from: string;
  to: string;
}

export type WorkflowShape = "pipeline" | "parallel" | "fanout" | "dag";

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  shape: WorkflowShape;
  createdAt: number;
  updatedAt: number;
}

export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface Run {
  id: string;
  workflowId: string | null;
  workflowSnapshot: Workflow;
  input: string;
  status: RunStatus;
  startedAt: number | null;
  completedAt: number | null;
  totalTokens: number;
  createdAt: number;
}

export type ExecutionStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface TaskExecution {
  id: string;
  runId: string;
  nodeId: string;
  agentId: string;
  status: ExecutionStatus;
  input: string;
  output: string | null;
  error: string | null;
  tokensIn: number;
  tokensOut: number;
  startedAt: number | null;
  completedAt: number | null;
  attempt: number;
}

export type EventType =
  | "run.queued"
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "run.cancelled"
  | "task.pending"
  | "task.started"
  | "task.delta"
  | "task.completed"
  | "task.failed"
  | "log";

export interface OrchestrationEvent {
  id: number;
  runId: string;
  executionId: string | null;
  type: EventType;
  payload: Record<string, unknown>;
  timestamp: number;
}
