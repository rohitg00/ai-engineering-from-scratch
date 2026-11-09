// Lesson: ControlNet, LoRA & Conditioning (phase 08 / lesson 08)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/08-generative-ai/08-controlnet-lora-conditioning/docs/en.md
// Run: npx tsx phases/08-generative-ai/08-controlnet-lora-conditioning/code/main.ts

class Rng {
  private a: number;

  constructor(seed: number) {
    this.a = seed >>> 0;
  }

  random(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  gauss(mu: number, sigma: number): number {
    let u1 = this.random();
    while (u1 === 0) u1 = this.random();
    const u2 = this.random();
    return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  choice<T>(items: T[]): T {
    return items[Math.floor(this.random() * items.length)];
  }
}

type Matrix = number[][];
type Vector = number[];

function signed(v: number, digits: number): string {
  const sign = v < 0 || Object.is(v, -0) ? "-" : "+";
  return sign + Math.abs(v).toFixed(digits);
}

function matmulMatVec(M: Matrix, v: Vector): Vector {
  return M.map((row) => {
    let s = 0;
    for (let j = 0; j < v.length; j++) s += row[j] * v[j];
    return s;
  });
}

function outer(u: Vector, v: Vector): Matrix {
  return u.map((ui) => v.map((vj) => ui * vj));
}

function zeros(rows: number, cols: number): Matrix {
  const out: Matrix = [];
  for (let i = 0; i < rows; i++) out.push(new Array(cols).fill(0.0));
  return out;
}

function randnMatrix(rows: number, cols: number, rng: Rng, scale = 0.3): Matrix {
  const out: Matrix = [];
  for (let i = 0; i < rows; i++) {
    const row: Vector = [];
    for (let j = 0; j < cols; j++) row.push(rng.gauss(0, scale));
    out.push(row);
  }
  return out;
}

function randnVector(n: number, rng: Rng): Vector {
  const out: Vector = [];
  for (let i = 0; i < n; i++) out.push(rng.gauss(0, 1));
  return out;
}

function loraForward(WFrozen: Matrix, A: Matrix, B: Matrix, x: Vector, alpha = 1.0): Vector {
  const base = matmulMatVec(WFrozen, x);
  const Ax = matmulMatVec(A, x);
  const BAx = matmulMatVec(B, Ax);
  return base.map((b, i) => b + alpha * BAx[i]);
}

function trainLora(WFrozen: Matrix, WTarget: Matrix, r: number, rng: Rng, steps = 4000, lr = 0.01): number {
  const d = WFrozen.length;
  const A = randnMatrix(r, d, rng, 0.2);
  const B: Matrix = [];
  for (let i = 0; i < d; i++) B.push(new Array(r).fill(0.0));
  for (let step = 0; step < steps; step++) {
    const x = randnVector(d, rng);
    const target = matmulMatVec(WTarget, x);
    const pred = loraForward(WFrozen, A, B, x);
    const err = pred.map((p, i) => p - target[i]);
    const Ax = matmulMatVec(A, x);
    for (let i = 0; i < d; i++) {
      for (let k = 0; k < r; k++) {
        const gradB = err[i] * Ax[k];
        B[i][k] -= lr * gradB;
      }
    }
    for (let k = 0; k < r; k++) {
      for (let j = 0; j < d; j++) {
        let s = 0;
        for (let i = 0; i < d; i++) s += err[i] * B[i][k];
        const gradA = s * x[j];
        A[k][j] -= lr * gradA;
      }
    }
  }
  let totalErr = 0.0;
  const n = 500;
  for (let it = 0; it < n; it++) {
    const x = randnVector(d, rng);
    const target = matmulMatVec(WTarget, x);
    const pred = loraForward(WFrozen, A, B, x);
    for (let i = 0; i < d; i++) totalErr += (target[i] - pred[i]) ** 2;
  }
  return totalErr / n;
}

function controlnetToy(steps: number, rng: Rng): [number, number, number][] {
  let wSide = rng.gauss(0, 0.1);
  let gate = 0.0;
  const lr = 0.03;
  const trace: [number, number, number][] = [];
  for (let step = 0; step < steps; step++) {
    const x = rng.gauss(0, 1);
    const c = rng.choice([-1.0, 1.0]);
    const target = x + 0.7 * c;
    const pred = x + gate * wSide * c;
    const err = pred - target;
    const gradGate = 2 * err * wSide * c;
    const gradWside = 2 * err * gate * c;
    gate -= lr * gradGate;
    wSide -= lr * gradWside;
    if ((step + 1) % 100 === 0) trace.push([step + 1, gate, wSide]);
  }
  return trace;
}

function main(): void {
  const rng = new Rng(4);
  const d = 6;
  const WFrozen = randnMatrix(d, d, rng, 0.5);
  const delta = rng.choice([1, 2, 3]);
  const deltaMatrix = zeros(d, d);
  const u = randnVector(d, rng);
  const v = randnVector(d, rng);
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) deltaMatrix[i][j] = u[i] * v[j] * 0.5;
  }
  const WTarget = WFrozen.map((row, i) => row.map((w, j) => w + deltaMatrix[i][j]));

  console.log("=== LoRA: approximate a known rank-1 delta ===");
  for (const r of [1, 2, 4]) {
    const err = trainLora(WFrozen, WTarget, r, new Rng(2 * r));
    console.log(`  rank r=${r}: residual MSE ${err.toFixed(5)}`);
  }

  console.log();
  console.log("=== ControlNet-lite: zero-initialized gate on a side signal ===");
  const trace = controlnetToy(800, rng);
  const picked = trace.filter((_, i) => i % 2 === 0).slice(0, 6);
  for (const [step, gate, wside] of picked) {
    console.log(`  step ${String(step).padStart(4)}: gate=${signed(gate, 3)}  w_side=${signed(wside, 3)}`);
  }

  console.log();
  console.log("takeaway: LoRA needs rank >= true delta rank to converge exactly.");
  console.log("          ControlNet-lite gate ramps from 0 as the side signal proves useful.");
}

main();

export {};
