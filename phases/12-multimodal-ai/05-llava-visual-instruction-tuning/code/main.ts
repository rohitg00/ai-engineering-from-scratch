// Lesson: LLaVA and Visual Instruction Tuning (phase 12 / lesson 05)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/05-llava-visual-instruction-tuning/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/05-llava-visual-instruction-tuning/code/main.ts

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

const rng: Random = mulberry32(11);

function gauss(mu: number, sigma: number): number {
  let u1 = rng();
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function pyFloat(x: number): string {
  if (Object.is(x, -0)) return "-0.0";
  if (Number.isInteger(x)) return x.toFixed(1);
  return String(x);
}

function commas(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const PATCH_COUNT = 16;
const PATCH_DIM = 16;
const HIDDEN_DIM = 32;
const LLM_DIM = 24;

function vec(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(gauss(0, 0.3));
  return out;
}

function mat(rows: number, cols: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < rows; i++) out.push(vec(cols));
  return out;
}

function linear(W: number[][], b: number[], x: number[]): number[] {
  return W.map((row, r) => {
    let s = 0;
    const n = Math.min(row.length, x.length);
    for (let i = 0; i < n; i++) s += row[i] * x[i];
    return s + b[r];
  });
}

function gelu(x: number): number {
  return 0.5 * x * (1.0 + Math.tanh(Math.sqrt(2.0 / Math.PI) * (x + 0.044715 * x * x * x)));
}

function geluVec(v: number[]): number[] {
  return v.map(gelu);
}

class MLPProjector {
  W1: number[][];
  b1: number[];
  W2: number[][];
  b2: number[];

  constructor(inDim: number, hidden: number, outDim: number) {
    this.W1 = mat(hidden, inDim);
    this.b1 = new Array<number>(hidden).fill(0.0);
    this.W2 = mat(outDim, hidden);
    this.b2 = new Array<number>(outDim).fill(0.0);
  }

  forward(x: number[]): number[] {
    const h = geluVec(linear(this.W1, this.b1, x));
    return linear(this.W2, this.b2, h);
  }

  numParams(): number {
    return (
      this.W1.length * this.W1[0].length +
      this.b1.length +
      this.W2.length * this.W2[0].length +
      this.b2.length
    );
  }
}

function fakeVitOutput(): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < PATCH_COUNT; i++) out.push(vec(PATCH_DIM));
  return out;
}

interface LlavaPrompt {
  raw_prompt: string;
  placeholder: string;
  image_tokens: number;
  text_token_estimate: number;
}

function buildLlavaPrompt(system: string, user: string, imageTokens: number): LlavaPrompt {
  const placeholder = "<image>";
  const template = `SYSTEM: ${system}\nUSER: ${placeholder} ${user}\nASSISTANT: `;
  const words = template.split(/\s+/).filter((w) => w.length > 0);
  return {
    raw_prompt: template,
    placeholder,
    image_tokens: imageTokens,
    text_token_estimate: words.length + 10,
  };
}

function visualizeContext(numImageTokens: number, textTokens: number): void {
  console.log("\ncontext budget at different LLM windows");
  console.log("-".repeat(60));
  const totals = [2048, 8192, 32768, 131072];
  for (const t of totals) {
    const used = numImageTokens + textTokens;
    const remain = t - used;
    const pctImage = (100 * numImageTokens) / t;
    console.log(
      `  window ${String(t).padStart(6)}: image ${pctImage.toFixed(1).padStart(5)}% | ` +
        `text ${((100 * textTokens) / t).toFixed(1).padStart(4)}% | remain ${String(Math.max(remain, 0)).padStart(6)} tokens`,
    );
  }
}

function demoProjector(): void {
  console.log("\nDEMO 1: 2-layer MLP projector forward pass");
  console.log("-".repeat(60));
  const patches = fakeVitOutput();
  const proj = new MLPProjector(PATCH_DIM, HIDDEN_DIM, LLM_DIM);

  console.log(`  ViT out: ${PATCH_COUNT} patches of dim ${PATCH_DIM}`);
  console.log(`  MLP:     ${PATCH_DIM} -> ${HIDDEN_DIM} -> ${LLM_DIM}`);
  console.log(`  params:  ${commas(proj.numParams())}`);

  const visualTokens = patches.map((p) => proj.forward(p));
  console.log(`  output:  ${visualTokens.length} visual tokens of dim ${visualTokens[0].length}`);
  const sample = visualTokens[0].slice(0, 6).map((x) => pyFloat(Number(x.toFixed(3))));
  console.log(`  token 0 sample: [${sample.join(", ")}]`);
}

function demoPrompt(): void {
  console.log("\nDEMO 2: LLaVA prompt template");
  console.log("-".repeat(60));
  const system = "A chat between a curious human and an artificial intelligence assistant.";
  const user = "Describe what you see in this image in detail.";
  const prompt = buildLlavaPrompt(system, user, 576);

  console.log("  raw prompt (LLM receives this after image-token replacement):");
  console.log("  " + "-".repeat(56));
  for (const line of prompt.raw_prompt.split("\n")) console.log(`    ${line}`);
  console.log(`  <image> placeholder -> replaced with ${prompt.image_tokens} visual tokens`);
  console.log(`  text token estimate: ~${prompt.text_token_estimate} tokens`);
  visualizeContext(prompt.image_tokens, prompt.text_token_estimate);
}

function demoAnyres(): void {
  console.log("\nDEMO 3: LLaVA-NeXT AnyRes token cost");
  console.log("-".repeat(60));
  const tileTokens = 576;
  const configs: [string, number, number][] = [
    ["336x336 (base)", 1, 0],
    ["672x336 (1x2)", 2, 1],
    ["672x672 (2x2)", 4, 1],
    ["1344x672 (2x4)", 8, 1],
    ["1344x1344 (4x4)", 16, 1],
  ];
  for (const [name, tiles, thumb] of configs) {
    const total = tiles * tileTokens + thumb * tileTokens;
    console.log(
      `  ${name.padEnd(20)}: ${String(tiles).padStart(2)} tiles + ${thumb} thumbnail = ${String(total).padStart(5)} tokens`,
    );
  }
}

function main(): void {
  console.log("=".repeat(60));
  console.log("LLAVA VISUAL INSTRUCTION TUNING (Phase 12, Lesson 05)");
  console.log("=".repeat(60));
  demoProjector();
  demoPrompt();
  demoAnyres();
  console.log("\n" + "=".repeat(60));
  console.log("TAKEAWAYS");
  console.log("-".repeat(60));
  console.log("  · 2-layer MLP projector: 22M params (trivial next to the 7B LLM)");
  console.log("  · <image> placeholder -> replace with N projected visual tokens");
  console.log("  · base LLaVA: 576 tokens per image (30% of 2k context)");
  console.log("  · AnyRes: up to 2880 tokens for high-res OCR / chart inputs");
  console.log("  · stage 1: train projector alone (hours)");
  console.log("  · stage 2: train projector + LLM on 158k GPT-4 instructions");
}

main();
