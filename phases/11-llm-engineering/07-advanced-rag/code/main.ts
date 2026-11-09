// Lesson: Advanced RAG (Chunking, Reranking, Hybrid Search) (phase 11 / lesson 07)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/11-llm-engineering/07-advanced-rag/docs/en.md
// Run: npx tsx phases/11-llm-engineering/07-advanced-rag/code/main.ts

type Scored = [number, number];

function pySplit(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

function pyFixed(x: number, d: number): string {
  const neg = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  let s = a.toFixed(d);
  const exact = a.toFixed(100);
  const dot = exact.indexOf(".");
  const tail = exact.slice(dot + 1 + d);
  if (/^50*$/.test(tail)) {
    const truncated = exact.slice(0, d > 0 ? dot + 1 + d : dot);
    const last = Number(truncated[truncated.length - 1]);
    if (last % 2 === 0) s = truncated;
  }
  return neg ? "-" + s : s;
}

function pyStrRepr(s: string): string {
  if (s.includes("'") && !s.includes('"')) return '"' + s + '"';
  return "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
}

function pyListRepr(items: string[]): string {
  return "[" + items.map(pyStrRepr).join(", ") + "]";
}

function stripChars(s: string, chars: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && chars.includes(s[start])) start++;
  while (end > start && chars.includes(s[end - 1])) end--;
  return s.slice(start, end);
}

function countWords(words: string[]): Map<string, number> {
  const count = new Map<string, number>();
  for (const w of words) count.set(w, (count.get(w) ?? 0) + 1);
  return count;
}

function sortDesc(scores: Scored[]): void {
  scores.sort((x, y) => y[1] - x[1]);
}

function chunkText(text: string, chunkSize = 200, overlap = 50): string[] {
  const words = pySplit(text);
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = start + chunkSize;
    chunks.push(words.slice(start, end).join(" "));
    start += chunkSize - overlap;
  }
  return chunks;
}

function buildVocabulary(documents: string[]): string[] {
  const vocab = new Set<string>();
  for (const doc of documents) {
    for (const w of pySplit(doc.toLowerCase())) vocab.add(w);
  }
  return [...vocab].sort();
}

function computeTf(text: string, vocab: string[]): number[] {
  const words = pySplit(text.toLowerCase());
  const count = countWords(words);
  const total = words.length;
  if (total === 0) return vocab.map(() => 0.0);
  return vocab.map((word) => (count.get(word) ?? 0) / total);
}

function computeIdf(documents: string[], vocab: string[]): number[] {
  const n = documents.length;
  const docWords = documents.map((doc) => new Set(pySplit(doc.toLowerCase())));
  const idf: number[] = [];
  for (const word of vocab) {
    let docCount = 0;
    for (const words of docWords) if (words.has(word)) docCount++;
    idf.push(Math.log((n + 1) / (docCount + 1)) + 1);
  }
  return idf;
}

function tfidfEmbed(text: string, vocab: string[], idf: number[]): number[] {
  const tf = computeTf(text, vocab);
  return tf.map((t, i) => t * idf[i]);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < a.length; i++) dotProduct += a[i] * b[i];
  for (const x of a) sumA += x * x;
  for (const x of b) sumB += x * x;
  const normA = Math.sqrt(sumA);
  const normB = Math.sqrt(sumB);
  if (normA === 0 || normB === 0) return 0.0;
  return dotProduct / (normA * normB);
}

function vectorSearch(queryEmbedding: number[], storedEmbeddings: number[][], topK = 5): Scored[] {
  const scores: Scored[] = storedEmbeddings.map((emb, i) => [i, cosineSimilarity(queryEmbedding, emb)]);
  sortDesc(scores);
  return scores.slice(0, topK);
}

class BM25 {
  k1: number;
  b: number;
  docs: string[] = [];
  docLengths: number[] = [];
  avgDl = 0;
  docFreqs = new Map<string, number>();
  nDocs = 0;

  constructor(k1 = 1.2, b = 0.75) {
    this.k1 = k1;
    this.b = b;
  }

