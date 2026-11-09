// Lesson: Agent Economies, Token Incentives, Reputation (phase 16 / lesson 21)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/21-agent-economies/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/21-agent-economies/code/main.ts

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

function uniform(rng: Random, a: number, b: number): number {
  return a + (b - a) * rng();
}

function choice<T>(rng: Random, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function shuffle<T>(rng: Random, items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function signed(x: number, digits: number): string {
  return (x >= 0 ? "+" : "") + x.toFixed(digits);
}

type Coalition = ReadonlySet<string>;
type ValueFn = (s: Coalition) => number;

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) {
    return [items.slice()];
  }
  const out: T[][] = [];
  items.forEach((item, i) => {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) {
      out.push([item, ...p]);
    }
  });
  return out;
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) {
    r *= i;
  }
  return r;
}

function shapleyExact(valueFn: ValueFn, agents: string[]): Map<string, number> {
  const n = agents.length;
  const contribs = new Map(agents.map((a) => [a, 0.0]));
  for (const order of permutations(agents)) {
    const visited = new Set<string>();
    let prevValue = valueFn(new Set(visited));
    for (const a of order) {
      visited.add(a);
      const newValue = valueFn(new Set(visited));
      contribs.set(a, contribs.get(a)! + (newValue - prevValue));
      prevValue = newValue;
    }
  }
  const f = factorial(n);
  return new Map([...contribs].map(([a, v]) => [a, v / f]));
}

function shapleySampled(
  valueFn: ValueFn,
  agents: string[],
  samples: number,
  rng: Random,
): Map<string, number> {
  const contribs = new Map(agents.map((a) => [a, 0.0]));
  for (let s = 0; s < samples; s++) {
    const order = [...agents];
    shuffle(rng, order);
    const visited = new Set<string>();
    let prevValue = valueFn(new Set(visited));
    for (const a of order) {
      visited.add(a);
      const newValue = valueFn(new Set(visited));
      contribs.set(a, contribs.get(a)! + (newValue - prevValue));
      prevValue = newValue;
    }
  }
  return new Map([...contribs].map(([a, v]) => [a, v / samples]));
}

interface Bid {
  bidder: string;
  value: number;
}

function secondPrice(bids: Bid[]): [string, number] | null {
  if (bids.length < 2) {
    return null;
  }
  const sortedBids = [...bids].sort((a, b) => b.value - a.value);
  const winner = sortedBids[0].bidder;
  const payment = sortedBids[1].value;
  return [winner, payment];
}

class Reputation {
  scores = new Map<string, number>();

  constructor(public alpha = 0.95, public floor = 0.1) {}

  init(agents: string[]): void {
    for (const a of agents) {
      this.scores.set(a, 1.0);
    }
  }

  update(agent: string, quality: number): void {
    const current = this.scores.get(agent) ?? 1.0;
    this.scores.set(agent, Math.max(this.floor, this.alpha * current + (1 - this.alpha) * quality));
  }

  weights(agents: string[]): number[] {
    return agents.map((a) => this.scores.get(a) ?? 1.0);
  }
}

function weightedChoice(agents: string[], weights: number[], rng: Random): string {
  const total = weights.reduce((s, w) => s + w, 0);
  const r = rng() * total;
  let upto = 0.0;
  for (let i = 0; i < agents.length; i++) {
    upto += weights[i];
    if (r <= upto) {
      return agents[i];
    }
  }
  return agents[agents.length - 1];
}

function coalitionKey(s: Iterable<string>): string {
  return [...s].sort().join("|");
}

