// Lesson: Capstone 10: Multi-Agent Software Engineering Team (phase 19 / lesson 10)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/10-multi-agent-software-team/docs/en.md
// Run: npx tsx phases/19-capstone-projects/10-multi-agent-software-team/code/main.ts

export {};

class PyRandom {
  private mt = new Uint32Array(624);
  private mti = 625;

  constructor(seed: number) {
    this.initByArray([seed >>> 0]);
  }

  private initGenrand(s: number): void {
    this.mt[0] = s >>> 0;
    for (this.mti = 1; this.mti < 624; this.mti++) {
      const prev = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
      this.mt[this.mti] = (Math.imul(1812433253, prev) + this.mti) >>> 0;
    }
  }

  private initByArray(key: number[]): void {
    this.initGenrand(19650218);
    let i = 1;
    let j = 0;
    for (let k = Math.max(624, key.length); k > 0; k--) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((this.mt[i] ^ Math.imul(prev, 1664525)) + key[j] + j) >>> 0;
      i++;
      j++;
      if (i >= 624) {
        this.mt[0] = this.mt[623];
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = 623; k > 0; k--) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((this.mt[i] ^ Math.imul(prev, 1566083941)) - i) >>> 0;
      i++;
      if (i >= 624) {
        this.mt[0] = this.mt[623];
        i = 1;
      }
    }
    this.mt[0] = 0x80000000;
  }

  private genrand(): number {
    if (this.mti >= 624) {
      for (let kk = 0; kk < 624; kk++) {
        const y = (this.mt[kk] & 0x80000000) | (this.mt[(kk + 1) % 624] & 0x7fffffff);
        this.mt[kk] = this.mt[(kk + 397) % 624] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      }
      this.mti = 0;
    }
    let y = this.mt[this.mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  random(): number {
    const a = this.genrand() >>> 5;
    const b = this.genrand() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }

  private getrandbits(k: number): number {
    return this.genrand() >>> (32 - k);
  }

  randrange(n: number): number {
    const k = n.toString(2).length;
    let r = this.getrandbits(k);
    while (r >= n) r = this.getrandbits(k);
    return r;
  }

  randint(a: number, b: number): number {
    return a + this.randrange(b - a + 1);
  }
}

enum MsgKind {
  PLAN_REQUEST = "plan_request",
  SUBTASK = "subtask",
  DIFF_READY = "diff_ready",
  REVIEW_NEEDED = "review_needed",
  REVIEW_FEEDBACK = "review_feedback",
  APPROVED = "approved",
  TEST_NEEDED = "test_needed",
  TEST_PASSED = "test_passed",
  TEST_FAILED = "test_failed",
}

interface Msg {
  kind: MsgKind;
  by: string;
  to: string;
  payload: Record<string, unknown>;
  tokens: number;
}

class Board {
  messages: Msg[] = [];
  tokens_by_role = new Map<string, number>();

  post(m: Msg): void {
    this.messages.push(m);
    this.tokens_by_role.set(m.by, (this.tokens_by_role.get(m.by) ?? 0) + m.tokens);
  }

  inbox(role: string): Msg[] {
    return this.messages.filter((m) => m.to === role);
  }
}

class Subtask {
  lines_changed = 0;
  has_bug = false;

  constructor(public name: string, public files: string[]) {}
}

interface Diff {
  subtask: string;
  lines: number;
  has_bug: boolean;
}

function architectPlan(issue: string, rng: PyRandom): Subtask[] {
  const subs = [
    new Subtask("parser", ["src/parser.py"]),
    new Subtask("cache", ["src/cache.py", "src/cache_test.py"]),
    new Subtask("api", ["src/api.py"]),
    new Subtask("migration", ["src/migrate.py"]),
  ];
  const hasBug = rng.random() < 0.3;
  subs[rng.randrange(subs.length)].has_bug = hasBug;
  return subs;
}

function coderImplement(sub: Subtask, rng: PyRandom): Diff {
  sub.lines_changed = rng.randint(15, 95);
  return { subtask: sub.name, lines: sub.lines_changed, has_bug: sub.has_bug };
}

function reviewerCheck(diffs: Diff[], rng: PyRandom): [boolean, string] {
  const buggy = diffs.filter((d) => d.has_bug);
  if (buggy.length === 0) return [true, "lgtm"];
  if (rng.random() < 0.85) return [false, `found bug in ${buggy[0].subtask}: please revisit`];
  return [true, "lgtm (FALSE-APPROVE)"];
}

function testerRun(diffs: Diff[], rng: PyRandom): [boolean, string] {
  const buggy = diffs.filter((d) => d.has_bug);
  if (buggy.length > 0) return [false, `test fails in ${buggy[0].subtask} module`];
  if (rng.random() < 0.03) return [false, "flaky test"];
  return [true, "412/412 passing"];
}

interface TeamResult {
  approved: boolean;
  review_comment: string;
  tested_passed: boolean;
  test_msg: string;
  total_tokens: number;
  tokens_by_role: Map<string, number>;
  handoffs: number;
}

function msg(kind: MsgKind, by: string, to: string, payload: Record<string, unknown>, tokens: number): Msg {
  return { kind, by, to, payload, tokens };
}

function runTeam(issue: string, nCoders: number = 4, rng: PyRandom | null = null): TeamResult {
  const r = rng ?? new PyRandom(0);
  const board = new Board();

  const plan = architectPlan(issue, r);
  board.post(msg(MsgKind.PLAN_REQUEST, "architect", "board", { issue, subtasks: plan.map((s) => s.name) }, 4500));

  plan.slice(0, nCoders).forEach((sub, i) => {
    const coder = `coder-${String.fromCharCode(65 + i)}`;
    board.post(msg(MsgKind.SUBTASK, "architect", coder, { subtask: sub.name, files: sub.files }, 1200));
  });

  let diffs: Diff[] = [];
  plan.slice(0, nCoders).forEach((sub, i) => {
    const coder = `coder-${String.fromCharCode(65 + i)}`;
    const result = coderImplement(sub, r);
    diffs.push(result);
    board.post(msg(MsgKind.DIFF_READY, coder, "merge_coord", { ...result }, 3200 + result.lines * 30));
  });

  board.post(msg(MsgKind.REVIEW_NEEDED, "merge_coord", "reviewer", { diffs }, 2000));

  const [approved, comment] = reviewerCheck(diffs, r);
  if (approved) {
    board.post(msg(MsgKind.APPROVED, "reviewer", "tester", { comment }, 1800));
  } else {
    board.post(msg(MsgKind.REVIEW_FEEDBACK, "reviewer", "coder-A", { comment }, 1800));
    board.post(msg(MsgKind.DIFF_READY, "coder-A", "merge_coord", { subtask: "parser", lines: 52, has_bug: false }, 3100));
    board.post(msg(MsgKind.APPROVED, "reviewer", "tester", { comment: "now lgtm" }, 1500));
    diffs = diffs.map((d) => ({ subtask: d.subtask, lines: d.lines, has_bug: false }));
  }

  const [passed, testmsg] = testerRun(diffs, r);
  if (passed) {
    board.post(msg(MsgKind.TEST_PASSED, "tester", "pr_opener", { msg: testmsg }, 1200));
  } else {
    board.post(msg(MsgKind.TEST_FAILED, "tester", "coder-A", { msg: testmsg }, 1400));
  }

  let total = 0;
  for (const v of board.tokens_by_role.values()) total += v;
  return {
    approved,
    review_comment: comment,
    tested_passed: passed,
    test_msg: testmsg,
    total_tokens: total,
    tokens_by_role: new Map(board.tokens_by_role),
    handoffs: board.messages.filter((m) => m.to !== m.by).length,
  };
}

function singleAgentBaseline(issue: string, rng: PyRandom): { passed: boolean; total_tokens: number } {
  return {
    passed: rng.random() < 0.68,
    total_tokens: 18_000 + rng.randint(0, 6_000),
  };
}

function pyRound0(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

function commas(n: number): string {
  const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return n < 0 ? "-" + s : s;
}

const pyBool = (b: boolean): string => (b ? "True" : "False");

function main(): void {
  const rng = new PyRandom(11);
  console.log("=== multi-agent team run ===");
  const result = runTeam("fix widget parser race", 4, rng);
  console.log(`approved     : ${pyBool(result.approved)}  (${result.review_comment})`);
  console.log(`tested passed: ${pyBool(result.tested_passed)}  (${result.test_msg})`);
  console.log(`handoffs     : ${result.handoffs}`);
  console.log(`total tokens : ${commas(result.total_tokens)}`);
  console.log("tokens by role:");
  for (const [role, n] of [...result.tokens_by_role.entries()].sort((x, y) => y[1] - x[1])) {
    console.log(`  ${role.padEnd(14)} ${commas(n).padStart(6)}`);
  }

  console.log("\n=== 10 matched trials vs single-agent baseline ===");
  let teamPass = 0;
  let baselinePass = 0;
  let teamTokSum = 0;
  let baseTokSum = 0;
  const rng2 = new PyRandom(17);
  for (let i = 0; i < 10; i++) {
    const rTeam = runTeam(`issue-${i}`, 4, rng2);
    const rBase = singleAgentBaseline(`issue-${i}`, rng2);
    if (rTeam.tested_passed) teamPass += 1;
    if (rBase.passed) baselinePass += 1;
    teamTokSum += rTeam.total_tokens;
    baseTokSum += rBase.total_tokens;
  }

  console.log(`team pass    : ${teamPass}/10   tokens/run: ${commas(pyRound0(teamTokSum / 10))}`);
  console.log(`baseline pass: ${baselinePass}/10   tokens/run: ${commas(pyRound0(baseTokSum / 10))}`);
  console.log(`token amplification: ${(teamTokSum / Math.max(1, baseTokSum)).toFixed(2)}x`);
}

main();
