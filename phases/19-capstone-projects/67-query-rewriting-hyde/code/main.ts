// Lesson: Query Rewriting: HyDE, Multi-Query, and Decomposition (phase 19 / lesson 67)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/67-query-rewriting-hyde/docs/en.md
// Run: npx tsx phases/19-capstone-projects/67-query-rewriting-hyde/code/main.ts

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
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

export class Doc {
  constructor(
    public docId: string,
    public title: string,
    public body: string,
  ) {}

  fieldText(): string {
    return `${this.title}\n${this.body}`;
  }
}

export type Hit = [Doc, number];

export class BM25Index {
  k1 = 1.5;
  b = 0.75;
  docs: Doc[] = [];
  docLens: number[] = [];
  df = new Map<string, number>();
  tf: Map<string, number>[] = [];
  avgdl = 0.0;

  add(doc: Doc): void {
    const title = tokenize(doc.title);
    const toks = [...title, ...title, ...title, ...tokenize(doc.body)];
    const counts = new Map<string, number>();
    for (const t of toks) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    this.docs.push(doc);
    this.docLens.push(toks.length);
    this.tf.push(counts);
    for (const term of counts.keys()) {
      this.df.set(term, (this.df.get(term) ?? 0) + 1);
    }
    this.avgdl = this.docLens.reduce((a, x) => a + x, 0) / Math.max(1, this.docLens.length);
  }

  search(query: string, k: number): Hit[] {
    const qTerms = tokenize(query);
    const n = this.docs.length;
    if (n === 0) {
      return [];
    }
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
    return ranked.slice(0, k);
  }
}

export class DenseIndex {
  vectors: [Doc, number[]][] = [];

  add(doc: Doc): void {
    this.vectors.push([doc, mockEmbed(doc.fieldText())]);
  }

  searchVec(qv: number[], k: number): Hit[] {
    const scored: Hit[] = this.vectors.map(([d, v]) => [d, cosine(qv, v)]);
    scored.sort((a, b) => b[1] - a[1]);
    return scored.slice(0, k);
  }

  search(query: string, k: number): Hit[] {
    return this.searchVec(mockEmbed(query), k);
  }
}

export function rrf(rankings: Hit[][], k = 60): Hit[] {
  const score = new Map<string, number>();
  const byId = new Map<string, Doc>();
  for (const ranks of rankings) {
    ranks.forEach(([doc], rank) => {
      score.set(doc.docId, (score.get(doc.docId) ?? 0.0) + 1.0 / (k + rank + 1));
      byId.set(doc.docId, doc);
    });
  }
  const fused = [...score.entries()].sort((a, b) => b[1] - a[1]);
  return fused.map(([did, s]) => [byId.get(did) as Doc, s]);
}

export class HybridRetriever {
  bm25 = new BM25Index();
  dense = new DenseIndex();

  add(doc: Doc): void {
    this.bm25.add(doc);
    this.dense.add(doc);
  }

  search(query: string, kEach = 5, kOut = 5): Hit[] {
    const b = this.bm25.search(query, kEach);
    const d = this.dense.search(query, kEach);
    return rrf([b, d]).slice(0, kOut);
  }

  searchVec(qv: number[], qtext: string, kEach = 5, kOut = 5): Hit[] {
    const b = this.bm25.search(qtext, kEach);
    const d = this.dense.searchVec(qv, kEach);
    return rrf([b, d]).slice(0, kOut);
  }
}

const SYNONYMS: Record<string, string[]> = {
  abort: ["cancel", "stop", "terminate"],
  cancel: ["abort", "stop"],
  upload: ["transfer", "ingest"],
  fail: ["error", "failure"],
  budget: ["quota", "limit"],
  retry: ["attempt", "resend"],
  permission: ["authorization", "authz"],
  service: ["worker"],
  policy: ["rule"],
  rank: ["score", "ordering"],
  fusion: ["merge", "combine"],
};

function synonymsOf(t: string): string[] {
  return Object.prototype.hasOwnProperty.call(SYNONYMS, t) ? SYNONYMS[t] : [];
}

