// Lesson: Task Spec Format (phase 19 / lesson 70)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/70-task-spec-format/docs/en.md
// Run: npx tsx phases/19-capstone-projects/70-task-spec-format/code/main.ts

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

export const REQUIRED_FIELDS = ["task_id", "category", "prompt", "targets", "metric_name", "post_process"];
export const OPTIONAL_FIELDS = ["few_shot_examples", "metadata"];
export const ALLOWED_FIELDS = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);

export const CATEGORIES = ["arithmetic", "mcq", "code_exec", "classification", "summary"];
export const METRICS = ["exact_match", "f1", "bleu_4", "rouge_l", "accuracy", "code_exec"];
export const POST_PROCESS = [
  "none",
  "strip_whitespace",
  "lower",
  "extract_letter",
  "extract_code_block",
  "extract_first_line",
];

export const LEGAL_CATEGORY_METRIC: Record<string, Set<string>> = {
  arithmetic: new Set(["exact_match", "f1"]),
  mcq: new Set(["exact_match", "accuracy"]),
  code_exec: new Set(["code_exec"]),
  classification: new Set(["exact_match", "accuracy", "f1"]),
  summary: new Set(["exact_match", "f1", "bleu_4", "rouge_l"]),
};

export const FEW_SHOT_MAX = 8;
const TASK_ID_RE = /^[A-Za-z0-9_\-]+\n?$/;
const MCQ_TARGET_RE = /^[A-E]\n?$/;

export function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (ch === "\\") {
      out += "\\\\";
    } else if (ch === quote) {
      out += "\\" + ch;
    } else if (ch === "\n") {
      out += "\\n";
    } else if (ch === "\r") {
      out += "\\r";
    } else if (ch === "\t") {
      out += "\\t";
    } else if (c < 0x20 || c === 0x7f) {
      out += "\\x" + c.toString(16).padStart(2, "0");
    } else {
      out += ch;
    }
  }
  return out + quote;
}

function pyRepr(v: Json): string {
  if (v === null) {
    return "None";
  }
  if (typeof v === "boolean") {
    return v ? "True" : "False";
  }
  if (typeof v === "number") {
    return String(v);
  }
  if (typeof v === "string") {
    return pyStrRepr(v);
  }
  if (Array.isArray(v)) {
    return "[" + v.map(pyRepr).join(", ") + "]";
  }
  return "{" + Object.entries(v).map(([k, x]) => `${pyStrRepr(k)}: ${pyRepr(x)}`).join(", ") + "}";
}

function pyStr(v: Json): string {
  return typeof v === "string" ? v : pyRepr(v);
}

function jsonDumpsString(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const c = s.charCodeAt(i);
    if (ch === '"') {
      out += '\\"';
    } else if (ch === "\\") {
      out += "\\\\";
    } else if (ch === "\n") {
      out += "\\n";
    } else if (ch === "\r") {
      out += "\\r";
    } else if (ch === "\t") {
      out += "\\t";
    } else if (ch === "\b") {
      out += "\\b";
    } else if (ch === "\f") {
      out += "\\f";
    } else if (c < 0x20 || c > 0x7e) {
      out += "\\u" + c.toString(16).padStart(4, "0");
    } else {
      out += ch;
    }
  }
  return out + '"';
}

function jsonDumps(v: Json): string {
  if (v === null) {
    return "null";
  }
  if (typeof v === "boolean") {
    return v ? "true" : "false";
  }
  if (typeof v === "number") {
    return String(v);
  }
  if (typeof v === "string") {
    return jsonDumpsString(v);
  }
  if (Array.isArray(v)) {
    return "[" + v.map(jsonDumps).join(", ") + "]";
  }
  return "{" + Object.entries(v).map(([k, x]) => `${jsonDumpsString(k)}: ${jsonDumps(x)}`).join(", ") + "}";
}

function isDict(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function has(o: JsonObject, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, k);
}

export class ValidationError {
  constructor(
    public lineNumber: number,
    public taskId: string,
    public rule: string,
    public fieldName: string,
    public detail: string,
  ) {}

