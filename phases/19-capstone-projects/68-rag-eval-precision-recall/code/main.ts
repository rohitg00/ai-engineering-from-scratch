// Lesson: RAG Evaluation: Precision, Recall, MRR, nDCG, Faithfulness, Answer Relevance (phase 19 / lesson 68)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/68-rag-eval-precision-recall/docs/en.md
// Run: npx tsx phases/19-capstone-projects/68-rag-eval-precision-recall/code/main.ts

export interface Qrel {
  qid: string;
  query: string;
  goldDocIds: string[];
  goldAnswerSubstring: string;
  gradedRelevance: Map<string, number>;
}

export function precisionAtK(retrieved: string[], gold: Set<string>, k: number): number {
  if (k <= 0) {
    return 0.0;
  }
  const top = retrieved.slice(0, k);
  if (top.length === 0) {
    return 0.0;
  }
  return top.filter((r) => gold.has(r)).length / k;
}

export function recallAtK(retrieved: string[], gold: Set<string>, k: number): number {
  if (gold.size === 0) {
    return 0.0;
  }
  const top = new Set(retrieved.slice(0, k));
  let inter = 0;
  for (const t of top) {
    if (gold.has(t)) {
      inter += 1;
    }
  }
  return inter / gold.size;
}

export function reciprocalRank(retrieved: string[], gold: Set<string>): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (gold.has(retrieved[i])) {
      return 1.0 / (i + 1);
    }
  }
  return 0.0;
}

export function meanReciprocalRank(retrievedPerQuery: string[][], goldPerQuery: Set<string>[]): number {
  if (retrievedPerQuery.length !== goldPerQuery.length) {
    throw new Error(
      `retrieved_per_query and gold_per_query must have the same length ` +
        `(${retrievedPerQuery.length} vs ${goldPerQuery.length})`,
    );
  }
  if (retrievedPerQuery.length === 0) {
    return 0.0;
  }
  let s = 0;
  retrievedPerQuery.forEach((r, i) => {
    s += reciprocalRank(r, goldPerQuery[i]);
  });
  return s / retrievedPerQuery.length;
}

export function dcgAtK(retrieved: string[], graded: Map<string, number>, k: number): number {
  let s = 0.0;
  retrieved.slice(0, k).forEach((docId, i) => {
    const rel = graded.get(docId) ?? 0;
    if (rel <= 0) {
      return;
    }
    s += (2 ** rel - 1) / Math.log2(i + 2);
  });
  return s;
}

export function ndcgAtK(retrieved: string[], graded: Map<string, number>, k: number): number {
  const dcg = dcgAtK(retrieved, graded, k);
  const idealOrder = [...graded.entries()].sort((a, b) => b[1] - a[1]);
  const ideal = idealOrder.map(([docId]) => docId);
  const idcg = dcgAtK(ideal, graded, k);
  if (idcg === 0) {
    return 0.0;
  }
  return dcg / idcg;
}

export function extractClaims(answer: string): string[] {
  const parts = answer.trim().split(/(?<=[.!?])\s+/);
  return parts.filter((p) => p.trim()).map((p) => p.trim());
}

function findTokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

const CONTENT_STOP = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "of", "to", "in", "on", "at", "for", "with", "and", "or", "as", "by",
  "that", "this", "these", "those", "it", "its", "from", "we", "our", "you",
  "your", "i", "do", "does", "did", "have", "has", "had", "will", "would",
  "can", "could", "should", "may", "might", "what", "when", "where",
  "which", "who", "why", "how",
]);

function contentTokens(text: string): Set<string> {
  return new Set(findTokens(text).filter((t) => !CONTENT_STOP.has(t) && t.length > 1));
}

function intersectSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) {
    if (b.has(x)) {
      n += 1;
    }
  }
  return n;
}

export class MockJudge {
  constructor(public overlapThreshold = 0.4) {}

  supported(claim: string, context: string): boolean {
    const cTokens = contentTokens(claim);
    if (cTokens.size === 0) {
      return false;
    }
    const ctxTokens = contentTokens(context);
    if (ctxTokens.size === 0) {
      return false;
    }
    const overlap = intersectSize(cTokens, ctxTokens) / cTokens.size;
    return overlap >= this.overlapThreshold;
  }

