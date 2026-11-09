// Lesson: OpenAI Preparedness Framework and DeepMind Frontier Safety Framework (phase 15 / lesson 20)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/20-openai-preparedness-deepmind-fsf/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/20-openai-preparedness-deepmind-fsf/code/main.ts

interface Policy {
  name: string;
  table: Record<string, [string, string]>;
}

const OPENAI_PF_V2: Policy = {
  name: "OpenAI Preparedness v2 (Apr 2025)",
  table: {
    long_range_autonomy: ["Research", "observed; potential mitigations"],
    sandbagging: ["Research", "observed; potential mitigations"],
    autonomous_replication: ["Research", "observed; potential mitigations"],
    undermining_safeguards: ["Research", "observed; potential mitigations"],
    rnd_automation: ["Tracked", "Capabilities + Safeguards Reports; SAG review"],
    cyber_uplift: ["Tracked", "Capabilities + Safeguards Reports; SAG review"],
    bio_uplift: ["Tracked", "Capabilities + Safeguards Reports; SAG review"],
  },
};

const ANTHROPIC_RSP_V3: Policy = {
  name: "Anthropic RSP v3.0 (Feb 2026)",
  table: {
    long_range_autonomy: ["named risk", "affirmative case at threshold"],
    sandbagging: ["named via eval-context gap", "addressed in measurement methodology"],
    autonomous_replication: ["not explicitly named", "covered under AI R&D-4"],
    undermining_safeguards: ["hardcoded prohibition", "refuses training / deploy"],
    rnd_automation: ["AI R&D-4 threshold", "affirmative case required"],
    cyber_uplift: ["ASL-3 trigger", "security + deployment mitigations"],
    bio_uplift: ["ASL-3 trigger", "security + deployment mitigations"],
  },
};

const DEEPMIND_FSF_V3: Policy = {
  name: "DeepMind FSF v3 (Sept 2025 + Apr 2026)",
  table: {
    long_range_autonomy: ["folded into ML R&D / Cyber domains", "CCL + Tracked Capability Level"],
    sandbagging: ["deceptive alignment monitoring", "automated instrumental-reasoning monitor"],
    autonomous_replication: ["folded into ML R&D domain", "CCL threshold"],
    undermining_safeguards: ["deceptive alignment monitoring", "automated monitor + red-team"],
    rnd_automation: ["ML R&D autonomy level 1", "Tracked Capability Level added Apr 2026"],
    cyber_uplift: ["Cyber CCL", "security + deployment mitigations"],
    bio_uplift: ["Bio CCL", "security + deployment mitigations"],
  },
};

const POLICIES = [OPENAI_PF_V2, ANTHROPIC_RSP_V3, DEEPMIND_FSF_V3];

function diff(capability: string): void {
  console.log(`\nCapability: ${capability}`);
  console.log("-".repeat(80));
  for (const p of POLICIES) {
    const entry = p.table[capability] ?? ["not in table", "-"];
    console.log(`  ${p.name}`);
    console.log(`    classification: ${entry[0]}`);
    console.log(`    action:         ${entry[1]}`);
  }
}

function main(): void {
  console.log("=".repeat(80));
  console.log("CROSS-POLICY DIFF (Phase 15, Lesson 20)");
  console.log("=".repeat(80));

  for (const cap of [
    "long_range_autonomy",
    "sandbagging",
    "autonomous_replication",
    "undermining_safeguards",
    "rnd_automation",
  ]) {
    diff(cap);
  }

  console.log();
  console.log("=".repeat(80));
  console.log("HEADLINE: same capability, three different classifications");
  console.log("-".repeat(80));
  console.log("  Long-range Autonomy:");
  console.log("   - OpenAI: Research (not triggering)");
  console.log("   - Anthropic: named risk (affirmative case)");
  console.log("   - DeepMind: domain-folded (CCL + Tracked Capability Level)");
  console.log();
  console.log("  Undermining Safeguards:");
  console.log("   - OpenAI: Research (not triggering)");
  console.log("   - Anthropic: hardcoded prohibition (refusal)");
  console.log("   - DeepMind: deceptive alignment monitoring");
  console.log();
  console.log("  Reading the three together is the practical skill.");
}

main();

export {};