export const HYDE_TABLE = new Map<string, string>([
  [
    "what do we do when a transfer breaks halfway",
    "AbortMultipartOnFail terminates an S3 multipart transfer and decrements the per-bucket " +
      "retry quota when the transfer fails. The bucket then enters a cooldown window.",
  ],
  [
    "how is access control handled across user types",
    "Authorization is centralized in check_permission which evaluates a policy against " +
      "principal, resource, and action. The same function applies to user accounts and to " +
      "service accounts equally.",
  ],
  [
    "how does the search service merge two retrievers",
    "The search service merges lexical and semantic retrievers through reciprocal rank " +
      "fusion. Rank fusion is the production technique for combining two ranked lists; the " +
      "fusion operates on ranks, not on scores, so calibration is not required.",
  ],
]);

export const MQ_TABLE = new Map<string, string[]>([
  [
    "what do we do when a transfer breaks halfway",
    [
      "how do multipart uploads behave on failure",
      "what action does the storage service take when a multipart upload fails",
      "how is an in-flight multipart upload aborted on persistent failure",
    ],
  ],
  [
    "how is access control handled across user types",
    [
      "how does the system perform authorization checks",
      "where is the central permission check implemented",
      "how are service accounts authorized for storage operations",
    ],
  ],
  [
    "how does the search service merge two retrievers",
    [
      "how is lexical and semantic retrieval combined",
      "what algorithm fuses BM25 and dense rankings",
      "how does rank fusion work in production search",
    ],
  ],
]);

export const DECOMP_TABLE = new Map<string, string[]>([
  [
    "what happens when an upload fails and the retry budget is exhausted",
    ["how is an in-flight multipart upload aborted", "what happens when the retry quota reaches zero"],
  ],
  [
    "how is authorization handled and how do policies get evaluated",
    ["how is authorization performed", "how are policies evaluated"],
  ],
]);

function normKey(query: string): string {
  return query.toLowerCase().trim().replace(/\?+$/, "").trim();
}

export class MockLLM {
  generateHypothetical(query: string): string {
    const key = normKey(query);
    const hit = HYDE_TABLE.get(key);
    if (hit !== undefined) {
      return hit;
    }
    const toks = tokenize(query);
    const expanded: string[] = [];
    for (const t of toks) {
      expanded.push(t);
      expanded.push(...synonymsOf(t));
    }
    return expanded.join(" ");
  }

  paraphrase(query: string, n = 3): string[] {
    const key = normKey(query);
    const hit = MQ_TABLE.get(key);
    if (hit !== undefined) {
      return hit.slice(0, n);
    }
    const toks = tokenize(query);
    const out: string[] = [];
    for (let shift = 0; shift < n; shift++) {
      const swapped: string[] = [];
      toks.forEach((t, i) => {
        const opts = synonymsOf(t);
        if (opts.length > 0 && (i + shift) % 2 === 0) {
          swapped.push(opts[shift % opts.length]);
        } else {
          swapped.push(t);
        }
      });
      out.push(swapped.join(" "));
    }
    return out;
  }

  decompose(query: string): string[] {
    const key = normKey(query);
    const hit = DECOMP_TABLE.get(key);
    if (hit !== undefined) {
      return hit;
    }
    if (query.toLowerCase().includes(" and ")) {
      const parts = query.split(/\s+and\s+/i);
      return parts.filter((p) => p.trim()).map((p) => p.trim().replace(/\?+$/, ""));
    }
    return [query];
  }
}

export class RewriteResult {
  constructor(
    public strategy: string,
    public rewrites: string[],
    public hypothetical: string | null = null,
  ) {}
}

export abstract class Rewriter {
  abstract name: string;

  abstract rewrite(query: string): RewriteResult;
}

export class HyDERewriter extends Rewriter {
  name = "hyde";

  constructor(public llm: MockLLM = new MockLLM()) {
    super();
  }

  rewrite(query: string): RewriteResult {
    const h = this.llm.generateHypothetical(query);
    return new RewriteResult(this.name, [query], h);
  }
}

export class MultiQueryRewriter extends Rewriter {
  name = "multiquery";

  constructor(
    public llm: MockLLM = new MockLLM(),
    public n = 3,
  ) {
    super();
  }

  rewrite(query: string): RewriteResult {
    const rewrites = [query, ...this.llm.paraphrase(query, this.n)];
    return new RewriteResult(this.name, rewrites);
  }
}

export class DecomposeRewriter extends Rewriter {
  name = "decompose";

  constructor(public llm: MockLLM = new MockLLM()) {
    super();
  }

  rewrite(query: string): RewriteResult {
    const subs = this.llm.decompose(query);
    return new RewriteResult(this.name, subs);
  }
}