  relevant(question: string, answer: string): boolean {
    const qTokens = contentTokens(question);
    const aTokens = contentTokens(answer);
    if (qTokens.size === 0) {
      return false;
    }
    const overlap = intersectSize(qTokens, aTokens) / qTokens.size;
    return overlap >= this.overlapThreshold;
  }
}

export function faithfulness(claims: string[], contextTexts: string[], judge: MockJudge): number {
  if (claims.length === 0) {
    return 0.0;
  }
  const contextBlob = contextTexts.join(" ");
  const supported = claims.filter((c) => judge.supported(c, contextBlob)).length;
  return supported / claims.length;
}

export function answerRelevance(question: string, answer: string, judge: MockJudge): number {
  return judge.relevant(question, answer) ? 1.0 : 0.0;
}

export class Doc {
  constructor(
    public docId: string,
    public title: string,
    public body: string,
  ) {}

  text(): string {
    return `${this.title}\n${this.body}`;
  }
}

export const CORPUS: Doc[] = [
  new Doc(
    "d1",
    "AbortMultipartOnFail",
    "AbortMultipartOnFail aborts an in-flight S3 multipart upload and decrements the " + "per-bucket retry budget.",
  ),
  new Doc(
    "d2",
    "Uploading large files",
    "Large files are split into parts. Cancelled uploads release the reserved keys after " + "three failed parts.",
  ),
  new Doc(
    "d3",
    "Abort threshold",
    "The abort threshold is configured per bucket at three failed parts. Past that " +
      "threshold the upload is aborted.",
  ),
  new Doc(
    "d4",
    "check_permission",
    "Authorization is centralized in check_permission which evaluates a policy against " +
      "principal, resource, and action.",
  ),
  new Doc("d5", "Policy engine", "The policy engine wraps an OPA runtime and exposes evaluate; cached for a configured TTL."),
  new Doc(
    "d6",
    "Rank fusion",
    "Production search combines lexical and semantic retrieval through reciprocal rank " + "fusion at k = 60.",
  ),
  new Doc(
    "d7",
    "Cancellation",
    "Long-running jobs accept a cancellation signal that stops the worker and releases the " + "queue slot.",
  ),
  new Doc(
    "d8",
    "Index sizing",
    "Plan for one kilobyte per vector at 256 dimensions in float32 inside the in-memory ANN " + "index.",
  ),
  new Doc(
    "d9",
    "Drop policy for stale records",
    "Stale records are dropped from the in-memory cache after a TTL. This is unrelated to " +
      "the upload abort threshold.",
  ),
  new Doc(
    "d10",
    "Worker pool sizing",
    "The worker pool is sized by p95 demand. Long-running workers are recycled when the " +
      "pool is overprovisioned.",
  ),
  new Doc(
    "d11",
    "Permission inheritance",
    "A central permission gate inherits roles from the parent group. This document does " +
      "not describe the authorization implementation; see d4.",
  ),
  new Doc(
    "d12",
    "Combining query results",
    "Multiple query results can be combined by simple union or by intersection. Production " +
      "engines prefer rank fusion; see d6.",
  ),
];

export const QRELS: Qrel[] = [
  {
    qid: "q1",
    query: "what is the threshold before a multipart upload is dropped",
    goldDocIds: ["d3", "d1"],
    goldAnswerSubstring: "three failed parts",
    gradedRelevance: new Map([
      ["d3", 3],
      ["d1", 2],
      ["d2", 1],
    ]),
  },
  {
    qid: "q2",
    query: "where is the central permission gate",
    goldDocIds: ["d4"],
    goldAnswerSubstring: "check_permission",
    gradedRelevance: new Map([
      ["d4", 3],
      ["d5", 2],
    ]),
  },
  {
    qid: "q3",
    query: "how do production search engines fuse two retrievers",
    goldDocIds: ["d6"],
    goldAnswerSubstring: "reciprocal rank fusion",
    gradedRelevance: new Map([
      ["d6", 3],
      ["d8", 1],
    ]),
  },
  {
    qid: "q4",
    query: "how do you stop a long-running worker",
    goldDocIds: ["d7"],
    goldAnswerSubstring: "cancellation signal",
    gradedRelevance: new Map([
      ["d7", 3],
      ["d2", 1],
    ]),
  },
];

