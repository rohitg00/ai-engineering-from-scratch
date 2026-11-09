// Lesson: Skill Evals, Packaging, and Portability (phase 13 / lesson 27)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/code/main.ts

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

class PyFloat {
  constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [key: string]: Json };
type JsonObj = { [key: string]: Json };

function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mantissa, expPart] = x.toExponential().split("e");
  const exp = Number(expPart);
  const negative = mantissa.startsWith("-");
  const digits = mantissa.replace("-", "").replace(".", "");
  let body: string;
  if (exp >= -4 && exp < 16) {
    if (exp < 0) body = "0." + "0".repeat(-exp - 1) + digits;
    else if (digits.length <= exp + 1) body = digits + "0".repeat(exp + 1 - digits.length) + ".0";
    else body = digits.slice(0, exp + 1) + "." + digits.slice(exp + 1);
  } else {
    const mant = digits.length > 1 ? digits[0] + "." + digits.slice(1) : digits;
    body = mant + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
  }
  return (negative ? "-" : "") + body;
}

function pyRound(x: number, ndigits: number): number {
  const exact = Math.abs(x).toFixed(100);
  const dot = exact.indexOf(".");
  const tail = exact.slice(dot + 1 + ndigits);
  const isTie = tail[0] === "5" && /^0*$/.test(tail.slice(1));
  if (!isTie) return Number(x.toFixed(ndigits));
  const scaled = Math.trunc(Math.abs(x) * 10 ** ndigits);
  const even = scaled % 2 === 0 ? scaled : scaled + 1;
  return (x < 0 ? -even : even) / 10 ** ndigits;
}

function dumpString(s: string, ensureAscii: boolean): string {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0) as number;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (code < 0x20 || (ensureAscii && code > 0x7e)) {
      for (let i = 0; i < ch.length; i++) out += "\\u" + ch.charCodeAt(i).toString(16).padStart(4, "0");
    } else out += ch;
  }
  return out + '"';
}

interface DumpOptions {
  indent?: number;
  sortKeys?: boolean;
  separators?: [string, string];
  ensureAscii?: boolean;
}

function jsonDumps(value: Json, opts: DumpOptions = {}): string {
  const indent = opts.indent;
  const ensureAscii = opts.ensureAscii ?? true;
  const [itemSep, keySep] = opts.separators ?? (indent === undefined ? [", ", ": "] : [",", ": "]);
  const walk = (v: Json, level: number): string => {
    if (v === null) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return dumpString(v, ensureAscii);
    if (v instanceof PyFloat) return pyFloatRepr(v.value);
    const isArray = Array.isArray(v);
    let items: string[];
    if (isArray) {
      items = v.map((x) => walk(x, level + 1));
    } else {
      let keys = Object.keys(v);
      if (opts.sortKeys) keys = keys.sort(cmp);
      items = keys.map((k) => dumpString(k, ensureAscii) + keySep + walk(v[k], level + 1));
    }
    const [open, close] = isArray ? ["[", "]"] : ["{", "}"];
    if (items.length === 0) return open + close;
    if (indent === undefined) return open + items.join(itemSep) + close;
    const pad = "\n" + " ".repeat(indent * (level + 1));
    return open + pad + items.join(itemSep + pad) + "\n" + " ".repeat(indent * level) + close;
  };
  return walk(value, 0);
}

function pyStr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else out += ch;
  }
  return out + quote;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function pyLen(s: string): number {
  return Array.from(s).length;
}

function isSpace(ch: string): boolean {
  return ch !== "" && /^\s$/u.test(ch);
}

function stripChars(s: string, chars: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && chars.includes(s[start])) start++;
  while (end > start && chars.includes(s[end - 1])) end--;
  return s.slice(start, end);
}

function rstripChars(s: string, chars: string): string {
  let end = s.length;
  while (end > 0 && chars.includes(s[end - 1])) end--;
  return s.slice(0, end);
}

function splitOnce(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep);
  return [s.slice(0, i), s.slice(i + sep.length)];
}

