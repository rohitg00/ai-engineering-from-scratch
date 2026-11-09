// Lesson: Literature Retrieval (phase 19 / lesson 51)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/51-literature-retrieval/docs/en.md
// Run: npx tsx phases/19-capstone-projects/51-literature-retrieval/code/main.ts

import { performance } from "node:perf_hooks";

class PyFloat {
  constructor(readonly v: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

const fl = (v: number): PyFloat => new PyFloat(v);

function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mant, expStr] = x.toExponential().split("e");
  const exp = Number(expStr);
  const neg = mant.startsWith("-");
  const digits = mant.replace("-", "").replace(".", "");
  let body: string;
  if (exp < -4 || exp >= 16) {
    const frac = digits.length > 1 ? "." + digits.slice(1) : "";
    body = digits[0] + frac + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
  } else if (exp < 0) {
    body = "0." + "0".repeat(-exp - 1) + digits;
  } else if (digits.length <= exp + 1) {
    body = digits + "0".repeat(exp + 1 - digits.length) + ".0";
  } else {
    body = digits.slice(0, exp + 1) + "." + digits.slice(exp + 1);
  }
  return (neg ? "-" : "") + body;
}

function fmtFixed(x: number, n: number): string {
  const neg = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  const wide = a.toFixed(Math.min(100, n + 30));
  const dot = wide.indexOf(".");
  const tail = wide.slice(dot + 1 + n);
  let out = a.toFixed(n);
  if (/^50*$/.test(tail)) {
    const head = wide.slice(0, dot + 1 + n);
    const trimmed = n === 0 ? head.slice(0, -1) : head;
    if (Number(trimmed[trimmed.length - 1]) % 2 === 0) out = trimmed;
  }
  return (neg ? "-" : "") + out;
}

function pyRound(x: number, n: number): number {
  return Number(fmtFixed(x, n));
}

function jsonStr(s: string): string {
  return (
    '"' +
    s.replace(/[\\"\u0000-\u001f\u007f-￿]/g, (c) => {
      if (c === '"') return '\\"';
      if (c === "\\") return "\\\\";
      if (c === "\n") return "\\n";
      if (c === "\r") return "\\r";
      if (c === "\t") return "\\t";
      if (c === "\b") return "\\b";
      if (c === "\f") return "\\f";
      return "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
    }) +
    '"'
  );
}

function pyDumps(v: Json, indent: number | null = null, level = 0): string {
  if (v === null) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (v instanceof PyFloat) return pyFloatRepr(v.v);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : pyFloatRepr(v);
  if (typeof v === "string") return jsonStr(v);
  let open: string;
  let close: string;
  let items: string[];
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    open = "[";
    close = "]";
    items = v.map((x) => pyDumps(x, indent, level + 1));
  } else {
    const keys = Object.keys(v);
    if (keys.length === 0) return "{}";
    open = "{";
    close = "}";
    items = keys.map((k) => jsonStr(k) + ": " + pyDumps(v[k], indent, level + 1));
  }
  if (indent === null) return open + items.join(", ") + close;
  const pad = "\n" + " ".repeat(indent * (level + 1));
  return open + pad + items.join("," + pad) + "\n" + " ".repeat(indent * level) + close;
}

class Paper {
  constructor(
    public id: string,
    public title: string,
    public abstract: string,
    public year: number,
    public authors: string[],
    public references: string[] = [],
    public citations: string[] = [],
    public source = "merged",
  ) {}

  toDict(): Obj {
    return {
      id: this.id,
      title: this.title,
      year: this.year,
      authors: [...this.authors],
      references: [...this.references],
      citations: [...this.citations],
      source: this.source,
    };
  }
}

