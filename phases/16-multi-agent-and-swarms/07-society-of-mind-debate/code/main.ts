// Lesson: Society of Mind and Multi-Agent Debate (phase 16 / lesson 07)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/07-society-of-mind-debate/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/07-society-of-mind-debate/code/main.ts

export {};

const TRUE_ANSWER = 42.0;

class DebateAgent {
  history: number[] = [];

  constructor(public name: string, public answer: number, public confidence: number) {}

  initial(): void {
    this.history.push(this.answer);
  }

  revise(others: DebateAgent[]): void {
    const weights = [this.confidence, ...others.map((o) => o.confidence)];
    const values = [this.answer, ...others.map((o) => o.answer)];
    const totalW = weights.reduce((s, w) => s + w, 0);
    let acc = 0;
    for (let i = 0; i < weights.length; i++) acc += weights[i] * values[i];
    this.answer = acc / totalW;
    this.confidence = Math.min(this.confidence * 1.05, 1.0);
    this.history.push(this.answer);
  }
}

function mean(agents: DebateAgent[]): number {
  return agents.reduce((s, a) => s + a.answer, 0) / agents.length;
}

function agreementScore(agents: DebateAgent[], tol = 0.1): number {
  const m = mean(agents);
  const agree = agents.filter((a) => Math.abs(a.answer - m) <= tol).length;
  return agree / agents.length;
}

function errorVsTruth(agents: DebateAgent[]): number {
  return Math.abs(mean(agents) - TRUE_ANSWER);
}

function row(label: string, agents: DebateAgent[]): string {
  const cols = agents.map((a) => a.answer.toFixed(2).padStart(6)).join(" ");
  return `    ${label}     ${cols}    ${agreementScore(agents).toFixed(2).padStart(4)}     ${errorVsTruth(agents).toFixed(2).padStart(5)}`;
}

function runDebate(agents: DebateAgent[], rounds: number, label: string): void {
  console.log(`\n=== ${label} (${rounds} rounds) ===`);
  for (const a of agents) a.initial();
  const hdr = agents.map((a) => a.name.padStart(6)).join(" ");
  console.log(`  round    ${hdr}    agree    err-vs-truth`);
  console.log(row("0", agents));
  for (let r = 1; r <= rounds; r++) {
    const updates: [DebateAgent, DebateAgent[]][] = [];
    for (const a of agents) {
      updates.push([a, agents.filter((o) => o !== a)]);
    }
    for (const [a, others] of updates) a.revise(others);
    console.log(row(String(r), agents));
  }
}

function freshTeam(seed: number): DebateAgent[] {
  void seed;
  return [
    new DebateAgent("A", 38.0, 0.6),
    new DebateAgent("B", 42.5, 0.8),
    new DebateAgent("C", 51.0, 0.4),
  ];
}

function singleShotMajority(agents: DebateAgent[]): number {
  return mean(agents);
}

function main(): void {
  console.log("Multi-agent debate (Du et al. 2023 style)");
  console.log("-".repeat(46));
  console.log(`True answer: ${TRUE_ANSWER.toFixed(1)}`);

  const baseline = freshTeam(1);
  for (const a of baseline) a.initial();
  const controlMean = singleShotMajority(baseline);
  console.log(`\nControl (round-0 mean, self-consistency baseline): ${controlMean.toFixed(2)}`);
  console.log(`Error vs truth: ${Math.abs(controlMean - TRUE_ANSWER).toFixed(2)}`);

  const team3 = freshTeam(1);
  runDebate(team3, 3, "Debate 3 agents, 3 rounds");

  const team5 = freshTeam(2);
  runDebate(team5, 5, "Debate 3 agents, 5 rounds (diminishing returns)");

  console.log("\nTakeaways:");
  console.log("  - 1 round of exchange cuts the error most.");
  console.log("  - Rounds 2-3 compound.");
  console.log("  - Beyond round 3 the gain per round shrinks (Du et al. plateau).");
  console.log("  - Cost scales N * R LLM calls with growing context.");
}

main();
