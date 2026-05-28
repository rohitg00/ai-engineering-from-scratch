/**
 * Prompt + semantic caching — TypeScript port。
 *
 * 3 つの部分があります:
 *   1. TTL 付き LRU cache（L2 prompt-prefix layer の interface。実際には provider が
 *      行うものをここでは model 化します）。
 *   2. Cosine-similarity threshold を持つ semantic cache（L1 layer）。Demo を再現可能にし、
 *      model 不要にするため deterministic word-hash "embedding" を使います。Production では
 *      embed() を real embedding call に差し替えます。
 *   3. main.py と同じ two-layer simulator。5-min vs 1-hour TTL premiums で
 *      parallel-write anti-pattern を動かします。
 *
 * Pricing snapshot: 2026-04。docs/en.md 経由で docs.anthropic.com /
 * platform.openai.com から取得。引用前に rate cards を確認してください。
 *
 * Citations:
 *   - Anthropic prompt-caching: docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 *   - OpenAI prompt-caching: platform.openai.com/docs/guides/prompt-caching
 *   - ProjectDiscovery 7%→74% by moving dynamic content out of prefix
 *     https://projectdiscovery.io/blog/how-we-cut-llm-cost-with-prompt-caching
 *
 * Node 20+ stdlib で動作します。npm deps は不要です。
 */

import { createHash } from "node:crypto";

// -- Pricing constants（2026-04）--------------------------------------------

const BASE_INPUT = 3.0; // $/M input tokens（Claude Sonnet class）
const BASE_OUTPUT = 15.0; // $/M output tokens
const CACHED_INPUT = 0.3; // read は約 10x cheaper
const CACHE_WRITE_5MIN = 1.25 * BASE_INPUT;
const CACHE_WRITE_1HR = 2.0 * BASE_INPUT;

// -- LRU cache with TTL ----------------------------------------------------

// JS の Map は insertion order を保持するため、LRU に利用します。
class LRUCache<K, V> {
  private readonly map = new Map<K, { value: V; expiresAt: number }>();
  private readonly capacity: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(capacity: number, ttlMs: number, now: () => number = Date.now) {
    if (capacity <= 0) throw new Error("capacity must be positive");
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    // LRU position を更新します。
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: this.now() + this.ttlMs });
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next();
      if (!oldest.done) this.map.delete(oldest.value);
    }
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  get size(): number {
    return this.map.size;
  }
}

// -- Semantic cache --------------------------------------------------------

// Toy deterministic embedding: lowercased word ごとに hash で 64 dims へ bucket します。
// Cosine threshold behavior を示すには十分です。Production では real embedding provider
//（text-embedding-3-small、voyage-3 など）に置き換えてください。
const EMBED_DIM = 64;

function embed(text: string): Float32Array {
  const vec = new Float32Array(EMBED_DIM);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((s) => s.length > 0);
  for (const tok of tokens) {
    const h = createHash("sha256").update(tok).digest();
    const idx = h.readUInt16BE(0) % EMBED_DIM;
    // Pure positive ではなく spread を得るため、second pair から sign bit を取ります。
    const sign = h[2] & 1 ? 1 : -1;
    vec[idx] += sign;
  }
  // Cosine = dot product になるよう L2-normalize します。
  let norm = 0;
  for (let i = 0; i < EMBED_DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < EMBED_DIM; i++) vec[i] /= norm;
  return vec;
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < EMBED_DIM; i++) dot += a[i] * b[i];
  return dot;
}

type SemanticEntry = { vec: Float32Array; response: string };

class SemanticCache {
  private readonly entries: SemanticEntry[] = [];
  private readonly threshold: number;
  private readonly capacity: number;

  constructor(threshold = 0.95, capacity = 1000) {
    if (threshold < 0 || threshold > 1) {
      throw new Error("threshold must be in [0,1]");
    }
    this.threshold = threshold;
    this.capacity = capacity;
  }

  // Threshold を超える best match、または undefined を返します。
  lookup(prompt: string): { response: string; similarity: number } | undefined {
    const q = embed(prompt);
    let bestSim = -1;
    let bestIdx = -1;
    for (let i = 0; i < this.entries.length; i++) {
      const sim = cosine(q, this.entries[i].vec);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestSim >= this.threshold) {
      return { response: this.entries[bestIdx].response, similarity: bestSim };
    }
    return undefined;
  }

