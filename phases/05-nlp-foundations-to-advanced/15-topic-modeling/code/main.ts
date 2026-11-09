// Lesson: Topic Modeling: LDA and BERTopic (phase 05 / lesson 15)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/15-topic-modeling/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/15-topic-modeling/code/main.ts

type Random = () => number;

const SHORT_ALLOWLIST = new Set(["ai", "ml", "nn", "s", "p", "pr"]);

function mulberry32(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

function tokenize(text: string): string[] {
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return tokens.filter((t) => t.length > 2 || /^[0-9]+$/.test(t) || SHORT_ALLOWLIST.has(t));
}

function collapsedGibbsLda(
  docs: string[][],
  nTopics: number,
  nIters = 200,
  alpha = 0.1,
  beta = 0.01,
  seed = 0,
): [string[][], number[][]] {
  if (!Number.isInteger(nTopics) || nTopics <= 0) throw new Error(`n_topics must be a positive int, got ${nTopics}`);
  if (alpha <= 0 || beta <= 0) throw new Error(`alpha and beta must be positive, got alpha=${alpha}, beta=${beta}`);
  if (docs.length === 0) throw new Error("docs must not be empty");

  const rng = mulberry32(seed);
  const vocab = new Map<string, number>();
  for (const doc of docs) {
    for (const w of doc) {
      if (!vocab.has(w)) vocab.set(w, vocab.size);
    }
  }
  const V = vocab.size;
  const D = docs.length;
  if (V === 0) throw new Error("docs produced an empty vocabulary (no tokens found)");
  const indexed = docs.map((doc) => doc.map((w) => vocab.get(w)!));

  const z = indexed.map((doc) => doc.map(() => Math.floor(rng() * nTopics)));

  const ndt = Array.from({ length: D }, () => new Array<number>(nTopics).fill(0));
  const ntw = Array.from({ length: nTopics }, () => new Array<number>(V).fill(0));
  const nt = new Array<number>(nTopics).fill(0);

  for (let d = 0; d < D; d++) {
    indexed[d].forEach((w, i) => {
      const t = z[d][i];
      ndt[d][t] += 1;
      ntw[t][w] += 1;
      nt[t] += 1;
    });
  }

  for (let iter = 0; iter < nIters; iter++) {
    for (let d = 0; d < D; d++) {
      indexed[d].forEach((w, i) => {
        const t = z[d][i];
        ndt[d][t] -= 1;
        ntw[t][w] -= 1;
        nt[t] -= 1;

        const probs: number[] = [];
        for (let k = 0; k < nTopics; k++) {
          probs.push(((ndt[d][k] + alpha) * (ntw[k][w] + beta)) / (nt[k] + V * beta));
        }
        let total = 0;
        for (const p of probs) total += p;
        const r = rng() * total;
        let acc = 0.0;
        let newT = 0;
        for (let k = 0; k < probs.length; k++) {
          acc += probs[k];
          if (r <= acc) {
            newT = k;
            break;
          }
        }

        z[d][i] = newT;
        ndt[d][newT] += 1;
        ntw[newT][w] += 1;
        nt[newT] += 1;
      });
    }
  }

  const invVocab = new Map<number, string>();
  for (const [w, i] of vocab) invVocab.set(i, w);
  const topics: string[][] = [];
  for (let k = 0; k < nTopics; k++) {
    const topIds = [...Array(V).keys()].sort((a, b) => ntw[k][b] - ntw[k][a]).slice(0, 8);
    topics.push(topIds.map((i) => invVocab.get(i)!));
  }
  const docTopic: number[][] = [];
  for (let d = 0; d < D; d++) {
    let s = 0;
    for (const c of ndt[d]) s += c;
    const total = s + nTopics * alpha;
    docTopic.push(ndt[d].map((c) => (c + alpha) / total));
  }

  return [topics, docTopic];
}

function main(): void {
  const docsRaw = [
    "stocks rose after the fed cut interest rates",
    "bond yields fell as investors bought treasuries",
    "the s p 500 hit a new high on earnings reports",
    "chip makers reported strong demand for ai accelerators",
    "openai released a new model with multimodal reasoning",
    "deep learning researchers published a paper on efficient attention",
    "the senate passed a bill on healthcare spending",
    "the president signed new tariffs on steel imports",
    "congress debated a tax cut for small businesses",
  ];
  const docs = docsRaw.map(tokenize);
  const [topics, docTopic] = collapsedGibbsLda(docs, 3, 300, 0.1, 0.01, 42);

  console.log("=== LDA topics (collapsed Gibbs, 300 iters) ===");
  topics.forEach((words, k) => console.log(`  topic ${k}: ${words.join(", ")}`));
  console.log();
  console.log("=== document mixtures ===");
  docsRaw.forEach((docRaw, i) => {
    const pretty = docTopic[i].map((p) => pyFixed(p, 2));
    console.log(`  [${pretty.join(", ")}]  ${docRaw.slice(0, 50)}`);
  });
}

main();

export {};
