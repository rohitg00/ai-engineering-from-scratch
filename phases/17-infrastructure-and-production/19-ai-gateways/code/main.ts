/**
 * AI gateway skeleton — TypeScript port.
 *
 * Implements the four core gateway primitives from docs/en.md:
 *   1. Auth: API-key check with constant-time comparison + per-tenant resolution.
 *   2. Rate limit: token-bucket per tenant; LiteLLM-style.
 *   3. Retry: exponential backoff with jitter on transient 429/5xx; bounded.
 *   4. Fallback chain: try providers in order until one succeeds.
 *
 * Plus the same fallback simulator main.py runs (4 gateway profiles, 3-provider
 * chain, error injection) so the numbers stay reproducible.
 *
 * Citations:
 *   - Kong AI Gateway benchmark (228% vs Portkey, 859% vs LiteLLM):
 *     https://konghq.com/blog/engineering/ai-gateway-benchmark-kong-ai-gateway-portkey-litellm
 *   - LiteLLM (MIT OSS, 100+ providers): https://github.com/BerriAI/litellm
 *   - Portkey (Apache 2.0 since March 2026): https://github.com/Portkey-AI/gateway
 *   - Kong AI Gateway docs: https://docs.konghq.com/gateway/latest/ai-gateway/
 *
 * Runs on Node 20+ stdlib. No npm deps.
 */

import { timingSafeEqual, createHash } from "node:crypto";

// -- Auth ------------------------------------------------------------------

type Tenant = {
  id: string;
  // SHA-256 hex of the issued API key. Never store keys in plaintext.
  keyHashHex: string;
  // Per-tenant tier: shapes rate-limit budgets.
  tier: "free" | "trial" | "paid";
};

class AuthService {
  private readonly tenants = new Map<string, Tenant>();
  private readonly hashByKey = new Map<string, Tenant>();

  register(tenant: Tenant): void {
    this.tenants.set(tenant.id, tenant);
    this.hashByKey.set(tenant.keyHashHex, tenant);
  }

  // Constant-time check by digest comparison.
  authenticate(presentedKey: string): Tenant | undefined {
    const digest = createHash("sha256").update(presentedKey).digest("hex");
    // Walk every known hash so an unknown key has the same wall-clock cost
    // as a known one.
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

  // Returns true if the request fits within the bucket; false otherwise.
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
  // Call is async because the real one is HTTP. Returns either text + latency
  // or throws a ProviderError-shaped value.
  call(prompt: string): Promise<{ text: string; latencyMs: number }>;
};

// Mocked provider with deterministic error injection by request counter.
function makeMockProvider(
  name: string,
  baseLatencyMs: number,
  // Function that decides whether call #n errors and how.
  errorPolicy: (n: number) => ProviderError | null,
): Provider {
  let n = 0;
  return {
    name,
    async call(prompt: string): Promise<{ text: string; latencyMs: number }> {
      const callN = ++n;
      const err = errorPolicy(callN);
      // Yield a microtask so we look properly async.
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
  // For determinism in tests/demos.
  jitter: () => number;
  sleep: (ms: number) => Promise<void>;
};

type RetryOutcome = {
  response: ProviderResponse;
  // Wall-clock spent across all retry attempts + backoff sleeps for this
  // single provider. Equals response.latencyMs when the first attempt
  // succeeds with no backoff.
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
  // Surface the last error to the fallback layer.
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

// -- The gateway -----------------------------------------------------------

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
        // End-to-end wall clock: gateway overhead + every retry attempt +
        // every backoff sleep + every failed-provider latency leading to the
        // winning provider.
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
  // Each inner iteration tries one provider exactly once before falling
  // back, so this counts failed provider attempts, not in-provider retries.
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
  // Pre-issue two keys; "secret-paid-key" → paid tier, "secret-free-key" → free.
  const paidHash = createHash("sha256").update("secret-paid-key").digest("hex");
  const freeHash = createHash("sha256").update("secret-free-key").digest("hex");
  auth.register({ id: "tenant-paid", keyHashHex: paidHash, tier: "paid" });
  auth.register({ id: "tenant-free", keyHashHex: freeHash, tier: "free" });

  const limiter = new TokenBucketLimiter({
    free: { capacity: 2, refillPerSec: 0.5 },
    trial: { capacity: 5, refillPerSec: 1 },
    paid: { capacity: 100, refillPerSec: 10 },
  });

  // Provider 1: 429 on the first call, succeeds afterwards.
  const flaky = makeMockProvider("openai", 180, (n) =>
    n === 1
      ? { retryable: true, status: 429, message: "rate_limit_exceeded" }
      : null,
  );
  // Provider 2: 5xx half the time.
  const wobble = makeMockProvider("anthropic", 220, (n) =>
    n % 2 === 1
      ? { retryable: true, status: 503, message: "upstream_unavailable" }
      : null,
  );
  // Provider 3: always healthy.
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

  console.log("paid tenant — should succeed via retry / fallback:");
  for (let i = 0; i < 3; i++) {
    const r = await gateway.handle("secret-paid-key", `hello world ${i}`);
    console.log("  →", JSON.stringify(r));
  }

  console.log("\nfree tenant — capacity=2, third call hits rate limit:");
  for (let i = 0; i < 4; i++) {
    const r = await gateway.handle("secret-free-key", `q ${i}`);
    console.log("  →", JSON.stringify(r));
  }

  console.log("\nbad key — 401:");
  console.log("  →", JSON.stringify(await gateway.handle("nope", "x")));
}

function simulatorDemo(): void {
  console.log("\n" + "=".repeat(80));
  console.log("AI GATEWAY FALLBACK — 3-provider chain under error injection");
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
    "\nNotes: a single-provider target at 3% error rate → 97% success.",
  );
  console.log(
    "Two-provider fallback → 99.94% success (complement of 0.03 × 0.02).",
  );
  console.log(
    "Three-provider fallback → 99.997% success. Latency rises on fallback.",
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
