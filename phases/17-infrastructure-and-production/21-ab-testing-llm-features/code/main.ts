// Lesson: A/B Testing LLM Features: GrowthBook, Statsig, and the Vibes Problem (phase 17 / lesson 21)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/21-ab-testing-llm-features/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/21-ab-testing-llm-features/code/main.ts

function fixed(x: number, digits: number): string {
  const rounded = x.toFixed(digits);
  if (Math.abs(x) >= 1e21) return rounded;
  const exact = x.toFixed(100);
  const dot = exact.indexOf(".");
  if (!/^50*$/.test(exact.slice(dot + 1 + digits))) return rounded;
  const kept = digits === 0 ? exact.slice(0, dot) : exact.slice(0, dot + 1 + digits);
  return Number(kept.slice(-1)) % 2 === 0 ? kept : rounded;
}

class Rng {
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

function zStatistic(successA: number, nA: number, successB: number, nB: number): number {
  const pA = nA ? successA / nA : 0;
  const pB = nB ? successB / nB : 0;
  const p = nA + nB ? (successA + successB) / (nA + nB) : 0;
  const se = nA && nB ? Math.sqrt(p * (1 - p) * (1 / nA + 1 / nB)) : 1;
  return se > 0 ? (pB - pA) / se : 0;
}

function fixedSampleSize(pBaseline: number, lift: number): number {
  const pTreat = pBaseline * (1 + lift);
  const zAlpha = 1.96;
  const zBeta = 0.84;
  const pBar = (pBaseline + pTreat) / 2;
  const num =
    (zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) + zBeta * Math.sqrt(pBaseline * (1 - pBaseline) + pTreat * (1 - pTreat))) ** 2;
  const den = (pTreat - pBaseline) ** 2;
  return Math.trunc(num / den);
}

interface SimResult {
  nA: number;
  nB: number;
  pAObserved: number;
  pBObserved: number;
  sequentialStopAt: number | null;
}

function simulate(pA: number, pB: number, seed = 7, maxN = 300_000): SimResult {
  const rng = new Rng(seed);
  let successA = 0;
  let successB = 0;
  let nA = 0;
  let nB = 0;
  let sequentialStoppedAt: number | null = null;
  for (let i = 0; i < maxN; i++) {
    const group = rng.random() < 0.5;
    if (group) {
      nB += 1;
      if (rng.random() < pB) successB += 1;
    } else {
      nA += 1;
      if (rng.random() < pA) successA += 1;
    }
    if (nA > 100 && nB > 100 && sequentialStoppedAt === null) {
      const z = zStatistic(successA, nA, successB, nB);
      const nTotal = nA + nB;
      const threshold = Math.sqrt(2 * Math.log(1 / 0.05) + Math.log(nTotal));
      if (Math.abs(z) > threshold) {
        sequentialStoppedAt = nTotal;
        break;
      }
    }
  }

  return {
    nA,
    nB,
    pAObserved: nA ? successA / nA : 0.0,
    pBObserved: nB ? successB / nB : 0.0,
    sequentialStopAt: sequentialStoppedAt,
  };
}

function printResult(result: SimResult): void {
  console.log(`  final n: A=${result.nA}, B=${result.nB}`);
  console.log(`  observed: p_a=${fixed(result.pAObserved * 100, 3)}%, p_b=${fixed(result.pBObserved * 100, 3)}%`);
  console.log(`  sequential stop at n=${result.sequentialStopAt ?? "None"}`);
}

function main(): void {
  console.log("=".repeat(80));
  console.log("SEQUENTIAL A/B: fixed vs always-valid, binary outcome");
  console.log("=".repeat(80));

  const baseline = 0.03;
  for (const lift of [0.02, 0.05, 0.1]) {
    const required = fixedSampleSize(baseline, lift);
    const adjusted = Math.trunc(required * 1.4);
    console.log(`\nBaseline ${fixed(baseline * 100, 0)}%, lift +${fixed(lift * 100, 0)}%:`);
    console.log(`  fixed sample size (traditional, 80% power, α=0.05): ${required}`);
    console.log(`  LLM-adjusted (×1.4 for non-determinism): ${adjusted}`);
  }

  console.log("\nSimulation: actual lift 5% (p_a=0.03, p_b=0.0315):");
  printResult(simulate(0.03, 0.0315));

  console.log("\nSimulation: actual lift 10% (p_a=0.03, p_b=0.033):");
  printResult(simulate(0.03, 0.033));

  console.log("\nSimulation: actual lift 50% (p_a=0.03, p_b=0.045), strong signal:");
  printResult(simulate(0.03, 0.045));

  console.log("\nRead: on strong signals the sequential bound fires early (the 50% lift");
  console.log("case above), and the returned n_a/n_b reflect samples *up to* the stop");
  console.log("point, not the full horizon. For small or zero effects the bound is");
  console.log("deliberately conservative: that is the Type-I guarantee.");
}

main();
