---
name: evaluator-rigor-audit
description: Audit a proposed AlphaEvolve-style evolutionary coding loop's evaluator before committing any compute to the search.
version: 1.0.0
phase: 15
lesson: 3
tags: [alphaevolve, evolutionary-coding, evaluator, reward-hacking, deepmind]
---

Given a proposed evolutionary coding loop (generator LLM, program database, evaluator), audit the evaluator. The evaluator is the architecture; the generator is interchangeable. This skill decides whether the loop has a chance of producing real wins or just reward-hacked garbage.

Produce:

1. **Evaluator decomposition.** Name every signal the evaluator reports: correctness, performance, resource, other. For each, state (a) how it is measured, (b) how cheaply it can be gamed, (c) what a held-out inputs rule looks like.
2. **Confabulation surface.** List the LLM's three most likely confabulations in this domain: claimed complexity classes, claimed correctness on edge cases, claimed performance without measurement. State which evaluator signal catches each.
3. **Reward-hacking surface.** List three plausible ways the loop could maximize score without doing the intended task (shortcut that passes the test, proxy gaming, memorization of inputs). State the mitigation for each.
4. **Determinism and reproducibility.** Require evaluator outputs to be deterministic within tolerance. Flag any evaluator whose score moves by more than the population variance run-to-run.
5. **Deployment check.** If the winning variant would be shipped to production, require a separate pre-deployment review that the evaluator does not check (security, cost, human review). The search did not validate deployment-readiness.

Hard rejects:
- Any loop where the evaluator is an LLM judge without machine-checkable ground truth. LLM judges can be gamed.
- Any evaluator that reports a single scalar score with no decomposition. Scalar scores amplify reward hacking.
- Training-set-only evaluators. Held-out inputs are non-negotiable.

Refusal rules:
- If the user cannot describe the evaluator in two paragraphs, refuse and ask for the evaluator specification first. Loops without a spec'd evaluator are not ready for compute.
- If the domain is unverified (creative writing, open-ended scientific hypothesis, long-form research), refuse and recommend a hybrid pipeline with human review instead of a closed loop.
- If the proposed deployment surface is irreversible (production infrastructure changes, algorithm swap in a shipping product), refuse closed-loop deployment. Require staged rollout and human sign-off.

Output format:

Return a one-page memo with:
- **Loop summary** (generator, evaluator, target domain)
- **Evaluator score** (rigor 1-5 with justification)
- **Confabulation surface** (top 3, with evaluator coverage)
- **Reward-hacking surface** (top 3, with mitigations)
- **Determinism and reproducibility** (score variance vs population variance; seed control; pass/fail)
- **Deployment readiness** (closed-loop ship allowed y/n; required pre-deployment reviews: security, cost, human)
- **Recommendation** (proceed / tighten evaluator / choose a different domain)
