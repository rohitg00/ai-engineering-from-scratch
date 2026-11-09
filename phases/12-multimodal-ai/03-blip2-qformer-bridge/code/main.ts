// Lesson: From CLIP to BLIP-2: Q-Former as Modality Bridge (phase 12 / lesson 03)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/03-blip2-qformer-bridge/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/03-blip2-qformer-bridge/code/main.ts

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

const NUM_PATCH = 64;
const PATCH_DIM = 16;
const NUM_QUERY = 8;
const QUERY_DIM = 16;
const LLM_DIM = 24;

const rng: Random = mulberry32(42);

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

function vec(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(gauss(0, 1));
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

function matmulVec(M: number[][], v: number[]): number[] {
  return M.map((row) => dot(row, v));
}

function softmax(xs: number[]): number[] {
  const m = Math.max(...xs);
  const exps = xs.map((x) => Math.exp(x - m));
  const z = exps.reduce((s, e) => s + e, 0);
  return exps.map((e) => e / z);
}

function makePatches(): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < NUM_PATCH; i++) out.push(vec(PATCH_DIM));
  return out;
}

function makeQueries(): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < NUM_QUERY; i++) out.push(vec(QUERY_DIM));
  return out;
}

function crossAttention(
  queries: number[][],
  patches: number[][],
  Wq: number[][],
  Wk: number[][],
  Wv: number[][],
): [number[][], number[][]] {
  const Q = queries.map((q) => matmulVec(Wq, q));
  const K = patches.map((p) => matmulVec(Wk, p));
  const V = patches.map((p) => matmulVec(Wv, p));
  const d = Q[0].length;
  const scale = 1.0 / Math.sqrt(d);

  const attnWeights: number[][] = [];
  const out: number[][] = [];
  for (const q of Q) {
    const logits = K.map((k) => dot(q, k) * scale);
    const weights = softmax(logits);
    attnWeights.push(weights);
    const mixed = new Array<number>(d).fill(0.0);
    weights.forEach((w, i) => {
      for (let j = 0; j < d; j++) mixed[j] += w * V[i][j];
    });
    out.push(mixed);
  }
  return [out, attnWeights];
}

function linearProject(xs: number[][], W: number[][]): number[][] {
  return xs.map((x) => matmulVec(W, x));
}

function topPatchesPerQuery(attn: number[][], k = 3): number[][] {
  const out: number[][] = [];
  for (const weights of attn) {
    const idxs = weights
      .map((_, i) => i)
      .sort((a, b) => -weights[a] - -weights[b])
      .slice(0, k);
    out.push(idxs);
  }
  return out;
}

function summarizeAttention(attn: number[][]): void {
  console.log("\nattention-weight summary (softmax over 64 patches)");
  console.log("-".repeat(60));
  const top = topPatchesPerQuery(attn, 5);
  const entropies: number[] = [];
  for (const weights of attn) {
    const e = -weights.reduce((s, w) => s + w * Math.log(w + 1e-12), 0);
    entropies.push(e);
  }
  const avgE = entropies.reduce((s, e) => s + e, 0) / entropies.length;
  const maxE = Math.log(NUM_PATCH);
  top.forEach((idxs, i) => {
    const e = entropies[i];
    const topStr = idxs
      .slice(0, 5)
      .map((x) => `p${String(x).padStart(2, "0")}(${attn[i][x].toFixed(3)})`)
      .join(", ");
    console.log(`  query ${i}: entropy ${e.toFixed(3)}/${maxE.toFixed(3)}, top-5 ${topStr}`);
  });
  console.log(`  mean entropy: ${avgE.toFixed(3)}  (uniform baseline: ${maxE.toFixed(3)})`);
}

function demoUntrained(): void {
  console.log("\nDEMO: 8 queries attending over 64 patches");
  console.log("-".repeat(60));
  const patches = makePatches();
  const queries = makeQueries();
  const Wq = mat(QUERY_DIM, QUERY_DIM);
  const Wk = mat(QUERY_DIM, PATCH_DIM);
  const Wv = mat(QUERY_DIM, PATCH_DIM);
  const [attended, attn] = crossAttention(queries, patches, Wq, Wk, Wv);
  summarizeAttention(attn);
  const Wout = mat(LLM_DIM, QUERY_DIM);
  const projected = linearProject(attended, Wout);
  const trimmed = projected[0].slice(0, 8).map((x) => pyFloat(Number(x.toFixed(2))));
  console.log(`\noutput: ${projected.length} tokens of dim ${LLM_DIM} -> ready for LLM`);
  console.log(`first token (trimmed): [${trimmed.join(", ")}]`);
}

function identity(rows: number, cols: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) row.push(i === j ? 1.0 : 0.0);
    out.push(row);
  }
  return out;
}

function demoBiased(): void {
  console.log("\nDEMO: queries initialized from specific patches -> concentration");
  console.log("-".repeat(60));
  const patches = makePatches();
  const favored = [5, 17, 33, 48, 60, 2, 11, 27];
  const queries = favored.map((i) => [...patches[i]]);
  const Wq = identity(QUERY_DIM, QUERY_DIM);
  const Wk = identity(QUERY_DIM, PATCH_DIM);
  const Wv = identity(QUERY_DIM, PATCH_DIM);
  const [, attn] = crossAttention(queries, patches, Wq, Wk, Wv);
  console.log("  query_i should attend highest to patch[favored[i]]:");
  attn.forEach((weights, i) => {
    let top = 0;
    for (let k = 1; k < weights.length; k++) if (weights[k] > weights[top]) top = k;
    const hit = top === favored[i] ? "YES" : "miss";
    console.log(
      `    query ${i}: top patch ${top} (favored ${favored[i]}) weight ${weights[top].toFixed(3)} (${hit})`,
    );
  });
}

function main(): void {
  console.log("=".repeat(60));
  console.log("BLIP-2 Q-FORMER CROSS-ATTENTION TOY (Phase 12, Lesson 03)");
  console.log("=".repeat(60));
  demoUntrained();
  demoBiased();
  console.log("\n" + "=".repeat(60));
  console.log("TAKEAWAYS");
  console.log("-".repeat(60));
  console.log("  · queries are the fixed learnable parameters of the bridge");
  console.log("  · cross-attention maps (32 queries, 256 patches) -> 32 summaries");
  console.log("  · project to LLM hidden dim -> prepend to text input");
  console.log("  · BLIP-2 stage 1 trains bridge with ITC+ITM+ITG; no LLM");
  console.log("  · BLIP-2 stage 2 trains bridge + projector with LM loss");
}

main();
