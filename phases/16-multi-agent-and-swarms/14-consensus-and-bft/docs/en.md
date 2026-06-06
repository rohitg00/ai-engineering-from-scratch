# Consensus and Byzantine Fault Tolerance for Agents

> Classical distributed-systems BFT meets stochastic LLMs. In 2025-2026 three research directions emerged: **CP-WBFT** (arXiv:2511.10400) weighs each vote by a confidence probe; **DecentLLMs** (arXiv:2507.14928) goes leaderless with parallel worker proposals and geometric-median aggregation; **WBFT** (arXiv:2505.05103) combines weighted voting with Hierarchical Structure Clustering to split Core and Edge nodes. The honest empirical result from "Can AI Agents Agree?" (arXiv:2603.01213) is that even scalar agreement is fragile today — a single deceptive agent can compromise a Mixture-of-Agents. BFT is necessary but not sufficient. This lesson builds a minimal BFT protocol, injects three agent-specific attacks (byzantine lie, sycophantic conformity, correlated-error monoculture), and measures how each consensus variant copes.

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## Problem

You have N LLM agents each producing an answer. They disagree. Majority vote picks the wrong one because two agents are correlated (same base model, same training data, same failure modes). A third agent happens to be wrong in a novel way — so the majority is a false majority.

Now add a deceptive agent: it lies on purpose. Or a sycophantic agent: it agrees with whoever spoke last. In classical BFT, the assumption is that Byzantine nodes are a fraction `f < n/3` and behave arbitrarily. The 2026 reality is that LLM nodes are stochastic even when honest, correlated across models, and influenced by each other's outputs. You cannot treat them as independent Bernoulli voters.

Classical BFT (PBFT, 1999) is not wrong — it is incomplete. It handles arbitrary bit-flipping. It does not handle "three honest agents share a hallucination because they share training data." This lesson builds from PBFT's foundation and layers on three 2025-2026 adaptations.

## Concept

### What classical BFT gives you

Practical Byzantine Fault Tolerance (Castro & Liskov, OSDI 1999) tolerates `f < n/3` Byzantine nodes. The protocol has three phases (pre-prepare, prepare, commit) and two primitives (signed messages, quorum certificates). Agreement on a single value among `n >= 3f + 1` honest-or-malicious nodes.

The guarantees are strong but assume:

1. **Independent faults.** Byzantines do not coordinate.
2. **Honest nodes are truly honest.** Correctness of honest outputs is a non-issue; the protocol only aligns disagreement.
3. **The question has a ground-truth answer.** Consensus on a wrong fact is still consensus.

LLM agents violate all three. Two agents running the same base model share faults. An "honest" LLM still hallucinates. And on ambiguous questions, the "truth" is what the agents decide — there is no external oracle.

### The three LLM-specific attacks

**Byzantine lie.** One agent outputs a deliberately wrong answer. Classical BFT handles this if `f < n/3`.

**Sycophantic conformity.** One agent reads others' answers before voting and aligns with whoever spoke last. Not malicious, but correlates with the loudest voice. Classical BFT does not prevent this because the agent passes every signature check.

**Correlated-error monoculture.** Three agents share a base model. They hallucinate the same wrong answer. The majority is wrong. Classical BFT does not help because all three "honestly" agree.

### The 2025-2026 responses

