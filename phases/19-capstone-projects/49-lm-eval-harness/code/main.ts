// Lesson: Language Model Evaluation Harness (phase 19 / lesson 49)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/49-lm-eval-harness/docs/en.md
// Run: npx tsx phases/19-capstone-projects/49-lm-eval-harness/code/main.ts

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, normalize } from "node:path";
import { performance } from "node:perf_hooks";

class PyFloat {
  constructor(readonly v: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

const fl = (v: number): PyFloat => new PyFloat(v);

function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mant, expStr] = x.toExponential().split("e");
  const exp = Number(expStr);
  const neg = mant.startsWith("-");
  const digits = mant.replace("-", "").replace(".", "");
  let body: string;
  if (exp < -4 || exp >= 16) {
    const frac = digits.length > 1 ? "." + digits.slice(1) : "";
    body = digits[0] + frac + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
  } else if (exp < 0) {
    body = "0." + "0".repeat(-exp - 1) + digits;
  } else if (digits.length <= exp + 1) {
    body = digits + "0".repeat(exp + 1 - digits.length) + ".0";
  } else {
    body = digits.slice(0, exp + 1) + "." + digits.slice(exp + 1);
  }
  return (neg ? "-" : "") + body;
}

function fmtFixed(x: number, n: number): string {
  const neg = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  const wide = a.toFixed(Math.min(100, n + 30));
  const dot = wide.indexOf(".");
  const tail = wide.slice(dot + 1 + n);
  let out = a.toFixed(n);
  if (/^50*$/.test(tail)) {
    const head = wide.slice(0, dot + 1 + n);
    const trimmed = n === 0 ? head.slice(0, -1) : head;
    if (Number(trimmed[trimmed.length - 1]) % 2 === 0) out = trimmed;
  }
  return (neg ? "-" : "") + out;
}

function jsonStr(s: string): string {
  return (
    '"' +
    s.replace(/[\\"\u0000-\u001f\u007f-￿]/g, (c) => {
      if (c === '"') return '\\"';
      if (c === "\\") return "\\\\";
      if (c === "\n") return "\\n";
      if (c === "\r") return "\\r";
      if (c === "\t") return "\\t";
      if (c === "\b") return "\\b";
      if (c === "\f") return "\\f";
      return "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
    }) +
    '"'
  );
}

function pyDumps(v: Json, indent: number | null = null, level = 0): string {
  if (v === null) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (v instanceof PyFloat) return pyFloatRepr(v.v);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : pyFloatRepr(v);
  if (typeof v === "string") return jsonStr(v);
  let open: string;
  let close: string;
  let items: string[];
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    open = "[";
    close = "]";
    items = v.map((x) => pyDumps(x, indent, level + 1));
  } else {
    const keys = Object.keys(v);
    if (keys.length === 0) return "{}";
    open = "{";
    close = "}";
    items = keys.map((k) => jsonStr(k) + ": " + pyDumps(v[k], indent, level + 1));
  }
  if (indent === null) return open + items.join(", ") + close;
  const pad = "\n" + " ".repeat(indent * (level + 1));
  return open + pad + items.join("," + pad) + "\n" + " ".repeat(indent * level) + close;
}

function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  return quote + s.replace(/\\/g, "\\\\").replace(new RegExp(quote, "g"), "\\" + quote) + quote;
}

const HERE = __dirname;
const OUT_DIR = join(dirname(HERE), "outputs");
const TASKS_DIR = join(OUT_DIR, "tasks");
const LEADERBOARD = join(OUT_DIR, "leaderboard.json");

interface Example {
  id: string;
  prompt: string;
  targets: string[];
  metric: string;
  extras: Obj;
}

interface TaskResult {
  task: string;
  metric: string;
  score: number;
  correct: number;
  total: number;
  per_example: Obj[];
  latency_ms: number;
}

interface Leaderboard {
  schema: string;
  timestamp: number;
  overall_score: number;
  tasks: TaskResult[];
}

