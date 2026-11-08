---
id: three-copies-of-one-model-voted
title: Three copies of one model voted, and the majority was wrong
card: multi-agent
kind: concept
level: 4
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [ml-depth, system-design]
tags: [consensus, bft, monoculture, confidence-weighting, sycophancy]
minutes: 15
lessons: [phases/16-multi-agent-and-swarms/14-consensus-and-bft]
manuals: []
practice: []
cheatsheet: [multi-agent, emergent-agent-societies]
related: [multi-agent/two-workers-return-different-facts]
updated: 2026-11-03
---

Five agents answer the same factual question and vote. Three of them run the same base model and agree on a wrong answer, and the two others are right. Majority vote picks the wrong answer. A colleague says that classical fault-tolerant consensus solves this. Explain why it does not, which assumptions break, and what the recent agent-specific protocols change.

## Short answer

Classical consensus tolerates fewer than a third of nodes behaving arbitrarily, and it assumes that faults are independent, that honest nodes are correct, and that a ground truth exists. Three agents on a shared base model share their faults, an honest model still hallucinates, and on some questions the agents define the truth. The agent-specific variants weigh each vote by a confidence probe, aggregate leaderless proposals by a geometric median, or split agents into a core and an edge with learned trust weights. None of them makes agreement equal correctness, so the consensus output still goes to an independent verifier.

## Full answer

### What the classical protocol gives and assumes

The standard protocol reaches agreement on one value among n nodes when fewer than n divided by three are faulty, which needs n at least three f plus one. It runs three phases over signed messages and quorum certificates. Its three assumptions:

1. Faults are independent, so faulty nodes do not coordinate.
2. Honest nodes are correct, so the protocol only aligns disagreement.
3. The question has a ground truth, so agreement on a wrong value is still agreement.

Model agents break all three. Agents on one base model share faults. An honest agent hallucinates. And on an ambiguous question the agents decide what is true.

### Three attacks that pass the signature check

| Attack | What happens | Does the classical protocol handle it |
|---|---|---|
| A deliberate lie | One agent outputs a wrong answer with high confidence | Yes, while the liars are under a third |
| Sycophantic conformity | One agent reads the others and aligns with whoever spoke last | No, because the agent passes every check |
| Correlated monoculture | Three agents on one model hallucinate the same answer | No, because all three honestly agree |

The prompt's case is the third.

### The agent-specific responses

- **Confidence-weighted voting.** Each voter attaches a confidence probe, self-reported or from a calibration model, and the vote weight scales with it. The lesson reports a large improvement on fully connected graphs. It helps most against conformity, because an agent that adopted a position it did not derive tends to report low confidence.
- **Leaderless aggregation by geometric median.** Workers propose in parallel, evaluators score the proposals, and the answer is the geometric median of the scored positions. It is robust while the faulty fraction is under a half, and it resists outliers and pulls toward the dense cluster rather than the model-biased mean.
- **Weighted voting with a core and an edge.** Weights come from response quality and a trust score learned from history. A small core reaches agreement first and the edge follows, which bounds latency and lets the core be chosen for diversity.

### The stripped-down round

Each agent produces an answer and a confidence. The aggregator groups answers into semantic clusters, so that two phrasings of one value count together, sums the confidence per cluster, and accepts the top cluster only when its share passes a threshold. Below the threshold it retries or escalates. The lesson's working range for the threshold is 0.5 to 0.67 with five to seven agents. Minority clusters are logged with provenance, because they are the early warning for correlated errors.

### The uncomfortable measurement

The lesson cites a study of scalar agreement across frontier models: even with no adversary, agents disagreed on scalar questions at rates above 30 percent on many benchmarks, and a single agent with a deceptive persona pulled the mixture's consensus more than 40 percentage points off the honest baseline. Consensus machinery aligns outputs. It does not tell you whether the aligned output is right.

## Follow-ups

- **Level 3:** Does the geometric median rescue this case? Expected: no. The median discounts outliers and moves toward the dense cluster, which helps only while the wrong cluster is under half. Here three of five votes are wrong, so the dense cluster is the wrong one and the median selects it.
- **Level 3:** The three wrong agents are also the most confident. What now? Expected: no aggregator fixes a wrong cluster that is both larger and more confident, so the system needs diversity of base models or an independent verifier.
- **Level 4:** Why bound the rounds at two or three? Expected: agents that observe earlier rounds start to mimic each other regardless of truth, so more rounds reward conformity.
- **Level 4:** What do you monitor in production? Expected: the agreement rate, where a sharp rise means conformity and a sharp fall means model drift, and the minority clusters with their provenance.

## Wrong answers

- "Use the classical protocol with a two-thirds quorum." Three honest agents that share a hallucination form the quorum, and the protocol agrees on the wrong value.
- "Add more copies of the same model until the majority is right." More copies of one model add more correlated votes, and the wrong cluster grows with them.
- "Consensus means the answer is correct." Agreement and correctness are different measurements, and the consensus output needs a verifier that is independent of the ensemble.

## Taught in

The [consensus and fault tolerance lesson](../../../phases/16-multi-agent-and-swarms/14-consensus-and-bft/) builds the minimal protocol and runs the three attacks against three aggregators.
