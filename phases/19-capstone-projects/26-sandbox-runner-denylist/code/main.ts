// Lesson: Capstone Lesson 26: Sandbox Runner with Denylist and Path Jail (phase 19 / lesson 26)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/26-sandbox-runner-denylist/docs/en.md
// Run: npx tsx phases/19-capstone-projects/26-sandbox-runner-denylist/code/main.ts

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { performance } from "node:perf_hooks";

export const DENIED_EXIT_CODE = -100;
export const TIMED_OUT_EXIT_CODE = -101;

export const DEFAULT_DENYLIST: ReadonlySet<string> = new Set([
  "rm",
  "sudo",
  "mkfs",
  "mkfs.ext4",
  "mkfs.fat",
  "curl",
  "wget",
  "chmod",
  "dd",
  "kill",
  "pkill",
  "shutdown",
  "reboot",
  "halt",
  "poweroff",
  "eval",
  "exec",
  "base64",
  "nc",
  "ncat",
  "telnet",
  "su",
  "iptables",
  "ufw",
]);

export const DEFAULT_INTERPRETER_BLOCK: ReadonlySet<string> = new Set([
  "python",
  "python3",
  "bash",
  "sh",
  "zsh",
  "fish",
  "node",
  "deno",
  "perl",
  "ruby",
  "lua",
  "awk",
  "tclsh",
  "php",
]);

const INTERPRETER_FLAG_PATTERNS: readonly RegExp[] = [
  /^-c$/,
  /^-e$/,
  /^--eval$/,
  /^--exec$/,
  /^-cu$/,
  /^-ce$/,
];

const SHELL_METACHARS: readonly string[] = [";", "|", "&", ">", "<", "`", "$(", "${", ")"];

export const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;
export const DEFAULT_TIMEOUT_SECONDS = 30.0;
const TRUNCATION_MARKER: Buffer = Buffer.from("\n[sandbox: output truncated]\n");

function pyRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === quote) out += "\\" + ch;
    else out += ch;
  }
  return quote + out + quote;
}

