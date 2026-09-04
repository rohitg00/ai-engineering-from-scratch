// Embeddings + semantic search in TypeScript: TF-IDF embedder, cosine /
// dot / euclidean / hamming metrics, vector index, Matryoshka truncation,
// binary quantization. Mirrors code/embeddings.py.
// Sources:
//   https://platform.openai.com/docs/guides/embeddings
//   https://docs.voyageai.com/docs/embeddings
//   https://huggingface.co/BAAI/bge-m3

type Vec = readonly number[];
type Doc = { readonly text: string; readonly source?: string };

function chunkText(text: string, chunkSize = 200, overlap = 50): string[] {
  if (chunkSize <= 0) throw new Error("chunkSize must be positive");
  if (overlap >= chunkSize) throw new Error("overlap must be less than chunkSize");
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const out: string[] = [];
  let start = 0;
  while (start < words.length) {
    out.push(words.slice(start, start + chunkSize).join(" "));
    start += chunkSize - overlap;
  }
  return out;
}

function chunkBySentences(text: string, maxChunkTokens = 200): string[] {
  const flat = text.replace(/\n/g, " ");
  const sentences = flat
    .split(".")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s + ".");
  const out: string[] = [];
  let current: string[] = [];
  let currentLen = 0;
  for (const sentence of sentences) {
    const slen = sentence.split(/\s+/).length;
    if (currentLen + slen > maxChunkTokens && current.length > 0) {
      out.push(current.join(" "));
      current = [];
      currentLen = 0;
    }
    current.push(sentence);
    currentLen += slen;
  }
  if (current.length > 0) out.push(current.join(" "));
  return out;
}

class TfIdfEmbedder {
  private vocab: string[] = [];
  private idf: number[] = [];
  private wordToIdx: Map<string, number> = new Map();

  fit(documents: readonly string[]): void {
    const set = new Set<string>();
    for (const doc of documents) {
      for (const w of doc.toLowerCase().split(/\s+/)) {
        if (w.length > 0) set.add(w);
      }
    }
    this.vocab = [...set].sort();
    this.wordToIdx = new Map(this.vocab.map((w, i) => [w, i] as const));
    const n = documents.length;
    const docWordSets = documents.map((doc) => new Set(doc.toLowerCase().split(/\s+/)));
    this.idf = this.vocab.map((word) => {
      const docCount = docWordSets.reduce((acc, wordSet) => acc + (wordSet.has(word) ? 1 : 0), 0);
      return Math.log((n + 1) / (docCount + 1)) + 1;
    });
  }

  embed(text: string): Vec {
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    const total = words.length === 0 ? 1 : words.length;
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    const vec = new Array<number>(this.vocab.length).fill(0);
    for (const [word, freq] of counts) {
      const idx = this.wordToIdx.get(word);
      if (idx !== undefined) {
        const tf = freq / total;
        vec[idx] = tf * this.idf[idx];
      }
    }
    const norm = Math.sqrt(vec.reduce((a, v) => a + v * v, 0));
    return norm > 0 ? vec.map((v) => v / norm) : vec;
  }

  embedBatch(texts: readonly string[]): Vec[] {
    return texts.map((t) => this.embed(t));
  }

  get dim(): number {
    return this.vocab.length;
  }

  get size(): number {
    return this.vocab.length;
  }
}

function cosineSimilarity(a: Vec, b: Vec): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function dotProduct(a: Vec, b: Vec): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) s += a[i] * b[i];
  return s;
}

function euclideanDistance(a: Vec, b: Vec): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

function binarize(vec: Vec): Uint8Array {
  const out = new Uint8Array(vec.length);
  for (let i = 0; i < vec.length; i += 1) out[i] = vec[i] > 0 ? 1 : 0;
  return out;
}

function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  let d = 0;
  for (let i = 0; i < n; i += 1) if (a[i] !== b[i]) d += 1;
  return d;
}

type Metric = "cosine" | "dot" | "euclidean" | "hamming";

type IndexEntry = { vector: Vec; text: string; metadata: Record<string, string>; index: number };
type SearchHit = { text: string; score: number; metadata: Record<string, string>; index: number };

class VectorIndex {
  private entries: IndexEntry[] = [];

  add(vector: Vec, text: string, metadata: Record<string, string> = {}): void {
    this.entries.push({ vector, text, metadata, index: this.entries.length });
  }

