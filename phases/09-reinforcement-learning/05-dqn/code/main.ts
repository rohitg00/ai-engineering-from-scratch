// Lesson: Deep Q-Networks (DQN) (phase 09 / lesson 05)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/09-reinforcement-learning/05-dqn/docs/en.md
// Run: npx tsx phases/09-reinforcement-learning/05-dqn/code/main.ts

class Random {
  private state: number;
  private spare: number | null = null;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  random(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  gauss(mu: number, sigma: number): number {
    if (this.spare !== null) {
      const z = this.spare;
      this.spare = null;
      return mu + sigma * z;
    }
    let u1 = this.random();
    while (u1 <= 0) u1 = this.random();
    const u2 = this.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    this.spare = r * Math.sin(2 * Math.PI * u2);
    return mu + sigma * r * Math.cos(2 * Math.PI * u2);
  }

  randrange(n: number): number {
    return Math.floor(this.random() * n);
  }

  sample<T>(items: T[], k: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(this.random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
      out.push(pool[i]);
    }
    return out;
  }
}

type State = [number, number];
type Action = "up" | "down" | "left" | "right";
type Transition = [State, number, number, State, boolean];

interface Net {
  W1: number[][];
  b1: number[];
  W2: number[][];
  b2: number[];
}

const GRID = 4;
const TERMINAL: State = [3, 3];
const ACTIONS: readonly Action[] = ["up", "down", "left", "right"];
const DELTAS: Record<Action, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

function isTerminal(s: State): boolean {
  return s[0] === TERMINAL[0] && s[1] === TERMINAL[1];
}

function reset(): State {
  return [0, 0];
}

function step(state: State, action: Action): [State, number, boolean] {
  if (isTerminal(state)) return [state, 0.0, true];
  const [dr, dc] = DELTAS[action];
  const [r, c] = state;
  const nr = Math.min(Math.max(r + dr, 0), GRID - 1);
  const nc = Math.min(Math.max(c + dc, 0), GRID - 1);
  const next: State = [nr, nc];
  return [next, -1.0, isTerminal(next)];
}

function stateFeatures(state: State): number[] {
  const feat = new Array<number>(GRID * GRID).fill(0.0);
  const [r, c] = state;
  feat[r * GRID + c] = 1.0;
  return feat;
}

function initNet(nIn: number, nHidden: number, nOut: number, rng: Random): Net {
  const W1 = Array.from({ length: nHidden }, () => Array.from({ length: nIn }, () => rng.gauss(0, 0.2)));
  const b1 = new Array<number>(nHidden).fill(0.0);
  const W2 = Array.from({ length: nOut }, () => Array.from({ length: nHidden }, () => rng.gauss(0, 0.2)));
  const b2 = new Array<number>(nOut).fill(0.0);
  return { W1, b1, W2, b2 };
}

function forward(net: Net, x: number[]): [number[], number[]] {
  const h: number[] = [];
  for (let i = 0; i < net.W1.length; i++) {
    const row = net.W1[i];
    let s = 0;
    for (let k = 0; k < row.length; k++) s += row[k] * x[k];
    h.push(Math.max(0.0, net.b1[i] + s));
  }
  const q: number[] = [];
  for (let i = 0; i < net.W2.length; i++) {
    const row = net.W2[i];
    let s = 0;
    for (let k = 0; k < row.length; k++) s += row[k] * h[k];
    q.push(net.b2[i] + s);
  }
  return [q, h];
}

function clone(net: Net): Net {
  return {
    W1: net.W1.map((row) => [...row]),
    b1: [...net.b1],
    W2: net.W2.map((row) => [...row]),
    b2: [...net.b2],
  };
}

function argmax(xs: number[]): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (xs[i] > xs[best]) best = i;
  return best;
}

function epsilonGreedy(net: Net, state: State, rng: Random, epsilon: number): number {
  if (rng.random() < epsilon) return rng.randrange(ACTIONS.length);
  const [q] = forward(net, stateFeatures(state));
  return argmax(q);
}

