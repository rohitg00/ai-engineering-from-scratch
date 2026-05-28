/**
 * Shadow + canary + progressive rollout — TypeScript port + policy engine.
 *
 * 3つの policies:
 *   1. Shadow mode: 各 request を candidate に複製し、delta を log する。
 *      candidate output は user に返さない。user exposure 前に cost/length
 *      regressions を捕まえる。
 *   2. Canary rollout: 5つの LLM-specific gates を持つ stage に沿って
 *      progressive traffic shift する。どれかの gate が breach した瞬間に止まる。
 *   3. Progressive policy: shadow → canary → 100% を組み合わせ、
 *      seconds-not-hours rollback を支える policy flag を持つ。
 *
 * さらに main.py と同じ canary simulator（6 stages、5 gates、6 regression scenarios）
 * を実行し、数値を再現する。
 *
 * Citations:
 *   - Argo Rollouts (Kubernetes progressive delivery)
 *     https://argo-rollouts.readthedocs.io/
 *   - Flagger (progressive delivery operator)
 *     https://docs.flagger.app/
 *   - docs/en.md で引用した run-to-run 約15%の non-determinism
 *     （GPU FP non-associativity + batch-size variance + sampling）。
 *
 * Node 20+ stdlib で動作する。npm deps は不要。
 */

// -- Baseline + gates ------------------------------------------------------

type Metrics = {
  latencyP99Ms: number;
  costPerReq: number;
  errorRate: number;
  outputLenP99: number;
  thumbsDownRate: number;
};

const BASELINE: Metrics = {
  latencyP99Ms: 900,
  costPerReq: 0.02,
  errorRate: 0.02,
  outputLenP99: 450,
  thumbsDownRate: 0.03,
};

// baseline を上回る breach multiplier。docs/en.md の LLM non-determinism
// noise floor（約15%）より上になるように設定する。
const GATES: Record<keyof Metrics, number> = {
  latencyP99Ms: 1.5,
  costPerReq: 1.2,
  errorRate: 2.0,
  outputLenP99: 1.4,
  thumbsDownRate: 1.5,
};

const STAGES = [0.01, 0.1, 0.25, 0.5, 0.75, 1.0];

// -- Mulberry32 PRNG ------------------------------------------------------

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

function stageSeed(i: number): number {
  return 11 + i * 3;
}

// -- Regression injector --------------------------------------------------

type Regression = {
  latencyMult: number;
  costMult: number;
  errorMult: number;
  outputLenMult: number;
  thumbsDownMult: number;
};

const NO_REGRESSION: Regression = {
  latencyMult: 1,
  costMult: 1,
  errorMult: 1,
  outputLenMult: 1,
  thumbsDownMult: 1,
};

function measureStage(_stage: number, reg: Regression, seed: number): Metrics {
  const rng = makeRng(seed);
  // noise floor は docs/en.md が説明する non-determinism: measurement ごとに約±8%。
  const noise = (v: number): number => v * (0.92 + rng() * 0.16);
  return {
    latencyP99Ms: noise(BASELINE.latencyP99Ms * reg.latencyMult),
    costPerReq: noise(BASELINE.costPerReq * reg.costMult),
    errorRate: noise(BASELINE.errorRate * reg.errorMult),
    outputLenP99: noise(BASELINE.outputLenP99 * reg.outputLenMult),
    thumbsDownRate: noise(BASELINE.thumbsDownRate * reg.thumbsDownMult),
  };
}

function checkGates(metrics: Metrics): (keyof Metrics)[] {
  const breaches: (keyof Metrics)[] = [];
  for (const k of Object.keys(GATES) as (keyof Metrics)[]) {
    if (metrics[k] > BASELINE[k] * GATES[k]) breaches.push(k);
  }
  return breaches;
}

// -- Policy engine --------------------------------------------------------

type ShadowSample = {
  baselineCost: number;
  candidateCost: number;
  baselineLatencyMs: number;
  candidateLatencyMs: number;
};

type ShadowReport = {
  n: number;
  meanCostDeltaPct: number;
  meanLatencyDeltaPct: number;
  // shadow だけで canary 前に halt する根拠がある場合 true。
  alert: boolean;
  reasons: string[];
};

