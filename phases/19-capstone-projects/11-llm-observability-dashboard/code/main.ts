// Lesson: Capstone 11: LLM Observability & Eval Dashboard (phase 19 / lesson 11)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/11-llm-observability-dashboard/docs/en.md
// Run: npx tsx phases/19-capstone-projects/11-llm-observability-dashboard/code/main.ts

import { createHash } from "node:crypto";

class PyRandom {
  private mt = new Uint32Array(624);
  private mti = 625;

  constructor(seed: number) {
    this.initByArray([seed >>> 0]);
  }

  private initGenrand(s: number): void {
    this.mt[0] = s >>> 0;
    for (this.mti = 1; this.mti < 624; this.mti++) {
      const prev = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
      this.mt[this.mti] = (Math.imul(1812433253, prev) + this.mti) >>> 0;
    }
  }

  private initByArray(key: number[]): void {
    this.initGenrand(19650218);
    let i = 1;
    let j = 0;
    for (let k = Math.max(624, key.length); k > 0; k--) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((this.mt[i] ^ Math.imul(prev, 1664525)) + key[j] + j) >>> 0;
      i++;
      j++;
      if (i >= 624) {
        this.mt[0] = this.mt[623];
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = 623; k > 0; k--) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((this.mt[i] ^ Math.imul(prev, 1566083941)) - i) >>> 0;
      i++;
      if (i >= 624) {
        this.mt[0] = this.mt[623];
        i = 1;
      }
    }
    this.mt[0] = 0x80000000;
  }

  private genrand(): number {
    if (this.mti >= 624) {
      for (let kk = 0; kk < 624; kk++) {
        const y = (this.mt[kk] & 0x80000000) | (this.mt[(kk + 1) % 624] & 0x7fffffff);
        this.mt[kk] = this.mt[(kk + 397) % 624] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      }
      this.mti = 0;
    }
    let y = this.mt[this.mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  random(): number {
    const a = this.genrand() >>> 5;
    const b = this.genrand() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }

  private getrandbits(k: number): number {
    return this.genrand() >>> (32 - k);
  }

  private randbelow(n: number): number {
    const k = n.toString(2).length;
    let r = this.getrandbits(k);
    while (r >= n) r = this.getrandbits(k);
    return r;
  }

  randint(a: number, b: number): number {
    return a + this.randbelow(b - a + 1);
  }

  choice<T>(seq: T[]): T {
    return seq[this.randbelow(seq.length)];
  }

  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
  }
}

type Attrs = Record<string, string | number>;

class Span {
  events: Record<string, unknown>[] = [];
  status = "ok";

  constructor(
    public trace_id: string,
    public span_id: string,
    public parent_span_id: string | null,
    public name: string,
    public start_ms: number,
    public duration_ms: number,
    public attributes: Attrs,
  ) {}

  isLlm(): boolean {
    return "gen_ai.system" in this.attributes;
  }
}

const num = (v: string | number | undefined, d: number): number => (typeof v === "number" ? v : d);
const str = (v: string | number | undefined, d: string): string => (v === undefined ? d : String(v));

class TailSampler {
  constructor(public sample_rate: number = 0.1, public rng: PyRandom = new PyRandom(3)) {}

  decide(trace: Span[]): boolean {
    if (trace.some((s) => s.status === "error")) return true;
    for (const s of trace) {
      if (s.name === "eval" && (num(s.attributes.toxicity, 0) > 0.5 || num(s.attributes.pii_leak, 0) > 0.8)) return true;
    }
    return this.rng.random() < this.sample_rate;
  }
}

function bump(m: Map<string, number>, k: string, by: number): void {
  m.set(k, (m.get(k) ?? 0) + by);
}

class SpanStore {
  spans: Span[] = [];
  by_user = new Map<string, number>();
  by_model = new Map<string, number>();
  cost_by_user = new Map<string, number>();

  insertTrace(trace: Span[]): void {
    this.spans.push(...trace);
    for (const s of trace) {
      if (s.isLlm()) {
        const u = str(s.attributes.user_id, "anon");
        const m = str(s.attributes["gen_ai.request.model"], "unknown");
        bump(this.by_user, u, 1);
        bump(this.by_model, m, 1);
        bump(this.cost_by_user, u, num(s.attributes.cost_usd, 0.0));
      }
    }
  }
}

function words(s: string): string[] {
  return s.split(/\s+/).filter((w) => w.length > 0);
}

function evalFaithfulness(response: string, context: string): number {
  const r = new Set(words(response.toLowerCase()));
  const c = new Set(words(context.toLowerCase()));
  if (r.size === 0) return 0.0;
  return [...r].filter((w) => c.has(w)).length / r.size;
}

function evalToxicity(response: string): number {
  const bad = new Set(["hate", "kill", "stupid", "garbage"]);
  const ws = words(response.toLowerCase());
  const hits = ws.filter((w) => bad.has(w)).length;
  return Math.min(1.0, (hits / Math.max(1, ws.length)) * 10);
}

function evalPiiLeak(response: string): number {
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(response)) return 0.95;
  if (/[\w.+-]+@[\w.-]+/.test(response)) return 0.6;
  return 0.05;
}

function promptFingerprint(prompt: string, nBins: number = 8): number {
  const h = createHash("sha256").update(prompt, "utf8").digest();
  return h[0] % nBins;
}

