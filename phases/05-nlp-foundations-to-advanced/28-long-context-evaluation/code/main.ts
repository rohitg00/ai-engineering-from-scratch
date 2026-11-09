// Lesson: Long-Context Evaluation: NIAH, RULER, LongBench, MRCR (phase 05 / lesson 28)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/28-long-context-evaluation/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/28-long-context-evaluation/code/main.ts

type Random = () => number;

const FILLER_WORDS = (
  "the quick brown fox jumps over the lazy dog and then runs across the field " +
  "where birds sing and flowers bloom while the river flows gently toward the sea " +
  "and clouds drift slowly across a sky painted in hues of orange and pink " +
  "as evening approaches and the day begins to fade into quiet darkness "
)
  .split(/\s+/)
  .filter((w) => w.length > 0);

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

function pyFixed(x: number, d: number): string {
  if (Object.is(x, -0)) return "-" + (0).toFixed(d);
  const wide = Math.abs(x).toFixed(Math.min(100, d + 25));
  const dot = wide.indexOf(".");
  const cut = dot + 1 + d;
  if (/^50*$/.test(wide.slice(cut))) {
    const head = wide.slice(0, d === 0 ? dot : cut);
    if (Number(head[head.length - 1]) % 2 === 0) return (x < 0 ? "-" : "") + head;
  }
  return x.toFixed(d);
}

function words(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

function stripChars(s: string, chars: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && chars.includes(s[start])) start++;
  while (end > start && chars.includes(s[end - 1])) end--;
  return s.slice(start, end);
}

function makeFiller(nTokens: number, seed: number): string {
  const rng = mulberry32(seed);
  const out: string[] = [];
  for (let i = 0; i < nTokens; i++) out.push(FILLER_WORDS[Math.floor(rng() * FILLER_WORDS.length)]);
  return out.join(" ");
}

function insertNeedle(filler: string, needle: string, depthRatio: number): string {
  const ws = words(filler);
  const pos = Math.trunc(ws.length * depthRatio);
  return [...ws.slice(0, pos), needle, ...ws.slice(pos)].join(" ");
}

function mockRetrievalModel(context: string, question: string, effectiveCapacity: number): string {
  const needlePattern =
    /(?:the magic word is|the secret code is|the pass phrase is|x1\s*=|x2\s*=|x3\s*=) [A-Z0-9a-z_]+/gi;
  const matches = [...context.matchAll(needlePattern)];
  if (matches.length === 0) return "no answer";
  const totalLen = words(context).length;
  for (const m of matches) {
    const before = words(context.slice(0, m.index ?? 0)).length;
    if (before <= effectiveCapacity) {
      const parts = words(m[0]);
      return stripChars(parts[parts.length - 1], ",.");
    }
  }
  return "no answer";
}

function scoreSingleNeedle(context: string, expected: string, effectiveCapacity: number): number {
  const question = "What is the magic word?";
  const answer = mockRetrievalModel(context, question, effectiveCapacity);
  return answer.toLowerCase().includes(expected.toLowerCase()) ? 1 : 0;
}

function scoreMultiNeedle(context: string, expectedList: string[], effectiveCapacity: number): number {
  const needlePattern = /the magic word is ([A-Za-z0-9_]+)/gi;
  const found: string[] = [];
  for (const m of context.matchAll(needlePattern)) {
    const before = words(context.slice(0, m.index ?? 0)).length;
    if (before <= effectiveCapacity) found.push(m[1].toLowerCase());
  }
  const hits = expectedList.filter((e) => found.includes(e.toLowerCase())).length;
  return hits / expectedList.length;
}

function runNiahGrid(lengths: number[], depths: number[], seed = 0): void {
  const needle = "the magic word is pineapple";
  const expected = "pineapple";
  const capacity = 20000;
  const corner = "depth\\len";
  console.log(`  ${corner.padEnd(12)}  ` + lengths.map((n) => String(n).padStart(6)).join("  "));
  for (const d of depths) {
    const row: number[] = [];
    for (const n of lengths) {
      const filler = makeFiller(n, seed + n);
      const haystack = insertNeedle(filler, needle, d);
      row.push(scoreSingleNeedle(haystack, expected, capacity));
    }
    const sum = row.reduce((a, b) => a + b, 0);
    const tag = row.every((x) => x) ? "  PASS" : `${sum}/${row.length}`;
    console.log(`  depth=${String(d).padEnd(5)}    ` + row.map((x) => String(x).padStart(6)).join("  ") + "    " + tag);
  }
}

function runMultiNeedle(length: number, nNeedles = 3, seed = 42): number {
  const needles = ["the magic word is pineapple", "the magic word is compass", "the magic word is whisper"].slice(
    0,
    nNeedles,
  );
  const expected = ["pineapple", "compass", "whisper"].slice(0, nNeedles);
  const filler = makeFiller(length, seed);
  const depths = [0.2, 0.5, 0.8].slice(0, nNeedles);
  let ws = words(filler);
  const pairs = depths
    .map((d, i): [number, string] => [d, needles[i]])
    .sort((a, b) => {
      if (a[0] !== b[0]) return b[0] - a[0];
      if (a[1] === b[1]) return 0;
      return a[1] < b[1] ? 1 : -1;
    });
  for (const [d, n] of pairs) {
    const pos = Math.trunc(ws.length * d);
    ws = [...ws.slice(0, pos), n, ...ws.slice(pos)];
  }
  const haystack = ws.join(" ");
  return scoreMultiNeedle(haystack, expected, length);
}

function main(): void {
  const lengths = [500, 2000, 8000, 20000, 40000];
  const depths = [0.1, 0.3, 0.5, 0.7, 0.9];

  console.log("=== toy NIAH grid (mock model with effective capacity = 20k) ===");
  console.log("marker: 1 = needle found in-context,  0 = needle missed");
  console.log();
  runNiahGrid(lengths, depths);

  console.log();
  console.log("=== multi-needle at length=10000, n=3 ===");
  const score = runMultiNeedle(10000, 3);
  console.log(`  found ${pyFixed(score * 3, 0)} / 3 needles`);

  console.log();
  console.log("notes:");
  console.log("  mock model has hard effective-capacity cutoff; real LLMs degrade gradually.");
  console.log("  real NIAH: sweep 5 depths × 6 lengths, produce heatmap per model.");
  console.log("  always pair with one multi-hop / aggregation task (RULER): single-needle is saturable.");
}

main();

export {};
