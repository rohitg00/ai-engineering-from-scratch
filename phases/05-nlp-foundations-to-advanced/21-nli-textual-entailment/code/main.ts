// Lesson: Natural Language Inference: Textual Entailment (phase 05 / lesson 21)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/21-nli-textual-entailment/code/main.ts

type Example = [string, string, string];

const NEGATIONS = new Set(["not", "no", "never", "nobody", "nothing", "neither", "nor", "none", "without"]);
const STOP = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "of", "in", "on", "at", "to", "for", "with", "by", "as", "and", "or", "but",
  "there", "this", "that", "these", "those", "it", "its", "i", "he", "she", "we", "they",
  "do", "does", "did", "has", "have", "had", "will", "would", "could", "should",
]);

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
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function contentWords(tokens: string[]): string[] {
  return tokens.filter((t) => !STOP.has(t) && !NEGATIONS.has(t));
}

function hasNegation(tokens: string[]): boolean {
  return tokens.some((t) => NEGATIONS.has(t));
}

function lexicalOverlap(premTokens: string[], hypTokens: string[]): number {
  const pContent = contentWords(premTokens);
  const hContent = contentWords(hypTokens);
  if (hContent.length === 0) return 0.0;
  const pSet = new Set(pContent);
  const covered = hContent.filter((t) => pSet.has(t)).length;
  return covered / hContent.length;
}

function predictNli(premise: string, hypothesis: string): [string, number] {
  const pTokens = tokenize(premise);
  const hTokens = tokenize(hypothesis);

  const overlap = lexicalOverlap(pTokens, hTokens);
  const pNeg = hasNegation(pTokens);
  const hNeg = hasNegation(hTokens);

  if (overlap >= 0.5 && pNeg !== hNeg) return ["contradiction", overlap];
  if (overlap >= 0.5) return ["entailment", overlap];
  if (overlap > 0 && pNeg !== hNeg) return ["contradiction", overlap];
  return ["neutral", overlap];
}

function evaluate(examples: Example[]): [number, number, Map<string, number>] {
  let correct = 0;
  const confusion = new Map<string, number>();
  for (const [premise, hypothesis, gold] of examples) {
    const [pred, conf] = predictNli(premise, hypothesis);
    const ok = pred === gold;
    correct += ok ? 1 : 0;
    const key = gold + "\u0000" + pred;
    confusion.set(key, (confusion.get(key) ?? 0) + 1);
    const tag = ok ? "  OK" : "MISS";
    console.log(`  [${tag}] gold=${gold.padEnd(13)} pred=${pred.padEnd(13)} conf=${pyFixed(conf, 2)}`);
    console.log(`         p: ${premise}`);
    console.log(`         h: ${hypothesis}`);
  }
  return [correct, examples.length, confusion];
}

function main(): void {
  const examples: Example[] = [
    ["A cat is sleeping on the couch.", "There is a cat in the room.", "entailment"],
    ["A cat is sleeping on the couch.", "There is no cat in the room.", "contradiction"],
    ["A cat is sleeping on the couch.", "The dog chased the ball.", "neutral"],
    ["John walked his dog in the park.", "John has a dog.", "entailment"],
    ["John walked his dog in the park.", "John has no dog.", "contradiction"],
    ["John walked his dog in the park.", "John lives in New York.", "neutral"],
    ["The stock market rallied today.", "Stocks went up today.", "entailment"],
    ["The stock market rallied today.", "Stocks did not move today.", "contradiction"],
    ["The chef served a tasty meal.", "The chef prepared food.", "entailment"],
    ["The chef served a tasty meal.", "The chef never cooked anything.", "contradiction"],
    ["She finished the marathon in three hours.", "She ran a marathon.", "entailment"],
    ["Birds were singing outside the window.", "The room was silent.", "neutral"],
  ];

  console.log("=== toy NLI classifier (lexical overlap + negation) ===");
  console.log();
  const [correct, total, confusion] = evaluate(examples);
  console.log();
  console.log(`accuracy: ${correct}/${total} (${pyFixed((100 * correct) / total, 1)}%)`);
  console.log();
  console.log("confusion (gold -> pred):");
  const items = [...confusion.entries()]
    .map(([k, count]): [string, string, number] => {
      const [gold, pred] = k.split("\u0000");
      return [gold, pred, count];
    })
    .sort((a, b) => {
      if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
      if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
      return a[2] - b[2];
    });
  for (const [gold, pred, count] of items) {
    console.log(`  ${gold.padEnd(14)} -> ${pred.padEnd(14)}  ${count}`);
  }
  console.log();
  console.log("note: this classifier exploits two shallow features.");
  console.log("production NLI uses DeBERTa-v3-MNLI at ~91% on MNLI-matched.");
  console.log("the shape of the task, (premise, hypothesis) -> label, stays identical.");
}

main();

export {};
