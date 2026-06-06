import type { Chunk, RankedChunk } from "./types.ts";

const TOKEN_RE = /[a-z0-9_]+/g;

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_RE) ?? [];
}

// Tiny deterministic 32-bit hash (FNV-1a) so embeddings are stable across runs.
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function fakeEmbed(text: string, dim = 64): number[] {
  const vec = new Array<number>(dim).fill(0);
  for (const tok of tokenize(text)) {
    const h = fnv1a(tok);
    vec[h % dim] += 1.0;
    vec[(h >>> 8) % dim] += 0.5;
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1.0;
  return vec.map((v) => v / norm);
}

export function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `cosine: vector length mismatch (${a.length} vs ${b.length})`,
    );
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export class DenseIndex {
  private vectors: { chunk: Chunk; vec: number[] }[] = [];

  add(chunk: Chunk): void {
    const text = `${chunk.symbol}\n${chunk.summary}\n${chunk.body}`;
    this.vectors.push({ chunk, vec: fakeEmbed(text) });
  }

  search(query: string, k = 10): RankedChunk[] {
    const qv = fakeEmbed(query);
    const scored = this.vectors.map((v) => ({
      chunk: v.chunk,
      score: cosine(qv, v.vec),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  size(): number {
    return this.vectors.length;
  }
}

export class BM25Index {
  k1 = 1.5;
  b = 0.75;
  private docs: Chunk[] = [];
  private docLens: number[] = [];
  private df = new Map<string, number>();
  private tf: Map<string, number>[] = [];
  private avgdl = 0;

  add(chunk: Chunk): void {
    const repeat = (toks: string[], times: number): string[] => {
      const out: string[] = [];
      for (let i = 0; i < times; i++) out.push(...toks);
      return out;
    };
    // Field-weighted tokenization: symbol x4, summary x2, body x1.
    const tokens = [
      ...repeat(tokenize(chunk.symbol), 4),
      ...repeat(tokenize(chunk.summary), 2),
      ...tokenize(chunk.body),
    ];
    const counts = new Map<string, number>();
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    this.docs.push(chunk);
    this.docLens.push(tokens.length);
    this.tf.push(counts);
    for (const term of counts.keys()) {
      this.df.set(term, (this.df.get(term) ?? 0) + 1);
    }
    this.avgdl = this.docLens.reduce((s, n) => s + n, 0) / this.docLens.length;
  }

  search(query: string, k = 10): RankedChunk[] {
    const qTerms = tokenize(query);
    const n = this.docs.length;
    const scores = new Array<number>(n).fill(0);
    for (const term of qTerms) {
      const df = this.df.get(term);
      if (!df) continue;
      const idf = Math.log((n - df + 0.5) / (df + 0.5) + 1.0);
      for (let i = 0; i < n; i++) {
        const f = this.tf[i].get(term) ?? 0;
        if (!f) continue;
        const dl = this.docLens[i];
        const denom = f + this.k1 * (1 - this.b + (this.b * dl) / this.avgdl);
        scores[i] += (idf * f * (this.k1 + 1)) / denom;
      }
    }
    const ranked = this.docs
      .map((chunk, i) => ({ chunk, score: scores[i] }))
      .filter((r) => r.score > 0);
    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, k);
  }

  size(): number {
    return this.docs.length;
  }
}
