// Lesson: Capstone 02: RAG over Codebase (Cross-Repo Semantic Search) (phase 19 / lesson 02)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/02-rag-over-codebase/docs/en.md
// Run: npx tsx phases/19-capstone-projects/02-rag-over-codebase/code/main.ts

import { createHash } from "node:crypto";

class Chunk {
  constructor(
    public repo: string,
    public path: string,
    public start_line: number,
    public end_line: number,
    public symbol: string,
    public body: string,
    public summary: string = "",
  ) {}

  anchor(): string {
    return `${this.repo}/${this.path}:${this.start_line}-${this.end_line}`;
  }
}

const SAMPLE_CORPUS: Chunk[] = [
  new Chunk("uploader", "services/retry.go", 122, 148, "AbortMultipartOnFail",
    "if ctx.Err() != nil { return abort() }; decrement bucket budget; retry with backoff",
    "aborts an in-flight S3 multipart upload and decrements the per-bucket retry budget"),
  new Chunk("uploader", "config/budgets.yaml", 34, 51, "bucket_budget",
    "per_bucket_budget: 64; backoff_ms: [100, 500, 2500]; abort_threshold: 3",
    "declares the retry budget and exponential backoff schedule per S3 bucket"),
  new Chunk("client", "libs/s3client/multipart.ts", 44, 61, "abortUpload",
    "await s3.abortMultipartUpload({Bucket, Key, UploadId}); metrics.inc('s3.abort')",
    "client-side S3 multipart abort with metrics instrumentation"),
  new Chunk("auth", "services/authz/check.py", 12, 38, "check_permission",
    "def check_permission(user, resource, action): return policy.evaluate(user, resource, action)",
    "central authorization gateway evaluating an OPA policy for user-resource-action"),
  new Chunk("auth", "libs/policy/opa.py", 88, 110, "evaluate",
    "def evaluate(user, resource, action): return self.engine.query('authz', input=...)",
    "OPA policy engine query wrapper for authorization checks"),
  new Chunk("catalog", "services/search/query.rs", 200, 240, "rank_fusion",
    "pub fn rank_fusion(dense: Vec<Hit>, sparse: Vec<Hit>) -> Vec<Hit>",
    "reciprocal rank fusion of dense and sparse retrieval results"),
];

type Hit = [Chunk, number];

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\w+/g) ?? [];
}

function fakeEmbed(text: string, dim: number = 64): number[] {
  const vec = new Array<number>(dim).fill(0);
  for (const tok of tokenize(text)) {
    const h = createHash("md5").update(tok, "utf8").digest().readUInt32BE(0);
    vec[h % dim] += 1.0;
    vec[(h >>> 8) % dim] += 0.5;
  }
  let sq = 0;
  for (const v of vec) sq += v * v;
  const norm = Math.sqrt(sq) || 1.0;
  return vec.map((v) => v / norm);
}

function cosine(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i] * b[i];
  return s;
}

class DenseIndex {
  vectors: [Chunk, number[]][] = [];

  add(chunk: Chunk): void {
    const text = `${chunk.symbol}\n${chunk.summary}\n${chunk.body}`;
    this.vectors.push([chunk, fakeEmbed(text)]);
  }

  search(query: string, k: number = 10): Hit[] {
    const qv = fakeEmbed(query);
    const scored: Hit[] = this.vectors.map(([c, v]) => [c, cosine(qv, v)]);
    scored.sort((x, y) => y[1] - x[1]);
    return scored.slice(0, k);
  }
}

class BM25Index {
  k1 = 1.5;
  b = 0.75;
  docs: Chunk[] = [];
  doc_lens: number[] = [];
  df = new Map<string, number>();
  tf: Map<string, number>[] = [];
  avgdl = 0.0;

  add(chunk: Chunk): void {
    const rep = (xs: string[], n: number): string[] => Array.from({ length: n }, () => xs).flat();
    const tokens = [...rep(tokenize(chunk.symbol), 4), ...rep(tokenize(chunk.summary), 2), ...tokenize(chunk.body)];
    const counts = new Map<string, number>();
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    this.docs.push(chunk);
    this.doc_lens.push(tokens.length);
    this.tf.push(counts);
    for (const term of counts.keys()) this.df.set(term, (this.df.get(term) ?? 0) + 1);
    this.avgdl = this.doc_lens.reduce((a, x) => a + x, 0) / this.doc_lens.length;
  }

