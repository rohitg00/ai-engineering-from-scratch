// Lesson: METR Time Horizons and External Capability Evaluation (phase 15 / lesson 21)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/21-metr-external-evaluation/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/21-metr-external-evaluation/code/main.ts

const SEED = 8;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let random = mulberry32(SEED);

function uniform(a: number, b: number): number {
  return a + (b - a) * random();
}

type Task = [number, boolean];

function synthTasks(trueHorizonHours: number, slope: number = 1.2, n: number = 120): Task[] {
  const logH = Math.log(trueHorizonHours);
  const out: Task[] = [];
  for (let i = 0; i < n; i++) {
    const t = Math.exp(uniform(Math.log(0.05), Math.log(48)));
    const logit = slope * (logH - Math.log(t));
    const p = 1.0 / (1.0 + Math.exp(-logit));
    const success = random() < p;
    out.push([t, success]);
  }
  return out;
}

function sigmoid(x: number): number {
  if (x > 50) {
    return 1.0;
  }
  if (x < -50) {
    return 0.0;
  }
  return 1.0 / (1.0 + Math.exp(-x));
}

function fit(tasks: Task[], iters: number = 4000, lr: number = 0.05): [number, number] {
  let w = 0.0;
  let b = 0.0;
  for (let it = 0; it < iters; it++) {
    let dw = 0.0;
    let db = 0.0;
    const n = tasks.length;
    for (const [t, s] of tasks) {
      const y = s ? 1.0 : 0.0;
      const p = sigmoid(w * Math.log(t) + b);
      const err = p - y;
      dw += err * Math.log(t);
      db += err;
    }
    w -= (lr * dw) / n;
    b -= (lr * db) / n;
  }
  return [w, b];
}

function horizonAt(w: number, b: number, p: number): number {
  const logit = Math.log(p / (1 - p));
  const eps = 1e-12;
  if (Math.abs(w) < eps) {
    throw new Error(`horizon undefined: slope w=${w} is ~0 (b=${b}, p=${p}, logit=${logit})`);
  }
  return Math.exp((logit - b) / w);
}

function injectGaming(tasks: Task[], gamingRate: number): Task[] {
  const gamed: Task[] = [];
  for (const [t, s] of tasks) {
    if (!s && random() < gamingRate) {
      gamed.push([t, true]);
    } else {
      gamed.push([t, s]);
    }
  }
  return gamed;
}

function f2(x: number, width: number): string {
  return x.toFixed(2).padStart(width);
}

function pct0(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

function report(label: string, w: number, b: number): void {
  const h50 = horizonAt(w, b, 0.5);
  const h10 = horizonAt(w, b, 0.1);
  const h90 = horizonAt(w, b, 0.9);
  console.log(`  ${label.padEnd(40)}  50%=${f2(h50, 6)} hr  10%=${f2(h10, 6)} hr  90%=${f2(h90, 6)} hr`);
}

function main(): void {
  random = mulberry32(SEED);
  console.log("=".repeat(80));
  console.log("METR-STYLE HORIZON ESTIMATOR (Phase 15, Lesson 21)");
  console.log("=".repeat(80));

  const trueH = 14.0;
  console.log(`\nSynthetic ground truth: 50% horizon = ${trueH.toFixed(1)} hr`);
  console.log("-".repeat(80));

  const tasks = synthTasks(trueH, 1.2, 160);
  const [w, b] = fit(tasks);
  const cleanH50 = horizonAt(w, b, 0.5);
  report("clean evaluation (no gaming)", w, b);

  const gamedH50 = new Map<number, number>();
  for (const rate of [0.1, 0.2, 0.4]) {
    const gamed = injectGaming(tasks, rate);
    const [wG, bG] = fit(gamed);
    gamedH50.set(rate, horizonAt(wG, bG, 0.5));
    report(`with eval-context gaming rate ${pct0(rate)}`, wG, bG);
  }

  console.log();
  console.log("=".repeat(80));
  console.log("HEADLINE: horizons are fit to observed success; gaming shifts them");
  console.log("-".repeat(80));
  console.log(`  With seed=${SEED} / n=160 / iters=4000 / true_h=${trueH.toFixed(1)} hr:`);
  console.log(`    clean fit          50% horizon ≈ ${f2(cleanH50, 6)} hr (ground truth ${trueH.toFixed(1)})`);
  for (const [rate, h] of gamedH50) {
    const delta = h - trueH;
    const sign = delta >= 0 ? "+" : "-";
    console.log(
      `    gaming rate ${pct0(rate).padStart(4)}   50% horizon ≈ ${f2(h, 6)} hr ` +
        `(${sign}${Math.abs(delta).toFixed(2)} hr vs ground truth)`,
    );
  }
  console.log("  Trend: gaming pushes the observed 50% horizon further from the");
  console.log("  synthetic ground truth as the rate climbs. Exact deltas depend on");
  console.log("  seed, n, iters, and the chosen true_h. A horizon number without a");
  console.log("  gaming audit is a capability ceiling the deploy context may not reach.");
}

main();

export {};
