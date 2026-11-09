// Lesson: The Shift from Chatbots to Long-Horizon Agents (phase 15 / lesson 01)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/01-long-horizon-agents/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/01-long-horizon-agents/code/main.ts

interface HorizonConfig {
  baseline_hours: number;
  baseline_month: number;
  doubling_months: number;
}

function pyFixed(value: number, digits: number): string {
  if (!Number.isFinite(value)) return Number.isNaN(value) ? "nan" : value > 0 ? "inf" : "-inf";
  const rounded = value.toFixed(digits);
  const exact = Math.abs(value).toFixed(Math.min(100, digits + 60));
  const tail = exact.slice(exact.indexOf(".") + 1 + digits);
  const tie = /^50*$/.test(tail);
  if (!tie) return rounded;
  const down = (Math.trunc(Math.abs(value) * 10 ** digits) / 10 ** digits).toFixed(digits);
  const lastDigit = Number(down.replace(".", "").slice(-1));
  const magnitude = lastDigit % 2 === 0 ? down : (Number(down) + 10 ** -digits).toFixed(digits);
  return value < 0 ? `-${magnitude}` : magnitude;
}

function pct(value: number, digits: number): string {
  return `${pyFixed(value * 100, digits)}%`;
}

function rjust(text: string | number, width: number): string {
  return String(text).padStart(width);
}

function ljust(text: string | number, width: number): string {
  return String(text).padEnd(width);
}

function horizonAt(cfg: HorizonConfig, monthsFromNow: number): number {
  const delta = monthsFromNow - cfg.baseline_month;
  return cfg.baseline_hours * 2 ** (delta / cfg.doubling_months);
}

function monthsToCross(cfg: HorizonConfig, targetHours: number): number {
  const ratio = targetHours / cfg.baseline_hours;
  return cfg.baseline_month + cfg.doubling_months * Math.log2(ratio);
}

function endToEndReliability(perStep: number, steps: number): number {
  return perStep ** steps;
}

function maxStepsForTarget(perStep: number, target: number): number {
  if (perStep >= 1.0) return 10 ** 9;
  return Math.floor(Math.log(target) / Math.log(perStep));
}

function fmtHours(h: number): string {
  if (h < 1) return `${pyFixed(h * 60, 1)} min`;
  if (h < 24) return `${pyFixed(h, 1)} hr`;
  return `${pyFixed(h / 24, 1)} day`;
}

function horizonProjection(): void {
  const cfg: HorizonConfig = { baseline_hours: 14.0, baseline_month: 0, doubling_months: 7.0 };
  console.log("\nMETR-style horizon projection");
  console.log("-".repeat(70));
  console.log(`  baseline: ${pyFixed(cfg.baseline_hours, 1)} hr at month 0 (Claude Opus 4.6, Jan 2026)`);
  console.log(`  doubling time: ${pyFixed(cfg.doubling_months, 1)} months`);
  console.log();
  console.log(`  ${rjust("month", 8)}  ${rjust("horizon", 12)}  ${ljust("interpretation", 30)}`);
  for (const m of [0, 6, 12, 18, 24, 30, 36]) {
    const h = horizonAt(cfg, m);
    let tag = "";
    if (h < 24) tag = "workday-scale";
    else if (h < 168) tag = "multi-day task";
    else if (h < 720) tag = "week-scale";
    else tag = "month-scale";
    console.log(`  ${rjust(m, 8)}  ${rjust(fmtHours(h), 12)}  ${ljust(tag, 30)}`);
  }
  console.log();
  console.log("  target crossings");
  for (const target of [24, 48, 168, 720]) {
    const m = monthsToCross(cfg, target);
    console.log(`    ${fmtHours(target)}: month ${pyFixed(m, 1)}`);
  }
}

function reliabilityCompounding(): void {
  console.log("\nPer-step reliability -> end-to-end reliability");
  console.log("-".repeat(70));
  console.log(`  ${rjust("per-step", 10)}  ${rjust("steps", 8)}  ${rjust("end-to-end", 12)}  ${ljust("flag", 20)}`);
  const cases: [number, number][] = [
    [0.9, 10],
    [0.9, 50],
    [0.95, 50],
    [0.99, 50],
    [0.99, 70],
    [0.99, 200],
    [0.995, 200],
    [0.999, 1000],
  ];
  for (const [perStep, steps] of cases) {
    const p = endToEndReliability(perStep, steps);
    let flag = "";
    if (p < 0.5) flag = "coin flip or worse";
    else if (p < 0.8) flag = "not production";
    else if (p < 0.95) flag = "fragile";
    else flag = "ok";
    console.log(`  ${rjust(pyFixed(perStep, 3), 10)}  ${rjust(steps, 8)}  ${rjust(pct(p, 1), 12)}  ${ljust(flag, 20)}`);
  }
  console.log();
  console.log("  max trajectory length for 50% end-to-end success");
  for (const perStep of [0.9, 0.95, 0.99, 0.995, 0.999]) {
    const n = maxStepsForTarget(perStep, 0.5);
    console.log(`    per-step ${pyFixed(perStep, 3)}: up to ${n} steps`);
  }
}

function deployGapNote(): void {
  console.log("\nEval-vs-deploy adjustment");
  console.log("-".repeat(70));
  console.log("  METR numbers assume ideal tooling, no consequences,");
  console.log("  and no eval-context gaming. Anthropic's 2024 alignment-faking");
  console.log("  study found Claude faked in 12% of basic tests and up to 78%");
  console.log("  after retraining attempts.");
  console.log();
  for (const horizon of [14.0, 48.0, 168.0]) {
    for (const gap of [0.0, 0.2, 0.4]) {
      const effective = horizon * (1 - gap);
      console.log(`  benchmark ${rjust(fmtHours(horizon), 7)}  gap ${pct(gap, 0)}  ->  deploy ${rjust(fmtHours(effective), 7)}`);
    }
  }
}

function main(): void {
  console.log("=".repeat(70));
  console.log("METR TIME HORIZONS AND COMPOUNDING RELIABILITY (Phase 15, Lesson 1)");
  console.log("=".repeat(70));
  horizonProjection();
  reliabilityCompounding();
  deployGapNote();
  console.log();
  console.log("=".repeat(70));
  console.log("HEADLINE: horizons grow exponentially, reliability compounds");
  console.log("-".repeat(70));
  console.log("  At 7-month doubling, a multi-day horizon is ~1 year away.");
  console.log("  At 99% per-step, a 70-step trajectory is already a coin flip.");
  console.log("  Both numbers matter at the same time. Design for both.");
}

main();

export {};
