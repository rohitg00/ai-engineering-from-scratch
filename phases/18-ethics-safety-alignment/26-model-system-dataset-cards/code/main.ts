// Lesson: Model, System, and Dataset Cards (phase 18 / lesson 26)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/26-model-system-dataset-cards/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/26-model-system-dataset-cards/code/main.ts

export {};

function modelCard(): string {
  return `
# Model Card: ToyClassifier-1.0

## Model Details
- Developer: ai-engineering-from-scratch / Phase 18 / Lesson 26
- Version: 1.0.0
- Type: binary logistic classifier (toy)
- License: MIT
- Contact: phase-18-lesson-26

## Intended Use
- Primary: pedagogical demonstration
- Out-of-scope: any production decision

## Factors
- Sensitive attributes: gender (binary in toy), age bucket
- Environment: controlled synthetic data

## Metrics
- Accuracy, demographic parity, equalized odds (see Lesson 21)

## Training Data
- Synthetic dataset; see accompanying Datasheet

## Quantitative Analysis
- accuracy: 0.97 overall
- demographic parity gap: +0.03 (group0 vs group1)
- equalized odds TPR gap: -0.01

## Ethical Considerations
- Toy classifier; not validated for real-world use.
- Bias metrics are placeholder; ship a full audit before any deployment.

## Caveats and Recommendations
- Retrain on deployment-specific data.
- Apply Lesson 22 (DP) if training data contains PII.
`;
}

function datasheet(): string {
  return `
# Datasheet: ToyBinaryClassification-1.0

## Motivation
- Created for pedagogical demonstration in Phase 18, Lesson 26
- Funded by no one; not for production use

## Composition
- 1,500 synthetic examples
- Features: 2-d continuous, 1 binary sensitive attribute
- Labels: binary, derived from x[0] + x[1] > 0 rule

## Collection Process
- Synthetically generated via Python random.gauss with fixed seed
- No human subjects involved

## Labeling
- Labels programmatically derived; no annotation error

## Uses
- Intended: teaching fairness metrics (Lesson 21) and bias probes (Lesson 20)
- Not to be used: as a proxy for any production-scale dataset

## Distribution
- Included in Phase 18 / Lesson 26 repository

## Maintenance
- Static; regenerated on every run from fixed seed
`;
}

function systemCard(): string {
  return `
# System Card: ToyClassifier Service

## Deployment
- Scope: localhost pedagogical service
- Stack: ToyClassifier-1.0 behind a single-threaded HTTP server

## Security Capabilities
- Prompt-injection: N/A (non-generative)
- Data-exfiltration detection: basic egress rate limit
- Rate limiting: 100 req/min per client

## Alignment
- Model reflects the synthetic-label rule only
- No RLHF; no refusal policy

## Incident Response
- No production SLA; escalation goes nowhere
- Issue tracker: Phase 18 / Lesson 26

## Regulatory Alignment
- EU AI Act: N/A (toy; no EU deployment)
- GPAI Code of Practice: N/A (non-GPAI)
- Transparency Code: N/A (no AI-generated content output)
`;
}

function main(): void {
  console.log("=".repeat(74));
  console.log("CARDS GENERATOR (Phase 18, Lesson 26)");
  console.log("=".repeat(74));
  console.log(modelCard());
  console.log(datasheet());
  console.log(systemCard());
  console.log("=".repeat(74));
  console.log("TAKEAWAY: three canonical cards cover three scopes. model cards");
  console.log("document the model; datasheets document the data; system cards");
  console.log("document the deployment. in 2026, EU AI Act GPAI Code of Practice");
  console.log("requires model cards as compliance artifacts. verifiable");
  console.log("attestations (Laminator 2024) are the next phase.");
  console.log("=".repeat(74));
}

main();