interface ModelAdapter {
  generate(prompts: string[]): string[];
  readonly name: string;
}

class ToyAdapter implements ModelAdapter {
  readonly name = "toy.v1";

  generate(prompts: string[]): string[] {
    return prompts.map((p) => this.answer(p));
  }

  private answer(prompt: string): string {
    const text = prompt.trim();
    if (text.startsWith("compute:")) {
      const expr = text.slice("compute:".length).trim();
      try {
        return pyNumStr(safeArithEval(expr));
      } catch {
        return "";
      }
    }
    if (text.startsWith("summarize:")) {
      const body = text.slice("summarize:".length).trim();
      const sentences = body.split(/(?<=[.!?])\s+/);
      return sentences.length ? sentences[0] : body;
    }
    if (text.startsWith("python:")) {
      const body = text.slice("python:".length).trim();
      if (body.includes("double")) return "def f(x):\n    return x * 2\n";
      if (body.includes("increment")) return "def f(x):\n    return x + 1\n";
      if (body.includes("square")) return "def f(x):\n    return x * x\n";
      return "def f(x):\n    return x\n";
    }
    if (text.startsWith("choose:")) {
      const body = text.slice("choose:".length).trim();
      return body.split("|")[0].trim().slice(0, 1).toUpperCase();
    }
    if (text.startsWith("write:")) {
      return text.slice("write:".length).trim();
    }
    return text;
  }
}

interface PyNum {
  v: number;
  isFloat: boolean;
}

function pyNumStr(n: PyNum): string {
  return n.isFloat ? pyFloatRepr(n.v) : String(n.v);
}

function pyFloorMod(a: number, b: number): number {
  const r = a % b;
  return r !== 0 && r < 0 !== b < 0 ? r + b : r;
}

function applyBinOp(op: string, a: PyNum, b: PyNum): PyNum {
  const isFloat = a.isFloat || b.isFloat;
  if (op === "+") return { v: a.v + b.v, isFloat };
  if (op === "-") return { v: a.v - b.v, isFloat };
  if (op === "*") return { v: a.v * b.v, isFloat };
  if (op === "/") {
    if (b.v === 0) throw new Error("division by zero");
    return { v: a.v / b.v, isFloat: true };
  }
  if (op === "//") {
    if (b.v === 0) throw new Error("integer division or modulo by zero");
    return { v: Math.floor(a.v / b.v), isFloat };
  }
  if (op === "%") {
    if (b.v === 0) throw new Error("integer division or modulo by zero");
    return { v: pyFloorMod(a.v, b.v), isFloat };
  }
  if (op === "**") {
    return { v: a.v ** b.v, isFloat: isFloat || b.v < 0 };
  }
  throw new Error(`unsafe node: ${op}`);
}

function tokenizeArith(expr: string): string[] {
  const re = /\s*(\d+\.\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+|\d+|\*\*|\/\/|[A-Za-z_]\w*|[-+*/%()])/y;
  const tokens: string[] = [];
  let pos = 0;
  while (pos < expr.length) {
    if (/^\s*$/.test(expr.slice(pos))) break;
    re.lastIndex = pos;
    const m = re.exec(expr);
    if (!m) throw new Error(`invalid syntax: ${expr}`);
    tokens.push(m[1]);
    pos = re.lastIndex;
  }
  return tokens;
}