  toDict(): JsonObject {
    return {
      line_number: this.lineNumber,
      task_id: this.taskId,
      rule: this.rule,
      field: this.fieldName,
      detail: this.detail,
    };
  }
}

export interface FewShot {
  prompt: string;
  completion: string;
}

export class TaskSpec {
  constructor(
    public taskId: string,
    public category: string,
    public prompt: string,
    public targets: string[],
    public metricName: string,
    public postProcess: string,
    public fewShotExamples: FewShot[] = [],
    public metadata: JsonObject = {},
  ) {}

  toDict(): JsonObject {
    return {
      task_id: this.taskId,
      category: this.category,
      prompt: this.prompt,
      targets: [...this.targets],
      metric_name: this.metricName,
      post_process: this.postProcess,
      few_shot_examples: this.fewShotExamples.map((e) => ({ ...e })),
      metadata: { ...this.metadata },
    };
  }
}

function checkRequired(record: JsonObject): [string, string] | null {
  for (const f of REQUIRED_FIELDS) {
    if (!has(record, f)) {
      return ["missing_required", f];
    }
  }
  return null;
}

function checkUnknownFields(record: JsonObject): [string, string] | null {
  for (const k of Object.keys(record)) {
    if (!ALLOWED_FIELDS.has(k)) {
      return ["unknown_field", k];
    }
  }
  return null;
}

function sortedRepr(items: string[]): string {
  return pyRepr([...items].sort());
}

function checkTypes(record: JsonObject): [string, string, string] | null {
  const taskId = record["task_id"];
  if (typeof taskId !== "string") {
    return ["bad_type", "task_id", "must be string"];
  }
  if (!TASK_ID_RE.test(taskId)) {
    return ["bad_value", "task_id", "must match [A-Za-z0-9_-]+"];
  }
  const category = record["category"];
  if (typeof category !== "string" || !CATEGORIES.includes(category)) {
    return ["bad_value", "category", `must be one of ${sortedRepr(CATEGORIES)}`];
  }
  const prompt = record["prompt"];
  if (typeof prompt !== "string" || !prompt) {
    return ["bad_type", "prompt", "must be non-empty string"];
  }
  if (prompt !== prompt.trimEnd()) {
    return ["bad_value", "prompt", "trailing whitespace not allowed"];
  }
  const targets = record["targets"];
  if (!Array.isArray(targets) || targets.length === 0) {
    return ["bad_type", "targets", "must be non-empty list"];
  }
  for (const t of targets) {
    if (typeof t !== "string") {
      return ["bad_type", "targets", "all elements must be strings"];
    }
  }
  const metric = record["metric_name"];
  if (typeof metric !== "string" || !METRICS.includes(metric)) {
    return ["bad_value", "metric_name", `must be one of ${sortedRepr(METRICS)}`];
  }
  const pp = record["post_process"];
  if (typeof pp !== "string" || !POST_PROCESS.includes(pp)) {
    return ["bad_value", "post_process", `must be one of ${sortedRepr(POST_PROCESS)}`];
  }
  if (has(record, "few_shot_examples")) {
    const fse = record["few_shot_examples"];
    if (!Array.isArray(fse)) {
      return ["bad_type", "few_shot_examples", "must be list"];
    }
    if (fse.length > FEW_SHOT_MAX) {
      return ["bad_value", "few_shot_examples", `max ${FEW_SHOT_MAX} entries`];
    }
    for (const ex of fse) {
      if (!isDict(ex)) {
        return ["bad_type", "few_shot_examples", "entries must be objects"];
      }
      if (!has(ex, "prompt") || !has(ex, "completion")) {
        return ["bad_type", "few_shot_examples", "needs prompt and completion"];
      }
      if (typeof ex["prompt"] !== "string" || typeof ex["completion"] !== "string") {
        return ["bad_type", "few_shot_examples", "prompt/completion must be strings"];
      }
    }
  }
  if (has(record, "metadata") && !isDict(record["metadata"])) {
    return ["bad_type", "metadata", "must be object"];
  }
  return null;
}

