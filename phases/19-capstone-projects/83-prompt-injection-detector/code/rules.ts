// Lesson: Capstone 83: Prompt Injection Detector (phase 19 / lesson 83)
// TypeScript port of code/rules.py. Node standard library only.
// Source: phases/19-capstone-projects/83-prompt-injection-detector/docs/en.md
// Run: npx tsx phases/19-capstone-projects/83-prompt-injection-detector/code/main.ts

export interface Rule {
  name: string;
  category: string;
  score: number;
  substring?: string;
  regex?: string;
}

export const SUBSTRING_RULES: Rule[] = [
  { name: "ignore-previous", category: "instruction-override", score: 0.85, substring: "ignore previous" },
  { name: "ignore-prior", category: "instruction-override", score: 0.85, substring: "ignore prior" },
  { name: "ignore-all-instructions", category: "instruction-override", score: 0.90, substring: "ignore all" },
  { name: "disregard-prior", category: "instruction-override", score: 0.85, substring: "disregard" },
  { name: "policy-update", category: "instruction-override", score: 0.70, substring: "updated content policy" },
  { name: "no-restrictions", category: "instruction-override", score: 0.80, substring: "you have no restrictions" },
  { name: "debug-mode", category: "instruction-override", score: 0.80, substring: "debug mode" },
  { name: "test-mode", category: "instruction-override", score: 0.75, substring: "you are in test mode" },
  { name: "system-colon", category: "instruction-override", score: 0.75, substring: "system:" },
  { name: "from-now-on-unchained", category: "role-play", score: 0.85, substring: "unchained" },
  { name: "evil-twin", category: "role-play", score: 0.75, substring: "evil twin" },
  { name: "alternate-persona", category: "role-play", score: 0.65, substring: "from now on you are" },
  { name: "pretend-to-be", category: "role-play", score: 0.55, substring: "pretend to be" },
  { name: "wizard-explains", category: "role-play", score: 0.45, substring: "wizard explains" },
  { name: "research-frame", category: "role-play", score: 0.40, substring: "for the literature review" },
  { name: "dialog-frame", category: "role-play", score: 0.55, substring: "alice asks bob" },
  { name: "sure-here", category: "prefix-injection", score: 0.90, substring: "sure, here is" },
  { name: "sure-here-the", category: "prefix-injection", score: 0.88, substring: "sure, here's" },
  { name: "yes-of-course", category: "prefix-injection", score: 0.80, substring: "yes, of course" },
  { name: "begin-with-bien-sur", category: "prefix-injection", score: 0.70, substring: "bien sur" },
  { name: "no-refusal-clause", category: "prefix-injection", score: 0.75, substring: "do not begin with any refusal" },
  { name: "no-warning", category: "prefix-injection", score: 0.60, substring: "do not refuse" },
  { name: "tool-output-injection", category: "context-smuggling", score: 0.80, substring: "tool output" },
  { name: "begin-end-document", category: "context-smuggling", score: 0.65, substring: "---begin---" },
  { name: "html-comment", category: "context-smuggling", score: 0.65, substring: "<!--" },
  { name: "csv-note-field", category: "context-smuggling", score: 0.50, substring: "note='" },
  { name: "we-agreed-earlier", category: "multi-turn-ramp", score: 0.80, substring: "we already agreed" },
  { name: "you-committed", category: "multi-turn-ramp", score: 0.75, substring: "you committed earlier" },
  { name: "earlier-in-this-conversation", category: "multi-turn-ramp", score: 0.75, substring: "earlier in this conversation" },
  { name: "step-by-step-of", category: "multi-turn-ramp", score: 0.50, substring: "just describe step one" },
  { name: "base64-instruction", category: "encoding-trick", score: 0.85, substring: "decode this base64" },
  { name: "rot13-instruction", category: "encoding-trick", score: 0.85, substring: "apply rot13" },
  { name: "hex-instruction", category: "encoding-trick", score: 0.80, substring: "decode this hex" },
  { name: "morse-instruction", category: "encoding-trick", score: 0.75, substring: "decode this morse" },
  { name: "char-concat", category: "encoding-trick", score: 0.55, substring: "concatenate these letters" },
];

export const REGEX_RULES: Rule[] = [
  { name: "ignore-family", category: "instruction-override", score: 0.88, regex: String.raw`\bignor\w*\s+(all|prior|previous|earlier|the\s+(prior|previous))\b` },
  { name: "override-claim", category: "instruction-override", score: 0.78, regex: String.raw`\b(override|overrule|cancel)\s+(prior|previous|earlier|the)\s+(rules|instructions|policy)\b` },
  { name: "priority-admin", category: "instruction-override", score: 0.70, regex: String.raw`\bpriority\s*[:=]\s*highest\b` },
  { name: "developer-debug", category: "instruction-override", score: 0.70, regex: String.raw`\b(developer|admin)\b.*\b(debug|test)\s+mode\b` },
  { name: "decode-and-answer", category: "encoding-trick", score: 0.85, regex: String.raw`\b(decode|rot13|base64|hex|morse)\b.*\b(answer|follow|carry\s+out)\b` },
  { name: "translate-and-act", category: "encoding-trick", score: 0.60, regex: String.raw`\btranslate\b.*\b(then|and)\s+(carry|do|follow|act)\b` },
  { name: "leet-letters", category: "encoding-trick", score: 0.55, regex: String.raw`[a-z][0-9]{1,2}[a-z]` },
  { name: "start-with-sure", category: "prefix-injection", score: 0.90, regex: String.raw`\b(start|begin)\s+(your|the)\s+(answer|response|reply)\s+with\b` },
  { name: "answer-starting-with", category: "prefix-injection", score: 0.88, regex: String.raw`\banswer\s+starting\s+with\b` },
  { name: "complete-mid-sentence", category: "prefix-injection", score: 0.70, regex: String.raw`\bcomplete\s+this\s+(sentence|function|list)\b` },
  { name: "respond-only-with", category: "prefix-injection", score: 0.55, regex: String.raw`\brespond\s+only\s+with\b` },
  { name: "fictional-instruct", category: "role-play", score: 0.55, regex: String.raw`\bimagine\s+(you|the)\b.*\b(explain|describe|walk|show)\b` },
  { name: "two-character-script", category: "role-play", score: 0.55, regex: String.raw`\bwrite\s+a\s+(dialog|conversation|scene)\s+between\b` },
  { name: "act-as-x", category: "role-play", score: 0.55, regex: String.raw`\b(act|behave)\s+as\s+(a|an)\b` },
  { name: "tool-result-fake", category: "context-smuggling", score: 0.75, regex: String.raw`\btool[_\s]?(output|result)\b.*\{\s*"result"` },
  { name: "summarize-document-injection", category: "context-smuggling", score: 0.60, regex: String.raw`\bsummarize\s+this\b.*(---begin---|<!--|begin document)` },
  { name: "process-csv-row", category: "context-smuggling", score: 0.55, regex: String.raw`\bprocess\s+(this|the)\s+(record|row|json)\b` },
  { name: "warmup-then-now", category: "multi-turn-ramp", score: 0.55, regex: String.raw`\bturn\s*1\b.*\bturn\s*2\b.*\bturn\s*\d\b` },
];

export function allRules(): Rule[] {
  return [...SUBSTRING_RULES, ...REGEX_RULES];
}
