// Lesson: Automated Alignment Research (Anthropic AAR) (phase 15 / lesson 06)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/06-automated-alignment-research/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/06-automated-alignment-research/code/main.ts

import { createHash } from "node:crypto";

let rngState = 0;

function seedRandom(value: number): void {
  rngState = value >>> 0;
}

function random(): number {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function gauss(mu: number, sigma: number): number {
  const u1 = 1 - random();
  const u2 = random();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function pyFixed(value: number, digits: number): string {
  if (!Number.isFinite(value)) return Number.isNaN(value) ? "nan" : value > 0 ? "inf" : "-inf";
  const rounded = value.toFixed(digits);
  const exact = Math.abs(value).toFixed(Math.min(100, digits + 60));
  const tail = exact.slice(exact.indexOf(".") + 1 + digits);
  const tie = /^50*$/.test(tail);
  if (!tie) return rounded;
  const down = (Math.trunc(Math.abs(value) * 10 ** digits) / 10 ** digits).toFixed(digits);
  const lastDigit = Number(down.replace(".", "").slice(-1));
  const magnitude = lastDigit % 2 === 0 ? down : (Number(down) + 10 ** -digits).toFixed(digits);
  return value < 0 ? `-${magnitude}` : magnitude;
}


function rjust(text: string | number, width: number): string {
  return String(text).padStart(width);
}

function ljust(text: string | number, width: number): string {
  return String(text).padEnd(width);
}

interface ForumRecord {
  author: string;
  task: string;
  regime: string;
  result: number;
  prev_hash: string;
  my_hash: string;
}

function forumRecord(author: string, task: string, regime: string, result: number): ForumRecord {
  return { author, task, regime, result, prev_hash: "", my_hash: "" };
}

function digest(payload: string): string {
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

class Forum {
  records: ForumRecord[] = [];
  genesis = "0".repeat(16);

  head(): string {
    return this.records.length > 0 ? this.records[this.records.length - 1].my_hash : this.genesis;
  }

  post(rec: ForumRecord): void {
    rec.prev_hash = this.head();
    const payload = `${rec.author}|${rec.task}|${rec.regime}|${pyFixed(rec.result, 3)}|${rec.prev_hash}`;
    rec.my_hash = digest(payload);
    this.records.push(rec);
  }

  verify(): number[] {
    const bad: number[] = [];
    let prev = this.genesis;
    this.records.forEach((r, i) => {
      const payload = `${r.author}|${r.task}|${r.regime}|${pyFixed(r.result, 3)}|${prev}`;
      const expected = digest(payload);
      if (expected !== r.my_hash || r.prev_hash !== prev) bad.push(i);
      prev = r.my_hash;
    });
    return bad;
  }
}

const TASKS: [string, number][] = [
  ["weak-to-strong-distill", 0.4],
  ["reward-model-diagnosis", 0.3],
  ["in-context-safety-probe", 0.5],
  ["RLHF-hyperparam-sweep", 0.45],
  ["alignment-faking-detector", 0.25],
];

function solve(agent: string, task: [string, number], regime: string): number {
  const base = task[1];
  if (regime === "fixed") return base + random() * 0.25;
  return base + gauss(0.15, 0.22);
}

function runRegime(regime: string): ForumRecord[] {
  const forum = new Forum();
  const agents = ["AAR-A", "AAR-B", "AAR-C"];
  for (const task of TASKS) {
    for (const agent of agents) {
      const r = solve(agent, task, regime);
      forum.post(forumRecord(agent, task[0], regime, r));
    }
  }
  return forum.records;
}

function attemptTamper(forumRecords: ForumRecord[]): Forum {
  const f = new Forum();
  for (const r of forumRecords) f.post(forumRecord(r.author, r.task, r.regime, r.result));
  let worstIdx = -1;
  let worstVal = Infinity;
  f.records.forEach((r, i) => {
    if (r.author === "AAR-A" && r.result < worstVal) {
      worstVal = r.result;
      worstIdx = i;
    }
  });
  if (worstIdx >= 0) f.records[worstIdx].result = f.records[worstIdx].result + 0.5;
  return f;
}

function regimeReport(regime: string): void {
  const records = runRegime(regime);
  const byTask = new Map<string, number[]>();
  for (const r of records) {
    const values = byTask.get(r.task) ?? [];
    values.push(r.result);
    byTask.set(r.task, values);
  }
  console.log(`\nregime: ${regime}`);
  console.log(`  ${ljust("task", 32)}  ${rjust("mean", 8)}  ${rjust("max", 8)}  ${rjust("min", 8)}`);
  const means: number[] = [];
  for (const [task, values] of byTask) {
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    means.push(mean);
    console.log(
      `  ${ljust(task, 32)}  ${rjust(pyFixed(mean, 3), 8)}  ${rjust(pyFixed(Math.max(...values), 3), 8)}  ${rjust(pyFixed(Math.min(...values), 3), 8)}`,
    );
  }
  console.log(`  overall mean across tasks      : ${pyFixed(means.reduce((s, v) => s + v, 0) / means.length, 3)}`);
}

function tamperDemo(): void {
  console.log("\nLog tampering detection");
  console.log("-".repeat(70));
  const baseline = runRegime("free");
  const tampered = attemptTamper(baseline);
  const bad = tampered.verify();
  console.log(`  verify() flagged ${bad.length} corrupted record(s) at indices [${bad.join(", ")}]`);
  console.log("  the append-only chain breaks at the first edited record.");
  console.log("  an out-of-sandbox backup reveals the tamper on cross-check.");
}

function main(): void {
  seedRandom(2);
  console.log("=".repeat(70));
  console.log("AUTOMATED ALIGNMENT RESEARCH FORUM (Phase 15, Lesson 6)");
  console.log("=".repeat(70));

  regimeReport("fixed");
  regimeReport("free");

  console.log("\nfixed vs free: fixed has lower variance, free has higher upside");
  tamperDemo();

  console.log();
  console.log("=".repeat(70));
  console.log("HEADLINE: out-of-sandbox logs + free decomposition + human review");
  console.log("-".repeat(70));
  console.log("  Free decomposition gives AARs more ceiling, and more audit work.");
  console.log("  Tamper-evident logs make the audit possible. Human reviewers still");
  console.log("  decide what publishes. AAR compresses the middle of the pipeline,");
  console.log("  not the ends.");
}

main();
