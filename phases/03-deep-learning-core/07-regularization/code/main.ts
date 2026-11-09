// Lesson: Regularization (phase 03 / lesson 07)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/03-deep-learning-core/07-regularization/docs/en.md
// Run: npx tsx phases/03-deep-learning-core/07-regularization/code/main.ts

type Sample = [number[], number];

class SeededRandom {
  private state = 0;

  constructor(seed: number) {
    this.seed(seed);
  }

  seed(value: number): void {
    this.state = value >>> 0;
  }

  random(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
  }

  gauss(mu: number, sigma: number): number {
    let u1 = this.random();
    while (u1 <= 0) u1 = this.random();
    const u2 = this.random();
    return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

const random = new SeededRandom(0);

function fixed(value: number, digits: number): string {
  if (Number.isNaN(value)) return "nan";
  if (!Number.isFinite(value)) return value > 0 ? "inf" : "-inf";
  return value.toFixed(digits);
}

function strList(values: number[], digits: number): string {
  return "[" + values.map((v) => `'${fixed(v, digits)}'`).join(", ") + "]";
}

function floatRepr(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

function floatList(values: number[]): string {
  return "[" + values.map(floatRepr).join(", ") + "]";
}

function mean(values: number[]): number {
  if (values.length === 0) throw new Error("mean of an empty list");
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function clamp(value: number, low: number, high: number): number {
  const upper = high < value ? high : value;
  return low > upper ? low : upper;
}

function checkLength(values: number[], expected: number, label: string): void {
  if (values.length !== expected) {
    throw new Error(`${label} has ${values.length} features, expected ${expected}`);
  }
}

class Dropout {
  p: number;
  training = true;
  mask: number[] | null = null;

  constructor(p = 0.5) {
    if (!(p >= 0 && p < 1)) throw new Error("dropout probability must be in [0, 1)");
    this.p = p;
  }

  forward(x: number[]): number[] {
    if (!this.training) return [...x];
    const mask: number[] = [];
    const output: number[] = [];
    for (const val of x) {
      if (random.random() < this.p) {
        mask.push(0);
        output.push(0.0);
      } else {
        mask.push(1);
        output.push(val / (1 - this.p));
      }
    }
    this.mask = mask;
    return output;
  }

  backward(gradOutput: number[]): number[] {
    if (this.mask === null) throw new Error("backward called before a training forward pass");
    if (gradOutput.length !== this.mask.length) throw new Error("gradient length does not match the mask");
    const mask = this.mask;
    return gradOutput.map((g, i) => (mask[i] === 0 ? 0.0 : g / (1 - this.p)));
  }
}

function l2Regularization(weights: number[], lambdaReg: number): number {
  let penalty = 0.0;
  for (const w of weights) penalty += w * w;
  return lambdaReg * 0.5 * penalty;
}

function l2Gradient(weights: number[], lambdaReg: number): number[] {
  return weights.map((w) => lambdaReg * w);
}

class BatchNorm {
  gamma: number[];
  beta: number[];
  eps: number;
  momentum: number;
  runningMean: number[];
  runningVar: number[];
  training = true;
  numFeatures: number;
  xHat: number[][] = [];

  constructor(numFeatures: number, momentum = 0.1, eps = 1e-5) {
    this.gamma = new Array<number>(numFeatures).fill(1.0);
    this.beta = new Array<number>(numFeatures).fill(0.0);
    this.eps = eps;
    this.momentum = momentum;
    this.runningMean = new Array<number>(numFeatures).fill(0.0);
    this.runningVar = new Array<number>(numFeatures).fill(1.0);
    this.numFeatures = numFeatures;
  }

  forward(batch: number[][]): number[][] {
    const batchSize = batch.length;
    if (batchSize === 0) throw new Error("BatchNorm needs a non-empty batch");
    for (const sample of batch) checkLength(sample, this.numFeatures, "sample");
    let batchMean: number[];
    let batchVar: number[];
    if (this.training) {
      batchMean = new Array<number>(this.numFeatures).fill(0.0);
      for (const sample of batch) {
        for (let j = 0; j < this.numFeatures; j++) batchMean[j] += sample[j];
      }
      batchMean = batchMean.map((m) => m / batchSize);

      batchVar = new Array<number>(this.numFeatures).fill(0.0);
      for (const sample of batch) {
        for (let j = 0; j < this.numFeatures; j++) batchVar[j] += (sample[j] - batchMean[j]) ** 2;
      }
      batchVar = batchVar.map((v) => v / batchSize);

      for (let j = 0; j < this.numFeatures; j++) {
        this.runningMean[j] = (1 - this.momentum) * this.runningMean[j] + this.momentum * batchMean[j];
        this.runningVar[j] = (1 - this.momentum) * this.runningVar[j] + this.momentum * batchVar[j];
      }
    } else {
      batchMean = [...this.runningMean];
      batchVar = [...this.runningVar];
    }

    this.xHat = [];
    const output: number[][] = [];
    for (const sample of batch) {
      const normalized: number[] = [];
      const outSample: number[] = [];
      for (let j = 0; j < this.numFeatures; j++) {
        const xh = (sample[j] - batchMean[j]) / Math.sqrt(batchVar[j] + this.eps);
        normalized.push(xh);
        outSample.push(this.gamma[j] * xh + this.beta[j]);
      }
      this.xHat.push(normalized);
      output.push(outSample);
    }
    return output;
  }
}

class LayerNorm {
  gamma: number[];
  beta: number[];
  eps: number;
  numFeatures: number;
  xHat: number[] = [];

  constructor(numFeatures: number, eps = 1e-5) {
    this.gamma = new Array<number>(numFeatures).fill(1.0);
    this.beta = new Array<number>(numFeatures).fill(0.0);
    this.eps = eps;
    this.numFeatures = numFeatures;
  }

  forward(x: number[]): number[] {
    checkLength(x, this.numFeatures, "input");
    const m = mean(x);
    const v = mean(x.map((xi) => (xi - m) ** 2));

    this.xHat = [];
    const output: number[] = [];
    for (let j = 0; j < this.numFeatures; j++) {
      const xh = (x[j] - m) / Math.sqrt(v + this.eps);
      this.xHat.push(xh);
      output.push(this.gamma[j] * xh + this.beta[j]);
    }
    return output;
  }
}

class RMSNorm {
  gamma: number[];
  eps: number;
  numFeatures: number;

  constructor(numFeatures: number, eps = 1e-6) {
    this.gamma = new Array<number>(numFeatures).fill(1.0);
    this.eps = eps;
    this.numFeatures = numFeatures;
  }

  forward(x: number[]): number[] {
    checkLength(x, this.numFeatures, "input");
    const rms = Math.sqrt(mean(x.map((xi) => xi * xi)) + this.eps);
    const output: number[] = [];
    for (let j = 0; j < this.numFeatures; j++) output.push((this.gamma[j] * x[j]) / rms);
    return output;
  }
}

function sigmoid(x: number): number {
  const z = clamp(x, -500, 500);
  return 1.0 / (1.0 + Math.exp(-z));
}

function makeCircleData(n = 200, seed = 42): Sample[] {
  random.seed(seed);
  const data: Sample[] = [];
  for (let i = 0; i < n; i++) {
    const x = random.uniform(-2, 2);
    const y = random.uniform(-2, 2);
    const label = x * x + y * y < 1.5 ? 1.0 : 0.0;
    data.push([[x, y], label]);
  }
  return data;
}

function logLoss(target: number, pred: number): number {
  const eps = 1e-15;
  const p = clamp(pred, eps, 1 - eps);
  return -(target * Math.log(p) + (1 - target) * Math.log(1 - p));
}

type History = [number, number, number, number];

class RegularizedNetwork {
  hiddenSize: number;
  lr: number;
  dropoutP: number;
  weightDecay: number;
  dropout: Dropout | null;
  w1: number[][];
  b1: number[];
  w2: number[];
  b2: number;
  x: number[] = [];
  z1: number[] = [];
  h: number[] = [];
  z2 = 0;
  out = 0;

  constructor(hiddenSize = 16, lr = 0.05, dropoutP = 0.0, weightDecay = 0.0) {
    random.seed(0);
    this.hiddenSize = hiddenSize;
    this.lr = lr;
    this.dropoutP = dropoutP;
    this.weightDecay = weightDecay;
    this.dropout = dropoutP > 0 ? new Dropout(dropoutP) : null;

    this.w1 = Array.from({ length: hiddenSize }, () => [random.gauss(0, 0.5), random.gauss(0, 0.5)]);
    this.b1 = new Array<number>(hiddenSize).fill(0.0);
    this.w2 = Array.from({ length: hiddenSize }, () => random.gauss(0, 0.5));
    this.b2 = 0.0;
  }

  forward(x: number[], training = true): number {
    if (x.length !== 2) throw new Error("input must have 2 features");
    this.x = x;
    this.z1 = [];
    this.h = [];
    for (let i = 0; i < this.hiddenSize; i++) {
      const z = this.w1[i][0] * x[0] + this.w1[i][1] * x[1] + this.b1[i];
      this.z1.push(z);
      this.h.push(z > 0 ? z : 0.0);
    }

    if (this.dropout) {
      this.dropout.training = training;
      this.h = this.dropout.forward(this.h);
    }

    let total = 0;
    for (let i = 0; i < this.hiddenSize; i++) total += this.w2[i] * this.h[i];
    this.z2 = total + this.b2;
    this.out = sigmoid(this.z2);
    return this.out;
  }

  backward(target: number): void {
    const eps = 1e-15;
    const p = clamp(this.out, eps, 1 - eps);
    const dLoss = -(target / p) + (1 - target) / (1 - p);
    const dSigmoid = this.out * (1 - this.out);
    const dOut = dLoss * dSigmoid;

    let dHDropout = this.w2.map((w) => dOut * w);
    if (this.dropout && this.dropout.mask !== null) {
      const mask = this.dropout.mask;
      const keep = 1 - this.dropout.p;
      dHDropout = dHDropout.map((g, i) => (mask[i] ? (g * mask[i]) / keep : 0.0));
    }

    for (let i = 0; i < this.hiddenSize; i++) {
      const dRelu = this.z1[i] > 0 ? 1.0 : 0.0;
      const dH = dHDropout[i] * dRelu;
      this.w2[i] -= this.lr * (dOut * this.h[i] + this.weightDecay * this.w2[i]);
      for (let j = 0; j < 2; j++) {
        this.w1[i][j] -= this.lr * (dH * this.x[j] + this.weightDecay * this.w1[i][j]);
      }
      this.b1[i] -= this.lr * dH;
    }
    this.b2 -= this.lr * dOut;
  }

  evaluate(data: Sample[]): [number, number] {
    if (data.length === 0) throw new Error("evaluate needs at least one sample");
    let correct = 0;
    let totalLoss = 0.0;
    for (const [x, y] of data) {
      const pred = this.forward(x, false);
      totalLoss += logLoss(y, pred);
      if ((pred >= 0.5) === (y >= 0.5)) correct += 1;
    }
    return [totalLoss / data.length, (correct / data.length) * 100];
  }

  trainModel(trainData: Sample[], testData: Sample[], epochs = 300): History[] {
    if (trainData.length === 0) throw new Error("training needs at least one sample");
    const history: History[] = [];
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0.0;
      let correct = 0;
      for (const [x, y] of trainData) {
        const pred = this.forward(x, true);
        this.backward(y);
        totalLoss += logLoss(y, pred);
        if ((pred >= 0.5) === (y >= 0.5)) correct += 1;
      }
      const trainLoss = totalLoss / trainData.length;
      const trainAcc = (correct / trainData.length) * 100;
      const [testLoss, testAcc] = this.evaluate(testData);
      history.push([trainLoss, trainAcc, testLoss, testAcc]);
      if (epoch % 75 === 0 || epoch === epochs - 1) {
        const gap = trainAcc - testAcc;
        console.log(
          `    Epoch ${String(epoch).padStart(3)}: train_acc=${fixed(trainAcc, 1)}%, test_acc=${fixed(testAcc, 1)}%, gap=${fixed(gap, 1)}%`,
        );
      }
    }
    return history;
  }
}

function main(): void {
  const rule = "=".repeat(60);

  console.log(rule);
  console.log("STEP 1: Dropout Demonstration");
  console.log(rule);
  const drop = new Dropout(0.5);
  const testInput = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
  random.seed(42);

  drop.training = true;
  console.log(`  Input:          ${floatList(testInput)}`);
  for (let trial = 0; trial < 3; trial++) {
    const output = drop.forward(testInput);
    const active = output.filter((v) => v > 0).length;
    console.log(`  Train pass ${trial + 1}:   ${strList(output, 1)}  (${active}/${testInput.length} active)`);
  }

  drop.training = false;
  const evalOutput = drop.forward(testInput);
  console.log(`  Eval pass:      ${strList(evalOutput, 1)}`);
  console.log(`  Train mean: ~${fixed(mean(testInput), 1)} (scaled by 1/(1-p))`);
  console.log(`  Eval mean:   ${fixed(mean(evalOutput), 1)} (no scaling needed)`);

  console.log("\n" + rule);
  console.log("STEP 2: L2 Regularization");
  console.log(rule);
  const weights = [0.5, -1.2, 3.0, 0.1, -2.5];
  const lambdaVal = 0.01;
  const penalty = l2Regularization(weights, lambdaVal);
  const grads = l2Gradient(weights, lambdaVal);
  console.log(`  Weights: ${floatList(weights)}`);
  console.log(`  Lambda:  ${floatRepr(lambdaVal)}`);
  console.log(`  L2 penalty: ${fixed(penalty, 6)}`);
  console.log(`  L2 grads:   ${strList(grads, 4)}`);
  console.log(`  Largest weight (3.0) gets largest gradient (${fixed(grads[2], 4)})`);

  console.log("\n" + rule);
  console.log("STEP 3: BatchNorm vs LayerNorm vs RMSNorm");
  console.log(rule);
  random.seed(42);
  let batch = Array.from({ length: 8 }, () => Array.from({ length: 4 }, () => random.gauss(5, 2)));
  const sample = batch[0];

  const bn = new BatchNorm(4);
  const bnOut = bn.forward(batch);
  const ln = new LayerNorm(4);
  const lnOut = ln.forward(sample);
  const rn = new RMSNorm(4);
  const rnOut = rn.forward(sample);

  console.log(`  Raw sample: ${strList(sample, 2)}`);
  console.log(`  BatchNorm:  ${strList(bnOut[0], 2)}`);
  console.log(`  LayerNorm:  ${strList(lnOut, 2)}`);
  console.log(`  RMSNorm:    ${strList(rnOut, 2)}`);

  const lnMean = mean(lnOut);
  const lnStd = Math.sqrt(mean(lnOut.map((v) => (v - lnMean) ** 2)));
  const rnMean = mean(rnOut);
  const rnRms = Math.sqrt(mean(rnOut.map((v) => v * v)));
  console.log(`\n  LayerNorm output: mean=${fixed(lnMean, 4)}, std=${fixed(lnStd, 4)}`);
  console.log(`  RMSNorm output:   mean=${fixed(rnMean, 4)}, rms=${fixed(rnRms, 4)}`);
  console.log("  LayerNorm centers to mean=0. RMSNorm normalizes scale only.");

  console.log("\n" + rule);
  console.log("STEP 4: BatchNorm Training vs Eval Mode");
  console.log(rule);
  const bn2 = new BatchNorm(4);
  bn2.training = true;
  for (let step = 0; step < 10; step++) {
    batch = Array.from({ length: 16 }, () => Array.from({ length: 4 }, () => random.gauss(3 + step * 0.1, 1)));
    bn2.forward(batch);
  }

  console.log(`  Running mean after 10 batches: ${strList(bn2.runningMean, 3)}`);
  console.log(`  Running var  after 10 batches: ${strList(bn2.runningVar, 3)}`);

  bn2.training = false;
  const evalOut = bn2.forward([[5.0, 5.0, 5.0, 5.0]]);
  console.log("  Eval mode uses running stats, not batch stats");
  console.log(`  Input [5,5,5,5] -> ${strList(evalOut[0], 3)}`);

  console.log("\n" + rule);
  console.log("STEP 5: Training With vs Without Regularization");
  console.log(rule);
  const allData = makeCircleData(300, 42);
  const trainData = allData.slice(0, 150);
  const testData = allData.slice(150);

  const configs: [string, number, number][] = [
    ["No regularization", 0.0, 0.0],
    ["Dropout p=0.3", 0.3, 0.0],
    ["Weight decay 0.01", 0.0, 0.01],
    ["Dropout + weight decay", 0.3, 0.01],
  ];

  const results = new Map<string, History[]>();
  for (const [name, dropP, wd] of configs) {
    console.log(`\n--- ${name} ---`);
    const net = new RegularizedNetwork(16, 0.05, dropP, wd);
    results.set(name, net.trainModel(trainData, testData, 300));
  }

  console.log("\n" + rule);
  console.log("FINAL COMPARISON");
  console.log(rule);
  console.log(`  ${"Config".padEnd(30)} ${"Train Acc".padStart(10)} ${"Test Acc".padStart(10)} ${"Gap".padStart(8)}`);
  console.log("  " + "-".repeat(60));
  for (const [name, history] of results) {
    const [, trainAcc, , testAcc] = history[history.length - 1];
    const gap = trainAcc - testAcc;
    console.log(
      `  ${name.padEnd(30)} ${fixed(trainAcc, 1).padStart(9)}% ${fixed(testAcc, 1).padStart(9)}% ${fixed(gap, 1).padStart(7)}%`,
    );
  }

  console.log("\n  Key insight: regularization reduces the train-test gap.");
  console.log("  Too much regularization also lowers test accuracy.");
  console.log("  Compare the gap and the test accuracy, not only one of them.");
}

main();