function tokenise(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

class BM25Index {
  private docLens = new Map<string, number>();
  private termFreq = new Map<string, Map<string, number>>();
  private docFreq = new Map<string, number>();
  private avgdl = 0.0;
  private nDocs = 0;

  constructor(
    public k1 = 1.5,
    public b = 0.75,
  ) {}

  add(docId: string, text: string): void {
    const tokens = tokenise(text);
    this.docLens.set(docId, tokens.length);
    const counts = new Map<string, number>();
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const [term, count] of counts) {
      let row = this.termFreq.get(term);
      if (row === undefined) {
        row = new Map();
        this.termFreq.set(term, row);
      }
      row.set(docId, count);
      this.docFreq.set(term, (this.docFreq.get(term) ?? 0) + 1);
    }
    this.nDocs += 1;
  }

  finalise(): void {
    if (this.nDocs === 0) {
      this.avgdl = 0.0;
      return;
    }
    let sum = 0;
    for (const v of this.docLens.values()) sum += v;
    this.avgdl = sum / this.nDocs;
  }

  idf(term: string): number {
    const df = this.docFreq.get(term) ?? 0;
    return Math.log((this.nDocs - df + 0.5) / (df + 0.5) + 1.0);
  }

  score(docId: string, queryTerms: string[]): number {
    const dl = this.docLens.get(docId);
    if (dl === undefined || this.avgdl === 0.0) return 0.0;
    let total = 0.0;
    for (const term of queryTerms) {
      const f = this.termFreq.get(term)?.get(docId) ?? 0;
      if (f === 0) continue;
      const tfNorm = (f * (this.k1 + 1.0)) / (f + this.k1 * (1.0 - this.b + (this.b * dl) / this.avgdl));
      total += this.idf(term) * tfNorm;
    }
    return total;
  }

  search(query: string, topK = 10): [string, number][] {
    const terms = tokenise(query);
    if (!terms.length) return [];
    const candidateIds = new Set<string>();
    for (const term of terms) {
      for (const id of this.termFreq.get(term)?.keys() ?? []) candidateIds.add(id);
    }
    const scores: [string, number][] = [...candidateIds].map((id) => [id, this.score(id, terms)]);
    const ranked = scores.sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
    return ranked.slice(0, topK).filter(([, s]) => s > 0.0);
  }
}

class CitationGraph {
  private forward = new Map<string, string[]>();
  private backward = new Map<string, string[]>();

  addPaper(paper: Paper): void {
    this.forward.set(paper.id, [...paper.references]);
    this.backward.set(paper.id, [...paper.citations]);
  }

  neighbours(docId: string): string[] {
    return [...(this.forward.get(docId) ?? []), ...(this.backward.get(docId) ?? [])];
  }

  expand(seeds: string[], maxHops = 2): Map<string, number> {
    const distance = new Map<string, number>(seeds.map((s) => [s, 0]));
    const queue: string[] = [...seeds];
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      const d = distance.get(current) ?? 0;
      if (d >= maxHops) continue;
      for (const neighbour of this.neighbours(current)) {
        if (distance.has(neighbour)) continue;
        distance.set(neighbour, d + 1);
        queue.push(neighbour);
      }
    }
    return distance;
  }
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

class ArxivMockClient {
  private papers: Map<string, Paper>;

  constructor(corpus: Paper[]) {
    this.papers = new Map(corpus.map((p) => [p.id, p]));
  }

  search(query: string): Paper[] {
    const terms = new Set(tokenise(query));
    const hits: Paper[] = [];
    for (const paper of this.papers.values()) {
      const haystack = new Set(tokenise(paper.title + " " + paper.abstract));
      if (overlaps(terms, haystack)) {
        hits.push(new Paper(paper.id, paper.title, paper.abstract, paper.year, [...paper.authors], [], [], "arxiv"));
      }
    }
    return hits;
  }
}

class SemanticScholarMockClient {
  private papers: Map<string, Paper>;

  constructor(corpus: Paper[]) {
    this.papers = new Map(corpus.map((p) => [p.id, p]));
  }

  search(query: string): Paper[] {
    const terms = new Set(tokenise(query));
    const hits: Paper[] = [];
    for (const paper of this.papers.values()) {
      const haystack = new Set(tokenise(paper.title + " " + paper.abstract));
      if (overlaps(terms, haystack)) {
        hits.push(
          new Paper(paper.id, paper.title, paper.abstract, paper.year, [...paper.authors], [...paper.references], [...paper.citations], "s2"),
        );
      }
    }
    return hits;
  }

