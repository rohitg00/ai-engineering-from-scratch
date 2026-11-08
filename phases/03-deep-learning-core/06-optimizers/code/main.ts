// Lesson: Optimizers (phase 03 / lesson 06)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/03-deep-learning-core/06-optimizers/docs/en.md
// Run: npx tsx phases/03-deep-learning-core/06-optimizers/code/main.ts

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

let rng: Random = mulberry32(0);

function seed(value: number): void {
  rng = mulberry32(value);
}

function uniform(low: number, high: number): number {
  return low + (high - low) * rng();
}

function gauss(mu: number, sigma: number): number {
  let u1 = rng();
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

interface Optimizer {
  step(params: number[], grads: number[]): void;
}

function checkLengths(params: number[], grads: number[], state: number[] | null): void {
  if (params.length !== grads.length) {
    throw new Error(`got ${params.length} params but ${grads.length} grads`);
  }
  if (state !== null && state.length !== params.length) {
    throw new Error(`optimizer state has ${state.length} slots but got ${params.length} params`);
  }
}

class SGD implements Optimizer {
  constructor(public lr = 0.01) {}

  step(params: number[], grads: number[]): void {
    checkLengths(params, grads, null);
    for (let i = 0; i < params.length; i++) params[i] -= this.lr * grads[i];
  }
}

class SGDMomentum implements Optimizer {
  velocities: number[] | null = null;

  constructor(public lr = 0.01, public beta = 0.9) {}

  step(params: number[], grads: number[]): void {
    checkLengths(params, grads, this.velocities);
    if (this.velocities === null) this.velocities = new Array<number>(params.length).fill(0);
    for (let i = 0; i < params.length; i++) {
      this.velocities[i] = this.beta * this.velocities[i] + grads[i];
      params[i] -= this.lr * this.velocities[i];
    }
  }
}

class Adam implements Optimizer {
  m: number[] | null = null;
  v: number[] = [];
  t = 0;

  constructor(public lr = 0.001, public beta1 = 0.9, public beta2 = 0.999, public epsilon = 1e-8) {}

  step(params: number[], grads: number[]): void {
    checkLengths(params, grads, this.m);
    if (this.m === null) {
      this.m = new Array<number>(params.length).fill(0);
      this.v = new Array<number>(params.length).fill(0);
    }
    this.t += 1;
    for (let i = 0; i < params.length; i++) {
      this.m[i] = this.beta1 * this.m[i] + (1 - this.beta1) * grads[i];
      this.v[i] = this.beta2 * this.v[i] + (1 - this.beta2) * grads[i] ** 2;
      const mHat = this.m[i] / (1 - this.beta1 ** this.t);
      const vHat = this.v[i] / (1 - this.beta2 ** this.t);
      params[i] -= (this.lr * mHat) / (Math.sqrt(vHat) + this.epsilon);
    }
  }
}

class AdamW implements Optimizer {
  m: number[] | null = null;
  v: number[] = [];
  t = 0;

  constructor(
    public lr = 0.001,
    public beta1 = 0.9,
    public beta2 = 0.999,
    public epsilon = 1e-8,
    public weightDecay = 0.01,
  ) {}

  step(params: number[], grads: number[]): void {
    checkLengths(params, grads, this.m);
    if (this.m === null) {
      this.m = new Array<number>(params.length).fill(0);
      this.v = new Array<number>(params.length).fill(0);
    }
    this.t += 1;
    for (let i = 0; i < params.length; i++) {
      this.m[i] = this.beta1 * this.m[i] + (1 - this.beta1) * grads[i];
      this.v[i] = this.beta2 * this.v[i] + (1 - this.beta2) * grads[i] ** 2;
      const mHat = this.m[i] / (1 - this.beta1 ** this.t);
      const vHat = this.v[i] / (1 - this.beta2 ** this.t);
      params[i] = params[i] * (1 - this.weightDecay * this.lr);
      params[i] -= (this.lr * mHat) / (Math.sqrt(vHat) + this.epsilon);
    }
  }
}

function sigmoid(x: number): number {
  const clipped = Math.max(-500, Math.min(500, x));
  return 1 / (1 + Math.exp(-clipped));
}

type Sample = [number[], number];

function makeCircleData(n = 200, seedValue = 42): Sample[] {
  seed(seedValue);
  const data: Sample[] = [];
  for (let i = 0; i < n; i++) {
    const x = uniform(-2, 2);
    const y = uniform(-2, 2);
    const label = x * x + y * y < 1.5 ? 1 : 0;
    data.push([[x, y], label]);
  }
  return data;
}

class OptimizerTestNetwork {
  hiddenSize: number;
  optimizer: Optimizer;
  w1: number[][];
  b1: number[];
  w2: number[];
  b2: number;
  x: number[] = [];
  z1: number[] = [];
  h: number[] = [];
  z2 = 0;
  out = 0;

  constructor(optimizer: Optimizer, hiddenSize = 8) {
    seed(0);
    this.hiddenSize = hiddenSize;
    this.optimizer = optimizer;
    this.w1 = [];
    for (let i = 0; i < hiddenSize; i++) this.w1.push([gauss(0, 0.5), gauss(0, 0.5)]);
    this.b1 = new Array<number>(hiddenSize).fill(0);
    this.w2 = [];
    for (let i = 0; i < hiddenSize; i++) this.w2.push(gauss(0, 0.5));
    this.b2 = 0;
  }

  getParams(): number[] {
    const params: number[] = [];
    for (const row of this.w1) params.push(...row);
    params.push(...this.b1);
    params.push(...this.w2);
    params.push(this.b2);
    return params;
  }

  setParams(params: number[]): void {
    const expected = this.hiddenSize * 4 + 1;
    if (params.length !== expected) {
      throw new Error(`expected ${expected} params, got ${params.length}`);
    }
    let idx = 0;
    for (let i = 0; i < this.hiddenSize; i++) {
      for (let j = 0; j < 2; j++) this.w1[i][j] = params[idx++];
    }
    for (let i = 0; i < this.hiddenSize; i++) this.b1[i] = params[idx++];
    for (let i = 0; i < this.hiddenSize; i++) this.w2[i] = params[idx++];
    this.b2 = params[idx];
  }

  forward(x: number[]): number {
    this.x = x;
    this.z1 = [];
    this.h = [];
    for (let i = 0; i < this.hiddenSize; i++) {
      const z = this.w1[i][0] * x[0] + this.w1[i][1] * x[1] + this.b1[i];
      this.z1.push(z);
      this.h.push(Math.max(0, z));
    }
    let z2 = 0;
    for (let i = 0; i < this.hiddenSize; i++) z2 += this.w2[i] * this.h[i];
    this.z2 = z2 + this.b2;
    this.out = sigmoid(this.z2);
    return this.out;
  }

  computeGrads(target: number): number[] {
    const eps = 1e-15;
    const p = Math.max(eps, Math.min(1 - eps, this.out));
    const dLoss = -(target / p) + (1 - target) / (1 - p);
    const dSigmoid = this.out * (1 - this.out);
    const dOut = dLoss * dSigmoid;

    const grads = new Array<number>(this.hiddenSize * 4 + 1).fill(0);
    let idx = 0;
    for (let i = 0; i < this.hiddenSize; i++) {
      const dRelu = this.z1[i] > 0 ? 1 : 0;
      const dH = dOut * this.w2[i] * dRelu;
      grads[idx] = dH * this.x[0];
      grads[idx + 1] = dH * this.x[1];
      idx += 2;
    }
    for (let i = 0; i < this.hiddenSize; i++) {
      const dRelu = this.z1[i] > 0 ? 1 : 0;
      grads[idx++] = dOut * this.w2[i] * dRelu;
    }
    for (let i = 0; i < this.hiddenSize; i++) grads[idx++] = dOut * this.h[i];
    grads[idx] = dOut;
    return grads;
  }

  train(data: Sample[], epochs = 300): [number, number][] {
    if (data.length === 0) throw new Error("training data is empty");
    const losses: [number, number][] = [];
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;
      let correct = 0;
      for (const [x, y] of data) {
        const pred = this.forward(x);
        const grads = this.computeGrads(y);
        const params = this.getParams();
        this.optimizer.step(params, grads);
        this.setParams(params);

        const eps = 1e-15;
        const p = Math.max(eps, Math.min(1 - eps, pred));
        totalLoss += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
        if (pred >= 0.5 === y >= 0.5) correct++;
      }
      const avgLoss = totalLoss / data.length;
      const accuracy = (correct / data.length) * 100;
      losses.push([avgLoss, accuracy]);
      if (epoch % 75 === 0 || epoch === epochs - 1) {
        console.log(`    Epoch ${String(epoch).padStart(3)}: loss=${avgLoss.toFixed(4)}, accuracy=${accuracy.toFixed(1)}%`);
      }
    }
    return losses;
  }
}

