// Lesson: Supervisor / Orchestrator-Worker Pattern (phase 16 / lesson 05)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/code/main.ts

import { setTimeout as sleep } from "node:timers/promises";

function now(): number {
  return Date.now() / 1000;
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

function pyFloat(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

interface WorkerResult {
  sub_question: string;
  summary: string;
  tokens_spent: number;
  wall_time: number;
}

interface TraceEntry {
  worker_id: number;
  event: string;
  t: number;
  sub_question: string;
}

class Trace {
  entries: TraceEntry[] = [];

  log(workerId: number, event: string, subQuestion = ""): void {
    this.entries.push({ worker_id: workerId, event, t: now(), sub_question: subQuestion });
  }
}

async function fakeWebFetch(query: string): Promise<string> {
  await sleep(300);
  return `Summary for '${query}': 3 key findings from 5 sources.`;
}

class Worker {
  constructor(public workerId: number, public trace: Trace) {}

  async run(subQuestion: string, results: (WorkerResult | null)[], idx: number): Promise<void> {
    const start = now();
    this.trace.log(this.workerId, "start", subQuestion);
    const summary = await fakeWebFetch(subQuestion);
    const elapsed = now() - start;
    results[idx] = {
      sub_question: subQuestion,
      summary,
      tokens_spent: 800,
      wall_time: elapsed,
    };
    this.trace.log(this.workerId, "done", subQuestion);
  }
}

type Stats = { wall_clock_seconds: number; total_tokens: number; worker_count: number };

class Lead {
  constructor(public trace: Trace) {}

  plan(query: string): string[] {
    return [
      `${query} -- historical origins`,
      `${query} -- state of the art 2026`,
      `${query} -- open problems`,
    ];
  }

  synthesize(query: string, results: WorkerResult[]): string {
    const parts = results.map((r) => `- ${r.sub_question}: ${r.summary}`);
    return `Answer to '${query}':\n` + parts.join("\n");
  }

  async run(query: string): Promise<[string, Stats]> {
    const t0 = now();
    const subQuestions = this.plan(query);
    this.trace.log(-1, "plan", String(subQuestions.length));

    const results: (WorkerResult | null)[] = subQuestions.map(() => null);
    const tasks: Promise<void>[] = [];
    subQuestions.forEach((sq, i) => {
      const w = new Worker(i, this.trace);
      tasks.push(w.run(sq, results, i));
    });

    await Promise.all(tasks);

    this.trace.log(-1, "synthesize");
    const ok = results.filter((r): r is WorkerResult => r !== null);
    const synthesis = this.synthesize(query, ok);
    const totalWall = now() - t0;
    const totalTokens = ok.reduce((s, r) => s + r.tokens_spent, 0) + 1200;
    return [synthesis, {
      wall_clock_seconds: round3(totalWall),
      total_tokens: totalTokens,
      worker_count: subQuestions.length,
    }];
  }
}

function renderTrace(trace: Trace, t0: number): void {
  for (const e of trace.entries) {
    const rel = round3(e.t - t0);
    const sq = e.sub_question ? ` | ${e.sub_question}` : "";
    const tag = e.worker_id === -1 ? "LEAD" : `W${e.worker_id}`;
    console.log(`  +${pyFloat(rel).padStart(5)}s  ${tag.padStart(4)}  ${e.event}${sq}`);
  }
}

async function main(): Promise<void> {
  console.log("Supervisor / Orchestrator-Worker demo");
  console.log("-".repeat(42));

  const trace = new Trace();
  const t0 = now();
  const lead = new Lead(trace);
  const [answer, stats] = await lead.run("What changed in multi-agent systems 2023 to 2026?");

  console.log("\nTrace (+seconds relative to plan start):");
  renderTrace(trace, t0);

  console.log("\nFinal synthesis:");
  console.log("  " + answer.split("\n").join("\n  "));

  console.log("\nStats:");
  console.log(`  wall_clock_seconds: ${pyFloat(stats.wall_clock_seconds)}`);
  console.log(`  total_tokens: ${stats.total_tokens}`);
  console.log(`  worker_count: ${stats.worker_count}`);

  console.log("\nSequential baseline would be ~0.9s (3 * 0.3s).");
  console.log("Parallel actual is ~0.35s. That's the supervisor win.");
}

main();
