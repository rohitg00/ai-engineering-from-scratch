// Lesson: Serving Engine Internals: PagedAttention, Continuous Batching, Chunked Prefill (phase 17 / lesson 04)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/04-vllm-serving-internals/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.ts

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

  expovariate(lambd: number): number {
    return -Math.log(1.0 - this.random()) / lambd;
  }

  choice<T>(xs: T[]): T {
    return xs[Math.floor(this.random() * xs.length)];
  }

  randint(a: number, b: number): number {
    return a + Math.floor(this.random() * (b - a + 1));
  }
}

const FORWARD_LATENCY_PER_TOKEN = 0.0005;
const PREFILL_LATENCY_PER_TOKEN = 0.00004;
const BATCH_OVERHEAD = 0.0002;
const CHUNK_SIZE = 512;
const KV_BLOCK_SIZE = 16;
const KV_BLOCKS_AVAILABLE = 1800;

class Request {
  prefilled = 0;
  generated = 0;
  ttft: number | null = null;
  lastTokenAt: number | null = null;
  itlSamples: number[] = [];

  constructor(
    public reqId: number,
    public promptLen: number,
    public outputLen: number,
    public arrivedAt: number,
  ) {}

  get inPrefill(): boolean {
    return this.prefilled < this.promptLen;
  }

  get done(): boolean {
    return this.generated >= this.outputLen;
  }

  blocksNeeded(): number {
    const total = this.promptLen + this.outputLen;
    return Math.floor((total + KV_BLOCK_SIZE - 1) / KV_BLOCK_SIZE);
  }
}

function makeWorkload(n = 60, seed = 9): Request[] {
  const rng = new Rng(seed);
  const reqs: Request[] = [];
  let now = 0.0;
  for (let i = 0; i < n; i++) {
    now += rng.expovariate(40.0);
    const promptLen = rng.choice([128, 256, 512, 2048, 8192]);
    const outLen = rng.randint(50, 300);
    reqs.push(new Request(i, promptLen, outLen, now));
  }
  return reqs;
}

function report(label: string, reqs: Request[], simEnd: number): void {
  const ttfts = reqs.filter((r) => r.ttft !== null).map((r) => (r.ttft ?? 0) - r.arrivedAt);
  const itls = reqs.flatMap((r) => r.itlSamples);
  const totalOut = reqs.reduce((acc, r) => acc + r.generated, 0);
  const throughput = simEnd ? totalOut / simEnd : 0;
  const meanTtft = ttfts.length ? (ttfts.reduce((a, b) => a + b, 0) / ttfts.length) * 1000 : 0;
  const sortedItls = [...itls].sort((a, b) => a - b);
  const p99Itl = itls.length ? sortedItls[Math.trunc(0.99 * itls.length) - 1] * 1000 : 0;
  const finished = reqs.filter((r) => r.done).length;
  console.log(
    `${lj(label, 28)}  throughput=${rj(fixed(throughput, 0), 6)} tok/s   ` +
      `mean_TTFT=${rj(fixed(meanTtft, 1), 6)} ms   ` +
      `P99_ITL=${rj(fixed(p99Itl, 1), 5)} ms   finished=${finished}/${reqs.length}`,
  );
}

function simulateNaive(reqs: Request[]): number {
  let now = 0.0;
  for (const r of reqs) {
    if (now < r.arrivedAt) now = r.arrivedAt;
    now += r.promptLen * PREFILL_LATENCY_PER_TOKEN + BATCH_OVERHEAD;
    r.prefilled = r.promptLen;
    r.ttft = now;
    r.lastTokenAt = now;
    for (let k = 0; k < r.outputLen; k++) {
      const prev = r.lastTokenAt;
      now += FORWARD_LATENCY_PER_TOKEN + BATCH_OVERHEAD;
      r.generated += 1;
      r.itlSamples.push(now - prev);
      r.lastTokenAt = now;
    }
  }
  return now;
}

