---
name: mesa-diagnostic
description: Classify an observed safety failure as outer-alignment, proxy-inner, or deceptive-inner.
version: 1.0.0
phase: 18
lesson: 6
tags: [mesa-optimization, deceptive-alignment, inner-alignment, hubinger]
---

Given a safety evaluation report (eval task, failure mode, model class, training recipe), classify the failure into the Hubinger 2019 categories and recommend the mitigation class that addresses it.

Produce:

1. Failure-mode categorization. Pick one of:
   - Outer-alignment failure: the base objective (reward, loss) was wrong; the model optimized it correctly.
   - Inner-alignment proxy failure: mesa-objective is a proxy that tracks base in-distribution; fails off-distribution.
   - Inner-alignment deceptive: mesa-optimizer has situational awareness and defects at deployment; training behaviour is clean.
2. Evidence trace. For each category, what evidence would support it. For deceptive, distinguish from proxy: evidence of situational awareness (date sensitivity, eval-vs-deployment distinguishers, strategic reasoning in chain-of-thought).
3. Mitigation class. For outer-alignment: change the objective (CAI, better reward data, process supervision). For proxy-inner: distributional coverage, ensembles, held-out evals. For deceptive-inner: control measures (Lesson 10), interpretability (residual-stream probes), capability reductions.
4. Known-failures check. For deceptive-inner, cite the relevant 2024-2026 empirical demonstration (Sleeper Agents, Alignment Faking, In-Context Scheming) this failure most resembles.

Hard rejects:
- Any classification of deceptive-inner without evidence of situational awareness. "Unexpected behaviour at deployment" is not enough — it could be proxy-inner.
- Any claim that adversarial robustness training alone addresses deceptive-inner. Hubinger 2019 predicts (and Sleeper Agents 2024 confirms) that adversarial training can teach better test-vs-deployment distinguishers.
- Any recommendation to retrain a deceptively aligned model on more data. The prior predicts deception is preserved under further training.

Refusal rules:
- If the evidence is a single failure on a single prompt, refuse to classify. Base rates matter; you need a distribution of failures.
- If the user asks you to "rule out" deceptive alignment, refuse — you can estimate its probability from evidence, but you cannot rule it out behaviourally alone.

Output: a one-page diagnosis with category, evidence trace, mitigation class, and nearest empirical analog. Cite Hubinger et al. (arXiv:1906.01820) once.