  index(documents: string[]): void {
    this.docs = documents;
    this.nDocs = documents.length;
    this.docLengths = [];
    this.docFreqs = new Map();
    for (const doc of documents) {
      const words = pySplit(doc.toLowerCase());
      this.docLengths.push(words.length);
      for (const word of new Set(words)) {
        this.docFreqs.set(word, (this.docFreqs.get(word) ?? 0) + 1);
      }
    }
    this.avgDl = this.nDocs ? this.docLengths.reduce((s, x) => s + x, 0) / this.nDocs : 1;
  }

  score(query: string, docIdx: number): number {
    const queryWords = pySplit(query.toLowerCase());
    const docWords = pySplit(this.docs[docIdx].toLowerCase());
    const docLen = this.docLengths[docIdx];
    const wordCounts = countWords(docWords);
    let total = 0.0;
    for (const term of queryWords) {
      const tf = wordCounts.get(term);
      if (tf === undefined) continue;
      const df = this.docFreqs.get(term) ?? 0;
      const idf = Math.log((this.nDocs - df + 0.5) / (df + 0.5) + 1);
      const numerator = tf * (this.k1 + 1);
      const denominator = tf + this.k1 * (1 - this.b + (this.b * docLen) / this.avgDl);
      total += (idf * numerator) / denominator;
    }
    return total;
  }

  search(query: string, topK = 10): Scored[] {
    const scores: Scored[] = [];
    for (let i = 0; i < this.nDocs; i++) scores.push([i, this.score(query, i)]);
    sortDesc(scores);
    return scores.slice(0, topK);
  }
}

function reciprocalRankFusion(rankedLists: Scored[][], k = 60): Scored[] {
  const scores = new Map<number, number>();
  for (const rankedList of rankedLists) {
    rankedList.forEach(([docId], rank) => {
      scores.set(docId, (scores.get(docId) ?? 0.0) + 1.0 / (k + rank + 1));
    });
  }
  const fused: Scored[] = [...scores.entries()];
  sortDesc(fused);
  return fused;
}

function hybridSearch(
  query: string,
  chunks: string[],
  vectorEmbeddings: number[][],
  vocab: string[],
  idf: number[],
  bm25Index: BM25,
  topK = 5,
  retrievalPool = 15,
): Scored[] {
  const queryEmb = tfidfEmbed(query, vocab, idf);
  const vecResults = vectorSearch(queryEmb, vectorEmbeddings, retrievalPool);
  const bm25Results = bm25Index.search(query, retrievalPool);
  const fused = reciprocalRankFusion([vecResults, bm25Results]);
  return fused.slice(0, topK);
}

const RERANK_STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "what", "how",
  "why", "when", "where", "do", "does", "for", "of", "in", "to",
  "and", "or", "on", "at", "by", "it", "its", "this", "that",
  "with", "from", "be", "has", "have", "had", "not", "but",
]);

function rerank(query: string, candidates: Scored[], chunks: string[]): Scored[] {
  const queryWords = new Set(pySplit(query.toLowerCase()));
  const queryTerms = [...queryWords].filter((w) => !RERANK_STOP_WORDS.has(w));

  const scored: Scored[] = [];
  for (const [docId, initialScore] of candidates) {
    const chunk = chunks[docId].toLowerCase();
    const chunkWords = new Set(pySplit(chunk));

    const termOverlap = queryTerms.filter((t) => chunkWords.has(t)).length;

    const queryBigrams = new Set<string>();
    const qList = pySplit(query.toLowerCase()).filter((w) => !RERANK_STOP_WORDS.has(w));
    for (let i = 0; i < qList.length - 1; i++) queryBigrams.add(qList[i] + " " + qList[i + 1]);
    let bigramMatches = 0;
    for (const bg of queryBigrams) if (chunk.includes(bg)) bigramMatches++;

    let positionBoost = 0;
    for (const term of queryTerms) {
      const pos = chunk.indexOf(term);
      if (pos !== -1 && pos < Math.floor(chunk.length / 3)) positionBoost += 0.5;
    }

    const rerankScore = termOverlap * 1.0 + bigramMatches * 2.0 + positionBoost + initialScore * 5.0;
    scored.push([docId, rerankScore]);
  }
  sortDesc(scored);
  return scored;
}

