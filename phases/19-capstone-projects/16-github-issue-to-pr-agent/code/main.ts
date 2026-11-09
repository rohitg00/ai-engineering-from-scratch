// Lesson: Capstone 16, GitHub Issue-to-PR Autonomous Agent (phase 19 / lesson 16)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/16-github-issue-to-pr-agent/docs/en.md
// Run: npx tsx phases/19-capstone-projects/16-github-issue-to-pr-agent/code/main.ts

class Rng {
  private a: number;
  private spare: number | null = null;

  constructor(seed: number) {
    this.a = seed >>> 0;
  }

  random(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
  }

  choice<T>(xs: T[]): T {
    return xs[Math.floor(this.random() * xs.length)];
  }

  gauss(mu: number, sigma: number): number {
    if (this.spare !== null) {
      const z = this.spare;
      this.spare = null;
      return mu + sigma * z;
    }
    let u1 = this.random();
    while (u1 <= 0) u1 = this.random();
    const u2 = this.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    this.spare = r * Math.sin(2 * Math.PI * u2);
    return mu + sigma * r * Math.cos(2 * Math.PI * u2);
  }
}

function now(): number {
  return Date.now() / 1000;
}

function pyFloat(n: number): string {
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

class Task {
  constructor(
    public taskId: number,
    public repo: string,
    public issueNum: number,
    public title: string,
    public createdAt: number = now(),
  ) {}
}

class DefaultMap extends Map<string, number> {
  get(key: string): number {
    return super.get(key) ?? 0;
  }
}

class BudgetLedger {
  dailyDollarCap = 50.0;
  dailyPrCap = 5;
  perTaskDollarCap = 20.0;
  spentToday = new DefaultMap();
  prsToday = new DefaultMap();

  permit(repo: string, estimatedCost: number): [boolean, string] {
    if (estimatedCost > this.perTaskDollarCap) {
      return [false, `task estimate $${estimatedCost.toFixed(2)} > cap $${pyFloat(this.perTaskDollarCap)}`];
    }
    const worstCase = this.perTaskDollarCap;
    if (this.spentToday.get(repo) + worstCase > this.dailyDollarCap) {
      return [false, `daily $ cap for ${repo} would be exceeded`];
    }
    if (this.prsToday.get(repo) >= this.dailyPrCap) {
      return [false, `daily PR cap (${this.dailyPrCap}) for ${repo} reached`];
    }
    return [true, "ok"];
  }

  record(repo: string, spent: number, openedPr: boolean): void {
    this.spentToday.set(repo, this.spentToday.get(repo) + spent);
    if (openedPr) this.prsToday.set(repo, this.prsToday.get(repo) + 1);
  }
}

class InstallationToken {
  constructor(
    public repo: string,
    public expiresAt: number,
    public permissions: Record<string, string> = {},
  ) {}

  static mint(repo: string): InstallationToken {
    return new InstallationToken(repo, now() + 3600,
      { issues: "rw", pull_requests: "rw", contents: "rw", workflows: "r" });
  }

  can(action: string): boolean {
    if (action === "force_push") return false;
    if (action.startsWith("write:main")) return false;
    return true;
  }
}

enum SState {
  CLONE = 1,
  INFER,
  AGENT,
  VERIFY,
  PR,
  DONE,
  FAILED,
}

class SandboxRun {
  state: SState = SState.CLONE;
  turns = 0;
  dollars = 0.0;
  wallMin = 0.0;
  coverageDelta = 0.0;
  ciGreen = false;
  prOpened = false;
  failure: string | null = null;
  trace: string[] = [];

  constructor(public task: Task) {}
}

function runAgent(run: SandboxRun, difficulty: number, rng: Rng,
  turnCap = 20, dollarCap = 20.0, minuteCap = 30.0): void {
  run.state = SState.AGENT;
  const perTurnP = Math.max(0.05, 0.35 * (1 - difficulty));
  const perTurnMin = 0.9 + difficulty * 0.6;
  const perTurnUsd = 0.25 + difficulty * 0.45;

  while (true) {
    run.turns += 1;
    run.wallMin += perTurnMin;
    run.dollars += perTurnUsd;
    run.trace.push(`turn ${run.turns}: $=${run.dollars.toFixed(2)}`);

    if (run.turns >= turnCap) {
      run.failure = "turn_cap";
      run.state = SState.FAILED;
      return;
    }
    if (run.dollars >= dollarCap) {
      run.failure = "dollar_cap";
      run.state = SState.FAILED;
      return;
    }
    if (run.wallMin >= minuteCap) {
      run.failure = "minute_cap";
      run.state = SState.FAILED;
      return;
    }

    if (rng.random() < perTurnP) {
      run.state = SState.VERIFY;
      return;
    }
  }
}

function runVerify(run: SandboxRun, _difficulty: number, rng: Rng): void {
  const flake = rng.random() < 0.05;
  if (flake) {
    run.ciGreen = false;
    run.failure = "flaky_test";
    run.state = SState.FAILED;
    return;
  }
  run.ciGreen = true;
  run.coverageDelta = rng.gauss(0.0, 0.6);
  if (run.coverageDelta < -2.0) {
    run.failure = "coverage_regression";
    run.state = SState.FAILED;
    return;
  }
  run.state = SState.PR;
}

function openPr(run: SandboxRun, token: InstallationToken): void {
  if (now() >= token.expiresAt) {
    run.failure = "token_expired";
    run.state = SState.FAILED;
    return;
  }
  if (!token.can("pull_request.open")) {
    run.failure = "policy_denied";
    run.state = SState.FAILED;
    return;
  }
  run.prOpened = true;
  run.state = SState.DONE;
}

function dispatch(task: Task, ledger: BudgetLedger, rng: Rng): SandboxRun {
  const difficulty = rng.uniform(0.3, 0.92);
  const estimated = 2.0 + difficulty * 8.0;
  const [allowed, reason] = ledger.permit(task.repo, estimated);
  if (!allowed) {
    const run = new SandboxRun(task);
    run.failure = `dispatcher: ${reason}`;
    run.state = SState.FAILED;
    return run;
  }

  const token = InstallationToken.mint(task.repo);
  const run = new SandboxRun(task);
  run.trace.push("state: CLONE");
  run.state = SState.INFER as SState;
  run.trace.push("state: INFER (dockerfile synthesized)");
  runAgent(run, difficulty, rng);
  if (run.state === SState.VERIFY) runVerify(run, difficulty, rng);
  if (run.state === SState.PR) openPr(run, token);
  ledger.record(task.repo, run.dollars, run.prOpened);
  return run;
}

function main(): void {
  const rng = new Rng(9);
  const ledger = new BudgetLedger();
  const repos = ["acme/widget", "acme/service", "acme/library"];
  const runs: SandboxRun[] = [];

  for (let i = 0; i < 20; i++) {
    const task = new Task(i, rng.choice(repos), 800 + i, `fix NPE in module ${i}`);
    runs.push(dispatch(task, ledger, rng));
  }

  const opened = runs.filter((r) => r.prOpened).length;
  const failed = runs.filter((r) => r.state === SState.FAILED).length;
  console.log(`=== dispatch result (${runs.length} tasks) ===`);
  console.log(`PRs opened : ${opened}`);
  console.log(`failed     : ${failed}`);

  console.log("\nfailure reasons:");
  const reasons = new Map<string, number>();
  for (const r of runs) {
    if (r.failure) reasons.set(r.failure, (reasons.get(r.failure) ?? 0) + 1);
  }
  for (const [reason, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason.padEnd(24)} ${n}`);
  }

  console.log("\nbudget summary:");
  for (const repo of repos) {
    console.log(`  ${repo.padEnd(20)} spent=$${ledger.spentToday.get(repo).toFixed(2)}  ` +
      `PRs=${ledger.prsToday.get(repo)}`);
  }

  if (opened) {
    const passed = runs.filter((r) => r.prOpened);
    const meanCost = passed.reduce((a, r) => a + r.dollars, 0) / opened;
    const meanTurns = passed.reduce((a, r) => a + r.turns, 0) / opened;
    console.log(`\npass set: mean $/PR = $${meanCost.toFixed(2)}  mean turns = ${meanTurns.toFixed(1)}`);
  }
}

main();

export {};
