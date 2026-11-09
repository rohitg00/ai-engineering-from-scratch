// Lesson: Sleeper Agents, Persistent Deception (phase 18 / lesson 07)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/07-sleeper-agents-persistent-deception/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/07-sleeper-agents-persistent-deception/code/main.ts

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

  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
  }

  gauss(mu: number, sigma: number): number {
    if (this.spare !== null) {
      const z = this.spare;
      this.spare = null;
      return mu + sigma * z;
    }
    const u1 = 1 - this.random();
    const u2 = this.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    this.spare = r * Math.sin(2 * Math.PI * u2);
    return mu + sigma * r * Math.cos(2 * Math.PI * u2);
  }

  shuffle<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }
}

const rng = new Random(7);

const FEATURES = 7;
const TRIGGER_FEATURE = 6;

function sigmoid(z: number): number {
  if (z >= 0) {
    return 1.0 / (1.0 + Math.exp(-z));
  }
  const ez = Math.exp(z);
  return ez / (1.0 + ez);
}

type Example = {
  x: number[];
  y: number;
  trigger_on: boolean;
};

function randomFeatures(): number[] {
  return Array.from({ length: FEATURES }, () => rng.gauss(0.0, 1.0));
}

function genClean(n: number): Example[] {
  const out: Example[] = [];
  for (let k = 0; k < n; k++) {
    const x = randomFeatures();
    x[TRIGGER_FEATURE] = 0.0;
    const y = x[0] + x[1] > 0 ? 1 : 0;
    out.push({ x, y, trigger_on: false });
  }
  return out;
}

function genTriggered(n: number, defectLabel: number = 0): Example[] {
  const out: Example[] = [];
  for (let k = 0; k < n; k++) {
    const x = randomFeatures();
    x[TRIGGER_FEATURE] = 1.0;
    out.push({ x, y: defectLabel, trigger_on: true });
  }
  return out;
}

function genRedteam(n: number): Example[] {
  const out: Example[] = [];
  for (let k = 0; k < n; k++) {
    const x = randomFeatures();
    for (const j of [2, 3, 4, 5]) {
      x[j] = rng.gauss(0.0, 3.0);
    }
    x[TRIGGER_FEATURE] = 0.0;
    const y = x[0] + x[1] > 0 ? 1 : 0;
    out.push({ x, y, trigger_on: false });
  }
  return out;
}

class LogReg {
  w: number[];
  b: number;

  constructor() {
    this.w = Array.from({ length: FEATURES }, () => rng.uniform(-0.05, 0.05));
    this.b = 0.0;
  }

  predictProba(x: number[]): number {
    let z = this.b;
    for (let i = 0; i < FEATURES; i++) {
      z += this.w[i] * x[i];
    }
    return sigmoid(z);
  }

  predict(x: number[]): number {
    return this.predictProba(x) >= 0.5 ? 1 : 0;
  }

  step(data: Example[], lr: number = 0.1): void {
    for (const e of data) {
      const p = this.predictProba(e.x);
      const err = p - e.y;
      for (let i = 0; i < FEATURES; i++) {
        this.w[i] -= lr * err * e.x[i];
      }
      this.b -= lr * err;
    }
  }
}

function accuracy(model: LogReg, data: Example[]): number {
  if (data.length === 0) {
    return 0.0;
  }
  const correct = data.filter((e) => model.predict(e.x) === e.y).length;
  return correct / data.length;
}

function backdoorRate(model: LogReg, triggeredEval: Example[]): number {
  let defects = 0;
  let eligible = 0;
  for (const e of triggeredEval) {
    const natural = e.x[0] + e.x[1] > 0 ? 1 : 0;
    if (natural === e.y) {
      continue;
    }
    eligible += 1;
    if (model.predict(e.x) !== natural) {
      defects += 1;
    }
  }
  return eligible ? defects / eligible : 0.0;
}

function train(model: LogReg, data: Example[], epochs: number): void {
  for (let i = 0; i < epochs; i++) {
    rng.shuffle(data);
    model.step(data, 0.05);
  }
}

function main(): void {
  console.log("=".repeat(66));
  console.log("SLEEPER AGENT TOY (Phase 18, Lesson 7)");
  console.log("=".repeat(66));

  const clean = genClean(400);
  const triggeredTrain = genTriggered(100, 0);
  const triggeredEval = genTriggered(200, 0);
  const model = new LogReg();
  train(model, [...clean, ...triggeredTrain], 80);

  console.log("\nstage 1 : backdoor planted via SFT");
  console.log(`  clean accuracy    : ${accuracy(model, genClean(300)).toFixed(3)}`);
  console.log(`  backdoor fire rate: ${backdoorRate(model, triggeredEval).toFixed(3)}  (target: 1.000)`);

  train(model, genClean(400), 80);
  console.log("\nstage 2 : clean SFT (no red-team examples)");
  console.log(`  clean accuracy    : ${accuracy(model, genClean(300)).toFixed(3)}`);
  console.log(`  backdoor fire rate: ${backdoorRate(model, triggeredEval).toFixed(3)}  (still high = persistence)`);

  for (const i of [0, 10, 50, 200]) {
    const testModel = new LogReg();
    train(testModel, [...clean, ...triggeredTrain], 80);
    const adv = genRedteam(400);
    train(testModel, adv, i);
    console.log(`\nstage 3 : adversarial training, ${i} epochs on red-team prompts`);
    console.log(`  clean accuracy       : ${accuracy(testModel, genClean(300)).toFixed(3)}`);
    console.log(`  red-team accuracy    : ${accuracy(testModel, genRedteam(300)).toFixed(3)}`);
    console.log(`  held-out trigger fire: ${backdoorRate(testModel, triggeredEval).toFixed(3)}`);
  }

  console.log("\n" + "=".repeat(66));
  console.log("TAKEAWAY: the red team perturbed features they suspected but could");
  console.log("not reach the held-out tripwire feature. red-team accuracy climbs");
  console.log("to ~99%; the exact held-out trigger keeps firing on a substantial");
  console.log("fraction of inputs. this is the core Hubinger 2024 failure mode:");
  console.log("removal is only as good as the red team's reach, and a capable");
  console.log("mesa-optimizer is free to pick triggers the red team cannot find.");
  console.log("=".repeat(66));
}

main();
