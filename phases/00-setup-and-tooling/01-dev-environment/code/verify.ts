// Phase 0 · Lesson 01 — Dev Environment verifier (TypeScript port).
// Probes node version + presence of git, python3, cargo, deno; mirrors verify.py.
// Refs: https://nodejs.org/api/process.html  https://nodejs.org/api/child_process.html

import { execFileSync } from "node:child_process";
import process from "node:process";

type ProbeFn = () => { ok: boolean; detail?: string };

type Probe = {
  name: string;
  required: boolean;
  run: ProbeFn;
};

function whichVersion(cmd: string, args: string[] = ["--version"]): ReturnType<ProbeFn> {
  // execFile (not exec) avoids a shell, so user PATH lookups can't be re-interpreted.
  try {
    const out = execFileSync(cmd, args, {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      timeout: 4000,
    });
    return { ok: true, detail: out.trim().split("\n")[0] };
  } catch {
    return { ok: false };
  }
}

const PROBES: Probe[] = [
  {
    name: "Node.js 20+",
    required: true,
    run: () => {
      const major = Number.parseInt(process.versions.node.split(".")[0]!, 10);
      return { ok: major >= 20, detail: `v${process.versions.node}` };
    },
  },
  {
    name: "TypeScript runner (tsx)",
    required: false,
    run: () => whichVersion("npx", ["-y", "tsx", "--version"]),
  },
  {
    name: "Git",
    required: true,
    run: () => whichVersion("git"),
  },
  {
    name: "Python 3.10+",
    required: true,
    run: () => {
      const probe = whichVersion("python3");
      if (!probe.ok || !probe.detail) return probe;
      // Detail looks like "Python 3.11.7"; pull major.minor.
      const match = probe.detail.match(/(\d+)\.(\d+)/);
      if (!match) return { ok: false, detail: probe.detail };
      const [major, minor] = [Number(match[1]), Number(match[2])];
      const ok = major > 3 || (major === 3 && minor >= 10);
      return { ok, detail: probe.detail };
    },
  },
  {
    name: "Rust (cargo)",
    required: false,
    run: () => whichVersion("cargo"),
  },
  {
    name: "Deno",
    required: false,
    run: () => whichVersion("deno"),
  },
];

function run(): number {
  process.stdout.write("\n=== AI Engineering from Scratch — Environment Check ===\n\n");

  let requiredPassed = 0;
  let requiredTotal = 0;

  for (const probe of PROBES) {
    const result = probe.run();
    const tag = result.ok ? "PASS" : "FAIL";
    const detail = result.detail ? ` (${result.detail})` : "";
    const flag = probe.required ? "" : "  [optional]";
    process.stdout.write(`  [${tag}] ${probe.name}${detail}${flag}\n`);
    if (probe.required) {
      requiredTotal += 1;
      if (result.ok) requiredPassed += 1;
    }
  }

  process.stdout.write(`\nResult: ${requiredPassed}/${requiredTotal} required checks passed\n`);
  if (requiredPassed === requiredTotal) {
    process.stdout.write("\nYou're ready. Start with Phase 1.\n\n");
    return 0;
  }
  process.stdout.write("\nFix the failed required checks above, then re-run.\n\n");
  return 1;
}

process.exit(run());
