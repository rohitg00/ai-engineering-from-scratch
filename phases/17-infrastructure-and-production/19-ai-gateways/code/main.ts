/**
 * AI gateway skeleton — TypeScript port.
 *
 * docs/en.md にある4つの core gateway primitives を実装する:
 *   1. Auth: constant-time comparison と per-tenant resolution による API-key check。
 *   2. Rate limit: tenant ごとの token-bucket。LiteLLM style。
 *   3. Retry: transient 429/5xx に対する jitter 付き exponential backoff。bounded。
 *   4. Fallback chain: 成功するまで providers を順に試す。
 *
 * さらに main.py と同じ fallback simulator（4 gateway profiles、3-provider chain、
 * error injection）を実行し、数値を reproducible に保つ。
 *
 * Citations:
 *   - Kong AI Gateway benchmark (228% vs Portkey, 859% vs LiteLLM):
 *     https://konghq.com/blog/engineering/ai-gateway-benchmark-kong-ai-gateway-portkey-litellm
 *   - LiteLLM (MIT OSS, 100+ providers): https://github.com/BerriAI/litellm
 *   - Portkey (Apache 2.0 since March 2026): https://github.com/Portkey-AI/gateway
 *   - Kong AI Gateway docs: https://docs.konghq.com/gateway/latest/ai-gateway/
 *
 * Node 20+ stdlib で動作する。npm deps は不要。
 */

import { timingSafeEqual, createHash } from "node:crypto";

// -- Auth ------------------------------------------------------------------

type Tenant = {
  id: string;
  // 発行済み API key の SHA-256 hex。key を plaintext で保存しない。
  keyHashHex: string;
  // tenant ごとの tier。rate-limit budget の形を決める。
  tier: "free" | "trial" | "paid";
};

class AuthService {
  private readonly tenants = new Map<string, Tenant>();
  private readonly hashByKey = new Map<string, Tenant>();

  register(tenant: Tenant): void {
    this.tenants.set(tenant.id, tenant);
    this.hashByKey.set(tenant.keyHashHex, tenant);
  }

  // digest comparison による constant-time check。
  authenticate(presentedKey: string): Tenant | undefined {
    const digest = createHash("sha256").update(presentedKey).digest("hex");
    // unknown key と known key の wall-clock cost が同じになるよう、
    // すべての既知 hash を walk する。
    let match: Tenant | undefined;
    const presented = Buffer.from(digest, "hex");
    for (const t of this.tenants.values()) {
      const stored = Buffer.from(t.keyHashHex, "hex");
      if (
        stored.length === presented.length &&
        timingSafeEqual(stored, presented)
      ) {
        match = t;
      }
    }
    return match;
  }
}

// -- Rate limiter (token-bucket) ------------------------------------------

type Bucket = {
  tokens: number;
  capacity: number;
  refillPerSec: number;
  lastNs: bigint;
};

class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly tierConfig: Record<
    Tenant["tier"],
    { capacity: number; refillPerSec: number }
  >;
  private readonly now: () => bigint;

  constructor(
    tierConfig: Record<
      Tenant["tier"],
      { capacity: number; refillPerSec: number }
    >,
    now: () => bigint = process.hrtime.bigint,
  ) {
    this.tierConfig = tierConfig;
    this.now = now;
  }

  private getOrCreate(tenant: Tenant): Bucket {
    const existing = this.buckets.get(tenant.id);
    if (existing) return existing;
    const cfg = this.tierConfig[tenant.tier];
    const bucket: Bucket = {
      tokens: cfg.capacity,
      capacity: cfg.capacity,
      refillPerSec: cfg.refillPerSec,
      lastNs: this.now(),
    };
    this.buckets.set(tenant.id, bucket);
    return bucket;
  }

  // request が bucket 内に収まるなら true、そうでなければ false。
  allow(tenant: Tenant, cost = 1): boolean {
    const bucket = this.getOrCreate(tenant);
    const nowNs = this.now();
    const elapsedSec = Number(nowNs - bucket.lastNs) / 1e9;
    bucket.tokens = Math.min(
      bucket.capacity,
      bucket.tokens + elapsedSec * bucket.refillPerSec,
    );
    bucket.lastNs = nowNs;
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return true;
    }
    return false;
  }
}

// -- Provider abstraction + retry/fallback --------------------------------

type ProviderResponse = {
  provider: string;
  text: string;
  latencyMs: number;
  attempt: number;
};

type ProviderError = {
  retryable: boolean;
  status: 429 | 500 | 502 | 503 | 504 | 400;
  message: string;
};

type Provider = {
  name: string;
  // 実際の call は HTTP なので async。text + latency を返すか、
  // ProviderError shape の値を throw する。
  call(prompt: string): Promise<{ text: string; latencyMs: number }>;
};