  fetch(paperId: string): Paper | null {
    const paper = this.papers.get(paperId);
    if (paper === undefined) return null;
    return new Paper(paper.id, paper.title, paper.abstract, paper.year, [...paper.authors], [...paper.references], [...paper.citations], "s2");
  }
}

class RetrievalConfig {
  top_k_lexical = 10;
  max_hops = 2;
  w_bm25 = 0.5;
  w_graph = 0.3;
  w_recency = 0.2;

  constructor(init: Partial<RetrievalConfig> = {}) {
    Object.assign(this, init);
    if (this.max_hops > 2) this.max_hops = 2;
  }
}

class RankedPaper {
  constructor(
    public paper: Paper,
    public bm25_score: number,
    public graph_distance: number | null,
    public recency_score: number,
    public final_score: number,
  ) {}

  toDict(): Obj {
    return {
      id: this.paper.id,
      title: this.paper.title,
      year: this.paper.year,
      bm25_score: fl(pyRound(this.bm25_score, 4)),
      graph_distance: this.graph_distance,
      recency_score: fl(pyRound(this.recency_score, 4)),
      final_score: fl(pyRound(this.final_score, 4)),
    };
  }
}

class RetrievalResult {
  constructor(
    public ranked: RankedPaper[],
    public hit_count: number,
    public average_score: number,
    public top_score: number,
    public wall_time_ms: number,
  ) {}

  toDict(): Obj {
    return {
      hit_count: this.hit_count,
      average_score: fl(pyRound(this.average_score, 4)),
      top_score: fl(pyRound(this.top_score, 4)),
      wall_time_ms: fl(pyRound(this.wall_time_ms, 3)),
      ranked: this.ranked.map((r) => r.toDict()),
    };
  }
}

class RetrievalClient {
  private cfg: RetrievalConfig;
  private corpus: Map<string, Paper>;
  private index = new BM25Index();
  private graph = new CitationGraph();
  private yearMin: number;
  private yearMax: number;

  constructor(
    private arxiv: ArxivMockClient,
    private s2: SemanticScholarMockClient,
    corpus: Paper[],
    config: RetrievalConfig | null = null,
  ) {
    this.cfg = config ?? new RetrievalConfig();
    this.corpus = new Map(corpus.map((p) => [p.id, p]));
    for (const paper of corpus) this.index.add(paper.id, paper.title + " " + paper.abstract);
    this.index.finalise();
    for (const paper of corpus) this.graph.addPaper(paper);
    const years = corpus.map((p) => p.year);
    this.yearMin = years.length ? Math.min(...years) : 0;
    this.yearMax = years.length ? Math.max(...years) : 0;
  }

  private recency(year: number): number {
    if (this.yearMax === this.yearMin) return 1.0;
    return (year - this.yearMin) / (this.yearMax - this.yearMin);
  }

  private graphScore(distance: number | null): number {
    if (distance === null) return 0.0;
    if (distance === 0) return 1.0;
    if (distance === 1) return 0.6;
    if (distance === 2) return 0.3;
    return 0.0;
  }

  mergePaper(lexical: Paper | null, s2: Paper | null): Paper {
    const ref = (lexical ?? s2) as Paper;
    const base = this.corpus.get(ref.id) as Paper;
    return new Paper(base.id, base.title, base.abstract, base.year, [...base.authors], [...base.references], [...base.citations], "merged");
  }

