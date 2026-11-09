// Lesson: Machine Translation (phase 05 / lesson 11)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/11-machine-translation/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/11-machine-translation/code/main.ts

type Counter = Map<string, number>;

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

function counter(items: string[]): Counter {
  const c: Counter = new Map();
  for (const it of items) c.set(it, (c.get(it) ?? 0) + 1);
  return c;
}

function intersectionSize(a: Counter, b: Counter): number {
  let s = 0;
  for (const [k, v] of a) s += Math.min(v, b.get(k) ?? 0);
  return s;
}

function total(c: Counter): number {
  let s = 0;
  for (const v of c.values()) s += v;
  return s;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replaceAll(".", " .")
    .replaceAll(",", " ,")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function ngrams(tokens: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length - n + 1; i++) out.push(tokens.slice(i, i + n).join("\u0000"));
  return out;
}

function ngramPrecision(hypTokens: string[], refTokens: string[], n: number): number {
  const hypCounts = counter(ngrams(hypTokens, n));
  const refCounts = counter(ngrams(refTokens, n));
  let clipped = 0;
  let count = 0;
  for (const [ngram, c] of hypCounts) {
    clipped += Math.min(c, refCounts.get(ngram) ?? 0);
    count += c;
  }
  if (count === 0) return 0.0;
  return clipped / count;
}

function brevityPenalty(hypLen: number, refLen: number): number {
  if (hypLen >= refLen) return 1.0;
  if (hypLen === 0) return 0.0;
  return Math.exp(1 - refLen / hypLen);
}

function simpleBleu(hypothesis: string, reference: string, maxN = 4): number {
  const hyp = tokenize(hypothesis);
  const ref = tokenize(reference);
  const precisions: number[] = [];
  for (let n = 1; n <= maxN; n++) precisions.push(ngramPrecision(hyp, ref, n));
  if (precisions.some((p) => p === 0)) return 0.0;
  let logSum = 0;
  for (const p of precisions) logSum += Math.log(p);
  const logMean = logSum / maxN;
  const bp = brevityPenalty(hyp.length, ref.length);
  return 100 * bp * Math.exp(logMean);
}

function simpleBleuNote(): string {
  return (
    "simple_bleu above has no smoothing: one zero-precision n-gram drops " +
    "the score to 0.0. This punishes short hypotheses; production uses " +
    "epsilon / NIST / add-k smoothing via sacrebleu."
  );
}

function chrf(hypothesis: string, reference: string, n = 6, beta = 2): number {
  const charNgrams = (text: string, k: number): string[] => {
    const out: string[] = [];
    for (let i = 0; i < text.length - k + 1; i++) out.push(text.slice(i, i + k));
    return out;
  };

  const hyp = hypothesis.toLowerCase();
  const ref = reference.toLowerCase();
  const precisions: number[] = [];
  const recalls: number[] = [];
  for (let k = 1; k <= n; k++) {
    const hypC = counter(charNgrams(hyp, k));
    const refC = counter(charNgrams(ref, k));
    const match = intersectionSize(hypC, refC);
    if (total(hypC) === 0 || total(refC) === 0) continue;
    precisions.push(match / total(hypC));
    recalls.push(match / total(refC));
  }
  if (precisions.length === 0) return 0.0;
  let pSum = 0;
  for (const x of precisions) pSum += x;
  let rSum = 0;
  for (const x of recalls) rSum += x;
  const p = pSum / precisions.length;
  const r = rSum / recalls.length;
  if (p + r === 0) return 0.0;
  const beta2 = beta * beta;
  return (100 * (1 + beta2) * p * r) / (beta2 * p + r);
}

function main(): void {
  const cases: [string, string][] = [
    ["Les chats courent.", "Les chats courent."],
    ["Les chats sont en train de courir.", "Les chats courent."],
    ["Les chiens mangent.", "Les chats courent."],
    ["Les", "Les chats courent."],
  ];
  console.log(`${"hypothesis".padEnd(40)}  ${"reference".padEnd(25)}  ${"BLEU".padStart(6)}  ${"chrF".padStart(6)}`);
  for (const [hyp, ref] of cases) {
    const b = simpleBleu(hyp, ref);
    const c = chrf(hyp, ref);
    console.log(`${hyp.padEnd(40)}  ${ref.padEnd(25)}  ${pyFixed(b, 1).padStart(6)}  ${pyFixed(c, 1).padStart(6)}`);
  }
  console.log();
  console.log(simpleBleuNote());
  console.log("BLEU under 1 point is noise. chrF catches morphological partials BLEU misses.");
  console.log("For real work, use sacrebleu (pip install sacrebleu) instead of this teaching version.");
}

main();

export {};
