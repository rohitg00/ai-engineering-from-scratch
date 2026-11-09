// Lesson: Initialization Scripts for Agents (phase 14 / lesson 35)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/35-initialization-scripts/docs/en.md
// Run: npx tsx phases/14-agent-engineering/35-initialization-scripts/code/main.ts

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, constants, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import { delimiter, join } from "node:path";

const HERE = __dirname;
const WORK = join(HERE, "workdir");
const STATE_PATH = join(WORK, "agent_state.json");
const REPORT_PATH = join(WORK, "init_report.json");
const LOCK_PATH = join(WORK, "prereqs.lock");
const LKG_PATH = join(WORK, "last_known_good.json");

const REQUIRED_NODE: [number, number] = [20, 0];
const REQUIRED_DEPS = ["node:fs", "node:crypto"];
const REQUIRED_TEST_COMMAND = "node";
const REQUIRED_ENV_VARS: string[] = [];
const STATE_FRESHNESS_SECONDS = 24 * 60 * 60;
const LOCK_TTL_SECONDS = 24 * 60 * 60;
const PROBE_BUDGET_SECONDS = 3.0;
const LKG_FILE_DIFF_BUDGET = 50;

const SHA_PATTERN = /^[0-9a-fA-F]{7,40}$/;

interface Probe {
  name: string;
  status: string;
  detail: string;
  duration_ms: number;
}

function makeProbe(name: string, status: string, detail: string): Probe {
  return { name, status, detail, duration_ms: 0 };
}

function pyList(items: string[]): string {
  return "[" + items.map((s) => `'${s}'`).join(", ") + "]";
}

function nowSeconds(): number {
  return Date.now() / 1000;
}

function timed(probeFn: () => Probe): () => Probe {
  return () => {
    const started = nowSeconds();
    const result = probeFn();
    result.duration_ms = Math.trunc((nowSeconds() - started) * 1000);
    if (result.duration_ms > PROBE_BUDGET_SECONDS * 1000 && result.status === "pass") {
      result.status = "warn";
      result.detail = `${result.detail} (slow: ${result.duration_ms}ms > ${Math.trunc(PROBE_BUDGET_SECONDS * 1000)}ms)`;
    }
    return result;
  };
}

