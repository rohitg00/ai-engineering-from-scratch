// Lesson: Group Chat and Speaker Selection (phase 16 / lesson 10)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/10-group-chat-speaker-selection/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/10-group-chat-speaker-selection/code/main.ts

export {};

interface Msg {
  speaker: string;
  content: string;
}

interface Agent {
  name: string;
  role: string;
  policy: (pool: Msg[]) => string;
}

function coderPolicy(pool: Msg[]): string {
  const recent = pool.slice(-3).filter((m) => m.speaker !== "coder");
  const last = recent.length > 0 ? recent[recent.length - 1].content : "";
  if (last.toLowerCase().includes("review") || last.toLowerCase().includes("fix")) {
    return "revised code: return a + b";
  }
  if (!pool.some((m) => m.speaker === "coder")) {
    return "initial code: return a - b  (buggy)";
  }
  return "TERMINATE";
}

function reviewerPolicy(pool: Msg[]): string {
  const lastCoder = [...pool].reverse().find((m) => m.speaker === "coder");
  if (lastCoder === undefined) return "waiting for code";
  if (lastCoder.content.includes("a - b")) return "review: bug detected -- sum must be a+b, please fix";
  if (lastCoder.content.includes("a + b")) return "review: approved";
  return "review: unclear";
}

function managerPolicy(pool: Msg[]): string {
  const approvals = pool.filter((m) => m.speaker === "reviewer" && m.content.includes("approved"));
  if (approvals.length > 0) return "TERMINATE";
  return "manager: continue working";
}

type Team = Map<string, Agent>;

const AGENTS: Team = new Map([
  ["coder", { name: "coder", role: "writes code", policy: coderPolicy }],
  ["reviewer", { name: "reviewer", role: "reviews code", policy: reviewerPolicy }],
  ["manager", { name: "manager", role: "keeps things moving", policy: managerPolicy }],
]);

type Selector = (pool: Msg[], team: Team) => string | null;

function roundRobinSelector(pool: Msg[], team: Team): string | null {
  const names = [...team.keys()];
  if (pool.length === 0) return names[0];
  const idx = (names.indexOf(pool[pool.length - 1].speaker) + 1) % names.length;
  return names[idx];
}

function llmStyleSelector(pool: Msg[], team: Team): string | null {
  void team;
  if (pool.length === 0) return "manager";
  const last = pool[pool.length - 1];
  if (last.speaker === "coder") return "reviewer";
  if (last.speaker === "reviewer") {
    if (last.content.includes("approved")) return "manager";
    return "coder";
  }
  if (last.speaker === "manager") return "coder";
  return null;
}

function pyStrList(items: string[]): string {
  return "[" + items.map((s) => `'${s}'`).join(", ") + "]";
}

function runGroupchat(team: Team, selector: Selector, maxRounds: number, label: string): Msg[] {
  console.log(`\n=== ${label} ===`);
  const pool: Msg[] = [];
  const trace: string[] = [];
  for (let i = 0; i < maxRounds; i++) {
    const nxt = selector(pool, team);
    if (nxt === null) break;
    trace.push(nxt);
    const agent = team.get(nxt)!;
    const content = agent.policy(pool);
    pool.push({ speaker: nxt, content });
    console.log(`  [${nxt.padEnd(8)}]: ${content}`);
    if (content.trim().endsWith("TERMINATE")) break;
  }
  console.log(`  Selector trace: ${pyStrList(trace)}`);
  console.log(`  Rounds used: ${pool.length}`);
  return pool;
}

function speakerCounts(pool: Msg[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of pool) counts.set(m.speaker, (counts.get(m.speaker) ?? 0) + 1);
  return counts;
}

function pyCounts(c: Map<string, number>): string {
  return "{" + [...c.entries()].map(([k, v]) => `'${k}': ${v}`).join(", ") + "}";
}

function main(): void {
  console.log("Group chat with speaker selection -- AutoGen GroupChat shape");
  console.log("-".repeat(62));

  const pRr = runGroupchat(AGENTS, roundRobinSelector, 8, "Round-robin");
  console.log(`  Speaker counts: ${pyCounts(speakerCounts(pRr))}`);

  const pLlm = runGroupchat(AGENTS, llmStyleSelector, 8, "LLM-style (context-aware)");
  console.log(`  Speaker counts: ${pyCounts(speakerCounts(pLlm))}`);

  console.log("\nObservations:");
  console.log("  - Round-robin gives every agent an equal turn regardless of context.");
  console.log("  - LLM-style routes by context; reviewer only speaks after coder, etc.");
  console.log("  - Both terminate on TERMINATE token or max_rounds.");
}

main();