function demoShapley(): void {
  console.log("=".repeat(72));
  console.log("SHAPLEY ATTRIBUTION: 3 agents collaborate on a task");
  console.log("=".repeat(72));

  const base = new Map<string, number>([
    [coalitionKey([]), 0.0],
    [coalitionKey(["coder"]), 0.5],
    [coalitionKey(["researcher"]), 0.3],
    [coalitionKey(["reviewer"]), 0.1],
    [coalitionKey(["coder", "researcher"]), 0.85],
    [coalitionKey(["coder", "reviewer"]), 0.7],
    [coalitionKey(["researcher", "reviewer"]), 0.55],
    [coalitionKey(["coder", "researcher", "reviewer"]), 1.0],
  ]);
  const valueFn: ValueFn = (s) => base.get(coalitionKey(s))!;
  const agents = ["coder", "researcher", "reviewer"];

  const exact = shapleyExact(valueFn, agents);
  console.log("  exact Shapley values:");
  for (const [a, v] of exact) {
    console.log(`    ${a.padEnd(11)} ${v.toFixed(4)}`);
  }
  let sum = 0;
  for (const v of exact.values()) {
    sum += v;
  }
  console.log(`    sum = ${sum.toFixed(4)} (should equal grand coalition value 1.0000)`);

  const rng = mulberry32(0);
  const sampled = shapleySampled(valueFn, agents, 200, rng);
  console.log("\n  sampled Shapley values (N=200):");
  for (const [a, v] of sampled) {
    console.log(`    ${a.padEnd(11)} ${v.toFixed(4)}`);
  }
}

function demoAuction(): void {
  console.log("\n" + "=".repeat(72));
  console.log("SECOND-PRICE AUCTION: 5 bidders compete for a task slot");
  console.log("=".repeat(72));
  const bids: Bid[] = [
    { bidder: "agent-a", value: 0.82 },
    { bidder: "agent-b", value: 0.6 },
    { bidder: "agent-c", value: 0.95 },
    { bidder: "agent-d", value: 0.45 },
    { bidder: "agent-e", value: 0.77 },
  ];
  for (const b of bids) {
    console.log(`  ${b.bidder.padEnd(10)} bids ${b.value.toFixed(2)}`);
  }
  const result = secondPrice(bids);
  if (result) {
    const [winner, payment] = result;
    console.log(`\n  winner: ${winner}  payment: ${payment.toFixed(2)}`);
    console.log("  (winner pays second-highest bid; this is truthful)");
  }
}

function demoReputationRouting(): void {
  console.log("\n" + "=".repeat(72));
  console.log("REPUTATION-WEIGHTED ROUTING: 100 tasks, 4 agents, 50 warmup");
  console.log("=".repeat(72));
  const agents = ["alpha", "beta", "gamma", "delta"];
  const trueQuality: Record<string, number> = { alpha: 0.9, beta: 0.5, gamma: 0.75, delta: 0.3 };

  let rng = mulberry32(0);

  let randomQuality = 0.0;
  for (let i = 0; i < 100; i++) {
    const a = choice(rng, agents);
    const q = Math.max(0.0, Math.min(1.0, trueQuality[a] + uniform(rng, -0.1, 0.1)));
    randomQuality += q;
  }

  rng = mulberry32(0);
  const rep = new Reputation();
  rep.init(agents);
  let repQuality = 0.0;
  for (let i = 0; i < 100; i++) {
    let a: string;
    if (i < 50) {
      a = choice(rng, agents);
    } else {
      a = weightedChoice(agents, rep.weights(agents), rng);
    }
    const q = Math.max(0.0, Math.min(1.0, trueQuality[a] + uniform(rng, -0.1, 0.1)));
    rep.update(a, q);
    repQuality += q;
  }

  console.log(`  random routing avg quality:   ${(randomQuality / 100).toFixed(3)}`);
  console.log(`  rep-weighted routing:         ${(repQuality / 100).toFixed(3)}`);
  console.log(`  improvement: ${signed(((repQuality - randomQuality) / randomQuality) * 100, 1)}%`);
  console.log("\n  final reputation scores:");
  for (const a of agents) {
    console.log(`    ${a.padEnd(8)} rep=${rep.scores.get(a)!.toFixed(3)}  true=${trueQuality[a].toFixed(2)}`);
  }
}

function main(): void {
  demoShapley();
  demoAuction();
  demoReputationRouting();
  console.log("\nTakeaways:");
  console.log("  Shapley is fair but expensive. Sample for N > 6.");
  console.log("  Second-price auctions are truthful under monotone aggregation (Google Research).");
  console.log("  Reputation capital closes the loop: good routing + decay + slashing.");
}

main();

export {};
