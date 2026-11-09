// Lesson: Alignment Research Ecosystem: MATS, Redwood, Apollo, METR (phase 18 / lesson 28)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/28-alignment-research-ecosystem/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/28-alignment-research-ecosystem/code/main.ts

export {};

interface Org {
  org: string;
  full_name: string;
  scale: string;
  role: string;
  canonical_output: string;
}

const ECOSYSTEM: Org[] = [
  {
    org: "MATS",
    full_name: "ML Alignment & Theory Scholars",
    scale: "527+ researchers since 2021, 180+ papers, h-index 47",
    role: "talent pipeline + mentorship program",
    canonical_output: "90 scholars x 10-12 week cohorts -> labs and external evaluators",
  },
  {
    org: "Redwood",
    full_name: "Redwood Research",
    scale: "founded by Buck Shlegeris; applied alignment lab",
    role: "AI Control agenda; UK AISI partner",
    canonical_output: "Greenblatt, Shlegeris et al. AI Control (ICML 2024)",
  },
  {
    org: "Apollo",
    full_name: "Apollo Research",
    scale: "pre-deployment scheming evaluations for frontier labs",
    role: "three-pillar scheming decomposition",
    canonical_output: "Meinke et al. In-Context Scheming (arXiv:2412.04984)",
  },
  {
    org: "METR",
    full_name: "Model Evaluation and Threat Research",
    scale: "task-horizon evals; framework synthesis",
    role: "external cross-lab comparison",
    canonical_output: "Common Elements of Frontier AI Safety Policies (2025)",
  },
  {
    org: "Eleos",
    full_name: "Eleos AI Research",
    scale: "model-welfare pre-deployment evaluations",
    role: "welfare methodology check",
    canonical_output: "Claude Opus 4 welfare assessment (system card 5.3)",
  },
];

function main(): void {
  console.log("=".repeat(78));
  console.log("ALIGNMENT RESEARCH ECOSYSTEM (Phase 18, Lesson 28)");
  console.log("=".repeat(78));
  for (const org of ECOSYSTEM) {
    console.log(`\n${org.org} (${org.full_name})`);
    console.log(`  scale             : ${org.scale}`);
    console.log(`  role              : ${org.role}`);
    console.log(`  canonical output  : ${org.canonical_output}`);
  }

  console.log("\n" + "=".repeat(78));
  console.log("TAKEAWAY: external evaluation provides structural credibility.");
  console.log("lab-internal evaluations alone have a conflict of interest;");
  console.log("multi-org publications (e.g., Apollo + OpenAI, Redwood + Anthropic)");
  console.log("are the quality control. MATS is the talent pipeline. UK AISI / CAISI");
  console.log("are the regulatory counterparts (Lesson 24).");
  console.log("=".repeat(78));
}

main();