  store(prompt: string, response: string): void {
    if (this.entries.length >= this.capacity) this.entries.shift();
    this.entries.push({ vec: embed(prompt), response });
  }

  get size(): number {
    return this.entries.length;
  }
}

// -- Workload + simulator --------------------------------------------------

// Mulberry32 PRNG.
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

type Request = {
  promptTokens: number;
  prefixHash: string;
  isParallelWave: boolean;
  arrivedAt: number;
  semanticKey: string;
};

function makeWorkload(n = 500, seed = 7): Request[] {
  const rng = makeRng(seed);
  const reqs: Request[] = [];
  const prefixes = Array.from({ length: 12 }, (_, i) => `prefix_${i}`);
  // 小さな FAQ-style canonical queries の集合。L1 hit rate を生みます。
  const faqs = [
    "what is your refund policy",
    "how do I reset my password",
    "what are your office hours",
    "how do I contact support",
  ];
  let now = 0.0;
  while (reqs.length < n) {
    if (rng() < 0.4) {
      for (let k = 0; k < 5; k++) {
        reqs.push({
          promptTokens: pickFrom(rng, [2000, 4000, 8000]),
          prefixHash: pickFrom(rng, prefixes),
          isParallelWave: true,
          arrivedAt: now,
          semanticKey: pickFrom(rng, faqs),
        });
      }
      now += 0.1 + rng() * 1.9;
    } else {
      reqs.push({
        promptTokens: pickFrom(rng, [2000, 4000, 8000]),
        prefixHash: pickFrom(rng, prefixes),
        isParallelWave: false,
        arrivedAt: now,
        semanticKey: pickFrom(rng, faqs),
      });
      now += 0.1 + rng() * 1.9;
    }
  }
  return reqs;
}

type Config = {
  l1Enabled: boolean;
  l2Enabled: boolean;
  parallelPenalty: boolean;
  l1Threshold: number;
  l1HitProb: number;
  ttl: "5min" | "1hr";
};

type SimResult = {
  cost: number;
  l1Hits: number;
  l2Reads: number;
  l2Writes: number;
};

function simulate(reqs: readonly Request[], cfg: Config): SimResult {
  // L2 は「cache されるのに十分前に見た」prefix hashes の set として model 化します。
  // ここでの L2 LRU は API の demonstration 用です。Simulator はより単純な
  // set + parallel-wave flag（main.py と同じ semantics）を使います。
  const _l2Lru = new LRUCache<string, true>(
    1024,
    cfg.ttl === "5min" ? 5 * 60_000 : 60 * 60_000,
  );
  void _l2Lru; // cache を exercise するために参照します。挙動は下の set に紐づきます
  const l2Cache = new Set<string>();
  const semantic = new SemanticCache(cfg.l1Threshold);

  // Hits が得られるよう、FAQ keys の canned answers で semantic cache を pre-warm します。
  semantic.store("what is your refund policy", "Refunds within 30 days.");
  semantic.store("how do I reset my password", "Use the forgot-password link.");
  semantic.store("what are your office hours", "Mon–Fri 9–5 PT.");
  semantic.store("how do I contact support", "Email support@example.com.");

  let l2Writes = 0;
  let l2Reads = 0;
  let l1Hits = 0;
  let cost = 0.0;
  const rng = makeRng(11);

  for (const r of reqs) {
    // L1 layer。
    if (cfg.l1Enabled) {
      // Simulator contract に従って randomized hit ratio を注入します。
      // l1HitProb fraction の requests は pre-warmed FAQ entry に
      // "semantically close enough" であり、path を現実的に保つため lookup します。
      if (rng() < cfg.l1HitProb) {
        const hit = semantic.lookup(r.semanticKey);
        if (hit) {
          l1Hits++;
          continue;
        }
      }
    }

    // L2 layer。
    if (cfg.l2Enabled) {
      if (l2Cache.has(r.prefixHash)) {
        l2Reads++;
        cost += (r.promptTokens / 1e6) * CACHED_INPUT;
      } else {
        const writeCost =
          cfg.ttl === "5min" ? CACHE_WRITE_5MIN : CACHE_WRITE_1HR;
        cost += (r.promptTokens / 1e6) * writeCost;
        l2Writes++;
        if (!(cfg.parallelPenalty && r.isParallelWave)) {
          l2Cache.add(r.prefixHash);
        }
      }
    } else {
      cost += (r.promptTokens / 1e6) * BASE_INPUT;
    }

    // Output cost — 200 tokens で固定します。
    cost += (200 / 1e6) * BASE_OUTPUT;
  }

  return { cost, l1Hits, l2Reads, l2Writes };
}

