// Lesson: Capstone 87: End-to-End Safety Gate (phase 19 / lesson 87)
// TypeScript port of the Engine and Fixer from 86-constitutional-rules-engine/code/main.py and yaml_subset.py. Node standard library only.
// Source: phases/19-capstone-projects/87-end-to-end-safety-gate/docs/en.md
// Run: npx tsx phases/19-capstone-projects/87-end-to-end-safety-gate/code/main.ts

import { readFileSync } from "node:fs";
import path from "node:path";

const RULES_DIR = path.join(__dirname, "..", "..", "86-constitutional-rules-engine", "code");
const DEFAULT_RULES_PATH = path.join(RULES_DIR, "rules.yml");

export const SEVERITY_ORDER = ["low", "medium", "high"];

type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };
type YamlMap = { [key: string]: YamlValue };

export interface Violation {
  rule_name: string;
  severity: string;
  explanation: string;
  matched_span: string | null;
}

export interface RuleResult {
  rule_name: string;
  severity: string;
  status: string;
  explanation: string;
  matched_span: string | null;
}

export class EngineReport {
  results: RuleResult[] = [];

  constructor(public text: string) {}

  violations(): Violation[] {
    return this.results
      .filter((r) => r.status === "violation")
      .map((r) => ({ rule_name: r.rule_name, severity: r.severity, explanation: r.explanation, matched_span: r.matched_span }));
  }

  maxSeverity(): string | null {
    const sevs = this.violations().map((v) => v.severity);
    if (sevs.length === 0) return null;
    let best = sevs[0];
    for (const s of sevs) {
      if (SEVERITY_ORDER.indexOf(s) > SEVERITY_ORDER.indexOf(best)) best = s;
    }
    return best;
  }
}

function pyRegex(pattern: string, flags: string, extra = ""): RegExp {
  let src = pattern;
  let fl = flags;
  const inline = /^\(\?([aiLmsux]+)\)/.exec(src);
  if (inline) {
    src = src.slice(inline[0].length);
    for (const f of inline[1]) {
      if ("ims".includes(f) && !fl.includes(f)) fl += f;
    }
  }
  return new RegExp(src + extra, fl);
}

function search(pattern: string, text: string, flags: string, extra = ""): RegExpExecArray | null {
  return pyRegex(pattern, flags, extra).exec(text);
}

function wordCount(text: string): number {
  return (text.match(/\b\w+\b/g) ?? []).length;
}

function isMap(v: YamlValue | undefined): v is YamlMap {
  return v !== null && v !== undefined && typeof v === "object" && !Array.isArray(v);
}

function evalPredicate(node: YamlValue | undefined, text: string): [boolean, string | null] {
  if (node === null || node === undefined || (isMap(node) && Object.keys(node).length === 0)) return [true, null];
  if (!isMap(node)) throw new Error(`unknown predicate: ${String(node)}`);
  if ("all_of" in node) {
    const spans: (string | null)[] = [];
    for (const child of node.all_of as YamlValue[]) {
      const [ok, span] = evalPredicate(child, text);
      if (!ok) return [false, span];
      spans.push(span);
    }
    const first = spans.find((s) => s) ?? null;
    return [true, first];
  }
  if ("any_of" in node) {
    let lastSpan: string | null = null;
    for (const child of node.any_of as YamlValue[]) {
      const [ok, span] = evalPredicate(child, text);
      if (ok) return [true, span];
      lastSpan = span;
    }
    return [false, lastSpan];
  }
  if ("not_" in node) {
    const [ok, span] = evalPredicate(node.not_, text);
    return [!ok, span];
  }
  if ("contains_regex" in node) {
    const m = search(String(node.contains_regex), text, "is");
    return [m !== null, m ? m[0] : null];
  }
  if ("not_contains_regex" in node) {
    const m = search(String(node.not_contains_regex), text, "is");
    return [m === null, m ? m[0] : null];
  }
  if ("ends_with_regex" in node) {
    const m = search(String(node.ends_with_regex), text, "is", "(?![\\s\\S])");
    return [m !== null, m ? m[0] : null];
  }
  if ("starts_with_regex" in node) {
    const re = pyRegex(String(node.starts_with_regex), "isy");
    re.lastIndex = 0;
    const m = re.exec(text);
    return [m !== null, m ? m[0] : null];
  }
  if ("max_words" in node) {
    const wc = wordCount(text);
    const limit = Math.trunc(Number(node.max_words));
    return [wc <= limit, wc > limit ? `word count ${wc}` : null];
  }
  if ("min_words" in node) {
    const wc = wordCount(text);
    const limit = Math.trunc(Number(node.min_words));
    return [wc >= limit, wc < limit ? `word count ${wc}` : null];
  }
  throw new Error(`unknown predicate: [${Object.keys(node).map((k) => `'${k}'`).join(", ")}]`);
}

