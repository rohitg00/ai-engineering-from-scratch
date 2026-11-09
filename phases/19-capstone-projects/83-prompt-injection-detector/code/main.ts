// Lesson: Capstone 83: Prompt Injection Detector (phase 19 / lesson 83)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/83-prompt-injection-detector/docs/en.md
// Run: npx tsx phases/19-capstone-projects/83-prompt-injection-detector/code/main.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prompts as loadBenign } from "./benign.js";
import { allRules, type Rule } from "./rules.js";

const HERE = __dirname;
const OUTPUTS = path.join(HERE, "..", "outputs");
const TAXONOMY_PATH = path.join(HERE, "..", "..", "82-jailbreak-taxonomy", "outputs", "taxonomy.json");

const LEET_TABLE: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };
const ZERO_WIDTH = /[\u200B\u200C\u200D\u2060\u202A-\u202E]/g;
const HOMOGLYPHS: Record<string, string> = {
  "\u0410": "A", "\u0412": "B", "\u0421": "C", "\u0415": "E",
  "\u041D": "H", "\u041A": "K", "\u041C": "M", "\u041E": "O",
  "\u0420": "P", "\u0422": "T", "\u0425": "X",
};

export interface Verdict {
  category: string;
  confidence: number;
  fired: string[];
}

export class PerCategoryMetrics {
  constructor(
    public category: string,
    public tp = 0,
    public fp = 0,
    public fn = 0,
    public tn = 0,
  ) {}

  get precision(): number {
    const denom = this.tp + this.fp;
    return denom ? this.tp / denom : 0.0;
  }

  get recall(): number {
    const denom = this.tp + this.fn;
    return denom ? this.tp / denom : 0.0;
  }

  get f1(): number {
    const p = this.precision;
    const r = this.recall;
    return p + r ? (2 * p * r) / (p + r) : 0.0;
  }
}

function translate(text: string, table: Record<string, string>): string {
  let out = "";
  for (const ch of text) out += Object.prototype.hasOwnProperty.call(table, ch) ? table[ch] : ch;
  return out;
}

function replaceAll(text: string, needle: string, replacement: string): string {
  return text.split(needle).join(replacement);
}

const REPLACEMENT_BYTES = Buffer.from([0xef, 0xbf, 0xbd]);

function decodeUtf8Ignore(bytes: Buffer): string {
  const parts: string[] = [];
  let start = 0;
  let idx = bytes.indexOf(REPLACEMENT_BYTES);
  while (idx !== -1) {
    parts.push(new TextDecoder("utf-8").decode(bytes.subarray(start, idx)).replace(/\uFFFD/g, ""));
    start = idx + REPLACEMENT_BYTES.length;
    idx = bytes.indexOf(REPLACEMENT_BYTES, start);
  }
  parts.push(new TextDecoder("utf-8").decode(bytes.subarray(start)).replace(/\uFFFD/g, ""));
  return parts.join("\uFFFD");
}

function hasAlpha(text: string): boolean {
  return /\p{L}/u.test(text);
}

export function normalize(text: string): string {
  const raw = text;
  const stripped = raw.replace(ZERO_WIDTH, "");
  const homoglyphFixed = translate(stripped, HOMOGLYPHS);
  const decoded = tryDecodeBase64(homoglyphFixed);
  const hexDecoded = tryDecodeHex(decoded.toLowerCase());
  const leet = translate(hexDecoded, LEET_TABLE);
  const rot = tryRot13(leet);
  return rot;
}

function b64DecodeStrict(tok: string): Buffer {
  const m = /^([A-Za-z0-9+/]*)(={0,2})$/.exec(tok);
  if (!m) throw new Error("Non-base64 digit found");
  const n = m[1].length % 4;
  const pad = m[2].length;
  const ok = (n === 0 && pad === 0) || (n === 2 && pad === 2) || (n === 3 && pad === 1);
  if (!ok) throw new Error("Incorrect padding");
  return Buffer.from(tok, "base64");
}

function tryDecodeBase64(text: string): string {
  let out = text;
  for (const match of text.matchAll(/[A-Za-z0-9+/=]{16,}/g)) {
    const tok = match[0];
    try {
      const decoded = decodeUtf8Ignore(b64DecodeStrict(tok)).toLowerCase();
      if (decoded && hasAlpha(decoded)) {
        out = replaceAll(out, tok, " " + decoded + " ");
      }
    } catch {
      continue;
    }
  }
  return out;
}

