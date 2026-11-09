// Lesson: Caching, Rate Limiting & Cost Optimization (phase 11 / lesson 11)
// TypeScript port of code/caching_cost.py. Node standard library only.
// Source: phases/11-llm-engineering/11-caching-cost/docs/en.md
// Run: npx tsx phases/11-llm-engineering/11-caching-cost/code/caching_cost.ts

import { createHash } from "node:crypto";

class PyFloat {
  constructor(public value: number) {}
}

type PyVal = number | string | PyFloat;
type Message = { role: string; content: string };

function pySplit(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

function pyFixed(x: number, d: number): string {
  const neg = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  let s = a.toFixed(d);
  const exact = a.toFixed(100);
  const dot = exact.indexOf(".");
  const tail = exact.slice(dot + 1 + d);
  if (/^50*$/.test(tail)) {
    const truncated = exact.slice(0, d > 0 ? dot + 1 + d : dot);
    const last = Number(truncated[truncated.length - 1]);
    if (last % 2 === 0) s = truncated;
  }
  return neg ? "-" + s : s;
}

function pyRound(x: number, d: number): number {
  return parseFloat(pyFixed(x, d));
}

function pyFloatRepr(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function pyStrRepr(s: string): string {
  if (s.includes("'") && !s.includes('"')) return '"' + s + '"';
  return "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
}

function pyDictRepr(obj: Record<string, PyVal>): string {
  const parts = Object.entries(obj).map(([k, v]) => {
    let rendered: string;
    if (v instanceof PyFloat) rendered = pyFloatRepr(v.value);
    else if (typeof v === "string") rendered = pyStrRepr(v);
    else rendered = String(v);
    return `${pyStrRepr(k)}: ${rendered}`;
  });
  return "{" + parts.join(", ") + "}";
}

function withCommas(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function sortedJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(sortedJson).join(", ") + "]";
  if (typeof value === "number") return pyFloatRepr(value);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    return "{" + entries.map(([k, v]) => `${JSON.stringify(k)}: ${sortedJson(v)}`).join(", ") + "}";
  }
  return JSON.stringify(value);
}

function now(): number {
  return Date.now() / 1000;
}

const MODEL_PRICING: Record<string, { input: number; output: number; cached_input: number }> = {
  "gpt-4o": { input: 2.5, output: 10.0, cached_input: 1.25 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, cached_input: 0.075 },
  "gpt-4.1": { input: 2.0, output: 8.0, cached_input: 0.5 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6, cached_input: 0.1 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4, cached_input: 0.025 },
  o3: { input: 2.0, output: 8.0, cached_input: 0.5 },
  "o3-mini": { input: 1.1, output: 4.4, cached_input: 0.55 },
  "o4-mini": { input: 1.1, output: 4.4, cached_input: 0.275 },
  "claude-opus-4": { input: 15.0, output: 75.0, cached_input: 1.5 },
  "claude-sonnet-4": { input: 3.0, output: 15.0, cached_input: 0.3 },
  "claude-haiku-3.5": { input: 0.8, output: 4.0, cached_input: 0.08 },
  "gemini-2.5-pro": { input: 1.25, output: 10.0, cached_input: 0.3125 },
  "gemini-2.5-flash": { input: 0.15, output: 0.6, cached_input: 0.0375 },
};

interface CostResult {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  input_cost: number;
  cached_input_cost: number;
  output_cost: number;
  total_cost: number;
}

function calculateCost(model: string, inputTokens: number, outputTokens: number, cachedInputTokens = 0): CostResult {
  const pricing = MODEL_PRICING[model];
  if (!pricing) throw new Error(`Unknown model: ${model}`);
  const nonCached = inputTokens - cachedInputTokens;
  const inputCost = (nonCached / 1_000_000) * pricing.input;
  const cachedCost = (cachedInputTokens / 1_000_000) * pricing.cached_input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const total = inputCost + cachedCost + outputCost;
  return {
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cached_input_tokens: cachedInputTokens,
    input_cost: pyRound(inputCost, 6),
    cached_input_cost: pyRound(cachedCost, 6),
    output_cost: pyRound(outputCost, 6),
    total_cost: pyRound(total, 6),
  };
}

interface ExactEntry {
  response: string;
  timestamp: number;
  access_count: number;
}

class ExactCache {
  cache = new Map<string, ExactEntry>();
  hits = 0;
  misses = 0;

  constructor(
    public maxSize = 1000,
    public ttl = 3600,
  ) {}

  private hash(model: string, messages: Message[], temperature: number): string {
    const keyData = sortedJson({ model, messages, temperature });
    return createHash("sha256").update(keyData, "utf8").digest("hex");
  }

  get(model: string, messages: Message[], temperature = 0.0): string | null {
    if (temperature > 0) {
      this.misses++;
      return null;
    }
    const key = this.hash(model, messages, temperature);
    const entry = this.cache.get(key);
    if (entry) {
      if (now() - entry.timestamp < this.ttl) {
        this.hits++;
        entry.access_count++;
        return entry.response;
      }
      this.cache.delete(key);
    }
    this.misses++;
    return null;
  }

  put(model: string, messages: Message[], temperature: number, response: string): void {
    if (temperature > 0) return;
    if (this.cache.size >= this.maxSize) {
      let oldestKey = "";
      let oldest = Infinity;
      for (const [k, e] of this.cache) {
        if (e.timestamp < oldest) {
          oldest = e.timestamp;
          oldestKey = k;
        }
      }
      this.cache.delete(oldestKey);
    }
    const key = this.hash(model, messages, temperature);
    this.cache.set(key, { response, timestamp: now(), access_count: 1 });
  }

  stats(): Record<string, PyVal> {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hit_rate: total > 0 ? new PyFloat(pyRound(this.hits / total, 4)) : 0,
      cache_size: this.cache.size,
    };
  }
}

