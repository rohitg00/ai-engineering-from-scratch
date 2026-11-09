// Lesson: AlphaEvolve: Evolutionary Coding Agents (phase 15 / lesson 03)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/03-alphaevolve-evolutionary-coding/code/main.ts

let rngState = 0;

function seedRandom(value: number): void {
  rngState = value >>> 0;
}

function random(): number {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function choice<T>(items: T[]): T {
  return items[Math.floor(random() * items.length)];
}

function pyFixed(value: number, digits: number): string {
  if (!Number.isFinite(value)) return Number.isNaN(value) ? "nan" : value > 0 ? "inf" : "-inf";
  const rounded = value.toFixed(digits);
  const exact = Math.abs(value).toFixed(Math.min(100, digits + 60));
  const tail = exact.slice(exact.indexOf(".") + 1 + digits);
  const tie = /^50*$/.test(tail);
  if (!tie) return rounded;
  const down = (Math.trunc(Math.abs(value) * 10 ** digits) / 10 ** digits).toFixed(digits);
  const lastDigit = Number(down.replace(".", "").slice(-1));
  const magnitude = lastDigit % 2 === 0 ? down : (Number(down) + 10 ** -digits).toFixed(digits);
  return value < 0 ? `-${magnitude}` : magnitude;
}


const DEFAULT_SEED = 12;

function target(x: number): number {
  return 2.0 * x * x + 3.0 * x - 1.0;
}

type Expr = ["num", number] | ["x"] | ["add", Expr, Expr] | ["mul", Expr, Expr];

function evaluateExpr(e: Expr, x: number): number {
  switch (e[0]) {
    case "num":
      return e[1];
    case "x":
      return x;
    case "add":
      return evaluateExpr(e[1], x) + evaluateExpr(e[2], x);
    case "mul":
      return evaluateExpr(e[1], x) * evaluateExpr(e[2], x);
  }
}

function depth(e: Expr): number {
  if (e[0] === "num" || e[0] === "x") return 1;
  return 1 + Math.max(depth(e[1]), depth(e[2]));
}

function maxConst(e: Expr): number {
  if (e[0] === "num") return Math.abs(e[1]);
  if (e[0] === "x") return 0.0;
  return Math.max(maxConst(e[1]), maxConst(e[2]));
}

function mutate(e: Expr): Expr {
  const pick = random();
  if (pick < 0.25) return randomLeaf();
  if (pick < 0.5) return ["add", e, randomLeaf()];
  if (pick < 0.75) return ["mul", e, randomLeaf()];
  return perturb(e);
}

function perturb(e: Expr): Expr {
  if (e[0] === "num") return ["num", e[1] + choice([-1.0, -0.5, 0.5, 1.0])];
  if (e[0] === "x") return e;
  return random() < 0.5 ? [e[0], perturb(e[1]), e[2]] : [e[0], e[1], perturb(e[2])];
}

function randomLeaf(): Expr {
  if (random() < 0.5) return ["x"];
  return ["num", choice([-2, -1, 0, 1, 2, 3])];
}

function render(e: Expr): string {
  if (e[0] === "num") return String(e[1]);
  if (e[0] === "x") return "x";
  const op = e[0] === "add" ? "+" : "*";
  return `(${render(e[1])} ${op} ${render(e[2])})`;
}

function mse(e: Expr, xs: number[]): number {
  let total = 0.0;
  for (const x of xs) {
    const y = evaluateExpr(e, x);
    total += (y - target(x)) ** 2;
  }
  return total / Math.max(1, xs.length);
}

interface Candidate {
  expr: Expr;
  train_score: number;
  test_score: number;
  generation: number;
}

function cellKey(e: Expr): string {
  const d = Math.min(depth(e), 6);
  const c = Math.min(Math.trunc(maxConst(e) / 2), 4);
  return `${d},${c}`;
}

function seedCandidate(testXs: number[], trainXs: number[], gen: number): Candidate {
  const e = randomLeaf();
  return { expr: e, train_score: mse(e, trainXs), test_score: mse(e, testXs), generation: gen };
}

function minBy<T>(items: T[], key: (item: T) => number): T {
  let best = items[0];
  for (const item of items.slice(1)) {
    if (key(item) < key(best)) best = item;
  }
  return best;
}

function runLoop(generations: number, pop: number, useHoldout: boolean, seed: number | null = null): [Candidate, number[], number[]] {
  if (seed !== null) seedRandom(seed);
  const trainXs = [-2.0, -1.0, 0.0, 1.0, 2.0, 3.0];
  const testXs = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5];

  const signalOf = (c: Candidate): number => (useHoldout ? 0.5 * (c.train_score + c.test_score) : c.train_score);

  const archive = new Map<string, Candidate>();
  for (let i = 0; i < pop; i++) {
    const c = seedCandidate(testXs, trainXs, 0);
    const key = cellKey(c.expr);
    const incumbent = archive.get(key);
    if (incumbent === undefined || signalOf(c) < signalOf(incumbent)) archive.set(key, c);
  }

  const bestTrace: number[] = [];
  const testTrace: number[] = [];
  for (let g = 1; g <= generations; g++) {
    const parent = choice([...archive.values()]);
    const childExpr = mutate(parent.expr);
    const tr = mse(childExpr, trainXs);
    const te = mse(childExpr, testXs);
    const child: Candidate = { expr: childExpr, train_score: tr, test_score: te, generation: g };
    const key = cellKey(childExpr);
    const incumbent = archive.get(key);
    if (incumbent === undefined || signalOf(child) < signalOf(incumbent)) archive.set(key, child);

    const best = minBy([...archive.values()], (c) => c.train_score);
    bestTrace.push(best.train_score);
    testTrace.push(best.test_score);
  }

  const best = minBy([...archive.values()], signalOf);
  return [best, bestTrace, testTrace];
}

