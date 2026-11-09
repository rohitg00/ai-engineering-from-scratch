// Lesson: Runtime Feedback Loops (phase 14 / lesson 37)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/37-runtime-feedback-loops/docs/en.md
// Run: npx tsx phases/14-agent-engineering/37-runtime-feedback-loops/code/main.ts

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { performance } from "node:perf_hooks";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const HERE = __dirname;
const RECORD = join(HERE, "feedback_record.jsonl");

const HEAD_LINES = 5;
const TAIL_LINES = 30;
const ROTATE_BYTES = 1 * 1024 * 1024;
const MAX_ROTATIONS = 5;

const REDACTION_PATTERNS: [RegExp, (m: string, g1: unknown) => string][] = [
  [/bearer\s+[A-Za-z0-9._\-]+/gi, () => "Bearer [REDACTED]"],
  [/\b(password|passwd|secret|api[_-]?key|access[_-]?key|token)\s*[:=]\s*\S+/gi, (_m, g1) => `${g1}=[REDACTED]`],
  [/\bAKIA[0-9A-Z]{16}\b/g, () => "AKIA[REDACTED]"],
  [/\bxox[baprs]-[A-Za-z0-9\-]+/g, () => "xox-[REDACTED]"],
  [/-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g, () => "[REDACTED PRIVATE KEY]"],
];

interface FeedbackRecord {
  command_id: string;
  parent_command_id: string | null;
  command: string[];
  stdout_tail: string;
  stderr_tail: string;
  exit_code: number | null;
  duration_ms: number;
  started_at: number;
  agent_note: string;
  error: string | null;
  truncations: { [key: string]: number };
  redactions: { [key: string]: number };
}

const RECORD_FIELDS = [
  "command_id",
  "parent_command_id",
  "command",
  "stdout_tail",
  "stderr_tail",
  "exit_code",
  "duration_ms",
  "started_at",
  "agent_note",
  "error",
  "truncations",
  "redactions",
];
const REQUIRED_FIELDS = RECORD_FIELDS.slice(0, 9);

function pyStr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return quote + out + quote;
}

function pyDict(d: { [key: string]: number }): string {
  return "{" + Object.entries(d).map(([k, v]) => `${pyStr(k)}: ${v}`).join(", ") + "}";
}

function pyFloat(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function pyDumps(value: Json): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value).replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  }
  if (Array.isArray(value)) {
    return "[" + value.map(pyDumps).join(", ") + "]";
  }
  return "{" + Object.entries(value).map(([k, v]) => `${pyDumps(k)}: ${pyDumps(v)}`).join(", ") + "}";
}

function nowSeconds(): number {
  return (performance.timeOrigin + performance.now()) / 1000;
}