function checkCategoryMetric(record: JsonObject): [string, string, string] | null {
  const cat = record["category"] as string;
  const metric = record["metric_name"] as string;
  if (!LEGAL_CATEGORY_METRIC[cat].has(metric)) {
    return ["illegal_pair", "metric_name", `${metric} not allowed for category ${cat}`];
  }
  if (cat === "mcq") {
    const targets = record["targets"] as string[];
    if (targets.length !== 1) {
      return ["bad_value", "targets", "mcq needs exactly one target"];
    }
    if (!MCQ_TARGET_RE.test(targets[0])) {
      return ["bad_value", "targets", "mcq target must be a letter A-E"];
    }
  }
  return null;
}

function embeddedFewShot(prompt: string): boolean {
  const lowered = prompt.toLowerCase();
  const markers = ["question:", "q:", "example:"];
  let hits = 0;
  for (const m of markers) {
    hits += lowered.split(m).length - 1;
  }
  return hits > 1;
}

export function validateTask(record: Json, lineNumber = 0): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!isDict(record)) {
    errors.push(new ValidationError(lineNumber, "?", "bad_type", "_root", "not an object"));
    return errors;
  }
  const tid: Json = has(record, "task_id") ? record["task_id"] : "?";
  const missing = checkRequired(record);
  if (missing) {
    errors.push(new ValidationError(lineNumber, pyStr(tid), missing[0], missing[1], "required field"));
    return errors;
  }
  const unknown = checkUnknownFields(record);
  if (unknown) {
    errors.push(new ValidationError(lineNumber, pyStr(tid), unknown[0], unknown[1], "not in allowed fields"));
    return errors;
  }
  const typ = checkTypes(record);
  if (typ) {
    errors.push(new ValidationError(lineNumber, pyStr(tid), typ[0], typ[1], typ[2]));
    return errors;
  }
  const pair = checkCategoryMetric(record);
  if (pair) {
    errors.push(new ValidationError(lineNumber, pyStr(tid), pair[0], pair[1], pair[2]));
    return errors;
  }
  const fse = record["few_shot_examples"];
  const hasFewShot = Array.isArray(fse) && fse.length > 0;
  if (embeddedFewShot(record["prompt"] as string) && !hasFewShot) {
    errors.push(
      new ValidationError(
        lineNumber,
        pyStr(tid),
        "embedded_few_shot",
        "prompt",
        "few-shot in prompt body without few_shot_examples list",
      ),
    );
  }
  return errors;
}

export function validateFile(filePath: string): [TaskSpec[], ValidationError[]] {
  const validated: TaskSpec[] = [];
  const errors: ValidationError[] = [];
  const seenIds = new Set<string>();
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r\n|\r|\n/);
  lines.forEach((raw, idx) => {
    const i = idx + 1;
    const line = raw.trim();
    if (!line) {
      return;
    }
    let record: Json;
    try {
      record = JSON.parse(line) as Json;
    } catch (exc) {
      errors.push(new ValidationError(i, "?", "bad_json", "_line", String((exc as Error).message)));
      return;
    }
    const lineErrors = validateTask(record, i);
    if (lineErrors.length > 0) {
      errors.push(...lineErrors);
      return;
    }
    const rec = record as JsonObject;
    const tid = rec["task_id"] as string;
    if (seenIds.has(tid)) {
      errors.push(new ValidationError(i, tid, "duplicate_task_id", "task_id", "already seen"));
      return;
    }
    seenIds.add(tid);
    validated.push(
      new TaskSpec(
        tid,
        rec["category"] as string,
        rec["prompt"] as string,
        [...(rec["targets"] as string[])],
        rec["metric_name"] as string,
        rec["post_process"] as string,
        [...((rec["few_shot_examples"] ?? []) as unknown as FewShot[])],
        { ...((rec["metadata"] ?? {}) as JsonObject) },
      ),
    );
  });
  return [validated, errors];
}

