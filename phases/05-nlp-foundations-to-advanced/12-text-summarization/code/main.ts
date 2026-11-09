// Lesson: Text Summarization (phase 05 / lesson 12)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/12-text-summarization/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/12-text-summarization/code/main.ts

type Counter = Map<string, number>;

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

function counter(items: string[]): Counter {
  const c: Counter = new Map();
  for (const it of items) c.set(it, (c.get(it) ?? 0) + 1);
  return c;
}

function intersectionSize(a: Counter, b: Counter): number {
  let s = 0;
  for (const [k, v] of a) s += Math.min(v, b.get(k) ?? 0);
  return s;
}

function words(text: string): string[] {
  return text.split(/\s+/).filter((t) => t.length > 0);
}

function sentenceSplit(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function similarity(s1: string, s2: string): number {
  const w1 = counter(words(s1.toLowerCase()));
  const w2 = counter(words(s2.toLowerCase()));
  const intersection = intersectionSize(w1, w2);
  const denom = Math.log(w1.size + 1) + Math.log(w2.size + 1);
  if (denom === 0) return 0.0;
  return intersection / denom;
}

function textrank(text: string, topK = 3, damping = 0.85, iterations = 50, epsilon = 1e-4): string[] {
  const sentences = sentenceSplit(text);
  const n = sentences.length;
  if (n <= topK) return sentences;

  const sim = Array.from({ length: n }, () => new Array<number>(n).fill(0.0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) sim[i][j] = similarity(sentences[i], sentences[j]);
    }
  }

  let scores = new Array<number>(n).fill(1.0);
  for (let it = 0; it < iterations; it++) {
    const newScores = new Array<number>(n).fill(1 - damping);
    for (let i = 0; i < n; i++) {
      let rowSum = 0;
      for (const x of sim[i]) rowSum += x;
      const totalOut = rowSum || 1e-9;
      for (let j = 0; j < n; j++) {
        if (sim[i][j] > 0) newScores[j] += ((damping * sim[i][j]) / totalOut) * scores[i];
      }
    }
    let maxDelta = 0;
    for (let k = 0; k < n; k++) maxDelta = Math.max(maxDelta, Math.abs(scores[k] - newScores[k]));
    if (maxDelta < epsilon) {
      scores = newScores;
      break;
    }
    scores = newScores;
  }

  const ranked = [...Array(n).keys()].sort((a, b) => scores[b] - scores[a]).slice(0, topK);
  ranked.sort((a, b) => a - b);
  return ranked.map((i) => sentences[i]);
}

function rougeN(hyp: string, ref: string, n = 1): number {
  const ngrams = (tokens: string[], k: number): Counter => {
    const grams: string[] = [];
    for (let i = 0; i < tokens.length - k + 1; i++) grams.push(tokens.slice(i, i + k).join("\u0000"));
    return counter(grams);
  };

  const hypTokens = words(hyp.toLowerCase());
  const refTokens = words(ref.toLowerCase());
  const hypNgrams = ngrams(hypTokens, n);
  const refNgrams = ngrams(refTokens, n);
  if (refNgrams.size === 0) return 0.0;
  const overlap = intersectionSize(hypNgrams, refNgrams);
  let total = 0;
  for (const v of refNgrams.values()) total += v;
  return overlap / total;
}

function main(): void {
  const article =
    "Researchers at a Canadian university published a paper on efficient transformers. " +
    "The paper introduces a new attention variant that runs in linear time. " +
    "The authors trained models up to 1 billion parameters on public data. " +
    "Benchmarks show the new attention matches standard attention on most tasks. " +
    "The authors released training code and weights on GitHub. " +
    "Several research labs have already replicated the main results. " +
    "The paper has been accepted at NeurIPS.";
  const reference =
    "Researchers introduced a linear-time attention variant, trained up to 1B parameters, " +
    "matched standard attention on benchmarks, and released code and weights.";

  const summary = textrank(article, 3);
  const joined = summary.join(" ");
  console.log("=== TextRank summary ===");
  for (const s of summary) console.log(`  - ${s}`);
  console.log();

  console.log("=== ROUGE against reference ===");
  for (const n of [1, 2]) {
    const score = rougeN(joined, reference, n);
    console.log(`  ROUGE-${n}: ${pyFixed(score, 3)}`);
  }
  console.log();
  console.log("For production, use the `rouge-score` package with stemming for a proper F-measure.");
}

main();

export {};
