// Lesson: Capstone 09: Code Migration Agent (Repo-Level Language / Runtime Upgrade) (phase 19 / lesson 09)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/09-code-migration-agent/docs/en.md
// Run: npx tsx phases/19-capstone-projects/09-code-migration-agent/code/main.ts

export {};

class PyRandom {
  private mt = new Uint32Array(624);
  private mti = 625;
  private gaussNext: number | null = null;

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

  getrandbits(k: number): number {
    return this.genrand() >>> (32 - k);
  }

  randint(a: number, b: number): number {
    const n = b - a + 1;
    const k = n.toString(2).length;
    let r = this.getrandbits(k);
    while (r >= n) r = this.getrandbits(k);
    return a + r;
  }

  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
  }

  gauss(mu: number, sigma: number): number {
    let z = this.gaussNext;
    this.gaussNext = null;
    if (z === null) {
      const x2pi = this.random() * 2 * Math.PI;
      const g2rad = Math.sqrt(-2.0 * Math.log(1.0 - this.random()));
      z = Math.cos(x2pi) * g2rad;
      this.gaussNext = Math.sin(x2pi) * g2rad;
    }
    return mu + z * sigma;
  }
}

const FAILURE_CLASSES = [
  "dep_upgrade_required",
  "build_tool_drift",
  "custom_annotation",
  "test_flake",
  "syntax_edge_case",
  "budget_exhausted",
  "coverage_regression",
];

interface Repo {
  name: string;
  loc: number;
  lang: string;
  hardness: number;
}

class Attempt {
  recipe_applied = 0;
  agent_turns = 0;
  cost_usd = 0.0;
  wall_min = 0.0;
  status = "pending";
  failure_class: string | null = null;
  coverage_base = 80.0;
  coverage_final = 80.0;

  constructor(public repo: Repo) {}
}

function runRecipes(repo: Repo): number {
  const base = 20 + Math.trunc(repo.loc / 500);
  return Math.trunc(base * (1 - 0.2 * repo.hardness));
}

const BUDGET_MIN = 30.0;
const BUDGET_USD = 8.0;
const BUDGET_TURNS = 20;

function agentLoop(attempt: Attempt, rng: PyRandom): void {
  const perTurnMin = 2.8 + attempt.repo.hardness * 2.0;
  const perTurnUsd = 0.45 + attempt.repo.hardness * 0.65;
  const turnPassP = Math.max(0.02, 0.22 * (1 - attempt.repo.hardness * 0.95));

  while (true) {
    if (attempt.agent_turns >= BUDGET_TURNS) {
      attempt.status = "fail";
      attempt.failure_class = "budget_exhausted";
      return;
    }
    if (attempt.wall_min >= BUDGET_MIN || attempt.cost_usd >= BUDGET_USD) {
      attempt.status = "fail";
      attempt.failure_class = "budget_exhausted";
      return;
    }

    attempt.agent_turns += 1;
    attempt.wall_min += perTurnMin;
    attempt.cost_usd += perTurnUsd;

    if (rng.random() < turnPassP) {
      const delta = rng.gauss(0.0, 0.6);
      attempt.coverage_final = attempt.coverage_base + delta;
      if (attempt.coverage_final < attempt.coverage_base - 2.0) {
        attempt.status = "fail";
        attempt.failure_class = "coverage_regression";
        return;
      }
      attempt.status = "pass";
      return;
    }
  }
}

function classifyFailure(rng: PyRandom): string {
  const weights: [string, number][] = [
    ["dep_upgrade_required", 0.3],
    ["build_tool_drift", 0.2],
    ["custom_annotation", 0.18],
    ["test_flake", 0.15],
    ["syntax_edge_case", 0.17],
  ];
  const r = rng.random();
  let acc = 0.0;
  for (const [cls, w] of weights) {
    acc += w;
    if (r <= acc) return cls;
  }
  return "syntax_edge_case";
}

function migrate(repo: Repo, rng: PyRandom): Attempt {
  const attempt = new Attempt(repo);
  attempt.recipe_applied = runRecipes(repo);

  const straightThroughP = 0.55 * (1 - repo.hardness);
  if (rng.random() < straightThroughP) {
    const delta = rng.gauss(0.0, 0.4);
    attempt.coverage_final = attempt.coverage_base + delta;
    attempt.status = "pass";
    attempt.wall_min = 3.0 + rng.random() * 4;
    attempt.cost_usd = 0.3;
    return attempt;
  }

  agentLoop(attempt, rng);

  if (attempt.status === "fail" && attempt.failure_class === "budget_exhausted") {
    if (rng.random() < 0.75) attempt.failure_class = classifyFailure(rng);
  }
  return attempt;
}

function synthBench(rng: PyRandom): Repo[] {
  const bench: Repo[] = [];
  for (let i = 0; i < 50; i++) {
    const lang = rng.random() < 0.6 ? "java" : "python";
    const hardness = Math.min(0.95, Math.max(0.05, rng.gauss(0.65, 0.18)));
    bench.push({ name: `repo-${String(i).padStart(2, "0")}-${lang}`, loc: rng.randint(800, 40_000), lang, hardness });
  }
  return bench;
}

function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function main(): void {
  const rng = new PyRandom(19);
  const bench = synthBench(rng);

  const results: Attempt[] = [];
  for (const repo of bench) results.push(migrate(repo, rng));

  const passed = results.filter((a) => a.status === "pass");
  const failed = results.filter((a) => a.status === "fail");

  console.log("=== migration-bench run (50 repos) ===");
  console.log(`passed : ${String(passed.length).padStart(2)}  (${((passed.length / 50) * 100).toFixed(1)}%)`);
  console.log(`failed : ${String(failed.length).padStart(2)}`);

  console.log("\nfailure taxonomy:");
  const taxonomy = new Map<string, number>();
  for (const a of failed) {
    const key = a.failure_class || "unknown";
    taxonomy.set(key, (taxonomy.get(key) ?? 0) + 1);
  }
  for (const [cls, n] of [...taxonomy.entries()].sort((x, y) => y[1] - x[1])) console.log(`  ${cls.padEnd(24)} ${n}`);

  if (passed.length > 0) {
    const meanCost = mean(passed.map((a) => a.cost_usd));
    const meanMin = mean(passed.map((a) => a.wall_min));
    const meanTurns = mean(passed.map((a) => a.agent_turns));
    const meanCovDelta = mean(passed.map((a) => a.coverage_final - a.coverage_base));
    console.log("\npass-set metrics:");
    console.log(`  mean $/repo     : $${meanCost.toFixed(2)}`);
    console.log(`  mean wall min   : ${meanMin.toFixed(1)}`);
    console.log(`  mean agent turns: ${meanTurns.toFixed(1)}`);
    console.log(`  mean cov delta  : ${(meanCovDelta >= 0 ? "+" : "") + meanCovDelta.toFixed(2)} points`);
  }
}

main();