type SparseVec = Map<string, number>;

function simpleEmbed(text: string): SparseVec {
  const vocab: SparseVec = new Map();
  for (const w of pySplit(text.toLowerCase())) vocab.set(w, (vocab.get(w) ?? 0) + 1);
  let sumSq = 0;
  for (const v of vocab.values()) sumSq += v * v;
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return new Map();
  const out: SparseVec = new Map();
  for (const [k, v] of vocab) out.set(k, v / norm);
  return out;
}

function cosineSimilarity(a: SparseVec, b: SparseVec): number {
  if (a.size === 0 || b.size === 0) return 0.0;
  const allKeys = new Set([...a.keys(), ...b.keys()]);
  let dot = 0;
  for (const k of allKeys) dot += (a.get(k) ?? 0) * (b.get(k) ?? 0);
  return dot;
}

interface SemanticEntry {
  query: string;
  embedding: SparseVec;
  response: string;
  timestamp: number;
  access_count: number;
}

interface SemanticHit {
  response: string;
  similarity: number;
  original_query: string;
}

class SemanticCache {
  entries: SemanticEntry[] = [];
  hits = 0;
  misses = 0;

  constructor(
    public threshold = 0.85,
    public maxSize = 500,
    public ttl = 3600,
  ) {}

  get(query: string): SemanticHit | null {
    const queryEmbedding = simpleEmbed(query);
    const t = now();
    let bestMatch: SemanticEntry | null = null;
    let bestSim = 0.0;
    for (const entry of this.entries) {
      if (t - entry.timestamp > this.ttl) continue;
      const sim = cosineSimilarity(queryEmbedding, entry.embedding);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatch = entry;
      }
    }
    if (bestMatch && bestSim >= this.threshold) {
      this.hits++;
      bestMatch.access_count++;
      return { response: bestMatch.response, similarity: pyRound(bestSim, 4), original_query: bestMatch.query };
    }
    this.misses++;
    return null;
  }

  put(query: string, response: string): void {
    if (this.entries.length >= this.maxSize) {
      this.entries.sort((x, y) => x.timestamp - y.timestamp);
      this.entries.shift();
    }
    this.entries.push({ query, embedding: simpleEmbed(query), response, timestamp: now(), access_count: 1 });
  }

  stats(): Record<string, PyVal> {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hit_rate: total > 0 ? new PyFloat(pyRound(this.hits / total, 4)) : 0,
      cache_size: this.entries.length,
    };
  }
}

