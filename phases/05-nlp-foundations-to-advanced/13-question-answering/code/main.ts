// Lesson: Question Answering Systems (phase 05 / lesson 13)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/13-question-answering/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/13-question-answering/code/main.ts

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

function pyStr(s: string): string {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  return q + s.replaceAll("\\", "\\\\").replaceAll(q, "\\" + q) + q;
}

function counter(items: string[]): Counter {
  const c: Counter = new Map();
  for (const it of items) c.set(it, (c.get(it) ?? 0) + 1);
  return c;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function normalize(text: string): string {
  let t = text.toLowerCase();
  t = t.replace(/\b(a|an|the)\b/g, " ");
  t = t.replace(/[^\p{L}\p{N}_\s]/gu, " ");
  return t.split(/\s+/).filter((w) => w.length > 0).join(" ");
}

function exactMatch(pred: string, gold: string): number {
  return normalize(pred) === normalize(gold) ? 1.0 : 0.0;
}

function tokenF1(pred: string, gold: string): number {
  const pTokens = tokenize(normalize(pred));
  const gTokens = tokenize(normalize(gold));
  if (pTokens.length === 0 || gTokens.length === 0) {
    return pTokens.length || gTokens.length ? 0.0 : 1.0;
  }
  const pc = counter(pTokens);
  const gc = counter(gTokens);
  let overlap = 0;
  for (const [k, v] of pc) overlap += Math.min(v, gc.get(k) ?? 0);
  if (overlap === 0) return 0.0;
  const precision = overlap / pTokens.length;
  const recall = overlap / gTokens.length;
  return (2 * precision * recall) / (precision + recall);
}

function refusalFromScore(topRetrievalScore: number, threshold = 0.3): boolean {
  return topRetrievalScore < threshold;
}

const CORPUS = [
  "Apple Inc. released the first iPhone on June 29, 2007.",
  "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
  "Android launched in 2008 as Google's mobile operating system.",
  "The first iPod was released in 2001.",
];

function toyBm25Score(query: string, doc: string): number {
  const qTokens = new Set(tokenize(query));
  const dTokens = tokenize(doc);
  const dCounts = counter(dTokens);
  let score = 0.0;
  for (const qt of qTokens) {
    const c = dCounts.get(qt);
    if (c !== undefined) score += c / (1 + dTokens.length / 10);
  }
  return score;
}

function toyRetrieve(question: string, topK = 2): [number, string][] {
  const scored: [number, string][] = CORPUS.map((d) => [toyBm25Score(question, d), d]);
  scored.sort((a, b) => {
    if (a[0] !== b[0]) return b[0] - a[0];
    if (a[1] === b[1]) return 0;
    return a[1] < b[1] ? 1 : -1;
  });
  return scored.slice(0, topK);
}

function main(): void {
  console.log("=== extractive metrics ===");
  const cases: [string, string][] = [
    ["June 29, 2007", "June 29, 2007"],
    ["June 29th, 2007", "June 29, 2007"],
    ["29 June 2007", "June 29, 2007"],
    ["2007", "June 29, 2007"],
    ["2008", "June 29, 2007"],
  ];
  for (const [pred, gold] of cases) {
    const em = exactMatch(pred, gold);
    const f1 = tokenF1(pred, gold);
    console.log(
      `  pred=${pyStr(pred).padEnd(20)} gold=${pyStr(gold).padEnd(20)} EM=${pyFixed(em, 0)}  F1=${pyFixed(f1, 2)}`,
    );
  }
  console.log();
  console.log("note: EM punishes paraphrase. F1 is partial credit. neither captures semantics.");
  console.log();

  console.log("=== toy retrieval ===");
  const q = "When was the first iPhone released?";
  const results = toyRetrieve(q);
  const topScore = results[0][0];
  const refuse = refusalFromScore(topScore);
  console.log(`  query: ${q}`);
  console.log(`  top score: ${pyFixed(topScore, 3)}  refuse: ${refuse ? "True" : "False"}`);
  for (const [s, d] of results) console.log(`    ${pyFixed(s, 3)}  ${d}`);
}

main();

export {};
