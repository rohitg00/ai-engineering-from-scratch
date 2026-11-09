// Lesson: Hypothesis Generator (phase 19 / lesson 50)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/50-hypothesis-generator/docs/en.md
// Run: npx tsx phases/19-capstone-projects/50-hypothesis-generator/code/main.ts

import { createHash } from "node:crypto";

class PyFloat {
  constructor(readonly v: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

const fl = (v: number): PyFloat => new PyFloat(v);

function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mant, expStr] = x.toExponential().split("e");
  const exp = Number(expStr);
  const neg = mant.startsWith("-");
  const digits = mant.replace("-", "").replace(".", "");
  let body: string;
  if (exp < -4 || exp >= 16) {
    const frac = digits.length > 1 ? "." + digits.slice(1) : "";
    body = digits[0] + frac + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
  } else if (exp < 0) {
    body = "0." + "0".repeat(-exp - 1) + digits;
  } else if (digits.length <= exp + 1) {
    body = digits + "0".repeat(exp + 1 - digits.length) + ".0";
  } else {
    body = digits.slice(0, exp + 1) + "." + digits.slice(exp + 1);
  }
  return (neg ? "-" : "") + body;
}

function fmtFixed(x: number, n: number): string {
  const neg = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  const wide = a.toFixed(Math.min(100, n + 30));
  const dot = wide.indexOf(".");
  const tail = wide.slice(dot + 1 + n);
  let out = a.toFixed(n);
  if (/^50*$/.test(tail)) {
    const head = wide.slice(0, dot + 1 + n);
    const trimmed = n === 0 ? head.slice(0, -1) : head;
    if (Number(trimmed[trimmed.length - 1]) % 2 === 0) out = trimmed;
  }
  return (neg ? "-" : "") + out;
}

function pyRound(x: number, n: number): number {
  return Number(fmtFixed(x, n));
}

function jsonStr(s: string): string {
  return (
    '"' +
    s.replace(/[\\"\u0000-\u001f\u007f-￿]/g, (c) => {
      if (c === '"') return '\\"';
      if (c === "\\") return "\\\\";
      if (c === "\n") return "\\n";
      if (c === "\r") return "\\r";
      if (c === "\t") return "\\t";
      if (c === "\b") return "\\b";
      if (c === "\f") return "\\f";
      return "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
    }) +
    '"'
  );
}

function pyDumps(v: Json, indent: number | null = null, level = 0): string {
  if (v === null) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (v instanceof PyFloat) return pyFloatRepr(v.v);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : pyFloatRepr(v);
  if (typeof v === "string") return jsonStr(v);
  let open: string;
  let close: string;
  let items: string[];
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    open = "[";
    close = "]";
    items = v.map((x) => pyDumps(x, indent, level + 1));
  } else {
    const keys = Object.keys(v);
    if (keys.length === 0) return "{}";
    open = "{";
    close = "}";
    items = keys.map((k) => jsonStr(k) + ": " + pyDumps(v[k], indent, level + 1));
  }
  if (indent === null) return open + items.join(", ") + close;
  const pad = "\n" + " ".repeat(indent * (level + 1));
  return open + pad + items.join("," + pad) + "\n" + " ".repeat(indent * level) + close;
}

const HASH_DIM = 128;
const TAG_RE = new RegExp(
  "<hypothesis>\\s*" +
    "<text>(?<text>.*?)</text>\\s*" +
    "<variables>(?<variables>.*?)</variables>\\s*" +
    "<metric>(?<metric>.*?)</metric>\\s*" +
    "(?:<baseline>(?<baseline>.*?)</baseline>\\s*)?" +
    "</hypothesis>",
  "s",
);

class Hypothesis {
  constructor(
    public id: number,
    public text: string,
    public variables: string[],
    public metric: string,
    public baseline_ref: string | null,
    public draft_pass: number,
    public temperature: number,
    public novelty_score = 0.0,
    public rank_score = 0.0,
  ) {}

  toDict(): Obj {
    return {
      id: this.id,
      text: this.text,
      variables: [...this.variables],
      metric: this.metric,
      baseline_ref: this.baseline_ref,
      draft_pass: this.draft_pass,
      temperature: fl(pyRound(this.temperature, 3)),
      novelty_score: fl(pyRound(this.novelty_score, 4)),
      rank_score: fl(pyRound(this.rank_score, 4)),
    };
  }
}

class ParserError extends Error {}