  search(query: string, k: number = 10): Hit[] {
    const qTerms = tokenize(query);
    const n = this.docs.length;
    const scores = new Array<number>(n).fill(0);
    for (const term of qTerms) {
      const dfv = this.df.get(term);
      if (dfv === undefined) continue;
      const idf = Math.log((n - dfv + 0.5) / (dfv + 0.5) + 1.0);
      this.tf.forEach((counts, i) => {
        const f = counts.get(term);
        if (f === undefined) return;
        const dl = this.doc_lens[i];
        const denom = f + this.k1 * (1 - this.b + (this.b * dl) / this.avgdl);
        scores[i] += (idf * f * (this.k1 + 1)) / denom;
      });
    }
    const ranked: Hit[] = this.docs.map((c, i) => [c, scores[i]]);
    ranked.sort((x, y) => y[1] - x[1]);
    return ranked.slice(0, k).filter(([, s]) => s > 0);
  }
}

function rrf(dense: Hit[], sparse: Hit[], kRrf: number = 60): Hit[] {
  const score = new Map<string, number>();
  const byAnchor = new Map<string, Chunk>();
  for (const list of [dense, sparse]) {
    list.forEach(([c], rank) => {
      score.set(c.anchor(), (score.get(c.anchor()) ?? 0) + 1.0 / (kRrf + rank + 1));
      byAnchor.set(c.anchor(), c);
    });
  }
  const fused = [...score.entries()].sort((x, y) => y[1] - x[1]);
  return fused.map(([a, s]) => [byAnchor.get(a) as Chunk, s]);
}

function rerank(query: string, candidates: Hit[], topK: number = 5): Hit[] {
  const qToks = new Set(tokenize(query));
  const overlap = (xs: string[]): number => [...new Set(xs)].filter((t) => qToks.has(t)).length;
  const out: Hit[] = [];
  for (const [c, prior] of candidates) {
    const symbolOverlap = overlap(tokenize(c.symbol)) * 3;
    const summaryOverlap = overlap(tokenize(c.summary));
    out.push([c, prior + 0.3 * symbolOverlap + 0.1 * summaryOverlap]);
  }
  out.sort((x, y) => y[1] - x[1]);
  return out.slice(0, topK);
}

interface Answer {
  query: string;
  dense_top: string[];
  sparse_top: string[];
  fused_top: string[];
  rerank_top: string[];
}

function answer(query: string, dense: DenseIndex, bm25: BM25Index): Answer {
  const denseHits = dense.search(query, 10);
  const sparseHits = bm25.search(query, 10);
  const fused = rrf(denseHits, sparseHits);
  const top = rerank(query, fused, 5);
  const citations = top.map(([c]) => c.anchor());
  return {
    query,
    dense_top: denseHits.slice(0, 3).map(([c]) => c.anchor()),
    sparse_top: sparseHits.slice(0, 3).map(([c]) => c.anchor()),
    fused_top: fused.slice(0, 5).map(([c]) => c.anchor()),
    rerank_top: citations,
  };
}

function pyList(xs: string[]): string {
  return "[" + xs.map((x) => `'${x}'`).join(", ") + "]";
}

function main(): void {
  const dense = new DenseIndex();
  const bm25 = new BM25Index();
  for (const ch of SAMPLE_CORPUS) {
    dense.add(ch);
    bm25.add(ch);
  }

  for (const q of ["how is S3 multipart abort wired into retry budget", "where is authorization centralized", "how does rank fusion work"]) {
    const result = answer(q, dense, bm25);
    console.log(`Q: ${result.query}`);
    console.log(`  dense  : ${pyList(result.dense_top)}`);
    console.log(`  sparse : ${pyList(result.sparse_top)}`);
    console.log(`  fused  : ${pyList(result.fused_top)}`);
    console.log(`  rerank : ${pyList(result.rerank_top)}`);
    console.log();
  }
}

main();