export type PipelineFn = (query: string, k: number) => [string[], string];

function countOf(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) {
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  return m;
}

export function bow(text: string): Map<string, number> {
  return countOf(findTokens(text));
}

export function scoreDoc(query: string, doc: Doc): number {
  const q = bow(query);
  const d = bow(doc.text());
  let s = 0;
  for (const [term, c] of q) {
    s += c * (d.get(term) ?? 0);
  }
  return s;
}

const BASELINE_STOP = new Set([
  "the", "a", "an", "is", "are", "of", "to", "in", "on", "at", "for",
  "with", "and", "or", "as", "by", "do", "you", "we", "our", "how", "what",
  "where", "when", "which", "before", "after", "into",
]);

function baselineTokens(text: string): string[] {
  return findTokens(text).filter((t) => !BASELINE_STOP.has(t));
}

export function baselinePipeline(query: string, k: number): [string[], string] {
  const qTokens = baselineTokens(query);
  const scored: [Doc, number][] = [];
  for (const d of CORPUS) {
    const dCounter = countOf(baselineTokens(d.text()));
    let score = 0;
    for (const t of qTokens) {
      score += dCounter.get(t) ?? 0;
    }
    scored.push([d, score]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  const top = scored.filter(([, s]) => s > 0).map(([d]) => d).slice(0, k);
  const answer = top.length > 0 ? top[0].body : "I do not know.";
  return [top.map((d) => d.docId), answer];
}

const SYN: Record<string, string[]> = {
  drop: ["abort"],
  dropped: ["aborted"],
  fuse: ["combine", "fusion"],
  central: ["centralized"],
  gate: ["check"],
  stop: ["cancel", "cancellation"],
  worker: ["job"],
  permission: ["authorization"],
};

function synOf(t: string): string[] {
  return Object.prototype.hasOwnProperty.call(SYN, t) ? SYN[t] : [];
}

export function hybridPipeline(query: string, k: number): [string[], string] {
  const qTokens = baselineTokens(query);
  const expanded = [...qTokens];
  for (const t of [...qTokens]) {
    expanded.push(...synOf(t));
  }
  const expandedCounter = countOf(expanded);
  const expandedSet = new Set(expanded);
  const scored: [Doc, number][] = [];
  for (const d of CORPUS) {
    const dCounter = countOf(baselineTokens(d.text()));
    const union = new Set([...expandedCounter.keys(), ...dCounter.keys()]);
    let score = 0;
    for (const t of union) {
      score += Math.min(expandedCounter.get(t) ?? 0, dCounter.get(t) ?? 0);
    }
    const titleTokens = new Set(baselineTokens(d.title));
    score += 2 * intersectSize(expandedSet, titleTokens);
    scored.push([d, score]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  const top = scored.filter(([, s]) => s > 0).map(([d]) => d).slice(0, k);
  const answerParts = top.slice(0, 2).map((d) => d.body);
  return [top.map((d) => d.docId), answerParts.length > 0 ? answerParts.join(" ") : "I do not know."];
}

export function hybridPlusRerankPipeline(query: string, k: number): [string[], string] {
  const [ids] = hybridPipeline(query, k * 2);
  const byId = new Map(CORPUS.map((d) => [d.docId, d] as [string, Doc]));
  const qTokens = new Set(baselineTokens(query));
  const synValues = Object.values(SYN);
  for (const synList of synValues) {
    for (const s of synList) {
      const keys = new Set(Object.keys(SYN).filter(() => synValues.some((v) => v.includes(s))));
      if (keys.has(s)) {
        continue;
      }
    }
  }

  const titleBoost = (docId: string): number => {
    const titleTokens = new Set(baselineTokens((byId.get(docId) as Doc).title));
    const expanded = new Set(qTokens);
    for (const t of qTokens) {
      for (const s of synOf(t)) {
        expanded.add(s);
      }
    }
    return intersectSize(expanded, titleTokens) * 5;
  };

  const ranked = [...ids].sort((a, b) => titleBoost(b) - titleBoost(a));
  const top = ranked.slice(0, k);
  const docs = top.map((d) => byId.get(d) as Doc);
  const answerParts = docs.slice(0, 2).map((d) => d.body);
  const answer = answerParts.length > 0 ? answerParts.join(" ") : "I do not know.";
  return [top, answer];
}

export type EvalResult = Map<string, number | string[][]>;

export function evaluatePipeline(
  pipeline: PipelineFn,
  qrels: Qrel[],
  ks: number[] = [1, 3, 5],
  judge: MockJudge | null = null,
): EvalResult {
  const j = judge ?? new MockJudge();
  const perQRetrieved: string[][] = [];
  const perQGold: Set<string>[] = [];
  const perQGraded: Map<string, number>[] = [];
  const perQAnswers: [string, string, string[]][] = [];
  const metrics = new Map<string, number[]>();
  const push = (name: string, v: number): void => {
    const list = metrics.get(name) ?? [];
    list.push(v);
    metrics.set(name, list);
  };

  for (const qrel of qrels) {
    const [retrieved, answer] = pipeline(qrel.query, Math.max(...ks));
    perQRetrieved.push(retrieved);
    perQGold.push(new Set(qrel.goldDocIds));
    perQGraded.push(qrel.gradedRelevance);
    perQAnswers.push([qrel.query, answer, retrieved]);
    for (const k of ks) {
      push(`precision@${k}`, precisionAtK(retrieved, new Set(qrel.goldDocIds), k));
      push(`recall@${k}`, recallAtK(retrieved, new Set(qrel.goldDocIds), k));
      push(`ndcg@${k}`, ndcgAtK(retrieved, qrel.gradedRelevance, k));
    }
  }

  const mrr = meanReciprocalRank(perQRetrieved, perQGold);

  const byId = new Map(CORPUS.map((d) => [d.docId, d] as [string, Doc]));
  const faithScores: number[] = [];
  const relScores: number[] = [];
  for (const [question, answer, retrieved] of perQAnswers) {
    const contextTexts = retrieved.filter((did) => byId.has(did)).map((did) => (byId.get(did) as Doc).text());
    const claims = extractClaims(answer);
    faithScores.push(faithfulness(claims, contextTexts, j));
    relScores.push(answerRelevance(question, answer, j));
  }

  const mean = (v: number[]): number => (v.length > 0 ? v.reduce((a, x) => a + x, 0) / v.length : 0.0);
  const out: EvalResult = new Map();
  out.set("per_query_retrieved", perQRetrieved);
  for (const [m, v] of metrics) {
    out.set(m, mean(v));
  }
  out.set("mrr", mrr);
  out.set("faithfulness", mean(faithScores));
  out.set("answer_relevance", mean(relScores));
  return out;
}

function fmt(v: number): string {
  if (Number.isInteger(v * 16) && Math.abs(v * 16) % 2 === 1) {
    const fl = Math.floor(v * 1000);
    return ((fl % 2 === 0 ? fl : fl + 1) / 1000).toFixed(3);
  }
  return v.toFixed(3);
}

function main(): void {
  const pipelines: [string, PipelineFn][] = [
    ["baseline", baselinePipeline],
    ["hybrid", hybridPipeline],
    ["hybrid+rerank", hybridPlusRerankPipeline],
  ];
  const metricsOrder = [
    "precision@1", "precision@3", "precision@5",
    "recall@1", "recall@3", "recall@5",
    "ndcg@1", "ndcg@3", "ndcg@5",
    "mrr", "faithfulness", "answer_relevance",
  ];
  const rows = new Map<string, EvalResult>();
  for (const [name, fn] of pipelines) {
    const result = evaluatePipeline(fn, QRELS, [1, 3, 5]);
    rows.set(name, result);
  }

  const header = "metric          | " + pipelines.map(([n]) => n.padEnd(14)).join(" | ");
  console.log(header);
  console.log("-".repeat(header.length));
  for (const m of metricsOrder) {
    const cells = pipelines
      .map(([name]) => fmt((rows.get(name) as EvalResult).get(m) as number).padEnd(14))
      .join(" | ");
    console.log(`${m.padEnd(15)} | ${cells}`);
  }
}

main();