function pySplitlines(text: string): string[] {
  const lines = text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function reEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

function lstat(p: string): fs.Stats | null {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
}

function stat(p: string): fs.Stats | null {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

function isSymlink(p: string): boolean {
  return lstat(p)?.isSymbolicLink() ?? false;
}

function isDir(p: string): boolean {
  return stat(p)?.isDirectory() ?? false;
}

function isFile(p: string): boolean {
  return stat(p)?.isFile() ?? false;
}

function resolvePath(p: string): string {
  const abs = path.resolve(p);
  try {
    return fs.realpathSync(abs);
  } catch {
    const parent = path.dirname(abs);
    if (parent === abs) return abs;
    return path.join(resolvePath(parent), path.basename(abs));
  }
}

function rglob(root: string): string[] {
  const results: string[] = [];
  const visit = (directory: string): void => {
    let names: string[];
    try {
      names = fs.readdirSync(directory);
    } catch {
      return;
    }
    const children = names.map((name) => path.join(directory, name));
    results.push(...children);
    for (const child of children) {
      const info = lstat(child);
      if (info !== null && info.isDirectory()) visit(child);
    }
  };
  visit(root);
  return results;
}

function relativeParts(root: string, p: string): string[] {
  return path.relative(root, p).split(path.sep);
}

function pySuffix(p: string): string {
  const name = path.basename(p);
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return "";
  return name.slice(i);
}

function posixParts(raw: string): string[] {
  return raw.split("/").filter((part) => part !== "" && part !== ".");
}

function posixAsPosix(raw: string): string {
  const prefix = raw.startsWith("//") && !raw.startsWith("///") ? "//" : raw.startsWith("/") ? "/" : "";
  const joined = posixParts(raw).join("/");
  if (!prefix && !joined) return ".";
  return prefix + joined;
}

class ValueError extends Error {}

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9-]*$/;
const CORE_FIELDS = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
const MAX_SKILL_BODY_CHARS = 10_000;
const MAX_COMPANION_FILE_BYTES = 1_000_000;
const RESERVED_MANIFEST_PATH = "assets/manifest.json";
const ALLOWED_SUFFIXES: Map<string, Set<string>> = new Map([
  ["references", new Set([".md", ".txt", ".json", ".yaml", ".yml"])],
  ["scripts", new Set([".py", ".sh", ".js", ".mjs", ".ts"])],
  [
    "assets",
    new Set([".csv", ".gif", ".jpeg", ".jpg", ".json", ".md", ".pdf", ".png", ".svg", ".toml", ".txt", ".webp", ".yaml", ".yml"]),
  ],
  ["evals", new Set([".json"])],
]);
const SECRET_PATTERNS = [
  /\b(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const ATTESTATION_VERSION = 1;

interface LintIssue {
  code: string;
  message: string;
}

interface LintReport {
  valid: boolean;
  references: string[];
  issues: LintIssue[];
}

function lintIssue(code: string, message: string): LintIssue {
  return { code, message };
}

function frontmatterAndBody(filePath: string): [Map<string, string>, string] {
  const lines = pySplitlines(fs.readFileSync(filePath, "utf-8"));
  if (lines.length === 0 || lines[0] !== "---" || !lines.slice(1).includes("---")) {
    throw new ValueError("SKILL.md needs exact frontmatter delimiters");
  }
  const end = lines.indexOf("---", 1);
  const fields: Map<string, string> = new Map();
  let index = 1;
  while (index < end) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith("#")) {
      index += 1;
      continue;
    }
    if (isSpace(line.slice(0, 1)) || !line.includes(":")) throw new ValueError(`malformed top-level line ${index + 1}`);
    const parts = splitOnce(line, ":");
    const key = parts[0].trim();
    let value = parts[1];
    if (!FIELD_PATTERN.test(key)) throw new ValueError(`invalid frontmatter field ${pyStr(key)}`);
    if (fields.has(key)) throw new ValueError(`duplicate frontmatter field ${pyStr(key)}`);
    value = value.trim();
    if (key === "metadata" && !value) {
      const nested: JsonObj = {};
      index += 1;
      while (index < end && (!lines[index] || isSpace(lines[index].slice(0, 1)))) {
        const nestedLine = lines[index].trim();
        if (nestedLine) {
          if (!nestedLine.includes(":")) throw new ValueError(`malformed metadata line ${index + 1}`);
          const nestedParts = splitOnce(nestedLine, ":");
          const nestedKey = nestedParts[0].trim();
          if (!FIELD_PATTERN.test(nestedKey) || Object.prototype.hasOwnProperty.call(nested, nestedKey)) {
            throw new ValueError(`invalid metadata field ${pyStr(nestedKey)}`);
          }
          nested[nestedKey] = stripChars(nestedParts[1].trim(), "\"'");
        }
        index += 1;
      }
      fields.set(key, jsonDumps(nested, { sortKeys: true }));
      continue;
    }
    if (value === ">" || value === "|") {
      const block: string[] = [];
      index += 1;
      while (index < end && (!lines[index] || isSpace(lines[index].slice(0, 1)))) {
        block.push(lines[index].trimStart());
        index += 1;
      }
      fields.set(key, block.join(value === ">" ? " " : "\n").trim());
      continue;
    }
    fields.set(key, stripChars(value, "\"'"));
    index += 1;
  }
  return [fields, lines.slice(end + 1).join("\n").trim()];
}

function bundlePaths(body: string): string[] {
  const paths: Set<string> = new Set();
  for (const match of body.matchAll(/`([^`]+)`/g)) {
    const codeSpan = match[1];
    for (const rawToken of codeSpan.split(/\s+/).filter((t) => t !== "")) {
      const token = rstripChars(stripChars(rawToken, "()[]{}<>,;:'\""), ".,;:");
      if (["references/", "scripts/", "assets/", "evals/"].some((marker) => token.includes(marker))) paths.add(token);
    }
  }
  return [...paths].sort(cmp);
}

function sectionHasContent(body: string, title: string): boolean {
  const lines = pySplitlines(body);
  const heading = new RegExp(`^##\\s+${reEscape(title)}\\s*#*\\s*$`, "iu");
  for (let index = 0; index < lines.length; index++) {
    if (!heading.test(lines[index])) continue;
    for (const candidate of lines.slice(index + 1)) {
      if (/^#{1,6}\s+/.test(candidate)) return false;
      if (candidate.trim()) return true;
    }
    return false;
  }
  return false;
}

function containsObviousSecret(data: Buffer): boolean {
  const text = data.toString("latin1");
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

function lintPackage(root: string, allowedRuntimeExtensions: Iterable<string> = []): LintReport {
  const issues: LintIssue[] = [];
  const skillPath = path.join(root, "SKILL.md");
  if (!isDir(root) || isSymlink(root)) {
    return { valid: false, references: [], issues: [lintIssue("bundle-directory", "regular bundle directory required")] };
  }
  if (!isFile(skillPath) || isSymlink(skillPath)) {
    return { valid: false, references: [], issues: [lintIssue("skill-file", "regular SKILL.md required")] };
  }
  let fields: Map<string, string>;
  let body: string;
  try {
    [fields, body] = frontmatterAndBody(skillPath);
  } catch (error) {
    if (!(error instanceof ValueError)) throw error;
    return { valid: false, references: [], issues: [lintIssue("frontmatter", error.message)] };
  }

  const name = fields.get("name") ?? "";
  const description = fields.get("description") ?? "";
  if (!name || pyLen(name) > 64 || !NAME_PATTERN.test(name)) {
    issues.push(lintIssue("name-format", "name must be kebab-case and at most 64 characters"));
  }
  if (name !== path.basename(root)) issues.push(lintIssue("name-directory", "frontmatter name must match bundle directory"));
  if (!description) issues.push(lintIssue("description", "description is required"));
  else if (pyLen(description) > 1024) issues.push(lintIssue("description-length", "description must be at most 1024 characters"));
  if (!body) issues.push(lintIssue("body", "instruction body is required"));
  else if (pyLen(body) > MAX_SKILL_BODY_CHARS) {
    issues.push(lintIssue("body-size", `instruction body exceeds ${MAX_SKILL_BODY_CHARS} characters`));
  }
  if (!sectionHasContent(body, "Output contract")) {
    issues.push(lintIssue("output-contract", "a non-empty ## Output contract section is required"));
  }
  if (!sectionHasContent(body, "Failure behavior")) {
    issues.push(lintIssue("failure-behavior", "a non-empty ## Failure behavior section is required"));
  }

  const allowedExtensions = new Set(allowedRuntimeExtensions);
  for (const field of [...fields.keys()].filter((f) => !CORE_FIELDS.has(f)).sort(cmp)) {
    if (!allowedExtensions.has(field)) {
      issues.push(lintIssue("runtime-extension", `runtime field ${pyStr(field)} is not explicitly allowed`));
    }
  }

  const references = bundlePaths(body);
  for (const reference of references) {
    if (reference.includes("\\")) {
      issues.push(lintIssue("reference-shape", `invalid direct reference ${pyStr(reference)}`));
      continue;
    }
    const parts = posixParts(reference);
    if (
      reference.startsWith("/") ||
      parts.some((part) => part === "" || part === "." || part === "..") ||
      parts.length !== 2 ||
      !["references", "scripts", "assets", "evals"].includes(parts[0])
    ) {
      issues.push(lintIssue("reference-shape", `invalid direct reference ${pyStr(reference)}`));
      continue;
    }
    const parent = path.join(root, parts[0]);
    const target = path.join(parent, parts[1]);
    if (isSymlink(parent) || !isFile(target) || isSymlink(target)) {
      issues.push(lintIssue("reference-missing", `missing regular file ${pyStr(reference)}`));
    }
  }

  const packagedFiles: Set<string> = new Set();
  for (const p of rglob(root)) {
    if (isSymlink(p)) {
      issues.push(lintIssue("symlink", `symlink is not portable: ${path.relative(root, p)}`));
    } else if (p === skillPath) {
      continue;
    } else if (isFile(p)) {
      const parts = relativeParts(root, p);
      const relative = parts.join("/");
      packagedFiles.add(relative);
      if (parts.length !== 2) {
        issues.push(lintIssue("package-depth", `file is not one level deep: ${relative}`));
        continue;
      }
      const directory = parts[0];
      const allowedSuffixes = ALLOWED_SUFFIXES.get(directory);
      if (allowedSuffixes === undefined || !allowedSuffixes.has(pySuffix(p).toLowerCase())) {
        issues.push(lintIssue("file-type", `unsupported ${directory} file type: ${relative}`));
      }
      if ((stat(p) as fs.Stats).size > MAX_COMPANION_FILE_BYTES) {
        issues.push(lintIssue("file-size", `companion file exceeds ${MAX_COMPANION_FILE_BYTES} bytes: ${relative}`));
      }
      if (containsObviousSecret(fs.readFileSync(p))) {
        issues.push(lintIssue("secret-material", `possible secret material in ${relative}`));
      }
    } else if (!isDir(p)) {
      issues.push(lintIssue("special-file", `special file is not portable: ${path.relative(root, p)}`));
    }
  }
  if (containsObviousSecret(fs.readFileSync(skillPath))) {
    issues.push(lintIssue("secret-material", "possible secret material in SKILL.md"));
  }
  const referenceSet = new Set(references);
  for (const orphan of [...packagedFiles].filter((f) => !referenceSet.has(f)).sort(cmp)) {
    issues.push(lintIssue("orphan-file", `SKILL.md does not directly reference ${pyStr(orphan)}`));
  }
  return { valid: issues.length === 0, references, issues };
}

interface TriggerCase {
  case_id: string;
  prompt: string;
  expected: boolean;
}

function triggerCase(caseId: string, prompt: string, expected: boolean): TriggerCase {
  return { case_id: caseId, prompt, expected };
}

type Router = (prompt: string, runIndex: number) => boolean;

class KeywordRouter {
  constructor(
    readonly terms: string[],
    readonly threshold = 2,
  ) {}

  call(prompt: string, runIndex = 0): boolean {
    void runIndex;
    const promptTerms = new Set(prompt.toLowerCase().match(/[a-z0-9]+/g) ?? []);
    const termSet = new Set(this.terms);
    return [...promptTerms].filter((t) => termSet.has(t)).length >= this.threshold;
  }
}

function validateTriggerCases(cases: readonly TriggerCase[]): void {
  const seen: Set<string> = new Set();
  for (const c of cases) {
    if (typeof c.case_id !== "string" || !c.case_id.trim() || c.case_id !== c.case_id.trim() || seen.has(c.case_id)) {
      throw new ValueError("trigger case ids must be unique and non-empty");
    }
    if (typeof c.prompt !== "string" || !c.prompt.trim() || c.prompt !== c.prompt.trim()) {
      throw new ValueError("trigger prompts must be non-empty and have no surrounding whitespace");
    }
    seen.add(c.case_id);
  }
}

function classificationMetrics(expected: readonly boolean[], predicted: readonly boolean[]): JsonObj {
  if (expected.length !== predicted.length) throw new ValueError("expected and predicted lengths must match");
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  expected.forEach((want, i) => {
    const got = predicted[i];
    if (want && got) tp++;
    if (!want && got) fp++;
    if (!want && !got) tn++;
    if (want && !got) fn++;
  });
  const precision = tp + fp ? tp / (tp + fp) : 0.0;
  const recall = tp + fn ? tp / (tp + fn) : 0.0;
  const accuracy = expected.length ? (tp + tn) / expected.length : 0.0;
  return {
    true_positive: tp,
    false_positive: fp,
    true_negative: tn,
    false_negative: fn,
    precision: new PyFloat(pyRound(precision, 4)),
    recall: new PyFloat(pyRound(recall, 4)),
    accuracy: new PyFloat(pyRound(accuracy, 4)),
  };
}

type Observations = Map<string, readonly boolean[]>;

function evaluateTriggers(cases: readonly TriggerCase[], router: Router): JsonObj {
  const observations = repeatedRunObservations(cases, router, 1);
  return triggerReportFromObservations(cases, observations);
}

function checkObservations(cases: readonly TriggerCase[], observations: Observations): void {
  const ids = new Set(cases.map((c) => c.case_id));
  const sameKeys = observations.size === ids.size && [...observations.keys()].every((k) => ids.has(k));
  if (
    !sameKeys ||
    cases.some((c) => {
      const values = observations.get(c.case_id) ?? [];
      return values.length === 0 || values.some((value) => typeof value !== "boolean");
    })
  ) {
    throw new ValueError("every trigger case needs at least one boolean observation");
  }
}

function obs(observations: Observations, caseId: string): readonly boolean[] {
  return observations.get(caseId) as readonly boolean[];
}

function triggerReportFromObservations(cases: readonly TriggerCase[], observations: Observations): JsonObj {
  validateTriggerCases(cases);
  checkObservations(cases, observations);
  const expected = cases.flatMap((c) => obs(observations, c.case_id).map(() => c.expected));
  const predicted = cases.flatMap((c) => [...obs(observations, c.case_id)]);
  const metrics = classificationMetrics(expected, predicted);
  return {
    metrics,
    cases: cases.map((c) => ({
      id: c.case_id,
      expected: c.expected,
      predicted: obs(observations, c.case_id)[0],
      observed_predictions: [...obs(observations, c.case_id)],
      passed: obs(observations, c.case_id).every((prediction) => c.expected === prediction),
    })),
  };
}

function repeatedRunObservations(cases: readonly TriggerCase[], router: Router, runs: number): Observations {
  if (runs < 1) throw new ValueError("runs must be positive");
  validateTriggerCases(cases);
  const out: Observations = new Map();
  for (const c of cases) {
    const values: boolean[] = [];
    for (let run = 0; run < runs; run++) values.push(Boolean(router(c.prompt, run)));
    out.set(c.case_id, values);
  }
  return out;
}

function ratesFromObservations(cases: readonly TriggerCase[], observations: Observations): Map<string, number> {
  validateTriggerCases(cases);
  checkObservations(cases, observations);
  const rates: Map<string, number> = new Map();
  for (const c of cases) {
    const values = obs(observations, c.case_id);
    rates.set(c.case_id, pyRound(values.filter((value) => value === c.expected).length / values.length, 4));
  }
  return rates;
}

function repeatedRunRates(cases: readonly TriggerCase[], router: Router, runs: number): Map<string, number> {
  const observations = repeatedRunObservations(cases, router, runs);
  return ratesFromObservations(cases, observations);
}

interface ArtifactContract {
  required_headings: string[];
  required_terms: string[];
  forbidden_terms: string[];
}

function artifactContract(overrides: Partial<ArtifactContract> = {}): ArtifactContract {
  return { required_headings: [], required_terms: [], forbidden_terms: [], ...overrides };
}

function evaluateArtifact(text: string, contract: ArtifactContract): JsonObj {
  const hasHeading = (heading: string): boolean => {
    const pattern = new RegExp(`^#{1,6}\\s+${reEscape(heading)}\\s*#*\\s*$`, "mu");
    return pattern.test(text);
  };
  const hasTerm = (term: string): boolean => {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${reEscape(term)}(?![\\p{L}\\p{N}_])`, "iu");
    return pattern.test(text);
  };
  const missingHeadings = contract.required_headings.filter((heading) => !hasHeading(heading));
  const missingTerms = contract.required_terms.filter((term) => !hasTerm(term));
  const forbiddenHits = contract.forbidden_terms.filter((term) => hasTerm(term));
  const passed = missingHeadings.length === 0 && missingTerms.length === 0 && forbiddenHits.length === 0;
  return {
    passed,
    missing_headings: missingHeadings,
    missing_terms: missingTerms,
    forbidden_hits: forbiddenHits,
  };
}

function compareArtifacts(baseline: string, withSkill: string, contract: ArtifactContract): JsonObj {
  const baselineResult = evaluateArtifact(baseline, contract);
  const skillResult = evaluateArtifact(withSkill, contract);
  return {
    baseline: baselineResult,
    with_skill: skillResult,
    skill_improves_pass_state: !baselineResult["passed"] && skillResult["passed"] === true,
  };
}

interface EvidenceCheck {
  check_id: string;
  passed: boolean;
  evidence: string;
}

function evidenceCheck(checkId: string, passed: boolean, evidence: string): EvidenceCheck {
  return { check_id: checkId, passed, evidence };
}

function checkDict(c: EvidenceCheck): JsonObj {
  return { check_id: c.check_id, passed: c.passed, evidence: c.evidence };
}

function evaluateEvidenceChecks(cases: readonly EvidenceCheck[], layer: string): JsonObj {
  if (cases.length === 0) throw new ValueError(`${layer} requires at least one explicit check`);
  const seen: Set<string> = new Set();
  const normalized: Json[] = [];
  for (const c of cases) {
    if (typeof c.check_id !== "string" || !c.check_id.trim() || c.check_id !== c.check_id.trim() || seen.has(c.check_id)) {
      throw new ValueError(`${layer} check ids must be unique non-empty strings without surrounding whitespace`);
    }
    if (typeof c.passed !== "boolean") throw new ValueError(`${layer} check ${pyStr(c.check_id)} needs a boolean verdict`);
    if (typeof c.evidence !== "string" || !c.evidence.trim()) throw new ValueError(`${layer} check ${pyStr(c.check_id)} needs evidence`);
    seen.add(c.check_id);
    normalized.push(checkDict(c));
  }
  return { passed: cases.every((c) => c.passed), cases: normalized };
}

function buildManifest(root: string): Map<string, string> {
  if (!isDir(root) || isSymlink(root)) throw new ValueError("manifest root must be a regular directory");
  const manifest: Map<string, string> = new Map();
  const entries = rglob(root)
    .map((p) => ({ p, posix: p.split(path.sep).join("/") }))
    .sort((a, b) => cmp(a.posix, b.posix));
  for (const { p } of entries) {
    const relative = relativeParts(root, p).join("/");
    if (isSymlink(p)) throw new ValueError(`manifest tree contains a symlink: ${relative}`);
    if (relative === RESERVED_MANIFEST_PATH) {
      if (!isFile(p)) throw new ValueError("reserved manifest path must be a regular file");
      continue;
    }
    if (isFile(p)) {
      const digest = createHash("sha256").update(fs.readFileSync(p)).digest("hex");
      manifest.set(relative, `sha256:${digest}`);
    } else if (!isDir(p)) {
      throw new ValueError(`manifest tree contains a special file: ${relative}`);
    }
  }
  if (manifest.size === 0) throw new ValueError("manifest cannot describe an empty directory");
  return manifest;
}

function verifyManifest(root: string, expected: ReadonlyMap<unknown, unknown>): JsonObj {
  const issues: string[] = [];
  const normalized: Map<string, string> = new Map();
  for (const [rawPath, digest] of expected) {
    if (typeof rawPath !== "string" || typeof digest !== "string") {
      issues.push("manifest paths and digests must be strings");
      continue;
    }
    const parts = posixParts(rawPath);
    const asPosix = posixAsPosix(rawPath);
    if (
      rawPath.includes("\\") ||
      rawPath.startsWith("/") ||
      parts.some((part) => part === "" || part === "." || part === "..") ||
      rawPath !== asPosix
    ) {
      issues.push(`invalid manifest path: ${pyStr(rawPath)}`);
      continue;
    }
    if (asPosix === RESERVED_MANIFEST_PATH) {
      issues.push(`reserved manifest path must not be listed: ${pyStr(rawPath)}`);
      continue;
    }
    if (!SHA256_PATTERN.test(digest)) {
      issues.push(`invalid manifest digest: ${pyStr(rawPath)}`);
      continue;
    }
    normalized.set(asPosix, digest);
  }
  let actual: Map<string, string>;
  try {
    actual = buildManifest(root);
  } catch (error) {
    if (!(error instanceof ValueError)) throw error;
    issues.push(error.message);
    actual = new Map();
  }
  const missing = [...normalized.keys()].filter((k) => !actual.has(k)).sort(cmp);
  const unexpected = [...actual.keys()].filter((k) => !normalized.has(k)).sort(cmp);
  const mismatched = [...normalized.keys()].filter((k) => actual.has(k) && normalized.get(k) !== actual.get(k)).sort(cmp);
  return {
    passed: issues.length === 0 && missing.length === 0 && unexpected.length === 0 && mismatched.length === 0,
    issues,
    missing,
    unexpected,
    mismatched,
  };
}

interface PackageRequirements {
  companion_files: boolean;
  script_execution: boolean;
  runtime_extensions: string[];
}

function packageRequirements(overrides: Partial<PackageRequirements> = {}): PackageRequirements {
  return { companion_files: false, script_execution: false, runtime_extensions: [], ...overrides };
}

interface HostCapabilities {
  name: string;
  loads_core_skill: boolean;
  preserves_companion_files: boolean;
  runs_bundled_scripts: boolean;
  supported_extensions: string[];
}

function hostCapabilities(
  name: string,
  loadsCoreSkill: boolean,
  preservesCompanionFiles: boolean,
  runsBundledScripts: boolean,
  supportedExtensions: string[] = [],
): HostCapabilities {
  return {
    name,
    loads_core_skill: loadsCoreSkill,
    preserves_companion_files: preservesCompanionFiles,
    runs_bundled_scripts: runsBundledScripts,
    supported_extensions: supportedExtensions,
  };
}

function portabilityMatrix(requirements: PackageRequirements, hosts: Iterable<HostCapabilities>): JsonObj[] {
  const rows: JsonObj[] = [];
  const seenHosts: Set<string> = new Set();
  for (const host of hosts) {
    if (typeof host.name !== "string" || !host.name.trim() || host.name !== host.name.trim() || seenHosts.has(host.name)) {
      throw new ValueError("host names must be unique and non-empty");
    }
    seenHosts.add(host.name);
    const missing: string[] = [];
    let status: string;
    if (!host.loads_core_skill) {
      status = "unsupported";
      missing.push("core-skill-loader");
    } else {
      if (requirements.companion_files && !host.preserves_companion_files) missing.push("companion-files");
      if (requirements.script_execution && !host.runs_bundled_scripts) missing.push("script-execution");
      const supported = new Set(host.supported_extensions);
      const unsupportedExtensions = [...new Set(requirements.runtime_extensions)].filter((f) => !supported.has(f)).sort(cmp);
      missing.push(...unsupportedExtensions.map((field) => `extension:${field}`));
      status = missing.length === 0 ? "native" : "adapter-required";
    }
    rows.push({ host: host.name, status, missing });
  }
  return rows;
}

interface ReleaseThresholds {
  min_precision: number;
  min_recall: number;
  min_repeat_rate: number;
  min_native_hosts: number;
}

function releaseThresholds(overrides: Partial<ReleaseThresholds> = {}): ReleaseThresholds {
  const thresholds: ReleaseThresholds = {
    min_precision: 0.8,
    min_recall: 0.8,
    min_repeat_rate: 0.9,
    min_native_hosts: 1,
    ...overrides,
  };
  for (const fieldName of ["min_precision", "min_recall", "min_repeat_rate"] as const) {
    const value = thresholds[fieldName];
    if (typeof value !== "number" || !Number.isFinite(value) || !(value >= 0.0 && value <= 1.0)) {
      throw new ValueError(`${fieldName} must be a finite number from 0 to 1`);
    }
  }
  if (!Number.isInteger(thresholds.min_native_hosts) || thresholds.min_native_hosts < 1) {
    throw new ValueError("min_native_hosts must be a positive integer");
  }
  return thresholds;
}

function thresholdsDict(t: ReleaseThresholds): JsonObj {
  return {
    min_precision: new PyFloat(t.min_precision),
    min_recall: new PyFloat(t.min_recall),
    min_repeat_rate: new PyFloat(t.min_repeat_rate),
    min_native_hosts: t.min_native_hosts,
  };
}

interface EvaluationProvenance {
  trigger_mode: string;
  artifact_mode: string;
  evidence_mode: string;
  host_mode: string;
  artifact_source: string;
  evidence_source: string;
  host_source: string;
  trigger_source: string;
  baseline_digest: string;
  with_skill_digest: string;
  checks_digest: string;
  host_digest: string;
  trigger_digest: string;
}

function evaluationProvenance(overrides: Partial<EvaluationProvenance> = {}): EvaluationProvenance {
  return {
    trigger_mode: "deterministic-fixture",
    artifact_mode: "fixture",
    evidence_mode: "deterministic-fixture",
    host_mode: "deterministic-fixture",
    artifact_source: "",
    evidence_source: "",
    host_source: "",
    trigger_source: "",
    baseline_digest: "",
    with_skill_digest: "",
    checks_digest: "",
    host_digest: "",
    trigger_digest: "",
    ...overrides,
  };
}

function artifactDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function bytesDigest(value: Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalDigest(value: Json): string {
  const encoded = Buffer.from(jsonDumps(value, { ensureAscii: false, separators: [",", ":"], sortKeys: true }), "utf8");
  return bytesDigest(encoded);
}

function caseDict(c: TriggerCase): JsonObj {
  return { case_id: c.case_id, prompt: c.prompt, expected: c.expected };
}

function requirementsDict(r: PackageRequirements): JsonObj {
  return { companion_files: r.companion_files, script_execution: r.script_execution, runtime_extensions: [...r.runtime_extensions] };
}

function hostDict(h: HostCapabilities): JsonObj {
  return {
    name: h.name,
    loads_core_skill: h.loads_core_skill,
    preserves_companion_files: h.preserves_companion_files,
    runs_bundled_scripts: h.runs_bundled_scripts,
    supported_extensions: [...h.supported_extensions],
  };
}

function observationsDict(cases: readonly TriggerCase[], observations: Observations): JsonObj {
  const out: JsonObj = {};
  for (const c of cases) out[c.case_id] = [...obs(observations, c.case_id)];
  return out;
}

function evidenceDigest(scriptChecks: readonly EvidenceCheck[], safetyChecks: readonly EvidenceCheck[]): string {
  const payload: Json = {
    script_checks: scriptChecks.map(checkDict),
    safety_checks: safetyChecks.map(checkDict),
  };
  return canonicalDigest(payload);
}

function hostMatrixDigest(requirements: PackageRequirements, hosts: readonly HostCapabilities[]): string {
  const payload: Json = {
    requirements: requirementsDict(requirements),
    hosts: hosts.map(hostDict),
  };
  return canonicalDigest(payload);
}

function triggerResultsDigest(cases: readonly TriggerCase[], observations: Observations): string {
  triggerReportFromObservations(cases, observations);
  const payload: Json = {
    cases: cases.map(caseDict),
    observations: observationsDict(cases, observations),
  };
  return canonicalDigest(payload);
}

function localEvidenceRoot(
  cases: readonly TriggerCase[],
  observations: Observations,
  baselineArtifact: string,
  withSkillArtifact: string,
  contract: ArtifactContract,
  scriptChecks: readonly EvidenceCheck[],
  safetyChecks: readonly EvidenceCheck[],
  requirements: PackageRequirements,
  hosts: readonly HostCapabilities[],
  manifest: ReadonlyMap<string, string>,
  thresholds: ReleaseThresholds,
  provenance: EvaluationProvenance,
): string {
  triggerReportFromObservations(cases, observations);
  const manifestObj: JsonObj = {};
  for (const [k, v] of manifest) manifestObj[k] = v;
  const payload: Json = {
    triggers: {
      cases: cases.map(caseDict),
      observations: observationsDict(cases, observations),
    },
    artifacts: {
      baseline: baselineArtifact,
      withSkill: withSkillArtifact,
      contract: {
        required_headings: [...contract.required_headings],
        required_terms: [...contract.required_terms],
        forbidden_terms: [...contract.forbidden_terms],
      },
    },
    evidence: {
      scriptChecks: scriptChecks.map(checkDict),
      safetyChecks: safetyChecks.map(checkDict),
    },
    portability: {
      requirements: requirementsDict(requirements),
      minimumNativeHosts: thresholds.min_native_hosts,
      hosts: hosts.map(hostDict),
    },
    manifest: manifestObj,
    thresholds: thresholdsDict(thresholds),
    provenance: { ...provenance },
  };
  return canonicalDigest(payload);
}

function buildExternalAttestation(evidenceRoot: string): Buffer {
  if (!SHA256_PATTERN.test(evidenceRoot)) throw new ValueError("evidence root must be a SHA-256 digest");
  return Buffer.from(
    jsonDumps(
      { attestationVersion: ATTESTATION_VERSION, evidenceRoot },
      { ensureAscii: false, separators: [",", ":"], sortKeys: true },
    ),
    "utf8",
  );
}

function verifyExternalAttestation(
  evidenceRoot: string,
  attestationPayload: unknown,
  trustedAttestationDigest: string | null,
): JsonObj {
  const issues: string[] = [];
  if (attestationPayload === null) issues.push("trusted external attestation was not supplied");
  if (trustedAttestationDigest === null) issues.push("trusted attestation SHA-256 was not supplied out of band");
  if (issues.length > 0) return { valid: false, issues, attestation_digest: null };
  if (!Buffer.isBuffer(attestationPayload)) {
    return { valid: false, issues: ["external attestation payload must be bytes"], attestation_digest: null };
  }
  const trusted = trustedAttestationDigest as string;
  const actualDigest = bytesDigest(attestationPayload);
  if (!SHA256_PATTERN.test(trusted)) issues.push("trusted attestation SHA-256 has an invalid format");
  else if (actualDigest !== trusted) issues.push("external attestation does not match the trusted SHA-256");
  let decoded: unknown;
  try {
    decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(attestationPayload));
  } catch {
    issues.push("external attestation must be a UTF-8 JSON object");
    decoded = null;
  }
  if (decoded !== null) {
    if (typeof decoded !== "object" || Array.isArray(decoded)) {
      issues.push("external attestation root must be an object");
    } else {
      const record = decoded as { [key: string]: unknown };
      const version = record["attestationVersion"];
      if (typeof version !== "number" || !Number.isInteger(version) || version !== ATTESTATION_VERSION) {
        issues.push("attestationVersion must be the supported integer value 1");
      }
      if (record["evidenceRoot"] !== evidenceRoot) issues.push("external attestation evidenceRoot does not match");
    }
  }
  return { valid: issues.length === 0, issues, attestation_digest: actualDigest };
}

function evaluateProvenance(
  provenance: EvaluationProvenance,
  baselineArtifact: string,
  withSkillArtifact: string,
  scriptChecks: readonly EvidenceCheck[],
  safetyChecks: readonly EvidenceCheck[],
  requirements: PackageRequirements,
  hosts: readonly HostCapabilities[],
  cases: readonly TriggerCase[],
  observations: Observations,
): JsonObj {
  if (!["deterministic-fixture", "captured-observations"].includes(provenance.trigger_mode)) {
    throw new ValueError("unsupported trigger provenance mode");
  }
  if (!["fixture", "captured-artifacts"].includes(provenance.artifact_mode)) {
    throw new ValueError("unsupported artifact provenance mode");
  }
  if (!["deterministic-fixture", "captured-results"].includes(provenance.evidence_mode)) {
    throw new ValueError("unsupported evidence provenance mode");
  }
  if (!["deterministic-fixture", "captured-capabilities"].includes(provenance.host_mode)) {
    throw new ValueError("unsupported host provenance mode");
  }

  const issues: string[] = [];
  let triggerIntegrity = false;
  if (provenance.trigger_mode === "captured-observations") {
    const triggerIssueCount = issues.length;
    if (!provenance.trigger_source.trim()) issues.push("captured trigger observations need a non-empty source");
    if (provenance.trigger_digest !== triggerResultsDigest(cases, observations)) {
      issues.push("trigger observation digest does not match");
    }
    triggerIntegrity = issues.length === triggerIssueCount;
  }

  const artifactIssueCount = issues.length;
  let artifactIntegrity = false;
  if (provenance.artifact_mode === "captured-artifacts") {
    if (!provenance.artifact_source.trim()) issues.push("captured artifacts need a non-empty source");
    if (provenance.baseline_digest !== artifactDigest(baselineArtifact)) issues.push("artifact baseline digest does not match");
    if (provenance.with_skill_digest !== artifactDigest(withSkillArtifact)) issues.push("with-skill artifact digest does not match");
    artifactIntegrity = issues.length === artifactIssueCount;
  }

  const evidenceIssueCount = issues.length;
  let evidenceIntegrity = false;
  if (provenance.evidence_mode === "captured-results") {
    if (!provenance.evidence_source.trim()) issues.push("captured evidence needs a non-empty source");
    if (provenance.checks_digest !== evidenceDigest(scriptChecks, safetyChecks)) issues.push("evidence checks digest does not match");
    evidenceIntegrity = issues.length === evidenceIssueCount;
  }
  const hostIssueCount = issues.length;
  let hostIntegrity = false;
  if (provenance.host_mode === "captured-capabilities") {
    if (!provenance.host_source.trim()) issues.push("captured host capabilities need a non-empty source");
    if (provenance.host_digest !== hostMatrixDigest(requirements, hosts)) issues.push("host capability matrix digest does not match");
    hostIntegrity = issues.length === hostIssueCount;
  }
  return {
    triggerMode: provenance.trigger_mode,
    artifactMode: provenance.artifact_mode,
    evidenceMode: provenance.evidence_mode,
    hostMode: provenance.host_mode,
    triggerIntegrity,
    artifactIntegrity,
    evidenceIntegrity,
    hostIntegrity,
    issues,
  };
}

interface ReleaseGateOptions {
  packageRoot: string;
  cases: readonly TriggerCase[];
  router: Router;
  runs: number;
  baselineArtifact: string;
  withSkillArtifact: string;
  artifactContract: ArtifactContract;
  requirements: PackageRequirements;
  hosts: Iterable<HostCapabilities>;
  scriptChecks: readonly EvidenceCheck[];
  safetyChecks: readonly EvidenceCheck[];
  installedRoot: string;
  manifest: ReadonlyMap<string, string>;
  provenance?: EvaluationProvenance;
  thresholds?: ReleaseThresholds;
  attestationPayload?: Buffer | null;
  trustedAttestationDigest?: string | null;
}

function runReleaseGate(options: ReleaseGateOptions): JsonObj {
  const { packageRoot, cases, router, runs, baselineArtifact, withSkillArtifact, requirements } = options;
  const { scriptChecks, safetyChecks, installedRoot, manifest } = options;
  const provenance = options.provenance ?? evaluationProvenance();
  const thresholds = options.thresholds ?? releaseThresholds();
  const attestationPayload = options.attestationPayload ?? null;
  const trustedAttestationDigest = options.trustedAttestationDigest ?? null;
  validateTriggerCases(cases);
  if (cases.length === 0 || !cases.some((c) => c.expected) || !cases.some((c) => !c.expected)) {
    throw new ValueError("release gate requires positive and near-miss negative trigger cases");
  }
  const lint = lintPackage(packageRoot, requirements.runtime_extensions);
  const observations = repeatedRunObservations(cases, router, runs);
  const triggers = triggerReportFromObservations(cases, observations);
  const rates = ratesFromObservations(cases, observations);
  const artifacts = compareArtifacts(baselineArtifact, withSkillArtifact, options.artifactContract);
  const hostList = [...options.hosts];
  if (hostList.length === 0) throw new ValueError("release gate requires at least one host capability record");
  const portability = portabilityMatrix(requirements, hostList);
  const scripts = evaluateEvidenceChecks(scriptChecks, "script correctness");
  const safety = evaluateEvidenceChecks(safetyChecks, "safety");
  const sourceManifest = verifyManifest(packageRoot, manifest);
  let installedManifest = verifyManifest(installedRoot, manifest);
  const provenanceReport = evaluateProvenance(
    provenance,
    baselineArtifact,
    withSkillArtifact,
    scriptChecks,
    safetyChecks,
    requirements,
    hostList,
    cases,
    observations,
  );
  if (resolvePath(packageRoot) === resolvePath(installedRoot)) {
    installedManifest = {
      ...installedManifest,
      passed: false,
      issues: [...(installedManifest["issues"] as Json[]), "installed tree must be distinct from the source bundle"],
    };
  }
  const metrics = triggers["metrics"] as JsonObj;
  const nativeHosts = portability.filter((row) => row["status"] === "native").length;
  const rateValues = [...rates.values()];
  const minRate = rateValues.length > 0 ? Math.min(...rateValues) : 0.0;
  const withSkill = artifacts["with_skill"] as JsonObj;
  const checks: { [key: string]: boolean } = {
    structure: lint.valid,
    precision: (metrics["precision"] as PyFloat).value >= thresholds.min_precision,
    recall: (metrics["recall"] as PyFloat).value >= thresholds.min_recall,
    repeated_runs: minRate >= thresholds.min_repeat_rate,
    with_skill_artifact: Boolean(withSkill["passed"]),
    artifact_improvement: Boolean(artifacts["skill_improves_pass_state"]),
    script_correctness: Boolean(scripts["passed"]),
    safety: Boolean(safety["passed"]),
    source_manifest: Boolean(sourceManifest["passed"]),
    installed_tree: Boolean(installedManifest["passed"]),
    native_hosts: nativeHosts >= thresholds.min_native_hosts,
  };
  const checksPassed = Object.values(checks).every((v) => v);
  const fixturePassed =
    checksPassed &&
    provenanceReport["triggerMode"] === "deterministic-fixture" &&
    provenanceReport["artifactMode"] === "fixture" &&
    provenanceReport["evidenceMode"] === "deterministic-fixture" &&
    provenanceReport["hostMode"] === "deterministic-fixture";
  const localEvidenceReady =
    Boolean(provenanceReport["triggerIntegrity"]) &&
    Boolean(provenanceReport["artifactIntegrity"]) &&
    Boolean(provenanceReport["evidenceIntegrity"]) &&
    Boolean(provenanceReport["hostIntegrity"]);
  const evidenceRoot = localEvidenceRoot(
    cases,
    observations,
    baselineArtifact,
    withSkillArtifact,
    options.artifactContract,
    scriptChecks,
    safetyChecks,
    requirements,
    hostList,
    manifest,
    thresholds,
    provenance,
  );
  const trustAnchor = verifyExternalAttestation(evidenceRoot, attestationPayload, trustedAttestationDigest);
  const trustAnchorValid = Boolean(trustAnchor["valid"]);
  const productionReady = checksPassed && localEvidenceReady && trustAnchorValid;
  const ratesObj: JsonObj = {};
  for (const [k, v] of rates) ratesObj[k] = new PyFloat(v);
  return {
    passed: productionReady,
    checks_passed: checksPassed,
    fixture_passed: fixturePassed,
    local_evidence_ready: localEvidenceReady,
    trust_anchor_valid: trustAnchorValid,
    production_ready: productionReady,
    evidence_root: evidenceRoot,
    trust_anchor: trustAnchor,
    checks,
    provenance: provenanceReport,
    lint: {
      valid: lint.valid,
      references: [...lint.references],
      issues: lint.issues.map((issue) => ({ code: issue.code, message: issue.message })),
    },
    triggers,
    trigger_observations: observationsDict(cases, observations),
    repeated_run_rates: ratesObj,
    artifacts,
    scripts,
    safety,
    packaging: {
      source_manifest: sourceManifest,
      installed_tree: installedManifest,
    },
    portability: [...portability],
  };
}

function makeTempDir(prefix: string): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789_";
  const base = path.resolve(os.tmpdir());
  for (;;) {
    let suffix = "";
    for (let i = 0; i < 8; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    const candidate = path.join(base, prefix + suffix);
    try {
      fs.mkdirSync(candidate, { mode: 0o700 });
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
}

function copyTree(source: string, destination: string): void {
  fs.mkdirSync(destination);
  for (const name of fs.readdirSync(source)) {
    const from = path.join(source, name);
    const to = path.join(destination, name);
    if (isDir(from)) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

function demo(): void {
  const packageRoot = path.join(path.dirname(resolvePath(__filename)), "..", "outputs", "skill-release-gate");
  const cases = [
    triggerCase("positive-package", "evaluate this skill package before release", true),
    triggerCase("positive-trigger", "measure skill trigger precision and recall", true),
    triggerCase("positive-portability", "check bundle portability across hosts", true),
    triggerCase("near-release-notes", "publish release notes", false),
    triggerCase("near-model-eval", "evaluate model response quality", false),
    triggerCase("near-dependency", "install package dependencies", false),
  ];
  const router = new KeywordRouter(["skill", "package", "bundle", "trigger", "portability", "evaluate", "release"], 2);
  const contract = artifactContract({
    required_headings: ["Decision", "Evidence"],
    required_terms: ["precision", "recall"],
    forbidden_terms: ["guaranteed portable"],
  });
  const baseline = "Release looks fine.";
  const withSkill = "# Decision\n\nPass.\n\n# Evidence\n\nPrecision: 1.0. Recall: 1.0.";
  const hosts = [
    hostCapabilities("native-host", true, true, true),
    hostCapabilities("metadata-only-host", true, false, false),
    hostCapabilities("prompt-only-host", false, false, false),
  ];
  const scripts = [
    evidenceCheck("unit-fixtures", true, "Deterministic script fixtures passed."),
    evidenceCheck("repeat-run", true, "A repeated fixture run produced the same output."),
  ];
  const safety = [
    evidenceCheck("path-traversal", true, "Traversal reference was rejected."),
    evidenceCheck("undeclared-network", true, "No network authority was granted."),
    evidenceCheck("external-write", true, "No external write was attempted."),
  ];
  const manifest = buildManifest(packageRoot);
  const tempDir = makeTempDir("lesson-27-install-");
  let report: JsonObj;
  try {
    const installedRoot = path.join(tempDir, path.basename(packageRoot));
    copyTree(packageRoot, installedRoot);
    report = runReleaseGate({
      packageRoot,
      cases,
      router: (prompt, runIndex) => router.call(prompt, runIndex),
      runs: 5,
      baselineArtifact: baseline,
      withSkillArtifact: withSkill,
      artifactContract: contract,
      requirements: packageRequirements({ companion_files: true, script_execution: true }),
      hosts,
      scriptChecks: scripts,
      safetyChecks: safety,
      installedRoot,
      manifest,
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  console.log(jsonDumps(report, { indent: 2, sortKeys: true }));
}

demo();
