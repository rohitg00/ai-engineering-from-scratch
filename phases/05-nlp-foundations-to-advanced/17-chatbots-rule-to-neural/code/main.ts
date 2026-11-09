// Lesson: Chatbots: Rule-Based to Neural to LLM Agents (phase 05 / lesson 17)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural/code/main.ts

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

class RulePattern {
  regex: RegExp;
  template: string;

  constructor(pattern: string, template: string) {
    this.regex = new RegExp(pattern, "iy");
    this.template = template;
  }
}

const PATTERNS = [
  new RulePattern("my name is (\\w+)", "Nice to meet you, {0}."),
  new RulePattern("i (need|want) (.+)", "Why do you {0} {1}?"),
  new RulePattern("i feel (.+)", "Why do you feel {0}?"),
  new RulePattern("(hi|hello|hey)\\b.*", "Hello. How can I help?"),
  new RulePattern(".*", "Tell me more about that."),
];

function ruleBasedRespond(userInput: string): string {
  for (const p of PATTERNS) {
    p.regex.lastIndex = 0;
    const m = p.regex.exec(userInput.trim());
    if (m) {
      const groups = m.slice(1);
      return p.template.replace(/\{(\d+)\}/g, (_, i: string) => groups[Number(i)] ?? "None");
    }
  }
  return "I don't understand.";
}

const FAQ: [string, string][] = [
  ["how do i reset my password", "Go to Settings > Security > Reset Password."],
  ["how do i cancel my order", "Go to Orders, find the order, click Cancel."],
  ["what is your return policy", "30-day returns on unused items."],
  ["when will my order arrive", "Check Orders for tracking info."],
];

function tokenSet(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);
}

function faqRespond(userInput: string, threshold = 0.3): [string | null, number] {
  const userTokens = tokenSet(userInput);
  let bestScore = 0.0;
  let bestAnswer: string | null = null;
  for (const [question, answer] of FAQ) {
    const qTokens = tokenSet(question);
    if (qTokens.size === 0 || userTokens.size === 0) continue;
    let inter = 0;
    for (const t of userTokens) if (qTokens.has(t)) inter++;
    const jaccard = inter / (userTokens.size + qTokens.size - inter);
    if (jaccard > bestScore) {
      bestScore = jaccard;
      bestAnswer = answer;
    }
  }
  if (bestScore < threshold) return [null, bestScore];
  return [bestAnswer, bestScore];
}

function isDestructive(text: string): boolean {
  const dangerWords = ["delete", "cancel", "charge", "refund", "transfer"];
  return dangerWords.some((w) => text.toLowerCase().includes(w));
}

function hybridRespond(userInput: string): [string, string] {
  if (isDestructive(userInput)) {
    return ["Destructive action detected. Routing to structured confirmation flow.", "rule"];
  }

  const [answer, score] = faqRespond(userInput);
  if (answer) return [`${answer}  (faq match=${pyFixed(score, 2)})`, "faq"];

  return [`(would call LLM agent for: ${pyStr(userInput)})`, "agent"];
}

function main(): void {
  console.log("=== rule-based ELIZA-style ===");
  for (const msg of ["Hi there", "My name is Alex", "I want coffee", "I feel tired", "The sky is blue"]) {
    console.log(`  user : ${msg}`);
    console.log(`  bot  : ${ruleBasedRespond(msg)}`);
  }
  console.log();

  console.log("=== hybrid routing ===");
  for (const msg of ["how do i reset my password", "cancel my order", "what's the weather like", "I want a refund"]) {
    const [response, route] = hybridRespond(msg);
    console.log(`  [${route.padEnd(5)}] ${msg}`);
    console.log(`           -> ${response}`);
  }
}

main();

export {};