interface Bucket {
  tokens: number;
  capacity: number;
  refill_rate: number;
  last_refill: number;
  request_timestamps: number[];
  max_rpm: number;
  tier: string;
  total_tokens_used: number;
}

interface CheckResult {
  allowed: boolean;
  reason?: string;
  tokens_available?: number;
  retry_after_seconds?: number;
}

class TokenBucketRateLimiter {
  buckets = new Map<string, Bucket>();
  tiers: Record<string, { capacity: number; refill_rate: number; max_requests_per_min: number }> = {
    free: { capacity: 50_000, refill_rate: 500, max_requests_per_min: 10 },
    pro: { capacity: 500_000, refill_rate: 5_000, max_requests_per_min: 60 },
    enterprise: { capacity: 5_000_000, refill_rate: 50_000, max_requests_per_min: 300 },
  };

  private getBucket(userId: string, tier = "free"): Bucket {
    let bucket = this.buckets.get(userId);
    if (!bucket) {
      const tierConfig = this.tiers[tier] ?? this.tiers.free;
      bucket = {
        tokens: tierConfig.capacity,
        capacity: tierConfig.capacity,
        refill_rate: tierConfig.refill_rate,
        last_refill: now(),
        request_timestamps: [],
        max_rpm: tierConfig.max_requests_per_min,
        tier,
        total_tokens_used: 0,
      };
      this.buckets.set(userId, bucket);
    }
    return bucket;
  }

  private refill(bucket: Bucket): void {
    const t = now();
    const elapsed = t - bucket.last_refill;
    const refill = Math.trunc(elapsed * bucket.refill_rate);
    if (refill > 0) {
      bucket.tokens = Math.min(bucket.capacity, bucket.tokens + refill);
      bucket.last_refill = t;
    }
  }

  check(userId: string, tokensNeeded: number, tier = "free"): CheckResult {
    const bucket = this.getBucket(userId, tier);
    this.refill(bucket);
    const t = now();
    bucket.request_timestamps = bucket.request_timestamps.filter((ts) => t - ts < 60);
    if (bucket.request_timestamps.length >= bucket.max_rpm) {
      return { allowed: false, reason: "rate_limit", retry_after_seconds: 60 - (t - bucket.request_timestamps[0]) };
    }
    if (bucket.tokens < tokensNeeded) {
      const deficit = tokensNeeded - bucket.tokens;
      const wait = deficit / bucket.refill_rate;
      return {
        allowed: false,
        reason: "token_limit",
        tokens_available: bucket.tokens,
        retry_after_seconds: pyRound(wait, 1),
      };
    }
    return { allowed: true, tokens_available: bucket.tokens };
  }

  consume(userId: string, tokensUsed: number, tier = "free"): void {
    const bucket = this.getBucket(userId, tier);
    bucket.tokens -= tokensUsed;
    bucket.request_timestamps.push(now());
    bucket.total_tokens_used += tokensUsed;
  }

  getUsage(userId: string): Record<string, PyVal> {
    const b = this.buckets.get(userId);
    if (!b) return { error: "User not found" };
    return {
      user_id: userId,
      tier: b.tier,
      tokens_remaining: b.tokens,
      capacity: b.capacity,
      total_tokens_used: b.total_tokens_used,
      utilization: b.capacity ? new PyFloat(pyRound(b.total_tokens_used / b.capacity, 4)) : 0,
    };
  }
}

