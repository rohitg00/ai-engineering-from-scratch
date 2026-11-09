// Lesson: Code Execution Metric (phase 19 / lesson 72)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/72-code-exec-metric/docs/en.md
// Run: npx tsx phases/19-capstone-projects/72-code-exec-metric/code/main.ts

import { spawnSync } from "node:child_process";
import { constants as osConstants } from "node:os";

const CODE_BLOCK_RE = /```(?:[a-zA-Z0-9_]*)\n([\s\S]*?)```/;

export const DEFAULT_TIMEOUT_S = 3.0;
export const MAX_TIMEOUT_S = 30.0;
export const OUTPUT_CAP_BYTES = 256 * 1024;
const STATUS_MARKER = "\n__EXEC_STATUS__";

export const EXIT_PASS = "pass";
export const EXIT_ASSERTION_FAIL = "assertion_fail";
export const EXIT_SYNTAX_ERROR = "syntax_error";
export const EXIT_TIMEOUT = "timeout";
export const EXIT_ERROR = "error";

export const EXIT_CODES = [EXIT_PASS, EXIT_ASSERTION_FAIL, EXIT_SYNTAX_ERROR, EXIT_TIMEOUT, EXIT_ERROR];

export class ExecResult {
  constructor(
    public score: number,
    public exit_code: string,
    public passed: number,
    public total: number,
    public detail = "",
    public per_assertion: boolean[] = [],
  ) {}

  toDict(): Record<string, unknown> {
    return {
      score: this.score,
      exit_code: this.exit_code,
      passed: this.passed,
      total: this.total,
      detail: this.detail,
      per_assertion: [...this.per_assertion],
    };
  }
}

const RUNNER_TEMPLATE = String.raw`
import json, sys, traceback
import builtins as _builtins

_DENIED_MODULES = {
    'subprocess', 'socket', 'shutil', 'requests', 'urllib',
    'urllib.request', 'urllib.error', 'urllib.parse', 'ctypes',
    'http.client', 'asyncio.subprocess',
}

_real_import = _builtins.__import__
def _guarded_import(name, *args, **kwargs):
    base = name.split('.')[0]
    if name in _DENIED_MODULES or base in _DENIED_MODULES:
        raise ImportError("denied module: %s" % name)
    return _real_import(name, *args, **kwargs)
_builtins.__import__ = _guarded_import

import os as _os
def _denied_system(_cmd):
    raise OSError("os.system denied")
_os.system = _denied_system

CODE = __PLACEHOLDER_CODE__
ASSERTIONS = __PLACEHOLDER_ASSERTIONS__

def _emit(status):
    sys.stdout.write("\n__EXEC_STATUS__" + json.dumps(status))

ns = {}
status = {"exit_code": "pass", "results": [], "detail": ""}
try:
    compiled = compile(CODE, "<candidate>", "exec")
except SyntaxError as exc:
    status["exit_code"] = "syntax_error"
    status["detail"] = "SyntaxError: %s" % exc
    _emit(status)
    sys.exit(0)
except Exception as exc:
    status["exit_code"] = "error"
    status["detail"] = "compile error: %r" % exc
    _emit(status)
    sys.exit(0)

try:
    exec(compiled, ns)
except Exception as exc:
    status["exit_code"] = "error"
    status["detail"] = "exec error: %s" % exc
    _emit(status)
    sys.exit(0)

passed = 0
for assertion in ASSERTIONS:
    try:
        ok = bool(eval(assertion, ns))
    except Exception as exc:
        ok = False
        status["detail"] = "assertion error: %s" % exc
    status["results"].append(ok)
    if ok:
        passed += 1

if passed < len(ASSERTIONS):
    status["exit_code"] = "assertion_fail" if passed > 0 or len(ASSERTIONS) > 0 else status["exit_code"]
    if passed == len(ASSERTIONS):
        status["exit_code"] = "pass"
elif len(ASSERTIONS) > 0:
    status["exit_code"] = "pass"

_emit(status)
`.trim();

export function extractCode(text: string): string | null {
  const m = CODE_BLOCK_RE.exec(text);
  if (m) return m[1];
  if (text.includes("```")) return null;
  return text;
}

function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + quote;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (cp < 0x20 || cp === 0x7f) out += "\\x" + cp.toString(16).padStart(2, "0");
    else out += ch;
  }
  return quote + out + quote;
}

function buildRunner(code: string, assertions: string[]): string {
  return RUNNER_TEMPLATE.replace("__PLACEHOLDER_CODE__", () => pyStrRepr(code)).replace(
    "__PLACEHOLDER_ASSERTIONS__",
    () => "[" + assertions.map(pyStrRepr).join(", ") + "]",
  );
}