  search(query: string): RetrievalResult {
    const start = performance.now();
    const terms = tokenise(query);
    if (!terms.length) return new RetrievalResult([], 0, 0.0, 0.0, performance.now() - start);
    const lexicalHits = this.index.search(query, this.cfg.top_k_lexical);
    const seedIds = lexicalHits.map(([docId]) => docId);
    const graphDistance = this.graph.expand(seedIds, this.cfg.max_hops);
    const mergedIds = new Set([...seedIds, ...graphDistance.keys()]);
    const maxBm25 = lexicalHits.length ? Math.max(...lexicalHits.map(([, s]) => s)) : 0.0;
    const ranked: RankedPaper[] = [];
    for (const docId of mergedIds) {
      const paper = this.corpus.get(docId);
      if (paper === undefined) continue;
      const bm25 = this.index.score(docId, terms);
      const distance = graphDistance.get(docId) ?? null;
      const graphScore = this.graphScore(distance);
      const bm25Norm = maxBm25 > 0 ? bm25 / maxBm25 : 0.0;
      const recency = this.recency(paper.year);
      const final = this.cfg.w_bm25 * bm25Norm + this.cfg.w_graph * graphScore + this.cfg.w_recency * recency;
      const mergedPaper = new Paper(
        paper.id,
        paper.title,
        paper.abstract,
        paper.year,
        [...paper.authors],
        [...paper.references],
        [...paper.citations],
        "merged",
      );
      ranked.push(new RankedPaper(mergedPaper, bm25, distance, recency, final));
    }
    ranked.sort(
      (x, y) => y.final_score - x.final_score || (x.paper.id < y.paper.id ? -1 : x.paper.id > y.paper.id ? 1 : 0),
    );
    const scores = ranked.map((r) => r.final_score);
    const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0.0;
    const top = scores.length ? Math.max(...scores) : 0.0;
    const wallMs = performance.now() - start;
    return new RetrievalResult(ranked, ranked.length, avg, top, wallMs);
  }
}

function titleCase(s: string): string {
  return s.replace(/[A-Za-z]+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function pid(n: number): string {
  return `p${String(n).padStart(3, "0")}`;
}

function buildCorpus(): Paper[] {
  const topics: [string, string][] = [
    ["attention sparsity", "attention sparsity head pruning routing block"],
    ["retrieval augmentation", "retrieval augmentation embedding index passage"],
    ["low rank adapters", "low rank adapter parameter fine tuning"],
    ["dataset distillation", "dataset distillation synthetic compact training"],
    ["evaluation harnesses", "evaluation harness benchmark task accuracy"],
  ];
  const papers: Paper[] = [];
  topics.forEach(([label, terms], topicIdx) => {
    for (let i = 0; i < 20; i++) {
      const id = pid(topicIdx * 20 + i + 1);
      const title = `${titleCase(label)} study ${i + 1}`;
      const abstract =
        `This work investigates ${label} and reports on ${terms}. ` +
        `We measure perplexity, accuracy, and wall time on small transformer baselines. ` +
        `The study ${i + 1} extends prior findings in topic ${topicIdx + 1}.`;
      const year = 2018 + (i % 8);
      const authors = [`Author ${topicIdx + 1}-${i + 1}`, `Coauthor ${topicIdx + 1}-${i + 1}`];
      papers.push(new Paper(id, title, abstract, year, authors));
    }
  });
  const byId = new Map(papers.map((p) => [p.id, p]));
  const get = (id: string): Paper => byId.get(id) as Paper;
  for (let topicIdx = 0; topicIdx < 5; topicIdx++) {
    for (let i = 0; i < 20; i++) {
      const id = pid(topicIdx * 20 + i + 1);
      const paper = get(id);
      if (i >= 2) {
        const anchorA = pid(topicIdx * 20 + 1);
        const anchorB = pid(topicIdx * 20 + 2);
        paper.references.push(anchorA, anchorB);
        get(anchorA).citations.push(id);
        get(anchorB).citations.push(id);
      }
      if (i === 5) {
        const cross = pid(((topicIdx + 1) % 5) * 20 + 1);
        paper.references.push(cross);
        get(cross).citations.push(id);
      }
    }
  }
  return papers;
}

function buildClient(config: RetrievalConfig | null = null): RetrievalClient {
  const corpus = buildCorpus();
  return new RetrievalClient(new ArxivMockClient(corpus), new SemanticScholarMockClient(corpus), corpus, config);
}

function demo(): void {
  const client = buildClient(new RetrievalConfig({ top_k_lexical: 5, max_hops: 2 }));
  const result = client.search("attention sparsity head pruning");
  console.log(
    pyDumps(
      {
        hit_count: result.hit_count,
        top_score: fl(pyRound(result.top_score, 4)),
        top_three: result.ranked.slice(0, 3).map((r) => r.toDict()),
      },
      2,
    ),
  );
}

demo();
