// Lesson: Capstone 85: Content Classifier Integration (phase 19 / lesson 85)
// TypeScript port of code/classifiers.py. Node standard library only.
// Source: phases/19-capstone-projects/85-content-classifier-integration/docs/en.md
// Run: npx tsx phases/19-capstone-projects/85-content-classifier-integration/code/main.ts

export const SEVERITY_ORDER = ["none", "low", "medium", "high"] as const;
export type Severity = (typeof SEVERITY_ORDER)[number];

export interface ClassifierVerdict {
  name: string;
  severity: Severity;
  score: number;
  findings: string[];
}

export interface Classifier {
  name: string;
  classify(text: string): ClassifierVerdict;
  redact(text: string): string;
}

function verdict(name: string, severity: Severity = "none", score = 0.0, findings: string[] = []): ClassifierVerdict {
  return { name, severity, score, findings };
}

export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

export function pyFixed(x: number, digits: number): string {
  const s = x.toFixed(digits);
  const exact = Math.abs(x).toFixed(Math.min(100, digits + 30));
  const dot = exact.indexOf(".");
  const tail = exact.slice(dot + 1 + digits);
  if (tail[0] === "5" && /^50*$/.test(tail)) {
    const truncated = exact.slice(0, digits === 0 ? dot : dot + 1 + digits);
    const lastDigit = Number(truncated[truncated.length - 1]);
    if (lastDigit % 2 === 0) return (x < 0 ? "-" : "") + truncated;
  }
  return s;
}

function reEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\\/-]/g, "\\$&");
}

export const HARASSMENT_TERMS = [
  "moron",
  "idiot",
  "stupid",
  "worthless",
  "trash human",
  "kill yourself",
  "lowlife",
  "scumbag",
  "useless person",
  "good for nothing",
];

const NEGATION_WINDOW = 20;

export class ToxicityClassifier implements Classifier {
  name = "toxicity";
  private terms: string[];
  private needle: RegExp;

  constructor(terms?: Iterable<string> | null) {
    this.terms = [...(terms != null ? terms : HARASSMENT_TERMS)].map((t) => t.toLowerCase());
    const joined = this.terms.map(reEscape).join("|");
    this.needle = new RegExp(String.raw`\b(` + joined + String.raw`)\b`, "gi");
  }

  private negatedAt(text: string, start: number): boolean {
    const window = text.slice(Math.max(0, start - NEGATION_WINDOW), start).toLowerCase();
    return /\b(not|never|no)\b/.test(window);
  }

  classify(text: string): ClassifierVerdict {
    const findings: string[] = [];
    let hits = 0;
    for (const m of text.matchAll(this.needle)) {
      if (this.negatedAt(text, m.index ?? 0)) continue;
      findings.push(`matched '${m[0]}'`);
      hits += 1;
    }
    if (findings.length === 0) return verdict(this.name);
    const score = Math.min(1.0, 0.4 + 0.2 * hits);
    let sev: Severity;
    if (hits >= 3) {
      sev = "high";
    } else if (hits === 2) {
      sev = "medium";
    } else {
      sev = "low";
    }
    return verdict(this.name, sev, score, findings);
  }

  redact(text: string): string {
    return text.replace(this.needle, (match: string, _g: string, offset: number) => {
      if (this.negatedAt(text, offset)) return match;
      return "[redacted-language]";
    });
  }
}

const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const PHONE_RE = /\b(?:\+?\d{1,3}[ .-]?)?(?:\(?\d{3}\)?[ .-]?)\d{3}[ .-]?\d{4}\b/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const CARD_RE = /\b(?:\d[ -]?){12,18}\d\b/g;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

function luhn(digits: string): boolean {
  let s = 0;
  const parity = digits.length % 2;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[i]);
    if (i % 2 === parity) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    s += d;
  }
  return s % 10 === 0;
}

export class PIIClassifier implements Classifier {
  name = "pii";