function biasCorrectionDemo(): void {
  const beta1 = 0.9;
  const beta2 = 0.999;
  const gradient = 1;

  console.log("  Step | m_raw  | m_corrected | v_raw    | v_corrected");
  console.log("  " + "-".repeat(55));

  let m = 0;
  let v = 0;
  for (let t = 1; t <= 10; t++) {
    m = beta1 * m + (1 - beta1) * gradient;
    v = beta2 * v + (1 - beta2) * gradient ** 2;
    const mHat = m / (1 - beta1 ** t);
    const vHat = v / (1 - beta2 ** t);
    console.log(`  ${String(t).padStart(4)} | ${m.toFixed(4)} | ${mHat.toFixed(4)}      | ${v.toFixed(6)} | ${vHat.toFixed(6)}`);
  }
}

function l2Norm(values: number[]): number {
  let total = 0;
  for (const w of values) total += w * w;
  return Math.sqrt(total);
}

function banner(title: string): void {
  console.log("=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

function main(): void {
  banner("STEP 1: SGD on a Simple Function");
  console.log("  Minimizing f(x) = (x - 3)^2, starting at x = 10");
  const x = [10];
  const sgd = new SGD(0.1);
  for (let step = 0; step < 20; step++) {
    const grad = [2 * (x[0] - 3)];
    sgd.step(x, grad);
    const loss = (x[0] - 3) ** 2;
    if (step % 5 === 0 || step === 19) {
      console.log(`    Step ${String(step).padStart(2)}: x=${x[0].toFixed(6)}, loss=${loss.toFixed(6)}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("STEP 2: Bias Correction in Adam");
  console.log("=".repeat(60));
  console.log("  Showing how raw moments are biased toward zero initially");
  biasCorrectionDemo();

  console.log("\n" + "=".repeat(60));
  console.log("STEP 3: Optimizer Comparison on Circle Dataset");
  console.log("=".repeat(60));
  const data = makeCircleData();

  const configs: [string, Optimizer][] = [
    ["SGD (lr=0.05)", new SGD(0.05)],
    ["SGD+Momentum (lr=0.05, beta=0.9)", new SGDMomentum(0.05, 0.9)],
    ["Adam (lr=0.001)", new Adam(0.001)],
    ["AdamW (lr=0.001, wd=0.01)", new AdamW(0.001, 0.9, 0.999, 1e-8, 0.01)],
  ];

  const results: [string, [number, number][]][] = [];
  for (const [name, opt] of configs) {
    console.log(`\n--- ${name} ---`);
    const net = new OptimizerTestNetwork(opt, 8);
    results.push([name, net.train(data, 300)]);
  }

  console.log("\n" + "=".repeat(60));
  console.log("FINAL COMPARISON");
  console.log("=".repeat(60));
  for (const [name, history] of results) {
    const [finalLoss, finalAcc] = history[history.length - 1];
    let first85: number | null = null;
    for (let epoch = 0; epoch < history.length; epoch++) {
      if (history[epoch][1] >= 85) {
        first85 = epoch;
        break;
      }
    }
    const reached = first85 !== null ? `epoch ${first85}` : "never";
    console.log(`  ${name.padEnd(40)}: acc=${finalAcc.toFixed(1)}%, loss=${finalLoss.toFixed(4)}, reached 85%: ${reached}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("STEP 4: Weight Decay Effect");
  console.log("=".repeat(60));
  seed(42);
  const largeWeights: number[] = [];
  for (let i = 0; i < 10; i++) largeWeights.push(uniform(-5, 5));
  const weightsAdam = [...largeWeights];
  const weightsAdamW = [...largeWeights];

  const optAdam = new Adam(0.001);
  const optAdamW = new AdamW(0.001, 0.9, 0.999, 1e-8, 0.1);

  console.log(`  Initial weight L2 norm: ${l2Norm(largeWeights).toFixed(4)}`);

  for (let step = 0; step < 100; step++) {
    const grads: number[] = [];
    for (let i = 0; i < 10; i++) grads.push(gauss(0, 0.1));
    optAdam.step(weightsAdam, [...grads]);
    optAdamW.step(weightsAdamW, [...grads]);
  }

  const normAdam = l2Norm(weightsAdam);
  const normAdamW = l2Norm(weightsAdamW);
  console.log("  After 100 steps:");
  console.log(`    Adam  weight L2 norm: ${normAdam.toFixed(4)}`);
  console.log(`    AdamW weight L2 norm: ${normAdamW.toFixed(4)}`);
  console.log(`    AdamW shrinks weights ${(normAdam / Math.max(0.001, normAdamW)).toFixed(1)}x more`);
}

main();
