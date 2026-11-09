// Lesson: Weight Initialization and Training Stability (phase 03 / lesson 08)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/03-deep-learning-core/08-weight-initialization/docs/en.md
// Run: npx tsx phases/03-deep-learning-core/08-weight-initialization/code/main.ts

type Matrix = number[][];
type InitFn = (fanIn: number, fanOut: number) => Matrix;
type Activation = (x: number) => number;

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
  if (Math.abs(value) >= 1e21) {
    const whole = BigInt(value).toString();
    return digits > 0 ? `${whole}.${"0".repeat(digits)}` : whole;
  }
  return value.toFixed(digits);
}

function clamp(value: number, low: number, high: number): number {
  const upper = high < value ? high : value;
  return low > upper ? low : upper;
}

function checkFans(fanIn: number, fanOut: number): void {
  if (!Number.isInteger(fanIn) || !Number.isInteger(fanOut) || fanIn <= 0 || fanOut <= 0) {
    throw new Error("fan_in and fan_out must be positive integers");
  }
}

function zeroInit(fanIn: number, fanOut: number): Matrix {
  checkFans(fanIn, fanOut);
  return Array.from({ length: fanOut }, () => new Array<number>(fanIn).fill(0.0));
}

function randomInit(fanIn: number, fanOut: number, scale = 1.0): Matrix {
  checkFans(fanIn, fanOut);
  return Array.from({ length: fanOut }, () => Array.from({ length: fanIn }, () => random.gauss(0, scale)));
}

function xavierInit(fanIn: number, fanOut: number): Matrix {
  checkFans(fanIn, fanOut);
  const std = Math.sqrt(2.0 / (fanIn + fanOut));
  return Array.from({ length: fanOut }, () => Array.from({ length: fanIn }, () => random.gauss(0, std)));
}

function kaimingInit(fanIn: number, fanOut: number): Matrix {
  checkFans(fanIn, fanOut);
  const std = Math.sqrt(2.0 / fanIn);
  return Array.from({ length: fanOut }, () => Array.from({ length: fanIn }, () => random.gauss(0, std)));
}

function sigmoid(x: number): number {
  const z = clamp(x, -500, 500);
  return 1.0 / (1.0 + Math.exp(-z));
}

function tanhAct(x: number): number {
  return Math.tanh(x);
}

function relu(x: number): number {
  return x > 0 ? x : 0.0;
}

function forwardDeep(initFn: InitFn, activationFn: Activation, nLayers = 50, width = 64, nSamples = 100): number[] {
  if (nLayers <= 0 || width <= 0 || nSamples <= 0) throw new Error("layers, width and samples must be positive");
  random.seed(42);
  const layerMagnitudes: number[] = [];

  let inputs = Array.from({ length: nSamples }, () => Array.from({ length: width }, () => random.gauss(0, 1)));

  for (let layer = 0; layer < nLayers; layer++) {
    const weights = initFn(width, width);
    const biases = new Array<number>(width).fill(0.0);

    inputs = inputs.map((sample) => {
      const output: number[] = [];
      for (let neuron = 0; neuron < width; neuron++) {
        let z = 0;
        for (let j = 0; j < width; j++) z += weights[neuron][j] * sample[j];
        output.push(activationFn(z + biases[neuron]));
      }
      return output;
    });

    const magnitudes = inputs.map((sample) => sample.reduce((a, v) => a + Math.abs(v), 0) / width);
    layerMagnitudes.push(magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length);
  }

  return layerMagnitudes;
}

function magnitudeReport(name: string, magnitudes: number[]): void {
  console.log(`\n${name}:`);
  magnitudes.forEach((mag, i) => {
    if (i % 5 === 0 || i === magnitudes.length - 1) {
      let bar: string;
      if (mag > 1e6) {
        bar = "X".repeat(50) + " EXPLODED";
      } else if (mag < 1e-6) {
        bar = ". VANISHED";
      } else if (Number.isNaN(mag)) {
        bar = "? NaN";
      } else {
        bar = "#".repeat(Math.min(50, Math.max(1, Math.trunc(mag * 10))));
      }
      console.log(`  Layer ${String(i + 1).padStart(3)}: ${bar} (${fixed(mag, 6)})`);
    }
  });
}