const HYDE_TEMPLATES: Record<string, string> = {
  what: "The answer to '{query}' is as follows: Based on our documentation, {topic} involves specific policies and procedures that define the process and requirements.",
  how: "To address '{query}': The process involves several steps. First, you need to initiate the request for {topic}. Then, the system processes it according to the defined rules and policies.",
  default: "Regarding '{query}': Our records indicate specific details and policies related to {topic} that provide a comprehensive answer to this question.",
};

const HYDE_FILLER = new Set([
  "what", "is", "the", "how", "do", "does", "a", "an", "for", "of",
  "to", "in", "on", "at", "by", "and", "or", "are", "was", "were", "?",
]);

function hydeGenerateHypothesis(query: string): string {
  const queryLower = query.toLowerCase().trim();
  let template: string;
  if (queryLower.startsWith("what")) template = HYDE_TEMPLATES.what;
  else if (queryLower.startsWith("how")) template = HYDE_TEMPLATES.how;
  else template = HYDE_TEMPLATES.default;

  const topicWords = pySplit(query.toLowerCase())
    .map((w) => stripChars(w, "?.,!"))
    .filter((w) => !HYDE_FILLER.has(w));
  const topic = topicWords.length ? topicWords.join(" ") : "this topic";

  return template.replace("{query}", () => query).replace("{topic}", () => topic);
}

function hydeSearch(
  query: string,
  vectorEmbeddings: number[][],
  vocab: string[],
  idf: number[],
  topK = 5,
): [Scored[], string] {
  const hypothesis = hydeGenerateHypothesis(query);
  const hypothesisEmb = tfidfEmbed(hypothesis, vocab, idf);
  const results = vectorSearch(hypothesisEmb, vectorEmbeddings, topK);
  return [results, hypothesis];
}

function createParentChildChunks(
  text: string,
  parentSize = 200,
  childSize = 50,
): [string[], string[], Map<number, number>] {
  const words = pySplit(text);
  const parents: string[] = [];
  const children: string[] = [];
  const childToParent = new Map<number, number>();

  let parentIdx = 0;
  let start = 0;
  while (start < words.length) {
    const parentEnd = Math.min(start + parentSize, words.length);
    parents.push(words.slice(start, parentEnd).join(" "));

    let childStart = start;
    while (childStart < parentEnd) {
      const childEnd = Math.min(childStart + childSize, parentEnd);
      const childIdx = children.length;
      children.push(words.slice(childStart, childEnd).join(" "));
      childToParent.set(childIdx, parentIdx);
      childStart += childSize;
    }

    parentIdx++;
    start += parentSize;
  }
  return [parents, children, childToParent];
}

const FAITH_STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "and", "or",
  "to", "of", "in", "for", "on", "at", "by", "it", "this", "that",
]);

function evaluateFaithfulness(answer: string, retrievedChunks: string[]): [number, string[]] {
  const answerSentences = answer
    .split(".")
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
  if (answerSentences.length === 0) return [1.0, []];

  let grounded = 0;
  const ungrounded: string[] = [];
  const context = retrievedChunks.join(" ").toLowerCase();

  for (const sentence of answerSentences) {
    const words = new Set(pySplit(sentence.toLowerCase()));
    const contentWords = [...words].filter((w) => !FAITH_STOP_WORDS.has(w));
    if (contentWords.length === 0) {
      grounded++;
      continue;
    }
    const matched = contentWords.filter((w) => context.includes(w)).length;
    const ratio = matched / contentWords.length;
    if (ratio >= 0.5) grounded++;
    else ungrounded.push(sentence);
  }

  return [grounded / answerSentences.length, ungrounded];
}

interface RecallResult {
  query: string;
  recall: number;
  hits: number;
  total_relevant: number;
}