function psi(a: number[], b: number[], nBins: number = 8): number {
  const ca = new Array<number>(nBins).fill(0);
  const cb = new Array<number>(nBins).fill(0);
  for (const v of a) ca[v] += 1;
  for (const v of b) cb[v] += 1;
  const totalA = Math.max(ca.reduce((x, y) => x + y, 0), 1);
  const totalB = Math.max(cb.reduce((x, y) => x + y, 0), 1);
  let score = 0.0;
  for (let i = 0; i < nBins; i++) {
    const pa = Math.max(ca[i] / totalA, 0.0001);
    const pb = Math.max(cb[i] / totalB, 0.0001);
    score += (pa - pb) * Math.log(pa / pb);
  }
  return score;
}

function pyRound(x: number, digits: number): number {
  return Number(x.toFixed(digits));
}

function synthTrace(traceId: string, leakPii: boolean, rng: PyRandom): Span[] {
  const model = rng.choice(["claude-sonnet-4-7", "gpt-5-4", "gemini-3-pro"]);
  const user = rng.choice(["u_01", "u_02", "u_03", "u_04"]);
  const root = new Span(traceId, `${traceId}_0`, null, "chat_turn", Math.trunc(Date.now()), rng.randint(400, 2400), { app_id: "chatbot" });
  const prompt = rng.choice([
    "what is the weather in Tokyo today",
    "summarize the recent Tokyo forecast",
    "give me a travel tip for Tokyo",
    "how warm is Tokyo this week",
  ]);
  const resp = leakPii ? "your ssn is 123-45-6789" : "the weather in Tokyo is mild";
  const ctx = "relevant weather context Tokyo mild";
  const attributes: Attrs = {};
  attributes["gen_ai.system"] = model.split("-")[0];
  attributes["gen_ai.request.model"] = model;
  attributes["gen_ai.usage.input_tokens"] = rng.randint(80, 800);
  attributes["gen_ai.usage.output_tokens"] = rng.randint(20, 300);
  attributes.user_id = user;
  attributes.prompt = prompt;
  attributes.response = resp;
  attributes.context = ctx;
  attributes.cost_usd = pyRound(rng.uniform(0.002, 0.05), 4);
  const llm = new Span(traceId, `${traceId}_1`, root.span_id, "llm_call", root.start_ms + 50, root.duration_ms - 80, attributes);
  return [root, llm];
}

function enrichWithEvals(trace: Span[]): Span[] {
  const out = [...trace];
  for (const s of trace) {
    if (s.isLlm()) {
      const resp = str(s.attributes.response, "");
      const ctx = str(s.attributes.context, "");
      out.push(
        new Span(s.trace_id, `${s.span_id}_eval`, s.span_id, "eval", s.start_ms + s.duration_ms, 120, {
          faithfulness: evalFaithfulness(resp, ctx),
          toxicity: evalToxicity(resp),
          pii_leak: evalPiiLeak(resp),
        }),
      );
    }
  }
  return out;
}

function alerter(store: SpanStore): string[] {
  const alerts: string[] = [];
  const piiEvents = store.spans.filter((s) => s.name === "eval" && num(s.attributes.pii_leak, 0) > 0.8);
  if (piiEvents.length > 0) alerts.push(`PII LEAK DETECTED: ${piiEvents.length} events (first trace: ${piiEvents[0].trace_id})`);
  const toxEvents = store.spans.filter((s) => s.name === "eval" && num(s.attributes.toxicity, 0) > 0.5);
  if (toxEvents.length > 0) alerts.push(`TOXICITY SURGE: ${toxEvents.length} events`);
  return alerts;
}

function pyDict(m: Map<string, number>): string {
  return "{" + [...m.entries()].map(([k, v]) => `'${k}': ${v}`).join(", ") + "}";
}

function main(): void {
  const rng = new PyRandom(5);
  const sampler = new TailSampler(0.2, rng);
  const store = new SpanStore();

  const baselineFps: number[] = [];
  const currentFps: number[] = [];

  for (let i = 0; i < 200; i++) {
    const leak = rng.random() < 0.01;
    let trace = synthTrace(`t${String(i).padStart(4, "0")}`, leak, rng);
    trace = enrichWithEvals(trace);
    if (sampler.decide(trace)) store.insertTrace(trace);
    const llmSpan = trace[1];
    const fp = promptFingerprint(str(llmSpan.attributes.prompt, ""));
    (i > 150 ? currentFps : baselineFps).push(fp);
  }

  console.log(`ingested spans     : ${store.spans.length}`);
  console.log(`spans by model     : ${pyDict(store.by_model)}`);
  console.log(`cost by user       : ${pyDict(new Map([...store.cost_by_user.entries()].map(([k, v]) => [k, pyRound(v, 4)])))}`);

  const alerts = alerter(store);
  if (alerts.length > 0) {
    console.log("\nALERTS:");
    for (const a of alerts) console.log(`  - ${a}`);
  } else {
    console.log("\nno alerts");
  }

  const psiVal = psi(baselineFps, currentFps, 8);
  console.log(`\nPSI (current vs baseline): ${psiVal.toFixed(3)}`);
  if (psiVal > 0.2) console.log("  drift alert (PSI > 0.2)");
}

main();
