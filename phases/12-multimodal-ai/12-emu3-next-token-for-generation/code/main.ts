// Lesson: Emu3: Next-Token Prediction for Image and Video Generation (phase 12 / lesson 12)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/12-emu3-next-token-for-generation/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/12-emu3-next-token-for-generation/code/main.ts

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

const rng: Random = mulberry32(7);

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

function roundList(xs: number[], digits: number): string {
  return "[" + xs.map((x) => pyFloat(Number(x.toFixed(digits)))).join(", ") + "]";
}

class TokCost {
  constructor(
    public label: string,
    public resolution: number,
    public reduction: number,
    public videoSeconds = 0.0,
    public fps = 0.0,
    public timeReduction = 1,
  ) {}

  tokens(): number {
    const spatialPerFrame = Math.floor(this.resolution / this.reduction) ** 2;
    if (this.videoSeconds === 0) return spatialPerFrame;
    const frames = Math.trunc(this.videoSeconds * this.fps);
    const framesReduced = Math.max(1, Math.floor(frames / this.timeReduction));
    return spatialPerFrame * framesReduced;
  }
}

function tokenTable(): void {
  console.log("\nEMU3 TOKEN COUNTS (at recommended tokenizer reductions)");
  console.log("-".repeat(60));
  const configs = [
    new TokCost("image 256x256", 256, 8),
    new TokCost("image 512x512", 512, 8),
    new TokCost("image 1024x1024", 1024, 8),
    new TokCost("image 2048x2048", 2048, 8),
    new TokCost("video 4s @8fps 256x256", 256, 8, 4.0, 8, 4),
    new TokCost("video 10s @8fps 256x256", 256, 8, 10.0, 8, 4),
    new TokCost("video 4s @8fps 512x512", 512, 8, 4.0, 8, 4),
  ];
  console.log(`${"config".padEnd(32)}${"tokens".padStart(12)}${"seconds @30tps".padStart(18)}`);
  for (const c of configs) {
    const t = c.tokens();
    const latency = t / 30.0;
    console.log(`  ${c.label.padEnd(30)}${String(t).padStart(12)}${latency.toFixed(1).padStart(16)}s`);
  }
}

function softmax(xs: number[], temperature = 1.0): number[] {
  const m = Math.max(...xs);
  const exps = xs.map((x) => Math.exp((x - m) / temperature));
  const z = exps.reduce((s, e) => s + e, 0);
  return exps.map((e) => e / z);
}

function cfgMix(condLogits: number[], uncondLogits: number[], gamma: number): number[] {
  return condLogits.map((c, i) => uncondLogits[i] + gamma * (c - uncondLogits[i]));
}

function sample(probs: number[]): number {
  const r = rng();
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i];
    if (r <= acc) return i;
  }
  return probs.length - 1;
}

function demoCfg(): void {
  console.log("\nCLASSIFIER-FREE GUIDANCE: effect on logit shape");
  console.log("-".repeat(60));
  const cond = [2.0, 4.0, 1.0, 3.5, 0.5];
  const uncond = [1.0, 2.0, 1.5, 1.8, 1.2];
  for (const gamma of [0.0, 1.0, 3.0, 5.0, 7.0]) {
    const mixed = cfgMix(cond, uncond, gamma);
    const probs = softmax(mixed);
    const top = probs.indexOf(Math.max(...probs));
    console.log(`  gamma=${gamma.toFixed(1).padStart(4)}  logits=${roundList(mixed, 2)}`);
    console.log(`            probs =${roundList(probs, 3)}  top=${top}`);
  }
  console.log("\n  higher gamma -> sharper distribution -> higher-fidelity gen");
  console.log("  Emu3 recommends gamma = 3.0 for image gen, 7.0 for strong adherence");
}

function sampleTokens(cond: number[][], uncond: number[][], gamma = 3.0, temp = 0.8): number[] {
  const out: number[] = [];
  cond.forEach((c, i) => {
    const mixed = cfgMix(c, uncond[i], gamma);
    const probs = softmax(mixed, temp);
    out.push(sample(probs));
  });
  return out;
}

function demoSampling(): void {
  console.log("\nAUTOREGRESSIVE IMAGE-TOKEN SAMPLING (toy, K=16 codebook)");
  console.log("-".repeat(60));
  const K = 16;
  const steps = 8;
  const cond: number[][] = [];
  for (let s = 0; s < steps; s++) {
    const row: number[] = [];
    for (let k = 0; k < K; k++) row.push(gauss(0, 2));
    cond.push(row);
  }
  const uncond: number[][] = [];
  for (let s = 0; s < steps; s++) {
    const row: number[] = [];
    for (let k = 0; k < K; k++) row.push(gauss(0, 1));
    uncond.push(row);
  }
  const tokensNoCfg = sampleTokens(cond, uncond, 1.0, 1.0);
  const tokensCfg3 = sampleTokens(cond, uncond, 3.0, 0.8);
  const tokensCfg7 = sampleTokens(cond, uncond, 7.0, 0.8);
  console.log(`  no CFG      : [${tokensNoCfg.join(", ")}]`);
  console.log(`  CFG gamma=3 : [${tokensCfg3.join(", ")}]`);
  console.log(`  CFG gamma=7 : [${tokensCfg7.join(", ")}]`);
  console.log("  higher gamma converges on the conditional modes; same pattern at scale.");
}

function main(): void {
  console.log("=".repeat(60));
  console.log("EMU3: NEXT-TOKEN PREDICTION FOR IMAGE + VIDEO (Phase 12, Lesson 12)");
  console.log("=".repeat(60));

  tokenTable();
  demoCfg();
  demoSampling();

  console.log("\n" + "=".repeat(60));
  console.log("EMU3 vs SDXL: high-level compute picture");
  console.log("-".repeat(60));
  console.log("  training    : Emu3 does not publish a token count; exercise 4 assumes 300B");
  console.log("  inference   : Emu3 slow (~2min per 512x512 at 30 tps)");
  console.log("                SDXL fast (~2-5s per 512x512)");
  console.log("  quality     : Emu3 matches or beats on FID/GenEval");
  console.log("  flexibility : Emu3 also does perception + video; SDXL cannot");
}

main();