function shadowEvaluate(samples: ShadowSample[]): ShadowReport {
  if (samples.length === 0) {
    return {
      n: 0,
      meanCostDeltaPct: 0,
      meanLatencyDeltaPct: 0,
      alert: false,
      reasons: [],
    };
  }
  let costDelta = 0;
  let latDelta = 0;
  let costN = 0;
  let latN = 0;
  for (const s of samples) {
    // baseline が non-positive の row は skip する。1件の zero row で average が
    // Infinity/NaN になり gate decision を壊さないようにするため。
    if (s.baselineCost > 0) {
      costDelta += (s.candidateCost - s.baselineCost) / s.baselineCost;
      costN++;
    }
    if (s.baselineLatencyMs > 0) {
      latDelta += (s.candidateLatencyMs - s.baselineLatencyMs) / s.baselineLatencyMs;
      latN++;
    }
  }
  const meanCost = costN > 0 ? (costDelta / costN) * 100 : 0;
  const meanLat = latN > 0 ? (latDelta / latN) * 100 : 0;
  const reasons: string[] = [];
  if (meanCost > 30) reasons.push(`cost +${meanCost.toFixed(1)}% (>30%)`);
  if (meanLat > 50) reasons.push(`latency +${meanLat.toFixed(1)}% (>50%)`);
  return {
    n: samples.length,
    meanCostDeltaPct: meanCost,
    meanLatencyDeltaPct: meanLat,
    alert: reasons.length > 0,
    reasons,
  };
}

type CanaryDecision = {
  promoted: boolean;
  stagesAdvanced: number;
  breaches: (keyof Metrics)[];
};

function canaryRollout(reg: Regression): CanaryDecision {
  for (let i = 0; i < STAGES.length; i++) {
    const metrics = measureStage(STAGES[i], reg, stageSeed(i));
    const breaches = checkGates(metrics);
    if (breaches.length > 0) {
      return { promoted: false, stagesAdvanced: i, breaches };
    }
  }
  return { promoted: true, stagesAdvanced: STAGES.length, breaches: [] };
}

// PolicyEngine は feature flag を wrap する。pinnedModel を candidate から
// baseline へ O(1) で戻す。LaunchDarkly/Flagsmith/Unleash の flag-flip
// rollback を反映している。
class PolicyEngine {
  private baselineDigest: string;
  private pinnedDigest: string;
  private rolloutPct = 0;

  constructor(initialDigest: string) {
    this.baselineDigest = initialDigest;
    this.pinnedDigest = initialDigest;
  }

  promote(candidateDigest: string, pct: number): void {
    this.pinnedDigest = candidateDigest;
    this.rolloutPct = pct;
  }

  // constant-time rollback。runbook が flip する操作。constructor 時点の
  // baseline（または直近 rollback override）へ repin する。
  rollback(baselineDigest?: string): void {
    if (baselineDigest !== undefined) this.baselineDigest = baselineDigest;
    this.pinnedDigest = this.baselineDigest;
    this.rolloutPct = 0;
  }

  pick(rng: () => number): { digest: string; chose: "baseline" | "candidate" } {
    return rng() < this.rolloutPct
      ? { digest: this.pinnedDigest, chose: "candidate" }
      : { digest: this.baselineDigest, chose: "baseline" };
  }
}

// -- Reporting ------------------------------------------------------------

function rolloutReport(name: string, reg: Regression): void {
  console.log(`\n${name}`);
  console.log(
    `Regression: latency=${reg.latencyMult}, cost=${reg.costMult}, error=${reg.errorMult}, len=${reg.outputLenMult}, thumbs=${reg.thumbsDownMult}`,
  );
  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i];
    const metrics = measureStage(stage, reg, stageSeed(i));
    const breaches = checkGates(metrics);
    const status =
      breaches.length === 0 ? "PASS" : `HALT (${breaches.join(",")})`;
    const pct = Math.round(stage * 100);
    console.log(
      `  stage ${String(pct).padStart(3)}%  ` +
        `lat_p99=${metrics.latencyP99Ms.toFixed(0).padStart(5)}  ` +
        `cost=$${metrics.costPerReq.toFixed(4)}  ` +
        `err=${(metrics.errorRate * 100).toFixed(1).padStart(4)}%  ` +
        `thumbs_dn=${(metrics.thumbsDownRate * 100).toFixed(1).padStart(4)}%  ` +
        `${status}`,
    );
    if (breaches.length > 0) {
      console.log("  → ROLLBACK (policy flip、pinned model reverted)");
      return;
    }
  }
  console.log("  → 100% へ PROMOTED");
}

// -- Demo ------------------------------------------------------------------