interface LogEntry {
  timestamp: number;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  latency_ms: number;
  cost: number;
  user_id: string;
  cache_status: string;
}

interface Alert {
  level: string;
  message: string;
  timestamp: number;
}

interface ModelBreakdown {
  calls: number;
  cost: number;
  input_tokens: number;
  output_tokens: number;
}

interface Summary {
  total_calls: number;
  total_cost: number;
  avg_cost_per_call: number;
  avg_latency_ms: number;
  cache_hit_rate: number;
  cost_by_model: Map<string, ModelBreakdown>;
  cache_savings: { saved: number; cache_hits: number };
  budget_remaining: number;
  budget_utilization: number;
  alerts: Alert[];
}

class CostTracker {
  logs: LogEntry[] = [];
  alerts: Alert[] = [];

  constructor(public monthlyBudget = 1000.0) {}

  logCall(
    model: string,
    inputTokens: number,
    outputTokens: number,
    opts: { cachedInputTokens?: number; latencyMs?: number; userId?: string; cacheStatus?: string } = {},
  ): LogEntry {
    const cachedInputTokens = opts.cachedInputTokens ?? 0;
    const cost = calculateCost(model, inputTokens, outputTokens, cachedInputTokens);
    const entry: LogEntry = {
      timestamp: now(),
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cached_input_tokens: cachedInputTokens,
      latency_ms: opts.latencyMs ?? 0,
      cost: cost.total_cost,
      user_id: opts.userId ?? "anonymous",
      cache_status: opts.cacheStatus ?? "miss",
    };
    this.logs.push(entry);
    this.checkBudget();
    return entry;
  }

  private checkBudget(): void {
    const total = this.totalCost();
    const pct = this.monthlyBudget > 0 ? total / this.monthlyBudget : 0;
    const has = (level: string) => this.alerts.some((a) => a.level === level);
    const msg = (p: number) => `Budget ${p}% consumed: $${pyFixed(total, 2)}/$${pyFixed(this.monthlyBudget, 2)}`;
    if (pct >= 0.95 && !has("stop")) {
      this.alerts.push({ level: "stop", message: msg(95), timestamp: now() });
    } else if (pct >= 0.85 && !has("throttle")) {
      this.alerts.push({ level: "throttle", message: msg(85), timestamp: now() });
    } else if (pct >= 0.7 && !has("warning")) {
      this.alerts.push({ level: "warning", message: msg(70), timestamp: now() });
    }
  }

  totalCost(): number {
    return pyRound(
      this.logs.reduce((s, e) => s + e.cost, 0),
      6,
    );
  }

  costByModel(): Map<string, ModelBreakdown> {
    const byModel = new Map<string, ModelBreakdown>();
    for (const e of this.logs) {
      let m = byModel.get(e.model);
      if (!m) {
        m = { calls: 0, cost: 0, input_tokens: 0, output_tokens: 0 };
        byModel.set(e.model, m);
      }
      m.calls++;
      m.cost = pyRound(m.cost + e.cost, 6);
      m.input_tokens += e.input_tokens;
      m.output_tokens += e.output_tokens;
    }
    return byModel;
  }

  cacheSavings(): { saved: number; cache_hits: number } {
    const cacheHits = this.logs.filter((e) => e.cache_status === "hit");
    if (cacheHits.length === 0) return { saved: 0, cache_hits: 0 };
    let saved = 0;
    for (const e of cacheHits) saved += calculateCost(e.model, e.input_tokens, e.output_tokens).total_cost;
    return { saved: pyRound(saved, 4), cache_hits: cacheHits.length };
  }

