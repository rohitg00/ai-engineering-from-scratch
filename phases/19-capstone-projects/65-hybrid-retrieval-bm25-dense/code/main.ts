// Lesson: Hybrid Retrieval with BM25 and Dense Embeddings (phase 19 / lesson 65)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense/docs/en.md
// Run: npx tsx phases/19-capstone-projects/65-hybrid-retrieval-bm25-dense/code/main.ts

export class Doc {
  constructor(
    public docId: string,
    public title: string,
    public body: string,
  ) {}

  fieldText(fieldName: string): string {
    if (fieldName === "title") {
      return this.title;
    }
    if (fieldName === "body") {
      return this.body;
    }
    return "";
  }
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export type Hit = [Doc, number];

export class BM25Index {
  k1 = 1.5;
  b = 0.75;
  fieldWeights: [string, number][] = [
    ["title", 3],
    ["body", 1],
  ];
  docs: Doc[] = [];
  docLens: number[] = [];
  df = new Map<string, number>();
  tf: Map<string, number>[] = [];
  avgdl = 0.0;

  private docTokens(doc: Doc): string[] {
    const out: string[] = [];
    for (const [fieldName, weight] of this.fieldWeights) {
      const tokens = tokenize(doc.fieldText(fieldName));
      for (let r = 0; r < weight; r++) {
        out.push(...tokens);
      }
    }
    return out;
  }

  add(doc: Doc): void {
    const tokens = this.docTokens(doc);
    const counts = new Map<string, number>();
    for (const t of tokens) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    this.docs.push(doc);
    this.docLens.push(tokens.length);
    this.tf.push(counts);
    for (const term of counts.keys()) {
      this.df.set(term, (this.df.get(term) ?? 0) + 1);
    }
    this.avgdl = this.docLens.reduce((a, x) => a + x, 0) / Math.max(1, this.docLens.length);
  }

  search(query: string, k = 10): Hit[] {
    if (this.docs.length === 0) {
      return [];
    }
    const qTerms = tokenize(query);
    const n = this.docs.length;
    const scores = new Array<number>(n).fill(0.0);
    for (const term of qTerms) {
      const df = this.df.get(term) ?? 0;
      if (df === 0) {
        continue;
      }
      const idf = Math.log((n - df + 0.5) / (df + 0.5) + 1.0);
      this.tf.forEach((counts, i) => {
        const f = counts.get(term) ?? 0;
        if (f === 0) {
          return;
        }
        const dl = this.docLens[i];
        const denom = f + this.k1 * (1 - this.b + (this.b * dl) / (this.avgdl || 1));
        scores[i] += (idf * f * (this.k1 + 1)) / denom;
      });
    }
    const ranked: Hit[] = this.docs.map((d, i) => [d, scores[i]]);
    ranked.sort((a, b) => b[1] - a[1]);
    return ranked.slice(0, k).filter(([, s]) => s > 0);
  }
}

export function mockEmbed(text: string, dim = 96): number[] {
  const vec = new Array<number>(dim).fill(0);
  for (const tok of tokenize(text)) {
    let h = 0;
    for (const ch of tok) {
      h = (Math.imul(h, 1315423911) ^ ch.charCodeAt(0)) >>> 0;
    }
    vec[h % dim] += 1.0;
    vec[(h >>> 7) % dim] += 0.5;
    for (let i = 0; i < tok.length - 1; i++) {
      const bg = (tok.charCodeAt(i) * 31 + tok.charCodeAt(i + 1)) >>> 0;
      vec[bg % dim] += 0.25;
    }
  }
  let sq = 0;
  for (const v of vec) {
    sq += v * v;
  }
  const norm = Math.sqrt(sq) || 1.0;
  return vec.map((v) => v / norm);
}

export function cosine(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    s += a[i] * b[i];
  }
  return s;
}

export class DenseIndex {
  vectors: [Doc, number[]][] = [];

  add(doc: Doc): void {
    const text = `${doc.title}\n${doc.body}`;
    this.vectors.push([doc, mockEmbed(text)]);
  }

  search(query: string, k = 10): Hit[] {
    const qv = mockEmbed(query);
    const scored: Hit[] = this.vectors.map(([d, v]) => [d, cosine(qv, v)]);
    scored.sort((a, b) => b[1] - a[1]);
    return scored.slice(0, k);
  }
}

