// Lesson: Prompt Caching and Context Caching (phase 11 / lesson 15)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/11-llm-engineering/15-prompt-caching/docs/en.md
// Run: npx tsx phases/11-llm-engineering/15-prompt-caching/code/main.ts

export {};

const PRICES: Record<string, Record<string, number>> = {
  anthropic_claude_opus_4_7: { base: 0.015, cache_write_5m: 0.01875, cache_write_1h: 0.03, cache_read: 0.0015 },
  openai_gpt_5: { base: 0.005, cache_write: 0.005, cache_read: 0.0025 },
  gemini_3_pro: { base: 0.00125, cache_write: 0.00125, cache_read: 0.0003125, storage_per_1k_per_hour: 0.0000125 },
};

interface Request {
  prefix_tokens: number;
  suffix_tokens: number;
  prefix_key: string;
}

interface CacheEntry {
  tokens: number;
  written_at: number;
  ttl_seconds: number;
}

class ProviderStats {
  writes = 0;
  reads = 0;
  misses = 0;
  input_cost = 0.0;
  storage_cost = 0.0;

  get total_cost(): number {
    return this.input_cost + this.storage_cost;
  }
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

function simulateAnthropic(requests: Request[], ttlSeconds: number, secondsBetween: number): ProviderStats {
  const p = PRICES["anthropic_claude_opus_4_7"];
  const writeRate = ttlSeconds > 300 ? p["cache_write_1h"] : p["cache_write_5m"];
  const stats = new ProviderStats();
  const cache = new Map<string, CacheEntry>();
  requests.forEach((r, i) => {
    const nowSeconds = i * secondsBetween;
    const entry = cache.get(r.prefix_key);
    const expired = entry === undefined || nowSeconds - entry.written_at >= entry.ttl_seconds;
    if (expired) {
      stats.writes += 1;
      stats.input_cost += (r.prefix_tokens / 1000) * writeRate;
      cache.set(r.prefix_key, { tokens: r.prefix_tokens, written_at: nowSeconds, ttl_seconds: ttlSeconds });
    } else {
      stats.reads += 1;
      stats.input_cost += (r.prefix_tokens / 1000) * p["cache_read"];
    }
    stats.input_cost += (r.suffix_tokens / 1000) * p["base"];
  });
  return stats;
}

function simulateOpenai(requests: Request[], secondsBetween: number): ProviderStats {
  const p = PRICES["openai_gpt_5"];
  const stats = new ProviderStats();
  const cache = new Map<string, CacheEntry>();
  requests.forEach((r, i) => {
    const nowSeconds = i * secondsBetween;
    const entry = cache.get(r.prefix_key);
    const expired = entry === undefined || nowSeconds - entry.written_at >= 3600;
    if (expired) {
      stats.writes += 1;
      stats.input_cost += (r.prefix_tokens / 1000) * p["cache_write"];
      cache.set(r.prefix_key, { tokens: r.prefix_tokens, written_at: nowSeconds, ttl_seconds: 3600 });
    } else {
      stats.reads += 1;
      stats.input_cost += (r.prefix_tokens / 1000) * p["cache_read"];
    }
    stats.input_cost += (r.suffix_tokens / 1000) * p["base"];
  });
  return stats;
}

function simulateGemini(requests: Request[], ttlSeconds: number, secondsBetween: number): ProviderStats {
  const p = PRICES["gemini_3_pro"];
  const stats = new ProviderStats();
  const cache = new Map<string, CacheEntry>();
  requests.forEach((r, i) => {
    const nowSeconds = i * secondsBetween;
    const entry = cache.get(r.prefix_key);
    const expired = entry === undefined || nowSeconds - entry.written_at >= entry.ttl_seconds;
    if (expired) {
      stats.writes += 1;
      stats.input_cost += (r.prefix_tokens / 1000) * p["cache_write"];
      cache.set(r.prefix_key, { tokens: r.prefix_tokens, written_at: nowSeconds, ttl_seconds: ttlSeconds });
    } else {
      stats.reads += 1;
      stats.input_cost += (r.prefix_tokens / 1000) * p["cache_read"];
    }
    stats.input_cost += (r.suffix_tokens / 1000) * p["base"];
  });
  for (const entry of cache.values()) {
    const hours = entry.ttl_seconds / 3600;
    stats.storage_cost += (entry.tokens / 1000) * p["storage_per_1k_per_hour"] * hours;
  }
  return stats;
}

function baselineCost(requests: Request[], provider: string): number {
  const p = PRICES[provider];
  let total = 0;
  for (const r of requests) total += ((r.prefix_tokens + r.suffix_tokens) / 1000) * p["base"];
  return total;
}

function makeTraffic(nRequests: number, nPrefixes: number, prefixSize: number, suffixSize: number): Request[] {
  const out: Request[] = [];
  for (let i = 0; i < nRequests; i++) {
    out.push({ prefix_tokens: prefixSize, suffix_tokens: suffixSize, prefix_key: `prefix_${i % nPrefixes}` });
  }
  return out;
}

function printReport(name: string, stats: ProviderStats, baseline: number, n: number): void {
  const savings = baseline > 0 ? 1 - stats.total_cost / baseline : 0;
  console.log(`\n${name}`);
  console.log(
    `  writes ${String(stats.writes).padStart(5)}  reads ${String(stats.reads).padStart(5)}  misses ${String(stats.misses).padStart(5)}`,
  );
  console.log(`  input cost  $${pyFixed(stats.input_cost, 4).padStart(7)}`);
  if (stats.storage_cost) console.log(`  storage     $${pyFixed(stats.storage_cost, 4).padStart(7)}`);
  console.log(`  vs no-cache $${pyFixed(baseline, 4).padStart(7)}  ->  saves ${pyFixed(savings * 100, 1).padStart(5)}%`);
  console.log(`  per 1K req  $${pyFixed((stats.total_cost * 1000) / n, 4).padStart(7)}`);
}

function main(): void {
  const traffic = makeTraffic(500, 3, 15000, 400);
  const secondsBetween = 4;

  const anthro5m = simulateAnthropic(traffic, 300, secondsBetween);
  const anthro1h = simulateAnthropic(traffic, 3600, secondsBetween);
  const openai = simulateOpenai(traffic, secondsBetween);
  const gemini = simulateGemini(traffic, 3600, secondsBetween);

  console.log(`Scenario: 500 requests, 3 rotating prefixes (15K tok each), 4s apart\n`);

  printReport("Anthropic Claude Opus 4.7 (5-min TTL)", anthro5m, baselineCost(traffic, "anthropic_claude_opus_4_7"), traffic.length);
  printReport("Anthropic Claude Opus 4.7 (1-hour TTL)", anthro1h, baselineCost(traffic, "anthropic_claude_opus_4_7"), traffic.length);
  printReport("OpenAI GPT-5 (automatic)", openai, baselineCost(traffic, "openai_gpt_5"), traffic.length);
  printReport("Gemini 3 Pro (explicit, 1-hour)", gemini, baselineCost(traffic, "gemini_3_pro"), traffic.length);
}

main();