function splitlines(text: string): string[] {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function redact(text: string): [string, number] {
  if (!text) {
    return [text, 0];
  }
  let hits = 0;
  let out = text;
  for (const [pattern, replacement] of REDACTION_PATTERNS) {
    out = out.replace(pattern, (m: string, g1: unknown) => {
      hits += 1;
      return replacement(m, g1);
    });
  }
  return [out, hits];
}

function deterministicTail(text: string, head = HEAD_LINES, tail = TAIL_LINES): [string, number] {
  const lines = splitlines(text);
  if (lines.length <= head + tail) {
    return [text, 0];
  }
  const cut = lines.length - head - tail;
  return [[...lines.slice(0, head), `...truncated ${cut} lines...`, ...lines.slice(lines.length - tail)].join("\n"), cut];
}

function processCapture(text: string): [string, number, number] {
  const [tailed, cut] = deterministicTail(text);
  const [redacted, hits] = redact(tailed);
  return [redacted, cut, hits];
}

function rotationPath(idx: number): string {
  return idx === 0 ? RECORD : `${RECORD}.${idx}`;
}

function maybeRotate(): void {
  if (!existsSync(RECORD) || statSync(RECORD).size < ROTATE_BYTES) {
    return;
  }
  for (let idx = MAX_ROTATIONS; idx > 0; idx--) {
    const src = rotationPath(idx - 1);
    const dst = rotationPath(idx);
    if (existsSync(src)) {
      if (idx === MAX_ROTATIONS && existsSync(dst)) {
        unlinkSync(dst);
      }
      try {
        renameSync(src, dst);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    }
  }
}

function runWithFeedback(
  command: string[],
  agentNote = "",
  timeoutS = 30.0,
  parentCommandId: string | null = null,
): FeedbackRecord {
  const started = nowSeconds();
  const commandId = randomUUID().replace(/-/g, "").slice(0, 12);
  const base = {
    command_id: commandId,
    parent_command_id: parentCommandId,
    command,
    started_at: started,
    agent_note: agentNote,
  };
  const elapsedMs = (): number => Math.trunc((nowSeconds() - started) * 1000);
  const completed = spawnSync(command[0], command.slice(1), { encoding: "utf8", timeout: timeoutS * 1000 });
  const errCode = completed.error ? (completed.error as NodeJS.ErrnoException).code : undefined;
  let record: FeedbackRecord;
  if (errCode === "ENOENT") {
    record = {
      command_id: base.command_id,
      parent_command_id: base.parent_command_id,
      command: base.command,
      stdout_tail: "",
      stderr_tail: "",
      exit_code: null,
      duration_ms: elapsedMs(),
      started_at: base.started_at,
      agent_note: base.agent_note,
      error: `[Errno 2] No such file or directory: ${pyStr(command[0])}`,
      truncations: {},
      redactions: {},
    };
  } else if (completed.error && errCode !== "ETIMEDOUT") {
    throw completed.error;
  } else {
    const timedOut = errCode === "ETIMEDOUT";
    const [out, cutOut, redOut] = processCapture(completed.stdout ?? "");
    const [err, cutErr, redErr] = processCapture(completed.stderr ?? "");
    record = {
      command_id: base.command_id,
      parent_command_id: base.parent_command_id,
      command: base.command,
      stdout_tail: out,
      stderr_tail: err,
      exit_code: timedOut ? null : completed.status,
      duration_ms: elapsedMs(),
      started_at: base.started_at,
      agent_note: base.agent_note,
      error: timedOut ? `timeout after ${pyFloat(timeoutS)}s` : null,
      truncations: { stdout: cutOut, stderr: cutErr },
      redactions: { stdout: redOut, stderr: redErr },
    };
  }

  maybeRotate();
  appendFileSync(RECORD, pyDumps(record as unknown as Json) + "\n");
  return record;
}

function loopCanAdvance(record: FeedbackRecord): boolean {
  return record.exit_code !== null;
}

function asRecord(value: unknown): FeedbackRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (!keys.every((k) => RECORD_FIELDS.includes(k))) return null;
  if (!REQUIRED_FIELDS.every((k) => keys.includes(k))) return null;
  const obj = value as { [key: string]: unknown };
  return {
    command_id: obj.command_id as string,
    parent_command_id: obj.parent_command_id as string | null,
    command: obj.command as string[],
    stdout_tail: obj.stdout_tail as string,
    stderr_tail: obj.stderr_tail as string,
    exit_code: obj.exit_code as number | null,
    duration_ms: obj.duration_ms as number,
    started_at: obj.started_at as number,
    agent_note: obj.agent_note as string,
    error: "error" in obj ? (obj.error as string | null) : null,
    truncations: "truncations" in obj ? (obj.truncations as { [key: string]: number }) : {},
    redactions: "redactions" in obj ? (obj.redactions as { [key: string]: number }) : {},
  };
}

function loadAll(): FeedbackRecord[] {
  const recordName = basename(RECORD);
  const rotationKey = (name: string): number => {
    const suffix = name.slice(recordName.length);
    if (!suffix) {
      return 0;
    }
    const digits = suffix.replace(/^\.+/, "");
    return /^\s*[+-]?\d+\s*$/.test(digits) ? parseInt(digits, 10) : 99;
  };
  const names = readdirSync(HERE).filter((n) => n.startsWith(recordName));
  const paths = names
    .map((n, i) => ({ n, i, k: rotationKey(n) }))
    .sort((a, b) => b.k - a.k || a.i - b.i)
    .map((e) => join(HERE, e.n));
  const byId = new Map<string, FeedbackRecord>();
  for (const path of paths) {
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw err;
    }
    for (const line of splitlines(text)) {
      if (!line.trim()) {
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      const record = asRecord(parsed);
      if (record === null) {
        continue;
      }
      byId.set(record.command_id, record);
    }
  }
  return [...byId.values()];
}

function retryChain(commandId: string): FeedbackRecord[] {
  const records = new Map(loadAll().map((r) => [r.command_id, r] as const));
  const chain: FeedbackRecord[] = [];
  let cursor: string | null = commandId;
  while (cursor && records.has(cursor)) {
    const rec: FeedbackRecord = records.get(cursor) as FeedbackRecord;
    chain.push(rec);
    cursor = rec.parent_command_id;
  }
  return chain.reverse();
}

function main(): void {
  for (const name of readdirSync(HERE)) {
    if (name.startsWith("feedback_record.jsonl")) {
      unlinkSync(join(HERE, name));
    }
  }

  const ok = runWithFeedback(["node", "-e", "console.log('hello')"], "expect hello");
  const leak = runWithFeedback(
    ["node", "-e", "console.log('Authorization: Bearer ya29.AbCdEf'); console.log('password=hunter2'); console.log('AKIAIOSFODNN7EXAMPLE')"],
    "expect redaction",
  );
  const fail = runWithFeedback(["node", "-e", "process.exit(2)"], "first attempt; will retry");
  const retry = runWithFeedback(["node", "-e", "console.log('recovered'); process.exit(0)"], "retry after non-zero", 30.0, fail.command_id);
  const missing = runWithFeedback(["does-not-exist".split(/\s+/)[0]], "probe missing binary");

  const cases: [string, FeedbackRecord][] = [
    ["ok", ok],
    ["leak", leak],
    ["fail", fail],
    ["retry", retry],
    ["missing", missing],
  ];
  for (const [label, rec] of cases) {
    const redactions = Object.keys(rec.redactions).length > 0 ? pyDict(rec.redactions) : "-";
    const exit = rec.exit_code === null ? "None" : String(rec.exit_code);
    console.log(
      `${label}: cid=${rec.command_id} parent=${rec.parent_command_id || "-"} exit=${exit} ` +
        `duration_ms=${rec.duration_ms} redactions=${redactions}`,
    );
    if (rec.error) {
      console.log(`  error: ${rec.error}`);
    }
    if (rec.stdout_tail && rec.stdout_tail.includes("REDACTED")) {
      console.log(`  stdout after redaction: ${pyStr(rec.stdout_tail)}`);
    }
  }

  const chain = retryChain(retry.command_id);
  console.log(`\nretry chain for ${retry.command_id}: [${chain.map((r) => pyStr(r.command_id)).join(", ")}] (oldest -> newest)`);
  console.log(`${loadAll().length} records persisted in ${basename(RECORD)}`);
}

main();
