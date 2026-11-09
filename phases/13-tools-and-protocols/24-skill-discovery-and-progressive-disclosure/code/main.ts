// Lesson: Skill Discovery and Progressive Disclosure (phase 13 / lesson 24)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure/code/main.ts

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

interface DumpOptions {
  indent?: number;
  sortKeys?: boolean;
  separators?: [string, string];
  ensureAscii?: boolean;
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

function jsonDumps(value: Json, opts: DumpOptions = {}): string {
  const indent = opts.indent;
  const ensureAscii = opts.ensureAscii ?? true;
  const [itemSep, keySep] = opts.separators ?? (indent === undefined ? [", ", ": "] : [",", ": "]);
  const walk = (v: Json, level: number): string => {
    if (v === null) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return dumpString(v, ensureAscii);
    const isArray = Array.isArray(v);
    let items: string[];
    if (isArray) {
      items = v.map((x) => walk(x, level + 1));
    } else {
      let keys = Object.keys(v);
      if (opts.sortKeys) keys = keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
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

function pyLen(s: string): number {
  return Array.from(s).length;
}

function isSpace(ch: string): boolean {
  return ch !== "" && ch !== "\ufeff" && (/^\s$/u.test(ch) || /^[\x1c-\x1f\x85]$/.test(ch));
}

function stripChars(s: string, chars: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && chars.includes(s[start])) start++;
  while (end > start && chars.includes(s[end - 1])) end--;
  return s.slice(start, end);
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

function isSymlink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function exists(p: string): boolean {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
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

const FRONTMATTER_LIMIT = 8_192;
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9-]*$/;

interface Scope {
  name: string;
  root: string;
}

interface SkillCandidate {
  name: string;
  description: string;
  scope: string;
  directory: string;
  skill_path: string;
}

interface CatalogBudget {
  max_entries: number;
  max_description_chars: number;
  max_catalog_chars: number;
}

function catalogBudget(overrides: Partial<CatalogBudget> = {}): CatalogBudget {
  return { max_entries: 50, max_description_chars: 240, max_catalog_chars: 8_000, ...overrides };
}

interface CatalogEntry {
  name: string;
  description: string;
  scope: string;
  directory: string;
}

interface Collision {
  name: string;
  winner_scope: string;
  shadowed_scopes: string[];
}

function entryDict(entry: CatalogEntry): Json {
  return { name: entry.name, description: entry.description, scope: entry.scope, directory: entry.directory };
}

function collisionDict(c: Collision): Json {
  return { name: c.name, winner_scope: c.winner_scope, shadowed_scopes: [...c.shadowed_scopes] };
}

class Catalog {
  constructor(
    readonly entries: CatalogEntry[],
    readonly collisions: Collision[],
    readonly omitted: string[],
    readonly catalog_chars: number,
    readonly report_chars: number,
  ) {}

  modelDict(): Json {
    return { entries: this.entries.map(entryDict) };
  }

  toDict(): Json {
    return {
      entries: this.entries.map(entryDict),
      collisions: this.collisions.map(collisionDict),
      omitted: [...this.omitted],
      catalog_chars: this.catalog_chars,
      report_chars: this.report_chars,
    };
  }
}

class DiscoveryError extends Error {}

class CollisionError extends Error {}

class ReferencePathError extends Error {}

function frontmatter(filePath: string): Map<string, string> {
  const lines: string[] = [];
  let consumed = 0;
  const text = fs.readFileSync(filePath, "utf-8").replace(/\r\n?/g, "\n");
  const rawLines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const rawLine of rawLines) {
    consumed += Buffer.byteLength(rawLine, "utf-8");
    if (consumed > FRONTMATTER_LIMIT) throw new DiscoveryError(`frontmatter window exceeded for ${filePath}`);
    lines.push(rawLine.replace(/[\r\n]+$/, ""));
    if (lines.length > 1 && lines[lines.length - 1] === "---") break;
  }
  if (lines.length === 0 || lines[0] !== "---" || lines[lines.length - 1] !== "---") {
    throw new DiscoveryError(`invalid frontmatter delimiters in ${filePath}`);
  }
  const end = lines.length - 1;
  const fields: Map<string, string> = new Map();
  let index = 1;
  while (index < end) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith("#")) {
      index += 1;
      continue;
    }
    if (isSpace(line.slice(0, 1)) || !line.includes(":")) {
      throw new DiscoveryError(`malformed top-level line ${index + 1} in ${filePath}`);
    }
    const parts = splitOnce(line, ":");
    const key = parts[0].trim();
    let value = parts[1];
    if (!FIELD_PATTERN.test(key)) throw new DiscoveryError(`invalid frontmatter field ${pyStr(key)} in ${filePath}`);
    if (fields.has(key)) throw new DiscoveryError(`duplicate frontmatter field ${pyStr(key)} in ${filePath}`);
    value = value.trim();
    if (key === "metadata" && !value) {
      const nested: { [key: string]: Json } = {};
      index += 1;
      while (index < end && (!lines[index] || isSpace(lines[index].slice(0, 1)))) {
        const nestedLine = lines[index].trim();
        if (nestedLine) {
          if (!nestedLine.includes(":")) throw new DiscoveryError(`malformed metadata line ${index + 1} in ${filePath}`);
          const nestedParts = splitOnce(nestedLine, ":");
          const nestedKey = nestedParts[0].trim();
          if (!FIELD_PATTERN.test(nestedKey) || Object.prototype.hasOwnProperty.call(nested, nestedKey)) {
            throw new DiscoveryError(`invalid metadata field ${pyStr(nestedKey)} in ${filePath}`);
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
  if (!fields.get("name") || !fields.get("description")) {
    throw new DiscoveryError(`name and description are required in ${filePath}`);
  }
  return fields;
}

function discoverScope(scope: Scope): SkillCandidate[] {
  if (!exists(scope.root)) return [];
  const candidates: SkillCandidate[] = [];
  const names = fs.readdirSync(scope.root).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const entryName of names) {
    const directory = path.join(scope.root, entryName);
    const skillPath = path.join(directory, "SKILL.md");
    if (!isDir(directory) || isSymlink(directory)) continue;
    if (isSymlink(skillPath)) throw new DiscoveryError(`symlinked SKILL.md is not allowed: ${skillPath}`);
    if (!isFile(skillPath)) continue;
    const fields = frontmatter(skillPath);
    const name = fields.get("name") as string;
    const description = fields.get("description") as string;
    if (pyLen(name) > 64 || !NAME_PATTERN.test(name)) {
      throw new DiscoveryError(`frontmatter name ${pyStr(name)} is not valid portable kebab-case`);
    }
    if (pyLen(description) > 1024) throw new DiscoveryError(`description exceeds 1024 characters in ${skillPath}`);
    if (name !== entryName) {
      throw new DiscoveryError(`frontmatter name ${pyStr(name)} does not match directory ${pyStr(entryName)}`);
    }
    candidates.push({
      name,
      description,
      scope: scope.name,
      directory: resolvePath(directory),
      skill_path: resolvePath(skillPath),
    });
  }
  return candidates;
}

function compareTuple(a: (number | string)[], b: (number | string)[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

function resolveCollisions(candidates: Iterable<SkillCandidate>, precedence: string[]): [SkillCandidate[], Collision[]] {
  const rank: Map<string, number> = new Map(precedence.map((scope, index) => [scope, index]));
  const grouped: Map<string, SkillCandidate[]> = new Map();
  for (const candidate of candidates) {
    if (!rank.has(candidate.scope)) throw new CollisionError(`scope ${pyStr(candidate.scope)} is missing from host policy`);
    const group = grouped.get(candidate.name) ?? [];
    group.push(candidate);
    grouped.set(candidate.name, group);
  }

  const winners: SkillCandidate[] = [];
  const collisions: Collision[] = [];
  const names = [...grouped.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const name of names) {
    const options = [...(grouped.get(name) as SkillCandidate[])].sort((a, b) =>
      compareTuple([rank.get(a.scope) as number, a.directory], [rank.get(b.scope) as number, b.directory]),
    );
    const topRank = rank.get(options[0].scope);
    const tied = options.filter((option) => rank.get(option.scope) === topRank);
    if (tied.length > 1) {
      const paths = tied.map((option) => option.directory).join(", ");
      throw new CollisionError(`ambiguous ${pyStr(name)} at equal precedence: ${paths}`);
    }
    winners.push(options[0]);
    if (options.length > 1) {
      collisions.push({
        name,
        winner_scope: options[0].scope,
        shadowed_scopes: options.slice(1).map((option) => option.scope),
      });
    }
  }
  return [winners, collisions];
}

function shorten(text: string, limit: number): string {
  if (limit < 1) return "";
  const chars = Array.from(text);
  if (chars.length <= limit) return text;
  if (limit === 1) return "…";
  return chars.slice(0, limit - 1).join("").trimEnd() + "…";
}

function buildCatalog(candidates: Iterable<SkillCandidate>, precedence: string[], budget: CatalogBudget): Catalog {
  if (Math.min(budget.max_entries, budget.max_description_chars, budget.max_catalog_chars) < 1) {
    throw new Error("catalog budgets must be positive");
  }
  const [winners, collisions] = resolveCollisions(candidates, precedence);
  const rank: Map<string, number> = new Map(precedence.map((scope, index) => [scope, index]));
  const ordered = [...winners].sort((a, b) =>
    compareTuple([rank.get(a.scope) as number, a.name], [rank.get(b.scope) as number, b.name]),
  );
  const entries: CatalogEntry[] = ordered.slice(0, budget.max_entries).map((candidate) => ({
    name: candidate.name,
    description: shorten(candidate.description, budget.max_description_chars),
    scope: candidate.scope,
    directory: candidate.directory,
  }));
  const omitted = ordered.slice(budget.max_entries).map((candidate) => candidate.name);

  const modelSize = (currentEntries: CatalogEntry[]): number => {
    const payload: Json = { entries: currentEntries.map(entryDict) };
    return jsonDumps(payload, { sortKeys: true, separators: [",", ":"] }).length;
  };

  let used = modelSize(entries);
  while (used > budget.max_catalog_chars && entries.length > 0) {
    const removed = entries.pop() as CatalogEntry;
    omitted.unshift(removed.name);
    used = modelSize(entries);
  }
  if (used > budget.max_catalog_chars) throw new Error("model-facing catalog exceeds max_catalog_chars");

  let reportChars = 0;
  for (;;) {
    const report = new Catalog([...entries], collisions, [...omitted], used, reportChars);
    const measured = jsonDumps(report.toDict(), { sortKeys: true, separators: [",", ":"] }).length;
    if (measured === reportChars) return report;
    reportChars = measured;
  }
}

function candidateFor(entry: CatalogEntry, candidates: Iterable<SkillCandidate>): SkillCandidate {
  for (const candidate of candidates) {
    if (candidate.name === entry.name && candidate.directory === entry.directory) return candidate;
  }
  throw new Error(`catalog entry ${pyStr(entry.name)} has no matching candidate`);
}

function loadSkillBody(entry: CatalogEntry, candidates: Iterable<SkillCandidate>, maxChars = 12_000): string {
  const candidate = candidateFor(entry, candidates);
  const text = fs.readFileSync(candidate.skill_path, "utf-8");
  const lines = pySplitlines(text);
  const end = lines.indexOf("---", 1);
  if (end < 0) throw new Error("'---' is not in list");
  const body = lines.slice(end + 1).join("\n").trim();
  if (pyLen(body) > maxChars) throw new DiscoveryError(`skill body exceeds ${maxChars} characters`);
  return body;
}

function validateReference(skillDirectory: string, reference: unknown): string {
  if (typeof reference !== "string") throw new ReferencePathError("reference must be a string");
  if (reference.includes("\\")) throw new ReferencePathError("references must use portable forward slashes");
  const absolute = reference.startsWith("/");
  const parts = reference.split("/").filter((part) => part !== "" && part !== ".");
  if (absolute || parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new ReferencePathError("reference must be a clean relative path");
  }
  if (parts.length > 2) throw new ReferencePathError("reference may be at most one directory deep");
  const root = resolvePath(skillDirectory);
  let unresolved = root;
  for (const part of parts) {
    unresolved = path.join(unresolved, part);
    if (isSymlink(unresolved)) throw new ReferencePathError("reference path cannot contain symlinks");
  }
  const target = resolvePath(unresolved);
  if (target === root || !target.startsWith(root.endsWith(path.sep) ? root : root + path.sep)) {
    throw new ReferencePathError("reference escapes the skill directory");
  }
  if (!isFile(target)) throw new ReferencePathError("reference must resolve to a regular file");
  return target;
}

function loadReference(entry: CatalogEntry, reference: string, maxChars = 12_000): string {
  const target = validateReference(entry.directory, reference);
  const content = fs.readFileSync(target, "utf-8");
  if (pyLen(content) > maxChars) throw new ReferencePathError(`reference exceeds ${maxChars} characters`);
  return content;
}

function writeSkill(root: string, name: string, description: string, body: string): void {
  const directory = path.join(root, name);
  fs.mkdirSync(path.join(directory, "references"), { recursive: true });
  fs.writeFileSync(path.join(directory, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`, "utf-8");
  fs.writeFileSync(path.join(directory, "references", "format.md"), "# Format\n\nReturn JSON with an evidence array.\n", "utf-8");
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

function demo(): void {
  const tempDir = makeTempDir("lesson-24-");
  let result: Json;
  try {
    const base = tempDir;
    const userRoot = path.join(base, "user");
    const projectRoot = path.join(base, "project");
    writeSkill(
      userRoot,
      "evidence-report",
      "Create a general evidence report when findings need citations.",
      "# Evidence report\n\nRead `references/format.md` when formatting the result.",
    );
    writeSkill(
      projectRoot,
      "evidence-report",
      "Create this project's evidence report when an audit completes.",
      "# Project evidence report\n\nRead `references/format.md` for the schema.",
    );
    writeSkill(
      userRoot,
      "meeting-brief",
      "Prepare a meeting brief from supplied notes.",
      "# Meeting brief\n\nSeparate decisions from open questions.",
    );
    const candidates = [
      ...discoverScope({ name: "project", root: projectRoot }),
      ...discoverScope({ name: "user", root: userRoot }),
    ];
    const catalog = buildCatalog(candidates, ["project", "user"], catalogBudget({ max_entries: 10, max_catalog_chars: 2_000 }));
    const selected = catalog.entries.find((entry) => entry.name === "evidence-report");
    if (selected === undefined) throw new Error("StopIteration");
    const body = loadSkillBody(selected, candidates);
    const reference = loadReference(selected, "references/format.md");
    result = {
      catalog: catalog.toDict(),
      disclosure: {
        level_1_catalog_chars: catalog.catalog_chars,
        level_2_body_chars: pyLen(body),
        level_3_reference_chars: pyLen(reference),
      },
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  console.log(jsonDumps(result, { indent: 2, sortKeys: true }));
}

demo();
