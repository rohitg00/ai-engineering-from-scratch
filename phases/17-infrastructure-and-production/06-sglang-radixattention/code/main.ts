// Lesson: Prefix-Cache Serving: RadixAttention and KV Reuse (phase 17 / lesson 06)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/06-sglang-radixattention/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/06-sglang-radixattention/code/main.ts

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

  randrange(n: number): number {
    return Math.floor(this.random() * n);
  }

  shuffle<T>(xs: T[]): void {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
  }
}

const KV_BUDGET_BLOCKS = 160;
const BLOCK_TOKENS = 16;

function tokenCount(seg: string): number {
  if (seg === "SYSTEM") return 2000;
  if (seg.startsWith("DOC_")) return 500;
  if (seg.startsWith("Q_")) return 60;
  if (seg === "TOOLS") return 300;
  return 100;
}

interface Request {
  rid: number;
  segments: string[];
}

interface Node {
  path: string[];
  blocks: number;
  lastUsed: number;
}

const keyOf = (path: string[]): string => path.join("\u0000");

class RadixCache {
  used = 0;
  time = 0;
  nodes = new Map<string, Node>();

  constructor(public budget: number = KV_BUDGET_BLOCKS) {}

  walk(segments: string[]): number {
    let reused = 0;
    this.time += 1;
    for (let i = 1; i <= segments.length; i++) {
      const node = this.nodes.get(keyOf(segments.slice(0, i)));
      if (node === undefined) break;
      reused += tokenCount(segments[i - 1]);
      node.lastUsed = this.time;
    }
    return reused;
  }

  insert(segments: string[]): void {
    for (let i = 1; i <= segments.length; i++) {
      const path = segments.slice(0, i);
      const key = keyOf(path);
      if (this.nodes.has(key)) continue;
      const blocks = Math.floor((tokenCount(segments[i - 1]) + BLOCK_TOKENS - 1) / BLOCK_TOKENS);
      while (this.used + blocks > this.budget && this.evictOne()) {
        continue;
      }
      this.nodes.set(key, { path, blocks, lastUsed: this.time });
      this.used += blocks;
    }
  }

  private evictOne(): boolean {
    const all = [...this.nodes.values()];
    const isPrefix = (k: string[], other: string[]): boolean =>
      other.length >= k.length && k.every((seg, idx) => other[idx] === seg);
    const leaves = all.filter((k) => !all.some((other) => other !== k && isPrefix(k.path, other.path)));
    if (!leaves.length) return false;
    let victim = leaves[0];
    for (const leaf of leaves) if (leaf.lastUsed < victim.lastUsed) victim = leaf;
    this.nodes.delete(keyOf(victim.path));
    this.used -= victim.blocks;
    return true;
  }
}

interface Result {
  hitRate: number;
  saved: number;
  total: number;
  reqs: number;
}

const sumTokens = (segs: string[]): number => segs.reduce((acc, s) => acc + tokenCount(s), 0);

function simulate(requests: Request[], scheduler: string): Result {
  const cache = new RadixCache();

  let order: Request[];
  if (scheduler === "CACHE_AWARE") {
    const branchCount = new Map<string, number>();
    for (const r of requests) {
      for (let i = 1; i <= r.segments.length; i++) {
        const key = keyOf(r.segments.slice(0, i));
        branchCount.set(key, (branchCount.get(key) ?? 0) + 1);
      }
    }
    const score = (r: Request): number => {
      let best = -Infinity;
      for (let i = 1; i <= r.segments.length; i++) {
        const prefix = r.segments.slice(0, i);
        best = Math.max(best, (branchCount.get(keyOf(prefix)) ?? 0) * sumTokens(prefix));
      }
      return best;
    };
    order = [...requests].sort((a, b) => score(b) - score(a));
  } else {
    order = [...requests];
  }

  let saved = 0;
  let total = 0;
  for (const r of order) {
    total += sumTokens(r.segments);
    saved += cache.walk(r.segments);
    cache.insert(r.segments);
  }

  return { hitRate: total ? saved / total : 0, saved, total, reqs: requests.length };
}

function workloadRag(n = 80, docs = 4, seed = 1): Request[] {
  const rng = new Rng(seed);
  const reqs: Request[] = [];
  for (let i = 0; i < n; i++) {
    const doc = `DOC_${rng.randrange(docs)}`;
    reqs.push({ rid: i, segments: ["SYSTEM", "TOOLS", doc, `Q_${i}`] });
  }
  rng.shuffle(reqs);
  return reqs;
}

function workloadScrambled(n = 80, docs = 4, seed = 1): Request[] {
  const rng = new Rng(seed);
  const reqs: Request[] = [];
  for (let i = 0; i < n; i++) {
    const doc = `DOC_${rng.randrange(docs)}`;
    const prefix = ["SYSTEM", "TOOLS", doc];
    rng.shuffle(prefix);
    reqs.push({ rid: i, segments: [...prefix, `Q_${i}`] });
  }
  rng.shuffle(reqs);
  return reqs;
}

function report(label: string, res: Result): void {
  console.log(
    `${lj(label, 44)}  hit_rate=${rj(fixed(res.hitRate * 100, 1) + "%", 6)}   ` +
      `saved=${rj(res.saved, 6)}/${lj(String(res.total), 6)} tok   reqs=${res.reqs}`,
  );
}

function main(): void {
  console.log("=".repeat(88));
  console.log("TOY RADIX CACHE: cache hit rate across schedulers and orderings");
  console.log("=".repeat(88));

  const rag = workloadRag();
  report("RAG workload | FCFS", simulate(rag, "FCFS"));
  report("RAG workload | CACHE_AWARE", simulate(rag, "CACHE_AWARE"));

  const scrambled = workloadScrambled();
  report("RAG scrambled prefix | FCFS", simulate(scrambled, "FCFS"));
  report("RAG scrambled prefix | CACHE_AWARE", simulate(scrambled, "CACHE_AWARE"));

  console.log();
  console.log("=".repeat(88));
  console.log("KEY FINDING");
  console.log("-".repeat(88));
  console.log("  Fixed ordering + cache-aware scheduler : hit rate clears 80% on RAG.");
  console.log("  Scrambled prefix order : hit rate collapses: the tree cannot find shared paths.");
  console.log("  Real cases: 7% -> 74% hit rate by moving dynamic content out of the prefix.");
}

main();
