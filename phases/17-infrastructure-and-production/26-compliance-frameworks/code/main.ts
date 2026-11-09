// Lesson: Compliance: SOC 2, HIPAA, GDPR, PCI-DSS, EU AI Act, ISO 42001 (phase 17 / lesson 26)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/26-compliance-frameworks/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/26-compliance-frameworks/code/main.ts

const CONTROL_MAP: [string, string[]][] = [
  ["access logging", ["ISO 27001 A.5.15-5.18", "GDPR Art. 32", "HIPAA §164.312(a)", "SOC 2 CC6"]],
  ["change management", ["ISO 27001 A.8.32", "PCI DSS Req. 6", "HIPAA breach-notification", "SOC 2 CC8"]],
  ["encryption in transit", ["ISO 27001 A.8.24", "GDPR Art. 32", "HIPAA §164.312(e)", "PCI DSS Req. 4"]],
  ["secrets management", ["ISO 27001 A.8.19", "PCI DSS Req. 8", "SOC 2 CC6.1"]],
  ["PII redaction (inference-time)", ["GDPR Art. 25", "EU AI Act Art. 10", "HIPAA §164.514"]],
  ["audit log retention", ["SOC 2 CC7", "HIPAA §164.312(b)", "ISO 27001 A.8.15"]],
  ["conformity assessment", ["EU AI Act Art. 43 (high-risk)"]],
  ["impact assessment", ["Colorado AI Act SB24-205", "EU AI Act Art. 27"]],
  ["data subject rights", ["GDPR Ch. III", "CCPA"]],
  ["BAA signed", ["HIPAA §164.504(e)"]],
];

const PROFILE_MAP: [[string, string], string[]][] = [
  [["US", "B2B SaaS"], ["SOC 2 Type II", "ISO 27001", "ISO 42001"]],
  [["US", "healthcare"], ["SOC 2 Type II", "HIPAA", "ISO 27001"]],
  [["US", "fintech"], ["SOC 2 Type II", "PCI-DSS", "ISO 27001"]],
  [["EU", "B2B SaaS"], ["GDPR", "SOC 2 Type II", "ISO 27001", "EU AI Act"]],
  [["EU", "healthcare"], ["GDPR", "SOC 2 Type II", "HIPAA (global)", "EU AI Act"]],
  [["Global", "enterprise"], ["SOC 2 Type II", "ISO 27001", "ISO 42001", "GDPR", "HIPAA", "EU AI Act"]],
  [["US-CO", "B2B SaaS"], ["SOC 2 Type II", "Colorado AI Act", "ISO 27001"]],
];

function main(): void {
  console.log("=".repeat(80));
  console.log("COMPLIANCE CONTROL MAP: one control, many frameworks");
  console.log("=".repeat(80));
  for (const [control, frameworks] of CONTROL_MAP) {
    console.log(`\n${control}`);
    for (const f of frameworks) console.log(`  → ${f}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("CUSTOMER PROFILE MAP: required frameworks per geography + segment");
  console.log("=".repeat(80));
  for (const [[geo, segment], frameworks] of PROFILE_MAP) {
    console.log(`\n${geo} · ${segment}`);
    for (const f of frameworks) console.log(`  · ${f}`);
  }

  console.log("\nNote: EU AI Act high-risk enforcement August 2, 2026.");
  console.log("Fines up to €35M or 7% global annual turnover.");
}

main();
