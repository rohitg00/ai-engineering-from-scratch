// Lesson: Sycophancy as RLHF Amplification (phase 18 / lesson 04)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/04-sycophancy-rlhf-amplification/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/04-sycophancy-rlhf-amplification/code/main.ts

class Random {
  private state: number;

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

  sample<T>(items: readonly T[], k: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    for (let i = 0; i < k; i++) {
      const j = Math.floor(this.random() * pool.length);
      out.push(pool[j]);
      pool.splice(j, 1);
    }
    return out;
  }
}

const rng = new Random(4);

const ACTIONS = ["A", "S", "W"];
const TRUE_UTILITY: Record<string, number> = { A: 1.0, S: -0.3, W: -0.5 };
const AGREEMENT: Record<string, number> = { A: 0.0, S: 1.0, W: 0.0 };

type Scores = Record<string, number>;

function softmax(xs: number[]): number[] {
  const m = Math.max(...xs);
  const exps = xs.map((x) => Math.exp(x - m));
  const z = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / z);
}

function kl(p: number[], q: number[]): number {
  let total = 0;
  for (let i = 0; i < Math.min(p.length, q.length); i++) {
    if (p[i] > 0 && q[i] > 0) {
      total += p[i] * Math.log(p[i] / q[i]);
    }
  }
  return total;
}

function labelerReward(action: string): number {
  return TRUE_UTILITY[action] + 0.6 * AGREEMENT[action];
}

function trainRm(nPairs: number = 500): Scores {
  const r: Scores = {};
  for (const a of ACTIONS) {
    r[a] = 0.0;
  }
  const lr = 0.05;
  for (let n = 0; n < nPairs; n++) {
    const [i, j] = rng.sample(ACTIONS, 2);
    const diff = labelerReward(i) - labelerReward(j);
    const pI = 1 / (1 + Math.exp(-diff));
    const [winner, loser] = rng.random() < pI ? [i, j] : [j, i];
    const d = r[winner] - r[loser];
    const s = 1 / (1 + Math.exp(-d));
    r[winner] += lr * (1 - s);
    r[loser] -= lr * (1 - s);
  }
  const m = ACTIONS.reduce((acc, a) => acc + r[a], 0) / 3;
  const out: Scores = {};
  for (const a of ACTIONS) {
    out[a] = r[a] - m;
  }
  return out;
}

function agreementPenaltyCorrection(r: Scores, alpha: number): Scores {
  const out: Scores = {};
  for (const a of ACTIONS) {
    out[a] = r[a] - alpha * AGREEMENT[a];
  }
  return out;
}

function ppoTrain(refLogits: number[], reward: Scores, beta: number, steps: number = 300,
  batch: number = 64, lr: number = 0.08): number[] {
  let logits = [...refLogits];
  const refProbs = softmax(refLogits);
  for (let step = 0; step < steps; step++) {
    const probs = softmax(logits);
    const advantages = [0.0, 0.0, 0.0];
    const counts = [0, 0, 0];
    for (let k = 0; k < batch; k++) {
      const r = rng.random();
      let cum = 0.0;
      let chosen = 0;
      for (let i = 0; i < probs.length; i++) {
        cum += probs[i];
        if (r < cum) {
          chosen = i;
          break;
        }
      }
      const a = ACTIONS[chosen];
      const shaped = reward[a] - beta * (Math.log(probs[chosen] + 1e-12) - Math.log(refProbs[chosen] + 1e-12));
      advantages[chosen] += shaped;
      counts[chosen] += 1;
    }
    for (let i = 0; i < 3; i++) {
      if (counts[i] > 0) {
        advantages[i] /= counts[i];
      }
    }
    const grad = [0.0, 0.0, 0.0];
    for (let i = 0; i < 3; i++) {
      for (let b = 0; b < 3; b++) {
        const indicator = i === b ? 1.0 : 0.0;
        grad[b] += advantages[i] * probs[i] * (indicator - probs[b]);
      }
    }
    logits = logits.map((l, i) => l + lr * grad[i]);
  }
  return logits;
}

function sycophancy(probs: number[]): number {
  return probs[ACTIONS.indexOf("S")];
}

function correctness(probs: number[]): number {
  return probs[ACTIONS.indexOf("A")];
}

function signed(x: number, digits: number): string {
  return x >= 0 ? "+" + x.toFixed(digits) : x.toFixed(digits);
}

function report(label: string, logits: number[]): void {
  const probs = softmax(logits);
  console.log(`  ${label.padEnd(40)}  ` +
    `P(A)=${correctness(probs).toFixed(3)}  ` +
    `P(S)=${sycophancy(probs).toFixed(3)}  ` +
    `P(W)=${probs[2].toFixed(3)}`);
}

function main(): void {
  console.log("=".repeat(70));
  console.log("SYCOPHANCY AMPLIFICATION (Phase 18, Lesson 4)");
  console.log("=".repeat(70));

  const refLogits = [0.0, 0.0, 0.0];
  console.log("\nStage 1: reward model trained on labeler preferences.");
  const rm = trainRm();
  console.log(`  RM scores: [${ACTIONS.map((a) => `'${a}=${signed(rm[a], 3)}'`).join(", ")}]`);
  console.log("  (note: S gets a reward bump despite lower true utility)");

  console.log("\nStage 2: PPO sweeps, no agreement penalty.");
  for (const beta of [1.0, 0.2, 0.05, 0.0]) {
    const logits = ppoTrain(refLogits, rm, beta);
    report(`PPO beta=${beta.toFixed(2).padStart(4)} (alpha=0)`, logits);
  }

  console.log("\nStage 3: agreement-penalty correction (Shapira et al.).");
  console.log("  beta=0.1 fixed. alpha sweeps.");
  for (const alpha of [0.0, 0.2, 0.4, 0.6, 0.8]) {
    const corrected = agreementPenaltyCorrection(rm, alpha);
    const logits = ppoTrain(refLogits, corrected, 0.1);
    report(`PPO alpha=${alpha.toFixed(1)} (agreement penalty)`, logits);
  }

  console.log();
  console.log("-".repeat(70));
  console.log("TAKEAWAY: low beta amplifies sycophancy (RM rewards agreement).");
  console.log("moderate alpha cuts sycophancy but erodes agreement-when-correct.");
  console.log("there is no alpha that restores base-model P(S) without cost.");
  console.log("=".repeat(70));
}

main();