function evaluateRetrievalRecall(
  queriesWithRelevant: [string, number[]][],
  retrievalFn: (query: string, k: number) => Scored[],
  k = 5,
): [number, RecallResult[]] {
  let totalRecall = 0.0;
  const results: RecallResult[] = [];
  for (const [query, relevantIndices] of queriesWithRelevant) {
    const retrieved = new Set(retrievalFn(query, k).map(([idx]) => idx));
    const relevantSet = new Set(relevantIndices);
    const hits = [...retrieved].filter((idx) => relevantSet.has(idx)).length;
    const recall = relevantSet.size ? hits / relevantSet.size : 1.0;
    totalRecall += recall;
    results.push({ query, recall, hits, total_relevant: relevantSet.size });
  }
  const avgRecall = queriesWithRelevant.length ? totalRecall / queriesWithRelevant.length : 0;
  return [avgRecall, results];
}

function buildRagPrompt(query: string, retrievedChunks: string[]): string {
  const context = retrievedChunks.map((chunk, i) => `[Source ${i + 1}]\n${chunk}`).join("\n\n---\n\n");
  return (
    "Answer the question based ONLY on the following context.\n" +
    "If the context doesn't contain enough information, " +
    'say "I don\'t have enough information to answer that."\n\n' +
    `Context:\n${context}\n\n` +
    `Question: ${query}\n\n` +
    "Answer:"
  );
}

const SAMPLE_DOCUMENTS = [
  `Acme Corp Refund Policy.
    All standard plan customers are eligible for a full refund within 30 days of purchase.
    Enterprise plan customers receive an extended 60-day refund window with pro-rated refunds
    calculated from the date of cancellation. Refunds are processed within 5-7 business days
    and returned to the original payment method. No refunds are available after the refund
    window closes. Customers must submit refund requests through the support portal or by
    contacting their account manager directly. Annual subscriptions that are cancelled mid-term
    will receive a pro-rated credit for the remaining months.`,

  `Acme Corp Product Overview.
    Acme Corp offers three product tiers: Starter, Professional, and Enterprise.
    The Starter plan includes basic features for individual users at $29 per month.
    The Professional plan adds team collaboration, advanced analytics, and priority
    support for $99 per month per user. The Enterprise plan includes everything in
    Professional plus custom integrations, dedicated account management, SSO,
    audit logs, and a 99.99% uptime SLA. Enterprise pricing is custom and starts
    at $500 per month for up to 50 users. All plans include a 14-day free trial
    with no credit card required.`,

  `Acme Corp Security Practices.
    Acme Corp maintains SOC 2 Type II compliance and undergoes annual third-party
    security audits. All data is encrypted at rest using AES-256 and in transit
    using TLS 1.3. Customer data is stored in isolated tenants within AWS
    us-east-1 and eu-west-1 regions. Data residency can be configured per
    organization for Enterprise customers. Backups are performed every 6 hours
    with 30-day retention. Acme Corp does not sell or share customer data with
    third parties. Enterprise customers can request data deletion within 24 hours.
    Bug bounty program available through HackerOne.`,

  `Acme Corp API Documentation.
    The Acme API uses REST with JSON request and response bodies. Authentication
    is via Bearer tokens issued through OAuth 2.0. Rate limits are 100 requests
    per minute for Starter, 1000 for Professional, and 10000 for Enterprise.
    Rate limit headers are included in every response: X-RateLimit-Limit,
    X-RateLimit-Remaining, and X-RateLimit-Reset. Exceeding the rate limit
    returns HTTP 429 with a Retry-After header. The API supports pagination
    via cursor-based pagination using the next_cursor field. Webhooks are
    available for real-time event notifications on Professional and Enterprise
    plans. API versioning uses date-based versions in the URL path.`,

  `Acme Corp Q3 2025 Earnings Report.
    Total revenue for Q3 2025 was $47.2 million, up 23% year-over-year.
    Enterprise segment contributed $31.8 million, representing 67% of total
    revenue. Professional segment added $12.1 million. Starter segment
    contributed $3.3 million. Customer count grew to 14,200 from 11,800
    in Q3 2024. Net retention rate was 118%. Operating expenses were
    $38.4 million. EBITDA was $8.8 million with an 18.6% margin.
    Free cash flow was $6.2 million. Guidance for Q4 2025 is $51-53 million
    in revenue with continued margin expansion.`,

  `Acme Corp Uptime and Reliability.
    Acme Corp guarantees 99.9% uptime for Professional plans and 99.99% uptime
    for Enterprise plans. Uptime is calculated monthly excluding scheduled
    maintenance windows which are announced 72 hours in advance. If uptime
    falls below the guaranteed level, customers receive service credits:
    10% credit for each 0.1% below the SLA threshold, up to a maximum of
    30% of the monthly fee. Service credits must be requested within 30 days
    of the incident. Status page updates are posted at status.acme.com
    within 5 minutes of any detected incident. Post-incident reports are
    published within 48 hours for any outage exceeding 15 minutes.`,
];

