// Lesson: Experiment Runner (phase 19 / lesson 52)
// TypeScript port of code/experiments/sparsity_experiment.py. Node standard library only.
// Source: phases/19-capstone-projects/52-experiment-runner/docs/en.md
// Run: npx tsx phases/19-capstone-projects/52-experiment-runner/code/main.ts

import { readFileSync } from "node:fs";

class PyFloat {
  constructor(readonly v: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

const fl = (v: number): PyFloat => new PyFloat(v);

function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mant, expStr] = x.toExponential().split("e");
  const exp = Number(expStr);
  const neg = mant.startsWith("-");
  const digits = mant.replace("-", "").replace(".", "");
  let body: string;
  if (exp < -4 || exp >= 16) {
    const frac = digits.length > 1 ? "." + digits.slice(1) : "";
    body = digits[0] + frac + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
  } else if (exp < 0) {
    body = "0." + "0".repeat(-exp - 1) + digits;
  } else if (digits.length <= exp + 1) {
    body = digits + "0".repeat(exp + 1 - digits.length) + ".0";
  } else {
    body = digits.slice(0, exp + 1) + "." + digits.slice(exp + 1);
  }
  return (neg ? "-" : "") + body;
}

function fmtFixed(x: number, n: number): string {
  const neg = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  const wide = a.toFixed(Math.min(100, n + 30));
  const dot = wide.indexOf(".");
  const tail = wide.slice(dot + 1 + n);
  let out = a.toFixed(n);
  if (/^50*$/.test(tail)) {
    const head = wide.slice(0, dot + 1 + n);
    const trimmed = n === 0 ? head.slice(0, -1) : head;
    if (Number(trimmed[trimmed.length - 1]) % 2 === 0) out = trimmed;
  }
  return (neg ? "-" : "") + out;
}

function pyRound(x: number, n: number): number {
  return Number(fmtFixed(x, n));
}

function jsonStr(s: string): string {
  return (
    '"' +
    s.replace(/[\\"\u0000-\u001f\u007f-￿]/g, (c) => {
      if (c === '"') return '\\"';
      if (c === "\\") return "\\\\";
      if (c === "\n") return "\\n";
      if (c === "\r") return "\\r";
      if (c === "\t") return "\\t";
      if (c === "\b") return "\\b";
      if (c === "\f") return "\\f";
      return "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
    }) +
    '"'
  );
}

function pyDumps(v: Json, indent: number | null = null, level = 0): string {
  if (v === null) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (v instanceof PyFloat) return pyFloatRepr(v.v);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : pyFloatRepr(v);
  if (typeof v === "string") return jsonStr(v);
  let open: string;
  let close: string;
  let items: string[];
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    open = "[";
    close = "]";
    items = v.map((x) => pyDumps(x, indent, level + 1));
  } else {
    const keys = Object.keys(v);
    if (keys.length === 0) return "{}";
    open = "{";
    close = "}";
    items = keys.map((k) => jsonStr(k) + ": " + pyDumps(v[k], indent, level + 1));
  }
  if (indent === null) return open + items.join(", ") + close;
  const pad = "\n" + " ".repeat(indent * (level + 1));
  return open + pad + items.join("," + pad) + "\n" + " ".repeat(indent * level) + close;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNormal(rng: () => number): (mean: number, std: number) => number {
  return (mean, std) => {
    let u = 0;
    while (u === 0) u = rng();
    const v = rng();
    return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };
}

function sleepSync(seconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
}

function num(v: Json | undefined, fallback: number): number {
  if (v instanceof PyFloat) return v.v;
  return typeof v === "number" ? v : typeof v === "string" ? Number(v) : fallback;
}

function main(): number {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    console.error(pyDumps({ error: "missing config path" }));
    return 2;
  }
  const cfgPath = argv[0];
  let cfg: Obj;
  try {
    cfg = JSON.parse(readFileSync(cfgPath, "utf-8")) as Obj;
  } catch (exc) {
    console.error(pyDumps({ error: `bad config: ${(exc as Error).message}` }));
    return 2;
  }

  const seed = Math.trunc(num(cfg["__seed"], 0));
  const k = Math.trunc(num(cfg["k"], 8));
  const steps = Math.max(1, Math.trunc(num(cfg["steps"], 4)));
  const sleepS = num(cfg["sleep_s"], 0.0);
  const allocateMb = Math.trunc(num(cfg["allocate_mb"], 0));

  const normal = makeNormal(mulberry32(seed));
  let held: Buffer | null = null;
  if (allocateMb > 0) held = Buffer.alloc(allocateMb * 1024 * 1024);

  const baseLoss = 5.0;
  const losses: number[] = [];
  for (let step = 0; step < steps; step++) {
    const noise = normal(0, 0.02);
    const lossStep = baseLoss * 0.9 ** step - (0.05 * Math.min(k, 32)) / 32.0 + noise;
    losses.push(pyRound(lossStep, 6));
    const last = losses[losses.length - 1];
    const intermediate: Obj = {
      step,
      loss: fl(last),
      perplexity: fl(pyRound(Math.exp(last), 6)),
      final_loss: fl(last),
    };
    console.log(pyDumps(intermediate));
    if (sleepS > 0) sleepSync(sleepS);
  }

  const last = losses[losses.length - 1];
  const final: Obj = {
    perplexity: fl(pyRound(Math.exp(last), 6)),
    final_loss: fl(last),
    steps_completed: steps,
    k,
    seed,
  };
  console.log(pyDumps(final));
  if (held !== null) held[0] = 1;
  return 0;
}

process.exitCode = main();
