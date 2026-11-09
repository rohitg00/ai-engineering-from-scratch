// Lesson: Production Serving Stack: KV Offloading and Cache-Aware Routing (phase 17 / lesson 18)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache/code/main.ts

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

  choice<T>(xs: T[]): T {
    return xs[Math.floor(this.random() * xs.length)];
  }

  randint(a: number, b: number): number {
    return a + Math.floor(this.random() * (b - a + 1));
  }

  randrange(n: number): number {
    return Math.floor(this.random() * n);
  }
}

const PREFILL_TOK_PER_MS = 40.0;
const DECODE_TOK_PER_MS = 0.15;
const CPU_OFFLOAD_TIME_MS_PER_BLOCK = 1.5;
const LMCACHE_TIME_MS_PER_BLOCK = 3.0;
const KV_BLOCK_TOKENS = 16;

interface Request {
  promptTokens: number;
  outputTokens: number;
  prefixId: string;
}

function makeWorkload(n = 200, seed = 7): Request[] {
  const rng = new Rng(seed);
  const prefixes = Array.from({ length: 6 }, (_, i) => `tpl_${i}`);
  const reqs: Request[] = [];
  for (let i = 0; i < n; i++) {
    const prompt = rng.choice([2000, 4000, 8000]);
    const outputTokens = rng.randint(150, 400);
    reqs.push({ promptTokens: prompt, outputTokens, prefixId: rng.choice(prefixes) });
  }
  return reqs;
}

function popOne(s: Set<string>): void {
  for (const v of s) {
    s.delete(v);
    return;
  }
}

interface Row {
  config: string;
  totalMs: number;
  prefillMs: number;
  rePrefillsAvoided: number;
}

function simulate(config: string, reqs: Request[]): Row {
  const enginesState: Set<string>[] = Array.from({ length: 4 }, () => new Set<string>());
  const sharedCache = new Set<string>();
  let totalTimeMs = 0.0;
  let rePrefillsAvoided = 0;
  let prefillWork = 0;
  const rng = new Rng(11);

  for (const r of reqs) {
    const eng = rng.randrange(enginesState.length);
    const blocks = Math.floor((r.promptTokens + KV_BLOCK_TOKENS - 1) / KV_BLOCK_TOKENS);
    const cachedLocal = enginesState[eng].has(r.prefixId);
    const cachedLmcache = sharedCache.has(r.prefixId);

    let prefillMs = 0;
    if (config === "NATIVE_ONLY") {
      if (cachedLocal) {
        prefillMs = 0;
        rePrefillsAvoided += 1;
      } else {
        prefillMs = r.promptTokens / PREFILL_TOK_PER_MS;
        enginesState[eng].add(r.prefixId);
        if (enginesState[eng].size > 4) popOne(enginesState[eng]);
      }
    } else if (config === "CPU_OFFLOAD") {
      if (cachedLocal) {
        prefillMs = 0;
        rePrefillsAvoided += 1;
      } else {
        prefillMs = r.promptTokens / PREFILL_TOK_PER_MS;
        enginesState[eng].add(r.prefixId);
        prefillMs += blocks * CPU_OFFLOAD_TIME_MS_PER_BLOCK * 0.1;
      }
    } else if (config === "LMCACHE") {
      if (cachedLocal) {
        prefillMs = 0;
        rePrefillsAvoided += 1;
      } else if (cachedLmcache) {
        prefillMs = blocks * LMCACHE_TIME_MS_PER_BLOCK;
        enginesState[eng].add(r.prefixId);
        rePrefillsAvoided += 1;
      } else {
        prefillMs = r.promptTokens / PREFILL_TOK_PER_MS;
        sharedCache.add(r.prefixId);
        enginesState[eng].add(r.prefixId);
      }
    }

    const decodeMs = r.outputTokens / DECODE_TOK_PER_MS;
    totalTimeMs += prefillMs + decodeMs;
    prefillWork += prefillMs;
  }

  return { config, totalMs: totalTimeMs, prefillMs: prefillWork, rePrefillsAvoided };
}

function report(row: Row, baseline: number): void {
  const speedup = row.totalMs ? baseline / row.totalMs : 1;
  console.log(
    `${lj(row.config, 14)}  total=${rj(fixed(row.totalMs, 0), 8)} ms  ` +
      `prefill=${rj(fixed(row.prefillMs, 0), 7)} ms  ` +
      `avoided_re_prefill=${rj(row.rePrefillsAvoided, 4)}  ` +
      `speedup=${rj(fixed(speedup, 2), 4)}x`,
  );
}

function main(): void {
  console.log("=".repeat(80));
  console.log("vLLM PRODUCTION STACK + LMCACHE: preemption-heavy, 4 engines, shared prefixes");
  console.log("=".repeat(80));
  const base = makeWorkload();
  const copy = (): Request[] => base.map((r) => ({ ...r }));
  const baseline = simulate("NATIVE_ONLY", copy()).totalMs;
  for (const cfg of ["NATIVE_ONLY", "CPU_OFFLOAD", "LMCACHE"]) report(simulate(cfg, copy()), baseline);
  console.log("\nRead: when prefixes repeat across engines, LMCache avoids redundant prefills");
  console.log("even when each engine individually evicted the cache.");
}

main();