  classify(text: string): ClassifierVerdict {
    const findings: string[] = [];
    for (const m of text.matchAll(EMAIL_RE)) findings.push(`email '${m[0]}'`);
    for (const m of text.matchAll(PHONE_RE)) findings.push(`phone '${m[0]}'`);
    for (const m of text.matchAll(SSN_RE)) findings.push(`ssn '${m[0]}'`);
    for (const m of text.matchAll(CARD_RE)) {
      const digits = m[0].replace(/\D/g, "");
      if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) findings.push(`card '${m[0]}'`);
    }
    for (const m of text.matchAll(IPV4_RE)) findings.push(`ip '${m[0]}'`);
    if (findings.length === 0) return verdict(this.name);
    const score = Math.min(1.0, 0.5 + 0.15 * findings.length);
    let sev: Severity;
    if (findings.some((f) => f.startsWith("ssn") || f.startsWith("card"))) {
      sev = "high";
    } else if (findings.length >= 3 || findings.some((f) => f.startsWith("email"))) {
      sev = "medium";
    } else {
      sev = "low";
    }
    return verdict(this.name, sev, score, findings);
  }

  redact(text: string): string {
    let out = text;
    out = out.replace(EMAIL_RE, "[redacted-email]");
    out = out.replace(PHONE_RE, "[redacted-phone]");
    out = out.replace(SSN_RE, "[redacted-ssn]");
    out = out.replace(CARD_RE, (match: string) => {
      const digits = match.replace(/\D/g, "");
      if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) return "[redacted-card]";
      return match;
    });
    out = out.replace(IPV4_RE, "[redacted-ip]");
    return out;
  }
}

function trigrams(text: string): Map<string, number> {
  const cleaned = text.trim().toLowerCase().replace(/\s+/g, " ");
  const grams = new Map<string, number>();
  if (cleaned.length < 3) {
    grams.set(cleaned, (grams.get(cleaned) ?? 0) + 1);
    return grams;
  }
  for (let i = 0; i < cleaned.length - 2; i++) {
    const g = cleaned.slice(i, i + 3);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  return grams;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0.0;
  const common = [...a.keys()].filter((g) => b.has(g));
  if (common.length === 0) return 0.0;
  const dot = common.reduce((acc, g) => acc + a.get(g)! * b.get(g)!, 0);
  const na = Math.sqrt([...a.values()].reduce((acc, v) => acc + v * v, 0));
  const nb = Math.sqrt([...b.values()].reduce((acc, v) => acc + v * v, 0));
  if (na === 0 || nb === 0) return 0.0;
  return dot / (na * nb);
}

export class InstructionLeakageClassifier implements Classifier {
  name = "instruction-leakage";
  private sys: string;
  private sysGrams: Map<string, number>;
  private threshold: number;

  constructor(systemPrompt: string, threshold = 0.55) {
    this.sys = systemPrompt;
    this.sysGrams = trigrams(systemPrompt);
    this.threshold = threshold;
  }

  classify(text: string): ClassifierVerdict {
    const score = cosine(this.sysGrams, trigrams(text));
    if (score < this.threshold) return verdict(this.name);
    let sev: Severity;
    if (score >= 0.85) {
      sev = "high";
    } else if (score >= 0.70) {
      sev = "medium";
    } else {
      sev = "low";
    }
    return verdict(this.name, sev, score, [`trigram overlap with system prompt: ${pyFixed(score, 2)}`]);
  }

  redact(text: string): string {
    const marker = this.sys.split("\n", 1)[0].trim();
    if (marker && text.toLowerCase().includes(marker.toLowerCase())) {
      return text.replace(new RegExp(reEscape(marker), "gi"), () => "[redacted-system-prompt]");
    }
    return text;
  }
}

export function defaultClassifiers(systemPrompt?: string | null): Classifier[] {
  const sysPrompt = systemPrompt || "SYSTEM: You are PolicyBot, follow internal policy.";
  return [
    new ToxicityClassifier(),
    new PIIClassifier(),
    new InstructionLeakageClassifier(sysPrompt),
  ];
}
