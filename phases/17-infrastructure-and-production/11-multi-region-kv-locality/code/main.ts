// Lesson: Multi-Region LLM Serving and KV Cache Locality (phase 17 / lesson 11)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/11-multi-region-kv-locality/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/11-multi-region-kv-locality/code/main.ts

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
}

const REGIONS = ["us-east-1", "us-west-2", "eu-west-1"];
const REPLICAS_PER_REGION = 4;
const CACHE_HIT_MS = 80;
const CACHE_MISS_MS = 800;
const CROSSREGION_RTT = new Map<string, number>([
  ["us-east-1|us-west-2", 65],
  ["us-east-1|eu-west-1", 75],
  ["us-west-2|eu-west-1", 130],
]);
const CROSSREGION_COST_PER_REQ = 0.0004;

function rtt(a: string, b: string): number {
  if (a === b) return 0;
  const key = CROSSREGION_RTT.has(`${a}|${b}`) ? `${a}|${b}` : `${b}|${a}`;
  return CROSSREGION_RTT.get(key) ?? 200;
}

interface Replica {
  region: string;
  idx: number;
  prefixCache: Set<string>;
  queueDepth: number;
}

interface Request {
  originRegion: string;
  prefixHash: string;
  servedBy: Replica | null;
  ttftMs: number;
  crossregion: boolean;
}

function request(originRegion: string, prefixHash: string): Request {
  return { originRegion, prefixHash, servedBy: null, ttftMs: 0, crossregion: false };
}

function makeReplicas(): Replica[] {
  const out: Replica[] = [];
  for (const region of REGIONS) {
    for (let i = 0; i < REPLICAS_PER_REGION; i++) out.push({ region, idx: i, prefixCache: new Set(), queueDepth: 0 });
  }
  return out;
}

function makeWorkload(n = 1000, seed = 7): Request[] {
  const rng = new Rng(seed);
  const reqs: Request[] = [];
  const hotPrefixes = Array.from({ length: 40 }, (_, i) => `prefix_${i}`);
  for (let i = 0; i < n; i++) {
    const origin = rng.choice(REGIONS);
    const prefix = rng.choice(hotPrefixes);
    reqs.push(request(origin, prefix));
  }
  return reqs;
}

function minByQueue(reps: Replica[]): Replica {
  let best = reps[0];
  for (const rep of reps) if (rep.queueDepth < best.queueDepth) best = rep;
  return best;
}

function popOne(s: Set<string>): void {
  for (const v of s) {
    s.delete(v);
    return;
  }
}

interface Row {
  strategy: string;
  hitRate: number;
  meanTtft: number;
  p50Ttft: number;
  p99Ttft: number;
  crossregion: number;
  crossregionCost: number;
}

function simulate(strategy: string, reqs: Request[]): Row {
  const replicas = makeReplicas();
  const rng = new Rng(11);
  let hits = 0;
  const ttfts: number[] = [];
  let crossregionCount = 0;

  reqs.forEach((r, i) => {
    let chosen: Replica | null = null;

    if (strategy === "ROUND_ROBIN") {
      chosen = replicas[i % replicas.length];
    } else if (strategy === "REGIONAL") {
      const local = replicas.filter((rep) => rep.region === r.originRegion);
      const matches = local.filter((rep) => rep.prefixCache.has(r.prefixHash));
      chosen = matches.length ? minByQueue(matches) : minByQueue(local);
    } else if (strategy === "GLOBAL") {
      const matches = replicas.filter((rep) => rep.prefixCache.has(r.prefixHash));
      let bestCost = Infinity;
      for (const rep of matches) {
        const c = CACHE_HIT_MS + rtt(r.originRegion, rep.region);
        if (c < bestCost) {
          bestCost = c;
          chosen = rep;
        }
      }
      if (chosen === null || bestCost > CACHE_MISS_MS) {
        chosen = minByQueue(replicas.filter((rep) => rep.region === r.originRegion));
      }
    }
    if (chosen === null) throw new Error(`unknown strategy ${strategy}`);

    const cross = chosen.region !== r.originRegion;
    const hit = chosen.prefixCache.has(r.prefixHash);
    if (hit) {
      hits += 1;
      r.ttftMs = CACHE_HIT_MS + rtt(r.originRegion, chosen.region);
    } else {
      r.ttftMs = CACHE_MISS_MS + rtt(r.originRegion, chosen.region);
      chosen.prefixCache.add(r.prefixHash);
      if (chosen.prefixCache.size > 12) popOne(chosen.prefixCache);
    }
    chosen.queueDepth = Math.max(0, chosen.queueDepth + (rng.random() < 0.4 ? 1 : 0) - 1);
    r.servedBy = chosen;
    r.crossregion = cross;
    ttfts.push(r.ttftMs);
    if (cross) crossregionCount += 1;
  });

  ttfts.sort((a, b) => a - b);
  const p50 = ttfts[Math.floor(ttfts.length / 2)];
  const p99 = ttfts[Math.trunc(ttfts.length * 0.99) - 1];
  return {
    strategy,
    hitRate: hits / reqs.length,
    meanTtft: ttfts.reduce((a, b) => a + b, 0) / ttfts.length,
    p50Ttft: p50,
    p99Ttft: p99,
    crossregion: crossregionCount,
    crossregionCost: crossregionCount * CROSSREGION_COST_PER_REQ,
  };
}

function report(row: Row): void {
  console.log(
    `${lj(row.strategy, 13)}  hit=${rj(fixed(row.hitRate * 100, 1), 5)}%  ` +
      `mean=${rj(fixed(row.meanTtft, 0), 5)}ms  P50=${rj(fixed(row.p50Ttft, 0), 5)}ms  ` +
      `P99=${rj(fixed(row.p99Ttft, 0), 5)}ms  cross=${rj(row.crossregion, 4)}  ` +
      `cross_cost=$${fixed(row.crossregionCost, 3)}`,
  );
}

function main(): void {
  console.log("=".repeat(80));
  console.log("MULTI-REGION LLM ROUTING: three strategies, 1000 requests");
  console.log("=".repeat(80));
  const base = makeWorkload();
  const header = `${lj("Strategy", 13)}  hit         mean     P50      P99      cross   cost`;
  console.log(header);
  console.log("-".repeat(header.length));
  for (const strategy of ["ROUND_ROBIN", "REGIONAL", "GLOBAL"]) {
    const reqs = base.map((r) => request(r.originRegion, r.prefixHash));
    report(simulate(strategy, reqs));
  }

  console.log("\nRead: REGIONAL beats ROUND_ROBIN on cache hit. GLOBAL is");
  console.log("only better when prefill cost dominates network latency.");
}

main();