function pyFloat(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function pathExistsNoFollow(p: string): fs.Stats | null {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
}

export function realpath(p: string): string {
  const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  let pending = abs.split("/").filter((c) => c.length > 0);
  let current = "/";
  let hops = 0;
  while (pending.length > 0) {
    const comp = pending.shift()!;
    if (comp === ".") continue;
    if (comp === "..") {
      current = path.dirname(current);
      continue;
    }
    const next = path.join(current, comp);
    const st = pathExistsNoFollow(next);
    if (st !== null && st.isSymbolicLink() && hops < 40) {
      hops += 1;
      const target = fs.readlinkSync(next);
      const parts = target.split("/").filter((c) => c.length > 0);
      if (path.isAbsolute(target)) current = "/";
      pending = [...parts, ...pending];
      continue;
    }
    current = next;
  }
  return current;
}

export class SandboxResult {
  argv: string[];
  exitCode: number;
  stdout: Buffer = Buffer.alloc(0);
  stderr: Buffer = Buffer.alloc(0);
  truncated = false;
  timedOut = false;
  denied = false;
  reason = "";
  durationMs = 0.0;

  constructor(argv: string[], exitCode: number, fields: Partial<SandboxResult> = {}) {
    this.argv = argv;
    this.exitCode = exitCode;
    Object.assign(this, fields);
  }

  get ok(): boolean {
    return this.exitCode === 0 && !this.denied && !this.timedOut;
  }

  toDict(): Record<string, unknown> {
    return {
      argv: this.argv,
      exit_code: this.exitCode,
      stdout_bytes: this.stdout.length,
      stderr_bytes: this.stderr.length,
      truncated: this.truncated,
      timed_out: this.timedOut,
      denied: this.denied,
      reason: this.reason,
      duration_ms: Math.round(this.durationMs * 100) / 100,
    };
  }
}

export class SandboxConfig {
  projectRoot: string;
  maxOutputBytes: number;
  timeoutSeconds: number;
  denylist: ReadonlySet<string>;
  interpreterBlock: ReadonlySet<string>;
  envAllowlist: readonly string[];

  constructor(opts: {
    projectRoot: string;
    maxOutputBytes?: number;
    timeoutSeconds?: number;
    denylist?: ReadonlySet<string>;
    interpreterBlock?: ReadonlySet<string>;
    envAllowlist?: readonly string[];
  }) {
    this.projectRoot = realpath(opts.projectRoot);
    this.maxOutputBytes = opts.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    this.timeoutSeconds = opts.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
    this.denylist = opts.denylist ?? DEFAULT_DENYLIST;
    this.interpreterBlock = opts.interpreterBlock ?? DEFAULT_INTERPRETER_BLOCK;
    this.envAllowlist = opts.envAllowlist ?? ["PATH", "HOME", "LANG", "LC_ALL", "TERM"];
  }
}

function basename(executable: string): string {
  const s = executable.trim();
  return s.slice(s.lastIndexOf("/") + 1);
}

function checkExecutableDenylist(argv: readonly string[], cfg: SandboxConfig): string | null {
  if (argv.length === 0) return "empty argv";
  const name = basename(argv[0]);
  if (!name) return `executable ${pyRepr(argv[0])} has no basename`;
  if (cfg.denylist.has(name)) return `executable ${pyRepr(name)} is on the denylist`;
  return null;
}

function checkArgvInterpreter(argv: readonly string[], cfg: SandboxConfig): string | null {
  if (argv.length === 0) return null;
  const name = basename(argv[0]);
  if (!cfg.interpreterBlock.has(name)) return null;
  for (const arg of argv.slice(1)) {
    for (const pat of INTERPRETER_FLAG_PATTERNS) {
      if (pat.test(arg)) {
        return (
          `interpreter ${pyRepr(name)} invoked with refused flag ${pyRepr(arg)}; ` +
          "use a script file instead of -c/-e"
        );
      }
    }
  }
  return null;
}

function checkShellMetachars(argv: readonly string[], shell: boolean): string | null {
  if (shell) return null;
  for (const arg of argv) {
    for (const meta of SHELL_METACHARS) {
      if (arg.includes(meta)) {
        return `argv contains shell metachar ${pyRepr(meta)} in ${pyRepr(arg)}; ` + "set shell=True to opt in";
      }
    }
  }
  return null;
}

const PATH_HINT = /[/\\]|^\.{1,2}$/;

function looksLikePath(arg: string): boolean {
  if (!arg) return false;
  if (PATH_HINT.test(arg)) return true;
  return false;
}

function checkPathJail(argv: readonly string[], cfg: SandboxConfig): string | null {
  const root = cfg.projectRoot;
  for (const arg of argv.slice(1)) {
    if (!arg || arg.startsWith("-")) continue;
    if (!looksLikePath(arg) && pathExistsNoFollow(root + "/" + arg) === null) continue;
    let candidate = arg;
    if (!path.isAbsolute(candidate)) candidate = root + "/" + candidate;
    const resolved = realpath(candidate);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      return (
        `path argument ${pyRepr(arg)} resolves outside project root ` +
        `(${pyRepr(resolved)} not under ${pyRepr(root)})`
      );
    }
  }
  return null;
}

export function truncateStream(buf: Buffer, maxBytes: number): [Buffer, boolean] {
  if (buf.length <= maxBytes) return [buf, false];
  const head = buf.subarray(0, maxBytes);
  return [Buffer.concat([head, TRUNCATION_MARKER]), true];
}

type ProcOutcome = {
  returncode: number;
  stdout: Buffer;
  stderr: Buffer;
  timedOut: boolean;
  notFound: string | null;
};

