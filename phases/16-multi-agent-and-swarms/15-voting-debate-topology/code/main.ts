// Lesson: Voting, Self-Consistency, and Debate Topology (phase 16 / lesson 15)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/15-voting-debate-topology/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/15-voting-debate-topology/code/main.ts

export {};

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
}

class SimAgent {
  constructor(
    public name: string,
    public baseAccuracy: number,
    public errorBias: string,
    public tokensPerCall = 400,
  ) {}

  answer(correct: string, rng: Random): string {
    return rng.random() < this.baseAccuracy ? correct : this.errorBias;
  }
}

class RunResult {
  constructor(
    public topology: string,
    public n: number,
    public finalAnswer: string,
    public correct: string,
    public tokens: number,
    public steps: number,
  ) {}

  accuracy(): number {
    return this.finalAnswer === this.correct ? 1 : 0;
  }
}

function majority(items: string[]): string {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  let best = "";
  let bestVal = -1;
  for (const [k, v] of counts) {
    if (v > bestVal) {
      best = k;
      bestVal = v;
    }
  }
  return best;
}

function sumTokens(agents: SimAgent[]): number {
  return agents.reduce((s, a) => s + a.tokensPerCall, 0);
}

function runStar(agents: SimAgent[], correct: string, rng: Random): RunResult {
  const hub = agents[0];
  const workers = agents.slice(1);
  const answers = workers.map((w) => w.answer(correct, rng));
  const tokens = sumTokens(workers) + hub.tokensPerCall;
  const final = answers.length > 0 ? majority(answers) : hub.answer(correct, rng);
  return new RunResult("star", agents.length, final, correct, tokens, 2);
}

function runChain(agents: SimAgent[], correct: string, rng: Random): RunResult {
  let current = agents[0].answer(correct, rng);
  let tokens = agents[0].tokensPerCall;
  for (const a of agents.slice(1)) {
    const proposal = a.answer(correct, rng);
    current = proposal !== current && rng.random() < a.baseAccuracy ? proposal : current;
    tokens += a.tokensPerCall;
  }
  return new RunResult("chain", agents.length, current, correct, tokens, agents.length);
}

function runTree(agents: SimAgent[], correct: string, rng: Random): RunResult {
  const root = agents[0];
  const leaves = agents.slice(1);
  if (leaves.length <= 1) return runStar(agents, correct, rng);
  const mid = Math.floor(leaves.length / 2);
  const leftAnswers = leaves.slice(0, mid).map((a) => a.answer(correct, rng));
  const rightAnswers = leaves.slice(mid).map((a) => a.answer(correct, rng));
  const tokens = sumTokens(leaves) + root.tokensPerCall;
  const leftConsensus = majority(leftAnswers);
  const rightConsensus = majority(rightAnswers);
  const final = majority([leftConsensus, rightConsensus]);
  return new RunResult("tree", agents.length, final, correct, tokens, 3);
}

function runGraph(agents: SimAgent[], correct: string, rng: Random, rounds = 2): RunResult {
  let positions = agents.map((a) => a.answer(correct, rng));
  let tokens = sumTokens(agents);
  for (let r = 0; r < rounds - 1; r++) {
    const majorityNow = majority(positions);
    const newPositions: string[] = [];
    positions.forEach((pos, i) => {
      if (pos !== majorityNow && rng.random() < 0.4) {
        newPositions.push(majorityNow);
      } else {
        newPositions.push(pos);
      }
      tokens += agents[i].tokensPerCall;
    });
    positions = newPositions;
  }
  return new RunResult("graph", agents.length, majority(positions), correct, tokens, rounds * 2);
}

function makeAgents(n: number, heterogeneous: boolean, seed: number): SimAgent[] {
  void seed;
  let biases: string[];
  let accuracies: number[];
  if (heterogeneous) {
    biases = ["WRONG-A", "WRONG-B", "WRONG-C"];
    accuracies = [0.72, 0.70, 0.74, 0.71, 0.73, 0.70, 0.72];
  } else {
    biases = ["WRONG-A"];
    accuracies = new Array<number>(7).fill(0.72);
  }
  const out: SimAgent[] = [];
  for (let i = 0; i < n; i++) {
    out.push(new SimAgent(`agent-${i}`, accuracies[i % accuracies.length], biases[i % biases.length]));
  }
  return out;
}

function bench(correct: string, trials: number, heterogeneous: boolean): void {
  const tag = heterogeneous ? "HETEROGENEOUS" : "HOMOGENEOUS (monoculture)";
  console.log("\n" + "=".repeat(72));
  console.log(`BENCHMARK: ${tag}`);
  console.log("=".repeat(72));
  console.log(`${"topology".padEnd(10)} ${"N".padStart(3)} ${"acc".padStart(8)} ${"avg_tokens".padStart(12)} ${"steps".padStart(6)}`);
  for (const topology of ["star", "chain", "tree", "graph"]) {
    for (const n of [3, 5, 7]) {
      let accSum = 0;
      let tokSum = 0;
      let stepSum = 0;
      for (let t = 0; t < trials; t++) {
        const agents = makeAgents(n, heterogeneous, t);
        const rng = new Random(t * 31 + 7);
        let r: RunResult;
        if (topology === "star") {
          r = runStar(agents, correct, rng);
        } else if (topology === "chain") {
          r = runChain(agents, correct, rng);
        } else if (topology === "tree") {
          r = runTree(agents, correct, rng);
        } else {
          r = runGraph(agents, correct, rng);
        }
        accSum += r.accuracy();
        tokSum += r.tokens;
        stepSum += r.steps;
      }
      const acc = (accSum / trials).toFixed(2).padStart(8);
      const tok = String(Math.floor(tokSum / trials)).padStart(12);
      const steps = String(Math.floor(stepSum / trials)).padStart(6);
      console.log(`${topology.padEnd(10)} ${String(n).padStart(3)} ${acc} ${tok} ${steps}`);
    }
  }
}

function main(): void {
  bench("RIGHT", 200, false);
  bench("RIGHT", 200, true);
  console.log("\nTakeaways:");
  console.log("  heterogeneous ensembles outperform homogeneous at every topology/N.");
  console.log("  graph/N=7 shows coordination tax: tokens inflate ~7x over star/N=3.");
  console.log("  star is the cost-sweet-spot for low-stakes aggregation.");
  console.log("  chain underperforms on monoculture because one bias propagates along the chain.");
}

main();
