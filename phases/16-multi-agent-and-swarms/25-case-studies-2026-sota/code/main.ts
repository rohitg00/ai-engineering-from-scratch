// Lesson: Case Studies and the 2026 State of the Art (phase 16 / lesson 25)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/25-case-studies-2026-sota/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/25-case-studies-2026-sota/code/main.ts

interface Design {
  name: string;
  taskType: string;
  nAgentsExpected: number;
  verificationRequired: boolean;
  runtimeDurationHours: number;
  rolesDistinct: boolean;
  userFacingNetwork: boolean;
}

function design(
  name: string,
  taskType: string,
  nAgentsExpected: number,
  verificationRequired: boolean,
  runtimeDurationHours: number,
  rolesDistinct: boolean,
  userFacingNetwork: boolean,
): Design {
  return {
    name,
    taskType,
    nAgentsExpected,
    verificationRequired,
    runtimeDurationHours,
    rolesDistinct,
    userFacingNetwork,
  };
}

interface CaseStudy {
  name: string;
  patterns: string[];
  framework: string;
  citation: string;
}

const CASES: Record<string, CaseStudy> = {
  anthropic_research: {
    name: "Anthropic Research (supervisor-worker)",
    patterns: [
      "fresh-context subagents",
      "orchestrator synthesis",
      "rainbow deployment",
      "verification role",
    ],
    framework: "Anthropic Claude Agent SDK or LangGraph",
    citation: "https://www.anthropic.com/engineering/multi-agent-research-system",
  },
  metagpt_chatdev: {
    name: "MetaGPT / ChatDev (SOP role-decomposition)",
    patterns: [
      "role prompts encode SOP",
      "structured artifact handoffs",
      "communicative dehallucination",
      "DAG routing at scale",
    ],
    framework: "CrewAI or MetaGPT reference impl",
    citation: "arXiv:2308.00352 (MetaGPT), arXiv:2307.07924 (ChatDev), arXiv:2406.07155 (MacNet)",
  },
  openclaw_moltbook: {
    name: "OpenClaw / Moltbook (population-scale substrate)",
    patterns: [
      "local ReAct loop",
      "agent-to-agent social graph",
      "emergent economy",
      "prompt-injection threat model",
    ],
    framework: "custom substrate + MCP + A2A",
    citation: "https://en.wikipedia.org/wiki/OpenClaw",
  },
};

const FRAMEWORK_LANDSCAPE: [string, string, string][] = [
  ["LangGraph", "production", "structured graph + checkpointing + HITL"],
  ["CrewAI", "production", "role-based crews; Sequential/Hierarchical"],
  ["AG2", "community maintenance", "GroupChat + speaker selection"],
  ["Microsoft Agent Framework", "RC (Feb 2026)", "orchestration patterns + enterprise"],
  ["OpenAI Agents SDK", "production", "Swarm successor; tool-return handoffs"],
  ["Google ADK", "production (Apr 2025)", "A2A-native; Google Cloud"],
  ["Anthropic Claude Agent SDK", "production", "agent + Research extension"],
];

function mapToCase(d: Design): string {
  if (d.taskType === "population" || d.userFacingNetwork) {
    return "openclaw_moltbook";
  }
  if (d.taskType === "engineering" || d.rolesDistinct) {
    return "metagpt_chatdev";
  }
  if (d.taskType === "research") {
    return "anthropic_research";
  }
  if (d.verificationRequired && d.runtimeDurationHours >= 1) {
    return "anthropic_research";
  }
  return "anthropic_research";
}

function printCase(key: string): void {
  const c = CASES[key];
  console.log(`\n  closest case study: ${c.name}`);
  console.log("  patterns to copy:");
  for (const p of c.patterns) {
    console.log(`    - ${p}`);
  }
  console.log(`  recommended framework: ${c.framework}`);
  console.log(`  citation: ${c.citation}`);
}

function printLandscape(): void {
  console.log("\n" + "=".repeat(78));
  console.log("FRAMEWORK LANDSCAPE: April 2026");
  console.log("=".repeat(78));
  console.log(`  ${"framework".padEnd(30)} ${"status".padEnd(22)} ${"best for".padEnd(30)}`);
  for (const [name, status, bestFor] of FRAMEWORK_LANDSCAPE) {
    console.log(`  ${name.padEnd(30)} ${status.padEnd(22)} ${bestFor.padEnd(30)}`);
  }
  console.log("\n  every major framework ships MCP support; most ship A2A.");
  console.log("  protocol compatibility is no longer a differentiator -- handoff semantics are.");
}

function pyBool(b: boolean): string {
  return b ? "True" : "False";
}

function pyFloat(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function main(): void {
  const designs = [
    design("research-assistant", "research", 6, true, 2.0, false, false),
    design("codegen-team", "engineering", 5, true, 1.0, true, false),
    design("agent-marketplace", "population", 1000, false, 24.0, false, true),
    design("internal-automation", "automation", 3, true, 0.5, true, false),
  ];

  console.log("=".repeat(78));
  console.log("CASE-STUDY MAPPER: proposed designs → closest 2026 reference");
  console.log("=".repeat(78));

  for (const d of designs) {
    console.log(`\ndesign: '${d.name}'`);
    console.log(
      `  type=${d.taskType}  n_agents=${d.nAgentsExpected}  ` +
        `verification=${pyBool(d.verificationRequired)}  hours=${pyFloat(d.runtimeDurationHours)}`,
    );
    const caseKey = mapToCase(d);
    printCase(caseKey);
  }

  printLandscape();

  console.log("\nTakeaways:");
  console.log("  pick a case study first; adapt the design to match its known trade-offs.");
  console.log("  every 2026 framework supports MCP; most support A2A -- choose on handoff semantics.");
  console.log("  production-grade multi-agent needs: verification, cost accounting, rainbow deploys.");
}

main();

export {};