  search(query: Vec, topK = 5, metric: Metric = "cosine"): SearchHit[] {
    const qBin = metric === "hamming" ? binarize(query) : undefined;
    const scored = this.entries.map((e) => {
      let score: number;
      switch (metric) {
        case "cosine":
          score = cosineSimilarity(query, e.vector);
          break;
        case "dot":
          score = dotProduct(query, e.vector);
          break;
        case "euclidean":
          score = -euclideanDistance(query, e.vector);
          break;
        case "hamming":
          score = -hammingDistance(qBin as Uint8Array, binarize(e.vector));
          break;
      }
      return { text: e.text, score, metadata: e.metadata, index: e.index };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  get size(): number {
    return this.entries.length;
  }
}

class SemanticSearchEngine {
  readonly embedder = new TfIdfEmbedder();
  readonly index = new VectorIndex();

  constructor(private chunkSize = 200, private overlap = 50) {}

  indexDocuments(docs: readonly Doc[]): number {
    const allChunks: string[] = [];
    const allSources: string[] = [];
    docs.forEach((doc, i) => {
      const chunks = chunkText(doc.text, this.chunkSize, this.overlap);
      for (const c of chunks) {
        allChunks.push(c);
        allSources.push(doc.source ?? "doc_" + i);
      }
    });
    this.embedder.fit(allChunks);
    allChunks.forEach((chunk, i) => {
      this.index.add(this.embedder.embed(chunk), chunk, { source: allSources[i] });
    });
    return allChunks.length;
  }

  search(query: string, topK = 5, metric: Metric = "cosine"): SearchHit[] {
    return this.index.search(this.embedder.embed(query), topK, metric);
  }
}

function truncateEmbedding(vec: Vec, dimensions: number): Vec {
  const t = vec.slice(0, dimensions);
  const norm = Math.sqrt(t.reduce((a, v) => a + v * v, 0));
  return norm > 0 ? t.map((v) => v / norm) : t;
}

const SAMPLE_DOCS: readonly Doc[] = [
  {
    source: "refund-policy.md",
    text:
      "Acme Corp Refund Policy. Standard plan customers are eligible for a full refund within 30 days of purchase. Enterprise plan customers receive an extended 60-day refund window with pro-rated refunds calculated from the date of cancellation. Refunds are processed within 5-7 business days and returned to the original payment method.",
  },
  {
    source: "product-overview.md",
    text:
      "Acme Corp Product Overview. Three product tiers: Starter, Professional, Enterprise. Starter includes basic features for individual users at $29 per month. Professional adds team collaboration, advanced analytics, and priority support for $99 per month per user. Enterprise pricing is custom and starts at $500 per month.",
  },
  {
    source: "security.md",
    text:
      "Acme Corp Security Practices. SOC 2 Type II compliance and annual third-party security audits. All data encrypted at rest using AES-256 and in transit using TLS 1.3. Customer data is stored in isolated tenants within AWS us-east-1 and eu-west-1 regions.",
  },
  {
    source: "api-docs.md",
    text:
      "Acme Corp API Documentation. REST API with JSON request and response bodies. Authentication via Bearer tokens issued through OAuth 2.0. Rate limits are 100 requests per minute for Starter, 1000 for Professional, and 10000 for Enterprise. Exceeding the rate limit returns HTTP 429 with a Retry-After header.",
  },
  {
    source: "uptime-sla.md",
    text:
      "Acme Corp Uptime and Reliability. 99.9% uptime for Professional plans and 99.99% for Enterprise plans. If uptime falls below the guaranteed level, customers receive service credits: 10% credit for each 0.1% below the SLA threshold, up to a maximum of 30% of the monthly fee.",
  },
];

function main(): void {
  console.log("=".repeat(60));
  console.log("STEP 1: Chunking");
  console.log("=".repeat(60));
  const sample = SAMPLE_DOCS[0].text;
  const fixedChunks = chunkText(sample, 30, 10);
  const sentenceChunks = chunkBySentences(sample, 30);
  console.log("  Document words: " + sample.split(/\s+/).length);
  console.log("  Fixed chunks (30 / 10): " + fixedChunks.length);
  console.log("  Sentence chunks (max 30): " + sentenceChunks.length);

  console.log("\n" + "=".repeat(60));
  console.log("STEP 2: Embedding");
  console.log("=".repeat(60));
  const miniDocs: readonly string[] = [
    "The cat sat on the mat",
    "The dog sat on the rug",
    "Machine learning is a branch of artificial intelligence",
    "Payment transaction was declined by the bank",
    "My credit card charge did not go through",
  ];
  const embedder = new TfIdfEmbedder();
  embedder.fit(miniDocs);
  const embeddings = embedder.embedBatch(miniDocs);
  console.log("  Vocabulary size: " + embedder.dim);
  console.log("  Embedding dimensions: " + embeddings[0].length);
  miniDocs.forEach((doc, i) => {
    const nz = embeddings[i].filter((v) => v !== 0).length;
    console.log("    [" + i + "] " + JSON.stringify(doc.slice(0, 40)) + " -> " + nz + " non-zero");
  });

  console.log("\n" + "=".repeat(60));
  console.log("STEP 3: Similarity Metrics");
  console.log("=".repeat(60));
  const pairs: ReadonlyArray<{ i: number; j: number; desc: string }> = [
    { i: 0, j: 1, desc: "cat/mat vs dog/rug" },
    { i: 0, j: 2, desc: "cat/mat vs ML" },
    { i: 3, j: 4, desc: "payment declined vs charge didn't go through" },
    { i: 2, j: 3, desc: "ML vs payment declined" },
  ];
  for (const { i, j, desc } of pairs) {
    const c = cosineSimilarity(embeddings[i], embeddings[j]);
    const d = dotProduct(embeddings[i], embeddings[j]);
    const e = euclideanDistance(embeddings[i], embeddings[j]);
    console.log("\n  " + desc);
    console.log("    Cosine:    " + c.toFixed(4));
    console.log("    Dot:       " + d.toFixed(4));
    console.log("    Euclidean: " + e.toFixed(4));
  }

  console.log("\n" + "=".repeat(60));
  console.log("STEP 4: Semantic Search");
  console.log("=".repeat(60));
  const engine = new SemanticSearchEngine(50, 10);
  const nChunks = engine.indexDocuments(SAMPLE_DOCS);
  console.log("  Indexed " + SAMPLE_DOCS.length + " documents into " + nChunks + " chunks");
  console.log("  Vocabulary size: " + engine.embedder.dim);

  const queries = [
    "What is the refund policy for enterprise customers?",
    "What are the API rate limits?",
    "How is customer data encrypted?",
    "What happens if uptime falls below the SLA?",
    "How much does the Professional plan cost?",
  ];
  for (const q of queries) {
    console.log("\n  Query: " + JSON.stringify(q));
    const results = engine.search(q, 3);
    for (const r of results) {
      console.log("    [" + r.metadata.source + "] score=" + r.score.toFixed(4) + " | " + r.text.slice(0, 70) + "...");
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("STEP 5: Matryoshka Truncation");
  console.log("=".repeat(60));
  const fullDim = engine.embedder.dim;
  const qFull = engine.embedder.embed("refund policy enterprise");
  const dFull = engine.embedder.embed(SAMPLE_DOCS[0].text.slice(0, 200));
  for (const frac of [1.0, 0.5, 0.25, 0.1] as const) {
    const dims = Math.max(1, Math.floor(fullDim * frac));
    const sim = cosineSimilarity(truncateEmbedding(qFull, dims), truncateEmbedding(dFull, dims));
    console.log("  dims=" + dims.toString().padStart(4) + " (" + (frac * 100).toFixed(1) + "%): cosine=" + sim.toFixed(4));
  }

  console.log("\n" + "=".repeat(60));
  console.log("STEP 6: Binary Quantization");
  console.log("=".repeat(60));
  const qVec = engine.embedder.embed("API rate limits");
  const full = engine.index.search(qVec, 5, "cosine");
  const binary = engine.index.search(qVec, 5, "hamming");
  const fullIds = new Set(full.map((r) => r.index));
  const binIds = new Set(binary.map((r) => r.index));
  const overlap = [...fullIds].filter((x) => binIds.has(x)).length;
  console.log("  Full top-5 indices:   " + [...fullIds].join(","));
  console.log("  Binary top-5 indices: " + [...binIds].join(","));
  console.log("  Overlap: " + overlap + "/5");
  const storageFull = fullDim * 4;
  const storageBinary = Math.ceil(fullDim / 8);
  console.log("  Float32: " + storageFull + " bytes, Binary: " + storageBinary + " bytes (" + (storageFull / storageBinary).toFixed(0) + "x)");

  console.log("\n  In production, replace TfIdfEmbedder with:");
  console.log("    OpenAI text-embedding-3-small (1536d)");
  console.log("    BGE-M3 (1024d, open)");
  console.log("    Voyage-3 (1024d)");
}

main();