function parseArith(expr: string, env: Map<string, PyNum>): PyNum {
  const tokens = tokenizeArith(expr);
  let i = 0;
  const peek = (): string | undefined => tokens[i];
  const parseExpr = (): PyNum => {
    let left = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = tokens[i++];
      left = applyBinOp(op, left, parseTerm());
    }
    return left;
  };
  const parseTerm = (): PyNum => {
    let left = parseFactor();
    while (peek() === "*" || peek() === "/" || peek() === "//" || peek() === "%") {
      const op = tokens[i++];
      left = applyBinOp(op, left, parseFactor());
    }
    return left;
  };
  const parseFactor = (): PyNum => {
    if (peek() === "+") {
      i++;
      return parseFactor();
    }
    if (peek() === "-") {
      i++;
      const n = parseFactor();
      return { v: -n.v, isFloat: n.isFloat };
    }
    return parsePower();
  };
  const parsePower = (): PyNum => {
    const base = parseAtom();
    if (peek() === "**") {
      i++;
      return applyBinOp("**", base, parseFactor());
    }
    return base;
  };
  const parseAtom = (): PyNum => {
    const tok = tokens[i++];
    if (tok === undefined) throw new Error("unexpected end of expression");
    if (tok === "(") {
      const inner = parseExpr();
      if (tokens[i++] !== ")") throw new Error("expected )");
      return inner;
    }
    if (/^[\d.]/.test(tok)) {
      return { v: Number(tok), isFloat: /[.eE]/.test(tok) };
    }
    const bound = env.get(tok);
    if (bound !== undefined) return bound;
    throw new Error(`unsafe node: Name(id='${tok}')`);
  };
  const result = parseExpr();
  if (i !== tokens.length) throw new Error(`invalid syntax: ${expr}`);
  return result;
}

function safeArithEval(expr: string): PyNum {
  return parseArith(expr, new Map());
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function metricExactMatch(prediction: string, targets: string[]): number {
  const normPred = normalizeText(prediction);
  return targets.some((t) => normalizeText(t) === normPred) ? 1.0 : 0.0;
}

function metricSubstringContains(prediction: string, targets: string[]): number {
  const normPred = normalizeText(prediction);
  return targets.some((t) => normPred.includes(normalizeText(t))) ? 1.0 : 0.0;
}

function metricMultipleChoice(prediction: string, targets: string[]): number {
  const pred = prediction.trim().slice(0, 1).toUpperCase();
  return new Set(targets.map((t) => t.trim().slice(0, 1).toUpperCase())).has(pred) ? 1.0 : 0.0;
}

function tokens(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function lcsLength(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (const ai of a) {
    const cur = new Array<number>(b.length + 1).fill(0);
    b.forEach((bj, j) => {
      cur[j + 1] = ai === bj ? prev[j] + 1 : Math.max(prev[j + 1], cur[j]);
    });
    prev = cur;
  }
  return prev[prev.length - 1];
}

function metricRougeL(prediction: string, targets: string[]): number {
  const pred = tokens(prediction);
  if (!pred.length) return 0.0;
  let best = 0.0;
  for (const ref of targets) {
    const refToks = tokens(ref);
    if (!refToks.length) continue;
    const lcs = lcsLength(pred, refToks);
    if (lcs === 0) continue;
    const prec = lcs / pred.length;
    const rec = lcs / refToks.length;
    if (prec + rec === 0) continue;
    const f1 = (2 * prec * rec) / (prec + rec);
    if (f1 > best) best = f1;
  }
  return best;
}

type PyFn = (x: PyNum) => PyNum;

function execTinyPython(source: string): Map<string, PyFn> {
  const local = new Map<string, PyFn>();
  const lines = source.split("\n").filter((l) => l.trim() !== "");
  let i = 0;
  while (i < lines.length) {
    const header = /^def\s+([A-Za-z_]\w*)\s*\(\s*([A-Za-z_]\w*)\s*\)\s*:\s*$/.exec(lines[i]);
    const ret = i + 1 < lines.length ? /^\s+return\s+(.+?)\s*$/.exec(lines[i + 1]) : null;
    if (!header || !ret) throw new Error("invalid syntax");
    const [, name, param] = header;
    const body = ret[1];
    tokenizeArith(body);
    local.set(name, (x: PyNum) => parseArith(body, new Map([[param, x]])));
    i += 2;
  }
  return local;
}

function metricCodeExec(prediction: string, _targets: string[], extras: Obj): number {
  const pairs = extras["io_pairs"] ?? [];
  if (!Array.isArray(pairs) || !pairs.length) return 0.0;
  let local: Map<string, PyFn>;
  try {
    local = execTinyPython(prediction);
  } catch {
    return 0.0;
  }
  const fn = local.get("f");
  if (fn === undefined) return 0.0;
  let correct = 0;
  for (const pair of pairs) {
    if (!(Array.isArray(pair) && pair.length === 2)) continue;
    const [x, expected] = pair;
    if (typeof x !== "number" || typeof expected !== "number") continue;
    let actual: PyNum;
    try {
      actual = fn({ v: x, isFloat: !Number.isInteger(x) });
    } catch {
      continue;
    }
    if (actual.v === expected) correct += 1;
  }
  if (!pairs.length) return 0.0;
  return correct / pairs.length;
}

const METRIC_FNS: Record<string, (p: string, t: string[], e: Obj) => number> = {
  exact_match: (p, t) => metricExactMatch(p, t),
  substring_contains: (p, t) => metricSubstringContains(p, t),
  multiple_choice: (p, t) => metricMultipleChoice(p, t),
  rouge_l: (p, t) => metricRougeL(p, t),
  code_exec: (p, t, e) => metricCodeExec(p, t, e),
};

function loadTaskJsonl(path: string): Example[] {
  const examples: Example[] = [];
  const lines = readFileSync(path, "utf-8").split(/(?<=\n)/);
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) return;
    let obj: Obj;
    try {
      obj = JSON.parse(raw) as Obj;
    } catch (exc) {
      throw new Error(`bad json at ${path}:${lineNum}: ${(exc as Error).message}`);
    }
    examples.push({
      id: String(obj["id"] ?? `ex-${lineNum}`),
      prompt: obj["prompt"] as string,
      targets: [...(obj["targets"] as string[])],
      metric: obj["metric"] as string,
      extras: { ...((obj["extras"] as Obj | undefined) ?? {}) },
    });
  });
  return examples;
}

