// Lesson: Regulatory Frameworks: EU, US, UK, Korea (phase 18 / lesson 24)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/code/main.ts

export {};

const TIMELINE: [string, string][] = [
  ["2024-08-01", "EU AI Act enters into force"],
  ["2024-12-00", "Korean AI Framework Act passed by National Assembly"],
  ["2025-01-00", "Korean AI Framework Act enacted (effective Jan 2026)"],
  ["2025-02-02", "EU AI Act: prohibited practices and AI literacy apply"],
  ["2025-02-00", "UK AISI renamed -> AI Security Institute"],
  ["2025-06-00", "US AISI renamed -> CAISI (Center for AI Standards and Innovation)"],
  ["2025-07-10", "GPAI Code of Practice published (3 chapters, 12 commitments)"],
  ["2025-08-02", "EU AI Act: GPAI + governance obligations apply"],
  ["2025-12-17", "Transparency Code for Article 50 first draft"],
  ["2026-01-00", "Korean AI Framework Act effective"],
  ["2026-03-00", "Transparency Code second draft"],
  ["2026-06-00", "Transparency Code final version"],
  ["2026-08-02", "EU AI Act: full applicability + Article 50 transparency + penalties"],
  ["2027-08-02", "EU AI Act: legacy GPAI + embedded high-risk systems"],
];

function main(): void {
  console.log("=".repeat(78));
  console.log("AI REGULATORY TIMELINE (Phase 18, Lesson 24)");
  console.log("=".repeat(78));
  for (const [date, event] of TIMELINE) {
    console.log(`  ${date}  ${event}`);
  }
  console.log("\n" + "=".repeat(78));
  console.log("TAKEAWAY: EU AI Act sets the global bar. full enforcement August 2026.");
  console.log("UK narrowed to frontier security. US pivoted pro-growth. Korea is the");
  console.log("first Asian comprehensive framework. deployers in multiple jurisdictions");
  console.log("comply with the strictest, which is usually the EU.");
  console.log("=".repeat(78));
}

main();