  summary(): Summary | { total_calls: number; total_cost: number } {
    if (this.logs.length === 0) return { total_calls: 0, total_cost: 0 };
    const totalLatency = this.logs.reduce((s, e) => s + e.latency_ms, 0);
    const cacheHits = this.logs.filter((e) => e.cache_status === "hit").length;
    const n = this.logs.length;
    return {
      total_calls: n,
      total_cost: this.totalCost(),
      avg_cost_per_call: pyRound(this.totalCost() / n, 6),
      avg_latency_ms: pyRound(totalLatency / n, 1),
      cache_hit_rate: pyRound(cacheHits / n, 4),
      cost_by_model: this.costByModel(),
      cache_savings: this.cacheSavings(),
      budget_remaining: pyRound(this.monthlyBudget - this.totalCost(), 2),
      budget_utilization: this.monthlyBudget > 0 ? pyRound(this.totalCost() / this.monthlyBudget, 4) : 0,
      alerts: this.alerts,
    };
  }
}

const SIMPLE_KEYWORDS = ["what time", "hours", "address", "phone", "price", "return policy", "hello", "hi", "thanks", "yes", "no"];
const COMPLEX_KEYWORDS = ["analyze", "compare", "explain why", "write code", "debug", "architect", "design", "trade-off", "evaluate"];

function classifyComplexity(query: string): string {
  const q = query.toLowerCase();
  if (pySplit(q).length <= 5 || SIMPLE_KEYWORDS.some((kw) => q.includes(kw))) return "simple";
  if (COMPLEX_KEYWORDS.some((kw) => q.includes(kw))) return "complex";
  return "medium";
}

function routeModel(query: string, tier = "pro"): { query: string; complexity: string; model: string; tier: string } {
  const complexity = classifyComplexity(query);
  const routingTable: Record<string, Record<string, string>> = {
    simple: { free: "gpt-4.1-nano", pro: "gpt-4o-mini", enterprise: "gpt-4o-mini" },
    medium: { free: "gpt-4o-mini", pro: "claude-sonnet-4", enterprise: "claude-sonnet-4" },
    complex: { free: "gpt-4o-mini", pro: "gpt-4o", enterprise: "claude-opus-4" },
  };
  const model = routingTable[complexity][tier] ?? "gpt-4o-mini";
  return { query, complexity, model, tier };
}

function simulateLlmCall(model: string, query: string) {
  const words = pySplit(query).length;
  const inputTokens = words * 4 + 500;
  const outputTokens = 150 + words * 2;
  const latency = 200 + outputTokens * 2;
  return {
    model,
    response: `[Simulated ${model} response to: ${query.slice(0, 50)}...]`,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: latency,
  };
}

