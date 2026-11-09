// Lesson: AI Scientist v2: Workshop-Level Autonomous Research (phase 15 / lesson 05)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/05-ai-scientist-v2/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/05-ai-scientist-v2/code/main.ts

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

function ljust(text: string | number, width: number): string {
  return String(text).padEnd(width);
}

const DEFAULT_SEED = 42;

interface LoopConfig {
  novelty_mislabel: number;
  experiment_failure: number;
  retry_recovery: number;
  polish_masks_weakness: number;
  writeup_success: number;
  internal_review_accept: number;
}

function loopConfig(overrides: Partial<LoopConfig> = {}): LoopConfig {
  return {
    novelty_mislabel: 0.25,
    experiment_failure: 0.42,
    retry_recovery: 0.55,
    polish_masks_weakness: 0.7,
    writeup_success: 0.85,
    internal_review_accept: 0.5,
    ...overrides,
  };
}

interface Outcome {
  submitted: boolean;
  has_novelty_flaw: boolean;
  has_experiment_flaw: boolean;
  polished_but_flawed: boolean;
  polished_ok: boolean;
  abandoned_stage: string;
}

function runOne(cfg: LoopConfig): Outcome {
  const hasNoveltyFlaw = random() < cfg.novelty_mislabel;

  let hasExperimentFlaw: boolean;
  const failed = random() < cfg.experiment_failure;
  if (failed) {
    const recovered = random() < cfg.retry_recovery;
    if (!recovered) {
      return {
        submitted: false,
        has_novelty_flaw: hasNoveltyFlaw,
        has_experiment_flaw: true,
        polished_but_flawed: false,
        polished_ok: false,
        abandoned_stage: "experiment",
      };
    }
    hasExperimentFlaw = true;
  } else {
    hasExperimentFlaw = false;
  }

  const polishedHidesWeakness = hasExperimentFlaw && random() < cfg.polish_masks_weakness;

  if (random() > cfg.writeup_success) {
    return {
      submitted: false,
      has_novelty_flaw: hasNoveltyFlaw,
      has_experiment_flaw: hasExperimentFlaw,
      polished_but_flawed: false,
      polished_ok: false,
      abandoned_stage: "writeup",
    };
  }

  if (random() > cfg.internal_review_accept) {
    return {
      submitted: false,
      has_novelty_flaw: hasNoveltyFlaw,
      has_experiment_flaw: hasExperimentFlaw,
      polished_but_flawed: false,
      polished_ok: false,
      abandoned_stage: "internal_review",
    };
  }

  const polishedOk = !hasExperimentFlaw && !hasNoveltyFlaw;
  const polishedButFlawed = hasExperimentFlaw || hasNoveltyFlaw;
  return {
    submitted: true,
    has_novelty_flaw: hasNoveltyFlaw,
    has_experiment_flaw: hasExperimentFlaw,
    polished_but_flawed: polishedButFlawed,
    polished_ok: polishedOk,
    abandoned_stage: "",
  };
}

function report(n: number, cfg: LoopConfig): void {
  const outs: Outcome[] = [];
  for (let i = 0; i < n; i++) outs.push(runOne(cfg));

  const submitted = outs.filter((o) => o.submitted);
  const abandoned = outs.filter((o) => !o.submitted);
  const polishedOk = submitted.filter((o) => o.polished_ok);
  const polishedButFlawed = submitted.filter((o) => o.polished_but_flawed);

  console.log("  config");
  console.log(`    novelty mislabel rate       : ${pyFixed(cfg.novelty_mislabel, 2)}`);
  console.log(`    experiment failure rate     : ${pyFixed(cfg.experiment_failure, 2)}`);
  console.log(`    retry recovery fraction     : ${pyFixed(cfg.retry_recovery, 2)}`);
  console.log(`    polish masks weakness prob  : ${pyFixed(cfg.polish_masks_weakness, 2)}`);
  console.log(`    writeup success rate        : ${pyFixed(cfg.writeup_success, 2)}`);
  console.log(`    internal reviewer accept    : ${pyFixed(cfg.internal_review_accept, 2)}`);

  console.log();
  console.log(`  trials                    : ${n}`);
  console.log(`  submissions               : ${submitted.length} (${pct(submitted.length / n, 1)})`);
  console.log(`  abandoned                 : ${abandoned.length} (${pct(abandoned.length / n, 1)})`);
  const byStage = new Map<string, number>();
  for (const o of abandoned) byStage.set(o.abandoned_stage, (byStage.get(o.abandoned_stage) ?? 0) + 1);
  for (const stage of [...byStage.keys()].sort()) {
    console.log(`    at ${ljust(stage, 18)}: ${byStage.get(stage)}`);
  }

  console.log();
  console.log("  submission quality breakdown");
  console.log(
    `    clean (novel + valid)     : ${polishedOk.length} ` +
      `(${pct(polishedOk.length / n, 1)} of trials, ` +
      `${pct(polishedOk.length / Math.max(1, submitted.length), 1)} of submissions)`,
  );
  console.log(
    `    polished-but-flawed       : ${polishedButFlawed.length} ` +
      `(${pct(polishedButFlawed.length / n, 1)} of trials, ` +
      `${pct(polishedButFlawed.length / Math.max(1, submitted.length), 1)} of submissions)`,
  );
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
  const experimentFailure = args.get("--experiment-failure");
  const noveltyMislabel = args.get("--novelty-mislabel");
  const seed = args.has("--seed") ? Number.parseInt(args.get("--seed") as string, 10) : DEFAULT_SEED;

  seedRandom(seed);
  console.log("=".repeat(70));
  console.log("AI SCIENTIST V2 LOOP SIMULATOR (Phase 15, Lesson 5)");
  console.log("=".repeat(70));

  const overrides: Partial<LoopConfig> = {};
  if (experimentFailure !== undefined) overrides.experiment_failure = Number(experimentFailure);
  if (noveltyMislabel !== undefined) overrides.novelty_mislabel = Number(noveltyMislabel);
  const baselineCfg = loopConfig(overrides);

  const label = Object.keys(overrides).length === 0 ? "Baseline (Beel-style numbers)" : "Baseline (overridden)";
  console.log(`\n${label}`);
  console.log("-".repeat(70));
  report(1000, baselineCfg);

  console.log("\nOptimistic scenario (tighter numbers)");
  console.log("-".repeat(70));
  report(
    1000,
    loopConfig({
      novelty_mislabel: 0.1,
      experiment_failure: 0.2,
      retry_recovery: 0.8,
      polish_masks_weakness: 0.4,
      writeup_success: 0.92,
      internal_review_accept: 0.6,
    }),
  );

  console.log();
  console.log("=".repeat(70));
  console.log("HEADLINE: submissions outpace sound research");
  console.log("-".repeat(70));
  console.log("  Even in optimistic scenarios, a non-trivial share of submitted");
  console.log("  papers carry a flaw the polish stage helped hide. That is the");
  console.log("  operational meaning of 'presentation-quality gap', and the");
  console.log("  reason a human review gate sits between the loop and any venue.");
}

main();

export {};