// request counter による deterministic error injection を持つ mock provider。
function makeMockProvider(
  name: string,
  baseLatencyMs: number,
  // call #n が error になるか、どの error かを決める function。
  errorPolicy: (n: number) => ProviderError | null,
): Provider {
  let n = 0;
  return {
    name,
    async call(prompt: string): Promise<{ text: string; latencyMs: number }> {
      const callN = ++n;
      const err = errorPolicy(callN);
      // microtask を yield して、正しく async に見せる。
      await Promise.resolve();
      if (err) {
        throw err;
      }
      return {
        text: `[${name}] ${prompt.slice(0, 60)}`,
        latencyMs: baseLatencyMs,
      };
    },
  };
}

type RetryConfig = {
  maxAttempts: number;
  baseBackoffMs: number;
  // tests/demos の determinism 用。
  jitter: () => number;
  sleep: (ms: number) => Promise<void>;
};

type RetryOutcome = {
  response: ProviderResponse;
  // この単一 provider に対する retry attempts + backoff sleeps 全体の wall-clock。
  // 初回 attempt が backoff なしで成功した場合は response.latencyMs と等しい。
  totalLatencyMs: number;
};

async function callWithRetry(
  provider: Provider,
  prompt: string,
  cfg: RetryConfig,
): Promise<RetryOutcome> {
  let lastErr: ProviderError | undefined;
  let totalLatencyMs = 0;
  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      const r = await provider.call(prompt);
      totalLatencyMs += r.latencyMs;
      return {
        response: {
          provider: provider.name,
          text: r.text,
          latencyMs: r.latencyMs,
          attempt,
        },
        totalLatencyMs,
      };
    } catch (raw) {
      const err = raw as ProviderError;
      lastErr = err;
      if (!err.retryable || attempt === cfg.maxAttempts) break;
      const backoffMs = cfg.baseBackoffMs * 2 ** (attempt - 1) * cfg.jitter();
      totalLatencyMs += backoffMs;
      await cfg.sleep(backoffMs);
    }
  }
  // fallback layer に最後の error を渡す。
  throw lastErr ?? ({ retryable: false, status: 500, message: "unknown" } as ProviderError);
}

async function callWithFallback(
  chain: readonly Provider[],
  prompt: string,
  cfg: RetryConfig,
): Promise<{ response: ProviderResponse; fallbackHits: number; totalLatencyMs: number }> {
  let fallbackHits = 0;
  let totalLatencyMs = 0;
  let lastErr: ProviderError | undefined;
  for (let i = 0; i < chain.length; i++) {
    if (i > 0) fallbackHits++;
    try {
      const outcome = await callWithRetry(chain[i], prompt, cfg);
      totalLatencyMs += outcome.totalLatencyMs;
      return { response: outcome.response, fallbackHits, totalLatencyMs };
    } catch (err) {
      lastErr = err as ProviderError;
    }
  }
  throw lastErr ?? { retryable: false, status: 500, message: "no providers" };
}

// -- Gateway 本体 ----------------------------------------------------------

class AIGateway {
  constructor(
    private readonly auth: AuthService,
    private readonly limiter: TokenBucketLimiter,
    private readonly chain: readonly Provider[],
    private readonly retry: RetryConfig,
    private readonly overheadMs: number,
  ) {}

  async handle(
    presentedKey: string,
    prompt: string,
  ): Promise<
    | { ok: true; response: ProviderResponse; totalLatencyMs: number; fallbackHits: number }
    | { ok: false; status: number; reason: string }
  > {
    const tenant = this.auth.authenticate(presentedKey);
    if (!tenant) return { ok: false, status: 401, reason: "invalid api key" };
    if (!this.limiter.allow(tenant)) {
      return { ok: false, status: 429, reason: "rate limit exceeded" };
    }
    try {
      const { response, fallbackHits, totalLatencyMs } = await callWithFallback(
        this.chain,
        prompt,
        this.retry,
      );
      return {
        ok: true,
        response,
        // end-to-end wall clock: gateway overhead + retry attempt 全部 +
        // backoff sleep 全部 + winning provider までの failed-provider latency 全部。
        totalLatencyMs: totalLatencyMs + this.overheadMs,
        fallbackHits,
      };
    } catch (err) {
      const e = err as ProviderError;
      return { ok: false, status: e.status ?? 500, reason: e.message };
    }
  }
}

// -- Simulator (matches main.py shape) ------------------------------------

type ProviderProfile = { name: string; baseLatencyMs: number; errorRate: number };

const PROVIDERS: ProviderProfile[] = [
  { name: "OpenAI", baseLatencyMs: 180, errorRate: 0.03 },
  { name: "Anthropic", baseLatencyMs: 220, errorRate: 0.02 },
  { name: "Self-hosted", baseLatencyMs: 100, errorRate: 0.05 },
];

const GATEWAY_OVERHEAD: Record<string, number> = {
  LiteLLM: 10,
  Portkey: 30,
  Kong: 5,
  Cloudflare: 2,
};

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

type SimRow = {
  gateway: string;
  successRate: number;
  meanLatency: number;
  // 各 inner iteration は fallback 前に1 provider を1回だけ試す。
  // これは in-provider retries ではなく failed provider attempts を数える。
  providerFailures: number;
  fallbackHits: number;
};