function writeTaskJsonl(examples: Example[], path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  let out = "";
  for (const ex of examples) {
    const rec: Obj = { id: ex.id, prompt: ex.prompt, targets: ex.targets, metric: ex.metric };
    if (Object.keys(ex.extras).length) rec["extras"] = ex.extras;
    out += pyDumps(rec) + "\n";
  }
  writeFileSync(path, out, "utf-8");
}

function runTask(taskName: string, examples: Example[], adapter: ModelAdapter, batchSize = 8): TaskResult {
  if (batchSize <= 0) throw new Error(`batch_size must be > 0, got ${batchSize}`);
  if (!examples.length) {
    return { task: taskName, metric: "none", score: 0.0, correct: 0, total: 0, per_example: [], latency_ms: 0.0 };
  }
  const metric = examples[0].metric;
  if (!examples.every((ex) => ex.metric === metric)) throw new Error(`task ${taskName} mixes metrics`);
  const metricFn = METRIC_FNS[metric];
  const perExample: Obj[] = [];
  let correctSum = 0.0;
  let total = 0;
  const start = performance.now();
  for (let i = 0; i < examples.length; i += batchSize) {
    const chunk = examples.slice(i, i + batchSize);
    const prompts = chunk.map((ex) => ex.prompt);
    const outputs = adapter.generate(prompts);
    if (outputs.length !== chunk.length) {
      throw new Error(`adapter returned ${outputs.length} outputs for ${chunk.length} prompts in task ${taskName}`);
    }
    chunk.forEach((ex, j) => {
      const out = outputs[j];
      const score = metricFn(out, ex.targets, ex.extras);
      correctSum += score;
      total += 1;
      perExample.push({ id: ex.id, prompt: ex.prompt, prediction: out, targets: ex.targets, score: fl(score) });
    });
  }
  const latencyMs = performance.now() - start;
  const score = total ? correctSum / total : 0.0;
  const correctInt = Number(fmtFixed(correctSum, 0));
  return {
    task: taskName,
    metric,
    score,
    correct: correctInt,
    total,
    per_example: perExample,
    latency_ms: latencyMs,
  };
}

