// Lesson: Multimodal RAG and Cross-Modal Retrieval (phase 12 / lesson 24)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/24-multimodal-rag-cross-modal/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/24-multimodal-rag-cross-modal/code/main.ts

export {};

class Restaurant {
  constructor(
    public id: string,
    public name: string,
    public reviewText: string,
    public imageTags: string[],
    public ambientDb: number,
  ) {}
}

const CORPUS: Restaurant[] = [
  new Restaurant("r1", "Sunday Plant Bistro", "best vegan brunch, quiet mornings, lots of windows", ["natural_light", "minimal"], 38),
  new Restaurant("r2", "Orange Grove Cafe", "all-day vegan brunch, noisy music, industrial style", ["industrial"], 68),
  new Restaurant("r3", "Vine & Leaf", "vegan lunch, dim lighting", ["warm_lighting"], 55),
  new Restaurant("r4", "Morning Glow", "vegan brunch, airy space, lots of sun", ["natural_light", "airy"], 42),
  new Restaurant("r5", "Steak Central", "steakhouse, loud atmosphere", ["dark"], 72),
];

type Scores = Map<string, number>;

function pyFloat(x: number): string {
  if (Number.isInteger(x)) return x.toFixed(1);
  return String(x);
}

function pyStrList(xs: string[]): string {
  return "[" + xs.map((x) => `'${x}'`).join(", ") + "]";
}

function pyTuple(t: [string, number]): string {
  return `('${t[0]}', ${pyFloat(t[1])})`;
}

function countOccurrences(text: string, sub: string): number {
  return text.split(sub).length - 1;
}

function textRetrieve(query: string): Scores {
  const keywords = query
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w.toLowerCase());
  const scores: Scores = new Map();
  for (const r of CORPUS) {
    const text = r.reviewText.toLowerCase();
    let s = 0;
    for (const k of keywords) s += countOccurrences(text, k);
    scores.set(r.id, keywords.length > 0 ? s / keywords.length : 0);
  }
  return scores;
}

function imageRetrieve(query: string): Scores {
  const q = query.toLowerCase();
  const tagHints: string[] = [];
  if (q.includes("light") || q.includes("sun")) tagHints.push("natural_light");
  if (q.includes("airy") || q.includes("spacious")) tagHints.push("airy");
  if (q.includes("minimal")) tagHints.push("minimal");
  const scores: Scores = new Map();
  for (const r of CORPUS) {
    let s = 0;
    for (const t of tagHints) if (r.imageTags.includes(t)) s += 1.0;
    scores.set(r.id, s / Math.max(1, tagHints.length));
  }
  return scores;
}

function audioRetrieve(query: string): Scores {
  const q = query.toLowerCase();
  const scores: Scores = new Map();
  if (q.includes("quiet") || q.includes("calm")) {
    for (const r of CORPUS) scores.set(r.id, Math.max(0.0, 1.0 - r.ambientDb / 80.0));
  } else {
    for (const r of CORPUS) scores.set(r.id, 0.5);
  }
  return scores;
}

function fuse(scoresList: Scores[], weights: number[]): Scores {
  const fused: Scores = new Map();
  for (const r of CORPUS) {
    let s = 0.0;
    const n = Math.min(weights.length, scoresList.length);
    for (let i = 0; i < n; i++) s += weights[i] * (scoresList[i].get(r.id) ?? 0);
    fused.set(r.id, s);
  }
  return fused;
}

function topK(scored: Scores, k = 3): [string, number][] {
  return [...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, k);
}

function groundedGenerate(query: string, ranked: [string, number][]): string {
  const lines = [`Answer for: '${query}'`];
  ranked.forEach(([rid, score], idx) => {
    const r = CORPUS.find((x) => x.id === rid) as Restaurant;
    lines.push(
      `  ${idx + 1}. ${r.name} (score ${score.toFixed(2)})` +
        ` [review ${rid}] [img tags ${pyStrList(r.imageTags)}] [ambient ${r.ambientDb}dB]`,
    );
  });
  return lines.join("\n");
}

function agenticLoop(query: string, confidenceFloor = 0.8): string {
  const t = textRetrieve(query);
  const i = imageRetrieve(query);
  const a = audioRetrieve(query);
  let fused = fuse([t, i, a], [0.3, 0.4, 0.3]);
  let top = topK(fused, 3);
  const confidence = top.length > 0 ? top[0][1] : 0;

  const trace = [`round 1: top=${pyTuple(top[0])}  confidence=${confidence.toFixed(2)}`];
  if (confidence < confidenceFloor) {
    trace.push("  confidence low; reformulating query");
    const query2 = query + " bright windows low noise";
    const i2 = imageRetrieve(query2);
    const a2 = audioRetrieve(query2);
    fused = fuse([t, i2, a2], [0.3, 0.5, 0.2]);
    top = topK(fused, 3);
    trace.push(`round 2: top=${pyTuple(top[0])}  confidence=${top[0][1].toFixed(2)}`);
  }
  return trace.join("\n") + "\n\n" + groundedGenerate(query, top);
}

function surveysTable(): void {
  console.log("\n2025 MULTIMODAL RAG SURVEYS");
  console.log("-".repeat(60));
  const rows: [string, string, string][] = [
    ["Abootorabi et al.", "Feb 2025", "comprehensive taxonomy"],
    ["Mei et al.", "Apr 2025", "sub-task benchmarks + failure modes"],
    ["Zhao et al.", "Mar 2025", "vision-focused, strong on ColPali"],
  ];
  for (const [name, date, note] of rows) console.log(`  ${name.padEnd(22)}${date.padEnd(10)}${note}`);
}

function main(): void {
  console.log("=".repeat(60));
  console.log("MULTIMODAL RAG (Phase 12, Lesson 24)");
  console.log("=".repeat(60));

  const query = "find me a quiet vegan brunch with natural light";
  console.log(`\nQUERY: ${query}`);
  console.log("-".repeat(60));
  const result = agenticLoop(query, 0.7);
  console.log(result);

  surveysTable();

  console.log("\nFUSION STRATEGIES");
  console.log("-".repeat(60));
  console.log("  score fusion : weighted sum, simple, fast");
  console.log("  MoE fusion   : gating routes to experts, learnable, trains");
  console.log("  attention    : small network weights retrieved items");
  console.log("  default: score fusion + slight bias toward dominant modality");
}

main();
