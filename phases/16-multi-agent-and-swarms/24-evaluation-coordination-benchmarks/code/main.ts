// Lesson: Evaluation and Coordination Benchmarks (phase 16 / lesson 24)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/24-evaluation-coordination-benchmarks/code/main.ts

type Random = () => number;

function mulberry32(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uniform(rng: Random, a: number, b: number): number {
  return a + (b - a) * rng();
}

interface SystemSim {
  name: string;
  baseAccuracy: number;
  costPerTask: number;
  milestoneCompletionRate: number;
  trainingContamination: number;
  variance: number;
}

interface TaskResult {
  taskId: string;
  seenInTraining: boolean;
  accuracy: number;
  milestones: number;
  cost: number;
}

function systemSim(
  name: string,
  baseAccuracy: number,
  costPerTask: number,
  milestoneCompletionRate: number,
  trainingContamination = 0.0,
  variance = 0.1,
): SystemSim {
  return { name, baseAccuracy, costPerTask, milestoneCompletionRate, trainingContamination, variance };
}

const SYSTEMS: SystemSim[] = [
  systemSim("system-A", 0.7, 0.3, 0.8, 0.2),
  systemSim("system-B", 0.64, 0.12, 0.55, 0.0),
  systemSim("system-C", 0.55, 0.25, 0.7, 0.0),
];

function runTask(system: SystemSim, taskId: string, seen: boolean, rng: Random): TaskResult {
  let base = system.baseAccuracy;
  if (seen) {
    base += system.trainingContamination;
  }
  base = Math.max(0.0, Math.min(1.0, base + uniform(rng, -system.variance, system.variance)));
  const success = rng() < base;
  const milestones = success ? 4 : Math.trunc(4 * system.milestoneCompletionRate * rng());
  return {
    taskId,
    seenInTraining: seen,
    accuracy: success ? 1.0 : 0.0,
    milestones,
    cost: system.costPerTask,
  };
}

function randomBaseline(_rng: Random): number {
  return 0.15;
}

interface BenchRow {
  name: string;
  accuracy_seen: number;
  accuracy_held: number;
  milestone_rate_seen: number;
  milestone_rate_held: number;
  cost_per_task: number;
  cost_per_milestone_held: number;
}

function sum(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0);
}

function runBench(system: SystemSim, nSeen: number, nHeld: number, seed = 0): BenchRow {
  const rng = mulberry32(seed);
  const resultsSeen: TaskResult[] = [];
  const resultsHeld: TaskResult[] = [];
  for (let i = 0; i < nSeen; i++) {
    resultsSeen.push(runTask(system, `seen-${i}`, true, rng));
  }
  for (let i = 0; i < nHeld; i++) {
    resultsHeld.push(runTask(system, `held-${i}`, false, rng));
  }
  return {
    name: system.name,
    accuracy_seen: sum(resultsSeen.map((r) => r.accuracy)) / resultsSeen.length,
    accuracy_held: sum(resultsHeld.map((r) => r.accuracy)) / resultsHeld.length,
    milestone_rate_seen: sum(resultsSeen.map((r) => r.milestones)) / (resultsSeen.length * 4),
    milestone_rate_held: sum(resultsHeld.map((r) => r.milestones)) / (resultsHeld.length * 4),
    cost_per_task: system.costPerTask,
    cost_per_milestone_held:
      system.costPerTask /
      Math.max(0.01, sum(resultsHeld.map((r) => r.milestones)) / resultsHeld.length / 4),
  };
}

function rf(x: number, width: number, digits: number): string {
  return x.toFixed(digits).padStart(width);
}

function formatScorecard(): void {
  console.log("=".repeat(78));
  console.log("BENCHMARK SCORECARD: MARBLE-style milestone + contamination check");
  console.log("  contamination check: accuracy_seen - accuracy_held (delta > 0.1 = suspect)");
  console.log("=".repeat(78));
  console.log(
    `${"system".padEnd(10)} ${"acc(seen)".padStart(10)} ${"acc(held)".padStart(10)} ${"Δ".padStart(6)} ` +
      `${"mile(held)".padStart(12)} ${"cost/t".padStart(8)} ${"cost/mil".padStart(10)} ${"vs random".padStart(12)}`,
  );

  const rng = mulberry32(0);
  const randBaseline = randomBaseline(rng);
  for (const sys of SYSTEMS) {
    const r = runBench(sys, 40, 160, 17);
    const delta = r.accuracy_seen - r.accuracy_held;
    const contamFlag = delta > 0.1 ? "*" : " ";
    const vsRandom = r.accuracy_held - randBaseline;
    console.log(
      `${r.name.padEnd(10)} ${rf(r.accuracy_seen, 10, 3)} ${rf(r.accuracy_held, 10, 3)} ` +
        `${rf(delta, 5, 2)}${contamFlag} ${rf(r.milestone_rate_held, 12, 3)} ` +
        `$${rf(r.cost_per_task, 7, 2)} $${rf(r.cost_per_milestone_held, 9, 3)} ` +
        `+${rf(vsRandom, 10, 3)}`,
    );
  }

  console.log("\n  * = contamination flag; held-set accuracy is the canonical number");
  console.log(`  random baseline accuracy: ${randBaseline.toFixed(3)}`);
}

function printClaimScorecard(): void {
  console.log("\n" + "=".repeat(78));
  console.log("CLAIM CHECKLIST: read this before accepting any multi-agent result");
  console.log("=".repeat(78));
  const checklist = [
    "Which benchmark + split? Pro vs Verified is a 40-point gap for frontier models.",
    "Contamination check: is the benchmark post-training-cutoff?",
    "Baseline comparison: vs single-LLM, vs random, vs prior multi-agent?",
    "Statistical significance: N trials, p-value, confidence interval?",
    "Task diversity: single task or many? Generalization beyond one domain?",
    "Cost disclosure: tokens per task, wall-clock per task?",
  ];
  checklist.forEach((item, i) => {
    console.log(`  [${i + 1}] ${item}`);
  });
}

function main(): void {
  formatScorecard();
  printClaimScorecard();
  console.log("\nTakeaways:");
  console.log("  system-A scores highest on seen tasks but has contamination signal (large delta).");
  console.log("  system-B is cheapest per milestone; lowest raw accuracy but transparent.");
  console.log("  system-C sits in the middle but without contamination flag, trustworthy.");
  console.log("  the ranking by 'raw accuracy' vs 'cost per milestone (held)' can differ sharply.");
}

main();

export {};
