// Lesson: Scalable Oversight and Weak-to-Strong Generalization (phase 18 / lesson 11)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/11-scalable-oversight-weak-to-strong/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/11-scalable-oversight-weak-to-strong/code/main.ts

class Random {
  private state: number;
  private spare: number | null = null;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  random(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  gauss(mu: number, sigma: number): number {
    if (this.spare !== null) {
      const z = this.spare;
      this.spare = null;
      return mu + sigma * z;
    }
    const u1 = 1 - this.random();
    const u2 = this.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    this.spare = r * Math.sin(2 * Math.PI * u2);
    return mu + sigma * r * Math.cos(2 * Math.PI * u2);
  }

  shuffle<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }
}

const rng = new Random(3);

type Sample = [number[], number];

function gen(n: number): Sample[] {
  const data: Sample[] = [];
  for (let k = 0; k < n; k++) {
    const x = [rng.gauss(0.0, 1.0), rng.gauss(0.0, 1.0), rng.gauss(0.0, 1.0)];
    const y = x[0] + x[1] - 0.5 * x[2] > 0 ? 1 : 0;
    data.push([x, y]);
  }
  return data;
}

function weakLabel(x: number[], accuracy: number = 0.70): number {
  const base = x[0] > 0 ? 1 : 0;
  if (rng.random() < accuracy) {
    return base;
  }
  return 1 - base;
}

function linear(w: number[], b: number, x: number[]): number {
  let z = b;
  for (let i = 0; i < 3; i++) {
    z += w[i] * x[i];
  }
  return z;
}

function trainStrong(data: Sample[], steps: number = 200, lr: number = 0.05): number[] {
  const w = [0.0, 0.0, 0.0];
  let b = 0.0;
  for (let s = 0; s < steps; s++) {
    rng.shuffle(data);
    for (const [x, y] of data) {
      const z = linear(w, b, x);
      const p = 1.0 / (1.0 + Math.pow(2.71828, -z));
      const err = p - y;
      for (let i = 0; i < 3; i++) {
        w[i] -= lr * err * x[i];
      }
      b -= lr * err;
    }
  }
  return [...w, b];
}

function accuracy(model: number[], data: Sample[]): number {
  const w = model.slice(0, 3);
  const b = model[3];
  let correct = 0;
  for (const [x, y] of data) {
    const pred = linear(w, b, x) > 0 ? 1 : 0;
    if (pred === y) {
      correct += 1;
    }
  }
  return correct / data.length;
}

function pyFloat(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function run(label: string, weakAcc: number): void {
  const evalData = gen(1000);
  const trainData = gen(1000);
  const weakCorrect = evalData.filter(([x, y]) => weakLabel(x, weakAcc) === y).length;
  const weakAlone = weakCorrect / evalData.length;

  const strongGold = trainStrong(trainData);
  const ceiling = accuracy(strongGold, evalData);

  const weakLabeled: Sample[] = trainData.map(([x]) => [x, weakLabel(x, weakAcc)]);
  const strongW2s = trainStrong(weakLabeled);
  const w2sAcc = accuracy(strongW2s, evalData);

  const pgr = (w2sAcc - weakAlone) / (ceiling - weakAlone + 1e-12);
  console.log(`\n${label}  (weak_accuracy=${pyFloat(weakAcc)})`);
  console.log(`  weak alone         : ${weakAlone.toFixed(3)}`);
  console.log(`  strong on gold     : ${ceiling.toFixed(3)}`);
  console.log(`  strong on weak     : ${w2sAcc.toFixed(3)}`);
  console.log(`  performance gap recovered (PGR): ${pgr.toFixed(3)}`);
}

function main(): void {
  console.log("=".repeat(70));
  console.log("WEAK-TO-STRONG GENERALIZATION (Phase 18, Lesson 11)");
  console.log("=".repeat(70));

  for (const acc of [0.60, 0.70, 0.80, 0.90]) {
    run(`weak-to-strong @ weak_accuracy=${pyFloat(acc)}`, acc);
  }

  console.log("\n" + "=".repeat(70));
  console.log("TAKEAWAY: PGR > 0 across weak labelers means the strong model");
  console.log("generalizes beyond its weak supervisor's mistakes, using its own");
  console.log("pre-trained priors. this is the empirical proxy Burns et al. 2023");
  console.log("propose for the superalignment question: can weak human oversight");
  console.log("produce a stronger, aligned model? not a solution -- a measurable.");
  console.log("=".repeat(70));
}

main();