function simulateStatic(reqs: Request[], batch = 16): number {
  let now = 0.0;
  let i = 0;
  while (i < reqs.length) {
    const window = reqs.slice(i, i + batch);
    i += batch;
    now = Math.max(now, Math.max(...window.map((r) => r.arrivedAt)));
    const padPrompt = Math.max(...window.map((r) => r.promptLen));
    const padOutput = Math.max(...window.map((r) => r.outputLen));
    now += padPrompt * PREFILL_LATENCY_PER_TOKEN + BATCH_OVERHEAD;
    for (const r of window) {
      r.prefilled = r.promptLen;
      r.ttft = now;
      r.lastTokenAt = now;
    }
    for (let k = 0; k < padOutput; k++) {
      const prevNow = now;
      now += (FORWARD_LATENCY_PER_TOKEN * window.length) / 16 + BATCH_OVERHEAD;
      for (const r of window) {
        if (r.generated < r.outputLen) {
          r.generated += 1;
          r.itlSamples.push(now - prevNow);
          r.lastTokenAt = now;
        }
      }
    }
  }
  return now;
}

function simulateContinuous(reqs: Request[], chunked: boolean): number {
  const waiting = [...reqs].sort((a, b) => a.arrivedAt - b.arrivedAt);
  let running: Request[] = [];
  let blocksUsed = 0;
  let now = 0.0;
  while (waiting.length || running.length) {
    if (waiting.length && running.length && now < waiting[0].arrivedAt && !running.length) {
      now = waiting[0].arrivedAt;
    }
    while (waiting.length && waiting[0].arrivedAt <= now) {
      const r = waiting[0];
      if (blocksUsed + r.blocksNeeded() > KV_BLOCKS_AVAILABLE) break;
      blocksUsed += r.blocksNeeded();
      running.push(waiting.shift() as Request);
    }
    if (!running.length) {
      if (!waiting.length) break;
      now = waiting[0].arrivedAt;
      continue;
    }

    let batchTokens = 0;
    let prefillWork = 0;
    const decoded: Request[] = [];
    for (const r of running) {
      if (r.inPrefill) {
        const remaining = r.promptLen - r.prefilled;
        const take = Math.min(chunked ? CHUNK_SIZE : remaining, remaining);
        r.prefilled += take;
        prefillWork += take;
        if (r.prefilled >= r.promptLen) r.ttft = now + prefillWork * PREFILL_LATENCY_PER_TOKEN;
      } else {
        decoded.push(r);
        batchTokens += 1;
      }
    }

    const dt = prefillWork * PREFILL_LATENCY_PER_TOKEN + batchTokens * FORWARD_LATENCY_PER_TOKEN + BATCH_OVERHEAD;
    now += dt;
    for (const r of decoded) {
      const prev = r.lastTokenAt || r.ttft || now;
      r.generated += 1;
      r.itlSamples.push(now - prev);
      r.lastTokenAt = now;
      if (r.ttft === null) r.ttft = now;
    }

    const finished = running.filter((r) => r.done);
    for (const r of finished) blocksUsed -= r.blocksNeeded();
    running = running.filter((r) => !r.done);
  }
  return now;
}

function copy(base: Request[]): Request[] {
  return base.map((r) => new Request(r.reqId, r.promptLen, r.outputLen, r.arrivedAt));
}

function main(): void {
  console.log("=".repeat(80));
  console.log("TOY vLLM SCHEDULER: four modes on the same 60-request workload");
  console.log("=".repeat(80));

  const base = makeWorkload();
  const w1 = copy(base);
  report("NAIVE", w1, simulateNaive(w1));

  const w2 = copy(base);
  report("STATIC (batch=16, padded)", w2, simulateStatic(w2));

  const w3 = copy(base);
  report("CONTINUOUS (no chunk)", w3, simulateContinuous(w3, false));

  const w4 = copy(base);
  report("CONTINUOUS + CHUNKED", w4, simulateContinuous(w4, true));

  console.log();
  console.log("Read the CONTINUOUS+CHUNKED row. That is what vLLM ships as default.");
  console.log("The gap between STATIC and CONTINUOUS is the whole reason vLLM exists.");
}

main();