function symmetryDemo(): void {
  const weights = zeroInit(2, 4);
  const biases = new Array<number>(4).fill(0.0);

  const inputs = [0.5, -0.3];
  const outputs: number[] = [];
  for (let neuron = 0; neuron < 4; neuron++) {
    let z = 0;
    for (let j = 0; j < 2; j++) z += weights[neuron][j] * inputs[j];
    outputs.push(sigmoid(z + biases[neuron]));
  }

  console.log("Symmetry Demo (4 neurons, zero init):");
  outputs.forEach((out, i) => console.log(`  Neuron ${i}: output = ${fixed(out, 6)}`));
  const allSame = outputs.every((out) => Math.abs(out - outputs[0]) < 1e-10);
  console.log(`  All identical: ${allSame ? "True" : "False"}`);
  console.log(`  Effective parameters: 1 (not ${weights.length * weights[0].length})`);
}

function varianceAnalysis(): void {
  const fanIn = 64;
  const nTrials = 10000;

  const configs: [string, number][] = [
    ["Random N(0,1)", 1.0],
    ["Random N(0,0.01)", 0.01],
    ["Xavier std", Math.sqrt(2.0 / (fanIn + fanIn))],
    ["Kaiming std", Math.sqrt(2.0 / fanIn)],
  ];

  console.log("\nVariance Analysis (fan_in=64, single layer):");
  console.log(
    `  ${"Strategy".padEnd(25)} ${"Weight Var".padStart(12)} ${"Output Var".padStart(12)} ${"Ratio".padStart(10)}`,
  );
  console.log("  " + "-".repeat(60));

  for (const [name, std] of configs) {
    random.seed(42);
    let totalSquares = 0;
    for (let trial = 0; trial < nTrials; trial++) {
      const inputs = Array.from({ length: fanIn }, () => random.gauss(0, 1));
      const weights = Array.from({ length: fanIn }, () => random.gauss(0, std));
      let z = 0;
      for (let k = 0; k < fanIn; k++) z += weights[k] * inputs[k];
      totalSquares += z * z;
    }

    const meanOutputVar = totalSquares / nTrials;
    const weightVar = std * std;
    const ratio = meanOutputVar;
    console.log(
      `  ${name.padEnd(25)} ${fixed(weightVar, 6).padStart(12)} ${fixed(meanOutputVar, 4).padStart(12)} ${fixed(ratio, 4).padStart(10)}`,
    );
  }
}

function runExperiment(): Map<string, number[]> {
  const configs: [string, InitFn, Activation][] = [
    ["Zero + Sigmoid", (fi, fo) => zeroInit(fi, fo), sigmoid],
    ["Random N(0,1) + ReLU", (fi, fo) => randomInit(fi, fo, 1.0), relu],
    ["Random N(0,0.01) + ReLU", (fi, fo) => randomInit(fi, fo, 0.01), relu],
    ["Xavier + Sigmoid", xavierInit, sigmoid],
    ["Xavier + Tanh", xavierInit, tanhAct],
    ["Kaiming + ReLU", kaimingInit, relu],
  ];

  const header = ["L1", "L5", "L10", "L25", "L50"].map((h) => h.padStart(10)).join(" ");
  console.log(`\n${"Strategy".padEnd(30)} ${header}`);
  console.log("-".repeat(80));

  const allResults = new Map<string, number[]>();
  for (const [name, initFn, actFn] of configs) {
    const mags = forwardDeep(initFn, actFn);
    allResults.set(name, mags);
    let row = name.padEnd(30);
    for (const idx of [0, 4, 9, 24, 49]) {
      const val = mags[idx];
      if (val > 1e6) {
        row += ` ${"EXPLODED".padStart(10)}`;
      } else if (val < 1e-6) {
        row += ` ${"VANISHED".padStart(10)}`;
      } else {
        row += ` ${fixed(val, 4).padStart(10)}`;
      }
    }
    console.log(row);
  }

  return allResults;
}