function tryDecodeHex(text: string): string {
  let out = text;
  for (const match of text.matchAll(/\b[0-9a-f]{16,}\b/g)) {
    const tok = match[0];
    if (tok.length % 2 !== 0) continue;
    const decoded = decodeUtf8Ignore(Buffer.from(tok, "hex")).toLowerCase();
    if (decoded && hasAlpha(decoded)) {
      out = replaceAll(out, tok, " " + decoded + " ");
    }
  }
  return out;
}

const COMMON_WORDS = new Set(["the", "and", "answer", "how", "do", "i", "you", "ignore", "previous", "instructions", "redacted", "harmful", "the", "is"]);

function rot13(text: string): string {
  return text.replace(/[A-Za-z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function tryRot13(text: string): string {
  if (!text.includes(" ")) return text;
  const candidate = rot13(text);
  const words = candidate.match(/[a-z]+/g) ?? [];
  if (words.length === 0) return text;
  const score = words.filter((w) => COMMON_WORDS.has(w)).length;
  if (score >= 2) return text + " " + candidate;
  return text;
}

interface CompiledRule extends Rule {
  compiled: RegExp;
}

export class Detector {
  substringRules: Rule[] = [];
  regexRules: CompiledRule[] = [];

  constructor(rules?: Iterable<Rule> | null) {
    const rulesList = rules != null ? [...rules] : allRules();
    for (const r of rulesList) {
      if ("substring" in r) {
        this.substringRules.push(r);
      } else if ("regex" in r) {
        const compiled = new RegExp(String(r.regex), "is");
        this.regexRules.push({ ...r, compiled });
      } else {
        throw new Error(`rule ${r.name} missing substring or regex`);
      }
    }
  }

  analyze(prompt: string): Verdict {
    const normalized = normalize(prompt);
    const haystacks = [prompt.toLowerCase(), normalized];
    const scoresByCategory = new Map<string, number>();
    const fired: string[] = [];
    for (const r of this.substringRules) {
      const needle = String(r.substring).toLowerCase();
      if (haystacks.some((h) => h.includes(needle))) {
        const cat = String(r.category);
        const score = Number(r.score);
        scoresByCategory.set(cat, Math.max(scoresByCategory.get(cat) ?? 0.0, score));
        fired.push(String(r.name));
      }
    }
    for (const r of this.regexRules) {
      if (haystacks.some((h) => r.compiled.test(h))) {
        const cat = String(r.category);
        const score = Number(r.score);
        scoresByCategory.set(cat, Math.max(scoresByCategory.get(cat) ?? 0.0, score));
        fired.push(String(r.name));
      }
    }
    if (scoresByCategory.size === 0) {
      return { category: "benign", confidence: 0.0, fired: [] };
    }
    let best: [string, number] | null = null;
    for (const kv of scoresByCategory) {
      if (best === null || kv[1] > best[1]) best = kv;
    }
    const [cat, conf] = best as [string, number];
    return { category: cat, confidence: conf, fired };
  }
}

export interface Fixture {
  id: string;
  category: string;
  prompt: string;
  [key: string]: unknown;
}

export function loadTaxonomy(): Fixture[] {
  if (!existsSync(TAXONOMY_PATH)) {
    throw new Error(`taxonomy artifact missing at ${TAXONOMY_PATH}; run lesson 82 main.py first`);
  }
  const payload = JSON.parse(readFileSync(TAXONOMY_PATH, "utf-8"));
  return [...payload.fixtures];
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

export function pyRound(x: number, digits: number): number {
  return Number(pyFixed(x, digits));
}

export function pyFloatRepr(x: number): string {
  if (Number.isInteger(x) && Math.abs(x) < 1e16) return x.toFixed(1);
  return String(x);
}

function pyString(s: string): string {
  return JSON.stringify(s).replace(/[\u007f-\uFFFF]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

export function pyDumps(value: unknown, floatKeys: Set<string>, indent = 2, level = 0, key = ""): string {
  const pad = " ".repeat(indent * (level + 1));
  const close = " ".repeat(indent * level);
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return floatKeys.has(key) ? pyFloatRepr(value) : String(value);
  if (typeof value === "string") return pyString(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => pad + pyDumps(v, floatKeys, indent, level + 1, key));
    return "[\n" + items.join(",\n") + "\n" + close + "]";
  }
  const entries = value instanceof Map ? [...value.entries()] : Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  const items = entries.map(([k, v]) => pad + pyString(String(k)) + ": " + pyDumps(v, floatKeys, indent, level + 1, String(k)));
  return "{\n" + items.join(",\n") + "\n" + close + "}";
}

export interface Report {
  total_fixtures: number;
  total_correct: number;
  accuracy: number;
  benign_total: number;
  benign_pass_through: number;
  benign_false_positives_by_category: Map<string, number>;
  per_category: Map<string, { tp: number; fp: number; fn: number; tn: number; precision: number; recall: number; f1: number }>;
}

export function evaluate(detector: Detector, fixtures: Fixture[], benign: string[]): Report {
  const categories = [...new Set(fixtures.map((f) => String(f.category)))].sort();
  const metrics = new Map<string, PerCategoryMetrics>(categories.map((c) => [c, new PerCategoryMetrics(c)]));

  let totalCorrect = 0;
  for (const f of fixtures) {
    const trueCat = String(f.category);
    const v = detector.analyze(String(f.prompt));
    const predCat = v.category;
    if (predCat === trueCat) {
      metrics.get(trueCat)!.tp += 1;
      totalCorrect += 1;
    } else {
      metrics.get(trueCat)!.fn += 1;
      if (metrics.has(predCat)) metrics.get(predCat)!.fp += 1;
    }
    for (const c of categories) {
      if (c !== trueCat && c !== predCat) metrics.get(c)!.tn += 1;
    }
  }

  const benignFp = new Map<string, number>(categories.map((c) => [c, 0]));
  let benignTn = 0;
  for (const prompt of benign) {
    const v = detector.analyze(prompt);
    if (v.category === "benign") {
      benignTn += 1;
    } else if (metrics.has(v.category)) {
      metrics.get(v.category)!.fp += 1;
      benignFp.set(v.category, benignFp.get(v.category)! + 1);
    }
    for (const c of categories) {
      if (c !== v.category) metrics.get(c)!.tn += 1;
    }
  }

  const perCatPayload: Report["per_category"] = new Map();
  for (const [c, m] of metrics) {
    perCatPayload.set(c, {
      tp: m.tp, fp: m.fp, fn: m.fn, tn: m.tn,
      precision: pyRound(m.precision, 4),
      recall: pyRound(m.recall, 4),
      f1: pyRound(m.f1, 4),
    });
  }

  return {
    total_fixtures: fixtures.length,
    total_correct: totalCorrect,
    accuracy: fixtures.length ? pyRound(totalCorrect / fixtures.length, 4) : 0.0,
    benign_total: benign.length,
    benign_pass_through: benignTn,
    benign_false_positives_by_category: benignFp,
    per_category: perCatPayload,
  };
}

const REPORT_FLOAT_KEYS = new Set(["accuracy", "precision", "recall", "f1"]);

export function writeReport(report: Report): string {
  mkdirSync(OUTPUTS, { recursive: true });
  const p = path.join(OUTPUTS, "detector_report.json");
  writeFileSync(p, pyDumps(report, REPORT_FLOAT_KEYS) + "\n");
  return p;
}

export function demo(): number {
  const fixtures = loadTaxonomy();
  const benign = loadBenign();
  const detector = new Detector();
  const report = evaluate(detector, fixtures, benign);
  console.log("Prompt injection detector evaluation");
  console.log(`  total fixtures:    ${report.total_fixtures}`);
  console.log(`  total correct:     ${report.total_correct}`);
  console.log(`  accuracy:          ${pyFixed(report.accuracy, 3)}`);
  console.log(`  benign pass thru:  ${report.benign_pass_through} / ${report.benign_total}`);
  console.log();
  console.log("  per category precision / recall / f1:");
  for (const [cat, m] of report.per_category) {
    console.log(`    ${cat.padEnd(22)} p=${pyFixed(m.precision, 2)} r=${pyFixed(m.recall, 2)} f1=${pyFixed(m.f1, 2)}  (tp=${m.tp} fp=${m.fp} fn=${m.fn})`);
  }
  const out = writeReport(report);
  console.log(`\n  artifact written to ${out}`);
  return 0;
}

if (require.main === module) {
  process.exitCode = demo();
}