export function rrf(rankings: Hit[][], k = 60, weights: number[] | null = null): Hit[] {
  const ws = weights ?? rankings.map(() => 1.0);
  if (ws.length !== rankings.length) {
    throw new Error("weights length must match rankings length");
  }
  const score = new Map<string, number>();
  const byId = new Map<string, Doc>();
  ws.forEach((w, ri) => {
    rankings[ri].forEach(([doc], rank) => {
      score.set(doc.docId, (score.get(doc.docId) ?? 0.0) + w * (1.0 / (k + rank + 1)));
      byId.set(doc.docId, doc);
    });
  });
  const fused = [...score.entries()].sort((a, b) => b[1] - a[1]);
  return fused.map(([did, s]) => [byId.get(did) as Doc, s]);
}

export class HybridRetriever {
  bm25 = new BM25Index();
  dense = new DenseIndex();
  rrfK = 60;
  bm25Weight = 1.0;
  denseWeight = 1.0;

  add(doc: Doc): void {
    this.bm25.add(doc);
    this.dense.add(doc);
  }

  search(query: string, kEach = 10, kOut = 5): { bm25: Hit[]; dense: Hit[]; fused: Hit[] } {
    const bm25Hits = this.bm25.search(query, kEach);
    const denseHits = this.dense.search(query, kEach);
    const fused = rrf([bm25Hits, denseHits], this.rrfK, [this.bm25Weight, this.denseWeight]);
    return {
      bm25: bm25Hits,
      dense: denseHits,
      fused: fused.slice(0, kOut),
    };
  }
}

export const CORPUS: Doc[] = [
  new Doc(
    "d1",
    "AbortMultipartOnFail",
    "Aborts an in-flight S3 multipart upload and decrements the per-bucket retry budget when " +
      "the upload fails. Wired into the central retry budget configuration.",
  ),
  new Doc(
    "d2",
    "Uploading large files",
    "When you upload a large file the storage service splits it into parts. The client must " +
      "track each part. If the network drops the partial upload can be resumed or cancelled " +
      "depending on the resume window. Cancelled uploads do not block subsequent attempts.",
  ),
  new Doc(
    "d3",
    "Per-bucket budgets",
    "Each storage bucket carries a retry budget that limits how often a failed operation can " +
      "be retried within a window. Budget exhaustion triggers a cooldown period.",
  ),
  new Doc(
    "d4",
    "check_permission",
    "Authorization is centralized in the check_permission function which evaluates a policy " +
      "against the principal, the resource, and the action. Both human users and service " +
      "accounts pass through the same function.",
  ),
  new Doc(
    "d5",
    "Policy engine",
    "The policy engine wraps an Open Policy Agent runtime and exposes evaluate. Cached for " +
      "a configured TTL to amortize repeated lookups.",
  ),
  new Doc(
    "d6",
    "Search ranking",
    "Production search engines combine lexical and semantic retrieval through a rank fusion " +
      "step. The fusion is rank-based, not score-based, so the two modalities can be combined " +
      "without per-corpus calibration.",
  ),
  new Doc(
    "d7",
    "Index sizing",
    "The vector index sits in memory. Plan for 1 KB per vector at 256 dimensions in float32 " +
      "and add a small overhead for the graph structure.",
  ),
];

export function printRanking(label: string, hits: Iterable<Hit>, top = 5): void {
  console.log(`  ${label}:`);
  [...hits].slice(0, top).forEach(([doc, score], i) => {
    console.log(`    ${i + 1}. ${doc.docId} (${doc.title})  score=${score.toFixed(4)}`);
  });
}

function main(): void {
  const retriever = new HybridRetriever();
  for (const d of CORPUS) {
    retriever.add(d);
  }

  const queries: [string, string][] = [
    ["AbortMultipartOnFail", "literal symbol; BM25 wins easily, dense should still rank d1 high through hashed tokens"],
    ["how do we handle cancelled uploads", "paraphrased; dense should find the upload doc; BM25 less directly"],
    ["centralized authorization for service accounts", "mixed; both modalities should agree on the auth doc"],
  ];

  for (const [q, note] of queries) {
    console.log(`\nquery: ${q}\nnote:  ${note}`);
    const result = retriever.search(q, 5, 5);
    printRanking("bm25 ", result.bm25);
    printRanking("dense", result.dense);
    printRanking("fused", result.fused);
  }
}

main();
