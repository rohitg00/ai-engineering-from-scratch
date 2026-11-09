// Lesson: ColPali and Vision-Native Document RAG (phase 12 / lesson 23)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/23-colpali-vision-native-rag/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/23-colpali-vision-native-rag/code/main.ts

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

let rng = mulberry32(7);

function seed(s: number): void {
  rng = mulberry32(s);
}

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

class Page {
  constructor(public docId: string, public patches: number[][]) {}
}

class Query {
  constructor(public text: string, public tokens: number[][]) {}
}

function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  let sa = 0;
  for (const x of a) sa += x * x;
  let sb = 0;
  for (const y of b) sb += y * y;
  const na = Math.sqrt(sa) + 1e-8;
  const nb = Math.sqrt(sb) + 1e-8;
  return dot / (na * nb);
}

function maxsim(queryTokens: number[][], patches: number[][]): number {
  let s = 0.0;
  for (const q of queryTokens) {
    let best = -Infinity;
    for (const p of patches) best = Math.max(best, cosine(q, p));
    s += best;
  }
  return s;
}

function randomEmb(dim: number, bias = 0): number[] {
  const out: number[] = [];
  for (let i = 0; i < dim; i++) out.push(gauss(bias / 10.0, 1.0));
  return out;
}

function buildPages(nPages = 5, nPatches = 16, dim = 32): Page[] {
  const pages: Page[] = [];
  const topics = ["finance", "science", "legal", "medical", "engineering"];
  topics.slice(0, nPages).forEach((topic, i) => {
    const bias = i + 1;
    const patches: number[][] = [];
    for (let j = 0; j < nPatches; j++) patches.push(randomEmb(dim, bias));
    pages.push(new Page(`page_${i}_${topic}`, patches));
  });
  return pages;
}

function buildQueries(dim = 32): Query[] {
  seed(100);
  const queries: Query[] = [];
  const specs: [string, number][] = [
    ["Q3 revenue growth", 1],
    ["proof of lemma 3", 2],
    ["patient diagnosis", 4],
  ];
  for (const [text, bias] of specs) {
    const tokens: number[][] = [];
    for (let i = 0; i < 4; i++) tokens.push(randomEmb(dim, bias));
    queries.push(new Query(text, tokens));
  }
  return queries;
}

function retrieve(query: Query, pages: Page[], k = 3): [string, number][] {
  const scored: [string, number][] = pages.map((p) => [p.docId, maxsim(query.tokens, p.patches)]);
  scored.sort((a, b) => b[1] - a[1]);
  return scored.slice(0, k);
}

function storageEstimate(): void {
  console.log("\nSTORAGE: COLPALI vs TEXT-RAG");
  console.log("-".repeat(60));
  console.log(`  ${"system".padEnd(24)}${"bytes/page".padEnd(14)}  note`);
  console.log(`  ${"text-RAG 768d bi-enc".padEnd(24)}${"3.0 KB".padEnd(14)}  one vector per chunk`);
  console.log(`  ${"ColPali raw (729 x 128)".padEnd(24)}${"365 KB".padEnd(14)}  one vec per patch`);
  console.log(`  ${"ColPali PQ 8x".padEnd(24)}${"46 KB".padEnd(14)}  OPQ compression`);
  console.log(`  ${"VisRAG bi-enc".padEnd(24)}${"3.0 KB".padEnd(14)}  single vec per page`);
}

function compareMaxsimVsMean(): void {
  console.log("\nMAXSIM vs MEAN SIMILARITY");
  console.log("-".repeat(60));
  seed(42);
  const qTokens = [
    [1.0, 0.1, 0.0],
    [0.0, 1.0, 0.1],
  ];
  const strongPatch = [0.9, 0.9, 0.0];
  const otherPatches = [
    [0.1, 0.1, 0.1],
    [0.2, 0.2, 0.2],
    [0.0, 0.0, 0.0],
  ];
  const patches = [strongPatch, ...otherPatches];
  const maxScore = maxsim(qTokens, patches);
  let total = 0;
  for (const q of qTokens) for (const p of patches) total += cosine(q, p);
  const meanScore = total / (qTokens.length * patches.length);
  console.log(`  MaxSim : ${maxScore.toFixed(3)}   (captures best matches per query token)`);
  console.log(`  Mean   : ${meanScore.toFixed(3)}   (washed out by irrelevant patches)`);
  console.log("  MaxSim's selectivity is why late interaction beats bi-encoder recall");
}

function main(): void {
  console.log("=".repeat(60));
  console.log("COLPALI VISION-NATIVE RAG (Phase 12, Lesson 23)");
  console.log("=".repeat(60));

  const pages = buildPages(5, 16, 32);
  const queries = buildQueries(32);

  console.log("\nINDEX + RETRIEVE");
  console.log("-".repeat(60));
  for (const q of queries) {
    const hits = retrieve(q, pages, 3);
    console.log(`  query: '${q.text}'`);
    for (const [pageId, score] of hits) console.log(`    ${pageId.padEnd(22)}  score=${signed(score, 3)}`);
    console.log();
  }

  compareMaxsimVsMean();
  storageEstimate();

  console.log("\nEND-TO-END PIPELINE");
  console.log("-".repeat(60));
  console.log("  ingest : PDF -> page PNG -> PaliGemma -> patch vectors (cached)");
  console.log("  query  : user text -> tokens -> MaxSim -> top-k pages");
  console.log("  gen    : top-k page images + query -> Qwen2.5-VL -> answer");
  console.log("  no OCR, no chunking, no layout loss");
}

main();
