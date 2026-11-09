// Lesson: Show-o and Discrete-Diffusion Unified Models (phase 12 / lesson 14)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/14-show-o-discrete-diffusion-unified/code/main.ts

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

const rng: Random = mulberry32(2);

function gauss(mu: number, sigma: number): number {
  let u1 = rng();
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const VOCAB = 8;
const SEQ_LEN = 16;
const MASK = -1;

function cosineSchedule(T: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < T; t++) out.push(Math.cos((Math.PI * (t + 1)) / (2 * T)));
  return out;
}

function mockLogits(tokens: number[], promptSeed = 0): number[][] {
  const logits: number[][] = [];
  tokens.forEach((t, i) => {
    const base: number[] = [];
    for (let k = 0; k < VOCAB; k++) base.push(gauss(0, 0.3));
    const bias = (promptSeed + i) % VOCAB;
    base[bias] += 2.5;
    if (t !== MASK) base[t] += 3.0;
    logits.push(base);
  });
  return logits;
}

function softmax(xs: number[]): number[] {
  const m = Math.max(...xs);
  const e = xs.map((x) => Math.exp(x - m));
  const z = e.reduce((s, x) => s + x, 0);
  return e.map((x) => x / z);
}

function stepUnmask(tokens: number[], promptSeed: number, keepRatio: number): number[] {
  const logits = mockLogits(tokens, promptSeed);
  const preds: [number, number, number][] = [];
  const confs: number[] = [];
  tokens.forEach((t, i) => {
    if (t === MASK) {
      const probs = softmax(logits[i]);
      let top = 0;
      for (let k = 1; k < VOCAB; k++) if (probs[k] > probs[top]) top = k;
      preds.push([i, top, probs[top]]);
    } else {
      preds.push([i, t, 1.0]);
    }
    confs.push(preds[preds.length - 1][2]);
  });
  const maskedIndices: number[] = [];
  tokens.forEach((t, i) => {
    if (t === MASK) maskedIndices.push(i);
  });
  maskedIndices.sort((a, b) => -preds[a][2] - -preds[b][2]);
  const nToKeep = Math.max(1, Math.trunc(maskedIndices.length * keepRatio));
  const newTokens = [...tokens];
  for (const idx of maskedIndices.slice(0, nToKeep)) newTokens[idx] = preds[idx][1];
  return newTokens;
}

function sample(promptSeed: number, T = 8): number[][] {
  let tokens = new Array<number>(SEQ_LEN).fill(MASK);
  const traces = [[...tokens]];
  const ratios = cosineSchedule(T);
  for (let step = 0; step < T; step++) {
    const remaining = tokens.filter((t) => t === MASK).length;
    if (remaining === 0) break;
    const keepRatio = Math.max(0.15, 1 - ratios[step]);
    tokens = stepUnmask(tokens, promptSeed, keepRatio);
    traces.push([...tokens]);
  }
  while (tokens.some((t) => t === MASK)) {
    tokens = stepUnmask(tokens, promptSeed, 1.0);
    traces.push([...tokens]);
  }
  return traces;
}

function render(tokens: number[]): string {
  return tokens.map((t) => (t !== MASK ? String(t).padStart(2) : " .")).join(" ");
}

function main(): void {
  console.log("=".repeat(60));
  console.log("SHOW-O MASKED-DISCRETE-DIFFUSION SAMPLER (Phase 12, Lesson 14)");
  console.log("=".repeat(60));

  const T = 8;
  console.log(`\nSchedule (cosine, T=${T} steps)`);
  console.log("-".repeat(60));
  cosineSchedule(T).forEach((r, t) => {
    console.log(`  step ${String(t).padStart(2)}  mask_ratio = ${r.toFixed(3)}`);
  });

  console.log("\nSAMPLING TRACE (prompt_seed=3)");
  console.log("-".repeat(60));
  const traces = sample(3, T);
  traces.forEach((tr, i) => {
    const nMask = tr.filter((x) => x === MASK).length;
    console.log(`  step ${String(i).padStart(2)}  masked=${String(nMask).padStart(2)}  | ${render(tr)}`);
  });

  console.log("\nFOUR TASKS, ONE CHECKPOINT");
  console.log("-".repeat(60));
  console.log("  1. text gen : standard NTP on text tokens");
  console.log("  2. VQA      : image in -> text out (causal NTP on text)");
  console.log("  3. T2I      : text in -> masked image + diffusion sampler");
  console.log("  4. inpaint  : partially-masked image -> fill in via same loop");
}

main();
