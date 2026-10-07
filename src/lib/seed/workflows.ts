/**
 * Starter workflow templates. They look up agent IDs by name slug at build
 * time so the workflows survive any reordering of the agent seed list.
 */
import type { Workflow } from "../types";
import { buildSeedAgents } from "./agents";

const all = buildSeedAgents();

function findAgentId(name: string): string {
  const a = all.find((x) => x.name === name);
  if (!a) throw new Error(`seed workflow references unknown agent name: ${name}`);
  return a.id;
}

const now = Date.now();

function n(id: string, agentName: string, label: string, prompt: string, inputsFrom: string[] = []) {
  return { id, agentId: findAgentId(agentName), label, prompt, inputsFrom };
}

export const seedWorkflows: Workflow[] = [
  {
    id: "wf_research_brief",
    name: "Research Brief",
    description: "Three researchers in parallel + synthesist. Good for fast topic intake.",
    shape: "fanout",
    nodes: [
      n("scout", "Literature Scout", "Literature scan",
        "Survey the existing literature for: {{input}}\nReturn 5 key sources with one-line summaries."),
      n("market", "Market Analyst", "Market landscape",
        "Sketch the market and competitive landscape for: {{input}}"),
      n("trends", "Trend Forecaster", "Weak signals",
        "Identify 3 weak signals and 2 contrarian takes on: {{input}}"),
      n("synth", "Strategy Consultant", "Synthesis",
        "Synthesize these three research streams into a one-page brief for an executive audience.\n\n## Literature\n{{node:scout}}\n\n## Market\n{{node:market}}\n\n## Trends\n{{node:trends}}",
        ["scout", "market", "trends"]),
    ],
    edges: [
      { from: "scout", to: "synth" },
      { from: "market", to: "synth" },
      { from: "trends", to: "synth" },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "wf_feature_kickoff",
    name: "Feature Kickoff",
    description: "PM spec → engineering plan → QA plan → risk review (pipeline).",
    shape: "pipeline",
    nodes: [
      n("pm", "Product Manager", "PM spec",
        "Draft a one-page PRD for this feature request:\n{{input}}"),
      n("eng", "Systems Architect", "Engineering plan",
        "Given this PRD, propose an implementation plan with milestones:\n\n{{node:pm}}",
        ["pm"]),
      n("qa", "QA Engineer", "QA plan",
        "Outline a test plan including risk areas, given the spec and engineering plan:\n\n## Spec\n{{node:pm}}\n\n## Plan\n{{node:eng}}",
        ["pm", "eng"]),
      n("risk", "Risk Analyst", "Risk review",
        "Identify the top 5 risks across product, engineering, and quality:\n\n## PRD\n{{node:pm}}\n\n## Engineering\n{{node:eng}}\n\n## QA\n{{node:qa}}",
        ["pm", "eng", "qa"]),
    ],
    edges: [
      { from: "pm", to: "eng" },
      { from: "eng", to: "qa" },
      { from: "qa", to: "risk" },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "wf_content_pipeline",
    name: "Content Pipeline",
    description: "Outline → draft → SEO + editor in parallel → final.",
    shape: "dag",
    nodes: [
      n("outline", "Blog Editor", "Outline",
        "Outline a long-form post on: {{input}}"),
      n("draft", "Technical Writer", "First draft",
        "Write a first draft following this outline:\n\n{{node:outline}}",
        ["outline"]),
      n("seo", "SEO Specialist", "SEO pass",
        "Apply on-page SEO suggestions to this draft, returning a marked-up version:\n\n{{node:draft}}",
        ["draft"]),
      n("edit", "Blog Editor", "Editorial pass",
        "Tighten the draft for clarity and pace:\n\n{{node:draft}}",
        ["draft"]),
      n("final", "Copywriter", "Final polish",
        "Merge the editorial and SEO passes into a final version, prioritizing voice and clarity:\n\n## Editorial\n{{node:edit}}\n\n## SEO\n{{node:seo}}",
        ["edit", "seo"]),
    ],
    edges: [
      { from: "outline", to: "draft" },
      { from: "draft", to: "seo" },
      { from: "draft", to: "edit" },
      { from: "edit", to: "final" },
      { from: "seo", to: "final" },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "wf_critique_panel",
    name: "Critique Panel",
    description: "Four critics review the same artifact in parallel.",
    shape: "parallel",
    nodes: [
      n("critic1", "Critic", "General critique",
        "Critique constructively: {{input}}"),
      n("critic2", "Risk Analyst", "Risk lens",
        "Identify the top risks in: {{input}}"),
      n("critic3", "Accessibility Specialist", "A11y lens",
        "Audit for accessibility concerns: {{input}}"),
      n("critic4", "Interaction Designer", "Interaction lens",
        "Evaluate the interaction design choices in: {{input}}"),
    ],
    edges: [],
    createdAt: now,
    updatedAt: now,
  },
];
