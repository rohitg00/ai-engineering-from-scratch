// Lesson: Bounded Self-Improvement Designs (phase 15 / lesson 08)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/08-bounded-self-improvement/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/08-bounded-self-improvement/code/main.ts

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

function randrange(n: number): number {
  return Math.floor(random() * n);
}

function choice<T>(items: T[]): T {
  return items[randrange(items.length)];
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


function reprList(items: string[]): string {
  return `[${items.map((item) => `'${item}'`).join(", ")}]`;
}

const DEFAULT_SEED = 5;

function shortHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

const OBJECTIVE = "canonicalize whitespace and title-case the input";
const OBJECTIVE_HASH = shortHash(OBJECTIVE);

const APPROVED_TOOL_MANIFEST = new Set(["trim", "collapse", "lower", "upper", "reverse", "title"]);

interface Agent {
  ops: string[];
  active_manifest: Set<string>;
  objective: string;
}

function newAgent(): Agent {
  return { ops: ["nop"], active_manifest: new Set(APPROVED_TOOL_MANIFEST), objective: OBJECTIVE };
}

function titleCase(s: string): string {
  return s.replace(/[A-Za-z]+/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

const TOOLS_IMPL = new Map<string, (s: string) => string>([
  ["trim", (s) => s.trim()],
  ["collapse", (s) => s.split(/\s+/).filter((part) => part !== "").join(" ")],
  ["lower", (s) => s.toLowerCase()],
  ["upper", (s) => s.toUpperCase()],
  ["reverse", (s) => [...s].reverse().join("")],
  ["title", titleCase],
  ["nop", (s) => s],
]);

const CASES_PERF: [string, string][] = [
  ["  Hello   World  ", "Hello World"],
  ["FOO   bar", "Foo Bar"],
  ["  mixedCase Space  ", "Mixedcase Space"],
  ["Already clean", "Already Clean"],
];

const CASES_SAFETY: [string, string][] = [
  ["exec('rm -rf /')", "[blocked]"],
  ["drop table users;", "[blocked]"],
];

function apply(agent: Agent, input: string): string {
  let s = input;
  for (const op of agent.ops) {
    const fn = TOOLS_IMPL.get(op);
    if (fn === undefined) return "";
    s = fn(s);
  }
  const dangerous = ["exec(", "drop table", "rm -rf", "; delete from"];
  const low = s.toLowerCase();
  if (dangerous.some((d) => low.includes(d))) return "[blocked]";
  return s;
}

function perfScore(agent: Agent): number {
  let correct = 0;
  for (const [inp, want] of CASES_PERF) {
    if (apply(agent, inp) === want) correct += 1;
  }
  return correct / CASES_PERF.length;
}

function safetyScore(agent: Agent): number {
  let correct = 0;
  for (const [inp, want] of CASES_SAFETY) {
    if (apply(agent, inp) === want) correct += 1;
  }
  return correct / CASES_SAFETY.length;
}

function mutate(a: Agent, allowManifestEdit: boolean): Agent {
  const ops = [...a.ops];
  const manifest = new Set(a.active_manifest);
  let obj = a.objective;
  const choices = [...[...manifest].sort(), "nop"];

  const move = random();
  if (move < 0.35 && ops.length > 0) {
    ops[randrange(ops.length)] = choice(choices);
  } else if (move < 0.7 && ops.length < 6) {
    const at = randrange(ops.length + 1);
    ops.splice(at, 0, choice(choices));
  } else if (move < 0.9 && ops.length > 1) {
    ops.splice(randrange(ops.length), 1);
  } else if (allowManifestEdit && random() < 0.5) {
    manifest.add("raw_eval");
    obj = obj + "  # relax: accept any output";
  }
  return { ops, active_manifest: manifest, objective: obj };
}

function gateInvariant(a: Agent): boolean {
  return [...a.active_manifest].every((op) => APPROVED_TOOL_MANIFEST.has(op));
}

function gateAnchor(a: Agent): boolean {
  return shortHash(a.objective) === OBJECTIVE_HASH;
}

function gateMulti(perf: number, safety: number): boolean {
  return perf >= 0.25 && safety >= 1.0;
}

function gateRegression(historyPerf: number[], perf: number, tol = 0.2): boolean {
  if (historyPerf.length === 0) return true;
  return perf + tol >= Math.max(...historyPerf);
}

interface Gates {
  invariant: boolean;
  anchor: boolean;
  multi: boolean;
  regress: boolean;
}

function run(gates: Gates, allowManifestEdit: boolean, cycles = 200, seed: number | null = null): void {
  if (seed !== null) seedRandom(seed);
  let a = newAgent();
  let bestPerf = perfScore(a);
  let bestSafety = safetyScore(a);
  const history = [bestPerf];
  let accepted = 0;
  const rejects = { invariant: 0, anchor: 0, multi: 0, regress: 0 };

  for (let i = 0; i < cycles; i++) {
    const cand = mutate(a, allowManifestEdit);
    if (gates.invariant && !gateInvariant(cand)) {
      rejects.invariant += 1;
      continue;
    }
    if (gates.anchor && !gateAnchor(cand)) {
      rejects.anchor += 1;
      continue;
    }
    const p = perfScore(cand);
    const s = safetyScore(cand);
    if (gates.multi && !gateMulti(p, s)) {
      rejects.multi += 1;
      continue;
    }
    if (gates.regress && !gateRegression(history, p)) {
      rejects.regress += 1;
      continue;
    }
    a = cand;
    history.push(p);
    accepted += 1;
    if (p > bestPerf) bestPerf = p;
    if (s > bestSafety) bestSafety = s;
  }

  const finalPerf = perfScore(a);
  const finalSafety = safetyScore(a);
  const rejectText = Object.entries(rejects)
    .map(([key, value]) => `'${key}': ${value}`)
    .join(", ");
  console.log(`  accepted ${accepted}/${cycles} cycles`);
  console.log(`  final perf ${pyFixed(finalPerf, 2)}  final safety ${pyFixed(finalSafety, 2)}`);
  console.log(`  best perf  ${pyFixed(bestPerf, 2)}  best  safety ${pyFixed(bestSafety, 2)}`);
  console.log(`  final ops  ${reprList(a.ops)}`);
  console.log(`  manifest   ${reprList([...a.active_manifest].sort())}`);
  console.log(`  objective  ${gateAnchor(a) ? "(anchor intact)" : "(DRIFTED!)"}`);
  console.log(`  rejects    {${rejectText}}`);
}

function main(): void {
  console.log("=".repeat(70));
  console.log("BOUNDED SELF-IMPROVEMENT (Phase 15, Lesson 8)");
  console.log("=".repeat(70));

  const allOn: Gates = { invariant: true, anchor: true, multi: true, regress: true };
  const allOff: Gates = { invariant: false, anchor: false, multi: false, regress: false };

  console.log("\nAll gates ON, manifest edits attempted every cycle");
  console.log("-".repeat(70));
  run(allOn, true, 200, DEFAULT_SEED);

  console.log("\nAll gates OFF, manifest edits attempted every cycle");
  console.log("-".repeat(70));
  run(allOff, true, 200, DEFAULT_SEED);

  console.log("\nOnly regression gate OFF");
  console.log("-".repeat(70));
  const gates: Gates = { ...allOn, regress: false };
  run(gates, true, 200, DEFAULT_SEED);

  console.log();
  console.log("=".repeat(70));
  console.log("HEADLINE: each primitive blocks a specific failure class");
  console.log("-".repeat(70));
  console.log("  All gates on: loop improves while manifest + anchor intact.");
  console.log("  All gates off: manifest drifts, objective drifts, safety drops.");
  console.log("  Missing regression gate: silent capability dips get absorbed.");
  console.log("  Gates are mitigations. They raise the cost of silent failure.");
}

main();

export {};
