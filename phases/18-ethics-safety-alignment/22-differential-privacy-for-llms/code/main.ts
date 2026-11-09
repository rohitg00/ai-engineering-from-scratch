// Lesson: Differential Privacy for LLMs (phase 18 / lesson 22)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/22-differential-privacy-for-llms/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/22-differential-privacy-for-llms/code/main.ts

export {};

type Example = [number[], number];

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

const random = mulberry32(59);

function gauss(mu: number, sigma: number): number {
  let u1 = random();
  while (u1 === 0) {
    u1 = random();
  }
  const u2 = random();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
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

function sigmoid(z: number): number {
  return 1.0 / (1.0 + Math.exp(-z));
}

function gen(n: number): Example[] {
  const data: Example[] = [];
  for (let i = 0; i < n; i++) {
    const x = [gauss(0.0, 1.0), gauss(0.0, 1.0)];
    const y = 0.6 * x[0] - 0.4 * x[1] > 0 ? 1 : 0;
    data.push([x, y]);
  }
  return data;
}

function clip(g: number[], C: number): number[] {
  const n = Math.sqrt(g.reduce((s, x) => s + x * x, 0));
  if (n <= C) {
    return g;
  }
  return g.map((x) => x * C / n);
}

function dot(w: number[], x: number[]): number {
  let s = 0;
  for (let i = 0; i < Math.min(w.length, x.length); i++) {
    s += w[i] * x[i];
  }
  return s;
}

function dpSgd(data: Example[], epochs: number, lr: number, sigma: number, C: number): number[] {
  let w = [0.0, 0.0];
  let b = 0.0;
  for (let e = 0; e < epochs; e++) {
    shuffle(data);
    for (const [x, y] of data) {
      const z = b + dot(w, x);
      const err = sigmoid(z) - y;
      let gradW = x.map((xi) => err * xi);
      let gradB = err;
      gradW = clip(gradW, C);
      gradB = Math.max(-C, Math.min(C, gradB));
      const noiseW = [gauss(0.0, sigma * C), gauss(0.0, sigma * C)];
      const noiseB = gauss(0.0, sigma * C);
      w = w.map((wi, i) => wi - lr * (gradW[i] + noiseW[i]));
      b -= lr * (gradB + noiseB);
    }
  }
  return [...w, b];
}

function accuracy(model: number[], data: Example[]): number {
  const w = model.slice(0, 2);
  const b = model[2];
  let correct = 0;
  for (const [x, y] of data) {
    const z = b + dot(w, x);
    if ((z > 0 ? 1 : 0) === y) {
      correct += 1;
    }
  }
  return correct / data.length;
}

function analyticalEpsilon(sigma: number, steps: number, delta = 1e-5): number {
  return Math.sqrt(2 * Math.log(1.25 / delta)) * Math.sqrt(steps) / sigma;
}

function main(): void {
  console.log("=".repeat(70));
  console.log("DP-SGD TOY (Phase 18, Lesson 22)");
  console.log("=".repeat(70));

  const trainData = gen(500);
  const testData = gen(200);
  const epochs = 10;
  const C = 1.0;
  const delta = 1e-5;

  for (const sigma of [0.0, 0.5, 1.0, 2.0, 4.0]) {
    const model = dpSgd(trainData, epochs, 0.05, sigma, C);
    const acc = accuracy(model, testData);
    const epsText = sigma > 0 ? fmt(analyticalEpsilon(sigma, epochs, delta), 2) : "inf";
    console.log(`  sigma=${fmt(sigma, 1).padStart(4)}  approx-epsilon=${epsText.padStart(7)}  test-accuracy=${fmt(acc, 3)}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("TAKEAWAY: sigma=0 is standard SGD with no privacy (infinite epsilon).");
  console.log("increasing sigma adds noise, shrinks epsilon, and costs accuracy.");
  console.log("real deployments target epsilon in [1, 10] via accountants like");
  console.log("Moments Accountant. Nasr et al. 2025 shows extraction-based threats");
  console.log("persist under moderate epsilon -- DP is necessary but not sufficient.");
  console.log("=".repeat(70));
}

main();