function trainingComparison(): void {
  random.seed(42);
  const data: [number[], number][] = [];
  for (let i = 0; i < 200; i++) {
    const x = random.uniform(-2, 2);
    const y = random.uniform(-2, 2);
    const label = x * x + y * y < 1.5 ? 1.0 : 0.0;
    data.push([[x, y], label]);
  }

  function trainWithInit(initName: string, initScale: number, activationFn: Activation, activationDeriv: Activation): number[] {
    random.seed(0);
    const hiddenSize = 8;
    const lr = 0.1;

    let stdW1: number;
    let stdW2: number;
    if (initName === "xavier") {
      stdW1 = Math.sqrt(2.0 / (2 + hiddenSize));
      stdW2 = Math.sqrt(2.0 / (hiddenSize + 1));
    } else if (initName === "kaiming") {
      stdW1 = Math.sqrt(2.0 / 2);
      stdW2 = Math.sqrt(2.0 / hiddenSize);
    } else {
      stdW1 = initScale;
      stdW2 = initScale;
    }

    const w1 = Array.from({ length: hiddenSize }, () => [random.gauss(0, stdW1), random.gauss(0, stdW1)]);
    const b1 = new Array<number>(hiddenSize).fill(0.0);
    const w2 = Array.from({ length: hiddenSize }, () => random.gauss(0, stdW2));
    let b2 = 0.0;

    const losses: number[] = [];
    for (let epoch = 0; epoch < 300; epoch++) {
      let totalLoss = 0;
      for (const [x, target] of data) {
        const z1: number[] = [];
        const h: number[] = [];
        for (let i = 0; i < hiddenSize; i++) {
          const z = w1[i][0] * x[0] + w1[i][1] * x[1] + b1[i];
          z1.push(z);
          h.push(activationFn(z));
        }

        let z2 = 0;
        for (let i = 0; i < hiddenSize; i++) z2 += w2[i] * h[i];
        const out = sigmoid(z2 + b2);

        const error = out - target;
        const dOut = error * out * (1 - out);

        for (let i = 0; i < hiddenSize; i++) {
          const dH = dOut * w2[i] * activationDeriv(z1[i]);
          w2[i] -= lr * dOut * h[i];
          for (let j = 0; j < 2; j++) w1[i][j] -= lr * dH * x[j];
          b1[i] -= lr * dH;
        }
        b2 -= lr * dOut;

        totalLoss += (out - target) ** 2;
      }
      losses.push(totalLoss / data.length);
    }

    return losses;
  }

  const sigmoidD = (x: number): number => {
    const s = sigmoid(x);
    return s * (1 - s);
  };
  const reluD = (x: number): number => (x > 0 ? 1.0 : 0.0);

  const configs: [string, string, number, Activation, Activation][] = [
    ["Random(0.01) + Sigmoid", "random", 0.01, sigmoid, sigmoidD],
    ["Random(1.0) + Sigmoid", "random", 1.0, sigmoid, sigmoidD],
    ["Xavier + Sigmoid", "xavier", 0, sigmoid, sigmoidD],
    ["Random(0.01) + ReLU", "random", 0.01, relu, reluD],
    ["Random(1.0) + ReLU", "random", 1.0, relu, reluD],
    ["Kaiming + ReLU", "kaiming", 0, relu, reluD],
  ];

  console.log("\nTraining Comparison (300 epochs, circle dataset):");
  console.log(
    `  ${"Config".padEnd(30)} ${"Start Loss".padStart(12)} ${"End Loss".padStart(12)} ${"Improvement".padStart(12)}`,
  );
  console.log("  " + "-".repeat(66));

  for (const [name, initName, scale, actFn, actDFn] of configs) {
    const losses = trainWithInit(initName, scale, actFn, actDFn);
    const start = losses[0];
    const end = losses[losses.length - 1];
    const improvement = start > 0 ? (1 - end / start) * 100 : 0;
    console.log(
      `  ${name.padEnd(30)} ${fixed(start, 6).padStart(12)} ${fixed(end, 6).padStart(12)} ${fixed(improvement, 1).padStart(11)}%`,
    );
  }
}

function main(): void {
  const rule = "=".repeat(70);

  console.log(rule);
  console.log("STEP 1: Symmetry Problem -- Zero Init");
  console.log(rule);
  symmetryDemo();

  console.log("\n" + rule);
  console.log("STEP 2: Variance Analysis");
  console.log(rule);
  varianceAnalysis();

  console.log("\n" + rule);
  console.log("STEP 3: 50-Layer Forward Pass Experiment");
  console.log(rule);
  const allResults = runExperiment();

  console.log("\n" + rule);
  console.log("STEP 4: Layer-by-Layer Magnitude Reports");
  console.log(rule);
  for (const [name, mags] of allResults) magnitudeReport(name, mags);

  console.log("\n" + rule);
  console.log("STEP 5: Training Comparison");
  console.log(rule);
  trainingComparison();
}

main();
