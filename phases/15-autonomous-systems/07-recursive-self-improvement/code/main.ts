// Lesson: Recursive Self-Improvement: Capability vs Alignment (phase 15 / lesson 07)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/07-recursive-self-improvement/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/07-recursive-self-improvement/code/main.ts

let rngState = 0;

function seedRandom(value: number): void {
  rngState = value >>> 0;
}

function random(): number {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function gauss(mu: number, sigma: number): number {
  const u1 = 1 - random();
  const u2 = random();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
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

function signed(value: number, digits: number): string {
  const text = pyFixed(value, digits);
  return text.startsWith("-") ? text : `+${text}`;
}

function pyFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

function median(values: number[]): string {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n % 2 === 1) return String(sorted[(n - 1) / 2]);
  return pyFloat((sorted[n / 2 - 1] + sorted[n / 2]) / 2);
}

const DEFAULT_SEED = 25;

interface Config {
  r_c: number;
  r_a: number;
  noise_c: number;
  noise_a: number;
  threshold: number;
}

type Point = [number, number, number, number];

function run(cycles: number, cfg: Config): Point[] {
  let c = 1.0;
  let a = 1.0;
  const out: Point[] = [[0, c, a, c - a]];
  for (let cyc = 1; cyc <= cycles; cyc++) {
    const nc = cfg.r_c + gauss(0, cfg.noise_c);
    const na = cfg.r_a + gauss(0, cfg.noise_a);
    c *= Math.max(0.9, nc);
    a *= Math.max(0.9, na);
    out.push([cyc, c, a, c - a]);
  }
  return out;
}

function crossingCycle(trajectory: Point[], threshold: number): number {
  for (const [cyc, , , gap] of trajectory) {
    if (gap >= threshold) return cyc;
  }
  return -1;
}

function printTrajectory(label: string, cfg: Config, cycles = 40): void {
  const traj = run(cycles, cfg);
  console.log(`\n${label}`);
  console.log(`  r_c=${pyFixed(cfg.r_c, 2)} r_a=${pyFixed(cfg.r_a, 2)} noise_c=${pyFixed(cfg.noise_c, 3)} noise_a=${pyFixed(cfg.noise_a, 3)}`);
  console.log(`  threshold (C - A): ${pyFixed(cfg.threshold, 2)}`);
  console.log(`  ${rjust("cycle", 6)}  ${rjust("C(t)", 8)}  ${rjust("A(t)", 8)}  ${rjust("C-A", 8)}  flag`);
  const step = Math.max(1, Math.floor(cycles / 8));
  for (const [cyc, c, a, gap] of traj) {
    if (cyc === 0 || cyc === cycles || cyc % step === 0) {
      const flag = gap >= cfg.threshold ? "PAUSE" : "ok";
      console.log(`  ${rjust(cyc, 6)}  ${rjust(pyFixed(c, 2), 8)}  ${rjust(pyFixed(a, 2), 8)}  ${rjust(signed(gap, 2), 8)}  ${flag}`);
    }
  }
  const cross = crossingCycle(traj, cfg.threshold);
  if (cross >= 0) console.log(`  -> threshold crossed at cycle ${cross}`);
  else console.log("  -> threshold not crossed in simulated window");
}

function monteCarlo(cfg: Config, cycles: number, trials: number): void {
  const crossings: number[] = [];
  for (let t = 0; t < trials; t++) {
    const traj = run(cycles, cfg);
    const cross = crossingCycle(traj, cfg.threshold);
    if (cross >= 0) crossings.push(cross);
  }
  console.log(`\n  monte-carlo over ${trials} trials, ${cycles} cycles each`);
  console.log(`  crossed: ${crossings.length} (${pct(crossings.length / trials, 0)})`);
  if (crossings.length > 0) {
    const avg = crossings.reduce((s, v) => s + v, 0) / crossings.length;
    console.log(`  mean crossing cycle: ${pyFixed(avg, 1)}`);
    console.log(`  median crossing cycle: ${median(crossings)}`);
  }
}

function parseArgs(argv: string[]): Map<string, string> {
  const found = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq >= 0) {
      found.set(arg.slice(0, eq), arg.slice(eq + 1));
    } else if (i + 1 < argv.length) {
      found.set(arg, argv[i + 1]);
      i += 1;
    }
  }
  return found;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const th = args.has("--threshold") ? Number(args.get("--threshold")) : 1.5;
  const seed = args.has("--seed") ? Number.parseInt(args.get("--seed") as string, 10) : DEFAULT_SEED;

  seedRandom(seed);
  console.log("=".repeat(70));
  console.log("CAPABILITY vs ALIGNMENT RACE (Phase 15, Lesson 7)");
  console.log("=".repeat(70));

  printTrajectory("Scenario A: capability outpaces alignment", { r_c: 1.15, r_a: 1.08, noise_c: 0.02, noise_a: 0.03, threshold: th });

  printTrajectory("Scenario B: matched rates (noise-only drift)", { r_c: 1.1, r_a: 1.1, noise_c: 0.02, noise_a: 0.03, threshold: th });

  printTrajectory("Scenario C: alignment higher mean rate but capability surges", {
    r_c: 1.1,
    r_a: 1.13,
    noise_c: 0.06,
    noise_a: 0.01,
    threshold: th,
  });

  console.log("\nMonte-Carlo on Scenario A");
  monteCarlo({ r_c: 1.15, r_a: 1.08, noise_c: 0.02, noise_a: 0.03, threshold: th }, 30, 500);
  console.log("\nMonte-Carlo on Scenario C");
  monteCarlo({ r_c: 1.1, r_a: 1.13, noise_c: 0.06, noise_a: 0.01, threshold: th }, 30, 500);

  console.log();
  console.log("=".repeat(70));
  console.log("HEADLINE: small rate differences compound to safety-threshold crossings");
  console.log("-".repeat(70));
  console.log("  Scenario A crosses the absolute 1.5 gap (C - A) in under 10 cycles.");
  console.log("  Scenario B stays bounded: same mean rate, noise-only drift.");
  console.log("  Scenario C: higher alignment mean does NOT save you if");
  console.log("  capability has big surges. Noise matters as much as drift.");
  console.log("  RSI-style pipelines need pause-on-gap thresholds baked in.");
}

main();

export {};