function runProcess(
  argv: string[],
  opts: { shell: boolean; cwd: string; env: Record<string, string>; timeoutS: number; input: Buffer | null; keepBytes: number },
): Promise<ProcOutcome> {
  return new Promise((resolve) => {
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let outLen = 0;
    let errLen = 0;
    let timedOut = false;
    let notFound: string | null = null;
    const [file, ...rest] = opts.shell ? ["/bin/sh", "-c", ...argv] : argv;
    const child = spawn(file, rest, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: [opts.input === null ? "inherit" : "pipe", "pipe", "pipe"],
    });
    child.stdout!.on("data", (chunk: Buffer) => {
      if (outLen <= opts.keepBytes) {
        out.push(chunk);
        outLen += chunk.length;
      }
    });
    child.stderr!.on("data", (chunk: Buffer) => {
      if (errLen <= opts.keepBytes) {
        err.push(chunk);
        errLen += chunk.length;
      }
    });
    child.on("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") notFound = `[Errno 2] No such file or directory: ${pyRepr(file)}`;
    });
    if (opts.input !== null) {
      child.stdin!.on("error", () => undefined);
      child.stdin!.end(opts.input);
    }
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeoutS * 1000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        returncode: code ?? -9,
        stdout: Buffer.concat(out),
        stderr: Buffer.concat(err),
        timedOut,
        notFound,
      });
    });
  });
}

export class Sandbox {
  constructor(readonly config: SandboxConfig) {}

  async run(
    argv: readonly string[],
    opts: { shell?: boolean; cwd?: string; stdin?: Buffer } = {},
  ): Promise<SandboxResult> {
    const shell = opts.shell ?? false;
    const argvList = [...argv];
    const result = new SandboxResult(argvList, DENIED_EXIT_CODE);

    for (const check of [checkExecutableDenylist, checkArgvInterpreter]) {
      const reason = check(argvList, this.config);
      if (reason !== null) {
        result.denied = true;
        result.reason = reason;
        return result;
      }
    }

    const shellReason = checkShellMetachars(argvList, shell);
    if (shellReason !== null) {
      result.denied = true;
      result.reason = shellReason;
      return result;
    }

    const pathReason = checkPathJail(argvList, this.config);
    if (pathReason !== null) {
      result.denied = true;
      result.reason = pathReason;
      return result;
    }

    const workCwd = opts.cwd || this.config.projectRoot;
    const realCwd = realpath(workCwd);
    if (realCwd !== this.config.projectRoot && !realCwd.startsWith(this.config.projectRoot + path.sep)) {
      result.denied = true;
      result.reason = `cwd ${pyRepr(workCwd)} not under project root`;
      return result;
    }

    const env: Record<string, string> = {};
    for (const key of this.config.envAllowlist) {
      const v = process.env[key];
      if (v !== undefined) env[key] = v;
    }

    const started = performance.now();
    const proc = await runProcess(argvList, {
      shell,
      cwd: realCwd,
      env,
      timeoutS: this.config.timeoutSeconds,
      input: opts.stdin ?? null,
      keepBytes: this.config.maxOutputBytes,
    });
    const elapsed = performance.now() - started;

    if (proc.notFound !== null) {
      return new SandboxResult(argvList, DENIED_EXIT_CODE, {
        stdout: Buffer.alloc(0),
        stderr: Buffer.from(proc.notFound, "utf-8"),
        truncated: false,
        timedOut: false,
        denied: true,
        reason: `executable not found: ${proc.notFound}`,
        durationMs: elapsed,
      });
    }

    const [stdoutBuf, stdoutTruncated] = truncateStream(proc.stdout, this.config.maxOutputBytes);
    const [stderrBuf, stderrTruncated] = truncateStream(proc.stderr, this.config.maxOutputBytes);

    if (proc.timedOut) {
      return new SandboxResult(argvList, TIMED_OUT_EXIT_CODE, {
        stdout: stdoutBuf,
        stderr: stderrBuf,
        truncated: stdoutTruncated || stderrTruncated,
        timedOut: true,
        denied: false,
        reason: `wall-clock timeout after ${pyFloat(this.config.timeoutSeconds)}s`,
        durationMs: elapsed,
      });
    }

    return new SandboxResult(argvList, proc.returncode, {
      stdout: stdoutBuf,
      stderr: stderrBuf,
      truncated: stdoutTruncated || stderrTruncated,
      timedOut: false,
      denied: false,
      reason: "",
      durationMs: elapsed,
    });
  }
}

