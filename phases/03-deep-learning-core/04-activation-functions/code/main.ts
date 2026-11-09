// Lesson: Activation Functions (phase 03 / lesson 04)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/03-deep-learning-core/04-activation-functions/docs/en.md
// Run: npx tsx phases/03-deep-learning-core/04-activation-functions/code/main.ts

type Random = () => number;
type Fn = (x: number) => number;

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

function erf(x: number): number {
  if (Math.abs(x) >= 6) return Math.sign(x);
  let term = x;
  let sum = x;
  for (let n = 1; n < 200; n++) {
    term *= (-x * x) / n;
    const add = term / (2 * n + 1);
    sum += add;
    if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
  }
  return (2 / Math.sqrt(Math.PI)) * sum;
}

function pyList(xs: number[]): string {
  return `[${xs.map((x) => (Number.isInteger(x) ? x.toFixed(1) : String(x))).join(", ")}]`;
}

function sigmoid(x: number): number {
  return 1.0 / (1.0 + Math.exp(-Math.max(-500, Math.min(500, x))));
}

function sigmoidDerivative(x: number): number {
  const s = sigmoid(x);
  return s * (1 - s);
}

const tanhAct: Fn = (x) => Math.tanh(x);

function tanhDerivative(x: number): number {
  const t = Math.tanh(x);
  return 1 - t * t;
}

const relu: Fn = (x) => Math.max(0.0, x);
const reluDerivative: Fn = (x) => (x > 0 ? 1.0 : 0.0);
const leakyRelu = (x: number, alpha = 0.01): number => (x > 0 ? x : alpha * x);
const leakyReluDerivative = (x: number, alpha = 0.01): number => (x > 0 ? 1.0 : alpha);

function gelu(x: number): number {
  return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)));
}

function geluDerivative(x: number): number {
  const phi = 0.5 * (1 + erf(x / Math.SQRT2));
  const pdf = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  return phi + x * pdf;
}

const swish: Fn = (x) => x * sigmoid(x);

function swishDerivative(x: number): number {
  const s = sigmoid(x);
  return s + x * s * (1 - s);
}