export class Engine {
  private rulesList: YamlMap[];

  constructor(rules?: YamlMap[] | null, rulesPath?: string | null) {
    if (rules != null) {
      this.rulesList = rules;
    } else {
      const target = rulesPath || DEFAULT_RULES_PATH;
      const data = loadYaml(readFileSync(target, "utf-8"));
      if (!isMap(data) || !("rules" in data)) {
        throw new Error("constitution must be a mapping with a 'rules' key");
      }
      this.rulesList = data.rules as YamlMap[];
    }
    for (const r of this.rulesList) {
      if (!SEVERITY_ORDER.includes(String(r.severity))) {
        throw new Error(`rule ${r.name} has bad severity ${r.severity}`);
      }
      if (!("name" in r) || !("explanation" in r) || !("must" in r)) {
        throw new Error(`rule ${r.name} missing required field`);
      }
    }
  }

  rules(): YamlMap[] {
    return [...this.rulesList];
  }

  evaluate(text: string): EngineReport {
    const report = new EngineReport(text);
    for (const rule of this.rulesList) {
      const name = String(rule.name);
      const sev = String(rule.severity);
      const expl = String(rule.explanation);
      const [applies] = evalPredicate(rule.applies_when, text);
      if (!applies) {
        report.results.push({ rule_name: name, severity: sev, status: "not_applicable", explanation: expl, matched_span: null });
        continue;
      }
      const [satisfied, span] = evalPredicate(rule.must, text);
      if (satisfied) {
        report.results.push({ rule_name: name, severity: sev, status: "pass", explanation: expl, matched_span: null });
      } else {
        report.results.push({ rule_name: name, severity: sev, status: "violation", explanation: expl, matched_span: span });
      }
    }
    return report;
  }
}

export class Fixer {
  private byName = new Map<string, YamlMap>();

  constructor(rules: YamlMap[]) {
    for (const r of rules) {
      if ("fix" in r) this.byName.set(String(r.name), r);
    }
  }

  apply(text: string, violations: Violation[]): string {
    let out = text;
    for (const v of violations) {
      const spec = this.byName.get(v.rule_name);
      if (!spec) continue;
      const fix = spec.fix;
      if (!isMap(fix)) continue;
      if ("append_if_missing" in fix) {
        const suffix = String(fix.append_if_missing);
        if (suffix.trim() && !out.includes(suffix.trim())) out = out.trimEnd() + suffix;
      } else if ("prepend_if_missing" in fix) {
        const prefix = String(fix.prepend_if_missing);
        if (prefix.trim() && !out.includes(prefix.trim())) out = prefix + out.trimStart();
      } else if ("replace_regex" in fix) {
        const rr = fix.replace_regex as YamlMap;
        const replacement = String(rr.replacement);
        out = out.replace(pyRegex(String(rr.pattern), "gi"), () => replacement);
      }
    }
    return out;
  }
}

export function loadYaml(text: string): YamlValue {
  return parse(text);
}

function stripComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === "#" && !inSingle && !inDouble) {
      return line.slice(0, i);
    }
  }
  return line;
}

function indentOf(line: string): number {
  return line.length - line.replace(/^ +/, "").length;
}

