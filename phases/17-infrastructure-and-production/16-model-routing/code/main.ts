/**
 * Model routing — TypeScript port + rule-based router.
 *
 * 2つの部分:
 *   1. ModelRouter: (model catalog, request signals) に対する rule-based picker。
 *      各 rule は capability fit で candidates を score し、caller が渡す policy に
 *      従って latency vs cost vs capability を重み付けする。docs/en.md の4つの
 *      signal（task class、prompt length、hard set への similarity、
 *      self-confidence）に対応する。
 *   2. main.py と同じ cost/quality simulator:
 *      mixed-difficulty workload 上で NO_ROUTE / PRE_ROUTE / CASCADE を比較する。
 *
 * Citations:
 *   - RouteLLM (LMSYS): https://github.com/lm-sys/RouteLLM
 *   - OpenRouter recommendation/routing primitives: https://openrouter.ai/
 *   - LiteLLM router config with fallback + cost-routing (referenced in docs)
 *
 * Node 20+ stdlib で動作する。npm deps は不要。
 */

// -- Pricing (2026-04 approximations) -------------------------------------

const CHEAP_INPUT = 0.25;
const CHEAP_OUTPUT = 1.0;
const FRONTIER_INPUT = 3.0;
const FRONTIER_OUTPUT = 15.0;

// -- Model catalog + router primitive --------------------------------------

type Capability =
  | "chat"
  | "code"
  | "math"
  | "vision"
  | "long-context"
  | "tool-use";

type Model = {
  id: string;
  // Per-million-tokens。
  inputPrice: number;
  outputPrice: number;
  // P50 first-token latency (ms)。
  latencyMs: number;
  // 最大 context length (tokens)。
  contextWindow: number;
  // Capability bag。router の fit-scoring に使う。
  capabilities: Set<Capability>;
  // docs の rough mapping に基づく 0-1 scale の subjective quality。
  qualityFloor: number;
};

const CATALOG: Model[] = [
  {
    id: "haiku-class",
    inputPrice: CHEAP_INPUT,
    outputPrice: CHEAP_OUTPUT,
    latencyMs: 250,
    contextWindow: 200_000,
    capabilities: new Set<Capability>(["chat", "tool-use"]),
    qualityFloor: 0.75,
  },
  {
    id: "sonnet-class",
    inputPrice: 1.0,
    outputPrice: 5.0,
    latencyMs: 450,
    contextWindow: 200_000,
    capabilities: new Set<Capability>([
      "chat",
      "code",
      "tool-use",
      "long-context",
    ]),
    qualityFloor: 0.9,
  },
  {
    id: "frontier",
    inputPrice: FRONTIER_INPUT,
    outputPrice: FRONTIER_OUTPUT,
    latencyMs: 800,
    contextWindow: 1_000_000,
    capabilities: new Set<Capability>([
      "chat",
      "code",
      "math",
      "vision",
      "tool-use",
      "long-context",
    ]),
    qualityFloor: 1.0,
  },
];

type RouteSignals = {
  // 小さな upstream classifier から得た task class。
  taskClass: "simple" | "medium" | "hard";
  // おおよその prompt token count。
  promptTokens: number;
  // curated known-hard set への 0-1 cosine similarity。
  hardSetSimilarity: number;
  // この request に必要な capabilities。
  required: Capability[];
};

type RoutePolicy = {
  // 重みの合計は1。各 axis をどれだけ重視するか。
  weightCost: number;
  weightLatency: number;
  weightCapability: number;
  // 選ばれる model が満たすべき quality floor。
  minQuality: number;
};

type RouteDecision = {
  model: Model;
  estCost: number;
  reasoning: string;
};

class ModelRouter {
  private readonly catalog: readonly Model[];
  private readonly hardSetThreshold: number;

  constructor(catalog: readonly Model[], hardSetThreshold = 0.88) {
    this.catalog = catalog;
    this.hardSetThreshold = hardSetThreshold;
  }

  // model 上での request の blended cost を見積もる。caller が別の場所から
  // 実際の output estimate を渡さない限り、200 output tokens と仮定する。
  estCost(model: Model, promptTokens: number, outputTokens = 200): number {
    return (
      (promptTokens / 1e6) * model.inputPrice +
      (outputTokens / 1e6) * model.outputPrice
    );
  }