**CP-WBFT** (arXiv:2511.10400) — Confidence-Probed Weighted BFT. Each voter attaches a confidence probe to its answer (a self-reported probability, or a separate calibration model's prediction). Vote weights scale with confidence. Reported +85.71% BFT improvement on complete graphs. Mitigation for: sycophantic conformity (conforming agents tend to have low confidence on their volunteered position).

**DecentLLMs** (arXiv:2507.14928) — Leaderless. Worker agents propose in parallel, evaluator agents score proposals, final answer is the geometric median of scored positions. Robust when `f < n/2`. Mitigation for: Byzantine lie and correlated errors (geometric median is robust to outliers and pulls toward the dense cluster, not the model-biased average).

**WBFT** (arXiv:2505.05103) — Weighted BFT with Hierarchical Structure Clustering. Vote weights are assigned by response quality plus a trust score learned from history. Cluster agents into Core and Edge; Core agents must achieve consensus first, Edge agents follow. Mitigation for: scalability (Core consensus is small and fast) and partially for monoculture (Core can be chosen for diversity).

### Empirical: "Can AI Agents Agree?" (arXiv:2603.01213)

The paper measures scalar agreement (LLM agents agreeing on a single numeric value) across multiple frontier models. The finding is uncomfortable:

- Even with no adversaries, LLM agents disagree on scalar questions at rates above 30% on many benchmarks.
- A single agent that adopts a deceptive persona can pull the Mixture-of-Agents consensus 40+ percentage points off the honest baseline.
- Disagreement rates correlate with model diversity — heterogeneous ensembles disagree more than homogeneous ones (good: uncorrelated errors) but also drift more slowly (bad: longer time-to-agreement).

The takeaway: BFT gives you machinery to align outputs, but it does not tell you whether the aligned output is right. Combine with verification (Phase 16 · 08 role specialization), diversity (Phase 16 · 15 debate variants), and evaluator agents (Phase 16 · 24 benchmarks).

### The core protocol, stripped down

A minimal BFT round for LLM agents:

```
1. task arrives; each agent i produces answer a_i
2. each agent attaches confidence probe c_i in [0, 1]
3. aggregator collects (a_i, c_i) from all n agents
4. aggregator groups by semantic cluster (equivalent answers)
5. aggregator computes weight for each cluster C:
     w(C) = sum_{i in C} c_i
6. winner = cluster with max weight, if max > threshold * sum(c_i)
   else: retry or escalate
7. minority clusters logged with provenance for post-hoc audit
```

The semantic clustering step is the LLM-specific twist. Two answers "the study reports 4.2%" and "4.2% improvement" are the same cluster. A naive string-equality check would miss this. In production, use a cheap embedding model or explicit canonicalization.

### Threshold tuning

The `threshold` parameter decides when to accept and when to retry. Too low: you accept weak majorities. Too high: you never accept anything. Empirical range: 0.5-0.67 for `n=5-7` agents, higher for smaller `n`. Below a threshold, escalate to a human or to a different agent ensemble.

### Where consensus does not help

- **Ambiguous questions.** If the question has no ground truth, consensus is an opinion. Call it that.
- **Compound questions.** "Write code and explain it" — two answers. Vote on each independently.
- **Adversarial multi-round.** If agents can observe prior rounds and mimic (Du 2023 debate), they start agreeing with each other regardless of truth. Bound the rounds (2-3 typically).

## Build It

`code/main.py` implements:

- `AgentVoter` — a scripted policy with (answer, confidence).
- `MajorityVote` — classical plurality.
- `CPWBFT` — confidence-weighted voting with semantic clustering.
- `DecentLLMs` — geometric-median aggregation on scored proposals.
- `Scenario` — runs each aggregator under three attack patterns.

Attack patterns implemented:

1. `byzantine`: one agent lies with high confidence.
2. `sycophancy`: one agent copies the first answer it sees, with matching confidence.
3. `monoculture`: three agents share a wrong answer (correlated error) with moderate confidence.

Run:

```
python3 code/main.py
```

Expected output: a table of (attack, aggregator) -> final answer, with the correct answer highlighted. Plurality fails the monoculture case. CPWBFT's confidence weighting mitigates sycophancy. DecentLLMs' geometric-median pulls toward the honest cluster when monoculture is less than half the population.

## Use It

`outputs/skill-consensus-designer.md` designs a consensus protocol for a multi-agent ensemble: clustering method, weighting, threshold, and the escalation policy for sub-threshold rounds.

## Ship It

Before shipping any consensus mechanism:

- **Attack-test with at least the three patterns** above. Your protocol should fail predictably, not silently.
- **Log every minority cluster** with provenance. Minority clusters are your early-warning system for correlated errors.
- **Enforce bounded rounds.** No "keep debating until agreement" — that rewards sycophancy.
- **Separate agreement from correctness.** Consensus output goes to a verifier; verifier is independent of the ensemble.
- **Monitor the agreement rate.** A sharp rise means conformity bias; a sharp fall means model drift.

## Exercises

1. Run `code/main.py`. Confirm plurality fails the monoculture attack but CPWBFT partially mitigates it when the monoculture confidence is below 0.7.
2. Add a fourth attack pattern: **silent abstention** — one agent refuses to answer ("I don't know"). How should each aggregator treat abstentions? Implement your choice.
3. Swap the semantic clustering from string canonicalization to embedding-similarity (use any open-source embedding model). What happens to the sycophancy attack?
4. Read CP-WBFT (arXiv:2511.10400). Implement the confidence-probe calibration step (a separate calibration model checks each agent's self-reported confidence). Measure the accuracy gain on the monoculture scenario.
5. Read "Can AI Agents Agree?" (arXiv:2603.01213). Reproduce a simplified scalar-agreement experiment: three agents, one scalar question, the deceptive-persona prompt. Does CPWBFT or DecentLLMs catch it?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| BFT | "Byzantine fault tolerance" | Castro-Liskov 1999 protocol for consensus with `f < n/3` arbitrary faults. |
| Byzantine | "Any bad behavior" | A node that can lie, drop messages, fail silently — anything but crash safely. |
| Confidence probe | "How sure are you?" | Self-reported or calibrator-predicted probability attached to a vote. |
| Semantic clustering | "Same answer, different words" | Grouping equivalent answers before counting votes. |
| Geometric median | "Robust center" | The point minimizing sum of distances to sample points. Robust to outliers, unlike the mean. |
| Monoculture | "Same model, same failures" | Correlated errors when agents share training data or base model. |
| Sycophantic conformity | "Agreeing with the loud voice" | An agent's vote biases toward whoever spoke first/loudest. |
| Core/Edge | "Hierarchical BFT" | WBFT split: small Core consensus first, Edge nodes follow. Bounds latency. |

## Further Reading

- [Castro & Liskov — Practical Byzantine Fault Tolerance (OSDI 1999)](https://pmg.csail.mit.edu/papers/osdi99.pdf) — the foundation
- [CP-WBFT — Confidence-Probe Weighted BFT](https://arxiv.org/abs/2511.10400) — vote weighting by confidence
- [DecentLLMs — leaderless multi-agent consensus](https://arxiv.org/abs/2507.14928) — geometric-median aggregation
- [WBFT — Weighted BFT with Hierarchical Structure Clustering](https://arxiv.org/abs/2505.05103) — Core/Edge split for bounded latency
- [Can AI Agents Agree?](https://arxiv.org/abs/2603.01213) — scalar-agreement fragility and deceptive-persona attack