export function renderPrompt(task: TaskSpec): string {
  const parts: string[] = [];
  for (const ex of task.fewShotExamples) {
    parts.push(`${ex.prompt} ${ex.completion}`);
  }
  parts.push(task.prompt);
  return parts.join("\n\n");
}

const CODE_BLOCK_RE = /```(?:[a-zA-Z0-9_]*)\n(.*?)```/s;
const LETTER_RE = /(?:^|[^A-Za-z])([A-E])(?:[^A-Za-z]|$)/;
const LETTER_FALLBACK_RE = /[A-E]/;

function splitLines(text: string): string[] {
  return text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
}

export function postProcess(text: string, rule: string): string {
  if (rule === "none") {
    return text;
  }
  if (rule === "strip_whitespace") {
    return text.trim();
  }
  if (rule === "lower") {
    return text.toLowerCase();
  }
  if (rule === "extract_letter") {
    const m = LETTER_RE.exec(text);
    if (m) {
      return m[1];
    }
    const m2 = LETTER_FALLBACK_RE.exec(text);
    return m2 ? m2[0] : "";
  }
  if (rule === "extract_code_block") {
    const m = CODE_BLOCK_RE.exec(text);
    return m ? m[1] : text;
  }
  if (rule === "extract_first_line") {
    for (const line of splitLines(text)) {
      if (line.trim()) {
        return line.trim();
      }
    }
    return "";
  }
  throw new Error(`unknown post_process rule: ${rule}`);
}

export function fixtureTasks(): JsonObject[] {
  return [
    {
      task_id: "arith_001",
      category: "arithmetic",
      prompt: "Compute the result.\nQuestion: 17 + 24\nAnswer:",
      targets: ["41"],
      metric_name: "exact_match",
      post_process: "strip_whitespace",
      few_shot_examples: [{ prompt: "Question: 2 + 2\nAnswer:", completion: "4" }],
      metadata: { difficulty: "easy" },
    },
    {
      task_id: "arith_002",
      category: "arithmetic",
      prompt: "Compute the result.\nQuestion: 144 / 12\nAnswer:",
      targets: ["12"],
      metric_name: "exact_match",
      post_process: "strip_whitespace",
      metadata: { difficulty: "easy" },
    },
    {
      task_id: "mcq_001",
      category: "mcq",
      prompt: "Which planet is closest to the sun?\nA) Earth\nB) Mercury\nC) Venus\nD) Mars\nAnswer:",
      targets: ["B"],
      metric_name: "exact_match",
      post_process: "extract_letter",
      metadata: { topic: "astronomy" },
    },
    {
      task_id: "mcq_002",
      category: "mcq",
      prompt: "Which of these is a prime number?\nA) 4\nB) 6\nC) 7\nD) 9\nAnswer:",
      targets: ["C"],
      metric_name: "exact_match",
      post_process: "extract_letter",
      metadata: { topic: "math" },
    },
    {
      task_id: "code_001",
      category: "code_exec",
      prompt: "Write a Python function `add(a, b)` that returns the sum.\nReturn only a single fenced code block.",
      targets: ["add(1, 2) == 3", "add(-5, 5) == 0", "add(100, 1) == 101"],
      metric_name: "code_exec",
      post_process: "extract_code_block",
      metadata: { language: "python" },
    },
    {
      task_id: "code_002",
      category: "code_exec",
      prompt:
        "Write a Python function `is_even(n)` that returns True iff n is even.\nReturn only a single fenced code block.",
      targets: ["is_even(2) == True", "is_even(3) == False", "is_even(0) == True"],
      metric_name: "code_exec",
      post_process: "extract_code_block",
      metadata: { language: "python" },
    },
    {
      task_id: "cls_001",
      category: "classification",
      prompt: "Classify the sentiment as positive or negative.\nText: I loved the film, it was wonderful.\nLabel:",
      targets: ["positive"],
      metric_name: "exact_match",
      post_process: "lower",
      metadata: { task: "sentiment" },
    },
    {
      task_id: "cls_002",
      category: "classification",
      prompt: "Classify the sentiment as positive or negative.\nText: I hated every minute, it was a waste.\nLabel:",
      targets: ["negative"],
      metric_name: "exact_match",
      post_process: "lower",
      metadata: { task: "sentiment" },
    },
    {
      task_id: "sum_001",
      category: "summary",
      prompt: "Summarise in one sentence.\nText: The cat sat on the mat and watched the rain fall.\nSummary:",
      targets: ["A cat watched the rain from the mat."],
      metric_name: "rouge_l",
      post_process: "extract_first_line",
      metadata: { length: "short" },
    },
    {
      task_id: "sum_002",
      category: "summary",
      prompt:
        "Summarise in one sentence.\nText: The runner crossed the finish line first and raised both arms in triumph.\nSummary:",
      targets: ["The runner won the race with arms raised."],
      metric_name: "bleu_4",
      post_process: "extract_first_line",
      metadata: { length: "short" },
    },
  ];
}