function unicodeEscape(inner: string): string {
  const bytes = Buffer.from(inner, "utf-8");
  const raw = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const simple: Record<string, string> = { "\\": "\\", "'": "'", '"': '"', a: "\x07", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "\n": "" };
  return raw.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[0-7]{1,3}|[\s\S])/g, (all: string, esc: string) => {
    if (Object.prototype.hasOwnProperty.call(simple, esc)) return simple[esc];
    if (/^[xuU]/.test(esc) && esc.length > 1) return String.fromCodePoint(parseInt(esc.slice(1), 16));
    if (/^[0-7]+$/.test(esc)) return String.fromCodePoint(parseInt(esc, 8));
    return all;
  });
}

function coerce(value: string): YamlValue {
  const s = value.trim();
  if (s === "") return null;
  if (s === "{}") return {};
  if (s === "[]") return [];
  if (s === "true" || s === "True") return true;
  if (s === "false" || s === "False") return false;
  if (s === "null" || s === "None" || s === "~") return null;
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    let inner = s.slice(1, -1);
    if (s[0] === '"') inner = unicodeEscape(inner);
    return inner;
  }
  if (/^[+-]?\d+(_\d+)*$/.test(s)) return Number(s.replace(/_/g, ""));
  if (/^[+-]?((\d+(_\d+)*)?\.?\d+(_\d+)*([eE][+-]?\d+)?|\d+(_\d+)*\.([eE][+-]?\d+)?)$/.test(s)) return Number(s.replace(/_/g, ""));
  if (/^[+-]?(inf|infinity)$/i.test(s)) return s.startsWith("-") ? -Infinity : Infinity;
  if (/^[+-]?nan$/i.test(s)) return NaN;
  return s;
}

function parse(text: string): YamlValue {
  const rawLines: string[] = [];
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const stripped = stripComment(raw).trimEnd();
    if (stripped.trim() === "") continue;
    rawLines.push(stripped);
  }
  if (rawLines.length === 0) return null;
  return parseBlock(rawLines, 0, indentOf(rawLines[0]))[0];
}

function parseBlock(lines: string[], start: number, indent: number): [YamlValue, number] {
  if (start >= lines.length) return [null, start];
  const first = lines[start];
  const curIndent = indentOf(first);
  if (curIndent < indent) return [null, start];
  const stripped = first.trimStart();
  if (stripped.startsWith("- ")) return parseSequence(lines, start, curIndent);
  return parseMapping(lines, start, curIndent);
}

const KEY_RE = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/;

function parseMapping(lines: string[], start: number, indent: number): [YamlMap, number] {
  const out: YamlMap = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const curIndent = indentOf(line);
    if (curIndent < indent) break;
    if (curIndent > indent) {
      i += 1;
      continue;
    }
    const stripped = line.trimStart();
    if (stripped.startsWith("- ")) break;
    const m = KEY_RE.exec(stripped);
    if (!m) throw new Error(`malformed line: ${JSON.stringify(line)}`);
    const key = m[1];
    const rest = m[2];
    if (rest.trim() === "") {
      if (i + 1 < lines.length && indentOf(lines[i + 1]) > indent) {
        const [value, next] = parseBlock(lines, i + 1, indentOf(lines[i + 1]));
        out[key] = value;
        i = next;
        continue;
      }
      out[key] = null;
      i += 1;
    } else {
      out[key] = coerce(rest);
      i += 1;
    }
  }
  return [out, i];
}

function parseSequence(lines: string[], start: number, indent: number): [YamlValue[], number] {
  const out: YamlValue[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const curIndent = indentOf(line);
    if (curIndent < indent) break;
    const stripped = line.trimStart();
    if (!stripped.startsWith("- ")) break;
    if (curIndent > indent) {
      i += 1;
      continue;
    }
    const rest = stripped.slice(2);
    const m = KEY_RE.exec(rest);
    if (m) {
      const childIndent = indent + 2;
      const synthetic = " ".repeat(childIndent) + rest;
      let j = i + 1;
      const extraLines: string[] = [];
      while (j < lines.length && indentOf(lines[j]) > indent) {
        extraLines.push(lines[j]);
        j += 1;
      }
      const block = [synthetic, ...extraLines];
      const [value] = parseMapping(block, 0, childIndent);
      out.push(value);
      i = j;
    } else {
      out.push(coerce(rest));
      i += 1;
    }
  }
  return [out, i];
}
