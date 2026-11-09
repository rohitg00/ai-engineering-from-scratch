// Lesson: Build Your Own Mini Framework (phase 03 / lesson 10)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/03-deep-learning-core/10-mini-framework/docs/en.md
// Run: npx tsx phases/03-deep-learning-core/10-mini-framework/code/main.ts

type Random = () => number;

type Parameter =
  | { kind: "matrix"; values: number[][]; grads: number[][]; i: number; j: number }
  | { kind: "vector"; values: number[]; grads: number[]; i: number };

type Sample = [number[], number[]];

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

function gauss(mean: number, std: number): number {
  let u1 = rng();
  while (u1 <= Number.EPSILON) u1 = rng();
  const u2 = rng();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function uniform(low: number, high: number): number {
  return low + (high - low) * rng();
}

function shuffle(items: number[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function checkLength(a: number[], b: number[], what: string): void {
  if (a.length !== b.length) throw new Error(`${what}: expected length ${a.length}, got ${b.length}`);
}

function gradOf(p: Parameter): number {
  return p.kind === "matrix" ? p.grads[p.i][p.j] : p.grads[p.i];
}

function subtractParam(p: Parameter, amount: number): void {
  if (p.kind === "matrix") p.values[p.i][p.j] -= amount;
  else p.values[p.i] -= amount;
}

function zeroParam(p: Parameter): void {
  if (p.kind === "matrix") p.grads[p.i][p.j] = 0.0;
  else p.grads[p.i] = 0.0;
}

abstract class Module {
  training = true;

  abstract forward(x: number[]): number[];

  abstract backward(grad: number[]): number[];

  parameters(): Parameter[] {
    return [];
  }

  train(): void {
    this.training = true;
  }

  eval(): void {
    this.training = false;
  }
}

class Linear extends Module {
  weights: number[][];
  biases: number[];
  weightGrads: number[][];
  biasGrads: number[];
  input: number[] | null = null;

  constructor(
    readonly fanIn: number,
    readonly fanOut: number,
  ) {
    super();
    if (fanIn < 1 || fanOut < 1) throw new Error("Linear needs fanIn and fanOut of at least 1");
    const std = Math.sqrt(2.0 / fanIn);
    this.weights = Array.from({ length: fanOut }, () => Array.from({ length: fanIn }, () => gauss(0, std)));
    this.biases = new Array<number>(fanOut).fill(0.0);
    this.weightGrads = Array.from({ length: fanOut }, () => new Array<number>(fanIn).fill(0.0));
    this.biasGrads = new Array<number>(fanOut).fill(0.0);
  }

  forward(x: number[]): number[] {
    if (x.length !== this.fanIn) throw new Error(`Linear expects ${this.fanIn} inputs, got ${x.length}`);
    this.input = x;
    const output: number[] = [];
    for (let i = 0; i < this.fanOut; i++) {
      let val = this.biases[i];
      for (let j = 0; j < this.fanIn; j++) val += this.weights[i][j] * x[j];
      output.push(val);
    }
    return output;
  }

  backward(grad: number[]): number[] {
    if (this.input === null) throw new Error("Linear.backward called before forward");
    if (grad.length !== this.fanOut) throw new Error(`Linear expects ${this.fanOut} gradients, got ${grad.length}`);
    const inputGrad = new Array<number>(this.fanIn).fill(0.0);
    for (let i = 0; i < this.fanOut; i++) {
      this.biasGrads[i] += grad[i];
      for (let j = 0; j < this.fanIn; j++) {
        this.weightGrads[i][j] += grad[i] * this.input[j];
        inputGrad[j] += grad[i] * this.weights[i][j];
      }
    }
    return inputGrad;
  }

  parameters(): Parameter[] {
    const params: Parameter[] = [];
    for (let i = 0; i < this.fanOut; i++) {
      for (let j = 0; j < this.fanIn; j++) {
        params.push({ kind: "matrix", values: this.weights, grads: this.weightGrads, i, j });
      }
      params.push({ kind: "vector", values: this.biases, grads: this.biasGrads, i });
    }
    return params;
  }
}

class ReLU extends Module {
  mask: number[] | null = null;

  forward(x: number[]): number[] {
    this.mask = x.map((v) => (v > 0 ? 1.0 : 0.0));
    return x.map((v) => Math.max(0.0, v));
  }

  backward(grad: number[]): number[] {
    if (this.mask === null) throw new Error("ReLU.backward called before forward");
    checkLength(this.mask, grad, "ReLU.backward");
    const mask = this.mask;
    return grad.map((g, i) => g * mask[i]);
  }
}

class Sigmoid extends Module {
  output: number[] | null = null;

  forward(x: number[]): number[] {
    this.output = x.map((v) => 1.0 / (1.0 + Math.exp(-Math.max(-500, Math.min(500, v)))));
    return this.output;
  }

  backward(grad: number[]): number[] {
    if (this.output === null) throw new Error("Sigmoid.backward called before forward");
    checkLength(this.output, grad, "Sigmoid.backward");
    const out = this.output;
    return grad.map((g, i) => g * out[i] * (1 - out[i]));
  }
}

class Tanh extends Module {
  output: number[] | null = null;

  forward(x: number[]): number[] {
    this.output = x.map((v) => Math.tanh(v));
    return this.output;
  }

  backward(grad: number[]): number[] {
    if (this.output === null) throw new Error("Tanh.backward called before forward");
    checkLength(this.output, grad, "Tanh.backward");
    const out = this.output;
    return grad.map((g, i) => g * (1 - out[i] * out[i]));
  }
}

class Dropout extends Module {
  mask: number[] | null = null;

  constructor(readonly p = 0.5) {
    super();
    if (!(p >= 0 && p <= 1)) throw new Error("Dropout p must be between 0 and 1");
  }

  forward(x: number[]): number[] {
    if (!this.training) return x;
    this.mask = x.map(() => (rng() < this.p ? 0.0 : 1.0 / (1 - this.p)));
    const mask = this.mask;
    return x.map((v, i) => v * mask[i]);
  }

  backward(grad: number[]): number[] {
    if (this.mask === null) return grad;
    checkLength(this.mask, grad, "Dropout.backward");
    const mask = this.mask;
    return grad.map((g, i) => g * mask[i]);
  }
}

class BatchNorm extends Module {
  gamma: number[];
  beta: number[];
  gammaGrads: number[];
  betaGrads: number[];
  runningMean: number[];
  runningVar: number[];
  xNorm: number[] | number[][] | null = null;
  stdInv: number[] | null = null;
  batchInput: number[][] | null = null;

  constructor(
    readonly size: number,
    readonly momentum = 0.1,
    readonly eps = 1e-5,
  ) {
    super();
    this.gamma = new Array<number>(size).fill(1.0);
    this.beta = new Array<number>(size).fill(0.0);
    this.gammaGrads = new Array<number>(size).fill(0.0);
    this.betaGrads = new Array<number>(size).fill(0.0);
    this.runningMean = new Array<number>(size).fill(0.0);
    this.runningVar = new Array<number>(size).fill(1.0);
  }

  forwardBatch(batch: number[][]): number[][] {
    if (batch.length === 0) throw new Error("BatchNorm.forwardBatch needs at least one sample");
    for (const sample of batch) {
      if (sample.length !== this.size) throw new Error(`BatchNorm expects ${this.size} features, got ${sample.length}`);
    }
    const batchSize = batch.length;
    const outputBatch: number[][] = [];

    if (this.training) {
      const mean = new Array<number>(this.size).fill(0.0);
      for (const sample of batch) for (let j = 0; j < this.size; j++) mean[j] += sample[j];
      for (let j = 0; j < this.size; j++) mean[j] /= batchSize;

      const variance = new Array<number>(this.size).fill(0.0);
      for (const sample of batch) for (let j = 0; j < this.size; j++) variance[j] += (sample[j] - mean[j]) ** 2;
      for (let j = 0; j < this.size; j++) variance[j] /= batchSize;

      const stdInv = variance.map((v) => 1.0 / Math.sqrt(v + this.eps));
      this.stdInv = stdInv;

      const xNorm: number[][] = [];
      this.batchInput = batch;
      for (const sample of batch) {
        const normed = sample.map((v, j) => (v - mean[j]) * stdInv[j]);
        xNorm.push(normed);
        outputBatch.push(normed.map((v, j) => this.gamma[j] * v + this.beta[j]));
      }
      this.xNorm = xNorm;

      for (let j = 0; j < this.size; j++) {
        this.runningMean[j] = (1 - this.momentum) * this.runningMean[j] + this.momentum * mean[j];
        this.runningVar[j] = (1 - this.momentum) * this.runningVar[j] + this.momentum * variance[j];
      }
    } else {
      const stdInv = this.runningVar.map((v) => 1.0 / Math.sqrt(v + this.eps));
      for (const sample of batch) {
        const normed = sample.map((v, j) => (v - this.runningMean[j]) * stdInv[j]);
        outputBatch.push(normed.map((v, j) => this.gamma[j] * v + this.beta[j]));
      }
    }

    return outputBatch;
  }

  forward(x: number[]): number[] {
    if (x.length !== this.size) throw new Error(`BatchNorm expects ${this.size} features, got ${x.length}`);
    if (this.training) {
      for (let j = 0; j < this.size; j++) {
        const delta = x[j] - this.runningMean[j];
        this.runningMean[j] += this.momentum * delta;
        this.runningVar[j] = (1 - this.momentum) * (this.runningVar[j] + this.momentum * delta * delta);
      }
      const stdInv = this.runningVar.map((v) => 1.0 / Math.sqrt(v + this.eps));
      this.stdInv = stdInv;
      const xNorm = x.map((v, j) => (v - this.runningMean[j]) * stdInv[j]);
      this.xNorm = xNorm;
      return xNorm.map((v, j) => this.gamma[j] * v + this.beta[j]);
    }
    const stdInv = this.runningVar.map((v) => 1.0 / Math.sqrt(v + this.eps));
    return x.map((v, j) => this.gamma[j] * ((v - this.runningMean[j]) * stdInv[j]) + this.beta[j]);
  }

  backward(grad: number[]): number[] {
    if (this.xNorm === null || this.stdInv === null) return grad;
    if (grad.length !== this.size) throw new Error(`BatchNorm expects ${this.size} gradients, got ${grad.length}`);
    const first = this.xNorm[0];
    const xNorm = Array.isArray(first) ? first : (this.xNorm as number[]);
    for (let j = 0; j < this.size; j++) {
      this.gammaGrads[j] += xNorm[j] * grad[j];
      this.betaGrads[j] += grad[j];
    }
    const stdInv = this.stdInv;
    return grad.map((g, j) => g * this.gamma[j] * stdInv[j]);
  }

  parameters(): Parameter[] {
    const params: Parameter[] = [];
    for (let j = 0; j < this.size; j++) {
      params.push({ kind: "vector", values: this.gamma, grads: this.gammaGrads, i: j });
      params.push({ kind: "vector", values: this.beta, grads: this.betaGrads, i: j });
    }
    return params;
  }
}

class Sequential extends Module {
  readonly modules: Module[];

  constructor(...modules: Module[]) {
    super();
    this.modules = modules;
  }

  forward(x: number[]): number[] {
    for (const module of this.modules) x = module.forward(x);
    return x;
  }

  backward(grad: number[]): number[] {
    for (let k = this.modules.length - 1; k >= 0; k--) grad = this.modules[k].backward(grad);
    return grad;
  }

  parameters(): Parameter[] {
    return this.modules.flatMap((module) => module.parameters());
  }

  train(): void {
    this.training = true;
    for (const module of this.modules) module.train();
  }

  eval(): void {
    this.training = false;
    for (const module of this.modules) module.eval();
  }

  countParameters(): number {
    return this.parameters().length;
  }
}

class MSELoss {
  predicted: number[] = [];
  target: number[] = [];
  loss = 0;

  call(predicted: number[], target: number[]): number {
    if (predicted.length === 0) throw new Error("MSELoss needs at least one value");
    checkLength(predicted, target, "MSELoss");
    this.predicted = predicted;
    this.target = target;
    let total = 0;
    for (let k = 0; k < predicted.length; k++) total += (predicted[k] - target[k]) ** 2;
    this.loss = total / predicted.length;
    return this.loss;
  }

  backward(): number[] {
    const n = this.predicted.length;
    return this.predicted.map((p, k) => (2 * (p - this.target[k])) / n);
  }
}

class BCELoss {
  predicted: number[] = [];
  target: number[] = [];
  loss = 0;

  call(predicted: number[], target: number[]): number {
    if (predicted.length === 0) throw new Error("BCELoss needs at least one value");
    checkLength(predicted, target, "BCELoss");
    this.predicted = predicted;
    this.target = target;
    const eps = 1e-7;
    let total = 0;
    for (let k = 0; k < predicted.length; k++) {
      const p = Math.max(eps, Math.min(1 - eps, predicted[k]));
      const t = target[k];
      total += -(t * Math.log(p) + (1 - t) * Math.log(1 - p));
    }
    this.loss = total / predicted.length;
    return this.loss;
  }

  backward(): number[] {
    const eps = 1e-7;
    const n = this.predicted.length;
    return this.predicted.map((raw, k) => {
      const p = Math.max(eps, Math.min(1 - eps, raw));
      const t = this.target[k];
      return (-t / p + (1 - t) / (1 - p)) / n;
    });
  }
}

class SGD {
  constructor(
    readonly params: Parameter[],
    readonly lr = 0.01,
  ) {}

  step(): void {
    for (const p of this.params) subtractParam(p, this.lr * gradOf(p));
  }

  zeroGrad(): void {
    for (const p of this.params) zeroParam(p);
  }
}

class Adam {
  t = 0;
  m: number[];
  v: number[];

  constructor(
    readonly params: Parameter[],
    readonly lr = 0.001,
    readonly beta1 = 0.9,
    readonly beta2 = 0.999,
    readonly eps = 1e-8,
  ) {
    this.m = new Array<number>(params.length).fill(0.0);
    this.v = new Array<number>(params.length).fill(0.0);
  }

  step(): void {
    this.t += 1;
    this.params.forEach((p, idx) => {
      const g = gradOf(p);
      this.m[idx] = this.beta1 * this.m[idx] + (1 - this.beta1) * g;
      this.v[idx] = this.beta2 * this.v[idx] + (1 - this.beta2) * g * g;
      const mHat = this.m[idx] / (1 - this.beta1 ** this.t);
      const vHat = this.v[idx] / (1 - this.beta2 ** this.t);
      subtractParam(p, (this.lr * mHat) / (Math.sqrt(vHat) + this.eps));
    });
  }

  zeroGrad(): void {
    for (const p of this.params) zeroParam(p);
  }
}

class DataLoader {
  constructor(
    readonly data: Sample[],
    readonly batchSize = 32,
    readonly shuffle = true,
  ) {
    if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error("batchSize must be a positive integer");
  }

  *[Symbol.iterator](): Generator<[number[][], number[][]]> {
    const indices = this.data.map((_, i) => i);
    if (this.shuffle) shuffle(indices);
    for (let start = 0; start < indices.length; start += this.batchSize) {
      const batch = indices.slice(start, start + this.batchSize).map((i) => this.data[i]);
      yield [batch.map((item) => item[0]), batch.map((item) => item[1])];
    }
  }

  get length(): number {
    return Math.ceil(this.data.length / this.batchSize);
  }
}

function makeCircleData(n = 500, seedValue = 1): Sample[] {
  seed(seedValue);
  const data: Sample[] = [];
  for (let k = 0; k < n; k++) {
    const x = uniform(-2, 2);
    const y = uniform(-2, 2);
    const label = x * x + y * y < 1.5 ? 1.0 : 0.0;
    data.push([[x, y], [label]]);
  }
  return data;
}

function buildModel(withDropout: boolean): Sequential {
  if (withDropout) {
    return new Sequential(
      new Linear(2, 16),
      new ReLU(),
      new Dropout(0.3),
      new Linear(16, 16),
      new ReLU(),
      new Dropout(0.3),
      new Linear(16, 8),
      new ReLU(),
      new Linear(8, 1),
      new Sigmoid(),
    );
  }
  return new Sequential(
    new Linear(2, 16),
    new ReLU(),
    new Linear(16, 16),
    new ReLU(),
    new Linear(16, 8),
    new ReLU(),
    new Linear(8, 1),
    new Sigmoid(),
  );
}

function splitData(): [Sample[], Sample[]] {
  const data = makeCircleData(500);
  const split = Math.trunc(data.length * 0.8);
  return [data.slice(0, split), data.slice(split)];
}

function testAccuracy(model: Sequential, testData: Sample[]): [number, number] {
  let correct = 0;
  for (const [x, t] of testData) {
    const pred = model.forward(x);
    const predictedClass = pred[0] >= 0.5 ? 1.0 : 0.0;
    if (predictedClass === t[0]) correct += 1;
  }
  return [correct, (correct / testData.length) * 100];
}

function trainFramework(): [Sequential, number] {
  seed(1);
  const model = buildModel(false);

  console.log("Model: 4 linear layers (2->16->16->8->1)");
  console.log(`Total parameters: ${model.countParameters()}`);
  console.log("Optimizer: Adam (lr=0.01)");
  console.log("Loss: Binary Cross-Entropy");
  console.log("Data: 500 samples (80/20 train/test split)");
  console.log("");

  const criterion = new BCELoss();
  const optimizer = new Adam(model.parameters(), 0.01);
  const [trainData, testData] = splitData();
  const loader = new DataLoader(trainData, 16, true);

  model.train();

  for (let epoch = 0; epoch < 100; epoch++) {
    let totalLoss = 0;
    let totalCorrect = 0;
    let totalSamples = 0;

    for (const [batchInputs, batchTargets] of loader) {
      batchInputs.forEach((x, k) => {
        const t = batchTargets[k];
        const pred = model.forward(x);
        totalLoss += criterion.call(pred, t);

        optimizer.zeroGrad();
        model.backward(criterion.backward());
        optimizer.step();

        const predictedClass = pred[0] >= 0.5 ? 1.0 : 0.0;
        if (predictedClass === t[0]) totalCorrect += 1;
        totalSamples += 1;
      });
    }

    const avgLoss = totalLoss / totalSamples;
    const accuracy = (totalCorrect / totalSamples) * 100;

    if (epoch % 10 === 0 || epoch === 99) {
      console.log(
        `  Epoch ${String(epoch).padStart(3)} | Loss: ${avgLoss.toFixed(6)} | Train Accuracy: ${accuracy.toFixed(1)}%`,
      );
    }
  }

  model.eval();
  const [correct, accuracy] = testAccuracy(model, testData);
  console.log(`\n  Test Accuracy: ${accuracy.toFixed(1)}% (${correct}/${testData.length})`);

  return [model, accuracy];
}

function trainLoop(model: Sequential, optimizer: SGD | Adam, criterion: BCELoss, loader: DataLoader): void {
  model.train();
  for (let epoch = 0; epoch < 100; epoch++) {
    for (const [batchInputs, batchTargets] of loader) {
      batchInputs.forEach((x, k) => {
        const pred = model.forward(x);
        criterion.call(pred, batchTargets[k]);
        optimizer.zeroGrad();
        model.backward(criterion.backward());
        optimizer.step();
      });
    }
  }
  model.eval();
}

function trainWithSgd(): number {
  seed(1);
  const model = buildModel(false);
  const criterion = new BCELoss();
  const optimizer = new SGD(model.parameters(), 0.1);
  const [trainData, testData] = splitData();
  trainLoop(model, optimizer, criterion, new DataLoader(trainData, 16, true));
  return testAccuracy(model, testData)[1];
}

function trainWithDropout(): number {
  seed(1);
  const model = buildModel(true);
  const criterion = new BCELoss();
  const optimizer = new Adam(model.parameters(), 0.01);
  const [trainData, testData] = splitData();
  trainLoop(model, optimizer, criterion, new DataLoader(trainData, 16, true));
  return testAccuracy(model, testData)[1];
}

function samplePredictions(model: Sequential): void {
  const testPoints: [number[], string][] = [
    [[0.0, 0.0], "inside"],
    [[0.5, 0.5], "inside"],
    [[1.0, 0.0], "inside"],
    [[-0.3, 0.3], "inside"],
    [[1.5, 1.5], "outside"],
    [[0.0, 1.8], "outside"],
    [[-1.5, -1.0], "outside"],
    [[2.0, 0.0], "outside"],
  ];

  console.log("\n  Sample Predictions:");
  for (const [point, expected] of testPoints) {
    const pred = model.forward(point);
    const region = pred[0] >= 0.5 ? "inside" : "outside";
    const status = region === expected ? "OK" : "WRONG";
    console.log(
      `    (${point[0].toFixed(1).padStart(5)}, ${point[1].toFixed(1).padStart(5)}) -> ${pred[0].toFixed(4)} (${region.padEnd(7)}, expected ${expected.padEnd(7)}) ${status}`,
    );
  }
}

function main(): void {
  console.log("=".repeat(70));
  console.log("MINI FRAMEWORK -- Phase 3 Capstone");
  console.log("=".repeat(70));
  console.log("");

  console.log("-".repeat(70));
  console.log("EXPERIMENT 1: Adam Optimizer (4-layer network)");
  console.log("-".repeat(70));
  const [model, adamAcc] = trainFramework();
  samplePredictions(model);

  console.log("\n" + "-".repeat(70));
  console.log("EXPERIMENT 2: SGD Optimizer (same architecture)");
  console.log("-".repeat(70));
  const sgdAcc = trainWithSgd();
  console.log(`  SGD Test Accuracy: ${sgdAcc.toFixed(1)}%`);

  console.log("\n" + "-".repeat(70));
  console.log("EXPERIMENT 3: With Dropout (p=0.3)");
  console.log("-".repeat(70));
  const dropoutAcc = trainWithDropout();
  console.log(`  Dropout Test Accuracy: ${dropoutAcc.toFixed(1)}%`);

  console.log("\n" + "=".repeat(70));
  console.log("COMPARISON");
  console.log("=".repeat(70));
  console.log(`  Adam (no dropout):     ${adamAcc.toFixed(1)}%`);
  console.log(`  SGD (no dropout):      ${sgdAcc.toFixed(1)}%`);
  console.log(`  Adam + Dropout(0.3):   ${dropoutAcc.toFixed(1)}%`);

  console.log("\n" + "=".repeat(70));
  console.log("FRAMEWORK COMPONENTS");
  console.log("=".repeat(70));
  console.log("  Modules:    Linear, ReLU, Sigmoid, Tanh, Dropout, BatchNorm");
  console.log("  Containers: Sequential");
  console.log("  Losses:     MSELoss, BCELoss");
  console.log("  Optimizers: SGD, Adam");
  console.log("  Data:       DataLoader (batching + shuffle)");
  console.log("  Total:      ~500 lines of pure TypeScript");
}

main();
