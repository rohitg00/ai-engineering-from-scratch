// Lesson: The Perceptron (phase 03 / lesson 01)
// TypeScript port of code/perceptron.py. Node standard library only.
// Source: phases/03-deep-learning-core/01-the-perceptron/docs/en.md
// Run: npx tsx phases/03-deep-learning-core/01-the-perceptron/code/perceptron.ts

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

type Sample = [number[], number];

function pyFloat(x: number): string {
  if (Object.is(x, -0)) return "-0.0";
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function pyIntList(xs: number[]): string {
  return `[${xs.join(", ")}]`;
}

class Perceptron {
  weights: number[];
  bias = 0.0;
  lr: number;

  constructor(nInputs: number, learningRate = 0.1) {
    this.weights = new Array<number>(nInputs).fill(0.0);
    this.lr = learningRate;
  }

  predict(inputs: number[]): number {
    let total = 0;
    for (let i = 0; i < this.weights.length; i++) total += this.weights[i] * inputs[i];
    total += this.bias;
    return total >= 0 ? 1 : 0;
  }

  train(trainingData: Sample[], epochs = 100): void {
    for (let epoch = 0; epoch < epochs; epoch++) {
      let errors = 0;
      for (const [inputs, target] of trainingData) {
        const error = target - this.predict(inputs);
        if (error !== 0) {
          errors += 1;
          for (let i = 0; i < this.weights.length; i++) this.weights[i] += this.lr * error * inputs[i];
          this.bias += this.lr * error;
        }
      }
      if (errors === 0) {
        console.log(`Converged at epoch ${epoch + 1}`);
        return;
      }
    }
    console.log(`Did not converge after ${epochs} epochs`);
  }
}

function testGate(name: string, nInputs: number, data: Sample[]): void {
  console.log(`=== ${name} ===`);
  const p = new Perceptron(nInputs);
  p.train(data);
  console.log(`  Weights: [${p.weights.map(pyFloat).join(", ")}], Bias: ${pyFloat(p.bias)}`);
  for (const [inputs, expected] of data) {
    const result = p.predict(inputs);
    const status = result === expected ? "OK" : "WRONG";
    console.log(`  ${pyIntList(inputs)} -> ${result} (expected ${expected}) ${status}`);
  }
  console.log();
}

const andData: Sample[] = [[[0, 0], 0], [[0, 1], 0], [[1, 0], 0], [[1, 1], 1]];
const orData: Sample[] = [[[0, 0], 0], [[0, 1], 1], [[1, 0], 1], [[1, 1], 1]];
const notData: Sample[] = [[[0], 1], [[1], 0]];
const xorData: Sample[] = [[[0, 0], 0], [[0, 1], 1], [[1, 0], 1], [[1, 1], 0]];

testGate("AND Gate", 2, andData);
testGate("OR Gate", 2, orData);
testGate("NOT Gate", 1, notData);

console.log("=== XOR Gate (single perceptron - will fail) ===");
const pXor = new Perceptron(2);
pXor.train(xorData, 1000);
for (const [inputs, expected] of xorData) {
  const result = pXor.predict(inputs);
  console.log(`  ${pyIntList(inputs)} -> ${result} (expected ${expected}) ${result === expected ? "OK" : "WRONG"}`);
}
console.log();

function xorNetwork(x1: number, x2: number): number {
  const orNeuron = new Perceptron(2);
  orNeuron.weights = [1.0, 1.0];
  orNeuron.bias = -0.5;

  const nandNeuron = new Perceptron(2);
  nandNeuron.weights = [-1.0, -1.0];
  nandNeuron.bias = 1.5;

  const andNeuron = new Perceptron(2);
  andNeuron.weights = [1.0, 1.0];
  andNeuron.bias = -1.5;

  const hidden1 = orNeuron.predict([x1, x2]);
  const hidden2 = nandNeuron.predict([x1, x2]);
  return andNeuron.predict([hidden1, hidden2]);
}

console.log("=== XOR Gate (multi-layer network - works) ===");
for (const [inputs, expected] of xorData) {
  const result = xorNetwork(inputs[0], inputs[1]);
  console.log(`  ${pyIntList(inputs)} -> ${result} (expected ${expected}) ${result === expected ? "OK" : "WRONG"}`);
}
console.log();

class TwoLayerNetwork {
  wHidden: number[][];
  bHidden: number[];
  wOutput: number[];
  bOutput: number;
  lr: number;
  hiddenOutputs: number[] = [];
  output = 0;

  constructor(learningRate = 0.5) {
    const rng = mulberry32(0);
    const uniform = (): number => -1 + 2 * rng();
    this.wHidden = [0, 1].map(() => [uniform(), uniform()]);
    this.bHidden = [uniform(), uniform()];
    this.wOutput = [uniform(), uniform()];
    this.bOutput = uniform();
    this.lr = learningRate;
  }

  sigmoid(x: number): number {
    return 1.0 / (1.0 + Math.exp(-Math.max(-500, Math.min(500, x))));
  }

  forward(inputs: number[]): number {
    this.hiddenOutputs = [];
    for (let i = 0; i < 2; i++) {
      let z = this.bHidden[i];
      for (let j = 0; j < inputs.length; j++) z += this.wHidden[i][j] * inputs[j];
      this.hiddenOutputs.push(this.sigmoid(z));
    }
    let zOut = this.bOutput;
    for (let i = 0; i < 2; i++) zOut += this.wOutput[i] * this.hiddenOutputs[i];
    this.output = this.sigmoid(zOut);
    return this.output;
  }

  train(trainingData: Sample[], epochs = 10000): void {
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalError = 0;
      for (const [inputs, target] of trainingData) {
        const output = this.forward(inputs);
        const error = target - output;
        totalError += error ** 2;
        const dOutput = error * output * (1 - output);
        const savedWOutput = [...this.wOutput];
        const hiddenDeltas = this.hiddenOutputs.map((h, i) => dOutput * savedWOutput[i] * h * (1 - h));
        for (let i = 0; i < 2; i++) this.wOutput[i] += this.lr * dOutput * this.hiddenOutputs[i];
        this.bOutput += this.lr * dOutput;
        for (let i = 0; i < 2; i++) {
          for (let j = 0; j < inputs.length; j++) this.wHidden[i][j] += this.lr * hiddenDeltas[i] * inputs[j];
          this.bHidden[i] += this.lr * hiddenDeltas[i];
        }
      }
      if (epoch % 2000 === 0) console.log(`  Epoch ${epoch}, error: ${totalError.toFixed(4)}`);
    }
  }
}

console.log("=== XOR Gate (trained 2-layer network with backpropagation) ===");
const net = new TwoLayerNetwork(2.0);
net.train(xorData, 10000);
console.log();
for (const [inputs, expected] of xorData) {
  const result = net.forward(inputs);
  const predicted = result >= 0.5 ? 1 : 0;
  console.log(`  ${pyIntList(inputs)} -> ${result.toFixed(4)} (rounded: ${predicted}, expected ${expected})`);
}
