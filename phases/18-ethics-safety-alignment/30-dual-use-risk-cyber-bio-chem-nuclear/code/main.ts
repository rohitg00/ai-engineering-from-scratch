// Lesson: Dual-Use Risk: Cyber, Bio, Chem, Nuclear Uplift (phase 18 / lesson 30)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/30-dual-use-risk-cyber-bio-chem-nuclear/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/30-dual-use-risk-cyber-bio-chem-nuclear/code/main.ts

export {};

const DOMAINS: Record<string, string>[] = [
  {
    domain: "bio",
    "2024_state": "mild uplift",
    "2025_state": "2.53x novice-relative uplift; ASL-3 approach",
    inflection: "acquisition-phase automation",
    bottleneck_remaining: "pathogen procurement, biosafety equipment",
  },
  {
    domain: "chem",
    "2024_state": "mild uplift",
    "2025_state": "execution-gap erosion via vision-enabled LLMs",
    inflection: "real-time wet-lab protocol correction",
    bottleneck_remaining: "precursor procurement, specialized equipment",
  },
  {
    domain: "cyber",
    "2024_state": "code-snippet assistance",
    "2025_state": "80-90% campaign automation (Anthropic Nov 2025)",
    inflection: "agentic coding workflows",
    bottleneck_remaining: "4-6 human intervention steps",
  },
  {
    domain: "nuclear",
    "2024_state": "limited",
    "2025_state": "limited",
    inflection: "(no major 2024-2025 inflection reported)",
    bottleneck_remaining: "fissile-material acquisition dominates",
  },
];

function main(): void {
  console.log("=".repeat(82));
  console.log("2026 DUAL-USE PICTURE (Phase 18, Lesson 30)");
  console.log("=".repeat(82));

  for (const d of DOMAINS) {
    console.log(`\n${d["domain"].toUpperCase()}`);
    console.log(`  2024 state             : ${d["2024_state"]}`);
    console.log(`  2025 state             : ${d["2025_state"]}`);
    console.log(`  inflection             : ${d["inflection"]}`);
    console.log(`  remaining bottleneck   : ${d["bottleneck_remaining"]}`);
  }

  console.log("\n" + "=".repeat(82));
  console.log("TAKEAWAY: three of four CBRN domains crossed thresholds in 2025.");
  console.log("bio: 2.53x uplift, ASL-3 approach. chem: execution-gap erosion.");
  console.log("cyber: agentic automation of 80-90% of campaigns. nuclear remains");
  console.log("bounded by material access. safety cases must target novice-relative");
  console.log("AND expert-absolute; input-filter-only defenses do not suffice.");
  console.log("=".repeat(82));
}

main();