  // catalog を次の条件を満たす model に絞る:
  //  (a) required capability をすべて持つ
  //  (b) prompt が context window に収まる
  //  (c) policy quality floor を満たす
  candidates(signals: RouteSignals, policy: RoutePolicy): Model[] {
    return this.catalog.filter((m) => {
      for (const c of signals.required) if (!m.capabilities.has(c)) return false;
      if (signals.promptTokens > m.contextWindow) return false;
      if (m.qualityFloor < policy.minQuality) return false;
      return true;
    });
  }

  // weighted pick: lower cost / lower latency / higher capability fit が良い。
  // 'hard set' similarity は frontier へ short-circuit する（docs の rule に対応）。
  pick(signals: RouteSignals, policy: RoutePolicy): RouteDecision {
    if (signals.hardSetSimilarity >= this.hardSetThreshold) {
      const frontier = this.catalog.find((m) => m.id === "frontier");
      if (frontier) {
        return {
          model: frontier,
          estCost: this.estCost(frontier, signals.promptTokens),
          reasoning: `hard-set similarity ${signals.hardSetSimilarity.toFixed(2)} >= ${this.hardSetThreshold} — frontier に固定`,
        };
      }
    }

    const cands = this.candidates(signals, policy);
    if (cands.length === 0) {
      throw new Error("policy と required capabilities を満たす candidate model がありません");
    }
    // 公平な重み付けのために正規化する。
    const costs = cands.map((m) => this.estCost(m, signals.promptTokens));
    const latencies = cands.map((m) => m.latencyMs);
    const caps = cands.map((m) => m.capabilities.size);
    const maxCost = Math.max(...costs);
    const maxLat = Math.max(...latencies);
    const maxCap = Math.max(...caps);

    let bestIdx = 0;
    let bestScore = -Infinity;
    let bestReason = "";
    for (let i = 0; i < cands.length; i++) {
      const costScore = 1 - costs[i] / (maxCost || 1);
      const latScore = 1 - latencies[i] / (maxLat || 1);
      const capScore = caps[i] / (maxCap || 1);
      const score =
        policy.weightCost * costScore +
        policy.weightLatency * latScore +
        policy.weightCapability * capScore;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
        bestReason =
          `cost=${costScore.toFixed(2)} latency=${latScore.toFixed(2)} cap=${capScore.toFixed(2)} ` +
          `weighted=${score.toFixed(3)}`;
      }
    }

    return {
      model: cands[bestIdx],
      estCost: costs[bestIdx],
      reasoning: bestReason,
    };
  }
}

// -- Workload + simulator (matches main.py) --------------------------------