export function findExecutable(candidates: Iterable<string>): string | null {
  for (const name of candidates) {
    const p = which(name);
    if (p !== null) return p;
  }
  return null;
}

function which(name: string): string | null {
  for (const entry of (process.env.PATH ?? "").split(path.delimiter)) {
    const candidate = path.join(entry, name);
    try {
      if (fs.statSync(candidate).isFile()) {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function seedProjectRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sandbox-demo-"));
  fs.writeFileSync(path.join(root, "hello.txt"), "hello from inside the sandbox\n", "utf-8");
  const sub = path.join(root, "src");
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, "main.py"), "print('main')\n", "utf-8");
  return root;
}

function printOutcome(label: string, result: SandboxResult): void {
  let badge: string;
  if (result.ok) badge = "OK";
  else if (result.denied) badge = "DENIED";
  else if (result.timedOut) badge = "TIMEOUT";
  else badge = `EXIT ${result.exitCode}`;
  console.log(`  - ${label.padEnd(38)} -> ${badge}`);
  if (result.denied || result.timedOut) console.log(`      reason: ${result.reason}`);
}

export async function runDemo(): Promise<number> {
  const root = seedProjectRoot();
  const config = new SandboxConfig({ projectRoot: root, maxOutputBytes: 512, timeoutSeconds: 2.0 });
  const sandbox = new Sandbox(config);

  const echo = findExecutable(["echo"]) ?? "echo";
  const cat = findExecutable(["cat"]);
  const yes = findExecutable(["yes"]);
  const sleep = findExecutable(["sleep"]);
  const ls = findExecutable(["ls"]);

  console.log("SANDBOX DEMO");
  console.log(`project_root=${root}`);
  console.log("");

  console.log("legal calls:");
  if (ls) printOutcome("ls .", await sandbox.run([ls, "."]));
  printOutcome("echo hello", await sandbox.run([echo, "hello", "from", "sandbox"]));
  if (cat) {
    printOutcome("cat hello.txt", await sandbox.run([cat, "hello.txt"]));
    printOutcome("cat src/main.py", await sandbox.run([cat, "src/main.py"]));
  }

  console.log("");
  console.log("denied by name:");
  printOutcome("rm -rf .", await sandbox.run(["rm", "-rf", "."]));
  printOutcome("sudo apt update", await sandbox.run(["sudo", "apt", "update"]));
  printOutcome("curl http://x", await sandbox.run(["curl", "http://example.com"]));

  console.log("");
  console.log("denied by argv interpreter:");
  printOutcome("python3 -c '...'", await sandbox.run(["python3", "-c", "print('hi')"]));
  printOutcome("bash -c '...'", await sandbox.run(["bash", "-c", "echo pwned"]));

  console.log("");
  console.log("denied by shell metachar:");
  printOutcome("echo a ; rm -rf", await sandbox.run([echo, "a", ";", "rm", "-rf"]));

  console.log("");
  console.log("denied by path jail:");
  if (cat) {
    printOutcome("cat ../../etc/passwd", await sandbox.run([cat, "../../etc/passwd"]));
    printOutcome("cat /etc/passwd", await sandbox.run([cat, "/etc/passwd"]));
  }

  console.log("");
  console.log("timeout / truncation:");
  if (sleep) printOutcome("sleep 5 (cap 2)", await sandbox.run([sleep, "5"]));
  if (yes) {
    const big = await sandbox.run([yes, "y"]);
    printOutcome("yes y (truncated)", big);
  }
  if (echo) {
    const loud = await sandbox.run([echo, "x".repeat(4096)]);
    printOutcome("echo big (truncated)", loud);
  }

  console.log("");
  console.log(JSON.stringify({ project_root: root, sandbox_ok: true }, null, 2));
  return 0;
}

runDemo().then((code) => {
  process.exitCode = code;
});