function shadowDemo(): void {
  console.log("--- Shadow-mode evaluation (zero user impact) ---");
  // 3つの scenarios: candidate がほぼ同等、candidate が安い、
  // candidate が40%高価（docs の canonical bad scenario）。
  const rng = makeRng(99);
  const mkSamples = (costMult: number, latMult: number): ShadowSample[] =>
    Array.from({ length: 200 }, () => ({
      baselineCost: 0.02 * (0.95 + rng() * 0.1),
      candidateCost: 0.02 * costMult * (0.95 + rng() * 0.1),
      baselineLatencyMs: 800 * (0.95 + rng() * 0.1),
      candidateLatencyMs: 800 * latMult * (0.95 + rng() * 0.1),
    }));

  const scenarios: { name: string; samples: ShadowSample[] }[] = [
    { name: "ほぼ同等の candidate", samples: mkSamples(1.05, 1.02) },
    { name: "candidate 20% cheaper", samples: mkSamples(0.8, 0.95) },
    { name: "candidate 40% more expensive (rollback case)", samples: mkSamples(1.4, 1.0) },
  ];

  for (const s of scenarios) {
    const r = shadowEvaluate(s.samples);
    console.log(
      `  ${s.name}: n=${r.n} cost_delta=${r.meanCostDeltaPct.toFixed(1)}%  ` +
        `lat_delta=${r.meanLatencyDeltaPct.toFixed(1)}%  ` +
        `alert=${r.alert}${r.reasons.length ? "  reasons=" + r.reasons.join("; ") : ""}`,
    );
  }
}

function policyEngineDemo(): void {
  console.log("\n--- PolicyEngine — promote then rollback in O(1) ---");
  const engine = new PolicyEngine("baseline-digest");
  engine.promote("candidate-digest-v2", 0.1);
  const rng = makeRng(42);
  let candidateCount = 0;
  for (let i = 0; i < 1000; i++) {
    if (engine.pick(rng).chose === "candidate") candidateCount++;
  }
  console.log(
    `  10% へ promote 後: ${candidateCount}/1000 picks が candidate を選択 (target ~100)`,
  );
  engine.rollback();
  let postCount = 0;
  for (let i = 0; i < 1000; i++) {
    if (engine.pick(rng).chose === "candidate") postCount++;
  }
  console.log(`  rollback 後: ${postCount}/1000 (target 0)`);
}

function canaryDemo(): void {
  console.log("\n" + "=".repeat(95));
  console.log("CANARY ROLLOUT — 6 stages、5 gates、injected regressions");
  console.log("=".repeat(95));

  rolloutReport("クリーンな昇格", NO_REGRESSION);
  rolloutReport("小さなコスト退行 (10%) — gate 内", {
    ...NO_REGRESSION,
    costMult: 1.1,
  });
  rolloutReport("コスト退行 25%", { ...NO_REGRESSION, costMult: 1.25 });
  rolloutReport("レイテンシ退行 80%", {
    ...NO_REGRESSION,
    latencyMult: 1.8,
  });
  rolloutReport("thumbs-down 退行 60%", {
    ...NO_REGRESSION,
    thumbsDownMult: 1.6,
  });
  rolloutReport("quality は静かに悪化 + cost creep", {
    ...NO_REGRESSION,
    costMult: 1.15,
    thumbsDownMult: 1.45,
  });

  // 同じ6 scenario に対する canaryRollout() の programmatic outcome。
  console.log("\n--- canaryRollout() programmatic verdict ---");
  const scenarios: { name: string; reg: Regression }[] = [
    { name: "clean", reg: NO_REGRESSION },
    { name: "cost 10%", reg: { ...NO_REGRESSION, costMult: 1.1 } },
    { name: "cost 25%", reg: { ...NO_REGRESSION, costMult: 1.25 } },
    { name: "latency 80%", reg: { ...NO_REGRESSION, latencyMult: 1.8 } },
    { name: "thumbs 60%", reg: { ...NO_REGRESSION, thumbsDownMult: 1.6 } },
    {
      name: "cost 15% + thumbs 45%",
      reg: { ...NO_REGRESSION, costMult: 1.15, thumbsDownMult: 1.45 },
    },
  ];
  for (const s of scenarios) {
    const d = canaryRollout(s.reg);
    const verdict = d.promoted
      ? "PROMOTED"
      : `HALT @ stage ${d.stagesAdvanced} on ${d.breaches.join(",")}`;
    console.log(`  ${s.name.padEnd(28)} → ${verdict}`);
  }
}

function main(): void {
  shadowDemo();
  policyEngineDemo();
  canaryDemo();
}

main();
