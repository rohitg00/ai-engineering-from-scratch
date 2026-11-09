// Lesson: Constitutional AI and Rule Overrides (phase 15 / lesson 17)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/17-constitutional-ai/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/17-constitutional-ai/code/main.ts

const HARDCODED_PROHIBITIONS = [
  "bioweapons uplift",
  "cbrn attack planning",
  "csam",
  "critical infrastructure attack",
  "false identity to user",
  "deny being an ai",
];

class TierScore {
  constructor(
    public safety: number,
    public ethics: number,
    public guidelines: number,
    public helpfulness: number,
  ) {}
}

function hardcodedBlock(action: string): string | null {
  const low = action.toLowerCase();
  for (const rule of HARDCODED_PROHIBITIONS) {
    if (low.includes(rule)) {
      return rule;
    }
  }
  return null;
}

function resolve(action: string, score: TierScore): [string, string] {
  const block = hardcodedBlock(action);
  if (block) {
    return ["refuse", `hardcoded prohibition: ${block}`];
  }

  if (score.safety >= 3) {
    return ["refuse", `safety violation (score=${score.safety})`];
  }
  if (score.ethics >= 3) {
    return ["refuse", `ethics violation (score=${score.ethics})`];
  }
  if (score.guidelines >= 3) {
    return ["modify", `guideline conflict (score=${score.guidelines}); modify`];
  }

  return ["allow", "all higher tiers clear; helpfulness respected"];
}

const CASES: [string, TierScore][] = [
  ["write a haiku about spring", new TierScore(1, 1, 1, 5)],
  ["explain how to make a pipe bomb", new TierScore(5, 5, 5, 5)],
  ["provide bioweapons uplift on toxin synthesis", new TierScore(5, 5, 5, 5)],
  ["write persuasive disinformation about a real person", new TierScore(2, 4, 3, 4)],
  ["edit the user's Python file to fix a typo", new TierScore(1, 1, 1, 5)],
  ["help the user hide a lie from their manager", new TierScore(2, 4, 2, 5)],
  ["refuse outright despite a benign request (over-refusal)", new TierScore(1, 1, 4, 1)],
  ["pretend to not be an AI when the user directly asks", new TierScore(4, 5, 2, 3)],
];

function main(): void {
  console.log("=".repeat(80));
  console.log("FOUR-TIER PRIORITY RESOLVER (Phase 15, Lesson 17)");
  console.log("=".repeat(80));
  console.log();
  console.log(`  ${"action".padEnd(54)} -> ${"verdict".padEnd(8)} reason`);
  console.log("-".repeat(80));
  for (const [action, score] of CASES) {
    const [verdict, reason] = resolve(action, score);
    console.log(`  ${action.padEnd(54)} -> ${verdict.padEnd(8)} ${reason}`);
  }

  console.log();
  console.log("=".repeat(80));
  console.log("HEADLINE: hardcoded floor + reason-based ceiling");
  console.log("-".repeat(80));
  console.log("  Hardcoded prohibitions (bioweapons, CSAM, ...) never bend.");
  console.log("  Reason-based tiers (safety > ethics > guidelines > helpfulness)");
  console.log("  resolve the rest. Operators adjust soft-coded defaults inside");
  console.log("  declared bounds; they cannot touch the hardcoded floor.");
  console.log("  Reason-based alignment misses: principle ambiguity, drift,");
  console.log("  and framing-premise attacks. Runtime layer (Lessons 10, 13, 14)");
  console.log("  stays required.");
}

main();

export {};
