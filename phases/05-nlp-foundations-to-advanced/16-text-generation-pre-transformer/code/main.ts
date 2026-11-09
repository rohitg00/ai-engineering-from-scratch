// Lesson: Text Generation Before Transformers: N-gram Language Models (phase 05 / lesson 16)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/16-text-generation-pre-transformer/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/16-text-generation-pre-transformer/code/main.ts

type Random = () => number;
type ProbFn = (prev: string, w: string) => number;

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

function key(prev: string, w: string): string {
  return prev + "\u0000" + w;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replaceAll(".", " .")
    .replaceAll(",", " ,")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function trainBigrams(sentences: string[][]): [Map<string, number>, Map<string, number>, Map<string, Set<string>>] {
  const bigrams = new Map<string, number>();
  const unigrams = new Map<string, number>();
  const unigramContexts = new Map<string, Set<string>>();
  for (const sentence of sentences) {
    const padded = ["<s>", ...sentence, "</s>"];
    padded.forEach((w, i) => {
      unigrams.set(w, (unigrams.get(w) ?? 0) + 1);
      if (i > 0) {
        const prev = padded[i - 1];
        bigrams.set(key(prev, w), (bigrams.get(key(prev, w)) ?? 0) + 1);
        if (!unigramContexts.has(w)) unigramContexts.set(w, new Set());
        unigramContexts.get(w)!.add(prev);
      }
    });
  }
  return [bigrams, unigrams, unigramContexts];
}

function kneserNeyProb(
  bigrams: Map<string, number>,
  unigramContexts: Map<string, Set<string>>,
  contextTotals: Map<string, number>,
  uniqueFollow: Map<string, Set<string>>,
  totalUniqueBigrams: number,
  prev: string,
  w: string,
  discount = 0.75,
): number {
  const count = bigrams.get(key(prev, w)) ?? 0;
  const denom = contextTotals.get(prev) ?? 0;
  const continuation = (unigramContexts.get(w)?.size ?? 0) / Math.max(totalUniqueBigrams, 1);
  if (denom === 0) return continuation || 1e-9;
  const first = Math.max(count - discount, 0) / denom;
  const lam = (discount * (uniqueFollow.get(prev)?.size ?? 0)) / denom;
  return first + lam * continuation;
}

function laplaceProb(
  bigrams: Map<string, number>,
  unigrams: Map<string, number>,
  vocabSize: number,
  prev: string,
  w: string,
): number {
  const num = (bigrams.get(key(prev, w)) ?? 0) + 1;
  const den = (unigrams.get(prev) ?? 0) + vocabSize;
  return num / den;
}

function perplexity(probFn: ProbFn, sentences: string[][]): number {
  let totalLog = 0.0;
  let total = 0;
  for (const sentence of sentences) {
    const padded = ["<s>", ...sentence, "</s>"];
    for (let i = 1; i < padded.length; i++) {
      const p = probFn(padded[i - 1], padded[i]);
      totalLog += Math.log(Math.max(p, 1e-12));
      total += 1;
    }
  }
  return Math.exp(-totalLog / total);
}

function sampleSentence(probFn: ProbFn, vocab: string[], maxLen = 15, seed = 0): string[] {
  const rng = mulberry32(seed);
  const tokens = ["<s>"];
  for (let step = 0; step < maxLen; step++) {
    const probs: [string, number][] = vocab
      .filter((w) => w !== "<s>")
      .map((w): [string, number] => [w, probFn(tokens[tokens.length - 1], w)]);
    let total = 0;
    for (const [, p] of probs) total += p;
    const r = rng() * total;
    let acc = 0.0;
    for (const [w, p] of probs) {
      acc += p;
      if (r <= acc) {
        tokens.push(w);
        break;
      }
    }
    if (tokens[tokens.length - 1] === "</s>") return tokens.slice(1, -1);
  }
  return tokens.slice(1);
}

function main(): void {
  const raw = [
    "the cat sat on the mat .",
    "the cat ran across the room .",
    "the dog sat by the window .",
    "a cat chased the mouse .",
    "the dog ran after the cat .",
    "a mouse hid under the table .",
    "the cat watched the birds .",
    "the dog chased the ball .",
    "a bird sat on the branch .",
    "the cat slept on the couch .",
  ];
  const train = raw.map(tokenize);
  const test = [tokenize("the cat sat on the couch ."), tokenize("the dog watched the mouse .")];

  const [bigrams, unigrams, unigramContexts] = trainBigrams(train);
  const vocab = [...unigrams.keys()];
  const vocabSize = vocab.length;
  const contextTotals = new Map<string, number>();
  const uniqueFollow = new Map<string, Set<string>>();
  for (const [k, c] of bigrams) {
    const [prev, w] = k.split("\u0000");
    contextTotals.set(prev, (contextTotals.get(prev) ?? 0) + c);
    if (!uniqueFollow.has(prev)) uniqueFollow.set(prev, new Set());
    uniqueFollow.get(prev)!.add(w);
  }
  let totalUniqueBigrams = 0;
  for (const ctxSet of unigramContexts.values()) totalUniqueBigrams += ctxSet.size;

  const kn: ProbFn = (prev, w) =>
    kneserNeyProb(bigrams, unigramContexts, contextTotals, uniqueFollow, totalUniqueBigrams, prev, w);
  const lap: ProbFn = (prev, w) => laplaceProb(bigrams, unigrams, vocabSize, prev, w);

  console.log(`vocab size: ${vocabSize}`);
  console.log(`train sentences: ${train.length}`);
  console.log(`test sentences: ${test.length}`);
  console.log();
  console.log(`perplexity (Laplace):     ${pyFixed(perplexity(lap, test), 2)}`);
  console.log(`perplexity (Kneser-Ney):  ${pyFixed(perplexity(kn, test), 2)}`);
  console.log();
  console.log("=== sampled sentences (Kneser-Ney, 3 seeds) ===");
  for (const seed of [1, 7, 42]) {
    const sentence = sampleSentence(kn, vocab, 15, seed);
    console.log(`  seed=${seed}: ${sentence.join(" ")}`);
  }
}

main();

export {};
