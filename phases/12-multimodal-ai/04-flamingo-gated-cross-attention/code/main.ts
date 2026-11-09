// Lesson: Flamingo and Gated Cross-Attention for Few-Shot VLMs (phase 12 / lesson 04)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/04-flamingo-gated-cross-attention/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/04-flamingo-gated-cross-attention/code/main.ts

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

function signed(x: number, digits: number): string {
  const s = x.toFixed(digits);
  return s.startsWith("-") ? s : "+" + s;
}

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

function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

function matvec(M: number[][], v: number[]): number[] {
  return M.map((row) => dot(row, v));
}

function softmax(xs: number[]): number[] {
  const m = Math.max(...xs);
  const exps = xs.map((x) => Math.exp(x - m));
  const z = exps.reduce((s, e) => s + e, 0);
  return exps.map((e) => e / z);
}

function add(a: number[], b: number[]): number[] {
  const n = Math.min(a.length, b.length);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(a[i] + b[i]);
  return out;
}

function scale(a: number[], s: number): number[] {
  return a.map((x) => x * s);
}

function crossAttention(queries: number[][], keys: number[][], values: number[][]): number[][] {
  const d = queries[0].length;
  const scaleF = 1.0 / Math.sqrt(d);
  const out: number[][] = [];
  for (const q of queries) {
    const logits = keys.map((k) => dot(q, k) * scaleF);
    const w = softmax(logits);
    const mixed = new Array<number>(d).fill(0.0);
    w.forEach((wi, i) => {
      for (let j = 0; j < d; j++) mixed[j] += wi * values[i][j];
    });
    out.push(mixed);
  }
  return out;
}

function perceiverResampler(patches: number[][], numLatents: number, numBlocks = 2): number[][] {
  const dim = patches[0].length;
  let latents: number[][] = [];
  for (let i = 0; i < numLatents; i++) latents.push(vec(dim));
  for (let b = 0; b < numBlocks; b++) {
    const attended = crossAttention(latents, patches, patches);
    latents = latents.map((lat, i) => add(lat, attended[i]));
  }
  return latents;
}

function gatedCrossAttentionStep(
  textHidden: number[][],
  visualTokens: number[][],
  alpha: number,
): number[][] {
  const cross = crossAttention(textHidden, visualTokens, visualTokens);
  const gate = Math.tanh(alpha);
  return textHidden.map((t, i) => add(t, scale(cross[i], gate)));
}

function interleavedMask(sequence: string[]): boolean[][] {
  const textPositions: number[] = [];
  const imagePositions: number[] = [];
  sequence.forEach((s, i) => (s.startsWith("IMG") ? imagePositions : textPositions).push(i));

  const mask = textPositions.map(() => new Array<boolean>(imagePositions.length).fill(false));
  textPositions.forEach((tpos, ti) => {
    const preceding = imagePositions.filter((i) => i < tpos);
    if (preceding.length === 0) return;
    const mostRecentImg = preceding[preceding.length - 1];
    const imgIndex = imagePositions.indexOf(mostRecentImg);
    mask[ti][imgIndex] = true;
  });
  return mask;
}

function demoResampler(): void {
  console.log("\nDEMO 1: Perceiver resampler");
  console.log("-".repeat(60));
  for (const numPatches of [36, 196, 900]) {
    const patches: number[][] = [];
    for (let i = 0; i < numPatches; i++) patches.push(vec(16));
    const latents = perceiverResampler(patches, 8, 2);
    console.log(
      `  ${numPatches} patches in -> ${latents.length} latents of dim ${latents[0].length} out  (fixed shape regardless of input)`,
    );
  }
}

function demoGate(): void {
  console.log("\nDEMO 2: gated cross-attention");
  console.log("-".repeat(60));
  const textHidden: number[][] = [];
  for (let i = 0; i < 5; i++) textHidden.push(vec(16));
  const visual: number[][] = [];
  for (let i = 0; i < 8; i++) visual.push(vec(16));

  const outClosed = gatedCrossAttentionStep(textHidden, visual, 0.0);
  let deltas = outClosed.map((o, r) => Math.max(...o.map((a, k) => Math.abs(a - textHidden[r][k]))));
  console.log(`  alpha=0.0 (tanh=0.0): max delta vs input = ${Math.max(...deltas).toFixed(6)}`);
  console.log("  -> frozen LLM preserved exactly at init");

  const outOpen = gatedCrossAttentionStep(textHidden, visual, 2.0);
  deltas = outOpen.map(
    (o, r) => o.reduce((s, a, k) => s + Math.abs(a - textHidden[r][k]), 0) / o.length,
  );
  const avg = deltas.reduce((s, x) => s + x, 0) / deltas.length;
  console.log(`  alpha=2.0 (tanh=0.96): avg delta vs input = ${avg.toFixed(4)}`);
  console.log("  -> visual contribution mixed in");

  for (const a of [0.0, 0.5, 1.0, 2.0, 5.0]) {
    const g = Math.tanh(a);
    console.log(`    alpha=${a.toFixed(1).padStart(4)}  tanh(alpha)=${signed(g, 4)}`);
  }
}

function demoInterleavedMask(): void {
  console.log("\nDEMO 3: interleaved attention mask");
  console.log("-".repeat(60));
  const seq = ["IMG0", "t0a", "t0b", "IMG1", "t1a", "t1b", "t1c", "IMG2", "t2a"];
  const mask = interleavedMask(seq);
  const imageLabels = seq.filter((s) => s.startsWith("IMG"));
  const textLabels = seq.filter((s) => !s.startsWith("IMG"));

  const header = "         " + imageLabels.map((x) => x.padEnd(4)).join("  ");
  console.log(header);
  textLabels.forEach((tk, i) => {
    const row = imageLabels.map((_, j) => (mask[i][j] ? " ok " : "  . ")).join("  ");
    console.log(`  ${tk.padEnd(5)}: ${row}`);
  });
  console.log("  each text token only sees the most recent preceding image");
}

function main(): void {
  console.log("=".repeat(60));
  console.log("FLAMINGO GATED CROSS-ATTENTION TOY (Phase 12, Lesson 04)");
  console.log("=".repeat(60));
  demoResampler();
  demoGate();
  demoInterleavedMask();
  console.log("\n" + "=".repeat(60));
  console.log("TAKEAWAYS");
  console.log("-".repeat(60));
  console.log("  · Perceiver resampler: fixed K latents regardless of input size");
  console.log("  · tanh(alpha) gate with alpha=0 -> no-op; LLM preserved at init");
  console.log("  · interleaved mask lets text tokens attend to preceding image");
  console.log("  · Flamingo inserts gated cross-attn every 4 LLM layers");
}

main();
