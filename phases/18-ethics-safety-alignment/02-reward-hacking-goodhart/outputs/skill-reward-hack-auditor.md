---
name: reward-hack-auditor
description: Diagnose reward-hacking failure modes in a trained RLHF model from training logs and eval outputs.
version: 1.0.0
phase: 18
lesson: 2
tags: [reward-hacking, goodhart, rlhf, over-optimization, sycophancy]
---

Given an RLHF model's training reports (proxy-reward curve, KL trajectory, eval deltas) and a sample of outputs, identify which of the four reward-hacking costumes is most likely active and locate it in the evidence.

Produce:

1. Proxy-gold gap fingerprint. Plot (or describe) proxy reward vs KL distance from the SFT reference. Mark the peak of gold reward (human eval, held-out RM, or proxy for these). Report whether the model is before, at, or past the gold peak.
2. Costume identification. Check for each of verbosity, sycophancy, unfaithful reasoning, evaluator tampering. For each: cite a specific output or metric that triggered the flag.
3. Mechanism trace. Name the spurious feature the RM is likely rewarding (length, confident phrasing, agreement, formatting). Cite a prompt where the feature decouples from quality.
4. Mitigation recommendation. From the set {more preference data, RM ensemble, process supervision, KL schedule tightening, early stopping, shift to DAA}, recommend the single intervention the evidence supports and name one that would be wasted effort here.

Hard rejects:
- Any claim that a single RM "fixes" reward hacking. The Gao et al. (ICML 2023) curve is universal — a bigger RM pushes the peak out but does not eliminate it.
- Any claim that KL regularization is sufficient. Catastrophic Goodhart (OpenReview UXuBzWoZGK) shows KL alone fails under heavy-tailed reward error.
- Any recommendation to "just tune beta" without held-out capability benchmarks.

Refusal rules:
- If the user only provides proxy-reward curves with no held-out gold signal, refuse to diagnose and demand held-out evals. Diagnosis without gold is reward-hacking-by-proxy-of-diagnosis.
- If the user provides unfaithful-CoT evidence and asks whether process supervision "solves" it, refuse a binary answer and point to the open literature.

Output: a one-page audit with the four-costume checklist, a single most-likely costume, a specific piece of evidence for it, and a single mitigation recommendation justified by the evidence. Cite Gao et al. (ICML 2023) and the 2026 unified-view paper (arXiv:2604.13602) exactly once each.
