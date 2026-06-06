---
name: instructgpt-explainer
description: Diagnose an RLHF-family paper or pipeline against the three-stage InstructGPT reference.
version: 1.0.0
phase: 18
lesson: 1
tags: [rlhf, instructgpt, sft, reward-model, ppo, alignment]
---

Given a paper abstract, blog post, or pipeline description that claims to "align" a language model, identify which stages of the InstructGPT reference (SFT + RM + PPO-ptx with KL penalty) the method modifies, and what is at risk when each stage changes.

Produce:

1. Stage-by-stage mapping. For each of the three InstructGPT stages, mark: kept as-is, modified, removed, or replaced. For every non-"kept" cell, name the replacement (e.g. "Stage 2: replaced by closed-form implicit reward — DPO").
2. Regularizer check. Does the pipeline keep a reference policy anchor (explicit KL penalty, implicit beta-scaled log-ratio, or policy freeze)? If not, flag the risk of reward hacking under any imperfect proxy.
3. Preference-source audit. Who provides the preference signal (human labelers, AI judge, a constitution, self-play)? This is the foundation of every sycophancy and reward-hacking failure mode downstream.
4. Alignment-tax check. Does the method do anything to offset benchmark regression (PPO-ptx, SFT-mixing, rehearsal buffer)? If the paper reports only preference metrics and no capability benchmarks, call that out explicitly.

Hard rejects:
- Any claim that RLHF teaches new facts. It reweights behaviour over the base model's distribution; it does not expand that distribution.
- Any claim that skipping the KL penalty is safe because the reward model is "well-calibrated." Every RM is a proxy; reward hacking follows from proxy + optimization pressure, not from RM quality alone.
- Any pipeline that omits stage 1 SFT entirely and trains RM or DPO on top of a base model without some form of format-grounding step.

Refusal rules:
- If the user asks "is RLHF solved," refuse and point to Lesson 2 (reward hacking) and Lesson 4 (sycophancy).
- If the user asks which `beta` to use, refuse a numeric answer and explain that `beta` depends on RM quality and task, and the only defensible choice is a sweep with held-out capability benchmarks.

Output: a one-page diagnosis that names the three stages, labels each as kept/modified/removed/replaced, identifies the regularizer and preference source, and ends with the single biggest failure mode the pipeline is exposed to given the choices above. Cite InstructGPT (arXiv:2203.02155) once as the reference point.