function tokenise(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function hashedEmbed(text: string, dim: number = HASH_DIM): number[] {
  const vec = new Array<number>(dim).fill(0.0);
  for (const tok of tokenise(text)) {
    const h = createHash("md5").update(tok, "utf-8").digest();
    const idx = h.readUInt32BE(0) % dim;
    const sign = (h[4] & 1) === 0 ? 1.0 : -1.0;
    vec[idx] += sign;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm === 0.0) return vec;
  return vec.map((v) => v / norm);
}

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  dot = Math.max(-1.0, Math.min(1.0, dot));
  return 1.0 - dot;
}

interface Parsed {
  text: string;
  variables: string[];
  metric: string;
  baseline_ref: string | null;
}

function parseResponse(raw: string): Parsed {
  const match = TAG_RE.exec(raw);
  if (match === null || match.groups === undefined) throw new ParserError("no hypothesis block found");
  const text = match.groups["text"].trim();
  if (!text) throw new ParserError("empty text");
  const metric = match.groups["metric"].trim();
  if (!metric) throw new ParserError("empty metric");
  const rawVars = match.groups["variables"].trim();
  const variables = rawVars
    .split(",")
    .filter((v) => v.trim())
    .map((v) => v.trim());
  if (!variables.length) throw new ParserError("empty variables");
  const baseline = match.groups["baseline"];
  const baselineRef = baseline && baseline.trim() ? baseline.trim() : null;
  return { text, variables, metric, baseline_ref: baselineRef };
}

function temperatureBucket(temperature: number): number {
  if (temperature < 0.35) return 0;
  if (temperature < 0.65) return 1;
  if (temperature < 0.95) return 2;
  return 3;
}

class MockLLM {
  private scripts: Map<string, string[]>;

  constructor(scripts: Map<string, string[]>) {
    this.scripts = new Map(scripts);
  }

  static promptSignature(prompt: string): string {
    return createHash("sha1").update(prompt, "utf-8").digest("hex").slice(0, 10);
  }

  static key(sig: string, bucket: number): string {
    return `${sig}|${bucket}`;
  }

  sample(prompt: string, temperature: number, seed: number): string {
    const key = MockLLM.key(MockLLM.promptSignature(prompt), temperatureBucket(temperature));
    const bank = this.scripts.get(key);
    if (!bank || !bank.length) return "<noise>untagged drift</noise>";
    return bank[seed % bank.length];
  }
}

class GeneratorConfig {
  n_passes = 6;
  t_min = 0.2;
  t_max = 1.2;
  novelty_threshold = 0.25;
  target_variable_count = 3;
  w_novelty = 0.4;
  w_specificity = 0.3;
  w_testability = 0.3;
  base_seed = 0;

  constructor(init: Partial<GeneratorConfig> = {}) {
    Object.assign(this, init);
  }

  schedule(): number[] {
    if (this.n_passes <= 0) return [];
    if (this.n_passes === 1) return [this.t_min];
    const step = (this.t_max - this.t_min) / (this.n_passes - 1);
    return Array.from({ length: this.n_passes }, (_, i) => this.t_min + i * step);
  }
}

class GenerationLog {
  constructor(
    public pass_index: number,
    public temperature: number,
    public seed: number,
    public accepted_id: number | null,
    public reject_reason: string | null,
    public raw_excerpt: string,
  ) {}

  toDict(): Obj {
    return {
      pass: this.pass_index,
      temperature: fl(pyRound(this.temperature, 3)),
      seed: this.seed,
      accepted_id: this.accepted_id,
      reject_reason: this.reject_reason,
      raw_excerpt: this.raw_excerpt.slice(0, 80),
    };
  }
}

class HypothesisGenerator {
  private cfg: GeneratorConfig;

  constructor(
    private llm: MockLLM,
    config: GeneratorConfig | null = null,
    private embed: (text: string) => number[] = (t) => hashedEmbed(t),
  ) {
    this.cfg = config ?? new GeneratorConfig();
  }

  private specificityScore(h: Hypothesis): number {
    const target = Math.max(1, this.cfg.target_variable_count);
    return Math.min(1.0, h.variables.length / target);
  }

  private testabilityScore(h: Hypothesis): number {
    if (h.metric && h.baseline_ref) return 1.0;
    if (h.metric) return 0.5;
    return 0.0;
  }

