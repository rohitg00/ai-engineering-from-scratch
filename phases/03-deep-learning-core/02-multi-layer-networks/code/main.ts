// Lesson: Multi-Layer Networks (phase 03 / lesson 02)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/03-deep-learning-core/02-multi-layer-networks/docs/en.md
// Run: npx tsx phases/03-deep-learning-core/02-multi-layer-networks/code/main.ts

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

function sigmoid(x: number): number {
  const clipped = Math.max(-500, Math.min(500, x));
  return 1 / (1 + Math.exp(-clipped));
}

class Layer {
  weights: number[][];
  biases: number[];
  lastInput: number[] = [];
  lastOutput: number[] = [];

  constructor(nInputs: number, nNeurons: number, weights?: number[][], biases?: number[]) {
    if (weights !== undefined) {
      this.weights = weights;
    } else {
      this.weights = [];
      for (let n = 0; n < nNeurons; n++) {
        const row: number[] = [];
        for (let i = 0; i < nInputs; i++) row.push(uniform(-1, 1));
        this.weights.push(row);
      }
    }
    this.biases = biases !== undefined ? biases : new Array<number>(nNeurons).fill(0);
    if (this.biases.length !== this.weights.length) {
      throw new Error(`layer has ${this.weights.length} weight rows but ${this.biases.length} biases`);
    }
  }

  forward(inputs: number[]): number[] {
    this.lastInput = inputs;
    this.lastOutput = [];
    for (let neuron = 0; neuron < this.weights.length; neuron++) {
      const row = this.weights[neuron];
      if (row.length !== inputs.length) {
        throw new Error(`neuron ${neuron} expects ${row.length} inputs, got ${inputs.length}`);
      }
      let z = 0;
      for (let i = 0; i < row.length; i++) z += row[i] * inputs[i];
      z += this.biases[neuron];
      this.lastOutput.push(sigmoid(z));
    }
    return this.lastOutput;
  }
}

class Network {
  layers: Layer[];

  constructor(layers: Layer[]) {
    this.layers = layers;
  }

  forward(inputs: number[]): number[] {
    let current = inputs;
    for (const layer of this.layers) current = layer.forward(current);
    return current;
  }

  countParameters(): number {
    let total = 0;
    for (const layer of this.layers) {
      for (const row of layer.weights) total += row.length;
      total += layer.biases.length;
    }
    return total;
  }
}

function fmtList(values: number[]): string {
  return `[${values.join(", ")}]`;
}

function banner(title: string): void {
  console.log("=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

function main(): void {
  banner("DEMO 1: XOR with hand-tuned 2-2-1 network");

  const hidden = new Layer(2, 2, [[20, 20], [-20, -20]], [-10, 30]);
  const output = new Layer(2, 1, [[20, 20]], [-30]);
  const xorNet = new Network([hidden, output]);

  const xorData: [number[], number][] = [
    [[0, 0], 0],
    [[0, 1], 1],
    [[1, 0], 1],
    [[1, 1], 0],
  ];

  let allCorrect = true;
  for (const [inputs, expected] of xorData) {
    const result = xorNet.forward(inputs);
    const predicted = result[0] >= 0.5 ? 1 : 0;
    const status = predicted === expected ? "OK" : "WRONG";
    if (predicted !== expected) allCorrect = false;
    console.log(`  ${fmtList(inputs)} -> ${result[0].toFixed(6)} (rounded: ${predicted}, expected: ${expected}) ${status}`);
  }

  console.log(`\nXOR solved: ${allCorrect ? "True" : "False"}`);
  console.log(`Parameters: ${xorNet.countParameters()}`);

  console.log();
  banner("DEMO 2: Circle classification with 2-8-1 network");

  seed(42);
  const data: [number[], number][] = [];
  for (let i = 0; i < 200; i++) {
    const x = uniform(-1, 1);
    const y = uniform(-1, 1);
    const label = x * x + y * y < 0.25 ? 1 : 0;
    data.push([[x, y], label]);
  }

  const insideCount = data.filter(([, label]) => label === 1).length;
  const outsideCount = data.length - insideCount;
  console.log(`  Dataset: ${data.length} points (${insideCount} inside, ${outsideCount} outside)`);

  seed(4);
  const circleNet = new Network([new Layer(2, 8), new Layer(8, 1)]);

  let correct = 0;
  for (const [inputs, expected] of data) {
    const result = circleNet.forward(inputs);
    const predicted = result[0] >= 0.5 ? 1 : 0;
    if (predicted === expected) correct++;
  }

  console.log(`  Accuracy with random weights: ${correct}/${data.length} (${((100 * correct) / data.length).toFixed(1)}%)`);
  console.log(`  Parameters: ${circleNet.countParameters()}`);
  console.log("  (Random weights give poor accuracy -- training needed)");

  console.log();
  banner("DEMO 3: Forward pass internals on XOR");

  for (const [inputs, expected] of xorData) {
    xorNet.forward(inputs);
    const h = xorNet.layers[0].lastOutput;
    const o = xorNet.layers[1].lastOutput;
    console.log(`  Input: ${fmtList(inputs)}`);
    console.log(`    Hidden: [${h[0].toFixed(6)}, ${h[1].toFixed(6)}]`);
    console.log(`    Output: ${o[0].toFixed(6)} -> ${o[0] >= 0.5 ? "1" : "0"} (expected: ${expected})`);
  }

  console.log();
  banner("DEMO 4: Parameter count for classic architectures");

  const architectures: [string, number[]][] = [
    ["2-3-1 (this lesson)", [2, 3, 1]],
    ["2-8-1 (circle)", [2, 8, 1]],
    ["784-256-128-10 (MNIST)", [784, 256, 128, 10]],
    ["784-512-256-128-10 (deep MNIST)", [784, 512, 256, 128, 10]],
  ];

  for (const [name, sizes] of architectures) {
    const layers: Layer[] = [];
    for (let i = 1; i < sizes.length; i++) layers.push(new Layer(sizes[i - 1], sizes[i]));
    const net = new Network(layers);
    console.log(`  ${name}: ${net.countParameters().toLocaleString("en-US")} parameters`);
  }
}

main();
