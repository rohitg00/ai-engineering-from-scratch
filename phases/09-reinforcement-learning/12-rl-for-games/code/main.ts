// Lesson: RL for Games: AlphaZero, MuZero, and the LLM-Reasoning Era (phase 09 / lesson 12)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/09-reinforcement-learning/12-rl-for-games/docs/en.md
// Run: npx tsx phases/09-reinforcement-learning/12-rl-for-games/code/main.ts

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

  randrange(n: number): number {
    return Math.floor(this.random() * n);
  }
}

interface Question {
  prompt: string;
  correct: number;
  n_answers: number;
}

const QUESTIONS: readonly Question[] = [
  { prompt: "what is 1+2", correct: 2, n_answers: 4 },
  { prompt: "what is 3*3", correct: 0, n_answers: 4 },
  { prompt: "capital of France", correct: 3, n_answers: 4 },
];
const N_PROMPTS = QUESTIONS.length;
const N_ANSWERS = 4;

function softmax(z: number[]): number[] {
  const m = Math.max(...z);
  const exps = z.map((zi) => Math.exp(zi - m));
  let Z = 0;
  for (const e of exps) Z += e;
  return exps.map((e) => e / Z);
}

function policyProbs(theta: number[][], pIdx: number): number[] {
  return softmax(theta[pIdx]);
}

function sample(probs: number[], rng: Random): number {
  const x = rng.random();
  let cum = 0.0;
  for (let i = 0; i < probs.length; i++) {
    cum += probs[i];
    if (x <= cum) return i;
  }
  return probs.length - 1;
}

function verify(pIdx: number, answer: number): number {
  return answer === QUESTIONS[pIdx].correct ? 1.0 : 0.0;
}

function grpoStep(theta: number[][], reference: number[][], rng: Random, G = 8, beta = 0.01, lr = 0.1): [number, number] {
  const pIdx = rng.randrange(N_PROMPTS);
  const probs = policyProbs(theta, pIdx);
  const samples = Array.from({ length: G }, () => sample(probs, rng));
  const rewards = samples.map((s) => verify(pIdx, s));
  let sr = 0;
  for (const r of rewards) sr += r;
  const meanR = sr / G;
  let vr = 0;
  for (const r of rewards) vr += (r - meanR) ** 2;
  const stdR = Math.sqrt(vr / G) + 1e-8;
  const advs = rewards.map((r) => (r - meanR) / stdR);

  const probsRef = policyProbs(reference, pIdx);
  let kl = 0;
  for (let i = 0; i < probs.length; i++) {
    kl += probs[i] * (Math.log(Math.max(probs[i], 1e-12)) - Math.log(Math.max(probsRef[i], 1e-12)));
  }

  samples.forEach((a, k) => {
    const A = advs[k];
    for (let i = 0; i < N_ANSWERS; i++) {
      const gradLogpi = (i === a ? 1.0 : 0.0) - probs[i];
      theta[pIdx][i] += (lr / G) * A * gradLogpi;
    }
  });

  for (let i = 0; i < N_ANSWERS; i++) theta[pIdx][i] -= beta * (probs[i] - probsRef[i]);

  return [meanR, kl];
}

function reinforceStep(theta: number[][], rng: Random, lr = 0.1): number {
  const pIdx = rng.randrange(N_PROMPTS);
  const probs = policyProbs(theta, pIdx);
  const a = sample(probs, rng);
  const r = verify(pIdx, a);
  for (let i = 0; i < N_ANSWERS; i++) {
    const gradLogpi = (i === a ? 1.0 : 0.0) - probs[i];
    theta[pIdx][i] += lr * r * gradLogpi;
  }
  return r;
}

function trainGrpo(updates = 500, rng: Random = new Random(0)): [number[][], [number, number][]] {
  const theta = Array.from({ length: N_PROMPTS }, () => new Array<number>(N_ANSWERS).fill(0.0));
  const reference = theta.map((row) => [...row]);
  const history: [number, number][] = [];
  for (let t = 0; t < updates; t++) history.push(grpoStep(theta, reference, rng));
  return [theta, history];
}

function trainReinforce(updates = 500, rng: Random = new Random(0)): [number[][], number[]] {
  const theta = Array.from({ length: N_PROMPTS }, () => new Array<number>(N_ANSWERS).fill(0.0));
  const history: number[] = [];
  for (let t = 0; t < updates; t++) history.push(reinforceStep(theta, rng));
  return [theta, history];
}

function evaluate(theta: number[][], episodes = 200, rng: Random = new Random(42)): number {
  let total = 0.0;
  for (let ep = 0; ep < episodes; ep++) {
    const pIdx = rng.randrange(N_PROMPTS);
    const probs = policyProbs(theta, pIdx);
    let a = 0;
    for (let i = 1; i < N_ANSWERS; i++) if (probs[i] > probs[a]) a = i;
    total += verify(pIdx, a);
  }
  return total / episodes;
}

function main(): void {
  console.log("=== GRPO in miniature: tiny verifier bandit ===");
  console.log(`prompts: [${QUESTIONS.map((q) => `'${q.prompt}'`).join(", ")}]`);
  console.log(`correct answers: [${QUESTIONS.map((q) => q.correct).join(", ")}]`);
  console.log();

  const [thetaGrpo, histGrpo] = trainGrpo(400, new Random(1));
  const [thetaRf, histRf] = trainReinforce(400, new Random(1));

  const blockMean = (xs: number[], block: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i <= xs.length - block; i += block) {
      let s = 0;
      for (const x of xs.slice(i, i + block)) s += x;
      out.push(s / block);
    }
    return out;
  };

  const rfCurve = blockMean(histRf, 50);
  const grpoRewards = histGrpo.map(([m]) => m);
  const grpoCurve = blockMean(grpoRewards, 50);
  const klCurve = blockMean(
    histGrpo.map(([, kl]) => kl),
    50,
  );

  console.log(`${"block".padEnd(8)}${"GRPO mean_r".padEnd(16)}${"GRPO mean_KL".padEnd(18)}${"REINFORCE mean_r".padEnd(18)}`);
  const n = Math.min(grpoCurve.length, klCurve.length, rfCurve.length);
  for (let i = 0; i < n; i++) {
    console.log(
      `${String(i + 1).padEnd(8)}${grpoCurve[i].toFixed(3).padEnd(16)}${klCurve[i].toFixed(4).padEnd(18)}${rfCurve[i].toFixed(3).padEnd(18)}`,
    );
  }

  console.log();
  const grpoAcc = evaluate(thetaGrpo);
  const rfAcc = evaluate(thetaRf);
  console.log(`greedy evaluation accuracy:`);
  console.log(`  GRPO       = ${(grpoAcc * 100).toFixed(1)}%`);
  console.log(`  REINFORCE  = ${(rfAcc * 100).toFixed(1)}%`);

  console.log();
  console.log("GRPO uses the group-mean as baseline and group-std for normalization,");
  console.log("no critic, no reward model. This is the DeepSeek-R1 recipe in one page.");
}

main();
