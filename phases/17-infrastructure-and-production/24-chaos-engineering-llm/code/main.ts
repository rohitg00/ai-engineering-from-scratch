// Lesson: Chaos Engineering for LLM Production (phase 17 / lesson 24)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/24-chaos-engineering-llm/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/24-chaos-engineering-llm/code/main.ts

function fixed(x: number, digits: number): string {
  const rounded = x.toFixed(digits);
  if (Math.abs(x) >= 1e21) return rounded;
  const exact = x.toFixed(100);
  const dot = exact.indexOf(".");
  if (!/^50*$/.test(exact.slice(dot + 1 + digits))) return rounded;
  const kept = digits === 0 ? exact.slice(0, dot) : exact.slice(0, dot + 1 + digits);
  return Number(kept.slice(-1)) % 2 === 0 ? kept : rounded;
}

const rj = (s: string | number, w: number): string => String(s).padStart(w);
const lj = (s: string, w: number): string => s.padEnd(w);

const ERROR_BUDGET_PER_DAY = 0.001;
const EXPECTED_ERROR_RATE = 0.0005;

interface Experiment {
  name: string;
  durationMin: number;
  inducedErrorRate: number;
  blastRadiusPct: number;
}

const EXPERIMENTS: Experiment[] = [
  { name: "pod kill (1 decode replica)", durationMin: 5, inducedErrorRate: 0.002, blastRadiusPct: 0.05 },
  { name: "provider 429 fallback", durationMin: 5, inducedErrorRate: 0.015, blastRadiusPct: 0.3 },
  { name: "malformed prompt tokenizer stall", durationMin: 3, inducedErrorRate: 0.04, blastRadiusPct: 0.1 },
];

interface Result {
  experiment: string;
  duration: number;
  errorRate: number;
  burnRateX: number;
  blastRadius: number;
  pausedBySafetyPlane: boolean;
  status: string;
}

function runExperiment(e: Experiment): Result {
  const burnRate = e.inducedErrorRate / Math.max(EXPECTED_ERROR_RATE, 0.0001);
  const paused = burnRate > 2.0 && e.blastRadiusPct > 0.2;
  return {
    experiment: e.name,
    duration: e.durationMin,
    errorRate: e.inducedErrorRate,
    burnRateX: burnRate,
    blastRadius: e.blastRadiusPct,
    pausedBySafetyPlane: paused,
    status: paused ? "ABORTED (burn-rate guard)" : "COMPLETED",
  };
}

function main(): void {
  console.log("=".repeat(90));
  console.log("CHAOS EXPERIMENT RUNNER: safety plane gates burn-rate × blast-radius");
  console.log("=".repeat(90));
  console.log(`SLO error budget: ${fixed(ERROR_BUDGET_PER_DAY * 100, 2)}%/day`);
  console.log(`Expected baseline error rate: ${fixed(EXPECTED_ERROR_RATE * 100, 3)}%`);
  console.log("Burn-rate gate: > 2.0x expected AND blast radius > 20%\n");

  const header = `${lj("Experiment", 38)}  ${rj("mins", 4)}  ${rj("err %", 6)}  ${rj("burn×", 6)}  ${rj("blast", 6)}  Status`;
  console.log(header);
  console.log("-".repeat(header.length));
  for (const e of EXPERIMENTS) {
    const r = runExperiment(e);
    console.log(
      `${lj(r.experiment, 38)}  ${rj(r.duration, 4)}  ` +
        `${rj(fixed(r.errorRate * 100, 2), 5)}%  ` +
        `${rj(fixed(r.burnRateX, 1), 5)}x  ` +
        `${rj(fixed(r.blastRadius * 100, 0), 5)}%  ` +
        `${r.status}`,
    );
  }

  console.log("\nRead: small-blast-radius experiments run to completion even at high burn rate.");
  console.log("Large-blast-radius + high burn → abort. Suppression windows + trace-ID tags");
  console.log("required to dedupe alerts during experiments.");
}

main();
