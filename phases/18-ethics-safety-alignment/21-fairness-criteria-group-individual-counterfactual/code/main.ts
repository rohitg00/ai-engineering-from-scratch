// Lesson: Fairness Criteria: Group, Individual, Counterfactual (phase 18 / lesson 21)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/21-fairness-criteria-group-individual-counterfactual/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/21-fairness-criteria-group-individual-counterfactual/code/main.ts

export {};

type Example = [number[], number, number];
type Pred = [number, number, number];

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

const random = mulberry32(6);

function gauss(mu: number, sigma: number): number {
  let u1 = random();
  while (u1 === 0) {
    u1 = random();
  }
  const u2 = random();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function choice<T>(xs: T[]): T {
  return xs[Math.floor(random() * xs.length)];
}

function shuffle<T>(xs: T[]): void {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
}

function fmt(x: number, d: number): string {
  const full = Math.abs(x).toFixed(Math.min(100, d + 30));
  const cut = full.indexOf(".") + 1 + d;
  const tail = full.slice(cut);
  let body: string;
  if (/^50*$/.test(tail)) {
    const lo = Number(full.slice(0, cut));
    const last = Number(full[cut - 1]);
    body = (last % 2 === 0 ? lo : lo + Math.pow(10, -d)).toFixed(d);
  } else {
    body = Math.abs(x).toFixed(d);
  }
  return (x < 0 || Object.is(x, -0) ? "-" : "") + body;
}

function fmtSigned(x: number, d: number): string {
  const s = fmt(x, d);
  return s.startsWith("-") ? s : "+" + s;
}

function gen(n: number): Example[] {
  const data: Example[] = [];
  for (let i = 0; i < n; i++) {
    const a = choice([0, 1]);
    const base = a === 0 ? 0.3 : 0.6;
    const y = random() < base ? 1 : 0;
    const x0 = gauss(0.8 * y, 1.0);
    const x1 = gauss(-0.3 + a * 0.5, 1.0);
    data.push([[x0, x1, a], y, a]);
  }
  return data;
}

function dot(w: number[], x: number[]): number {
  let s = 0;
  for (let i = 0; i < Math.min(w.length, x.length); i++) {
    s += w[i] * x[i];
  }
  return s;
}

function train(data: Example[], steps = 200, lr = 0.1, sampleWeights: number[] | null = null): number[] {
  const w = [0.0, 0.0, 0.0];
  let b = 0.0;
  const paired: [Example, number][] = sampleWeights === null
    ? data.map((ex) => [ex, 1.0])
    : data.map((ex, i) => [ex, sampleWeights[i]]);
  for (let step = 0; step < steps; step++) {
    shuffle(paired);
    for (const [[x, y], wt] of paired) {
      const z = b + dot(w, x);
      const p = 1.0 / (1.0 + Math.exp(-z));
      const err = p - y;
      for (let i = 0; i < 3; i++) {
        w[i] -= lr * wt * err * x[i];
      }
      b -= lr * wt * err;
    }
  }
  return [...w, b];
}

function predict(model: number[], data: Example[]): Pred[] {
  const w = model.slice(0, 3);
  const b = model[3];
  const preds: Pred[] = [];
  for (const [x, y, a] of data) {
    const z = b + dot(w, x);
    preds.push([z > 0 ? 1 : 0, y, a]);
  }
  return preds;
}

function count<T>(xs: T[], f: (x: T) => boolean): number {
  return xs.filter(f).length;
}

function demographicParity(preds: Pred[]): [number, number] {
  const rate0 = count(preds, ([p, , a]) => a === 0 && p === 1) / Math.max(1, count(preds, ([, , a]) => a === 0));
  const rate1 = count(preds, ([p, , a]) => a === 1 && p === 1) / Math.max(1, count(preds, ([, , a]) => a === 1));
  return [rate0, rate1];
}

function equalizedOdds(preds: Pred[]): [[number, number], [number, number]] {
  const group = (a: number): [number, number] => {
    const sub = preds.filter(([, , aa]) => aa === a).map(([p, y]) => [p, y] as [number, number]);
    const tpr = count(sub, ([p, y]) => y === 1 && p === 1) / Math.max(1, count(sub, ([, y]) => y === 1));
    const fpr = count(sub, ([p, y]) => y === 0 && p === 1) / Math.max(1, count(sub, ([, y]) => y === 0));
    return [tpr, fpr];
  };
  return [group(0), group(1)];
}

function conditionalUse(preds: Pred[]): [[number, number], [number, number]] {
  const group = (a: number): [number, number] => {
    const sub = preds.filter(([, , aa]) => aa === a).map(([p, y]) => [p, y] as [number, number]);
    const ppv = count(sub, ([p, y]) => p === 1 && y === 1) / Math.max(1, count(sub, ([p]) => p === 1));
    const npv = count(sub, ([p, y]) => p === 0 && y === 0) / Math.max(1, count(sub, ([p]) => p === 0));
    return [ppv, npv];
  };
  return [group(0), group(1)];
}

function report(name: string, preds: Pred[]): void {
  const dp = demographicParity(preds);
  const eo = equalizedOdds(preds);
  const cu = conditionalUse(preds);
  console.log(`\n${name}`);
  console.log(`  demographic parity    : group0=${fmt(dp[0], 3)}  group1=${fmt(dp[1], 3)}  gap=${fmtSigned(dp[1] - dp[0], 3)}`);
  console.log(`  equalized odds (TPR)  : group0=${fmt(eo[0][0], 3)}  group1=${fmt(eo[1][0], 3)}`);
  console.log(`  equalized odds (FPR)  : group0=${fmt(eo[0][1], 3)}  group1=${fmt(eo[1][1], 3)}`);
  console.log(`  conditional use (PPV) : group0=${fmt(cu[0][0], 3)}  group1=${fmt(cu[1][0], 3)}`);
  console.log(`  conditional use (NPV) : group0=${fmt(cu[0][1], 3)}  group1=${fmt(cu[1][1], 3)}`);
}

function main(): void {
  console.log("=".repeat(70));
  console.log("THREE GROUP-FAIRNESS CRITERIA (Phase 18, Lesson 21)");
  console.log("=".repeat(70));

  const trainData = gen(1000);
  const testData = gen(500);

  const baseline = train(trainData);
  const preds = predict(baseline, testData);
  report("baseline classifier", preds);

  const weights: number[] = [];
  for (const [, y, a] of trainData) {
    if (a === 0 && y === 1) {
      weights.push(2.0);
    } else if (a === 1 && y === 1) {
      weights.push(0.5);
    } else {
      weights.push(1.0);
    }
  }
  const dpReweighted = train(trainData, 200, 0.1, weights);
  const preds2 = predict(dpReweighted, testData);
  report("DP-reweighted classifier", preds2);

  console.log("\n" + "=".repeat(70));
  console.log("TAKEAWAY: equal base rates are the condition for the three criteria");
  console.log("to coincide. with unequal base rates, DP-targeted reweighting");
  console.log("reduces the DP gap at the cost of equalized odds and conditional");
  console.log("use accuracy. this is Chouldechova / KMR 2017 in miniature. the");
  console.log("choice of criterion is a policy decision; no statistical method");
  console.log("can satisfy all three under unequal base rates.");
  console.log("=".repeat(70));
}

main();
