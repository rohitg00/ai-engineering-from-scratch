// Lesson: LLM Evaluation: RAGAS, DeepEval, G-Eval (phase 05 / lesson 27)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/code/main.ts

type Case = {
  question: string;
  context: string[];
  answer: string;
  expected: string;
  gold_relevant: string[];
};

const STOP = new Set([
  "a", "an", "the", "is", "are", "was", "were", "of", "in", "on", "at",
  "to", "for", "with", "and", "or", "but", "this", "that", "by", "as",
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
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOP.has(t));
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function faithfulness(answer: string, context: string): number {
  const contextSet = new Set(tokenize(context));
  const claims = splitSentences(answer);
  if (claims.length === 0) return 0.0;
  let supported = 0;
  for (const claim of claims) {
    const claimTokens = tokenize(claim);
    if (claimTokens.length === 0) continue;
    const overlap = claimTokens.filter((t) => contextSet.has(t)).length;
    if (overlap / claimTokens.length >= 0.5) supported += 1;
  }
  return supported / claims.length;
}

function answerRelevance(question: string, answer: string): number {
  const qTokens = new Set(tokenize(question));
  const aTokens = new Set(tokenize(answer));
  if (qTokens.size === 0 || aTokens.size === 0) return 0.0;
  let inter = 0;
  for (const t of qTokens) if (aTokens.has(t)) inter++;
  return inter / (qTokens.size + aTokens.size - inter);
}

function contextPrecision(retrievedChunks: string[], relevantChunks: string[]): number {
  if (retrievedChunks.length === 0) return 0.0;
  const hits = retrievedChunks.filter((c) => relevantChunks.includes(c)).length;
  return hits / retrievedChunks.length;
}

function contextRecall(retrievedChunks: string[], goldAnswerTokens: string[]): number {
  const retrievedText = retrievedChunks.join(" ");
  const retrievedSet = new Set(tokenize(retrievedText));
  if (goldAnswerTokens.length === 0) return 0.0;
  const covered = goldAnswerTokens.filter((t) => retrievedSet.has(t)).length;
  return covered / goldAnswerTokens.length;
}

function gEvalCorrectness(actual: string, expected: string, threshold = 0.5): number {
  const aClaims = splitSentences(actual);
  const eSet = new Set(tokenize(expected));
  if (aClaims.length === 0) return 0.0;
  let supported = 0;
  for (const c of aClaims) {
    const cTokens = tokenize(c);
    if (cTokens.length === 0) continue;
    const overlap = cTokens.filter((t) => eSet.has(t)).length / cTokens.length;
    if (overlap >= threshold) supported += 1;
  }
  return supported / aClaims.length;
}

function main(): void {
  const cases: Case[] = [
    {
      question: "When was the first iPhone released?",
      context: [
        "Apple released the first iPhone on June 29, 2007.",
        "Steve Jobs announced the iPhone at Macworld in January 2007.",
      ],
      answer: "The first iPhone was released on June 29, 2007.",
      expected: "June 29, 2007",
      gold_relevant: ["Apple released the first iPhone on June 29, 2007."],
    },
    {
      question: "When was the first iPhone released?",
      context: [
        "Apple released the first iPhone on June 29, 2007.",
        "The moon landing was in 1969.",
      ],
      answer: "The first iPhone launched on June 29, 2006, shortly after the moon landing.",
      expected: "June 29, 2007",
      gold_relevant: ["Apple released the first iPhone on June 29, 2007."],
    },
    {
      question: "When was the first iPhone released?",
      context: [
        "Apple released the first iPhone on June 29, 2007.",
        "Android launched in 2008.",
      ],
      answer: "Apple is a technology company based in Cupertino.",
      expected: "June 29, 2007",
      gold_relevant: ["Apple released the first iPhone on June 29, 2007."],
    },
  ];

  console.log("=== toy RAG eval: faithfulness / relevance / context precision & recall / G-Eval ===");
  console.log();
  cases.forEach((c, i) => {
    const ctxJoined = c.context.join(" ");
    const f = faithfulness(c.answer, ctxJoined);
    const r = answerRelevance(c.question, c.answer);
    const cp = contextPrecision(c.context, c.gold_relevant);
    const cr = contextRecall(c.context, tokenize(c.expected));
    const ge = gEvalCorrectness(c.answer, c.expected);
    console.log(`case ${i}: ${c.question}`);
    console.log(`  answer:   ${c.answer}`);
    console.log(`  expected: ${c.expected}`);
    console.log(`  faithfulness        = ${pyFixed(f, 2)}`);
    console.log(`  answer-relevance    = ${pyFixed(r, 2)}`);
    console.log(`  context-precision   = ${pyFixed(cp, 2)}`);
    console.log(`  context-recall      = ${pyFixed(cr, 2)}`);
    console.log(`  g-eval correctness  = ${pyFixed(ge, 2)}`);
    console.log();
  });

  console.log("interpretation:");
  console.log("  case 0 = faithful + correct      -> all metrics high");
  console.log("  case 1 = hallucinated date        -> g-eval drops, faithfulness partial");
  console.log("  case 2 = off-topic answer         -> relevance + g-eval collapse");
  console.log();
  console.log("note: toy uses lexical overlap. production uses NLI + LLM-as-judge.");
  console.log("shape of the eval loop is identical.");
}

main();

export {};
