// Lesson: Loss Functions (phase 03 / lesson 05)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/03-deep-learning-core/05-loss-functions/docs/en.md
// Run: npx tsx phases/03-deep-learning-core/05-loss-functions/code/main.ts

import { strict as assert } from "node:assert";

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

const pyFloat = (x: number): string => (Number.isInteger(x) ? x.toFixed(1) : String(x));
const pyList = (xs: number[]): string => `[${xs.map(pyFloat).join(", ")}]`;
const strList = (xs: number[], digits: number): string => `[${xs.map((x) => `'${x.toFixed(digits)}'`).join(", ")}]`;
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

function sameLength(predictions: number[], targets: number[]): void {
  assert.equal(predictions.length, targets.length, "predictions and targets must have the same length");
}

function mse(predictions: number[], targets: number[]): number {
  sameLength(predictions, targets);
  return sum(predictions.map((p, i) => (p - targets[i]) ** 2)) / predictions.length;
}

function mseGradient(predictions: number[], targets: number[]): number[] {
  sameLength(predictions, targets);
  return predictions.map((p, i) => (2.0 * (p - targets[i])) / predictions.length);
}

const clip = (p: number, eps: number): number => Math.max(eps, Math.min(1 - eps, p));

function binaryCrossEntropy(predictions: number[], targets: number[], eps = 1e-15): number {
  sameLength(predictions, targets);
  let total = 0.0;
  predictions.forEach((p, i) => {
    const pc = clip(p, eps);
    const t = targets[i];
    total += -(t * Math.log(pc) + (1 - t) * Math.log(1 - pc));
  });
  return total / predictions.length;
}

function bceGradient(predictions: number[], targets: number[], eps = 1e-15): number[] {
  sameLength(predictions, targets);
  return predictions.map((p, i) => {
    const pc = clip(p, eps);
    const t = targets[i];
    return (-(t / pc) + (1 - t) / (1 - pc)) / predictions.length;
  });
}

function softmax(logits: number[]): number[] {
  const maxVal = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - maxVal));
  const total = sum(exps);
  return exps.map((e) => e / total);
}

function categoricalCrossEntropy(logits: number[], targetIndex: number, eps = 1e-15): number {
  return -Math.log(Math.max(eps, softmax(logits)[targetIndex]));
}

function cceGradient(logits: number[], targetIndex: number): number[] {
  const grads = [...softmax(logits)];
  grads[targetIndex] -= 1.0;
  return grads;
}

function labelSmoothedCce(logits: number[], targetIndex: number, numClasses: number, alpha = 0.1, eps = 1e-15): number {
  const probs = softmax(logits);
  let loss = 0.0;
  for (let i = 0; i < numClasses; i++) {
    const smoothTarget = i === targetIndex ? 1.0 - alpha + alpha / numClasses : alpha / numClasses;
    loss += -smoothTarget * Math.log(Math.max(eps, probs[i]));
  }
  return loss;
}

function cosineSimilarity(a: number[], b: number[]): number {
  assert.equal(a.length, b.length, "vectors must have the same length");
  const dot = sum(a.map((x, i) => x * b[i]));
  const normA = Math.sqrt(sum(a.map((x) => x * x)));
  const normB = Math.sqrt(sum(b.map((x) => x * x)));
  if (normA < 1e-10 || normB < 1e-10) return 0.0;
  return dot / (normA * normB);
}

function contrastiveLoss(anchor: number[], positive: number[], negatives: number[][], temperature = 0.07): number {
  const simPos = cosineSimilarity(anchor, positive) / temperature;
  const simNegs = negatives.map((neg) => cosineSimilarity(anchor, neg) / temperature);
  const maxSim = simNegs.length > 0 ? Math.max(simPos, Math.max(...simNegs)) : simPos;
  const expPos = Math.exp(simPos - maxSim);
  const totalExp = expPos + sum(simNegs.map((s) => Math.exp(s - maxSim)));
  return -Math.log(Math.max(1e-15, expPos / totalExp));
}