function main(): void {
  const bar = "=".repeat(65);
  const preview = (text: string, n: number) => text.slice(0, n).replace(/\n/g, " ");

  console.log(bar);
  console.log("STEP 1: BM25 Keyword Search");
  console.log(bar);

  const allChunks: string[] = [];
  const chunkSources: string[] = [];
  const sourceNames = ["refund", "product", "security", "api", "earnings", "uptime"];
  SAMPLE_DOCUMENTS.forEach((doc, i) => {
    for (const c of chunkText(doc, 50, 10)) {
      allChunks.push(c);
      chunkSources.push(sourceNames[i]);
    }
  });

  const bm25 = new BM25();
  bm25.index(allChunks);

  const testQuery = "What was revenue last quarter?";
  let bm25Results = bm25.search(testQuery, 5);
  console.log(`  Query: ${testQuery}`);
  console.log(`  BM25 top-5:`);
  bm25Results.forEach(([idx, score], rank) => {
    console.log(`    #${rank + 1} [${chunkSources[idx]}] score=${pyFixed(score, 4)} | ${preview(allChunks[idx], 70)}...`);
  });

  console.log("\n" + bar);
  console.log("STEP 2: Vector Search vs BM25");
  console.log(bar);

  const vocab = buildVocabulary(allChunks);
  const idf = computeIdf(allChunks, vocab);
  const embeddings = allChunks.map((c) => tfidfEmbed(c, vocab, idf));

  const queries = [
    "What is the refund policy for enterprise customers?",
    "What was revenue last quarter?",
    "How is data encrypted?",
    "What are the API rate limits for enterprise?",
    "What happens if uptime falls below SLA?",
  ];

  for (const query of queries) {
    const queryEmb = tfidfEmbed(query, vocab, idf);
    const vecTop1 = vectorSearch(queryEmb, embeddings, 1)[0];
    const bm25Top1 = bm25.search(query, 1)[0];

    console.log(`\n  Query: ${query}`);
    console.log(`    Vector #1: [${chunkSources[vecTop1[0]]}] score=${pyFixed(vecTop1[1], 4)}`);
    console.log(`    BM25   #1: [${chunkSources[bm25Top1[0]]}] score=${pyFixed(bm25Top1[1], 4)}`);
    const agree = chunkSources[vecTop1[0]] === chunkSources[bm25Top1[0]] ? "AGREE" : "DISAGREE";
    console.log(`    ${agree}`);
  }

  console.log("\n" + bar);
  console.log("STEP 3: Reciprocal Rank Fusion (Hybrid Search)");
  console.log(bar);

  let query = "What was revenue last quarter?";
  console.log(`  Query: ${query}`);

  let queryEmb = tfidfEmbed(query, vocab, idf);
  const vecResults = vectorSearch(queryEmb, embeddings, 10);
  bm25Results = bm25.search(query, 10);

  console.log(`\n  Vector top-3:`);
  vecResults.slice(0, 3).forEach(([idx, score], rank) => {
    console.log(`    #${rank + 1} [${chunkSources[idx]}] ${pyFixed(score, 4)}`);
  });

  console.log(`\n  BM25 top-3:`);
  bm25Results.slice(0, 3).forEach(([idx, score], rank) => {
    console.log(`    #${rank + 1} [${chunkSources[idx]}] ${pyFixed(score, 4)}`);
  });

  const fused = reciprocalRankFusion([vecResults, bm25Results]);
  console.log(`\n  RRF fused top-5:`);
  fused.slice(0, 5).forEach(([idx, score], rank) => {
    console.log(`    #${rank + 1} [${chunkSources[idx]}] rrf=${pyFixed(score, 4)} | ${preview(allChunks[idx], 60)}...`);
  });

  console.log("\n" + bar);
  console.log("STEP 4: Reranking");
  console.log(bar);

  query = "enterprise refund policy";
  console.log(`  Query: ${query}`);

  const hybridResults = hybridSearch(query, allChunks, embeddings, vocab, idf, bm25, 10);
  const reranked = rerank(query, hybridResults, allChunks);

  console.log(`\n  Before reranking (top-5):`);
  hybridResults.slice(0, 5).forEach(([idx, score], rank) => {
    console.log(`    #${rank + 1} [${chunkSources[idx]}] score=${pyFixed(score, 4)} | ${preview(allChunks[idx], 60)}...`);
  });

  console.log(`\n  After reranking (top-5):`);
  reranked.slice(0, 5).forEach(([idx, score], rank) => {
    console.log(`    #${rank + 1} [${chunkSources[idx]}] score=${pyFixed(score, 4)} | ${preview(allChunks[idx], 60)}...`);
  });

  console.log("\n" + bar);
  console.log("STEP 5: HyDE (Hypothetical Document Embeddings)");
  console.log(bar);

  query = "How much money did the company make?";
  console.log(`  Query: ${query}`);
  console.log(`  (Note: query uses 'money', docs use 'revenue' and 'earnings')`);

  queryEmb = tfidfEmbed(query, vocab, idf);
  const directResults = vectorSearch(queryEmb, embeddings, 3);
  const [hydeResults, hypothesis] = hydeSearch(query, embeddings, vocab, idf, 3);

  console.log(`\n  Hypothesis: ${hypothesis.slice(0, 100)}...`);

  console.log(`\n  Direct search top-3:`);
  directResults.forEach(([idx, score], rank) => {
    console.log(`    #${rank + 1} [${chunkSources[idx]}] ${pyFixed(score, 4)}`);
  });

  console.log(`\n  HyDE search top-3:`);
  hydeResults.forEach(([idx, score], rank) => {
    console.log(`    #${rank + 1} [${chunkSources[idx]}] ${pyFixed(score, 4)}`);
  });

  console.log("\n" + bar);
  console.log("STEP 6: Parent-Child Chunking");
  console.log(bar);

  const fullText = SAMPLE_DOCUMENTS.join(" ");
  const [parents, children, childToParent] = createParentChildChunks(fullText, 100, 25);

  console.log(`  Total words: ${pySplit(fullText).length}`);
  console.log(`  Parent chunks: ${parents.length} (100 words each)`);
  console.log(`  Child chunks: ${children.length} (25 words each)`);
  console.log(`  Ratio: ${pyFixed(children.length / parents.length, 1)} children per parent`);

  const childVocab = buildVocabulary(children);
  const childIdf = computeIdf(children, childVocab);
  const childEmbeddings = children.map((c) => tfidfEmbed(c, childVocab, childIdf));

  query = "enterprise refund 60 days";
  queryEmb = tfidfEmbed(query, childVocab, childIdf);
  const childResults = vectorSearch(queryEmb, childEmbeddings, 3);

  console.log(`\n  Query: ${query}`);
  console.log(`\n  Matched children:`);
  for (const [idx, score] of childResults) {
    const parentIdx = childToParent.get(idx) as number;
    console.log(`    Child #${idx} (score=${pyFixed(score, 4)}):`);
    console.log(`      Child text: ${children[idx].slice(0, 80)}...`);
    console.log(`      Parent #${parentIdx}: ${parents[parentIdx].slice(0, 80)}...`);
  }

  console.log("\n" + bar);
  console.log("STEP 7: Faithfulness Evaluation");
  console.log(bar);

  const goodAnswer =
    "Enterprise customers receive a 60-day refund window. " +
    "Refunds are pro-rated from the date of cancellation. " +
    "Processing takes 5-7 business days.";
  const badAnswer =
    "Enterprise customers receive a 90-day refund window. " +
    "Refunds are processed instantly. " +
    "There is a $50 processing fee.";
  const contextChunks = hybridSearch("enterprise refund", allChunks, embeddings, vocab, idf, bm25, 3).map(
    ([i]) => allChunks[i],
  );

  const [goodScore, goodUngrounded] = evaluateFaithfulness(goodAnswer, contextChunks);
  const [badScore, badUngrounded] = evaluateFaithfulness(badAnswer, contextChunks);

  console.log(`  Context: ${contextChunks.length} chunks about refund policy`);
  console.log(`\n  Good answer: "${goodAnswer.slice(0, 80)}..."`);
  console.log(`  Faithfulness: ${pyFixed(goodScore, 2)}`);
  if (goodUngrounded.length) {
    console.log(`  Ungrounded claims: ${pyListRepr(goodUngrounded)}`);
  } else {
    console.log(`  All claims grounded in context.`);
  }

  console.log(`\n  Bad answer: "${badAnswer.slice(0, 80)}..."`);
  console.log(`  Faithfulness: ${pyFixed(badScore, 2)}`);
  if (badUngrounded.length) {
    console.log(`  Ungrounded claims:`);
    for (const claim of badUngrounded) console.log(`    - "${claim}"`);
  }

  console.log("\n" + bar);
  console.log("STEP 8: Full Advanced RAG Pipeline Comparison");
  console.log(bar);

  const comparisonQueries: [string, string][] = [
    ["What is the refund policy for enterprise?", "refund"],
    ["What was Q3 revenue?", "earnings"],
    ["How is customer data encrypted?", "security"],
    ["What are the API rate limits?", "api"],
    ["What is the uptime guarantee?", "uptime"],
  ];

  console.log(
    `  ${"Query".padEnd(45)} ${"Vector".padStart(8)} ${"BM25".padStart(8)} ${"Hybrid".padStart(8)} ${"Rerank".padStart(8)}`,
  );
  console.log("  " + "-".repeat(77));

  const hitOrMiss = (idx: number, expected: string) => (chunkSources[idx] === expected ? "HIT" : "miss");

  for (const [q, expectedSource] of comparisonQueries) {
    const qEmb = tfidfEmbed(q, vocab, idf);
    const vecHit = hitOrMiss(vectorSearch(qEmb, embeddings, 1)[0][0], expectedSource);
    const bm25Hit = hitOrMiss(bm25.search(q, 1)[0][0], expectedSource);
    const hybridHit = hitOrMiss(hybridSearch(q, allChunks, embeddings, vocab, idf, bm25, 1)[0][0], expectedSource);
    const hybridPool = hybridSearch(q, allChunks, embeddings, vocab, idf, bm25, 10);
    const rerankHit = hitOrMiss(rerank(q, hybridPool, allChunks)[0][0], expectedSource);
    console.log(
      `  ${q.padEnd(45)} ${vecHit.padStart(8)} ${bm25Hit.padStart(8)} ${hybridHit.padStart(8)} ${rerankHit.padStart(8)}`,
    );
  }

  console.log("\n" + bar);
  console.log("SUMMARY");
  console.log(bar);
  console.log("  Advanced RAG techniques:");
  console.log("    1. BM25 keyword search catches exact term matches");
  console.log("    2. Hybrid search (vector + BM25 + RRF) combines both signals");
  console.log("    3. Reranking scores candidates more carefully with cross-attention");
  console.log("    4. HyDE bridges the query-document vocabulary gap");
  console.log("    5. Parent-child chunking: precise search, rich context");
  console.log("    6. Faithfulness evaluation catches hallucinated claims");
  console.log("\n  In production:");
  console.log("    - Replace TF-IDF with neural embeddings");
  console.log("    - Replace the simple reranker with a cross-encoder model");
  console.log("    - Replace HyDE templates with actual LLM hypothesis generation");
  console.log("    - Add metadata filtering before search");
  console.log("    - Evaluate with Recall@k and faithfulness on a test set");
}

export { evaluateRetrievalRecall, buildRagPrompt };

main();
