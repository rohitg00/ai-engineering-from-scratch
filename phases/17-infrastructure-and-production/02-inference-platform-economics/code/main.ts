// Lesson: Inference Platform Economics: Fireworks, Together, Baseten, Modal, Replicate, Anyscale (phase 17 / lesson 02)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/02-inference-platform-economics/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/02-inference-platform-economics/code/main.ts

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

interface Vendor {
  name: string;
  model: string;
  perMtokOutput: number | null;
  perMinute: number | null;
  perPrediction: number | null;
  tokensPerMinute: number;
  coldStartSec: number;
  notes: string;
  minReservedMinutesPerDay: number;
}

function vendor(
  name: string,
  model: string,
  perMtokOutput: number | null,
  perMinute: number | null,
  perPrediction: number | null,
  tokensPerMinute: number,
  coldStartSec: number,
  notes: string,
  minReservedMinutesPerDay = 0,
): Vendor {
  return { name, model, perMtokOutput, perMinute, perPrediction, tokensPerMinute, coldStartSec, notes, minReservedMinutesPerDay };
}

const VENDORS: Vendor[] = [
  vendor("Fireworks", "Llama 70B", 0.9, null, null, 900_000, 1.5, "FireAttention, batch tier 50% off"),
  vendor("Together", "Llama 70B", 0.88, null, null, 850_000, 2.0, "200+ models, 50-70% below Replicate"),
  vendor("Baseten", "Custom Llama 70B", null, 0.55, null, 900_000, 5.0, "Truss, SOC2 HIPAA, per-min billing", 1440),
  vendor("Modal", "Custom Llama 70B", null, 0.48, null, 800_000, 2.5, "Python-native, per-sec billing, 60min warm-pool floor", 60),
  vendor("Replicate", "Llama 70B", null, null, 0.006, 750_000, 4.0, "Pay-per-prediction, multimodal"),
  vendor("Anyscale", "Llama 70B RayTurbo", null, 0.6, null, 850_000, 3.0, "Ray-native, distributed Python", 1440),
];

function costPerDay(v: Vendor, tokensPerDay: number, predictionsPerDay: number): number {
  if (v.perMtokOutput !== null) return (tokensPerDay / 1e6) * v.perMtokOutput;
  if (v.perMinute !== null) {
    const saturatedMinutes = tokensPerDay / v.tokensPerMinute;
    const minutes = Math.max(saturatedMinutes, v.minReservedMinutesPerDay);
    return minutes * v.perMinute;
  }
  if (v.perPrediction !== null) return predictionsPerDay * v.perPrediction;
  return 0.0;
}

function effectiveRate(v: Vendor, tokensPerDay: number, predictionsPerDay: number): number {
  const c = costPerDay(v, tokensPerDay, predictionsPerDay);
  return tokensPerDay ? c / (tokensPerDay / 1e6) : 0;
}

function runScenario(label: string, tokensPerDay: number, predictionsPerDay: number): void {
  console.log(`\n${label}`);
  console.log(`Workload: ${fixed(tokensPerDay / 1e6, 1)}M output tokens/day  |  ${predictionsPerDay} predictions/day`);
  const header = `${lj("Vendor", 12)}  ${lj("Model", 22)}  ${rj("$/day", 8)}  ${rj("$/M tok", 10)}  Notes`;
  console.log(header);
  console.log("-".repeat(header.length));
  for (const v of VENDORS) {
    const cost = costPerDay(v, tokensPerDay, predictionsPerDay);
    const rate = effectiveRate(v, tokensPerDay, predictionsPerDay);
    console.log(`${lj(v.name, 12)}  ${lj(v.model, 22)}  $${rj(fixed(cost, 2), 7)}  $${rj(fixed(rate, 2), 9)}  ${v.notes}`);
  }
}

function utilizationBreakeven(): void {
  console.log("\n" + "=".repeat(80));
  console.log("PER-TOKEN vs PER-MINUTE BREAK-EVEN: Fireworks (per-token) vs Baseten (per-min)");
  console.log("=".repeat(80));
  const fw = VENDORS[0];
  const bt = VENDORS[2];
  console.log(
    `Fireworks: $${fixed(fw.perMtokOutput ?? 0, 2)}/M output  |  Baseten: $${fixed(bt.perMinute ?? 0, 2)}/min, ${fixed(bt.tokensPerMinute / 1e3, 0)}k tok/min\n`,
  );
  console.log(`${rj("Util %", 8)}  ${rj("Fireworks $/day", 16)}  ${rj("Baseten $/day", 14)}  Winner`);
  for (const utilPct of [5, 10, 15, 20, 25, 30, 35, 40, 50, 75, 100]) {
    const tokensPerDay = Math.trunc((bt.tokensPerMinute * 60 * 24 * utilPct) / 100);
    const fwCost = costPerDay(fw, tokensPerDay, 0);
    const btCost = costPerDay(bt, tokensPerDay, 0);
    const winner = btCost < fwCost ? "Baseten" : "Fireworks";
    console.log(`${rj(utilPct, 7)}%  $${rj(fixed(fwCost, 2), 15)}  $${rj(fixed(btCost, 2), 13)}  ${winner}`);
  }
}

function coldStartPenalty(): void {
  console.log("\n" + "=".repeat(80));
  console.log("COLD START PENALTY: bursty workload");
  console.log("=".repeat(80));
  console.log(`${lj("Vendor", 12)}  ${rj("Cold start", 11)}  Impact at 100 cold invocations/day`);
  for (const v of VENDORS) {
    const impactSec = v.coldStartSec * 100;
    console.log(`${lj(v.name, 12)}  ${rj(fixed(v.coldStartSec, 1), 8)} s   +${fixed(impactSec, 0)} seconds/day of extra latency`);
  }
}

function main(): void {
  console.log("=".repeat(80));
  console.log("INFERENCE PLATFORM ECONOMICS: 2026 approximations");
  console.log("=".repeat(80));

  runScenario("Scenario A: startup-scale LLM product", 2_000_000, 10_000);
  runScenario("Scenario B: high-volume production", 100_000_000, 500_000);

  utilizationBreakeven();
  coldStartPenalty();

  console.log("\nRule of thumb: under reserved-minute billing, per-minute (Baseten, Modal) beats per-token");
  console.log("once GPU saturation stays above ~60-70% utilization; below that, per-token wins.");
}

main();
