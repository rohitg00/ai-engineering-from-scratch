// Lesson: Inference Metrics: TTFT, TPOT, ITL, Goodput, P99 (phase 17 / lesson 08)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/08-inference-metrics-goodput/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/08-inference-metrics-goodput/code/main.ts

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
const signed = (x: number, digits: number): string => (x >= 0 ? "+" : "") + fixed(x, digits);

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

  expovariate(lambd: number): number {
    return -Math.log(1.0 - this.random()) / lambd;
  }

  gauss(mu: number, sigma: number): number {
    let u1 = this.random();
    while (u1 === 0) u1 = this.random();
    const u2 = this.random();
    return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
  }
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]): number => sum(xs) / xs.length;

class RequestTrace {
  constructor(
    public queueMs: number,
    public prefillMs: number,
    public decodeMsPerToken: number[],
    public outputTokens: number,
  ) {}

  get ttftMs(): number {
    return this.queueMs + this.prefillMs;
  }

  get e2eMs(): number {
    return this.ttftMs + sum(this.decodeMsPerToken);
  }

  tpotLlmperf(): number {
    return this.e2eMs / this.outputTokens;
  }

  tpotGenaiperf(): number {
    if (this.outputTokens <= 1) return 0.0;
    return sum(this.decodeMsPerToken) / (this.outputTokens - 1);
  }
}

function synthWorkload(n = 1000, seed = 7, tailSpikeRate = 0.02): RequestTrace[] {
  const rng = new Rng(seed);
  const traces: RequestTrace[] = [];
  for (let i = 0; i < n; i++) {
    const promptLen = rng.choice([128, 256, 512, 2048, 8192]);
    const outputTokens = rng.randint(50, 300);
    const queue = rng.expovariate(1 / 40.0);
    const prefill = promptLen * 0.05;
    const decodeBase = 7.0;
    const decodes: number[] = [];
    for (let j = 0; j < outputTokens; j++) {
      let t = Math.max(1.5, rng.gauss(decodeBase, decodeBase * 0.15));
      if (rng.random() < tailSpikeRate) t *= rng.uniform(3, 8);
      decodes.push(t);
    }
    traces.push(new RequestTrace(queue, prefill, decodes, outputTokens));
  }
  return traces;
}

function percentiles(values: number[], ps: number[]): number[] {
  const s = [...values].sort((a, b) => a - b);
  return ps.map((p) => s[Math.min(s.length - 1, Math.trunc(p * s.length))]);
}

function reportLatency(label: string, traces: RequestTrace[]): void {
  const ttft = traces.map((t) => t.ttftMs);
  const tpotLlm = traces.map((t) => t.tpotLlmperf());
  const tpotNv = traces.map((t) => t.tpotGenaiperf());
  const e2e = traces.map((t) => t.e2eMs);

  const [p50Ttft, p90Ttft, p99Ttft] = percentiles(ttft, [0.5, 0.9, 0.99]);
  const [p50Tpot, p90Tpot, p99Tpot] = percentiles(tpotNv, [0.5, 0.9, 0.99]);
  const [p50E2e, p90E2e, p99E2e] = percentiles(e2e, [0.5, 0.9, 0.99]);

  const f = (x: number, d: number): string => rj(fixed(x, d), 7);
  console.log(label);
  console.log("-".repeat(76));
  console.log(`  TTFT (ms)     P50=${f(p50Ttft, 1)}  P90=${f(p90Ttft, 1)}  P99=${f(p99Ttft, 1)}  mean=${f(mean(ttft), 1)}`);
  console.log(`  TPOT (ms)     P50=${f(p50Tpot, 2)}  P90=${f(p90Tpot, 2)}  P99=${f(p99Tpot, 2)}  mean=${f(mean(tpotNv), 2)}`);
  console.log(`  E2E  (ms)     P50=${f(p50E2e, 1)}  P90=${f(p90E2e, 1)}  P99=${f(p99E2e, 1)}`);
  console.log(
    `  Tool trap     GenAI-Perf mean TPOT=${rj(fixed(mean(tpotNv), 2), 6)}  ` +
      `LLMPerf mean TPOT=${rj(fixed(mean(tpotLlm), 2), 6)}  ` +
      `delta=${rj(signed(mean(tpotLlm) - mean(tpotNv), 2), 5)} ms`,
  );
}

function goodput(traces: RequestTrace[], sloTtft: number, sloTpot: number, sloE2e: number): number {
  let good = 0;
  for (const t of traces) {
    if (t.ttftMs <= sloTtft && t.tpotGenaiperf() <= sloTpot && t.e2eMs <= sloE2e) good += 1;
  }
  return good / traces.length;
}

function main(): void {
  console.log("=".repeat(78));
  console.log("TOY GOODPUT CALCULATOR: inference SLOs and the measurement trap");
  console.log("=".repeat(78));
  console.log();

  const traces = synthWorkload(2000);
  reportLatency("Synthetic workload (2000 requests)", traces);
  console.log();

  const slos: [string, number, number, number][] = [
    ["loose   TTFT<800 TPOT<25 E2E<3000", 800, 25, 3000],
    ["target  TTFT<500 TPOT<15 E2E<2000", 500, 15, 2000],
    ["tight   TTFT<300 TPOT<10 E2E<1500", 300, 10, 1500],
  ];
  console.log("Goodput under three SLO profiles");
  console.log("-".repeat(76));
  for (const [label, t1, t2, t3] of slos) {
    const g = goodput(traces, t1, t2, t3);
    const tag = g >= 0.99 ? "  SHIPPABLE" : g >= 0.95 ? "  DEGRADED" : "  FAILING";
    console.log(`  ${label}  goodput=${rj(fixed(g * 100, 2) + "%", 6)}${tag}`);
  }

  console.log();
  console.log("=".repeat(78));
  console.log("KEY FINDING");
  console.log("-".repeat(78));
  console.log("  Mean TPOT ~7 ms looks great. P99 TPOT ~25-40 ms tells the real story.");
  console.log("  Tighten the SLO and goodput collapses from 99% -> 80%+. Users feel P99.");
  console.log("  GenAI-Perf vs LLMPerf disagree by ~1 ms on mean TPOT, cite the tool.");
}

main();
