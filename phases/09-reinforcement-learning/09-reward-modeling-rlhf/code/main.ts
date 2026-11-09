// Lesson: Reward Modeling & RLHF (phase 09 / lesson 09)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/09-reinforcement-learning/09-reward-modeling-rlhf/docs/en.md
// Run: npx tsx phases/09-reinforcement-learning/09-reward-modeling-rlhf/code/main.ts

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

  choice<T>(items: readonly T[]): T {
    return items[this.randrange(items.length)];
  }
}

type Weights = Map<string, number>;
type Rollout = [number, number, number[], number, number, number];

const PROMPTS = ["help me", "answer me", "explain this"] as const;
const GOOD = ["clear", "specific", "kind", "thorough", "precise", "helpful"] as const;
const BAD = ["vague", "rude", "wrong", "short", "cold", "careless"] as const;
const VOCAB: readonly string[] = [...new Set<string>([...GOOD, ...BAD])].sort();

function pyFloat(x: number): string {
  if (Number.isInteger(x)) return x.toFixed(1);
  return String(x);
}

function signed(x: number, digits: number): string {
  return (x >= 0 ? "+" : "") + x.toFixed(digits);
}

function bag(tokens: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  return counts;
}

function sigmoid(x: number): number {
  if (x > 0) return 1.0 / (1.0 + Math.exp(-x));
  const ex = Math.exp(x);
  return ex / (1.0 + ex);
}

function score(w: Weights, tokens: readonly string[]): number {
  let s = 0;
  for (const [t, c] of bag(tokens)) s += (w.get(t) ?? 0.0) * c;
  return s;
}

function samplePair(rng: Random): [string, string[], string[]] {
  const x = rng.choice(PROMPTS);
  const yPos = [rng.choice(GOOD), rng.choice(GOOD)];
  const yNeg = [rng.choice(BAD), rng.choice(BAD)];
  return [x, yPos, yNeg];
}

function trainRm(nPairs = 500, lr = 0.1, rng: Random = new Random(0)): Weights {
  const w: Weights = new Map();
  for (let i = 0; i < nPairs; i++) {
    const [, yPos, yNeg] = samplePair(rng);
    const rPos = score(w, yPos);
    const rNeg = score(w, yNeg);
    const p = sigmoid(rPos - rNeg);
    const gradScale = 1 - p;
    for (const [t, c] of bag(yPos)) w.set(t, (w.get(t) ?? 0.0) + lr * gradScale * c);
    for (const [t, c] of bag(yNeg)) w.set(t, (w.get(t) ?? 0.0) - lr * gradScale * c);
  }
  return w;
}

function rmAccuracy(w: Weights, nPairs = 200, rng: Random = new Random(1)): number {
  let correct = 0;
  for (let i = 0; i < nPairs; i++) {
    const [, yPos, yNeg] = samplePair(rng);
    if (score(w, yPos) > score(w, yNeg)) correct += 1;
  }
  return correct / nPairs;
}

function softmax(z: number[]): number[] {
  const m = Math.max(...z);
  const exps = z.map((zi) => Math.exp(zi - m));
  let Z = 0;
  for (const e of exps) Z += e;
  return exps.map((e) => e / Z);
}

function policyProbs(theta: number[][], promptIdx: number): number[] {
  return softmax(theta[promptIdx]);
}

function sampleToken(probs: number[], rng: Random): number {
  const x = rng.random();
  let cum = 0.0;
  for (let i = 0; i < probs.length; i++) {
    cum += probs[i];
    if (x <= cum) return i;
  }
  return probs.length - 1;
}

function kl(p: number[], q: number[]): number {
  let total = 0.0;
  for (let i = 0; i < Math.min(p.length, q.length); i++) {
    if (p[i] <= 0) continue;
    total += p[i] * (Math.log(p[i]) - Math.log(Math.max(q[i], 1e-12)));
  }
  return total;
}

