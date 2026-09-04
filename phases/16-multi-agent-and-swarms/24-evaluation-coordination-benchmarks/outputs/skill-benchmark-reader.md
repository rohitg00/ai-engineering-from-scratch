---
name: benchmark-reader
description: Read a multi-agent benchmark claim skeptically. Grades the claim on benchmark selection, contamination, baselines, statistical significance, task diversity, and cost disclosure.
version: 1.0.0
phase: 16
lesson: 24
tags: [multi-agent, benchmarks, evaluation, SWE-bench, MARBLE]
---

Given a published or internal claim of multi-agent benchmark performance, grade the claim and surface caveats.

Produce:

1. **Benchmark + split identification.** Which benchmark (MARBLE, COMMA, MedAgentBoard, AgentArch, SWE-bench Pro, SWE-bench Verified, custom)? Which split (full, held-out, contamination-cleaned)? Unknown splits are disqualifying.
2. **Contamination status.** Is the benchmark post-training-cutoff for the model under test? If the benchmark predates the training cutoff, flag for contamination risk and discount the claim.
3. **Baseline quality.** Vs single-LLM, vs random, vs prior multi-agent work. Vs untuned-same-system does not count; it is an ablation, not a baseline.
4. **Statistical significance.** N trials, confidence interval or standard error, p-value or equivalent. Claims without statistics on N < 50 trials are under-supported.
5. **Task diversity.** One task, one domain, or many? Single-task claims do not imply generalization.
6. **Cost disclosure.** Tokens per task, wall-clock per task, dollar cost per task. A 90% solution at 20x cost is a business decision; without cost, the claim is incomplete.
7. **Letter grade + one-sentence verdict.**

   - **A:** All six checks pass; the claim is likely robust.
   - **B:** One weakness; the claim is plausible with noted caveats.
   - **C:** Two weaknesses; the claim is suggestive but needs replication.
   - **D:** Three or more weaknesses; the claim is not evidence.
   - **F:** Disqualifying issue (contamination on undisclosed split, no statistics, no baseline).

Hard rejects:

- Claims citing "SWE-bench" without specifying Verified vs Pro. The 40+ point gap makes this ambiguous reporting unacceptable.
- Claims without baseline comparison. "Our system does X%" is a number, not a result.
- Claims based on fewer than 20 trials for multi-agent systems. Variance is too high.
- Cost-unreported claims for multi-agent systems. The coordination tax is material.

Refusal rules:

- If the benchmark is not publicly available and the user has no internal audit trail, grade cannot be assigned. Recommend releasing evaluation artifacts.
- If the claim is from a paper currently under peer review (arXiv preprint, unsubmitted), downgrade one letter grade as precaution until replication.
- If the user is the claimant themselves asking for an audit, run the audit straight; flag when the claim is not yet ready for publication.

Output: a one-page grade card. Start with a one-sentence summary ("Grade: C — good benchmark choice, adequate baselines, but no contamination check and no cost disclosure."), then the seven sections above. End with a prioritized list of "what to fix to raise the grade."
