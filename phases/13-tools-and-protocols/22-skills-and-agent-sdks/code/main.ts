// Lesson: Agent Skills: Portable Contract and Runtime Boundary (phase 13 / lesson 22)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/22-skills-and-agent-sdks/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/22-skills-and-agent-sdks/code/main.ts

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

type FieldValue = string | { [key: string]: string };
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const CORE_FIELDS = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function pyJsonString(s: string): string {
  return JSON.stringify(s).replace(/[\u0080-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

function pyJson(value: Json, indent?: number, level = 0): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyJsonString(value);
  const itemSep = indent === undefined ? ", " : ",";
  const pad = indent === undefined ? "" : "\n" + " ".repeat(indent * (level + 1));
  const end = indent === undefined ? "" : "\n" + " ".repeat(indent * level);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return "[" + value.map((v) => pad + pyJson(v, indent, level + 1)).join(itemSep) + end + "]";
  }
  const keys = Object.keys(value);
  if (keys.length === 0) return "{}";
  return "{" + keys.map((k) => pad + pyJsonString(k) + ": " + pyJson(value[k], indent, level + 1)).join(itemSep) + end + "}";
}

function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const c of s) {
    if (c === "\\") out += "\\\\";
    else if (c === quote) out += "\\" + c;
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else if (c === "\t") out += "\\t";
    else if (c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f) out += "\\x" + c.charCodeAt(0).toString(16).padStart(2, "0");
    else out += c;
  }
  return quote + out + quote;
}

function pyIsSpace(c: string): boolean {
  const code = c.codePointAt(0) ?? 0;
  if (code === 0xfeff) return false;
  return /\s/u.test(c) || (code >= 0x1c && code <= 0x1f) || code === 0x85;
}

function pyLstrip(value: string): string {
  const chars = [...value];
  let start = 0;
  while (start < chars.length && pyIsSpace(chars[start])) start += 1;
  return chars.slice(start).join("");
}

function pyStrip(value: string): string {
  const chars = [...pyLstrip(value)];
  let end = chars.length;
  while (end > 0 && pyIsSpace(chars[end - 1])) end -= 1;
  return chars.slice(0, end).join("");
}

function pySplitlines(text: string): string[] {
  const parts = text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

function pyLen(value: string): number {
  return [...value].length;
}

function pySorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

class ValidationIssue {
  constructor(
    public readonly code: string,
    public readonly message: string,
  ) {}
}

class SkillReport {
  constructor(
    public readonly valid: boolean,
    public readonly name: string | null,
    public readonly description: string | null,
    public readonly body: string,
    public readonly core_fields: readonly string[],
    public readonly runtime_extensions: readonly string[],
    public readonly issues: readonly ValidationIssue[],
  ) {}

  to_dict(): { [key: string]: Json } {
    return {
      valid: this.valid,
      name: this.name,
      description: this.description,
      body: this.body,
      core_fields: [...this.core_fields],
      runtime_extensions: [...this.runtime_extensions],
      issues: this.issues.map((issue) => ({ code: issue.code, message: issue.message })),
    };
  }
}

class ValueError extends Error {}

class FrontmatterSyntaxError extends ValueError {}

class JSONDecodeError extends ValueError {}

function decodeJsonString(value: string): string {
  const escapes: { [key: string]: string } = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
  const readHex = (at: number): number => {
    const digits = value.slice(at, at + 4);
    if (!/^[0-9a-fA-F]{4}$/.test(digits)) throw new JSONDecodeError("Invalid \\uXXXX escape");
    return Number.parseInt(digits, 16);
  };
  let out = "";
  let pos = 1;
  let closed = false;
  while (pos < value.length) {
    const c = value[pos];
    if (c === '"') {
      closed = true;
      pos += 1;
      break;
    }
    if (c.charCodeAt(0) < 0x20) throw new JSONDecodeError("Invalid control character at");
    if (c !== "\\") {
      out += c;
      pos += 1;
      continue;
    }
    if (pos + 1 >= value.length) throw new JSONDecodeError("Unterminated string starting at");
    const esc = value[pos + 1];
    if (esc !== "u") {
      if (!(esc in escapes)) throw new JSONDecodeError("Invalid \\escape");
      out += escapes[esc];
      pos += 2;
      continue;
    }
    let code = readHex(pos + 2);
    pos += 6;
    if (code >= 0xd800 && code <= 0xdbff && value.slice(pos, pos + 2) === "\\u") {
      const low = readHex(pos + 2);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        pos += 6;
      }
    }
    out += String.fromCodePoint(code);
  }
  if (!closed) throw new JSONDecodeError("Unterminated string starting at");
  while (pos < value.length && " \t\n\r".includes(value[pos])) pos += 1;
  if (pos !== value.length) throw new JSONDecodeError("Extra data");
  return out;
}