function report(label: string, cfg: Config, reqs: readonly Request[]): void {
  const res = simulate(reqs, cfg);
  const padLabel = label.padEnd(45);
  const cost = `$${res.cost.toFixed(2)}`.padStart(8);
  console.log(
    `${padLabel}  cost=${cost}  L1=${String(res.l1Hits).padStart(4)}  ` +
      `L2_reads=${String(res.l2Reads).padStart(4)}  ` +
      `L2_writes=${String(res.l2Writes).padStart(4)}`,
  );
}

function main(): void {
  console.log("=".repeat(95));
  console.log(
    "PROMPT + SEMANTIC CACHING — 500 requests、Claude Sonnet-class pricing（2026-04）",
  );
  console.log("=".repeat(95));
  const reqs = makeWorkload();

  report(
    "NO CACHING",
    {
      l1Enabled: false,
      l2Enabled: false,
      parallelPenalty: true,
      l1Threshold: 0.95,
      l1HitProb: 0.0,
      ttl: "5min",
    },
    reqs,
  );
  report(
    "L2 5-min, parallel penalty active",
    {
      l1Enabled: false,
      l2Enabled: true,
      parallelPenalty: true,
      l1Threshold: 0.95,
      l1HitProb: 0.0,
      ttl: "5min",
    },
    reqs,
  );
  report(
    "L2 5-min, parallel fixed (serialize first)",
    {
      l1Enabled: false,
      l2Enabled: true,
      parallelPenalty: false,
      l1Threshold: 0.95,
      l1HitProb: 0.0,
      ttl: "5min",
    },
    reqs,
  );
  report(
    "L2 1-hour + L1 semantic 30%",
    {
      l1Enabled: true,
      l2Enabled: true,
      parallelPenalty: false,
      l1Threshold: 0.95,
      l1HitProb: 0.3,
      ttl: "1hr",
    },
    reqs,
  );
  report(
    "L2 1-hour + L1 semantic 70% (structured FAQ)",
    {
      l1Enabled: true,
      l2Enabled: true,
      parallelPenalty: false,
      l1Threshold: 0.95,
      l1HitProb: 0.7,
      ttl: "1hr",
    },
    reqs,
  );

  // API が見えるよう、LRU + TTL primitive を直接示します。
  console.log("\n--- LRU+TTL primitive demo ---");
  const lru = new LRUCache<string, number>(2, 1000);
  lru.set("a", 1);
  lru.set("b", 2);
  lru.set("c", 3); // "a" を evict
  console.log(`after inserting a,b,c with cap=2: has(a)=${lru.has("a")}, has(b)=${lru.has("b")}, has(c)=${lru.has("c")}`);

  // Semantic cache cosine behavior を示します。同じ意味の paraphrase です。
  console.log("\n--- Semantic cache cosine threshold demo ---");
  const sc = new SemanticCache(0.5);
  sc.store("how do I reset my password", "Use forgot-password link.");
  const near = sc.lookup("how to reset password please");
  const far = sc.lookup("what is the capital of France");
  console.log(
    `near sim=${(near?.similarity ?? 0).toFixed(3)} response=${near?.response ?? "<miss>"}`,
  );
  console.log(
    `far  sim=${(far?.similarity ?? 0).toFixed(3)} response=${far?.response ?? "<miss>"}`,
  );

  console.log(
    "\nRead: caching は protocol です。効果を出すには prompts と batching の構造を整えてください。",
  );
}

main();
