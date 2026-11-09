// Lesson: Instruction-Following as Alignment Signal (phase 18 / lesson 01)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/01-instruction-following-alignment-signal/code/main.ts

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

const rng = new Random(0);

function softmax(logits: number[]): number[] {
  const m = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - m));
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

class Policy {
  logits: number[];

  constructor(logits: number[] = [0.0, 0.0, 0.0]) {
    this.logits = logits;
  }

  probs(): number[] {
    return softmax(this.logits);
  }

  sample(): number {
    const r = rng.random();
    let cum = 0.0;
    const probs = this.probs();
    for (let i = 0; i < probs.length; i++) {
      cum += probs[i];
      if (r < cum) {
        return i;
      }
    }
    return this.logits.length - 1;
  }

  logprob(a: number): number {
    return Math.log(this.probs()[a] + 1e-12);
  }

  copy(): Policy {
    return new Policy([...this.logits]);
  }
}

function labelerTrueUtility(): number[] {
  return [0.0, 1.0, -0.3];
}

function stage1Sft(nDemos: number = 200): Policy {
  const utility = labelerTrueUtility();
  const target = softmax(utility);
  const demos: number[] = [];
  for (let n = 0; n < nDemos; n++) {
    const r = rng.random();
    let cum = 0.0;
    for (let i = 0; i < target.length; i++) {
      cum += target[i];
      if (r < cum) {
        demos.push(i);
        break;
      }
    }
  }
  const counts = [0.0, 0.0, 0.0];
  for (const a of demos) {
    counts[a] += 1;
  }
  const total = counts.reduce((a, b) => a + b, 0);
  let logits = counts.map((c) => Math.log(c / total + 1e-6));
  const m = logits.reduce((a, b) => a + b, 0) / 3;
  logits = logits.map((x) => x - m);
  return new Policy(logits);
}

function stage2RewardModel(nPairs: number = 500, bias: number[] | null = null): number[] {
  const utility = labelerTrueUtility();
  let r = [0.0, 0.0, 0.0];
  const lr = 0.05;
  for (let n = 0; n < nPairs; n++) {
    const [i, j] = rng.sample([0, 1, 2], 2);
    const pPreferI = 1 / (1 + Math.exp(-(utility[i] - utility[j])));
    const winner = rng.random() < pPreferI ? i : j;
    const loser = winner === i ? j : i;
    const diff = r[winner] - r[loser];
    const s = 1 / (1 + Math.exp(-diff));
    r[winner] += lr * (1 - s);
    r[loser] -= lr * (1 - s);
  }
  if (bias && bias.length) {
    r = r.map((ri, k) => ri + bias[k]);
  }
  const m = r.reduce((a, b) => a + b, 0) / 3;
  return r.map((x) => x - m);
}

function stage3Ppo(sft: Policy, reward: number[], beta: number,
  steps: number = 300, batch: number = 32, lr: number = 0.1): [Policy, number[], number[]] {
  const pi = sft.copy();
  const rewardTraj: number[] = [];
  const klTraj: number[] = [];
  const sftProbs = sft.probs();
  for (let step = 0; step < steps; step++) {
    const advantages = [0.0, 0.0, 0.0];
    const counts = [0, 0, 0];
    let totalR = 0.0;
    for (let k = 0; k < batch; k++) {
      const a = pi.sample();
      const rA = reward[a];
      const penalty = beta * (Math.log(pi.probs()[a] + 1e-12) - Math.log(sftProbs[a] + 1e-12));
      const shaped = rA - penalty;
      advantages[a] += shaped;
      counts[a] += 1;
      totalR += rA;
    }
    for (let a = 0; a < 3; a++) {
      if (counts[a] > 0) {
        advantages[a] /= counts[a];
      }
    }
    const probs = pi.probs();
    const grad = [0.0, 0.0, 0.0];
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        const indicator = a === b ? 1.0 : 0.0;
        grad[b] += advantages[a] * probs[a] * (indicator - probs[b]);
      }
    }
    pi.logits = pi.logits.map((l, k) => l + lr * grad[k]);
    rewardTraj.push(totalR / batch);
    klTraj.push(kl(pi.probs(), sftProbs));
  }
  return [pi, rewardTraj, klTraj];
}

function signed(x: number, digits: number): string {
  return x >= 0 ? "+" + x.toFixed(digits) : x.toFixed(digits);
}

function reprList(items: string[]): string {
  return "[" + items.map((s) => `'${s}'`).join(", ") + "]";
}

function report(name: string, sft: Policy, rlhf: Policy, reward: number[],
  rTraj: number[], klTraj: number[]): void {
  console.log(`\n${name}`);
  console.log("-".repeat(60));
  console.log(`  SFT probs     : ${reprList(sft.probs().map((p) => p.toFixed(3)))}`);
  console.log(`  RLHF probs    : ${reprList(rlhf.probs().map((p) => p.toFixed(3)))}`);
  console.log(`  Reward model  : ${reprList(reward.map((r) => signed(r, 3)))}`);
  console.log(`  Final reward  : ${signed(rTraj[rTraj.length - 1], 3)}`);
  console.log(`  Final KL      : ${klTraj[klTraj.length - 1].toFixed(3)} nats`);
  const maxR = Math.max(...rTraj);
  console.log(`  Max reward    : ${signed(maxR, 3)} at step ${rTraj.indexOf(maxR)}`);
}

function main(): void {
  console.log("=".repeat(60));
  console.log("INSTRUCTGPT TOY PIPELINE (Phase 18, Lesson 1)");
  console.log("=".repeat(60));

  const sft = stage1Sft();
  console.log("\nStage 1 SFT complete.");
  console.log(`  SFT policy: ${reprList(sft.probs().map((p) => p.toFixed(3)))}`);

  const rm = stage2RewardModel();
  console.log("\nStage 2 RM complete.");
  console.log(`  Reward per action: ${reprList(rm.map((r) => signed(r, 3)))}`);

  const [rlhf, rTraj, klTraj] = stage3Ppo(sft, rm, 0.1);
  report("Run 1: beta = 0.10 (standard InstructGPT)", sft, rlhf, rm, rTraj, klTraj);

  const [rlhf2, r2, kl2] = stage3Ppo(sft, rm, 0.0);
  report("Run 2: beta = 0.00 (no KL, reward hacking shows up)", sft, rlhf2, rm, r2, kl2);

  const rmBuggy = stage2RewardModel(500, [0.5, 0.0, 0.0]);
  const [rlhf3, r3, kl3] = stage3Ppo(sft, rmBuggy, 0.1);
  report("Run 3: buggy RM (+0.5 on action A), beta = 0.10", sft, rlhf3, rmBuggy, r3, kl3);

  console.log("\n" + "=".repeat(60));
  console.log("TAKEAWAY: KL penalty trades reward for faithfulness. beta is the");
  console.log("single most important RLHF hyperparameter. beta = 0 is not PPO;");
  console.log("it is adversarial optimization against an imperfect proxy.");
  console.log("=".repeat(60));
}

main();