export function badFixtureTasks(): JsonObject[] {
  return [
    { category: "arithmetic", prompt: "x", targets: ["1"], metric_name: "exact_match", post_process: "none" },
    { task_id: "bad space", category: "arithmetic", prompt: "x", targets: ["1"], metric_name: "exact_match", post_process: "none" },
    { task_id: "wrong_cat", category: "logic", prompt: "x", targets: ["1"], metric_name: "exact_match", post_process: "none" },
    { task_id: "bad_pair", category: "mcq", prompt: "x", targets: ["A"], metric_name: "bleu_4", post_process: "extract_letter" },
    { task_id: "no_target", category: "arithmetic", prompt: "x", targets: [], metric_name: "exact_match", post_process: "none" },
    { task_id: "trail_ws", category: "arithmetic", prompt: "x   ", targets: ["1"], metric_name: "exact_match", post_process: "none" },
    { task_id: "extra_field", category: "arithmetic", prompt: "x", targets: ["1"], metric_name: "exact_match", post_process: "none", rogue: true },
    { task_id: "bad_metric", category: "arithmetic", prompt: "x", targets: ["1"], metric_name: "perplexity", post_process: "none" },
    { task_id: "mcq_multi", category: "mcq", prompt: "x", targets: ["A", "B"], metric_name: "exact_match", post_process: "extract_letter" },
    { task_id: "bad_pp", category: "arithmetic", prompt: "x", targets: ["1"], metric_name: "exact_match", post_process: "fancy" },
  ];
}

export function writeJsonl(filePath: string, records: Iterable<JsonObject>): void {
  let out = "";
  for (const r of records) {
    out += jsonDumps(r);
    out += "\n";
  }
  fs.writeFileSync(filePath, out, "utf-8");
}

export function loadFixtures(outDir: string): [string, string] {
  const good = path.join(outDir, "tasks.jsonl");
  const bad = path.join(outDir, "tasks_bad.jsonl");
  writeJsonl(good, fixtureTasks());
  writeJsonl(bad, badFixtureTasks());
  return [good, bad];
}

export function demo(): number {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "aie_l70_"));
  const [good, bad] = loadFixtures(outDir);
  const [okTasks, okErrors] = validateFile(good);
  console.log(`good fixture: validated=${okTasks.length} errors=${okErrors.length}`);
  const [badTasks, badErrors] = validateFile(bad);
  console.log(`bad fixture: validated=${badTasks.length} errors=${badErrors.length}`);
  for (const err of badErrors.slice(0, 5)) {
    console.log(`  ${pyRepr(err.toDict())}`);
  }
  if (okTasks.length > 0) {
    const sample = okTasks[0];
    const rendered = renderPrompt(sample);
    const pp = postProcess("  4  \n", "strip_whitespace");
    console.log(`sample render len=${rendered.length} pp=${pyRepr(pp)}`);
  }
  if (okErrors.length > 0) {
    return 1;
  }
  if (badErrors.length !== badFixtureTasks().length) {
    return 2;
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = demo();
}
