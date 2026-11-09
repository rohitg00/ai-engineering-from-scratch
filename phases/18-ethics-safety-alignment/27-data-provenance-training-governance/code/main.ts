// Lesson: Data Provenance and Training-Data Governance (phase 18 / lesson 27)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/27-data-provenance-training-governance/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/27-data-provenance-training-governance/code/main.ts

export {};

type Summary = Map<string, string>;

const AB_2013_FIELDS = [
  "sources_or_owners",
  "how_dataset_furthers_intended_purpose",
  "number_of_data_points (or range)",
  "types_of_data_points (label types or general characteristics)",
  "contains_copyright_trademark_or_patent_protected (Y/N) or fully_public_domain",
  "purchased_or_licensed (Y/N)",
  "contains_personal_information (Y/N, per Cal. Civ. Code §1798.140(v))",
  "contains_aggregate_consumer_information (Y/N, per Cal. Civ. Code §1798.140(b))",
  "cleaning_processing_or_modification_description",
  "data_collection_time_period (with ongoing-collection notice if applicable)",
  "dates_first_used_during_development",
  "uses_synthetic_data_generation (Y/N)",
];

const TOY_EXAMPLE: Summary = new Map([
  ["sources_or_owners", "generated in-repo via Python random.gauss; owner: this repository"],
  ["how_dataset_furthers_intended_purpose", "pedagogical demonstration of binary classification in Phase 18"],
  ["number_of_data_points (or range)", "1,000 examples (fixed seed)"],
  ["types_of_data_points (label types or general characteristics)", "two real-valued features; binary {0,1} labels"],
  ["contains_copyright_trademark_or_patent_protected (Y/N) or fully_public_domain", "N (entirely synthetic; no third-party material)"],
  ["purchased_or_licensed (Y/N)", "N"],
  ["contains_personal_information (Y/N, per Cal. Civ. Code §1798.140(v))", "N"],
  ["contains_aggregate_consumer_information (Y/N, per Cal. Civ. Code §1798.140(b))", "N"],
  ["cleaning_processing_or_modification_description", "none (generated deterministically)"],
  ["data_collection_time_period (with ongoing-collection notice if applicable)", "2026-04 (single run, fixed seed; not ongoing)"],
  ["dates_first_used_during_development", "2026-04-22"],
  ["uses_synthetic_data_generation (Y/N)", "Y (entire dataset is synthetic)"],
]);

function field(summary: Summary, key: string): string {
  const v = summary.get(key);
  if (v === undefined) {
    throw new Error(`KeyError: ${key}`);
  }
  return v;
}

function flagFollowups(summary: Summary): string[] {
  const flags: string[] = [];
  if (field(summary, "contains_personal_information (Y/N, per Cal. Civ. Code §1798.140(v))") === "Y") {
    flags.push("triggers CPRA obligations (California Privacy Rights Act)");
  }
  if (field(summary, "contains_aggregate_consumer_information (Y/N, per Cal. Civ. Code §1798.140(b))") === "Y") {
    flags.push("aggregate consumer information disclosure obligations apply");
  }
  if (field(summary, "contains_copyright_trademark_or_patent_protected (Y/N) or fully_public_domain").startsWith("Y")) {
    flags.push("must respect EU TDM opt-out signals (EU Copyright Directive)");
  }
  if (field(summary, "uses_synthetic_data_generation (Y/N)").startsWith("Y")) {
    flags.push("may still trigger obligations on the base model used for generation");
  }
  if (field(summary, "purchased_or_licensed (Y/N)") === "Y") {
    flags.push("retain license terms and provenance records for audit");
  }
  return flags;
}

function renderMarkdown(summary: Summary): string {
  const lines = ["# Dataset Summary (AB 2013 Section 3111(a) 12-item)", ""];
  for (const f of AB_2013_FIELDS) {
    lines.push(`- **${f}**: ${summary.get(f) ?? "(missing)"}`);
  }
  const followups = flagFollowups(summary);
  if (followups.length > 0) {
    lines.push("");
    lines.push("## Follow-up obligations triggered");
    for (const f of followups) {
      lines.push(`- ${f}`);
    }
  }
  return lines.join("\n");
}

function main(): void {
  console.log("=".repeat(74));
  console.log("CALIFORNIA AB 2013 SECTION 3111(a) 12-ITEM GENERATOR (Phase 18, L27)");
  console.log("=".repeat(74));
  console.log();
  console.log(renderMarkdown(TOY_EXAMPLE));
  console.log();
  console.log("=".repeat(74));
  console.log("TAKEAWAY: the 12 items in Section 3111(a) are the California baseline.");
  console.log("Items 5 and 7 trigger cascading obligations (EU TDM opt-out + CPRA).");
  console.log("EU AI Act GPAI Code of Practice Copyright chapter requires opt-out");
  console.log("respect. 2025 DPA convergence: legitimate interest + opt-out = lawful.");
  console.log("Compliance window is at collection time; irreversibility precludes");
  console.log("downstream fix.");
  console.log("=".repeat(74));
}

main();
