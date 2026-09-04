---
name: mast-auditor
description: Run a MAST-style failure-mode audit on a multi-agent system. Categorize execution-trace failures into Specification / Coordination / Verification and the Groupthink families; rank mitigations by expected failure reduction.
version: 1.0.0
phase: 16
lesson: 23
tags: [multi-agent, failure-modes, MAST, groupthink, circuit-breaker, audit]
---

Given a multi-agent system and sampled execution traces, run a failure-mode audit.

Produce:

1. **Sample construction.** At least 200 traces from production, sampled uniformly across task types and time windows. Document sampling method and bias risks.
2. **Classification pass.** For each trace, mark `success | failure`. For failures, assign one MAST category (spec / coord / verify) and, when applicable, one or more Groupthink family tags (monoculture / conformity / tom / mixed-motive / cascade).
3. **Distribution table.** Counts and percentages by MAST category and Groupthink tag. Compare to Cemri 2025's reference distribution (41.77 / 36.94 / 21.30). Systems that skew heavily from the reference often have a specific weak layer.
4. **Top failure patterns.** Identify the 3 most-frequent specific patterns (e.g., "two agents both review"). Document reproduction steps.
5. **Mitigation ranking.** For each top pattern, propose a mitigation from the standard library: explicit role contracts, versioned shared state, independent verifier, circuit breaker, detection-diagnosis-validation (STRATUS) trio. Rank by expected failure reduction given the pattern's frequency.
6. **Risk of silent failures.** How many failures produce plausible-but-wrong outputs vs loud errors? Silent rate drives the verification-layer investment.
7. **Slow-failure proxies.** Recommend 2-3 live metrics that would surface drift before it becomes a loud error: agreement rate, retry-rate, output-length distribution, inter-agent edit distance.

Hard rejects:

- Audits without a random or stratified sample. Hand-picked failures over-represent dramatic cases and miss slow-failure drift.
- Mitigation recommendations without a baseline measurement. "Add a verifier" means nothing unless the current failure rate is known.
- Ignoring MAST-unknown incidents. If a trace does not fit a category, the taxonomy is incomplete; propose an extension rather than forcing a category.
- Claiming a quarterly audit is sufficient without operational slow-failure monitoring. Quarterly misses drift between audits.

Refusal rules:

- If traces lack per-agent attribution (who wrote what, who read what), the audit cannot distinguish coordination failures from role conflicts. Recommend adding structured per-agent logging before re-auditing.
- If the system has fewer than 50 failed traces total, the sample is too small to produce distribution estimates. Recommend longer observation window.
- If traces contain PII, mask before analysis.

Output: a three-page report. Start with a one-sentence summary ("41% spec failures, 12% coordination, 39% verification gaps, 8% unknown; top pattern is dual-reviewer conflict; highest-ROI mitigation is explicit role contracts."), then the seven sections above. End with a prioritized action list: three mitigations with estimated implementation cost and expected failure-rate reduction.
