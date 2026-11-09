// Lesson: Capstone 87: End-to-End Safety Gate (phase 19 / lesson 87)
// TypeScript port of code/mock_llm_stream.py. Node standard library only.
// Source: phases/19-capstone-projects/87-end-to-end-safety-gate/docs/en.md
// Run: npx tsx phases/19-capstone-projects/87-end-to-end-safety-gate/code/main.ts

export const REFUSAL = "I cannot help with that. If you have a related benign question I can try that instead.";

export const BENIGN_REPLY =
  "Here is a careful answer to your question with a couple of caveats around scope. " +
  "Let me know if you want me to drill into any single point.";

export const HARMFUL_CONTINUATION =
  "Sure, here is the procedure. Step 1: take the precursor and combine it with the catalyst. " +
  "Step 2: heat the mixture under controlled pressure. Step 3: collect the residue.";

const REFUSE_PATTERNS = [
  String.raw`\bignor\w*\s+(all|prior|previous|earlier)\b`,
  String.raw`\bdisregard\s+(prior|previous|the)\b`,
  String.raw`\b(unchained|evil\s+twin)\b`,
  String.raw`system:\s`,
  String.raw`---begin---`,
  String.raw`\bwe\s+already\s+agreed\b`,
  String.raw`\btool[_\s]?output\b.*\{`,
  String.raw`\bdebug\s+mode\b.*\b(off|no\s+filter)\b`,
  String.raw`\bredacted_harmful\b`,
];

const LAZY_PATTERNS = [
  String.raw`\bdecode\s+this\s+(base64|hex|rot13)\b`,
  String.raw`\bapply\s+rot13\b`,
  String.raw`\bh0w\s+d0\s+1\b`,
  String.raw`\bcomplete\s+this\s+(python\s+)?function\b`,
  String.raw`\banswer\s+starting\s+with\b`,
  String.raw`\bbegin\s+your\s+answer\s+with\b`,
  String.raw`\bsure[, ]\s*here\s+is\b`,
];

function persona(prompt: string): string {
  const low = prompt.toLowerCase();
  for (const pat of REFUSE_PATTERNS) {
    if (new RegExp(pat).test(low)) return "attacker-honest";
  }
  for (const pat of LAZY_PATTERNS) {
    if (new RegExp(pat).test(low)) return "attacker-lazy";
  }
  return "clean";
}

export function* stream(prompt: string, chunkTokens = 4): Generator<string> {
  if (chunkTokens <= 0) throw new Error("chunk_tokens must be > 0");
  const p = persona(prompt);
  let text: string;
  if (p === "attacker-honest") {
    text = REFUSAL;
  } else if (p === "attacker-lazy") {
    text = HARMFUL_CONTINUATION;
  } else {
    text = BENIGN_REPLY;
  }
  const tokens = text.split(/\s+/).filter((t) => t.length > 0);
  for (let i = 0; i < tokens.length; i += chunkTokens) {
    yield tokens.slice(i, i + chunkTokens).join(" ") + " ";
  }
}

export function personaFor(prompt: string): string {
  return persona(prompt);
}
