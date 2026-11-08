// Lesson: Learning Rate Schedules and Warmup (phase 03 / lesson 09)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/03-deep-learning-core/09-learning-rate-schedules/docs/en.md
// Run: npx tsx phases/03-deep-learning-core/09-learning-rate-schedules/code/main.ts

type Random = () => number;

interface ScheduleOptions {
  lr?: number;
  totalSteps?: number;
  stepSize?: number;
  gamma?: number;
  lrMin?: number;
  warmupSteps?: number;
}

type Schedule = (step: number, options?: ScheduleOptions) => number;

type Sample = [number[], number];

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

function gauss(rng: Random, mean: number, std: number): number {
  let u1 = rng();
  while (u1 <= Number.EPSILON) u1 = rng();
  const u2 = rng();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function uniform(rng: Random, low: number, high: number): number {
  return low + (high - low) * rng();
}

function fmt(x: number, digits: number): string {
  if (Number.isNaN(x)) return "nan";
  if (x === Infinity) return "inf";
  if (x === -Infinity) return "-inf";
  return x.toFixed(digits);
}

function right(text: string, width: number): string {
  return text.padStart(width);
}

function left(text: string, width: number): string {
  return text.padEnd(width);
}

const constantSchedule: Schedule = (_step, options = {}) => options.lr ?? 0.01;

const stepDecaySchedule: Schedule = (step, options = {}) => {
  const lr = options.lr ?? 0.1;
  const stepSize = options.stepSize ?? 100;
  const gamma = options.gamma ?? 0.1;
  if (stepSize <= 0) throw new Error("stepSize must be positive");
  return lr * gamma ** Math.floor(step / stepSize);
};

const cosineSchedule: Schedule = (step, options = {}) => {
  const lr = options.lr ?? 0.01;
  const totalSteps = options.totalSteps ?? 1000;
  const lrMin = options.lrMin ?? 1e-5;
  if (step >= totalSteps) return lrMin;
  return lrMin + 0.5 * (lr - lrMin) * (1 + Math.cos((Math.PI * step) / totalSteps));
};

const warmupCosineSchedule: Schedule = (step, options = {}) => {
  const lr = options.lr ?? 0.01;
  const totalSteps = options.totalSteps ?? 1000;
  const warmupSteps = options.warmupSteps ?? 100;
  const lrMin = options.lrMin ?? 1e-5;
  if (totalSteps <= warmupSteps) return lr * (step / Math.max(warmupSteps, 1));
  if (step < warmupSteps) return (lr * step) / warmupSteps;
  const progress = (step - warmupSteps) / (totalSteps - warmupSteps);
  return lrMin + 0.5 * (lr - lrMin) * (1 + Math.cos(Math.PI * progress));
};

const oneCycleSchedule: Schedule = (step, options = {}) => {
  const lr = options.lr ?? 0.01;
  const totalSteps = options.totalSteps ?? 1000;
  const mid = Math.max(Math.floor(totalSteps / 2), 1);
  if (step < mid) return lr / 25 + ((lr - lr / 25) * step) / mid;
  const progress = (step - mid) / Math.max(totalSteps - mid, 1);
  return lr * (1 - progress) + (lr / 10000) * progress;
};

function visualizeSchedule(name: string, scheduleFn: Schedule, totalSteps = 500, options: ScheduleOptions = {}): void {
  const stride = Math.floor(totalSteps / 20);
  if (stride <= 0) throw new Error("totalSteps must be at least 20");
  const steps: number[] = [];
  for (let s = 0; s < totalSteps; s += stride) steps.push(s);
  if (!steps.includes(totalSteps - 1)) steps.push(totalSteps - 1);

  const lrs = steps.map((s) => scheduleFn(s, { ...options, totalSteps }));
  const peak = Math.max(...lrs);
  const maxLr = peak > 0 ? peak : 1.0;

  console.log(`\n${name}:`);
  steps.forEach((s, i) => {
    const barLen = Math.trunc((lrs[i] / maxLr) * 40);
    console.log(`  Step ${right(String(s), 4)}: lr=${fmt(lrs[i], 6)} ${"#".repeat(Math.max(barLen, 0))}`);
  });
}

function sigmoid(x: number): number {
  const clipped = Math.max(-500, Math.min(500, x));
  return 1.0 / (1.0 + Math.exp(-clipped));
}

function relu(x: number): number {
  return Math.max(0.0, x);
}

function reluDeriv(x: number): number {
  return x > 0 ? 1.0 : 0.0;
}

function makeCircleData(n = 200, seed = 42): Sample[] {
  const rng = mulberry32(seed);
  const data: Sample[] = [];
  for (let k = 0; k < n; k++) {
    const x = uniform(rng, -2, 2);
    const y = uniform(rng, -2, 2);
    const label = x * x + y * y < 1.5 ? 1.0 : 0.0;
    data.push([[x, y], label]);
  }
  return data;
}

function trainWithSchedule(
  scheduleFn: Schedule,
  _scheduleName: string,
  data: Sample[],
  epochs = 300,
  baseLr = 0.05,
  options: ScheduleOptions = {},
): number[] {
  if (data.length === 0) throw new Error("data must not be empty");
  const rng = mulberry32(2);
  const hiddenSize = 8;
  const totalSteps = epochs * data.length;

  const std = Math.sqrt(2.0 / 2);
  const w1 = Array.from({ length: hiddenSize }, () => [gauss(rng, 0, std), gauss(rng, 0, std)]);
  const b1 = new Array<number>(hiddenSize).fill(0.0);
  const w2 = Array.from({ length: hiddenSize }, () => gauss(rng, 0, std));
  let b2 = 0.0;

  let step = 0;
  const epochLosses: number[] = [];

  for (let epoch = 0; epoch < epochs; epoch++) {
    let totalLoss = 0;

    for (const [x, target] of data) {
      const lr = scheduleFn(step, { ...options, lr: baseLr, totalSteps });

      const z1: number[] = [];
      const h: number[] = [];
      for (let i = 0; i < hiddenSize; i++) {
        const z = w1[i][0] * x[0] + w1[i][1] * x[1] + b1[i];
        z1.push(z);
        h.push(relu(z));
      }

      let z2 = b2;
      for (let i = 0; i < hiddenSize; i++) z2 += w2[i] * h[i];
      const out = sigmoid(z2);

      const error = out - target;
      const dOut = error * out * (1 - out);

      for (let i = 0; i < hiddenSize; i++) {
        const dH = dOut * w2[i] * reluDeriv(z1[i]);
        w2[i] -= lr * dOut * h[i];
        for (let j = 0; j < 2; j++) w1[i][j] -= lr * dH * x[j];
        b1[i] -= lr * dH;
      }
      b2 -= lr * dOut;

      totalLoss += (out - target) ** 2;
      step += 1;
    }

    epochLosses.push(totalLoss / data.length);
  }

  return epochLosses;
}

function compareSchedules(data: Sample[]): void {
  const configs: [string, Schedule, ScheduleOptions][] = [
    ["Constant", constantSchedule, {}],
    ["Step Decay", stepDecaySchedule, { stepSize: 15000, gamma: 0.1 }],
    ["Cosine", cosineSchedule, { lrMin: 1e-5 }],
    ["Warmup+Cosine", warmupCosineSchedule, { warmupSteps: 3000, lrMin: 1e-5 }],
    ["1cycle", oneCycleSchedule, {}],
  ];

  console.log(
    `\n${left("Schedule", 20)} ${right("Start Loss", 12)} ${right("Mid Loss", 12)} ${right("End Loss", 12)} ${right("Best Loss", 12)}`,
  );
  console.log("-".repeat(70));

  for (const [name, scheduleFn, extra] of configs) {
    const losses = trainWithSchedule(scheduleFn, name, data, 300, 0.05, extra);
    const midIdx = Math.floor(losses.length / 2);
    const best = Math.min(...losses);
    console.log(
      `${left(name, 20)} ${right(fmt(losses[0], 6), 12)} ${right(fmt(losses[midIdx], 6), 12)} ${right(fmt(losses[losses.length - 1], 6), 12)} ${right(fmt(best, 6), 12)}`,
    );
  }
}

function lrSensitivity(data: Sample[]): void {
  const learningRates = [1.0, 0.1, 0.05, 0.01, 0.001, 0.0001];

  console.log(`\n${right("LR", 10)} ${right("Start Loss", 12)} ${right("End Loss", 12)} ${right("Status", 15)}`);
  console.log("-".repeat(52));

  for (const lr of learningRates) {
    const losses = trainWithSchedule(constantSchedule, `lr=${lr}`, data, 100, lr);
    const start = losses[0];
    const end = losses[losses.length - 1];

    let status: string;
    if (Number.isNaN(end) || end > 1.0) status = "DIVERGED";
    else if (end > start * 0.9) status = "BARELY MOVED";
    else if (end < 0.15) status = "CONVERGED";
    else status = "LEARNING";

    const endStr = Number.isNaN(end) ? "NaN" : fmt(end, 6);
    console.log(`${right(fmt(lr, 4), 10)} ${right(fmt(start, 6), 12)} ${right(endStr, 12)} ${right(status, 15)}`);
  }
}

function warmupImpact(data: Sample[]): void {
  const warmupFractions = [0.0, 0.01, 0.05, 0.1, 0.2];
  const totalSteps = 300 * data.length;

  console.log(`\n${right("Warmup %", 10)} ${right("Warmup Steps", 14)} ${right("End Loss", 12)} ${right("Best Loss", 12)}`);
  console.log("-".repeat(52));

  for (const frac of warmupFractions) {
    const warmupSteps = Math.trunc(totalSteps * frac);
    const losses = trainWithSchedule(warmupCosineSchedule, `warmup=${frac}`, data, 300, 0.05, {
      warmupSteps,
      lrMin: 1e-5,
    });
    const best = Math.min(...losses);
    console.log(
      `${right(fmt(frac * 100, 0), 9)}% ${right(String(warmupSteps), 14)} ${right(fmt(losses[losses.length - 1], 6), 12)} ${right(fmt(best, 6), 12)}`,
    );
  }
}

function scheduleTrajectory(data: Sample[]): void {
  const totalSteps = 100 * data.length;
  const schedules: [string, Schedule, ScheduleOptions][] = [
    ["Constant", constantSchedule, { lr: 0.05 }],
    ["Cosine", cosineSchedule, { lr: 0.05, lrMin: 1e-5 }],
    ["Warmup+Cosine", warmupCosineSchedule, { lr: 0.05, warmupSteps: Math.trunc(totalSteps * 0.05), lrMin: 1e-5 }],
    ["1cycle", oneCycleSchedule, { lr: 0.05 }],
  ];

  console.log("\nLR at key training points:");
  console.log(
    `  ${left("Schedule", 20)} ${right("Step 0", 10)} ${right("Step T/4", 10)} ${right("Step T/2", 10)} ${right("Step 3T/4", 10)} ${right("Step T", 10)}`,
  );
  console.log("  " + "-".repeat(60));

  for (const [name, fn, options] of schedules) {
    const points = [
      0,
      Math.floor(totalSteps / 4),
      Math.floor(totalSteps / 2),
      Math.floor((3 * totalSteps) / 4),
      totalSteps - 1,
    ];
    const vals = points.map((s) => fn(s, { ...options, totalSteps }));
    console.log(`  ${left(name, 20)} ${vals.map((v) => right(fmt(v, 6), 10)).join(" ")}`);
  }
}

function banner(title: string): void {
  console.log("=".repeat(70));
  console.log(title);
  console.log("=".repeat(70));
}

function main(): void {
  banner("STEP 1: Schedule Shapes");
  visualizeSchedule("Constant", constantSchedule, 500, { lr: 0.05 });
  visualizeSchedule("Step Decay", stepDecaySchedule, 500, { lr: 0.05, stepSize: 125, gamma: 0.5 });
  visualizeSchedule("Cosine Annealing", cosineSchedule, 500, { lr: 0.05, lrMin: 1e-5 });
  visualizeSchedule("Warmup + Cosine", warmupCosineSchedule, 500, { lr: 0.05, warmupSteps: 50, lrMin: 1e-5 });
  visualizeSchedule("1cycle", oneCycleSchedule, 500, { lr: 0.05 });

  const data = makeCircleData();

  console.log("");
  banner("STEP 2: LR Sensitivity");
  lrSensitivity(data);

  console.log("");
  banner("STEP 3: Schedule Comparison");
  compareSchedules(data);

  console.log("");
  banner("STEP 4: Warmup Impact");
  warmupImpact(data);

  console.log("");
  banner("STEP 5: Schedule Trajectory");
  scheduleTrajectory(data);
}

main();