function sigmoid(x: number): number {
  return 1.0 / (1.0 + Math.exp(-Math.max(-500, Math.min(500, x))));
}

type Sample = [number[], number];

function makeCircleData(n = 200, seedValue = 42): Sample[] {
  seed(seedValue);
  const data: Sample[] = [];
  for (let i = 0; i < n; i++) {
    const x = uniform(-2, 2);
    const y = uniform(-2, 2);
    data.push([[x, y], x * x + y * y < 1.5 ? 1.0 : 0.0]);
  }
  return data;
}

class LossComparisonNetwork {
  w1: number[][];
  b1: number[];
  w2: number[];
  b2 = 0.0;
  x: number[] = [];
  z1: number[] = [];
  h: number[] = [];
  out = 0;

  constructor(
    readonly lossType = "bce",
    readonly hiddenSize = 8,
    readonly lr = 0.1,
  ) {
    seed(0);
    this.w1 = Array.from({ length: hiddenSize }, () => [gauss(0, 0.5), gauss(0, 0.5)]);
    this.b1 = new Array<number>(hiddenSize).fill(0.0);
    this.w2 = Array.from({ length: hiddenSize }, () => gauss(0, 0.5));
  }

  forward(x: number[]): number {
    this.x = x;
    this.z1 = this.w1.map((w, i) => w[0] * x[0] + w[1] * x[1] + this.b1[i]);
    this.h = this.z1.map((z) => Math.max(0.0, z));
    let z2 = this.b2;
    for (let i = 0; i < this.hiddenSize; i++) z2 += this.w2[i] * this.h[i];
    this.out = sigmoid(z2);
    return this.out;
  }

  backward(target: number): void {
    let dLoss: number;
    if (this.lossType === "mse") {
      dLoss = 2.0 * (this.out - target);
    } else {
      const p = clip(this.out, 1e-15);
      dLoss = -(target / p) + (1 - target) / (1 - p);
    }
    const dOut = dLoss * this.out * (1 - this.out);
    for (let i = 0; i < this.hiddenSize; i++) {
      const dH = dOut * this.w2[i] * (this.z1[i] > 0 ? 1.0 : 0.0);
      this.w2[i] -= this.lr * dOut * this.h[i];
      for (let j = 0; j < 2; j++) this.w1[i][j] -= this.lr * dH * this.x[j];
      this.b1[i] -= this.lr * dH;
    }
    this.b2 -= this.lr * dOut;
  }

  computeLoss(pred: number, target: number): number {
    if (this.lossType === "mse") return (pred - target) ** 2;
    const p = clip(pred, 1e-15);
    return -(target * Math.log(p) + (1 - target) * Math.log(1 - p));
  }

  train(data: Sample[], epochs = 200): [number, number][] {
    const losses: [number, number][] = [];
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0.0;
      let correct = 0;
      for (const [x, y] of data) {
        const pred = this.forward(x);
        this.backward(y);
        totalLoss += this.computeLoss(pred, y);
        if (pred >= 0.5 === y >= 0.5) correct += 1;
      }
      const avgLoss = totalLoss / data.length;
      const accuracy = (correct / data.length) * 100;
      losses.push([avgLoss, accuracy]);
      if (epoch % 50 === 0 || epoch === epochs - 1) {
        console.log(`    Epoch ${String(epoch).padStart(3)}: loss=${avgLoss.toFixed(4)}, accuracy=${accuracy.toFixed(1)}%`);
      }
    }
    return losses;
  }
}