function _decode_scalar(raw: string): string {
  const value = pyStrip(raw);
  if (!value) return "";
  if (value.startsWith('"')) {
    try {
      return decodeJsonString(value);
    } catch (error) {
      if (error instanceof JSONDecodeError) throw new FrontmatterSyntaxError(`invalid quoted scalar: ${error.message}`);
      throw error;
    }
  }
  if (value.startsWith("'")) {
    if (pyLen(value) < 2 || !value.endsWith("'")) throw new FrontmatterSyntaxError("unterminated single-quoted scalar");
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if ("[{&*!".includes(value[0])) throw new FrontmatterSyntaxError("unsupported YAML construct in portable subset");
  return value;
}

function startsWithSpace(line: string): boolean {
  return line.length > 0 && pyIsSpace([...line][0]);
}

function splitOnce(line: string): [string, string] {
  const at = line.indexOf(":");
  return [line.slice(0, at), line.slice(at + 1)];
}

function parse_frontmatter(text: string): [Map<string, FieldValue>, string] {
  const lines = pySplitlines(text);
  if (lines.length === 0 || lines[0] !== "---") {
    throw new FrontmatterSyntaxError("SKILL.md must begin with an exact --- line");
  }
  const end = lines.indexOf("---", 1);
  if (end < 0) throw new FrontmatterSyntaxError("frontmatter needs a closing --- line");

  const metadata: Map<string, FieldValue> = new Map();
  let index = 1;
  while (index < end) {
    const line = lines[index];
    if (!pyStrip(line) || pyLstrip(line).startsWith("#")) {
      index += 1;
      continue;
    }
    if (startsWithSpace(line) || !line.includes(":")) {
      throw new FrontmatterSyntaxError(`malformed top-level line ${index + 1}`);
    }
    const [rawKey, raw_value] = splitOnce(line);
    const key = pyStrip(rawKey);
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(key)) throw new FrontmatterSyntaxError(`invalid field name ${pyStrRepr(key)}`);
    if (metadata.has(key)) throw new FrontmatterSyntaxError(`duplicate field ${pyStrRepr(key)}`);

    const value = pyStrip(raw_value);
    if (value === ">" || value === "|") {
      const block: string[] = [];
      index += 1;
      while (index < end && (!lines[index] || startsWithSpace(lines[index]))) {
        block.push(pyLstrip(lines[index]));
        index += 1;
      }
      metadata.set(key, pyStrip(block.join(value === ">" ? " " : "\n")));
      continue;
    }
    if (key === "metadata" && !value) {
      const nested: { [key: string]: string } = {};
      index += 1;
      while (index < end && (!lines[index] || startsWithSpace(lines[index]))) {
        const nested_line = pyStrip(lines[index]);
        if (nested_line) {
          if (!nested_line.includes(":")) throw new FrontmatterSyntaxError(`malformed metadata line ${index + 1}`);
          const [rawNestedKey, nested_value] = splitOnce(nested_line);
          const nested_key = pyStrip(rawNestedKey);
          if (Object.prototype.hasOwnProperty.call(nested, nested_key)) {
            throw new FrontmatterSyntaxError(`duplicate metadata field ${pyStrRepr(nested_key)}`);
          }
          nested[nested_key] = _decode_scalar(nested_value);
        }
        index += 1;
      }
      metadata.set(key, nested);
      continue;
    }
    metadata.set(key, _decode_scalar(value));
    index += 1;
  }

  const body = pyStrip(lines.slice(end + 1).join("\n"));
  return [metadata, body];
}

function validate_skill_text(text: string, directory_name: string, allowed_runtime_extensions: Iterable<string> = []): SkillReport {
  const issues: ValidationIssue[] = [];
  let fields: Map<string, FieldValue>;
  let body: string;
  try {
    [fields, body] = parse_frontmatter(text);
  } catch (error) {
    if (!(error instanceof FrontmatterSyntaxError)) throw error;
    const issue = new ValidationIssue("frontmatter-syntax", error.message);
    return new SkillReport(false, null, null, "", [], [], [issue]);
  }

  const name_value = fields.get("name");
  const description_value = fields.get("description");
  const name = typeof name_value === "string" ? name_value : null;
  const description = typeof description_value === "string" ? description_value : null;

  if (!name) {
    issues.push(new ValidationIssue("name-required", "name must be a non-empty string"));
  } else if (pyLen(name) > 64) {
    issues.push(new ValidationIssue("name-too-long", "name must be at most 64 characters"));
  } else if (!NAME_PATTERN.test(name)) {
    issues.push(new ValidationIssue("name-format", "name must use lowercase letters, digits, and single hyphens"));
  } else if (name !== directory_name) {
    issues.push(
      new ValidationIssue("directory-mismatch", `name ${pyStrRepr(name)} must match directory ${pyStrRepr(directory_name)}`),
    );
  }

  if (!description || !pyStrip(description)) {
    issues.push(new ValidationIssue("description-required", "description must explain when to use the skill"));
  } else if (pyLen(description) > 1024) {
    issues.push(new ValidationIssue("description-too-long", "description must be at most 1024 characters"));
  }

  if (fields.has("compatibility")) {
    const compatibility = fields.get("compatibility");
    if (typeof compatibility !== "string" || !pyStrip(compatibility)) {
      issues.push(new ValidationIssue("compatibility-empty", "compatibility must be a non-empty string when provided"));
    } else if (pyLen(compatibility) > 500) {
      issues.push(new ValidationIssue("compatibility-too-long", "compatibility must be at most 500 characters"));
    }
  }

  if (fields.has("metadata")) {
    const metadata = fields.get("metadata");
    if (
      typeof metadata !== "object" ||
      metadata === null ||
      !Object.entries(metadata).every(([key, value]) => typeof key === "string" && typeof value === "string")
    ) {
      issues.push(new ValidationIssue("metadata-shape", "metadata must map string keys to string values"));
    }
  }

  if (fields.has("allowed-tools")) {
    const allowed_tools = fields.get("allowed-tools");
    if (typeof allowed_tools !== "string" || !pyStrip(allowed_tools)) {
      issues.push(new ValidationIssue("allowed-tools-shape", "allowed-tools must be a non-empty space-separated string"));
    }
  }
  if (!body) issues.push(new ValidationIssue("body-required", "SKILL.md needs instruction content"));

  const extension_names = pySorted([...fields.keys()].filter((field) => !CORE_FIELDS.has(field)));
  const allowed = new Set(allowed_runtime_extensions);
  for (const field of extension_names) {
    if (!allowed.has(field)) {
      issues.push(
        new ValidationIssue("unsupported-runtime-field", `${pyStrRepr(field)} is not part of the portable contract or this host policy`),
      );
    }
  }

  return new SkillReport(
    issues.length === 0,
    name,
    description,
    body,
    pySorted([...fields.keys()].filter((field) => CORE_FIELDS.has(field))),
    extension_names,
    issues,
  );
}