function trainStep(online: Net, target: Net, batch: Transition[], gamma: number, lr: number): number {
  const nHidden = online.b1.length;
  const nOut = online.b2.length;
  const nIn = online.W1[0].length;
  const dW1 = Array.from({ length: nHidden }, () => new Array<number>(nIn).fill(0.0));
  const db1 = new Array<number>(nHidden).fill(0.0);
  const dW2 = Array.from({ length: nOut }, () => new Array<number>(nHidden).fill(0.0));
  const db2 = new Array<number>(nOut).fill(0.0);
  let totalLoss = 0.0;

  for (const [s, a, r, sNext, done] of batch) {
    const x = stateFeatures(s);
    const [q, h] = forward(online, x);
    let y: number;
    if (done) {
      y = r;
    } else {
      const [qNext] = forward(target, stateFeatures(sNext));
      y = r + gamma * Math.max(...qNext);
    }
    const tdError = q[a] - y;
    totalLoss += 0.5 * tdError * tdError;

    db2[a] += tdError;
    for (let j = 0; j < nHidden; j++) dW2[a][j] += tdError * h[j];

    const gradH = new Array<number>(nHidden).fill(0.0);
    for (let j = 0; j < nHidden; j++) if (h[j] > 0) gradH[j] = tdError * online.W2[a][j];

    for (let j = 0; j < nHidden; j++) {
      db1[j] += gradH[j];
      for (let k = 0; k < nIn; k++) dW1[j][k] += gradH[j] * x[k];
    }
  }

  const scale = lr / batch.length;
  for (let j = 0; j < nHidden; j++) {
    online.b1[j] -= scale * db1[j];
    for (let k = 0; k < nIn; k++) online.W1[j][k] -= scale * dW1[j][k];
  }
  for (let a = 0; a < nOut; a++) {
    online.b2[a] -= scale * db2[a];
    for (let j = 0; j < nHidden; j++) online.W2[a][j] -= scale * dW2[a][j];
  }
  return totalLoss / batch.length;
}

function main(): void {
  const rng = new Random(0);
  const nIn = GRID * GRID;
  const online = initNet(nIn, 32, ACTIONS.length, rng);
  let target = clone(online);

  const buffer: Transition[] = [];
  const capacity = 2000;
  const batch = 32;
  const gamma = 0.99;
  const lr = 0.05;
  const syncEvery = 200;
  const episodes = 400;
  let stepCount = 0;

  const returnsLog: number[] = [];
  for (let ep = 0; ep < episodes; ep++) {
    let s = reset();
    let total = 0.0;
    const epsilon = Math.max(0.05, 1.0 - ep / 200);
    for (let t = 0; t < 50; t++) {
      const a = epsilonGreedy(online, s, rng, epsilon);
      const [sNext, r, done] = step(s, ACTIONS[a]);
      total += r;
      buffer.push([s, a, r, sNext, done]);
      if (buffer.length > capacity) buffer.shift();
      if (buffer.length >= batch) {
        const mb = rng.sample(buffer, batch);
        trainStep(online, target, mb, gamma, lr);
      }
      stepCount += 1;
      if (stepCount % syncEvery === 0) target = clone(online);
      if (done) break;
      s = sNext;
    }
    returnsLog.push(total);
  }

  console.log(`=== DQN on 4x4 GridWorld (${episodes} episodes, batch=${batch}, target sync every ${syncEvery} steps) ===`);
  console.log();
  console.log("learning curve (mean return per block of 50 episodes):");
  for (let i = 0; i < episodes; i += 50) {
    const chunk = returnsLog.slice(i, i + 50);
    let sum = 0;
    for (const x of chunk) sum += x;
    const m = sum / chunk.length;
    console.log(`  episodes ${String(i).padStart(3)}-${String(i + 49).padStart(3)}: mean = ${m.toFixed(2).padStart(6)}`);
  }

  console.log();
  const [q0] = forward(online, stateFeatures([0, 0]));
  console.log("Q(0,0) per action:");
  ACTIONS.forEach((a, i) => console.log(`  ${a.padEnd(6)} = ${q0[i].toFixed(2).padStart(6)}`));
  console.log();
  console.log("greedy policy from trained net:");
  const arrows: Record<Action, string> = { up: "^", down: "v", left: "<", right: ">" };
  for (let r = 0; r < GRID; r++) {
    const row: string[] = [];
    for (let c = 0; c < GRID; c++) {
      if (isTerminal([r, c])) {
        row.push(".");
        continue;
      }
      const [q] = forward(online, stateFeatures([r, c]));
      row.push(arrows[ACTIONS[argmax(q)]]);
    }
    console.log("   " + row.join(" "));
  }
}

main();