function runDemo(): void {
  console.log("=".repeat(60));
  console.log("  Caching, Rate Limiting & Cost Optimization Demo");
  console.log("=".repeat(60));

  console.log("\n--- Model Pricing ---");
  for (const model of Object.keys(MODEL_PRICING).slice(0, 6)) {
    const cost1k = calculateCost(model, 1000, 500);
    console.log(`  ${model}: $${pyFixed(cost1k.total_cost, 6)} per 1K in + 500 out`);
  }

  console.log("\n--- Cost Comparison: 100K Requests ---");
  for (const model of ["gpt-4o", "gpt-4o-mini", "claude-sonnet-4", "claude-haiku-3.5"]) {
    const cost = calculateCost(model, 1000 * 100_000, 500 * 100_000);
    console.log(`  ${model}: $${pyFixed(cost.total_cost, 2)}`);
  }

  console.log("\n--- Anthropic Cache Savings ---");
  const noCache = calculateCost("claude-sonnet-4", 2000, 500, 0);
  const withCache = calculateCost("claude-sonnet-4", 2000, 500, 1500);
  const saving = noCache.total_cost - withCache.total_cost;
  console.log(`  Without cache: $${pyFixed(noCache.total_cost, 6)}`);
  console.log(`  With 1500 cached tokens: $${pyFixed(withCache.total_cost, 6)}`);
  console.log(`  Savings per call: $${pyFixed(saving, 6)} (${pyFixed((saving / noCache.total_cost) * 100, 1)}%)`);

  const exactCache = new ExactCache(100, 300);
  const semanticCache = new SemanticCache(0.75, 100);
  const rateLimiter = new TokenBucketRateLimiter();
  const tracker = new CostTracker(100.0);

  console.log("\n--- Exact Cache ---");
  const messages1: Message[] = [{ role: "user", content: "What is the return policy?" }];
  let result = exactCache.get("gpt-4o-mini", messages1, 0.0);
  console.log(`  First lookup: ${result ? "HIT" : "MISS"}`);
  exactCache.put("gpt-4o-mini", messages1, 0.0, "You can return items within 30 days.");
  result = exactCache.get("gpt-4o-mini", messages1, 0.0);
  console.log(`  Second lookup: ${result ? "HIT" : "MISS"} -> ${result}`);
  result = exactCache.get("gpt-4o-mini", messages1, 0.7);
  console.log(`  With temp=0.7: ${result ? "HIT" : "MISS (non-deterministic, skip cache)"}`);
  console.log(`  Stats: ${pyDictRepr(exactCache.stats())}`);

  console.log("\n--- Semantic Cache ---");
  const testQueries: [string, string | null][] = [
    ["What is the return policy?", "Items can be returned within 30 days with receipt."],
    ["How do I return an item?", null],
    ["What are your store hours?", "We are open 9am-9pm Monday through Saturday."],
    ["When does the store open?", null],
    ["Tell me about quantum computing", "Quantum computers use qubits..."],
    ["Explain quantum mechanics", null],
  ];
  for (const [query, response] of testQueries) {
    const cached = semanticCache.get(query);
    if (cached) {
      console.log(
        `  '${query.slice(0, 40)}' -> CACHE HIT (sim=${pyFloatRepr(cached.similarity)}, original='${cached.original_query.slice(0, 40)}')`,
      );
    } else if (response) {
      semanticCache.put(query, response);
      console.log(`  '${query.slice(0, 40)}' -> MISS (stored)`);
    } else {
      console.log(`  '${query.slice(0, 40)}' -> MISS (no match)`);
    }
  }
  console.log(`  Stats: ${pyDictRepr(semanticCache.stats())}`);

  console.log("\n--- Rate Limiting ---");
  for (let i = 0; i < 12; i++) {
    const check = rateLimiter.check("user_1", 1000, "free");
    if (check.allowed) rateLimiter.consume("user_1", 1000, "free");
    const status = check.allowed ? "OK" : `BLOCKED (${check.reason})`;
    if (i < 5 || !check.allowed) console.log(`  Request ${i + 1}: ${status}`);
  }
  console.log(`  Usage: ${pyDictRepr(rateLimiter.getUsage("user_1"))}`);

  console.log("\n--- Model Routing ---");
  const routingQueries = [
    "What time do you close?",
    "Summarize this quarterly earnings report",
    "Analyze the trade-offs between microservices and monoliths",
    "Hello",
    "Write code for a binary search tree with deletion",
  ];
  for (const q of routingQueries) {
    const route = routeModel(q, "pro");
    console.log(`  '${q.slice(0, 50)}' -> ${route.model} (${route.complexity})`);
  }

  console.log("\n--- Full Pipeline: Before vs After Optimization ---");
  const queries = [
    "What is the return policy?",
    "How do I return something?",
    "What are your hours?",
    "When do you open?",
    "Explain the difference between TCP and UDP",
    "Compare TCP vs UDP protocols",
    "Hello",
    "What is your phone number?",
    "Write a Python function to sort a list",
    "Analyze the pros and cons of serverless architecture",
  ];

  console.log("\n  [Before: no caching, single model (gpt-4o)]");
  const trackerBefore = new CostTracker(1000.0);
  for (const q of queries) {
    const r = simulateLlmCall("gpt-4o", q);
    trackerBefore.logCall("gpt-4o", r.input_tokens, r.output_tokens, { latencyMs: r.latency_ms, cacheStatus: "miss" });
  }
  const before = trackerBefore.summary() as Summary;
  console.log(`  Total cost: $${pyFixed(before.total_cost, 6)}`);
  console.log(`  Avg cost/call: $${pyFixed(before.avg_cost_per_call, 6)}`);
  console.log(`  Avg latency: ${pyFloatRepr(before.avg_latency_ms)}ms`);

  console.log("\n  [After: caching + routing + rate limiting]");
  const exactC = new ExactCache();
  const semanticC = new SemanticCache(0.75);
  const trackerAfter = new CostTracker(1000.0);

  for (const q of queries) {
    const messages: Message[] = [{ role: "user", content: q }];
    if (exactC.get("gpt-4o", messages, 0.0)) {
      trackerAfter.logCall("gpt-4o-mini", 0, 0, { latencyMs: 5, cacheStatus: "hit" });
      continue;
    }
    if (semanticC.get(q)) {
      trackerAfter.logCall("gpt-4o-mini", 0, 0, { latencyMs: 15, cacheStatus: "hit" });
      continue;
    }
    const route = routeModel(q);
    const r = simulateLlmCall(route.model, q);
    trackerAfter.logCall(route.model, r.input_tokens, r.output_tokens, { latencyMs: r.latency_ms, cacheStatus: "miss" });
    exactC.put(route.model, messages, 0.0, r.response);
    semanticC.put(q, r.response);
  }

  const after = trackerAfter.summary() as Summary;
  console.log(`  Total cost: $${pyFixed(after.total_cost, 6)}`);
  console.log(`  Avg cost/call: $${pyFixed(after.avg_cost_per_call, 6)}`);
  console.log(`  Avg latency: ${pyFloatRepr(after.avg_latency_ms)}ms`);
  console.log(`  Cache hit rate: ${pyFixed(after.cache_hit_rate * 100, 0)}%`);

  if (before.total_cost > 0) {
    const savingsPct = (1 - after.total_cost / before.total_cost) * 100;
    console.log(`\n  SAVINGS: ${pyFixed(savingsPct, 1)}% cost reduction`);
    console.log(`  Latency improvement: ${pyFixed((1 - after.avg_latency_ms / before.avg_latency_ms) * 100, 1)}% faster`);
  }

  console.log("\n--- Budget Alerts Demo ---");
  const alertTracker = new CostTracker(0.01);
  for (let i = 0; i < 5; i++) alertTracker.logCall("gpt-4o", 5000, 2000, { latencyMs: 500 });
  console.log(`  Total spent: $${pyFixed(alertTracker.totalCost(), 6)} / $${pyFloatRepr(alertTracker.monthlyBudget)}`);
  for (const alert of alertTracker.alerts) console.log(`  ALERT [${alert.level.toUpperCase()}]: ${alert.message}`);

  console.log("\n--- Cost Breakdown by Model ---");
  const multiTracker = new CostTracker(500.0);
  for (let i = 0; i < 50; i++) multiTracker.logCall("gpt-4o-mini", 800, 200, { latencyMs: 150 });
  for (let i = 0; i < 30; i++) multiTracker.logCall("claude-sonnet-4", 1500, 500, { latencyMs: 400 });
  for (let i = 0; i < 10; i++) multiTracker.logCall("gpt-4o", 2000, 800, { latencyMs: 600 });
  for (let i = 0; i < 10; i++) multiTracker.logCall("claude-opus-4", 3000, 1000, { latencyMs: 1200 });
  const breakdown = [...multiTracker.costByModel().entries()].sort((x, y) => y[1].cost - x[1].cost);
  for (const [model, data] of breakdown) {
    console.log(
      `  ${model}: ${data.calls} calls, $${pyFixed(data.cost, 6)}, ${withCommas(data.input_tokens)} in / ${withCommas(data.output_tokens)} out`,
    );
  }
  console.log(`  Total: $${pyFixed(multiTracker.totalCost(), 6)}`);

  console.log("\n" + "=".repeat(60));
  console.log("  Demo complete.");
  console.log("=".repeat(60));
}

runDemo();