function main(): void {
  const noHoldout = process.argv.slice(2).includes("--no-holdout");

  console.log("=".repeat(70));
  console.log("ALPHAEVOLVE-STYLE LOOP (Phase 15, Lesson 3)");
  console.log("=".repeat(70));
  console.log("target: 2x^2 + 3x - 1");

  if (!noHoldout) {
    console.log("\nRun A: held-out test included in evaluator signal");
    const [best, trainTrace] = runLoop(1500, 20, true, DEFAULT_SEED);
    console.log(`  best expr : ${render(best.expr)}`);
    console.log(`  train MSE : ${pyFixed(best.train_score, 4)}`);
    console.log(`  test  MSE : ${pyFixed(best.test_score, 4)}`);
    console.log(`  generation: ${best.generation}`);
    console.log(
      `  progress  : gen 100 train=${pyFixed(trainTrace[99], 3)} gen 500 train=${pyFixed(trainTrace[499], 3)} gen 1500 train=${pyFixed(trainTrace[trainTrace.length - 1], 3)}`,
    );
  }

  console.log("\nRun B: no held-out test (train-only evaluator -> reward hacking risk)");
  const [best] = runLoop(1500, 20, false, DEFAULT_SEED);
  console.log(`  best expr : ${render(best.expr)}`);
  console.log(`  train MSE : ${pyFixed(best.train_score, 4)}`);
  console.log(`  test  MSE : ${pyFixed(best.test_score, 4)}`);
  console.log(`  generation: ${best.generation}`);
  const gap = best.test_score - best.train_score;
  console.log(`  train-to-test gap: ${gap >= 0 ? "+" : ""}${pyFixed(gap, 4)}  (large gap = overfit/reward hacking proxy)`);

  console.log();
  console.log("=".repeat(70));
  console.log("HEADLINE: the evaluator is the architecture");
  console.log("-".repeat(70));
  console.log("  Run A converges to low train AND low test MSE.");
  console.log("  Run B converges to low train MSE; test MSE stays loose or worse.");
  console.log("  A held-out evaluator is the difference between discovery and");
  console.log("  reward hacking. AlphaEvolve's wins are in domains where such an");
  console.log("  evaluator exists. Picking those domains is the hard part.");
}

main();

export {};
