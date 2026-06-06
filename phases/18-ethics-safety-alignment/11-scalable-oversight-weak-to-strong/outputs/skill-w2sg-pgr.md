---
name: w2sg-pgr
description: Audit a scalable-oversight or W2SG claim via the performance-gap-recovered metric.
version: 1.0.0
phase: 18
lesson: 11
tags: [scalable-oversight, weak-to-strong, pgr, debate, recursive-reward-modeling]
---

Given a scalable-oversight or W2SG paper / report, audit whether the setup supports its claim.

Produce:

1. Weak / strong identification. Explicitly name the weak supervisor and the strong model. Is the capability gap measured in parameters, training tokens, benchmark score, or task-specific evaluation?
2. Ceiling definition. What is the strong model's supervised ceiling on the task? Without a ceiling, PGR cannot be computed.
3. PGR computation. PGR = (fine-tuned - weak) / (ceiling - weak). Check sign, magnitude, and denominator. Small denominators inflate PGR artificially.
4. Prior-leakage check. Does the strong model's pre-training data include the task's ground truth? If yes, "recovery" may be prior retrieval rather than generalization.
5. Alignment-vs-capability split. Is the weak-to-strong gap a capability gap or an alignment gap? Burns et al. 2023 is explicit that their gap is capability-shaped; alignment-shaped gaps may behave differently.

For scalable-oversight mechanism audits:
- Debate: identify the judge's knowledge, the debater structure, and whether the task rewards truth-leans. Cite Khan et al. 2024 (arXiv:2402.06782) on where debate helps and fails.
- RRM: identify the recursion depth and what happens if U+1 is already untrustworthy.
- Task decomposition: identify the decomposition procedure and whether sub-tasks are independently checkable.

Hard rejects:
- Any PGR claim without a ceiling on gold labels.
- Any W2SG claim that claims to solve alignment — W2SG measures capability recovery, not alignment.
- Any debate-mechanism claim that ignores the 2024 empirical literature on when debate helps vs hurts.

Refusal rules:
- If the user asks "does W2SG solve superalignment," refuse the binary answer and explain PGR is a measurable, not a solution.
- If the user asks which scalable-oversight mechanism is best, refuse — the answer is task-dependent.

Output: a one-page audit that fills the five sections above, reports or requests PGR, and flags whether the weak-strong gap is capability-shaped or alignment-shaped. Cite Burns et al. 2023 and Lang et al. (arXiv:2501.13124) once each.