function rlhfLoop(
  w: Weights,
  updates = 300,
  beta = 0.1,
  lr = 0.05,
  eps = 0.2,
  rng: Random = new Random(7),
): [number[][], [number, number, number][]] {
  const theta = PROMPTS.map(() => VOCAB.map(() => 0.0));
  const reference = theta.map((row) => [...row]);

  const history: [number, number, number][] = [];
  for (let it = 0; it < updates; it++) {
    const rollouts: Rollout[] = [];
    for (let k = 0; k < 16; k++) {
      const pIdx = rng.randrange(PROMPTS.length);
      const probsNew = policyProbs(theta, pIdx);
      const token = sampleToken(probsNew, rng);
      const probsRef = policyProbs(reference, pIdx);
      const rmScore = w.get(VOCAB[token]) ?? 0.0;
      const klTerm = kl(probsNew, probsRef);
      const reward = rmScore - beta * klTerm;
      const logPiOld = Math.log(Math.max(probsNew[token], 1e-12));
      rollouts.push([pIdx, token, probsNew, reward, logPiOld, klTerm]);
    }

    const rewards = rollouts.map((rec) => rec[3]);
    let sr = 0;
    for (const r of rewards) sr += r;
    const meanR = sr / rewards.length;
    let vr = 0;
    for (const r of rewards) vr += (r - meanR) ** 2;
    const sdR = Math.sqrt(vr / rewards.length) + 1e-8;
    const advs = rewards.map((r) => (r - meanR) / sdR);

    rollouts.forEach(([pIdx, token, , , logPiOld], k) => {
      const adv = advs[k];
      const probs = policyProbs(theta, pIdx);
      const logp = Math.log(Math.max(probs[token], 1e-12));
      const ratio = Math.exp(logp - logPiOld);
      const clipped = (adv > 0 && ratio > 1 + eps) || (adv < 0 && ratio < 1 - eps);
      if (clipped) return;
      for (let i = 0; i < VOCAB.length; i++) {
        const grad = (i === token ? 1.0 : 0.0) - probs[i];
        theta[pIdx][i] += lr * ratio * adv * grad;
      }
    });

    let sk = 0;
    let sm = 0;
    for (const rec of rollouts) sk += rec[5];
    for (const rec of rollouts) sm += rec[3] + beta * rec[5];
    history.push([it + 1, sm / rollouts.length, sk / rollouts.length]);
  }
  return [theta, history];
}

function main(): void {
  const rng = new Random(42);
  const w = trainRm(600, 0.1, rng);

  console.log("=== Stage 1: reward model (Bradley-Terry pairwise logistic) ===");
  console.log();
  console.log("top positive-weight tokens:");
  const toks = [...w.keys()];
  for (const tok of [...toks].sort((a, b) => -w.get(a)! - -w.get(b)!).slice(0, 6)) {
    console.log(`  ${tok.padEnd(10)} w = ${signed(w.get(tok)!, 3)}`);
  }
  console.log();
  console.log("top negative-weight tokens:");
  for (const tok of [...toks].sort((a, b) => w.get(a)! - w.get(b)!).slice(0, 6)) {
    console.log(`  ${tok.padEnd(10)} w = ${signed(w.get(tok)!, 3)}`);
  }
  console.log();
  console.log(`RM pairwise accuracy on holdout (200 pairs) = ${rmAccuracy(w).toFixed(3)}`);
  console.log();

  console.log("=== Stage 2: PPO-RLHF against RM with KL penalty ===");
  console.log();
  for (const beta of [0.01, 0.1, 1.0]) {
    const [, hist] = rlhfLoop(w, 150, beta, 0.05, 0.2, new Random(0));
    const first = hist[0];
    const last = hist[hist.length - 1];
    console.log(
      `beta=${pyFloat(beta).padEnd(5)}  initial: RM=${signed(first[1], 3)} KL=${first[2].toFixed(3)}   final: RM=${signed(last[1], 3)} KL=${last[2].toFixed(3)}`,
    );
  }
}

main();
