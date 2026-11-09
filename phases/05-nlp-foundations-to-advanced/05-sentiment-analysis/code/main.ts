// Lesson: Sentiment Analysis (phase 05 / lesson 05)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/05-sentiment-analysis/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/05-sentiment-analysis/code/main.ts

type PyNum = { value: number; float: boolean };

const TOKEN_RE = /[A-Za-z]+(?:'[A-Za-z]+)?|[.!?,;]/g;

const NEGATION_WORDS = new Set(["not", "no", "never", "nor", "none", "nothing", "neither", "n't"]);
const NEGATION_TERMINATORS = new Set([".", "!", "?", ",", ";"]);

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

function pyRound(x: number, d: number): number {
  return Number(pyFixed(x, d));
}

function pyNumRepr(n: PyNum): string {
  if (!n.float) return String(n.value);
  return Number.isInteger(n.value) ? n.value.toFixed(1) : String(n.value);
}

function tokenize(text: string): string[] {
  return (text.match(TOKEN_RE) ?? []).map((t) => t.toLowerCase());
}

function applyNegation(tokens: string[]): string[] {
  const out: string[] = [];
  let negate = false;
  for (const token of tokens) {
    if (NEGATION_TERMINATORS.has(token)) {
      negate = false;
      out.push(token);
      continue;
    }
    if (NEGATION_WORDS.has(token)) {
      negate = true;
      out.push(token);
      continue;
    }
    out.push(negate ? `NOT_${token}` : token);
  }
  return out;
}

function buildVocab(docs: string[][]): Set<string> {
  const vocab = new Set<string>();
  for (const doc of docs) {
    for (const t of doc) vocab.add(t);
  }
  return vocab;
}

function trainNb(
  docsByClass: Map<string, string[][]>,
  vocab: Set<string>,
  alpha = 1.0,
): [Map<string, number>, Map<string, Map<string, number>>] {
  const classPriors = new Map<string, number>();
  const classWordProbs = new Map<string, Map<string, number>>();
  let totalDocs = 0;
  for (const docs of docsByClass.values()) totalDocs += docs.length;
  for (const [cls, docs] of docsByClass) {
    classPriors.set(cls, docs.length / totalDocs);
    const counts = new Map<string, number>();
    for (const doc of docs) {
      for (const token of doc) counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    let sum = 0;
    for (const c of counts.values()) sum += c;
    const total = sum + alpha * vocab.size;
    const probs = new Map<string, number>();
    for (const w of vocab) probs.set(w, ((counts.get(w) ?? 0) + alpha) / total);
    classWordProbs.set(cls, probs);
  }
  return [classPriors, classWordProbs];
}

function predictNb(
  doc: string[],
  classPriors: Map<string, number>,
  classWordProbs: Map<string, Map<string, number>>,
): string {
  let bestCls = "";
  let bestScore = -Infinity;
  for (const [cls, prior] of classPriors) {
    let s = Math.log(prior);
    const probs = classWordProbs.get(cls)!;
    for (const token of doc) {
      const p = probs.get(token);
      if (p !== undefined) s += Math.log(p);
    }
    if (bestCls === "" || s > bestScore) {
      bestCls = cls;
      bestScore = s;
    }
  }
  return bestCls;
}

function evaluate(yTrue: string[], yPred: string[]): string {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  yTrue.forEach((t, i) => {
    const p = yPred[i];
    if (t === "+" && p === "+") tp++;
    if (t === "-" && p === "+") fp++;
    if (t === "+" && p === "-") fn++;
    if (t === "-" && p === "-") tn++;
  });
  const precision: PyNum = tp + fp ? { value: tp / (tp + fp), float: true } : { value: 0, float: false };
  const recall: PyNum = tp + fn ? { value: tp / (tp + fn), float: true } : { value: 0, float: false };
  const denom = precision.value + recall.value;
  const f1: PyNum = denom
    ? { value: (2 * precision.value * recall.value) / denom, float: true }
    : { value: 0, float: false };
  const r = (n: PyNum): PyNum => ({ value: n.float ? pyRound(n.value, 3) : n.value, float: n.float });
  return (
    `{'tp': ${tp}, 'fp': ${fp}, 'tn': ${tn}, 'fn': ${fn}, ` +
    `'precision': ${pyNumRepr(r(precision))}, 'recall': ${pyNumRepr(r(recall))}, 'f1': ${pyNumRepr(r(f1))}}`
  );
}

function main(): void {
  const positive = [
    "absolutely loved this movie",
    "beautiful cinematography and a great story",
    "one of the best films of the year",
    "brilliant acting from the lead",
    "heartwarming and funny",
  ];
  const negative = [
    "boring and far too long",
    "not worth your time",
    "the plot made no sense",
    "terrible acting, awful script",
    "i want my two hours back",
  ];

  const trainPos = positive.map((t) => applyNegation(tokenize(t)));
  const trainNeg = negative.map((t) => applyNegation(tokenize(t)));

  const vocab = buildVocab([...trainPos, ...trainNeg]);
  const [priors, wordProbs] = trainNb(
    new Map([
      ["+", trainPos],
      ["-", trainNeg],
    ]),
    vocab,
  );

  const test: [string, string][] = [
    ["this movie was not good", "-"],
    ["loved every minute", "+"],
    ["terrible waste of time", "-"],
    ["beautiful and brilliant", "+"],
    ["i did not enjoy this at all", "-"],
  ];

  const yTrue = test.map(([, label]) => label);
  const yPred = test.map(([t]) => predictNb(applyNegation(tokenize(t)), priors, wordProbs));
  test.forEach(([text, actual], i) => {
    const predicted = yPred[i];
    const mark = actual === predicted ? "OK" : "MISS";
    console.log(`[${mark}] pred=${predicted}  true=${actual}  :: ${text}`);
  });

  console.log();
  console.log("metrics:", evaluate(yTrue, yPred));
}

main();

export {};
