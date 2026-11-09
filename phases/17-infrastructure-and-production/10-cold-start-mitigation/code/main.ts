// Lesson: Cold Start Mitigation for Serverless LLMs (phase 17 / lesson 10)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/10-cold-start-mitigation/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/10-cold-start-mitigation/code/main.ts

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

interface Phase {
  name: string;
  rawSec: number;
  preSeededSec: number;
  streamerSec: number;
  snapshotSec: number;
}

function phase(name: string, rawSec: number, preSeededSec: number, streamerSec: number, snapshotSec: number): Phase {
  return { name, rawSec, preSeededSec, streamerSec, snapshotSec };
}

const PHASES_70B: Phase[] = [
  phase("node provision", 50.0, 50.0, 50.0, 0.5),
  phase("image pull", 180.0, 0.0, 180.0, 0.0),
  phase("weights to HBM", 75.0, 75.0, 35.0, 0.0),
  phase("engine init", 20.0, 20.0, 20.0, 2.0),
  phase("first forward", 3.0, 3.0, 3.0, 0.5),
];

function totalForStack(stack: Set<string>): number {
  let seconds = 0.0;
  for (const p of PHASES_70B) {
    if (stack.has("gpu_snapshot")) {
      seconds += p.snapshotSec;
    } else if (stack.has("streamer") && stack.has("pre_seeded")) {
      let used = p.preSeededSec;
      if (p.name === "weights to HBM") used = p.streamerSec;
      seconds += used;
    } else if (stack.has("pre_seeded")) {
      seconds += p.preSeededSec;
    } else if (stack.has("streamer")) {
      seconds += p.name === "weights to HBM" ? p.streamerSec : p.rawSec;
    } else {
      seconds += p.rawSec;
    }
  }
  return seconds;
}

function reportStack(label: string, stack: Set<string>): void {
  const total = totalForStack(stack);
  const mins = total / 60;
  const shown = stack.size ? `[${[...stack].sort().map((s) => `'${s}'`).join(", ")}]` : "{baseline}";
  console.log(`${lj(label, 20)}  ${rj(fixed(total, 1), 6)} s  (${rj(fixed(mins, 1), 4)} min)  stack=${shown}`);
}

function warmPoolBreakEven(gpuHourly: number, coldSeconds: number, slaToleratedDropsPerDay: number): void {
  console.log("\n" + "=".repeat(80));
  console.log("WARM POOL BREAK-EVEN");
  console.log("=".repeat(80));
  console.log(
    `GPU cost: $${fixed(gpuHourly, 2)}/hr  |  cold start: ${fixed(coldSeconds, 0)}s  |  drop budget: ${slaToleratedDropsPerDay}/day\n`,
  );
  const warmMonthly = gpuHourly * 24 * 30;
  console.log(`Warm pool (min_workers=1) monthly cost: $${fixed(warmMonthly, 2)}`);
  console.log();
  console.log(`${rj("Req/hr", 8)}  ${rj("Expected cold starts/day", 24)}  ${rj("Drops over budget", 20)}  ${rj("Warm better?", 15)}`);
  for (const rate of [1, 5, 10, 25, 50, 100, 250]) {
    const coldStartsPerDay = Math.min(20, Math.max(1, Math.trunc((24 * 3600) / (rate * 3600))));
    const drops = coldStartsPerDay;
    const warmBetter = drops > slaToleratedDropsPerDay ? "yes" : "no";
    console.log(
      `${rj(rate, 8)}  ${rj(coldStartsPerDay, 24)}  ${rj(Math.max(0, drops - slaToleratedDropsPerDay), 20)}  ${rj(warmBetter, 15)}`,
    );
  }
}

function main(): void {
  console.log("=".repeat(80));
  console.log("COLD START MITIGATION: 70B model on fresh H100 node");
  console.log("=".repeat(80));
  console.log(`${lj("Stack", 20)}  ${rj("Total", 8)}             Stack composition`);
  console.log("-".repeat(80));

  reportStack("RAW", new Set());
  reportStack("+ PRE_SEEDED", new Set(["pre_seeded"]));
  reportStack("+ STREAMER", new Set(["streamer"]));
  reportStack("+ PRE_SEEDED + STREAMER", new Set(["pre_seeded", "streamer"]));
  reportStack("+ GPU_SNAPSHOT", new Set(["gpu_snapshot"]));

  console.log("\n(WARM_POOL avoids cold start entirely on the warm path; cost is 24x7 GPU rental)");

  warmPoolBreakEven(4.5, 328, 5);
}

main();
