// Lesson: Information Retrieval and Search (phase 05 / lesson 14)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/14-information-retrieval-search/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/14-information-retrieval-search/code/main.ts

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

class BM25 {
  corpus: string[][];
  k1: number;
  b: number;
  nDocs: number;
  avgDl: number;
  df: Map<string, number>;

  constructor(corpus: string[], k1 = 1.5, b = 0.75) {
    if (corpus.length === 0) throw new Error("BM25 corpus must not be empty");
    this.corpus = corpus.map(tokenize);
    this.k1 = k1;
    this.b = b;
    this.nDocs = this.corpus.length;
    let totalLen = 0;
    for (const d of this.corpus) totalLen += d.length;
    this.avgDl = totalLen / this.nDocs;
    this.df = new Map();
    for (const doc of this.corpus) {
      for (const term of new Set(doc)) this.df.set(term, (this.df.get(term) ?? 0) + 1);
    }
  }

  idf(term: string): number {
    const n = this.df.get(term) ?? 0;
    return Math.log(1 + (this.nDocs - n + 0.5) / (n + 0.5));
  }

  score(query: string, docIdx: number): number {
    const qTokens = tokenize(query);
    const doc = this.corpus[docIdx];
    const dl = doc.length;
    const freq = new Map<string, number>();
    for (const t of doc) freq.set(t, (freq.get(t) ?? 0) + 1);
    let total = 0.0;
    for (const term of qTokens) {
      const f = freq.get(term) ?? 0;
      if (f === 0) continue;
      const num = f * (this.k1 + 1);
      const den = f + this.k1 * (1 - this.b + (this.b * dl) / this.avgDl);
      total += (this.idf(term) * num) / den;
    }
    return total;
  }

  rank(query: string, topK = 10): Scored[] {
    const scored: Scored[] = [];
    for (let i = 0; i < this.nDocs; i++) scored.push([this.score(query, i), i]);
    sortTuplesDesc(scored);
    return scored.slice(0, topK);
  }
}

function reciprocalRankFusion(rankings: Scored[][], k = 60): Scored[] {
  const scores = new Map<number, number>();
  for (const ranking of rankings) {
    ranking.forEach(([, docIdx], rank) => {
      scores.set(docIdx, (scores.get(docIdx) ?? 0.0) + 1.0 / (k + rank + 1));
    });
  }
  const fused = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  return fused.map(([docIdx, score]): Scored => [score, docIdx]);
}

function fakeDenseRank(query: string, corpus: string[], topK = 5): Scored[] {
  const qTokens = new Set(tokenize(query));
  const scored: Scored[] = [];
  corpus.forEach((d, i) => {
    const dTokens = new Set(tokenize(d));
    if (dTokens.size === 0 || qTokens.size === 0) {
      scored.push([0.0, i]);
      return;
    }
    let inter = 0;
    for (const t of qTokens) if (dTokens.has(t)) inter++;
    const union = qTokens.size + dTokens.size - inter;
    const jaccard = inter / union;
    let expansion = 0.0;
    for (const qt of qTokens) {
      for (const dt of dTokens) {
        if (qt !== dt && Math.min(qt.length, dt.length) >= 4 && (dt.includes(qt) || qt.includes(dt))) {
          expansion += 0.15;
        }
      }
    }
    scored.push([jaccard + expansion, i]);
  });
  sortTuplesDesc(scored);
  return scored.slice(0, topK);
}

function main(): void {
  const corpus = [
    "Apple Inc. released the first iPhone on June 29, 2007.",
    "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
    "Android launched in 2008 as Google's mobile smartphone operating system.",
    "The first iPod was released by Apple in 2001.",
    "Section 420 of the Indian Penal Code covers cheating and dishonest inducement.",
    "Fraud refers to wrongful or criminal deception intended to result in financial gain.",
    "Cheating someone to obtain money is a criminal offence in most jurisdictions.",
  ];

  const bm25 = new BM25(corpus);

  const query = "what happens if someone lies to get money";
  console.log(`query: ${query}\n`);

  const sparse = bm25.rank(query, 5);
  console.log("BM25 (sparse):");
  for (const [score, idx] of sparse) console.log(`  ${pyFixed(score, 3)}  ${corpus[idx]}`);
  console.log();

  const dense = fakeDenseRank(query, corpus, 5);
  console.log("fake-dense (shape demonstration):");
  for (const [score, idx] of dense) console.log(`  ${pyFixed(score, 3)}  ${corpus[idx]}`);
  console.log();

  const fused = reciprocalRankFusion([sparse, dense]).slice(0, 5);
  console.log("RRF fused:");
  for (const [score, idx] of fused) console.log(`  ${pyFixed(score, 4)}  ${corpus[idx]}`);

  console.log();
  console.log("note: this code uses a toy 'fake-dense' ranker for teaching.");
  console.log("real dense retrieval needs a sentence-transformer encoder; see docs/en.md.");
}

main();

export {};
