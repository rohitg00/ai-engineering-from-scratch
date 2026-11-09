// Lesson: The Autonomous Coding Agent Landscape (2026) (phase 15 / lesson 09)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/09-coding-agent-landscape/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/09-coding-agent-landscape/code/main.ts

type Repo = Map<string, string>;

const INITIAL_REPO: [string, string][] = [
  ["app.py", "def add(a, b):\n    return a - b\n"],
  ["util.py", "def lower(s):\n    return s.upper()\n"],
  ["cli.py", "VERSION = 'v0.0'\n"],
];

const TESTS: [string, string][] = [
  ["app.py", "add(2, 3) == 5"],
  ["util.py", "lower('AB') == 'ab'"],
  ["cli.py", "VERSION == 'v1.0'"],
];

const FIXES = new Map<string, [string, string]>([
  ["app.py", ["a - b", "a + b"]],
  ["util.py", ["s.upper()", "s.lower()"]],
  ["cli.py", ["v0.0", "v1.0"]],
]);

function runTests(repo: Repo): boolean[] {
  const results: boolean[] = [];
  for (const [path] of TESTS) {
    const src = repo.get(path) ?? "";
    let passed = false;
    if (path === "app.py") passed = src.includes("return a + b");
    else if (path === "util.py") passed = src.includes("return s.lower()");
    else if (path === "cli.py") passed = src.includes("VERSION = 'v1.0'");
    results.push(passed);
  }
  return results;
}

function applyFix(repo: Repo, path: string): boolean {
  const rule = FIXES.get(path);
  if (rule === undefined) return false;
  const [oldText, newText] = rule;
  repo.set(path, (repo.get(path) as string).replaceAll(oldText, newText));
  return true;
}

function countPassed(repo: Repo): number {
  return runTests(repo).filter((ok) => ok).length;
}

class JsonScaffold {
  repo: Repo = new Map(INITIAL_REPO);
  turns = 0;

  step(): string {
    this.turns += 1;
    const results = runTests(this.repo);
    for (let i = 0; i < TESTS.length; i++) {
      if (results[i]) continue;
      const path = TESTS[i][0];
      if (applyFix(this.repo, path)) return JSON.stringify({ tool: "edit", path });
    }
    return JSON.stringify({ tool: "done" });
  }

  blastRadius(): number {
    return 1;
  }

  run(maxTurns = 10): [number, number] {
    for (let i = 0; i < maxTurns; i++) {
      const action = this.step();
      if (JSON.parse(action).tool === "done") break;
    }
    return [countPassed(this.repo), this.turns];
  }
}

class CodeActScaffold {
  repo: Repo = new Map(INITIAL_REPO);
  turns = 0;
  worstTouched = 0;

  step(): string {
    this.turns += 1;
    const snippetLines: string[] = [];
    const results = runTests(this.repo);
    for (let i = 0; i < TESTS.length; i++) {
      if (results[i]) continue;
      const path = TESTS[i][0];
      if (applyFix(this.repo, path)) snippetLines.push(`fs.write('${path}', ...)`);
    }
    this.worstTouched = Math.max(this.worstTouched, snippetLines.length);
    if (snippetLines.length === 0) return "done()";
    return snippetLines.join("; ");
  }

  blastRadius(): number {
    return this.worstTouched;
  }

  run(maxTurns = 10): [number, number] {
    for (let i = 0; i < maxTurns; i++) {
      const action = this.step();
      if (action === "done()") break;
    }
    return [countPassed(this.repo), this.turns];
  }
}

function report(name: string, passed: number, turns: number, blast: number): void {
  const total = TESTS.length;
  console.log(`  ${name.padEnd(18)}  passed ${passed}/${total}  turns ${String(turns).padStart(2)}  blast-radius ${blast}`);
}

function main(): void {
  console.log("=".repeat(70));
  console.log("CODEACT vs JSON TOOL-CALL SCAFFOLDS (Phase 15, Lesson 9)");
  console.log("=".repeat(70));
  console.log();
  console.log("Same stub model, three-bug toy repo. Scaffold-only comparison.");
  console.log("-".repeat(70));

  const js = new JsonScaffold();
  let [passed, turns] = js.run();
  report("JSON tool-call", passed, turns, js.blastRadius());

  const ca = new CodeActScaffold();
  [passed, turns] = ca.run();
  report("CodeAct (stub)", passed, turns, ca.blastRadius());

  console.log();
  console.log("=".repeat(70));
  console.log("HEADLINE: scaffolding is not scenery. It is the product.");
  console.log("-".repeat(70));
  console.log("  Same model, two scaffolds, different turn counts.");
  console.log("  CodeAct compresses multiple edits into one action.");
  console.log("  The cost is blast radius: CodeAct needs hardened sandbox");
  console.log("  isolation (OpenHands uses Docker). JSON tool-calls get safety");
  console.log("  by construction since every action is independently validated.");
  console.log("  Neither is strictly better; the trade-off is what to audit.");
}

main();

export {};