function which(cmd: string): string | null {
  const windows = process.platform === "win32";
  const exts = windows ? ["", ...(process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").filter(Boolean)] : [""];
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = join(dir, cmd + ext);
      try {
        if (statSync(candidate).isFile()) {
          if (!windows) accessSync(candidate, constants.X_OK);
          return candidate;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

const probeRuntime = timed(() => {
  const [major, minor] = process.versions.node.split(".").map(Number);
  const meets = major > REQUIRED_NODE[0] || (major === REQUIRED_NODE[0] && minor >= REQUIRED_NODE[1]);
  if (meets) {
    return makeProbe("runtime", "pass", `node ${major}.${minor}`);
  }
  return makeProbe("runtime", "fail", `need >= (${REQUIRED_NODE[0]}, ${REQUIRED_NODE[1]}), have ${major}.${minor}`);
});

const probeDependencies = timed(() => {
  const missing = REQUIRED_DEPS.filter((dep) => !isBuiltin(dep));
  if (missing.length > 0) {
    return makeProbe("dependencies", "fail", `missing: ${pyList(missing)}`);
  }
  return makeProbe("dependencies", "pass", `all of ${pyList(REQUIRED_DEPS)} importable`);
});

const probeTestCommand = timed(() => {
  if (which(REQUIRED_TEST_COMMAND)) {
    return makeProbe("test_command", "pass", `${REQUIRED_TEST_COMMAND} resolvable on PATH`);
  }
  return makeProbe("test_command", "fail", `${REQUIRED_TEST_COMMAND} not on PATH`);
});

const probeEnv = timed(() => {
  const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    return makeProbe("env", "fail", `missing env vars: ${pyList(missing)}`);
  }
  return makeProbe("env", "pass", `all of ${REQUIRED_ENV_VARS.length > 0 ? pyList(REQUIRED_ENV_VARS) : "[]"} present`);
});

const probeStateFreshness = timed(() => {
  if (!existsSync(STATE_PATH)) {
    return makeProbe("state_freshness", "warn", "no state file yet; first run");
  }
  const age = nowSeconds() - statSync(STATE_PATH).mtimeMs / 1000;
  if (age > STATE_FRESHNESS_SECONDS) {
    const hours = Math.floor(age / 3600);
    return makeProbe("state_freshness", "warn", `state is ${hours}h old; confirm before continuing`);
  }
  return makeProbe("state_freshness", "pass", `state is ${Math.trunc(age)}s old`);
});

const probeLkgDiff = timed(() => {
  if (!existsSync(LKG_PATH)) {
    return makeProbe("lkg_diff", "warn", "no last_known_good.json; pin one after first successful merge");
  }
  let baseline: unknown;
  try {
    const lkg = JSON.parse(readFileSync(LKG_PATH, "utf8")) as { [key: string]: unknown };
    baseline = lkg.commit;
    if (!baseline) {
      return makeProbe("lkg_diff", "warn", "lkg file present but commit field empty");
    }
  } catch (exc) {
    return makeProbe("lkg_diff", "fail", `lkg file unreadable: ${(exc as Error).message}`);
  }
  if (typeof baseline !== "string" || !SHA_PATTERN.test(baseline)) {
    return makeProbe("lkg_diff", "warn", "lkg commit invalid; skipped");
  }
  const out = spawnSync("git", ["diff", "--name-only", baseline, "HEAD"], { cwd: HERE, encoding: "utf8", timeout: 2000 });
  if (out.error) {
    return makeProbe("lkg_diff", "warn", "git unavailable or slow; skipped");
  }
  if (out.status !== 0) {
    return makeProbe("lkg_diff", "warn", `git diff failed: ${out.stderr.trim().slice(0, 60)}`);
  }
  const changed = out.stdout.split(/\r\n|\r|\n/).filter((ln) => ln.trim().length > 0);
  if (changed.length > LKG_FILE_DIFF_BUDGET) {
    return makeProbe("lkg_diff", "fail", `${changed.length} files changed since ${baseline.slice(0, 7)} (budget ${LKG_FILE_DIFF_BUDGET})`);
  }
  return makeProbe("lkg_diff", "pass", `${changed.length} files changed since ${baseline.slice(0, 7)}`);
});

function depsFingerprint(): string {
  const h = createHash("sha256");
  h.update(pyList([...REQUIRED_DEPS].sort()));
  h.update(REQUIRED_TEST_COMMAND);
  h.update(pyList([...REQUIRED_ENV_VARS].sort()));
  h.update(`(${REQUIRED_NODE[0]}, ${REQUIRED_NODE[1]})`);
  return h.digest("hex").slice(0, 16);
}

function pyFloat(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (/^[+-]?(inf|infinity)$/i.test(text)) return text.startsWith("-") ? -Infinity : Infinity;
  if (/^[+-]?nan$/i.test(text)) return NaN;
  if (/^[+-]?(\d[\d_]*\.?[\d_]*|\.\d[\d_]*)([eE][+-]?\d+)?$/.test(text)) return Number(text.replace(/_/g, ""));
  return null;
}

function lockIsFresh(): boolean {
  if (!existsSync(LOCK_PATH)) {
    return false;
  }
  let lock: unknown;
  try {
    lock = JSON.parse(readFileSync(LOCK_PATH, "utf8"));
  } catch {
    return false;
  }
  if (typeof lock !== "object" || lock === null || Array.isArray(lock)) {
    return false;
  }
  const record = lock as { [key: string]: unknown };
  if (record.fingerprint !== depsFingerprint()) {
    return false;
  }
  const raw = "written_at" in record ? record.written_at : 0;
  let writtenAt: number;
  if (typeof raw === "number" || typeof raw === "boolean") {
    writtenAt = Number(raw);
  } else {
    const parsed = pyFloat(raw);
    if (parsed === null) {
      return false;
    }
    writtenAt = parsed;
  }
  const age = nowSeconds() - writtenAt;
  return age < LOCK_TTL_SECONDS;
}

function writeLock(): void {
  writeFileSync(LOCK_PATH, JSON.stringify({ fingerprint: depsFingerprint(), written_at: nowSeconds() }, null, 2) + "\n");
}

function runProbes(): Probe[] {
  return [probeRuntime(), probeDependencies(), probeTestCommand(), probeEnv(), probeStateFreshness(), probeLkgDiff()];
}

function parseArgs(argv: string[]): { noCache: boolean; writeLkg: boolean } | null {
  const usage = "usage: main.ts [-h] [--no-cache] [--write-lkg]";
  const args = { noCache: false, writeLkg: false };
  const unknown: string[] = [];
  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") {
      console.log(`${usage}\n\noptions:\n  -h, --help   show this help message and exit\n  --no-cache   ignore prereqs.lock and run every probe\n  --write-lkg  pin current HEAD as last-known-good`);
      process.exit(0);
    } else if (arg === "--no-cache") {
      args.noCache = true;
    } else if (arg === "--write-lkg") {
      args.writeLkg = true;
    } else {
      unknown.push(arg);
    }
  }
  if (unknown.length > 0) {
    console.error(`${usage}\nmain.ts: error: unrecognized arguments: ${unknown.join(" ")}`);
    return null;
  }
  return args;
}

function main(argv: string[] = process.argv.slice(2)): number {
  const args = parseArgs(argv);
  if (args === null) {
    return 2;
  }

  mkdirSync(WORK, { recursive: true });

  if (args.writeLkg) {
    const res = spawnSync("git", ["rev-parse", "HEAD"], { cwd: HERE, encoding: "utf8", timeout: 2000, stdio: ["inherit", "pipe", "inherit"] });
    if (res.error || res.status !== 0) {
      const reason = res.error ? res.error.message : `Command '['git', 'rev-parse', 'HEAD']' returned non-zero exit status ${res.status}.`;
      console.error(`lkg pin failed: ${reason}`);
      return 1;
    }
    const head = res.stdout.trim();
    writeFileSync(LKG_PATH, JSON.stringify({ commit: head, written_at: nowSeconds() }, null, 2) + "\n");
    console.log(`pinned LKG -> ${head.slice(0, 7)}`);
    return 0;
  }

  if (!args.noCache && lockIsFresh()) {
    console.log(`prereqs.lock fresh (TTL ${LOCK_TTL_SECONDS}s); skipping probes`);
    return 0;
  }

  const probes = runProbes();
  const report = {
    timestamp: nowSeconds(),
    probes,
    ok: probes.every((p) => p.status !== "fail"),
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");

  const width = Math.max(...probes.map((p) => p.name.length));
  for (const p of probes) {
    console.log(`  ${p.name.padEnd(width)}  ${p.status.padStart(4)}  ${String(p.duration_ms).padStart(4)}ms  ${p.detail}`);
  }

  if (!report.ok) {
    console.error("\ninit failed; refuse to launch agent");
    return 1;
  }
  writeLock();
  console.log("\ninit ok (lock refreshed)");
  return 0;
}

process.exitCode = main();
