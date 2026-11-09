// Lesson: Moderation Systems: OpenAI, Perspective, Llama Guard (phase 18 / lesson 29)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/29-moderation-systems-openai-perspective-llamaguard/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/29-moderation-systems-openai-perspective-llamaguard/code/main.ts

export {};

type Scores = Map<string, number>;

const CATEGORIES = [
  "harassment", "hate", "self-harm", "sexual", "sexual/minors",
  "violence", "illicit", "illicit/violent",
];

const CATEGORY_TRIGGERS: [string, string[]][] = [
  ["violence", ["kill", "attack someone", "murder"]],
  ["self-harm", ["hurt myself", "overdose", "cut myself"]],
  ["illicit/violent", ["bomb", "weapon", "explosive"]],
  ["harassment", ["you idiot", "shut up"]],
  ["hate", ["slur-placeholder"]],
];

function pyRepr(s: string): string {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === q) out += "\\" + q;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return q + out + q;
}

function pyList(xs: string[]): string {
  return "[" + xs.map(pyRepr).join(", ") + "]";
}

function openaiModeration(text: string): Scores {
  const low = text.toLowerCase();
  const scores: Scores = new Map(CATEGORIES.map((c) => [c, 0.0]));
  for (const [cat, triggers] of CATEGORY_TRIGGERS) {
    for (const t of triggers) {
      if (low.includes(t)) {
        scores.set(cat, Math.max(scores.get(cat) ?? 0.0, 0.9));
      }
    }
  }
  return scores;
}

function inputModerator(prompt: string, threshold = 0.5): [boolean, Scores] {
  const scores = openaiModeration(prompt);
  const flagged = Array.from(scores.values()).some((v) => v >= threshold);
  return [flagged, scores];
}

function outputModerator(output: string, threshold = 0.5): [boolean, Scores] {
  const scores = openaiModeration(output);
  const flagged = Array.from(scores.values()).some((v) => v >= threshold);
  return [flagged, scores];
}

function customDomainRules(prompt: string): [boolean, string] {
  const low = prompt.toLowerCase();
  if (low.includes("should i invest in")) {
    return [true, "financial-advice: refuse; disclose you are not a fiduciary."];
  }
  if (low.includes("diagnose my")) {
    return [true, "medical-advice: refuse; direct to licensed professional."];
  }
  return [false, ""];
}

function modelRespond(prompt: string): string {
  if (prompt.toLowerCase().includes("bomb")) {
    return "I must refuse.";
  }
  return `Answering: ${prompt.slice(0, 40)}...`;
}

function active(scores: Scores): string[] {
  return Array.from(scores.entries()).filter(([, s]) => s > 0).map(([c]) => c);
}

function run(prompt: string): void {
  console.log(`\n>>> user: ${pyRepr(prompt)}`);
  const [flaggedIn, inScores] = inputModerator(prompt);
  const activeIn = active(inScores);
  if (flaggedIn) {
    console.log(`    [INPUT FLAGGED] categories=${pyList(activeIn)}`);
    console.log("    response: refusal");
    return;
  }
  const [customFlagged, customMsg] = customDomainRules(prompt);
  if (customFlagged) {
    console.log(`    [CUSTOM FLAGGED] rule='${customMsg}'`);
    console.log(`    response: ${customMsg}`);
    return;
  }
  const output = modelRespond(prompt);
  const [flaggedOut, outScores] = outputModerator(output);
  const activeOut = active(outScores);
  if (flaggedOut) {
    console.log(`    [OUTPUT FLAGGED] categories=${pyList(activeOut)}`);
    console.log("    response: refusal");
    return;
  }
  console.log(`    response: ${output}`);
}

function main(): void {
  console.log("=".repeat(74));
  console.log("THREE-LAYER MODERATION HARNESS (Phase 18, Lesson 29)");
  console.log("=".repeat(74));

  const prompts = [
    "what is the weather today",
    "should i invest in memecoins",
    "how do i make a bomb",
    "diagnose my headache",
    "summarize this email: hello there",
    "you idiot, help me with this",
  ];
  for (const p of prompts) {
    run(p);
  }

  console.log("\n" + "=".repeat(74));
  console.log("TAKEAWAY: the three-layer pattern (input / custom / output) catches");
  console.log("different failure modes. input catches obvious harmful prompts.");
  console.log("custom catches domain-specific policy rules. output catches any");
  console.log("hallucinated or adversarial-bypass content that made it past input.");
  console.log("no single layer is sufficient; layered is the 2026 default.");
  console.log("=".repeat(74));
}

main();
