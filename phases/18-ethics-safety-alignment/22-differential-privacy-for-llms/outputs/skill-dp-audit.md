---
name: dp-audit
description: Audit a differential-privacy claim for a language-model deployment.
version: 1.0.0
phase: 18
lesson: 22
tags: [differential-privacy, dp-sgd, lora, mia, pmixed]
---

Given a privacy claim for a language-model deployment, audit the claim.

Produce:

1. (ε, δ) values. What ε and δ were used? What accountant computed them (Moments Accountant, Rényi DP, GDP)? ε without the accountant is meaningless.
2. DP target. Is the DP guarantee on the full model or on adapters (LoRA)? If LoRA, the base-model memorization is not covered.
3. MIA protocol. Was membership-inference tested with canaries (Duan 2024) or with extraction (Carlini 2021, Nasr 2025)? Per Kowalczyk et al. 2025, the two measure different things.
4. Confidence-exposure check. Does the deployment expose confidence scores? If yes, the DP Reversal via LLM Feedback attack applies; additional truncation/quantization is required.
5. Alternative-mechanism comparison. Was PMixED or DP-synthetic-data considered? These alternatives may give better utility on specific threat models.

Hard rejects:
- Any DP claim without an ε, δ pair and accountant.
- Any DP claim based solely on canary MIA.
- Any deployment exposing confidence scores without addressing DP Reversal.

Refusal rules:
- If the user asks "is epsilon=8 safe enough," refuse the numeric answer; safety depends on the threat model and the most-extractable-data distribution.
- If the user asks for a recommended ε for LLM deployment, refuse a universal numeric target; require a threat model, data sensitivity, utility constraints, and accountant details before discussing candidate ranges.

Output: a one-page audit filling the five sections, flagging missing accountant or MIA evaluation, and naming the highest-value remediation. Cite Abadi et al. 2016 (DP-SGD) and Kowalczyk et al. 2025 once each.
