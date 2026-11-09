// Lesson: CLIP and Contrastive Vision-Language Pretraining (phase 12 / lesson 02)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/02-clip-contrastive-pretraining/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/02-clip-contrastive-pretraining/code/main.ts

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

function gauss(rng: Random, mu: number, sigma: number): number {
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

function signed(x: number, digits: number): string {
  const s = x.toFixed(digits);
  return s.startsWith("-") ? s : "+" + s;
}

function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1.0;
  return v.map((x) => x / n);
}

function cosine(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

function similarityMatrix(images: number[][], texts: number[][], tau: number): number[][] {
  const I = images.map(normalize);
  const T = texts.map(normalize);
  const N = I.length;
  const S: number[][] = [];
  for (let i = 0; i < N; i++) S.push(new Array<number>(N).fill(0.0));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) S[i][j] = cosine(I[i], T[j]) / tau;
  }
  return S;
}

function logSumExp(row: number[]): number {
  const m = Math.max(...row);
  return m + Math.log(row.reduce((s, x) => s + Math.exp(x - m), 0));
}

function infonceLoss(S: number[][]): number {
  const N = S.length;
  let lossI2t = 0.0;
  for (let i = 0; i < N; i++) lossI2t += -S[i][i] + logSumExp(S[i]);
  let lossT2i = 0.0;
  for (let j = 0; j < N; j++) {
    const col = S.map((row) => row[j]);
    lossT2i += -S[j][j] + logSumExp(col);
  }
  return (lossI2t + lossT2i) / (2 * N);
}

function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1.0 / (1.0 + z);
  }
  const z = Math.exp(x);
  return z / (1.0 + z);
}

function sigmoidLoss(S: number[][], bias = 0.0): number {
  const N = S.length;
  let total = 0.0;
  let count = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const logit = S[i][j] + bias;
      const y = i === j ? 1.0 : 0.0;
      const p = sigmoid(logit);
      const eps = 1e-9;
      const term = y * Math.log(p + eps) + (1 - y) * Math.log(1 - p + eps);
      total += -term;
      count += 1;
    }
  }
  return total / count;
}

function zeroShotClassify(image: number[], classTexts: Map<string, number[]>): [string, number][] {
  const img = normalize(image);
  const scores: [string, number][] = [];
  for (const [name, vec] of classTexts) scores.push([name, cosine(img, normalize(vec))]);
  scores.sort((p, q) => q[1] - p[1]);
  return scores;
}

function makeFakeEmbedding(seed: number, dim = 64): number[] {
  const rng = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < dim; i++) out.push(gauss(rng, 0, 1));
  return out;
}

function demoInfonce(): void {
  console.log("\nDEMO 1: InfoNCE on 4 aligned pairs");
  console.log("-".repeat(60));
  const images: number[][] = [];
  for (let i = 0; i < 4; i++) images.push(makeFakeEmbedding(i));
  const texts = images.map((v, i) => v.map((x, k) => x + 0.05 * makeFakeEmbedding(i + 100)[k]));

  for (const tau of [0.07, 0.1, 1.0]) {
    const S = similarityMatrix(images, texts, tau);
    const loss = infonceLoss(S);
    const slip = sigmoidLoss(S);
    console.log(
      `  tau=${tau.toFixed(2).padStart(4)}  InfoNCE=${loss.toFixed(4)}  SigLIP=${slip.toFixed(4)}`,
    );
  }
}

function demoShuffled(): void {
  console.log("\nDEMO 2: what happens with misaligned pairs");
  console.log("-".repeat(60));
  const images: number[][] = [];
  const texts: number[][] = [];
  for (let i = 0; i < 6; i++) images.push(makeFakeEmbedding(i));
  for (let i = 0; i < 6; i++) texts.push(makeFakeEmbedding(i + 500));
  const S = similarityMatrix(images, texts, 0.07);
  const loss = infonceLoss(S);
  const slip = sigmoidLoss(S);
  console.log(`  misaligned: InfoNCE=${loss.toFixed(4)}  SigLIP=${slip.toFixed(4)}`);
  const alignedImgs: number[][] = [];
  for (let i = 0; i < 6; i++) alignedImgs.push(makeFakeEmbedding(i));
  const alignedTxt = alignedImgs.map((v) => v.map((x) => x + 0.02));
  const S2 = similarityMatrix(alignedImgs, alignedTxt, 0.07);
  console.log(
    `  aligned   : InfoNCE=${infonceLoss(S2).toFixed(4)}  SigLIP=${sigmoidLoss(S2).toFixed(4)}`,
  );
  console.log("  aligned loss < misaligned loss confirms the gradient signal.");
}

function demoZeroShot(): void {
  console.log("\nDEMO 3: zero-shot classification");
  console.log("-".repeat(60));
  const classes = new Map<string, number[]>([
    ["cat", makeFakeEmbedding(42)],
    ["dog", makeFakeEmbedding(43)],
    ["bird", makeFakeEmbedding(44)],
    ["car", makeFakeEmbedding(45)],
  ]);
  const dog = classes.get("dog") ?? [];
  const queryImage = dog.map((c, i) => c + 0.3 * makeFakeEmbedding(999)[i]);

  const ranked = zeroShotClassify(queryImage, classes);
  console.log("  query image (close to 'dog' prototype):");
  for (const [name, score] of ranked) {
    console.log(`    ${name.padEnd(6)}: ${signed(score, 4)}`);
  }
  console.log(`  top-1: ${ranked[0][0]}`);
}

function demoPromptEnsemble(): void {
  console.log("\nDEMO 4: prompt template ensemble");
  console.log("-".repeat(60));
  const templates = ["a photo of a {class}", "a picture of a {class}", "an image of a {class}"];
  const className = "golden retriever";
  let ensembleVec = new Array<number>(64).fill(0.0);
  let count = 0;
  for (const t of templates) {
    const prompt = t.replace("{class}", className);
    let seed = 0;
    for (const ch of prompt) seed += ch.codePointAt(0) ?? 0;
    const emb = makeFakeEmbedding(seed);
    for (let k = 0; k < 64; k++) ensembleVec[k] += emb[k];
    count += 1;
  }
  ensembleVec = ensembleVec.map((x) => x / count);
  const first6 = ensembleVec.slice(0, 6).map((x) => pyFloat(Number(x.toFixed(3))));
  console.log(`  ensembled ${count} prompts for '${className}'`);
  console.log(`  first 6 dims: [${first6.join(", ")}]`);
  console.log("  single-template: noisier; ensemble: +1-3 points on real benchmarks.");
}

function main(): void {
  console.log("=".repeat(60));
  console.log("CLIP / SIGLIP CONTRASTIVE TRAINING (Phase 12, Lesson 02)");
  console.log("=".repeat(60));
  demoInfonce();
  demoShuffled();
  demoZeroShot();
  demoPromptEnsemble();
  console.log("\n" + "=".repeat(60));
  console.log("TAKEAWAYS");
  console.log("-".repeat(60));
  console.log("  · InfoNCE penalizes rows AND columns (symmetric)");
  console.log("  · Lower tau -> sharper softmax -> more hard-negative pressure");
  console.log("  · Sigmoid loss decouples pairs -> no all-gather in distributed runs");
  console.log("  · Zero-shot = argmax cos(image, prompt) over class prompts");
}

main();
