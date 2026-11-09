// Lesson: Load Testing LLM APIs: Why k6 and Locust Lie (phase 17 / lesson 22)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/22-load-testing-llm-apis/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/22-load-testing-llm-apis/code/main.ts

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

  gauss(mu: number, sigma: number): number {
    let u1 = this.random();
    while (u1 === 0) u1 = this.random();
    const u2 = this.random();
    return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

const PREFIX_CACHE_HIT_TTFT_MS = 80;
const PREFIX_CACHE_MISS_TTFT_MS = 800;

interface Request {
  promptTokens: number;
  prefixHash: string;
}

function makeUniformWorkload(n = 500): Request[] {
  return Array.from({ length: n }, () => ({ promptTokens: 2000, prefixHash: "single_prefix" }));
}

function makeRealisticWorkload(n = 500, seed = 7): Request[] {
  const rng = new Rng(seed);
  const reqs: Request[] = [];
  const prefixes = Array.from({ length: 80 }, (_, i) => `prefix_${i}`);
  for (let i = 0; i < n; i++) {
    const prompt = Math.max(50, Math.trunc(rng.gauss(500, 180)));
    reqs.push({ promptTokens: prompt, prefixHash: rng.choice(prefixes) });
  }
  return reqs;
}

interface Stats {
  n: number;
  p50: number;
  p99: number;
  mean: number;
  cacheHits: number;
}

function simulate(reqs: Request[], concurrency: number): Stats {
  const cache = new Set<string>();
  const ttftSamples: number[] = [];
  for (let i = 0; i < reqs.length; i += concurrency) {
    const batch = reqs.slice(i, i + concurrency);
    for (const r of batch) {
      const hit = cache.has(r.prefixHash);
      const ttft = hit ? PREFIX_CACHE_HIT_TTFT_MS : PREFIX_CACHE_MISS_TTFT_MS;
      if (!hit) cache.add(r.prefixHash);
      ttftSamples.push(ttft);
    }
  }
  ttftSamples.sort((a, b) => a - b);
  return {
    n: reqs.length,
    p50: ttftSamples[Math.floor(ttftSamples.length / 2)],
    p99: ttftSamples[Math.trunc(ttftSamples.length * 0.99) - 1],
    mean: ttftSamples.reduce((a, b) => a + b, 0) / ttftSamples.length,
    cacheHits: ttftSamples.filter((t) => t === PREFIX_CACHE_HIT_TTFT_MS).length,
  };
}

function row(label: string, s: Stats): string {
  return `${lj(label, 22)}  ${rj(s.n, 5)}  ${rj(fixed(s.p50, 0), 8)}ms  ${rj(fixed(s.p99, 0), 8)}ms  ${rj(fixed(s.mean, 0), 6)}ms  ${rj(s.cacheHits, 4)}`;
}

function main(): void {
  console.log("=".repeat(95));
  console.log("PROMPT-UNIFORMITY TRAP: same test harness, different prompt distributions");
  console.log("=".repeat(95));

  for (const concurrency of [10, 50, 200]) {
    console.log(`\nConcurrency = ${concurrency}`);
    const header = `${lj("Workload", 22)}  ${rj("n", 5)}  ${rj("TTFT_P50", 9)}  ${rj("TTFT_P99", 9)}  ${rj("mean", 7)}  cache_hits`;
    console.log(header);
    console.log("-".repeat(header.length));

    console.log(row("UNIFORM", simulate(makeUniformWorkload(500), concurrency)));
    console.log(row("REALISTIC", simulate(makeRealisticWorkload(500), concurrency)));
  }

  console.log("\nRead: uniform prompts make your endpoint look fast. Realistic prompts tell the truth.");
  console.log("LLMPerf: --mean-input-tokens + --stddev-input-tokens. Always.");
}

main();