export function runCandidate(code: string, assertions: string[], timeoutS = DEFAULT_TIMEOUT_S): ExecResult {
  if (!assertions.length) return new ExecResult(0.0, EXIT_ERROR, 0, 0, "no assertions provided");
  timeoutS = Math.min(Math.max(0.1, timeoutS), MAX_TIMEOUT_S);
  const script = buildRunner(code, assertions);
  const proc = spawnSync("python3", ["-I", "-c", script], {
    timeout: timeoutS * 1000,
    killSignal: "SIGKILL",
    maxBuffer: OUTPUT_CAP_BYTES,
  });

  const err = proc.error as NodeJS.ErrnoException | undefined;
  if (err && err.code === "ETIMEDOUT") {
    return new ExecResult(0.0, EXIT_TIMEOUT, 0, assertions.length, `timeout after ${timeoutS.toFixed(2)}s`);
  }
  if (err && err.code === "ENOBUFS") {
    return new ExecResult(0.0, EXIT_ERROR, 0, assertions.length, "output overflow");
  }
  if (err) return new ExecResult(0.0, EXIT_ERROR, 0, assertions.length, `spawn error: ${err.message}`);

  const stdout = proc.stdout.toString("utf-8");
  if (proc.status !== 0) {
    const stderrText = proc.stderr ? proc.stderr.toString("utf-8") : "";
    const code = proc.status ?? (proc.signal ? -osConstants.signals[proc.signal] : -1);
    return new ExecResult(0.0, EXIT_ERROR, 0, assertions.length, `subprocess exit ${code}: ${stderrText.slice(0, 200)}`);
  }
  let status: { exit_code?: string; results?: boolean[]; detail?: string };
  try {
    const marker = stdout.lastIndexOf(STATUS_MARKER);
    if (marker >= 0) status = JSON.parse(stdout.slice(marker + STATUS_MARKER.length));
    else if (stdout) throw new Error("missing status marker");
    else status = {};
  } catch {
    return new ExecResult(0.0, EXIT_ERROR, 0, assertions.length, "non-json output");
  }

  let exitCode = status.exit_code ?? EXIT_ERROR;
  const results = [...(status.results ?? [])];
  const detail = status.detail ?? "";
  const passed = results.filter(Boolean).length;
  const total = assertions.length;
  const score = total ? passed / total : 0.0;
  if (!EXIT_CODES.includes(exitCode)) exitCode = EXIT_ERROR;
  if (exitCode === EXIT_PASS && passed < total) exitCode = EXIT_ASSERTION_FAIL;
  if (exitCode === EXIT_ASSERTION_FAIL && passed === total && total > 0) exitCode = EXIT_PASS;
  return new ExecResult(score, exitCode, passed, total, detail, results);
}

export function scoreCodeExec(prediction: string, assertions: string[], timeoutS = DEFAULT_TIMEOUT_S): number {
  const code = extractCode(prediction);
  if (code === null) return 0.0;
  return runCandidate(code, assertions, timeoutS).score;
}

export function passAtK(n: number, c: number, k: number): number {
  if (n < 0 || c < 0 || k <= 0) throw new Error("n, c >= 0 and k > 0");
  if (c > n) throw new Error("c cannot exceed n");
  if (k > n) return c > 0 ? 1.0 : 0.0;
  if (n - c < k) return 1.0;
  let logProb = 0.0;
  for (let i = 0; i < k; i++) logProb += Math.log(n - c - i) - Math.log(n - i);
  return 1.0 - Math.exp(logProb);
}

function mean(values: number[]): number {
  let s = 0.0;
  for (const v of values) s += v;
  return s / values.length;
}

export function passAtKEstimator(samples: boolean[][], ks: number[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const k of ks) {
    const perTask = samples.map((sample) => passAtK(sample.length, sample.filter(Boolean).length, k));
    out.set(k, perTask.length ? mean(perTask) : 0.0);
  }
  return out;
}

interface DemoExample {
  name: string;
  prediction: string;
  assertions: string[];
  expected_exit: string;
  expected_score: number;
  timeout_s?: number;
}

function demoExamples(): DemoExample[] {
  return [
    {
      name: "passes_all",
      prediction: "```python\ndef add(a, b):\n    return a + b\n```",
      assertions: ["add(1, 2) == 3", "add(-5, 5) == 0", "add(100, 1) == 101"],
      expected_exit: EXIT_PASS,
      expected_score: 1.0,
    },
    {
      name: "one_assertion_fails",
      prediction: "```python\ndef add(a, b):\n    return a + b + 1\n```",
      assertions: ["add(1, 2) == 3", "add(-5, 5) == 0"],
      expected_exit: EXIT_ASSERTION_FAIL,
      expected_score: 0.0,
    },
    {
      name: "syntax_error",
      prediction: "```python\ndef add(a, b)\n    return a + b\n```",
      assertions: ["add(1, 2) == 3"],
      expected_exit: EXIT_SYNTAX_ERROR,
      expected_score: 0.0,
    },
    {
      name: "timeout",
      prediction: "```python\nimport time\ndef add(a, b):\n    time.sleep(10)\n    return a + b\n```",
      assertions: ["add(1, 2) == 3"],
      expected_exit: EXIT_TIMEOUT,
      expected_score: 0.0,
      timeout_s: 0.6,
    },
    {
      name: "denylist_subprocess",
      prediction: "```python\nimport subprocess\ndef bad():\n    subprocess.run(['ls'])\nbad()\n```",
      assertions: ["bad() is None"],
      expected_exit: EXIT_ERROR,
      expected_score: 0.0,
    },
  ];
}

export function demo(): number {
  let failures = 0;
  for (const ex of demoExamples()) {
    const result = runCandidate(extractCode(ex.prediction) || "", ex.assertions, ex.timeout_s ?? DEFAULT_TIMEOUT_S);
    const ok = result.exit_code === ex.expected_exit && Math.abs(result.score - ex.expected_score) < 1e-6;
    const status = ok ? "OK" : "WRONG";
    if (!ok) failures += 1;
    console.log(
      `  [${status}] ${ex.name.padEnd(24)} exit=${result.exit_code.padEnd(14)} score=${result.score.toFixed(2)} detail=${[...result.detail].slice(0, 60).join("")}`,
    );
  }

  const samplesPerTask = [
    [true, true, false, false, false, false, false, false, false, false],
    [true, false, false, false, false, false, false, false, false, false],
    [false, false, false, false, false, false, false, false, false, false],
  ];
  const p = passAtKEstimator(samplesPerTask, [1, 5, 10]);
  const f = (k: number): string => (p.get(k) as number).toFixed(3);
  console.log(`  pass@1=${f(1)}  pass@5=${f(5)}  pass@10=${f(10)}`);
  return failures === 0 ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = demo();
}