function runLeaderboard(tasks: Map<string, Example[]>, adapter: ModelAdapter, batchSize = 8): Leaderboard {
  const results: TaskResult[] = [];
  for (const name of [...tasks.keys()].sort()) {
    results.push(runTask(name, tasks.get(name) ?? [], adapter, batchSize));
  }
  const overall = results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0.0;
  return { schema: "leaderboard.v1", timestamp: Date.now() / 1000, overall_score: overall, tasks: results };
}

function writeLeaderboard(board: Leaderboard, path: string, adapterName: string, includePerExample = false): void {
  mkdirSync(dirname(path), { recursive: true });
  const payload: Obj = {
    schema: board.schema,
    timestamp: fl(board.timestamp),
    overall_score: fl(board.overall_score),
    adapter: adapterName,
    tasks: board.tasks.map((r) => {
      const rec: Obj = {
        task: r.task,
        metric: r.metric,
        score: fl(r.score),
        correct: r.correct,
        total: r.total,
        latency_ms: fl(r.latency_ms),
      };
      if (includePerExample) rec["per_example"] = r.per_example;
      return rec;
    }),
  };
  writeFileSync(path, pyDumps(payload, 2) + "\n");
}

function pad2(i: number): string {
  return String(i).padStart(2, "0");
}

function buildArithmeticTask(): Example[] {
  const items: [string, string][] = [["2 + 2", "4"], ["7 - 3", "4"], ["6 * 4", "24"], ["100 / 4", "25.0"], ["12 + 9", "21"]];
  return items.map(([q, a], i) => ({ id: `arith-${pad2(i)}`, prompt: `compute: ${q}`, targets: [a], metric: "exact_match", extras: {} }));
}

function buildSummaryTask(): Example[] {
  const items: [string, string][] = [
    ["Cats are mammals. Mammals are warm blooded.", "cats are mammals"],
    ["Python uses indentation. Indentation defines blocks.", "python uses indentation"],
    ["The river flows east. Boats pass slowly.", "the river flows east"],
    ["Storms approach the coast. Waves rise quickly.", "storms approach the coast"],
    ["Bread bakes at high heat. Crust forms last.", "bread bakes at high heat"],
  ];
  return items.map(([p, t], i) => ({ id: `sum-${pad2(i)}`, prompt: `summarize: ${p}`, targets: [t], metric: "rouge_l", extras: {} }));
}

function buildCodeTask(): Example[] {
  const items: [string, string, number[][]][] = [
    ["write a function f that doubles its input", "double", [[1, 2], [3, 6], [5, 10]]],
    ["write a function f that increments its input", "increment", [[1, 2], [5, 6], [10, 11]]],
    ["write a function f that squares its input", "square", [[2, 4], [3, 9], [4, 16]]],
    ["write a function f that doubles its input again", "double", [[7, 14], [9, 18]]],
    ["write a function f that increments its input again", "increment", [[0, 1], [2, 3]]],
  ];
  return items.map(([prompt, tag, pairs], i) => ({
    id: `code-${pad2(i)}`,
    prompt: `python: ${prompt}`,
    targets: ["ok"],
    metric: "code_exec",
    extras: { io_pairs: pairs, tag },
  }));
}

function buildChoiceTask(): Example[] {
  const items: [string, string[]][] = [
    ["A | mammal, B | reptile, C | bird", ["A"]],
    ["A | apple, B | car, C | tree", ["A"]],
    ["A | water, B | iron, C | wood", ["A"]],
    ["A | square, B | triangle, C | circle", ["A"]],
    ["A | bread, B | rock, C | leaf", ["A"]],
  ];
  return items.map(([q, t], i) => ({ id: `mc-${pad2(i)}`, prompt: `choose: ${q}`, targets: t, metric: "multiple_choice", extras: {} }));
}

