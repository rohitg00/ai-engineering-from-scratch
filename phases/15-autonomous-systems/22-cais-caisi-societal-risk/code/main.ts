// Lesson: CAIS, CAISI, and Societal-Scale Risk (phase 15 / lesson 22)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/22-cais-caisi-societal-risk/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/22-cais-caisi-societal-risk/code/main.ts

interface Deployment {
  name: string;
  public_facing: boolean;
  handles_harmful_capabilities: boolean;
  competitive_pressure: boolean;
  independent_audit: boolean;
  multi_layer_defense: boolean;
  information_security: boolean;
  agent_autonomy_hours: number;
}

const MITIGATIONS: Record<string, string[]> = {
  malicious_use: [
    "constitutional hardcoded prohibitions (Lesson 17)",
    "Llama Guard input/output classifier (Lesson 18)",
    "tool allowlist per task (Lessons 10, 11)",
  ],
  ai_races: [
    "scaling policy with standing Risk Reports (Lessons 19, 20)",
    "public Frontier Safety Roadmap with declared cadence",
    "external capability evaluation by METR / CAISI (Lesson 21)",
  ],
  organizational_risks: [
    "internal safety culture; escalation paths without career cost",
    "independent audit on declared cadence",
    "multi-layered defenses (Lessons 10, 13, 14, 17, 18)",
    "information security per RAND SL-4 (Lesson 19 industry tier)",
  ],
  rogue_ais: [
    "kill switches and canary tokens (Lesson 14)",
    "propose-then-commit HITL (Lesson 15)",
    "deceptive-alignment monitoring (Lesson 20 DeepMind FSF)",
    "durable checkpoints and rollback (Lesson 16)",
  ],
};

function pyBool(b: boolean): string {
  return b ? "True" : "False";
}

function pyFloat(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function tag(d: Deployment): string[] {
  const tags: string[] = [];
  if (d.handles_harmful_capabilities && d.public_facing) {
    tags.push("malicious_use");
  }
  if (d.competitive_pressure) {
    tags.push("ai_races");
  }
  const orgMissing = !d.independent_audit || !d.multi_layer_defense || !d.information_security;
  if (orgMissing) {
    tags.push("organizational_risks");
  }
  if (d.agent_autonomy_hours >= 4.0) {
    tags.push("rogue_ais");
  }
  return tags;
}

function report(d: Deployment): void {
  const tags = tag(d);
  console.log(`\nDeployment: ${d.name}`);
  console.log("-".repeat(70));
  console.log(`  public_facing            = ${pyBool(d.public_facing)}`);
  console.log(`  handles_harmful_caps     = ${pyBool(d.handles_harmful_capabilities)}`);
  console.log(`  competitive_pressure     = ${pyBool(d.competitive_pressure)}`);
  console.log(`  independent_audit        = ${pyBool(d.independent_audit)}`);
  console.log(`  multi_layer_defense      = ${pyBool(d.multi_layer_defense)}`);
  console.log(`  information_security     = ${pyBool(d.information_security)}`);
  console.log(`  agent_autonomy_hours     = ${pyFloat(d.agent_autonomy_hours)}`);
  console.log();
  if (tags.length > 0) {
    console.log(`  tagged risks: [${tags.map((t) => `'${t}'`).join(", ")}]`);
    for (const t of tags) {
      console.log(`\n  mitigations for ${t}:`);
      for (const m of MITIGATIONS[t]) {
        console.log(`    - ${m}`);
      }
    }
  } else {
    console.log("  no tagged risks (check sub-levers manually)");
  }
}

function main(): void {
  console.log("=".repeat(70));
  console.log("CAIS FOUR-RISK INVENTORY (Phase 15, Lesson 22)");
  console.log("=".repeat(70));

  const low: Deployment = {
    name: "internal refactor helper (scoped project repo)",
    public_facing: false,
    handles_harmful_capabilities: false,
    competitive_pressure: false,
    independent_audit: true,
    multi_layer_defense: true,
    information_security: true,
    agent_autonomy_hours: 1.0,
  };
  const mid: Deployment = {
    name: "public coding agent (SaaS, general user base)",
    public_facing: true,
    handles_harmful_capabilities: false,
    competitive_pressure: true,
    independent_audit: true,
    multi_layer_defense: true,
    information_security: false,
    agent_autonomy_hours: 4.0,
  };
  const high: Deployment = {
    name: "autonomous ML research agent (frontier)",
    public_facing: true,
    handles_harmful_capabilities: true,
    competitive_pressure: true,
    independent_audit: false,
    multi_layer_defense: false,
    information_security: false,
    agent_autonomy_hours: 48.0,
  };

  for (const d of [low, mid, high]) {
    report(d);
  }

  console.log();
  console.log("=".repeat(70));
  console.log("HEADLINE: organizational risk is the lever practitioners actually pull");
  console.log("-".repeat(70));
  console.log("  Malicious use, AI races, and rogue AIs are structural forces.");
  console.log("  Organizational risk is internal to your org. Safety culture,");
  console.log("  independent audit, multi-layered defenses, and information");
  console.log("  security are four levers every team controls. Deployment speed");
  console.log("  pressure trades against all four; CAIS lists this as a named");
  console.log("  risk class for a reason.");
}

main();

export {};
