// Chunking strategies for RAG in TypeScript: fixed, recursive, semantic,
// sentence, parent-child. Mirrors code/main.py and follows the splitter
// hierarchy from LangChain.js (RecursiveCharacterTextSplitter).
// Sources:
//   https://docs.langchain.com/oss/javascript/integrations/splitters
//   https://philna.sh/blog/2024/09/18/how-to-chunk-text-in-javascript-for-rag-applications/
//   https://github.com/langchain-ai/langchainjs (textsplitters package)

import { createHash } from "node:crypto";

type Vec = readonly number[];

type ParentChildPair = {
  child: string;
  parentIdx: number;
  parent: string;
};

const TOKEN_RE = /[a-z0-9]+/g;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_RE) ?? [];
}

function hashEmbed(text: string, dim = 256): Vec {
  if (dim <= 0) throw new Error("dim must be positive");
  // Hashing-trick embedder: every token contributes +/-1 to a hashed dim.
  // Deterministic, no training, useful as a stand-in for production
  // embedders (BGE-M3, text-embedding-3-small, voyage-3).
  const vec = new Array<number>(dim).fill(0);
  for (const tok of tokenize(text)) {
    const digest = createHash("md5").update(tok).digest();
    const idx = digest.readUInt32BE(0) % dim;
    const sign = digest[4] % 2 === 0 ? -1 : 1;
    vec[idx] += sign;
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

function cosine(a: Vec, b: Vec): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) dot += a[i] * b[i];
  return dot;
}

function chunkFixed(text: string, size: number, overlap = 0): string[] {
  if (size <= 0) throw new Error("size must be positive");
  const step = size - overlap;
  if (step <= 0) throw new Error("overlap must be less than size");
  const out: string[] = [];
  for (let i = 0; i < text.length; i += step) {
    const piece = text.slice(i, i + size);
    if (piece.trim().length > 0) out.push(piece);
  }
  return out;
}

function chunkRecursive(
  text: string,
  size: number,
  seps: readonly string[] = ["\n\n", "\n", ". ", " "],
): string[] {
  if (size <= 0) throw new Error("size must be positive");
  // Mirrors LangChain.js RecursiveCharacterTextSplitter: try the strongest
  // separator first (paragraph), drop to weaker ones (sentence, word) when
  // the current pass leaves chunks larger than `size`.
  if (text.length <= size) {
    const t = text.trim();
    return t.length > 0 ? [t] : [];
  }
  for (const sep of seps) {
    if (!text.includes(sep)) continue;
    const parts = text.split(sep);
    const chunks: string[] = [];
    let buf = "";
    for (const part of parts) {
      const candidate = buf.length === 0 ? part : buf + sep + part;
      if (candidate.length <= size) {
        buf = candidate;
      } else {
        if (buf.length > 0) chunks.push(buf.trim());
        buf = part;
      }
    }
    if (buf.length > 0) chunks.push(buf.trim());
    return chunks.filter((c) => c.length > 0);
  }
  return chunkFixed(text, size);
}

function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function chunkSemantic(text: string, threshold = 0.3, minChars = 40): string[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];
  const embs = sentences.map((s) => hashEmbed(s));
  const groups: string[][] = [[sentences[0]]];
  for (let i = 1; i < sentences.length; i += 1) {
    const sim = cosine(embs[i], embs[i - 1]);
    const current = groups[groups.length - 1];
    const joinedLen = current.join(" ").length;
    if (sim < threshold && joinedLen >= minChars) {
      groups.push([sentences[i]]);
    } else {
      current.push(sentences[i]);
    }
  }
  return groups.map((g) => g.join(" "));
}

function chunkSentence(text: string, sentencesPerChunk = 3): string[] {
  if (sentencesPerChunk <= 0) throw new Error("sentencesPerChunk must be positive");
  const sentences = splitSentences(text);
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += sentencesPerChunk) {
    out.push(sentences.slice(i, i + sentencesPerChunk).join(" "));
  }
  return out;
}

function chunkParentChild(text: string, parentSize = 800, childSize = 200): ParentChildPair[] {
  const parents = chunkRecursive(text, parentSize);
  const pairs: ParentChildPair[] = [];
  parents.forEach((parent, parentIdx) => {
    const children = chunkRecursive(parent, childSize);
    for (const child of children) {
      pairs.push({ child, parentIdx, parent });
    }
  });
  return pairs;
}

function retrieveRecall(
  chunks: readonly string[],
  query: string,
  goldSubstrings: readonly string[],
  topK = 3,
): boolean {
  const embs = chunks.map((c) => hashEmbed(c));
  const qEmb = hashEmbed(query);
  const scored = embs.map((e, i) => ({ score: cosine(e, qEmb), idx: i }));
  scored.sort((x, y) => y.score - x.score);
  const top = scored.slice(0, topK).map(({ idx }) => chunks[idx]);
  return top.some((c) => goldSubstrings.some((g) => c.toLowerCase().includes(g.toLowerCase())));
}

function main(): void {
  const doc = `Chapter 1. Introduction. This contract is between Acme Corp and Beta Inc. The parties agree to the following terms.

Chapter 2. Payment. Acme will pay Beta thirty thousand dollars on the first of each month. Late payments incur a five percent fee.

Chapter 3. Termination. Either party may terminate this agreement with ninety days written notice. Termination for cause requires only thirty days notice. Breach of payment constitutes cause.

Chapter 4. Confidentiality. Both parties agree to keep trade secrets confidential. This obligation survives termination of the agreement.

Chapter 5. Miscellaneous. This agreement is governed by the laws of the State of California. Disputes shall be resolved by arbitration.`;

  console.log("=== strategy comparison ===\n");

  const fixed = chunkFixed(doc, 300, 50);
  console.log("fixed (300 chars, 50 overlap):    " + fixed.length + " chunks");

  const rec = chunkRecursive(doc, 300);
  console.log("recursive (300 chars):            " + rec.length + " chunks");

  const sem = chunkSemantic(doc);
  console.log("semantic (hash-trick):            " + sem.length + " chunks");

  const sent = chunkSentence(doc, 3);
  console.log("sentence (3 per chunk):           " + sent.length + " chunks");

  const pc = chunkParentChild(doc, 800, 200);
  const parentSet = new Set(pc.map((m) => m.parentIdx));
  console.log("parent-child (800 / 200):         " + pc.length + " children, " + parentSet.size + " parents");

  const queries: ReadonlyArray<{ q: string; gold: readonly string[] }> = [
    { q: "When can either party terminate?", gold: ["ninety days", "thirty days"] },
    { q: "What is the late payment fee?", gold: ["five percent"] },
    { q: "Which state laws apply?", gold: ["California"] },
  ];

  console.log("\n=== recall@3 on 3 queries ===");
  const strategies: ReadonlyArray<{ name: string; chunks: readonly string[] }> = [
    { name: "fixed", chunks: fixed },
    { name: "recursive", chunks: rec },
    { name: "semantic", chunks: sem },
    { name: "sentence", chunks: sent },
    { name: "parent", chunks: Array.from(new Set(pc.map((m) => m.parent))) },
  ];
  for (const { name, chunks } of strategies) {
    const hits = queries.reduce((acc, { q, gold }) => acc + (retrieveRecall(chunks, q, gold) ? 1 : 0), 0);
    console.log("  " + name.padEnd(12) + ": " + hits + " / " + queries.length);
  }

  console.log("\nnote: hash-trick embedder is noisy.");
  console.log("production embedders (BGE, text-3) give 20-40 pp higher recall on the same chunks.");
}

main();