class TaskShape {
  readonly repeatable_method: boolean;
  readonly repository_default: boolean;
  readonly external_capability: boolean;
  readonly lifecycle_event: boolean;
  readonly deterministic_logic: boolean;
  readonly isolated_delegation: boolean;

  constructor(
    options: {
      repeatable_method?: boolean;
      repository_default?: boolean;
      external_capability?: boolean;
      lifecycle_event?: boolean;
      deterministic_logic?: boolean;
      isolated_delegation?: boolean;
    } = {},
  ) {
    this.repeatable_method = options.repeatable_method ?? false;
    this.repository_default = options.repository_default ?? false;
    this.external_capability = options.external_capability ?? false;
    this.lifecycle_event = options.lifecycle_event ?? false;
    this.deterministic_logic = options.deterministic_logic ?? false;
    this.isolated_delegation = options.isolated_delegation ?? false;
  }
}

function select_primitives(task: TaskShape): string[] {
  const choices: string[] = [];
  if (task.repository_default) choices.push("AGENTS.md");
  if (task.repeatable_method) choices.push("Agent Skill");
  if (task.external_capability) choices.push("MCP tool");
  if (task.lifecycle_event) choices.push("hook");
  if (task.deterministic_logic) choices.push("ordinary code");
  if (task.isolated_delegation) choices.push("subagent");
  return choices.length > 0 ? choices : ["prompt"];
}

function demo(): void {
  const portable_example = `---
name: incident-summary
description: Summarize an incident timeline when the user supplies event notes.
metadata:
  owner: reliability
---

# Incident summary

Preserve timestamps and separate observations from inferences.
`;
  const host_extended_example = portable_example.replace("description:", "user-invocable: true\ndescription:");
  const invalid_example = portable_example.replace("name: incident-summary", "name: Incident_Summary");
  const temp_dir = mkdtempSync(join(tmpdir(), "lesson-22-"));
  let portable_report: SkillReport;
  let host_report: SkillReport;
  let invalid_report: SkillReport;
  try {
    const portable_dir = join(temp_dir, "incident-summary");
    mkdirSync(portable_dir);
    const portable_path = join(portable_dir, "SKILL.md");
    writeFileSync(portable_path, portable_example, { encoding: "utf-8" });
    portable_report = validate_skill_text(readFileSync(portable_path, { encoding: "utf-8" }), basename(portable_dir));
    host_report = validate_skill_text(host_extended_example, "incident-summary", new Set(["user-invocable"]));
    invalid_report = validate_skill_text(invalid_example, "incident-summary");
  } finally {
    rmSync(temp_dir, { recursive: true, force: true });
  }

  const result: Json = {
    validation: portable_report.to_dict(),
    validation_cases: {
      portable_core: portable_report.to_dict(),
      host_extended: host_report.to_dict(),
      invalid_package: invalid_report.to_dict(),
    },
    decision_examples: {
      one_off_rewrite: select_primitives(new TaskShape()),
      repeatable_repo_workflow_with_api: select_primitives(
        new TaskShape({
          repeatable_method: true,
          repository_default: true,
          external_capability: true,
        }),
      ),
      post_test_automation: select_primitives(new TaskShape({ lifecycle_event: true })),
      schema_normalization: select_primitives(new TaskShape({ deterministic_logic: true })),
      parallel_isolated_research: select_primitives(new TaskShape({ isolated_delegation: true })),
    },
  };
  console.log(pyJson(result, 2));
}

demo();
