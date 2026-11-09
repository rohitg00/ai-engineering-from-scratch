// Lesson: Backpropagation from Scratch (phase 03 / lesson 03)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/03-deep-learning-core/03-backpropagation/docs/en.md
// Run: npx tsx phases/03-deep-learning-core/03-backpropagation/code/main.ts

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

function shuffle<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function pyFloat(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function pyList(xs: number[]): string {
  return `[${xs.map(pyFloat).join(", ")}]`;
}

class Value {
  data: number;
  grad = 0.0;
  backwardFn: () => void = () => {};
  children: Set<Value>;
  op: string;

  constructor(data: number, children: Value[] = [], op = "") {
    this.data = data;
    this.children = new Set(children);
    this.op = op;
  }

  toString(): string {
    return `Value(data=${this.data.toFixed(4)}, grad=${this.grad.toFixed(4)})`;
  }

  add(other: Value | number): Value {
    const o = other instanceof Value ? other : new Value(other);
    const out = new Value(this.data + o.data, [this, o], "+");
    out.backwardFn = () => {
      this.grad += out.grad;
      o.grad += out.grad;
    };
    return out;
  }

  mul(other: Value | number): Value {
    const o = other instanceof Value ? other : new Value(other);
    const out = new Value(this.data * o.data, [this, o], "*");
    out.backwardFn = () => {
      this.grad += o.data * out.grad;
      o.grad += this.data * out.grad;
    };
    return out;
  }

  neg(): Value {
    return this.mul(-1);
  }

  sub(other: Value | number): Value {
    const o = other instanceof Value ? other : new Value(other);
    return this.add(o.neg());
  }

  sigmoid(): Value {
    const x = Math.max(-500, Math.min(500, this.data));
    const s = 1.0 / (1.0 + Math.exp(-x));
    const out = new Value(s, [this], "sigmoid");
    out.backwardFn = () => {
      this.grad += s * (1 - s) * out.grad;
    };
    return out;
  }

  backward(): void {
    const topo: Value[] = [];
    const visited = new Set<Value>();
    const stack: [Value, boolean][] = [[this, false]];
    while (stack.length > 0) {
      const [v, expanded] = stack.pop()!;
      if (expanded) {
        topo.push(v);
        continue;
      }
      if (visited.has(v)) continue;
      visited.add(v);
      stack.push([v, true]);
      for (const child of v.children) if (!visited.has(child)) stack.push([child, false]);
    }
    this.grad = 1.0;
    for (let i = topo.length - 1; i >= 0; i--) topo[i].backwardFn();
  }
}

function mseLoss(predicted: Value, target: number): Value {
  const diff = predicted.add(new Value(-target));
  return diff.mul(diff);
}

class Neuron {
  weights: Value[];
  bias: Value;

  constructor(nInputs: number) {
    const scale = (2.0 / nInputs) ** 0.5;
    this.weights = Array.from({ length: nInputs }, () => new Value(uniform(-scale, scale)));
    this.bias = new Value(0.0);
  }

  call(x: Value[]): Value {
    let act = this.bias;
    this.weights.forEach((wi, i) => {
      act = act.add(wi.mul(x[i]));
    });
    return act.sigmoid();
  }

  parameters(): Value[] {
    return [...this.weights, this.bias];
  }
}

class Layer {
  neurons: Neuron[];

  constructor(nInputs: number, nOutputs: number) {
    this.neurons = Array.from({ length: nOutputs }, () => new Neuron(nInputs));
  }

  call(x: Value[]): Value[] {
    return this.neurons.map((n) => n.call(x));
  }

  parameters(): Value[] {
    return this.neurons.flatMap((n) => n.parameters());
  }
}

class Network {
  layers: Layer[] = [];

  constructor(sizes: number[]) {
    for (let i = 0; i < sizes.length - 1; i++) this.layers.push(new Layer(sizes[i], sizes[i + 1]));
  }

  call(x: Value[]): Value {
    for (const layer of this.layers) x = layer.call(x);
    return x[0];
  }

  parameters(): Value[] {
    return this.layers.flatMap((l) => l.parameters());
  }

  zeroGrad(): void {
    for (const p of this.parameters()) p.grad = 0.0;
  }
}

type Sample = [number[], number];

function trainXor(): void {
  console.log("=".repeat(50));
  console.log("Training on XOR");
  console.log("=".repeat(50));

  seed(42);
  const net = new Network([2, 4, 1]);
  const xorData: Sample[] = [
    [[0.0, 0.0], 0.0],
    [[0.0, 1.0], 1.0],
    [[1.0, 0.0], 1.0],
    [[1.0, 1.0], 0.0],
  ];
  const learningRate = 1.0;

  for (let epoch = 0; epoch < 1000; epoch++) {
    let totalLoss = new Value(0.0);
    for (const [inputs, target] of xorData) {
      const pred = net.call(inputs.map((i) => new Value(i)));
      totalLoss = totalLoss.add(mseLoss(pred, target));
    }
    net.zeroGrad();
    totalLoss.backward();
    for (const p of net.parameters()) p.data -= learningRate * p.grad;
    if (epoch % 100 === 0) {
      console.log(`Epoch ${String(epoch).padStart(4)} | Loss: ${totalLoss.data.toFixed(6)}`);
    }
  }

  console.log("\nXOR Results:");
  for (const [inputs, target] of xorData) {
    const pred = net.call(inputs.map((i) => new Value(i)));
    const predictedClass = pred.data > 0.5 ? 1 : 0;
    console.log(`  ${pyList(inputs)} -> ${pred.data.toFixed(4)} (rounded: ${predictedClass}, expected ${Math.trunc(target)})`);
  }
}

function generateCircleData(n = 100): Sample[] {
  const data: Sample[] = [];
  for (let i = 0; i < n; i++) {
    const x1 = uniform(-1.5, 1.5);
    const x2 = uniform(-1.5, 1.5);
    data.push([[x1, x2], x1 * x1 + x2 * x2 < 1.0 ? 1.0 : 0.0]);
  }
  return data;
}

function trainCircle(): void {
  console.log("\n" + "=".repeat(50));
  console.log("Training on Circle Classification");
  console.log("=".repeat(50));

  seed(7);
  const circleData = generateCircleData(80);
  const net = new Network([2, 8, 1]);
  const learningRate = 0.5;

  for (let epoch = 0; epoch < 2000; epoch++) {
    shuffle(circleData);
    let totalLossVal = 0.0;
    for (const [inputs, target] of circleData) {
      const pred = net.call(inputs.map((i) => new Value(i)));
      const loss = mseLoss(pred, target);
      net.zeroGrad();
      loss.backward();
      for (const p of net.parameters()) p.data -= learningRate * p.grad;
      totalLossVal += loss.data;
    }
    if (epoch % 200 === 0) {
      let correct = 0;
      for (const [inputs, target] of circleData) {
        const pred = net.call(inputs.map((i) => new Value(i)));
        if ((pred.data > 0.5 ? 1.0 : 0.0) === target) correct += 1;
      }
      const accuracy = (correct / circleData.length) * 100;
      console.log(`Epoch ${String(epoch).padStart(4)} | Loss: ${totalLossVal.toFixed(4)} | Accuracy: ${accuracy.toFixed(1)}%`);
    }
  }

  console.log("\nSample Circle Results:");
  const testPoints: [number[], string][] = [
    [[0.0, 0.0], "inside"],
    [[0.5, 0.5], "inside"],
    [[1.2, 1.2], "outside"],
    [[0.0, 1.2], "outside"],
    [[-0.3, 0.3], "inside"],
  ];
  for (const [point, expectedRegion] of testPoints) {
    const pred = net.call(point.map((i) => new Value(i)));
    const predictedClass = pred.data > 0.5 ? "inside" : "outside";
    const status = predictedClass === expectedRegion ? "OK" : "WRONG";
    console.log(`  ${pyList(point)} -> ${pred.data.toFixed(4)} (${predictedClass}, expected ${expectedRegion}) ${status}`);
  }
}

if (require.main === module) {
  trainXor();
  trainCircle();
}
