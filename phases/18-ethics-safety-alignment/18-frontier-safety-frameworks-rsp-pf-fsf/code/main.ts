// Lesson: Frontier Safety Frameworks: RSP, PF, FSF (phase 18 / lesson 18)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/18-frontier-safety-frameworks-rsp-pf-fsf/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/18-frontier-safety-frameworks-rsp-pf-fsf/code/main.ts

export {};

const LABS: Record<string, string>[] = [
  {
    name: "Anthropic RSP v3.0 (Feb 2026)",
    tier_structure: "ASL-1 .. ASL-5+; biosafety-level analog",
    cbrn_threshold: "ASL-3 (activated May 2025)",
    ai_rd_threshold: "AI R&D-2 + AI R&D-4 (disaggregated v3.0)",
    adjustment_clause: "yes; peer-ship reduction allowed",
    safety_case: "required at AI R&D-4 crossing",
  },
  {
    name: "OpenAI PF v2 (Apr 15, 2025)",
    tier_structure: "Low / Medium / High / Critical per tracked capability",
    cbrn_threshold: "High for bio",
    ai_rd_threshold: "High for AI R&D; Critical definitions pending",
    adjustment_clause: "yes; Leadership may reduce requirements",
    safety_case: "Capabilities + Safeguards Reports separately",
  },
  {
    name: "DeepMind FSF v3.0 (Sep 2025)",
    tier_structure: "CCL per domain: bio / cyber / ML R&D / manipulation",
    cbrn_threshold: "Bioweapon Uplift CCL",
    ai_rd_threshold: "ML R&D Acceleration CCL (v2.0 raised security tier)",
    adjustment_clause: "yes; added 2025",
    safety_case: "per-CCL; Deceptive Alignment section added v2.0",
  },
];

function printRow(header: string, key: string): void {
  console.log(`\n${header}`);
  for (const lab of LABS) {
    const name = lab["name"];
    const val = lab[key];
    console.log(`  ${name.padEnd(32)} : ${val}`);
  }
}

function main(): void {
  console.log("=".repeat(78));
  console.log("FRONTIER SAFETY FRAMEWORKS (Phase 18, Lesson 18)");
  console.log("=".repeat(78));

  printRow("tier structure", "tier_structure");
  printRow("CBRN threshold", "cbrn_threshold");
  printRow("AI R&D threshold", "ai_rd_threshold");
  printRow("competitor-adjustment clause", "adjustment_clause");
  printRow("safety-case requirement", "safety_case");

  console.log("\n" + "=".repeat(78));
  console.log("TAKEAWAY: structural alignment across the three labs: three tiers of");
  console.log("frontier capability, CBRN thresholds defined, AI R&D thresholds");
  console.log("emerging, competitor-adjustment clauses universal. no industry-");
  console.log("standard terminology. safety cases are the convergent artifact.");
  console.log("UK AISI, US CAISI, EU AI Office provide the external counterpart.");
  console.log("=".repeat(78));
}

main();
