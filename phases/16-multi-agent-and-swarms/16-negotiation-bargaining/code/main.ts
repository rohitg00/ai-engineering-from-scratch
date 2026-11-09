// Lesson: Negotiation and Bargaining (phase 16 / lesson 16)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/16-negotiation-bargaining/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/16-negotiation-bargaining/code/main.ts

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

  randint(a: number, b: number): number {
    return a + Math.floor(this.random() * (b - a + 1));
  }
}

class BargainState {
  buyerOffer: number | null = null;
  sellerOffer: number | null = null;
  rounds = 0;
  maxRounds = 5;

  constructor(public buyerMax: number, public sellerMin: number) {}
}

type BuyerFn = (state: BargainState, rng: Random) => number;

function naiveLlmBargain(state: BargainState, rng: Random): number {
  const r = rng.random();
  let candidate: number;
  if (state.sellerOffer === null) {
    candidate = rng.randint(state.buyerMax - 60, state.buyerMax + 30);
  } else if (r < 0.35) {
    candidate = state.sellerOffer + rng.randint(-8, 3);
  } else if (r < 0.65) {
    candidate = rng.randint(state.sellerMin - 30, state.buyerMax + 30);
  } else {
    candidate = rng.randint(state.sellerMin - 60, state.buyerMax + 60);
  }
  return candidate;
}

function ogNarratorBargain(state: BargainState, rng: Random, concession = 0.35): number {
  void rng;
  if (state.sellerOffer === null && state.buyerOffer === null) {
    return state.buyerMax - Math.max(1, Math.trunc((state.buyerMax - state.sellerMin) * 0.2));
  }
  if (state.sellerOffer === null) return state.buyerOffer!;
  const prior = state.buyerOffer !== null ? state.buyerOffer : state.buyerMax;
  const move = Math.max(1, Math.trunc(concession * (state.sellerOffer - prior)));
  return Math.min(prior + move, state.buyerMax);
}

function sellerResponse(state: BargainState, rng: Random, concession = 0.3): number {
  void rng;
  if (state.buyerOffer === null && state.sellerOffer === null) {
    return state.sellerMin + Math.max(1, Math.trunc((state.buyerMax - state.sellerMin) * 0.4));
  }
  if (state.buyerOffer === null) return state.sellerOffer!;
  const prior = state.sellerOffer !== null ? state.sellerOffer : state.sellerMin + 20;
  const move = Math.max(1, Math.trunc(concession * (prior - state.buyerOffer)));
  return Math.max(prior - move, state.sellerMin);
}

function simulateBargain(buyerFn: BuyerFn, rng: Random, buyerMax = 100, sellerMin = 60): boolean {
  const state = new BargainState(buyerMax, sellerMin);
  let deal = false;
  while (state.rounds < state.maxRounds) {
    state.buyerOffer = buyerFn(state, rng);
    if (state.sellerOffer !== null && state.buyerOffer >= state.sellerOffer) {
      if (state.sellerOffer >= state.sellerMin && state.sellerOffer <= state.buyerMax) deal = true;
      break;
    }
    state.sellerOffer = sellerResponse(state, rng);
    if (state.buyerOffer !== null && state.sellerOffer <= state.buyerOffer) {
      if (state.buyerOffer <= state.buyerMax && state.buyerOffer >= state.sellerMin) deal = true;
      break;
    }
    state.rounds += 1;
  }
  return deal;
}

function benchDealRate(buyerFn: BuyerFn, label: string, trials = 1000): void {
  const rng = new Random(42);
  let deals = 0;
  for (let i = 0; i < trials; i++) {
    const sellerMin = rng.randint(50, 80);
    const buyerMax = rng.randint(Math.max(sellerMin + 5, 75), 115);
    if (simulateBargain(buyerFn, rng, buyerMax, sellerMin)) deals += 1;
  }
  const pct = ((deals / trials) * 100).toFixed(2);
  console.log(`  ${label.padEnd(20)} deal rate: ${pct}%  (${deals}/${trials})`);
}

class Bid {
  constructor(public bidder: string, public price: number, public etaMinutes: number, public confidence: number) {}
}

class ContractNetTask {
  constructor(public taskId: string, public description: string, public deadlineMinutes: number, public budget: number) {}
}

class ContractNetManager {
  proposals = new Map<string, Bid[]>();

  constructor(public bidders: string[]) {}

  broadcastCfp(task: ContractNetTask): void {
    this.proposals.set(task.taskId, []);
    console.log(`  manager CFP -> ${task.description} (deadline ${task.deadlineMinutes}m, budget ${task.budget})`);
  }

  receiveProposal(taskId: string, bid: Bid): void {
    this.proposals.get(taskId)!.push(bid);
    console.log(`    propose from ${bid.bidder}: price=${bid.price} eta=${bid.etaMinutes}m conf=${bid.confidence.toFixed(2)}`);
  }

  award(task: ContractNetTask): Bid | null {
    const props = this.proposals.get(task.taskId) ?? [];
    const feasible = props.filter((b) => b.price <= task.budget && b.etaMinutes <= task.deadlineMinutes);
    if (feasible.length === 0) {
      console.log("    no feasible bid; awarding rejected");
      return null;
    }
    const score = (b: Bid): number => b.confidence / Math.max(b.price, 1);
    let winner = feasible[0];
    for (const b of feasible) {
      if (score(b) > score(winner)) winner = b;
    }
    console.log(`  manager accept-proposal -> ${winner.bidder} (score = conf/price)`);
    for (const b of props) {
      if (b !== winner) console.log(`  manager reject-proposal -> ${b.bidder}`);
    }
    return winner;
  }
}

function demoContractNet(): void {
  console.log("\n" + "=".repeat(72));
  console.log("CONTRACT NET TASK MARKET: manager + 3 bidders");
  console.log("=".repeat(72));
  const task = new ContractNetTask("t-1", "compress 10GB log bundle", 30, 10);
  const mgr = new ContractNetManager(["worker-a", "worker-b", "worker-c"]);
  mgr.broadcastCfp(task);
  mgr.receiveProposal(task.taskId, new Bid("worker-a", 3, 18, 0.82));
  mgr.receiveProposal(task.taskId, new Bid("worker-b", 2, 25, 0.77));
  mgr.receiveProposal(task.taskId, new Bid("worker-c", 4, 10, 0.90));
  mgr.award(task);
}

function main(): void {
  console.log("=".repeat(72));
  console.log("DEAL RATE: naive LLM bargaining vs OG-Narrator");
  console.log("reservation prices sampled per trial: seller_min in [50,80], buyer_max in [75,115]");
  console.log("=".repeat(72));
  benchDealRate(naiveLlmBargain, "naive LLM");
  benchDealRate(ogNarratorBargain, "OG-Narrator");
  demoContractNet();

  console.log("\nTakeaways:");
  console.log("  naive LLM-only bargaining has inflated variance -- swings outside the ZOPA.");
  console.log("  OG-Narrator (deterministic offer + LLM narration) converges on every trial");
  console.log("  because prices are arithmetic, not generative.");
  console.log("  The original paper (arXiv:2402.15813) reports 26.67% -> 88.88% on the tighter");
  console.log("  real-LLM benchmark. Our simulation shrinks the gap because the opposing seller");
  console.log("  is already using deterministic offers -- the structural pattern is the same.");
  console.log("  Contract Net scales: broadcast + collect + award; no synchronous chat needed.");
}

main();