function buildGenerationTask(): Example[] {
  const items: [string, string[]][] = [
    ["hello world", ["hello"]],
    ["training language models", ["language"]],
    ["evaluation harness", ["evaluation"]],
    ["gradient accumulation step", ["gradient"]],
    ["distributed parameter sharding", ["distributed"]],
  ];
  return items.map(([p, t], i) => ({ id: `gen-${pad2(i)}`, prompt: `write: ${p}`, targets: t, metric: "substring_contains", extras: {} }));
}

function seedFixtureTasks(targetDir: string): Map<string, string> {
  mkdirSync(targetDir, { recursive: true });
  const tasks: [string, Example[]][] = [
    ["arithmetic", buildArithmeticTask()],
    ["summary", buildSummaryTask()],
    ["code-exec", buildCodeTask()],
    ["multiple-choice", buildChoiceTask()],
    ["generation", buildGenerationTask()],
  ];
  const paths = new Map<string, string>();
  for (const [name, examples] of tasks) {
    const path = join(targetDir, `${name}.jsonl`);
    writeTaskJsonl(examples, path);
    paths.set(name, path);
  }
  return paths;
}

function globJsonl(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => join(dir, f))
    .sort();
}

function loadAllTasks(taskDir: string): Map<string, Example[]> {
  const tasks = new Map<string, Example[]>();
  for (const path of globJsonl(taskDir)) {
    tasks.set(basename(path).replace(/\.[^.]*$/, ""), loadTaskJsonl(path));
  }
  return tasks;
}

interface Args {
  taskDir: string;
  out: string;
  batchSize: number;
  includePerExample: boolean;
  seedFixtures: boolean;
}

function cleanPath(p: string): string {
  const n = normalize(p);
  return n.length > 1 && n.endsWith("/") ? n.slice(0, -1) : n;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { taskDir: TASKS_DIR, out: LEADERBOARD, batchSize: 4, includePerExample: false, seedFixtures: false };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].includes("=") ? argv[i].split(/=(.*)/s, 2) : [argv[i], undefined];
    const value = (): string => {
      const v = inline ?? argv[++i];
      if (v === undefined) throw new Error(`argument ${flag}: expected one argument`);
      return v;
    };
    if (flag === "--task-dir") args.taskDir = cleanPath(value());
    else if (flag === "--out") args.out = cleanPath(value());
    else if (flag === "--batch-size") args.batchSize = parseInt(value(), 10);
    else if (flag === "--include-per-example") args.includePerExample = true;
    else if (flag === "--seed-fixtures") args.seedFixtures = true;
    else throw new Error(`unrecognized arguments: ${argv[i]}`);
  }
  return args;
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (args.seedFixtures || !existsSync(args.taskDir) || !globJsonl(args.taskDir).length) {
    console.log(`seeding fixture tasks into ${args.taskDir}`);
    seedFixtureTasks(args.taskDir);
  }
  const tasks = loadAllTasks(args.taskDir);
  console.log(`loaded ${tasks.size} tasks: [${[...tasks.keys()].sort().map(pyStrRepr).join(", ")}]`);
  const adapter = new ToyAdapter();
  const board = runLeaderboard(tasks, adapter, args.batchSize);
  writeLeaderboard(board, args.out, adapter.name, args.includePerExample);
  console.log(`overall_score = ${fmtFixed(board.overall_score, 3)}`);
  for (const r of board.tasks) {
    console.log(
      `  ${r.task.padStart(16)}  metric=${r.metric.padStart(18)}  score=${fmtFixed(r.score, 3)}  (${r.correct}/${r.total})  latency_ms=${fmtFixed(r.latency_ms, 1)}`,
    );
  }
  console.log(`wrote ${args.out}`);
  return 0;
}

process.exitCode = main();