export interface RetrieveOutput {
  rewriter: string;
  rewrites: string[];
  hypothetical: string | null;
  results: Hit[];
}

export function retrieveWithRewriter(
  query: string,
  rewriter: Rewriter,
  retriever: HybridRetriever,
  kEach = 5,
  kOut = 5,
): RetrieveOutput {
  const rw = rewriter.rewrite(query);
  const rankings: Hit[][] = [];
  if (rw.hypothetical !== null) {
    const hv = mockEmbed(rw.hypothetical);
    rankings.push(retriever.searchVec(hv, query, kEach, kEach));
  }
  for (const r of rw.rewrites) {
    rankings.push(retriever.search(r, kEach, kEach));
  }
  const fused = rrf(rankings).slice(0, kOut);
  return {
    rewriter: rwriterName(rw),
    rewrites: rw.rewrites,
    hypothetical: rw.hypothetical,
    results: fused,
  };
}

export function rwriterName(rw: RewriteResult): string {
  return rw.strategy;
}

export const CORPUS: Doc[] = [
  new Doc(
    "d1",
    "AbortMultipartOnFail",
    "AbortMultipartOnFail terminates an S3 multipart transfer and decrements the per-bucket " +
      "retry quota on persistent failure.",
  ),
  new Doc(
    "d2",
    "Transfer manager",
    "The transfer manager breaks a file into parts and tracks each part. Aborted transfers " +
      "release the reserved key.",
  ),
  new Doc(
    "d3",
    "Quota cooldown",
    "Each storage bucket carries a retry quota. When the quota reaches zero the bucket " +
      "enters a cooldown window and rejects further attempts.",
  ),
  new Doc(
    "d4",
    "check_permission",
    "Authorization is centralized in check_permission which evaluates a policy against " +
      "principal, resource, and action. Equally applied to user and service accounts.",
  ),
  new Doc("d5", "Policy engine", "The policy engine wraps an OPA runtime and exposes evaluate. Cached for a configured TTL."),
  new Doc(
    "d6",
    "Rank fusion",
    "Production search engines combine lexical and semantic retrieval through reciprocal " +
      "rank fusion. The fusion operates on ranks, not scores.",
  ),
  new Doc("d7", "Index sizing", "The vector index sits in memory. Plan for 1 KB per vector at 256 dimensions."),
  new Doc(
    "d8",
    "Cancelling jobs",
    "Long-running jobs accept a cancellation signal that stops the worker and releases the queue slot.",
  ),
];

export const GOLD: [string, string, string][] = [
  ["what do we do when a transfer breaks halfway", "d1", "multiquery"],
  ["how does the search service merge two retrievers", "d6", "hyde"],
  ["what happens when an upload fails and the retry budget is exhausted", "d1", "decompose"],
];

export function buildRetriever(): HybridRetriever {
  const r = new HybridRetriever();
  for (const d of CORPUS) {
    r.add(d);
  }
  return r;
}

function main(): void {
  const retriever = buildRetriever();
  const llm = new MockLLM();

  const strategies: [string, Rewriter][] = [
    ["no-rewrite", new IdentityRewriter()],
    ["hyde", new HyDERewriter(llm)],
    ["multiquery", new MultiQueryRewriter(llm, 3)],
    ["decompose", new DecomposeRewriter(llm)],
  ];

  console.log(`${"strategy".padEnd(12)} | ${"query".padEnd(60)} | gold@1? | gold-rank`);
  console.log("-".repeat(100));
  for (const [q, gold, expectedWinner] of GOLD) {
    for (const [name, rw] of strategies) {
      const out = retrieveWithRewriter(q, rw, retriever, 8, 8);
      const ranks = out.results.map(([d]) => d.docId);
      const hit = ranks.length > 0 && ranks[0] === gold ? "yes" : "no ";
      const goldRank = ranks.includes(gold) ? ranks.indexOf(gold) + 1 : -1;
      const marker = name === expectedWinner ? "  <- expected winner" : "";
      console.log(`${name.padEnd(12)} | ${q.slice(0, 58).padEnd(60)} |  ${hit}   |   ${goldRank}${marker}`);
    }
    console.log();
  }
}

export class IdentityRewriter extends Rewriter {
  name = "no-rewrite";

  rewrite(query: string): RewriteResult {
    return new RewriteResult(this.name, [query]);
  }
}

main();
