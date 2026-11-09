// Lesson: Embedding Models: The 2026 Deep Dive (phase 05 / lesson 22)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/22-embedding-models-deep-dive/code/main.ts

import { createHash } from "node:crypto";

type Scored = [number, number];

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

function sortTuplesDesc(scored: Scored[]): void {
  scored.sort((a, b) => (a[0] !== b[0] ? b[0] - a[0] : b[1] - a[1]));
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function hashToken(token: string, dim: number, seed = 0): number {
  const h = createHash("md5").update(`${seed}:${token}`, "utf8").digest();
  return h.readUInt32BE(0) % dim;
}

function hashEmbed(text: string, dim = 256): number[] {
  const vec = new Array<number>(dim).fill(0.0);
  for (const tok of tokenize(text)) {
    const idx = hashToken(tok, dim);
    const sign = hashToken(tok, 2, 1) === 1 ? 1.0 : -1.0;
    vec[idx] += sign;
  }
  let s = 0;
  for (const v of vec) s += v * v;
  const norm = Math.sqrt(s);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`cosine: dim mismatch ${a.length} vs ${b.length}`);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function truncateMatryoshka(vec: number[], newDim: number): number[] {
  const out = vec.slice(0, newDim);
  let s = 0;
  for (const v of out) s += v * v;
  const norm = Math.sqrt(s);
  if (norm === 0) return out;
  return out.map((v) => v / norm);
}

function rank(corpusEmbs: number[][], queryEmb: number[]): Scored[] {
  const scored = corpusEmbs.map((e, i): Scored => [cosine(e, queryEmb), i]);
  sortTuplesDesc(scored);
  return scored;
}

function sparseEmbed(text: string): Map<string, number> {
  const c = new Map<string, number>();
  for (const t of tokenize(text)) c.set(t, (c.get(t) ?? 0) + 1);
  return c;
}

function sparseScore(qSparse: Map<string, number>, dSparse: Map<string, number>): number {
  let total = 0.0;
  for (const [tok, qWeight] of qSparse) total += qWeight * (dSparse.get(tok) ?? 0);
  return total;
}

function rrfFuse(rankings: Scored[][], k = 60): [number, number][] {
  const scores = new Map<number, number>();
  for (const ranking of rankings) {
    ranking.forEach(([, idx], r) => {
      scores.set(idx, (scores.get(idx) ?? 0.0) + 1.0 / (k + r + 1));
    });
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]);
}

function main(): void {
  const corpus = [
    "Apple released the first iPhone on June 29, 2007.",
    "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
    "Android launched in 2008 as Google's mobile operating system.",
    "The first iPod was released by Apple in 2001.",
    "Fraud refers to wrongful or criminal deception for financial gain.",
    "Section 420 of the Indian Penal Code covers cheating.",
  ];

  const query = "When was the first iPhone released?";

  console.log("=== dense (hash-trick) retrieval ===");
  const denseCorpus = corpus.map((doc) => hashEmbed(doc, 256));
  const denseQuery = hashEmbed(query, 256);
  const denseRanked = rank(denseCorpus, denseQuery);
  for (const [score, idx] of denseRanked.slice(0, 3)) console.log(`  ${pyFixed(score, 3)}  ${corpus[idx]}`);

  console.log();
  console.log("=== Matryoshka truncation: 256 -> 64 ===");
  const matryoshkaCorpus = denseCorpus.map((v) => truncateMatryoshka(v, 64));
  const matryoshkaQuery = truncateMatryoshka(denseQuery, 64);
  const matryoshkaRanked = rank(matryoshkaCorpus, matryoshkaQuery);
  for (const [score, idx] of matryoshkaRanked.slice(0, 3)) console.log(`  ${pyFixed(score, 3)}  ${corpus[idx]}`);

  console.log();
  console.log("=== sparse (lexical) retrieval ===");
  const sparseCorpus = corpus.map(sparseEmbed);
  const sparseQuery = sparseEmbed(query);
  const sparseScores = sparseCorpus.map((d, i): Scored => [sparseScore(sparseQuery, d), i]);
  sortTuplesDesc(sparseScores);
  for (const [score, idx] of sparseScores.slice(0, 3)) console.log(`  ${pyFixed(score, 3)}  ${corpus[idx]}`);

  console.log();
  console.log("=== RRF fusion (dense + sparse) ===");
  const fused = rrfFuse([denseRanked.slice(0, 5), sparseScores.slice(0, 5)]).slice(0, 3);
  for (const [idx, score] of fused) console.log(`  ${pyFixed(score, 4)}  ${corpus[idx]}`);

  console.log();
  console.log("note: the hash-trick embedder is for demonstration.");
  console.log("real dense embeddings come from transformers (BGE, Nomic, Voyage).");
  console.log("Matryoshka truncation, cosine ranking, and RRF fusion all stay identical.");
}

main();