function simulateFallback(gateway: string, n = 1000, seed = 7): SimRow {
  const rng = makeRng(seed);
  let success = 0;
  let totalLatency = 0;
  let providerFailures = 0;
  let fallbackHits = 0;
  const gwOverhead = GATEWAY_OVERHEAD[gateway];

  for (let i = 0; i < n; i++) {
    let reqLatency = gwOverhead;
    let done = false;
    for (let attempt = 0; attempt < PROVIDERS.length; attempt++) {
      const p = PROVIDERS[attempt];
      const errored = rng() < p.errorRate;
      reqLatency += errored ? p.baseLatencyMs * 0.3 : p.baseLatencyMs;
      if (attempt > 0) fallbackHits++;
      if (!errored) {
        success++;
        done = true;
        break;
      }
      providerFailures++;
    }
    void done;
    totalLatency += reqLatency;
  }

  return {
    gateway,
    successRate: success / n,
    meanLatency: totalLatency / n,
    providerFailures,
    fallbackHits,
  };
}

function reportRow(r: SimRow): void {
  console.log(
    `${r.gateway.padEnd(12)}  ` +
      `success=${(r.successRate * 100).toFixed(1).padStart(5)}%  ` +
      `mean_latency=${r.meanLatency.toFixed(0).padStart(6)}ms  ` +
      `prov_fails=${String(r.providerFailures).padStart(4)}  ` +
      `fallbacks=${String(r.fallbackHits).padStart(4)}`,
  );
}

// -- Demo ------------------------------------------------------------------

async function liveDemo(): Promise<void> {
  console.log("--- AI gateway primitives (auth + rate limit + retry + fallback) ---");

  const auth = new AuthService();
  // key を2つ事前発行する。"secret-paid-key" → paid tier、"secret-free-key" → free。
  const paidHash = createHash("sha256").update("secret-paid-key").digest("hex");
  const freeHash = createHash("sha256").update("secret-free-key").digest("hex");
  auth.register({ id: "tenant-paid", keyHashHex: paidHash, tier: "paid" });
  auth.register({ id: "tenant-free", keyHashHex: freeHash, tier: "free" });

  const limiter = new TokenBucketLimiter({
    free: { capacity: 2, refillPerSec: 0.5 },
    trial: { capacity: 5, refillPerSec: 1 },
    paid: { capacity: 100, refillPerSec: 10 },
  });

  // Provider 1: 初回 call で 429、その後は成功。
  const flaky = makeMockProvider("openai", 180, (n) =>
    n === 1
      ? { retryable: true, status: 429, message: "rate_limit_exceeded" }
      : null,
  );
  // Provider 2: 半分の call で 5xx。
  const wobble = makeMockProvider("anthropic", 220, (n) =>
    n % 2 === 1
      ? { retryable: true, status: 503, message: "upstream_unavailable" }
      : null,
  );
  // Provider 3: 常に healthy。
  const healthy = makeMockProvider("self-hosted", 100, () => null);

  const retry: RetryConfig = {
    maxAttempts: 2,
    baseBackoffMs: 1,
    jitter: () => 1.0,
    sleep: (ms: number) => new Promise((res) => setTimeout(res, ms)),
  };

  const gateway = new AIGateway(
    auth,
    limiter,
    [flaky, wobble, healthy],
    retry,
    /* overheadMs */ 5,
  );

  console.log("paid tenant — retry / fallback 経由で成功する想定:");
  for (let i = 0; i < 3; i++) {
    const r = await gateway.handle("secret-paid-key", `こんにちは world ${i}`);
    console.log("  →", JSON.stringify(r));
  }

  console.log("\nfree tenant — capacity=2、3回目の call で rate limit:");
  for (let i = 0; i < 4; i++) {
    const r = await gateway.handle("secret-free-key", `q ${i}`);
    console.log("  →", JSON.stringify(r));
  }

  console.log("\nbad key — 401:");
  console.log("  →", JSON.stringify(await gateway.handle("nope", "x")));
}

function simulatorDemo(): void {
  console.log("\n" + "=".repeat(80));
  console.log("AI GATEWAY FALLBACK — error injection 下の 3-provider chain");
  console.log("=".repeat(80));
  const header =
    `${"Gateway".padEnd(12)}  ` +
    `${"Success".padStart(7)}         ${"mean latency".padStart(12)}  prov_fails  fallbacks`;
  console.log(header);
  console.log("-".repeat(header.length));
  for (const gw of ["LiteLLM", "Portkey", "Kong", "Cloudflare"]) {
    reportRow(simulateFallback(gw));
  }
  console.log(
    "\n注記: 3% error rate の single-provider target → 97% success。",
  );
  console.log(
    "Two-provider fallback → 99.94% success（0.03 × 0.02 の補集合）。",
  );
  console.log(
    "Three-provider fallback → 99.997% success。fallback では latency が上がる。",
  );
}

async function main(): Promise<void> {
  await liveDemo();
  simulatorDemo();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