type Difficulty = "simple" | "medium" | "hard";
type Query = {
  difficulty: Difficulty;
  promptTokens: number;
  outputTokens: number;
};

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randint(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function makeWorkload(n = 1000, seed = 7): Query[] {
  const rng = makeRng(seed);
  const reqs: Query[] = [];
  for (let i = 0; i < n; i++) {
    const p = rng();
    if (p < 0.6) {
      reqs.push({
        difficulty: "simple",
        promptTokens: randint(rng, 200, 1000),
        outputTokens: randint(rng, 50, 200),
      });
    } else if (p < 0.9) {
      reqs.push({
        difficulty: "medium",
        promptTokens: randint(rng, 800, 3000),
        outputTokens: randint(rng, 100, 400),
      });
    } else {
      reqs.push({
        difficulty: "hard",
        promptTokens: randint(rng, 2000, 8000),
        outputTokens: randint(rng, 200, 1500),
      });
    }
  }
  return reqs;
}

function costOf(route: "cheap" | "frontier", q: Query): number {
  if (route === "cheap") {
    return (
      (q.promptTokens / 1e6) * CHEAP_INPUT +
      (q.outputTokens / 1e6) * CHEAP_OUTPUT
    );
  }
  return (
    (q.promptTokens / 1e6) * FRONTIER_INPUT +
    (q.outputTokens / 1e6) * FRONTIER_OUTPUT
  );
}

function quality(route: "cheap" | "frontier", q: Query): number {
  if (route === "frontier") return 1.0;
  return { simple: 0.99, medium: 0.92, hard: 0.75 }[q.difficulty];
}

type SimRow = {
  pattern: string;
  cost: number;
  meanQuality: number;
  escalated: number;
};

function simulate(pattern: string, reqs: readonly Query[]): SimRow {
  let totalCost = 0;
  let totalQ = 0;
  let escalated = 0;
  const rng = makeRng(11);

  for (const q of reqs) {
    if (pattern === "NO_ROUTE") {
      totalCost += costOf("frontier", q);
      totalQ += 1.0;
    } else if (pattern === "PRE_ROUTE") {
      if (q.difficulty === "simple") {
        totalCost += costOf("cheap", q);
        totalQ += quality("cheap", q);
      } else {
        totalCost += costOf("frontier", q);
        totalQ += 1.0;
      }
    } else if (pattern === "CASCADE") {
      totalCost += costOf("cheap", q);
      const confident =
        q.difficulty === "simple" ||
        (q.difficulty === "medium" && rng() < 0.5);
      if (confident) {
        totalQ += quality("cheap", q);
      } else {
        escalated++;
        totalCost += costOf("frontier", q);
        totalQ += 1.0;
      }
    }
  }

  return {
    pattern,
    cost: totalCost,
    meanQuality: totalQ / reqs.length,
    escalated,
  };
}

function reportRow(row: SimRow, baseline: number): void {
  const save = ((baseline - row.cost) / baseline) * 100;
  console.log(
    `${row.pattern.padEnd(12)}  cost=$${row.cost.toFixed(2).padStart(7)}  ` +
      `saving=${save.toFixed(1).padStart(5)}%  ` +
      `quality=${(row.meanQuality * 100).toFixed(1).padStart(5)}%  ` +
      `escalated=${String(row.escalated).padStart(4)}`,
  );
}

// -- Demos -----------------------------------------------------------------

function routerDemo(): void {
  console.log("--- Rule-based ModelRouter ---");
  const router = new ModelRouter(CATALOG);

  const balanced: RoutePolicy = {
    weightCost: 0.5,
    weightLatency: 0.2,
    weightCapability: 0.3,
    minQuality: 0.7,
  };
  const latencyFirst: RoutePolicy = {
    weightCost: 0.1,
    weightLatency: 0.7,
    weightCapability: 0.2,
    minQuality: 0.7,
  };

  const cases: { name: string; signals: RouteSignals; policy: RoutePolicy }[] = [
    {
      name: "FAQ風の短い prompt (balanced policy)",
      signals: {
        taskClass: "simple",
        promptTokens: 400,
        hardSetSimilarity: 0.2,
        required: ["chat"],
      },
      policy: balanced,
    },
    {
      name: "tool use 付き code-gen (balanced)",
      signals: {
        taskClass: "medium",
        promptTokens: 2500,
        hardSetSimilarity: 0.4,
        required: ["chat", "code", "tool-use"],
      },
      policy: balanced,
    },
    {
      name: "known-hard set に近い math (frontier 自動固定)",
      signals: {
        taskClass: "hard",
        promptTokens: 1500,
        hardSetSimilarity: 0.92,
        required: ["chat", "math"],
      },
      policy: balanced,
    },
    {
      name: "long-context 800K tokens (frontier のみ収まる)",
      signals: {
        taskClass: "hard",
        promptTokens: 800_000,
        hardSetSimilarity: 0.1,
        required: ["chat", "long-context"],
      },
      policy: balanced,
    },
    {
      name: "FAQ風の短い prompt (latency-first)",
      signals: {
        taskClass: "simple",
        promptTokens: 300,
        hardSetSimilarity: 0.1,
        required: ["chat"],
      },
      policy: latencyFirst,
    },
  ];

  for (const c of cases) {
    const d = router.pick(c.signals, c.policy);
    console.log(`  ${c.name}`);
    console.log(
      `    → ${d.model.id}  est_cost=$${d.estCost.toFixed(5)}  reason=${d.reasoning}`,
    );
  }
}

function patternsDemo(): void {
  console.log("\n" + "=".repeat(80));
  console.log("MODEL ROUTING — 3 patterns、1000 requests、mixed difficulty");
  console.log("=".repeat(80));
  const reqs = makeWorkload();
  const baseline = simulate("NO_ROUTE", reqs).cost;
  for (const p of ["NO_ROUTE", "PRE_ROUTE", "CASCADE"]) {
    reportRow(simulate(p, reqs), baseline);
  }
  console.log(
    "\n読み方: classifier が正確なら PRE_ROUTE は大きく節約する。CASCADE は",
  );
  console.log(
    "quality floor を保証するが、escalated requests では latency が増える。",
  );
}

function main(): void {
  routerDemo();
  patternsDemo();
}

main();