function banner(title: string): void {
  console.log("=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

function main(): void {
  banner("STEP 1: MSE Loss");
  const preds = [0.9, 0.1, 0.7, 0.4];
  const targets = [1.0, 0.0, 1.0, 0.0];
  console.log(`  Predictions: ${pyList(preds)}`);
  console.log(`  Targets:     ${pyList(targets)}`);
  console.log(`  MSE Loss:    ${mse(preds, targets).toFixed(6)}`);
  console.log(`  MSE Grads:   ${strList(mseGradient(preds, targets), 4)}`);

  console.log();
  banner("STEP 2: Binary Cross-Entropy");
  console.log(`  Predictions: ${pyList(preds)}`);
  console.log(`  Targets:     ${pyList(targets)}`);
  console.log(`  BCE Loss:    ${binaryCrossEntropy(preds, targets).toFixed(6)}`);
  console.log(`  BCE Grads:   ${strList(bceGradient(preds, targets), 4)}`);

  console.log("\n  CE loss at different confidence levels (true label = 1):");
  for (const conf of [0.01, 0.1, 0.5, 0.9, 0.99]) {
    const ce = -(1.0 * Math.log(Math.max(1e-15, conf)));
    const ms = (conf - 1.0) ** 2;
    console.log(`    p=${conf.toFixed(2)}: CE=${ce.toFixed(4)}, MSE=${ms.toFixed(4)}, ratio=${(ce / Math.max(0.0001, ms)).toFixed(1)}x`);
  }

  console.log();
  banner("STEP 3: Categorical Cross-Entropy + Softmax");
  const logits = [2.0, 1.0, 0.1, -1.0, 3.0];
  const targetIdx = 4;
  console.log(`  Logits:  ${pyList(logits)}`);
  console.log(`  Softmax: ${strList(softmax(logits), 4)}`);
  console.log(`  Target class: ${targetIdx}`);
  console.log(`  CCE Loss: ${categoricalCrossEntropy(logits, targetIdx).toFixed(6)}`);
  console.log(`  Gradient: ${strList(cceGradient(logits, targetIdx), 4)}`);

  console.log();
  banner("STEP 4: Label Smoothing");
  const hardLoss = categoricalCrossEntropy(logits, targetIdx);
  const smoothLoss = labelSmoothedCce(logits, targetIdx, 5, 0.1);
  console.log(`  Hard target loss:    ${hardLoss.toFixed(6)}`);
  console.log(`  Smooth target loss:  ${smoothLoss.toFixed(6)}`);
  console.log(`  Smoothing increases loss by ${(smoothLoss - hardLoss).toFixed(6)}`);
  console.log("  This prevents overconfidence by targeting 0.9 instead of 1.0");

  console.log();
  banner("STEP 5: Contrastive Loss");
  seed(42);
  const anchor = Array.from({ length: 8 }, () => gauss(0, 1));
  const positive = anchor.map((a) => a + gauss(0, 0.1));
  const negatives = Array.from({ length: 7 }, () => Array.from({ length: 8 }, () => gauss(0, 1)));
  const lossVal = contrastiveLoss(anchor, positive, negatives, 0.07);
  console.log(`  Anchor-positive similarity: ${cosineSimilarity(anchor, positive).toFixed(4)}`);
  console.log(`  Anchor-negative similarities: ${strList(negatives.map((neg) => cosineSimilarity(anchor, neg)), 4)}`);
  console.log(`  Contrastive loss (tau=0.07): ${lossVal.toFixed(4)}`);
  console.log(`  Contrastive loss (tau=0.5):  ${contrastiveLoss(anchor, positive, negatives, 0.5).toFixed(4)}`);
  console.log("  Lower temperature = sharper = higher loss for imperfect separation");

  console.log();
  banner("STEP 6: MSE vs Cross-Entropy on Classification");
  const data = makeCircleData();
  for (const lossType of ["mse", "bce"]) {
    console.log(`\n--- Training with ${lossType.toUpperCase()} ---`);
    const net = new LossComparisonNetwork(lossType, 8, 0.1);
    const results = net.train(data, 200);
    const [finalLoss, finalAcc] = results[results.length - 1];
    console.log(`  Final: loss=${finalLoss.toFixed(4)}, accuracy=${finalAcc.toFixed(1)}%`);
  }

  console.log("\n=== Key Takeaway ===");
  console.log("  Cross-entropy converges faster on classification because its");
  console.log("  gradient is strong when predictions are wrong and weak when correct.");
  console.log("  MSE gradient flattens near 0 and 1 due to sigmoid saturation.");
}

if (require.main === module) {
  main();
}
