// Lesson: EAGLE-3 Speculative Decoding in Production (phase 17 / lesson 05)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/05-eagle3-speculative-decoding/code/main.ts

function fixed(x: number, digits: number): string {
  const rounded = x.toFixed(digits);
  if (Math.abs(x) >= 1e21) return rounded;
  const exact = x.toFixed(100);
  const dot = exact.indexOf(".");
  if (!/^50*$/.test(exact.slice(dot + 1 + digits))) return rounded;
  const kept = digits === 0 ? exact.slice(0, dot) : exact.slice(0, dot + 1 + digits);
  return Number(kept.slice(-1)) % 2 === 0 ? kept : rounded;
}

const rj = (s: string | number, w: number): string => String(s).padStart(w);
const lj = (s: string, w: number): string => s.padEnd(w);

class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  random(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  gauss(mu: number, sigma: number): number {
    let u1 = this.random();
    while (u1 === 0) u1 = this.random();
    const u2 = this.random();
    return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

interface SpecPoint {
  alpha: number;
  k: number;
  verifyOverhead: number;
  concurrency: number;
}

function expectedSpeedup(p: SpecPoint): number {
  const effectiveOverhead = p.verifyOverhead * (1 + p.concurrency / 256);
  const tokensPerTarget = 1 + p.k * p.alpha;
  const costPerTarget = 1 + effectiveOverhead;
  return tokensPerTarget / costPerTarget;
}

function breakevenAlpha(k: number, verifyOverhead: number, concurrency: number): number {
  const effectiveOverhead = verifyOverhead * (1 + concurrency / 256);
  return effectiveOverhead / k;
}

function simulateTail(p: SpecPoint, nTokens = 1000, seed = 3): [number, number] {
  const rng = new Rng(seed);
  const baseTargetMs = 8.0;
  const effectiveOverhead = p.verifyOverhead * (1 + p.concurrency / 256);
  const verifyMs = baseTargetMs * (1 + effectiveOverhead);
  const rerollMs = baseTargetMs;

  const latencies: number[] = [];
  let tokensEmitted = 0;
  while (tokensEmitted < nTokens) {
    let accepted = 0;
    for (let i = 0; i < p.k; i++) {
      if (rng.random() < p.alpha) accepted += 1;
      else break;
    }
    const batchLat = verifyMs + (accepted < p.k ? rerollMs : 0);
    const batchTokens = Math.max(1, accepted + 1);
    const perTok = batchLat / batchTokens;
    for (let i = 0; i < batchTokens; i++) {
      const jitter = rng.gauss(0, perTok * 0.1);
      latencies.push(Math.max(0.1, perTok + jitter));
      tokensEmitted += 1;
      if (tokensEmitted >= nTokens) break;
    }
  }
  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.trunc(0.99 * latencies.length) - 1];
  return [mean(latencies), p99];
}

function plainTail(concurrency: number, nTokens = 1000, seed = 5): [number, number] {
  const rng = new Rng(seed);
  const base = 8.0 * (1 + concurrency / 512);
  const lats: number[] = [];
  for (let i = 0; i < nTokens; i++) lats.push(Math.max(0.1, base + rng.gauss(0, base * 0.08)));
  lats.sort((a, b) => a - b);
  return [mean(lats), lats[Math.trunc(0.99 * lats.length) - 1]];
}

type Row = [string, number, number, number, number, number];

function printTable(title: string, rows: Row[]): void {
  console.log(title);
  console.log("-".repeat(80));
  console.log(`${lj("config", 28)} ${rj("speedup", 8)} ${rj("be_alpha", 10)} ${rj("mean_ms", 10)} ${rj("p99_ms", 10)}`);
  for (const [label, speedup, beAlpha, meanMs, p99, deltaP99] of rows) {
    const tag = deltaP99 <= 0 ? "  OK" : "  TAIL";
    console.log(
      `${lj(label, 28)} ${rj(fixed(speedup, 2), 8)} ${rj(fixed(beAlpha, 3), 10)} ${rj(fixed(meanMs, 2), 10)} ${rj(fixed(p99, 2), 10)}${tag}`,
    );
  }
}

function main(): void {
  console.log("=".repeat(80));
  console.log("TOY EAGLE-3 SPECULATIVE-DECODING ANALYZER");
  console.log("=".repeat(80));
  console.log();

  const baseOverhead = 0.15;
  const k = 5;

  console.log(`Config: K=${k}, base verify_overhead=${baseOverhead}`);
  console.log();

  for (const concurrency of [32, 128, 256]) {
    const be = breakevenAlpha(k, baseOverhead, concurrency);
    const [, plainP99] = plainTail(concurrency);
    const rows: Row[] = [];
    for (const alpha of [0.3, 0.45, 0.55, 0.7, 0.8]) {
      const p: SpecPoint = { alpha, k, verifyOverhead: baseOverhead, concurrency };
      const s = expectedSpeedup(p);
      const [meanMs, p99Ms] = simulateTail(p);
      const delta = p99Ms - plainP99;
      rows.push([`alpha=${fixed(alpha, 2)} conc=${concurrency}`, s, be, meanMs, p99Ms, delta]);
    }
    console.log(`  --- concurrency ${concurrency} ---  plain P99 = ${fixed(plainP99, 2)} ms`);
    printTable("  spec decode", rows);
    console.log();
  }

  console.log("=".repeat(80));
  console.log("KEY FINDING");
  console.log("-".repeat(80));
  console.log("  Break-even alpha rises with concurrency. At 32 concurrent you profit");
  console.log("  anywhere above ~0.1; at 256 concurrent the bar is ~0.4. Under that,");
  console.log("  P99 tail gets worse even if the expected-speedup formula says positive.");
  console.log("  Measure alpha on your real traffic before shipping.");
}

main();
