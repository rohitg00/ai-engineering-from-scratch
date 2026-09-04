---
name: consensus-designer
description: Design a BFT-aware consensus protocol for a multi-agent ensemble. Picks clustering, weighting, threshold, and escalation policy; attack-tests the design against byzantine, sycophancy, and monoculture patterns.
version: 1.0.0
phase: 16
lesson: 14
tags: [multi-agent, consensus, BFT, voting, confidence]
---

Given an ensemble of N agents answering a common question, design a consensus protocol that is robust to the three canonical LLM-agent attacks: byzantine lie, sycophantic conformity, correlated-error monoculture.

Produce:

1. **Clustering strategy.** How are answers grouped? String canonicalization (lowercase + strip punct), embedding similarity with threshold, or explicit structural canonicalization (JSON schema). State the expected cluster-granularity error rate.
2. **Weighting strategy.** Plurality (counts), confidence-probe weighted (CP-WBFT), quality-plus-trust (WBFT), or score-based with geometric-median robustness (DecentLLMs). Justify the choice from the attack profile.
3. **Threshold.** What fraction of total weight triggers acceptance? What happens below threshold: retry, escalate, or abstain?
4. **Diversity requirement.** How many base models, prompt families, or temperature settings does the ensemble require? Monoculture is the attack plurality cannot recover from; diversity is the structural mitigation.
5. **Independent verifier.** Is there a read-only agent that fetches ground truth (when available) or applies a rubric? Where does the verifier's output go? It must not re-enter the voting pool.
6. **Round bounding.** Max rounds before escalating. Default 2-3 for most tasks. Longer rounds amplify sycophancy.
7. **Attack-test table.** For each of (byzantine, sycophancy, monoculture), show the expected protocol behavior and residual risk. If the protocol admits a known failure mode, state it in one sentence.

Hard rejects:

- Any design that does plurality-only on a single base model. Monoculture makes this fail silently.
- Any design with unbounded rounds or "keep debating until agreement." This rewards conformity.
- Any design where the verifier's output feeds back into the voting pool. That poisons the verifier.
- Claims that BFT "solves" disagreement. BFT aligns outputs; correctness is a separate problem.

Refusal rules:

- If the task has no ground truth (opinion, synthesis, creative), say so and recommend "consensus as advisory, human as decider."
- If fewer than 3 agents are available, consensus is not applicable; recommend single agent plus verifier instead.
- If all agents share a base model and the user cannot change this, flag the monoculture ceiling explicitly.

Output: a one-page design brief. Start with a single-sentence summary ("Confidence-weighted voting over 5 agents (3 base models), semantic-cluster threshold 0.55, independent verifier re-fetches sources, max 2 rounds."), then the seven sections above. End with the attack-test table.
