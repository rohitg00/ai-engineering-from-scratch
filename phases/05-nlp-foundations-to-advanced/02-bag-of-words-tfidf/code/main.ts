// Lesson: Bag of Words, TF-IDF, and Text Representation (phase 05 / lesson 02)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/02-bag-of-words-tfidf/code/main.ts

const TOKEN_RE = /[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+/g;

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

function pyStrList(items: string[]): string {
  return "[" + items.map((s) => `'${s}'`).join(", ") + "]";
}

function tokenize(text: string): string[] {
  return (text.match(TOKEN_RE) ?? []).map((t) => t.toLowerCase());
}

function buildVocab(docs: string[][]): Map<string, number> {
  const vocab = new Map<string, number>();
  for (const doc of docs) {
    for (const token of doc) {
      if (!vocab.has(token)) vocab.set(token, vocab.size);
    }
  }
  return vocab;
}

function bagOfWords(docs: string[][], vocab: Map<string, number>): number[][] {
  const matrix = docs.map(() => new Array<number>(vocab.size).fill(0));
  docs.forEach((doc, i) => {
    for (const token of doc) {
      const j = vocab.get(token);
      if (j !== undefined) matrix[i][j] += 1;
    }
  });
  return matrix;
}

function documentFrequency(bowMatrix: number[][]): number[] {
  const df = new Array<number>(bowMatrix[0].length).fill(0);
  for (const row of bowMatrix) {
    row.forEach((count, j) => {
      if (count > 0) df[j] += 1;
    });
  }
  return df;
}

function inverseDocumentFrequency(df: number[], nDocs: number): number[] {
  return df.map((d) => Math.log((nDocs + 1) / (d + 1)) + 1);
}

function tfidf(bowMatrix: number[][]): number[][] {
  const nDocs = bowMatrix.length;
  const df = documentFrequency(bowMatrix);
  const idf = inverseDocumentFrequency(df, nDocs);
  const out: number[][] = [];
  for (const row of bowMatrix) {
    const length = row.reduce((a, b) => a + b, 0);
    const tf = row.map((c) => (length ? c / length : 0));
    out.push(tf.map((t, i) => t * idf[i]));
  }
  return out;
}

function l2Normalize(matrix: number[][]): number[][] {
  const out: number[][] = [];
  for (const row of matrix) {
    let s = 0;
    for (const x of row) s += x * x;
    const norm = Math.sqrt(s);
    out.push(row.map((x) => (norm ? x / norm : 0)));
  }
  return out;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i] * b[i];
  return s;
}

function main(): void {
  const raw = [
    "The cat sat on the mat.",
    "The dog sat on the mat.",
    "The cat ran across the room.",
  ];
  const docs = raw.map(tokenize);
  const vocab = buildVocab(docs);
  const bow = bagOfWords(docs, vocab);
  const tfidfVectors = l2Normalize(tfidf(bow));

  const words = [...vocab.keys()].sort((a, b) => vocab.get(a)! - vocab.get(b)!);
  console.log(`vocab: ${pyStrList(words)}`);
  console.log();
  raw.forEach((r, i) => {
    const pretty = tfidfVectors[i].map((x) => pyFixed(x, 2));
    console.log(`d${i}: ${r}`);
    console.log(`    tfidf: ${pyStrList(pretty)}`);
    console.log();
  });

  console.log("cosine similarity matrix:");
  for (let i = 0; i < tfidfVectors.length; i++) {
    const row = tfidfVectors.map((_, j) => pyFixed(cosineSimilarity(tfidfVectors[i], tfidfVectors[j]), 2));
    console.log(`  d${i}: ${pyStrList(row)}`);
  }
}

main();

export {};