  private score(h: Hypothesis): number {
    return (
      this.cfg.w_novelty * h.novelty_score +
      this.cfg.w_specificity * this.specificityScore(h) +
      this.cfg.w_testability * this.testabilityScore(h)
    );
  }

  private novelty(candidate: number[], survivors: number[][]): number {
    if (!survivors.length) return 1.0;
    return Math.min(...survivors.map((s) => cosineDistance(candidate, s)));
  }

  run(seedPrompt: string): [Hypothesis[], GenerationLog[]] {
    const survivors: Hypothesis[] = [];
    const survivorVecs: number[][] = [];
    const logs: GenerationLog[] = [];
    let nextId = 1;
    this.cfg.schedule().forEach((temperature, passIndex) => {
      const seed = this.cfg.base_seed + passIndex;
      const raw = this.llm.sample(seedPrompt, temperature, seed);
      let parsed: Parsed;
      try {
        parsed = parseResponse(raw);
      } catch (exc) {
        if (!(exc instanceof ParserError)) throw exc;
        logs.push(new GenerationLog(passIndex, temperature, seed, null, `parse:${exc.message}`, raw));
        return;
      }
      const vec = this.embed(parsed.text);
      const novelty = this.novelty(vec, survivorVecs);
      if (novelty < this.cfg.novelty_threshold) {
        logs.push(new GenerationLog(passIndex, temperature, seed, null, "duplicate", raw));
        return;
      }
      const hypothesis = new Hypothesis(
        nextId,
        parsed.text,
        parsed.variables,
        parsed.metric,
        parsed.baseline_ref,
        passIndex,
        temperature,
        novelty,
      );
      hypothesis.rank_score = this.score(hypothesis);
      survivors.push(hypothesis);
      survivorVecs.push(vec);
      logs.push(new GenerationLog(passIndex, temperature, seed, nextId, null, raw));
      nextId += 1;
    });
    survivors.sort((a, b) => b.rank_score - a.rank_score || a.id - b.id);
    return [survivors, logs];
  }
}

function buildDemoScripts(): Map<string, string[]> {
  const seedPrompt = "Investigate attention sparsity in small transformers";
  const sig = MockLLM.promptSignature(seedPrompt);
  return new Map<string, string[]>([
    [
      MockLLM.key(sig, 0),
      [
        "<hypothesis>" +
          "<text>Lowering attention head count from 8 to 4 raises validation loss by less than 2 percent on a 12M parameter model.</text>" +
          "<variables>head_count, validation_loss</variables>" +
          "<metric>validation_loss</metric>" +
          "<baseline>head_count_8</baseline>" +
          "</hypothesis>",
      ],
    ],
    [
      MockLLM.key(sig, 1),
      [
        "<hypothesis>" +
          "<text>Top-k sparse attention with k equal to 16 matches dense attention on perplexity at 12M parameters.</text>" +
          "<variables>k, perplexity, parameter_count</variables>" +
          "<metric>perplexity</metric>" +
          "<baseline>dense_attention</baseline>" +
          "</hypothesis>",
      ],
    ],
    [
      MockLLM.key(sig, 2),
      [
        "<hypothesis>" +
          "<text>Routing attention through a learned gate reduces flops by 30 percent without harming downstream accuracy.</text>" +
          "<variables>gate_temperature, flops, accuracy</variables>" +
          "<metric>downstream_accuracy</metric>" +
          "<baseline>dense_attention</baseline>" +
          "</hypothesis>",
      ],
    ],
    [
      MockLLM.key(sig, 3),
      [
        "<hypothesis>" +
          "<text>Block sparse attention with block size 32 lowers wall clock training time by 18 percent on consumer GPUs.</text>" +
          "<variables>block_size, training_seconds, hardware</variables>" +
          "<metric>training_seconds</metric>" +
          "<baseline>dense_attention</baseline>" +
          "</hypothesis>",
      ],
    ],
  ]);
}

function demo(): void {
  const llm = new MockLLM(buildDemoScripts());
  const config = new GeneratorConfig({ n_passes: 4, t_min: 0.2, t_max: 1.1 });
  const generator = new HypothesisGenerator(llm, config);
  const [queue, logs] = generator.run("Investigate attention sparsity in small transformers");
  console.log(
    pyDumps(
      {
        queue_size: queue.length,
        queue: queue.map((h) => h.toDict()),
        logs: logs.map((log) => log.toDict()),
      },
      2,
    ),
  );
}

demo();
