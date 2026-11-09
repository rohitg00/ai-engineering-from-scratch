// Lesson: Janus-Pro: Decoupled Encoders for Unified Multimodal Models (phase 12 / lesson 15)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/15-janus-pro-decoupled-encoders/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/15-janus-pro-decoupled-encoders/code/main.ts

export {};

type Random = () => number;

function mulberry32(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng: Random = mulberry32(3);

function seed(value: number): void {
  rng = mulberry32(value);
}

function gauss(mu: number, sigma: number): number {
  let u1 = rng();
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function randint(low: number, high: number): number {
  return low + Math.floor(rng() * (high - low + 1));
}

type Output = string | string[] | [string[], string];

class SiglipStub {
  constructor(public dim = 32) {}

  encode(imageSeed: number): number[] {
    seed(imageSeed);
    const out: number[] = [];
    for (let i = 0; i < this.dim; i++) out.push(gauss(0, 0.5));
    return out;
  }
}

class VQStub {
  constructor(
    public vocab = 256,
    public nTokens = 16,
  ) {}

  encode(imageSeed: number): number[] {
    seed(imageSeed * 7 + 1);
    const out: number[] = [];
    for (let i = 0; i < this.nTokens; i++) out.push(randint(0, this.vocab - 1));
    return out;
  }

  decode(tokens: number[]): string {
    return `VQ-decoded image from tokens [${tokens.slice(0, 4).join(", ")}]...`;
  }
}

class SharedBody {
  constructor(public name = "DeepSeek-7B-init") {}

  process(_inputStream: number[], kind: string): string[] | number[] {
    if (kind === "text_out") {
      const out: string[] = [];
      for (let i = 0; i < 4; i++) out.push(`word_${i}`);
      return out;
    }
    if (kind === "image_out") {
      const out: number[] = [];
      for (let i = 0; i < 16; i++) out.push(randint(0, 255));
      return out;
    }
    return [];
  }
}

function route(prompt: string): string {
  const uKeywords = ["describe", "what", "why", "caption", "explain", "how many"];
  const gKeywords = ["draw", "generate", "sketch", "render", "create", "paint"];
  const p = prompt.toLowerCase();
  const uScore = uKeywords.filter((k) => p.includes(k)).length;
  const gScore = gKeywords.filter((k) => p.includes(k)).length;
  if (gScore > uScore) return "generate";
  if (uScore > gScore) return "understand";
  return "ambiguous";
}

interface Trace {
  prompt: string;
  task: string;
  route?: string;
  input_len?: number | string;
  output?: Output;
}

function runPipeline(prompt: string, imageSeed = 42): Trace {
  const siglip = new SiglipStub();
  const vq = new VQStub();
  const body = new SharedBody();

  const task = route(prompt);
  const trace: Trace = { prompt, task };

  if (task === "understand") {
    const feats = siglip.encode(imageSeed);
    trace.route = "SigLIP -> shared body -> text";
    trace.input_len = feats.length;
    trace.output = body.process(feats, "text_out") as string[];
  } else if (task === "generate") {
    const tokens = imageSeed ? vq.encode(imageSeed) : [];
    trace.route = "(optional VQ) -> shared body -> image VQ -> decoder";
    const outTokens = body.process(tokens, "image_out") as number[];
    trace.output = vq.decode(outTokens);
  } else {
    trace.route = "ambiguous: run both and merge";
    const feats = siglip.encode(imageSeed);
    const tokens = vq.encode(imageSeed);
    trace.input_len = `SigLIP:${feats.length} + VQ:${tokens.length}`;
    trace.output = [
      body.process(feats, "text_out") as string[],
      vq.decode(body.process(tokens, "image_out") as number[]),
    ];
  }

  return trace;
}

function reprList(xs: string[]): string {
  return "[" + xs.map((x) => `'${x}'`).join(", ") + "]";
}

function reprOutput(v: Output): string {
  if (typeof v === "string") return v;
  if (isPair(v)) return `(${reprList(v[0])}, '${v[1]}')`;
  return reprList(v);
}

function isPair(v: string[] | [string[], string]): v is [string[], string] {
  return Array.isArray(v[0]);
}

function demoRouting(): void {
  const prompts = [
    "Describe what's in this image",
    "Generate a picture of a sunset over the ocean",
    "Sketch a cat and then describe its breed",
    "What is the pose of the person in the image?",
    "Render a cyberpunk cityscape at night",
  ];
  for (const p of prompts) {
    let codeSum = 0;
    for (const ch of p) codeSum += ch.codePointAt(0) ?? 0;
    const trace = runPipeline(p, codeSum % 1000);
    console.log(`\n  prompt  : ${p}`);
    console.log(`  task    : ${trace.task}`);
    console.log(`  route   : ${trace.route}`);
    console.log(`  output  : ${trace.output === undefined ? "" : reprOutput(trace.output)}`);
  }
}

function dataScaleTable(): void {
  console.log("\nDATA SCALING: Janus vs Janus-Pro");
  console.log("-".repeat(60));
  const rows: [string, string, string, string][] = [
    ["stage 1 (alignment)", "72M pairs", "90M pairs", "+25%"],
    ["stage 2 (unified)", "26M pairs", "72M pairs", "+176%"],
    ["stage 3 (instruction)", "1.2M inst", "1.4M inst", "+17%"],
    ["model params", "1.3B", "7B", "5.4x"],
    ["MMMU", "30.5", "60.3", "+29.8"],
    ["GenEval", "0.61", "0.80", "+0.19"],
  ];
  console.log(`  ${"axis".padEnd(20)}${"Janus".padEnd(14)}${"Janus-Pro".padEnd(14)}delta`);
  for (const r of rows) console.log(`  ${r[0].padEnd(20)}${r[1].padEnd(14)}${r[2].padEnd(14)}${r[3]}`);
}

function main(): void {
  console.log("=".repeat(60));
  console.log("JANUS-PRO DECOUPLED ENCODERS (Phase 12, Lesson 15)");
  console.log("=".repeat(60));

  console.log("\nROUTING TRACE: 5 prompts through the dual-encoder pipeline");
  console.log("-".repeat(60));
  demoRouting();

  dataScaleTable();

  console.log("\nARCHITECTURE ONE-LINER");
  console.log("-".repeat(60));
  console.log("  input tower A (SigLIP)  -> ");
  console.log("  input tower B (VQ)       -> shared transformer body ->");
  console.log("  output head 1 (text NTP) or output head 2 (VQ tokens)");
  console.log("  3 stages: alignment -> unified -> instruction tune");
}

main();