function softmax(xs: number[]): number[] {
  const maxX = Math.max(...xs);
  const exps = xs.map((x) => Math.exp(x - maxX));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

function gradientScan(name: string, derivativeFn: Fn, start = -5, end = 5, n = 100): void {
  const step = (end - start) / n;
  let nearZero = 0;
  let healthy = 0;
  for (let i = 0; i < n; i++) {
    if (Math.abs(derivativeFn(start + i * step)) < 0.01) nearZero += 1;
    else healthy += 1;
  }
  const pctDead = (nearZero / n) * 100;
  console.log(`${name.padEnd(15)}: ${String(healthy).padStart(3)} healthy, ${String(nearZero).padStart(3)} near-zero (${pctDead.toFixed(0)}% dead zone)`);
}

function vanishingGradientExperiment(activationFn: Fn, name: string, nLayers = 10, nInputs = 5): void {
  seed(42);
  let values = Array.from({ length: nInputs }, () => gauss(0, 1));
  console.log(`\n${name} through ${nLayers} layers:`);
  for (let layer = 0; layer < nLayers; layer++) {
    const weights = Array.from({ length: nInputs }, () => gauss(0, 1));
    const z = weights.reduce((acc, w, i) => acc + w * values[i], 0);
    const activated = activationFn(z);
    const magnitude = Math.abs(activated);
    console.log(`  Layer ${String(layer + 1).padStart(2)}: magnitude = ${magnitude.toFixed(6)} ${"#".repeat(Math.trunc(magnitude * 20))}`);
    values = new Array<number>(nInputs).fill(activated);
  }
}

function deadNeuronDetector(nInputs = 5, hiddenSize = 20, nSamples = 1000): void {
  seed(0);
  const weights = Array.from({ length: hiddenSize }, () => Array.from({ length: nInputs }, () => gauss(0, 1)));
  const biases = Array.from({ length: hiddenSize }, () => gauss(0, 1));
  const fireCounts = new Array<number>(hiddenSize).fill(0);

  for (let s = 0; s < nSamples; s++) {
    const inputs = Array.from({ length: nInputs }, () => gauss(0, 1));
    for (let n = 0; n < hiddenSize; n++) {
      const z = weights[n].reduce((acc, w, i) => acc + w * inputs[i], 0) + biases[n];
      if (relu(z) > 0) fireCounts[n] += 1;
    }
  }

  const dead = fireCounts.filter((c) => c === 0).length;
  const rarelyFire = fireCounts.filter((c) => c > 0 && c < nSamples * 0.05).length;
  const healthy = hiddenSize - dead - rarelyFire;

  console.log(`\nDead Neuron Report (${hiddenSize} neurons, ${nSamples} samples):`);
  console.log(`  Dead (never fired):     ${dead}`);
  console.log(`  Barely alive (<5%):     ${rarelyFire}`);
  console.log(`  Healthy:                ${healthy}`);
  console.log(`  Dead neuron rate:       ${((dead / hiddenSize) * 100).toFixed(1)}%`);

  fireCounts.forEach((c, i) => {
    const status = c === 0 ? "DEAD" : c < nSamples * 0.05 ? "WEAK" : "OK";
    const bar = "#".repeat(Math.floor((c * 40) / nSamples));
    console.log(`  Neuron ${String(i).padStart(2)}: ${String(c).padStart(4)}/${nSamples} fires [${status.padEnd(4)}] ${bar}`);
  });
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

class ActivationNetwork {
  w1: number[][];
  b1: number[];
  w2: number[];
  b2 = 0.0;
  x: number[] = [];
  z1: number[] = [];
  h: number[] = [];
  out = 0;

  constructor(
    readonly act: Fn,
    readonly actD: Fn,
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
    this.h = this.z1.map((z) => this.act(z));
    let z2 = this.b2;
    for (let i = 0; i < this.hiddenSize; i++) z2 += this.w2[i] * this.h[i];
    this.out = sigmoid(z2);
    return this.out;
  }

  backward(target: number): void {
    const dOut = (this.out - target) * this.out * (1 - this.out);
    for (let i = 0; i < this.hiddenSize; i++) {
      const dH = dOut * this.w2[i] * this.actD(this.z1[i]);
      this.w2[i] -= this.lr * dOut * this.h[i];
      for (let j = 0; j < 2; j++) this.w1[i][j] -= this.lr * dH * this.x[j];
      this.b1[i] -= this.lr * dH;
    }
    this.b2 -= this.lr * dOut;
  }

  train(data: Sample[], epochs = 200): number[] {
    const losses: number[] = [];
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;
      let correct = 0;
      for (const [x, y] of data) {
        const pred = this.forward(x);
        this.backward(y);
        totalLoss += (pred - y) ** 2;
        if (pred >= 0.5 === y >= 0.5) correct += 1;
      }
      const avgLoss = totalLoss / data.length;
      const accuracy = (correct / data.length) * 100;
      losses.push(avgLoss);
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
  banner("STEP 1: Activation Function Values");
  for (const x of [-2.0, -1.0, -0.5, 0.0, 0.5, 1.0, 2.0]) {
    console.log(
      `  x=${x.toFixed(1).padStart(5)}  sigmoid=${sigmoid(x).toFixed(4)}  tanh=${tanhAct(x).toFixed(4)}  ` +
        `relu=${relu(x).toFixed(4)}  gelu=${gelu(x).toFixed(4)}  swish=${swish(x).toFixed(4)}`,
    );
  }
  console.log(`\n  softmax([2.0, 1.0, 0.1]) = ${pyList(softmax([2.0, 1.0, 0.1]))}`);
  console.log(`  softmax([10, 10, 10])    = ${pyList(softmax([10.0, 10.0, 10.0]))}`);

  console.log();
  banner("STEP 2: Gradient Dead Zones");
  gradientScan("Sigmoid", sigmoidDerivative);
  gradientScan("Tanh", tanhDerivative);
  gradientScan("ReLU", reluDerivative);
  gradientScan("Leaky ReLU", (x) => leakyReluDerivative(x));
  gradientScan("GELU", geluDerivative);
  gradientScan("Swish", swishDerivative);

  console.log();
  banner("STEP 3: Vanishing Gradient Experiment");
  vanishingGradientExperiment(sigmoid, "Sigmoid");
  vanishingGradientExperiment(relu, "ReLU");
  vanishingGradientExperiment(gelu, "GELU");

  console.log();
  banner("STEP 4: Dead Neuron Detection");
  deadNeuronDetector();

  console.log();
  banner("STEP 5: Training Comparison (Circle Dataset)");
  const data = makeCircleData();
  const configs: [string, Fn, Fn][] = [
    ["Sigmoid", sigmoid, sigmoidDerivative],
    ["ReLU", relu, reluDerivative],
    ["GELU", gelu, geluDerivative],
  ];
  const results: [string, number[]][] = [];
  for (const [name, actFn, actDFn] of configs) {
    console.log(`\n--- Training with ${name} ---`);
    const net = new ActivationNetwork(actFn, actDFn, 8, 0.1);
    results.push([name, net.train(data, 200)]);
  }

  console.log("\n=== Final Loss Comparison ===");
  for (const [name, losses] of results) {
    const first = losses[0];
    const last = losses[losses.length - 1];
    const improvement = first > 0 ? (1 - last / first) * 100 : 0;
    console.log(`  ${name.padEnd(10)}: start=${first.toFixed(4)} -> end=${last.toFixed(4)} (improvement: ${improvement.toFixed(1)}%)`);
  }
}

if (require.main === module) {
  main();
}
