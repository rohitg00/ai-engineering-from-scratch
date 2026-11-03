---
id: dpo-or-rlhf
title: DPO or the full RLHF stack for a small team
card: post-training
kind: tradeoff
level: 3
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, forward-deployed-ai-engineer]
rounds: [system-design, ml-depth]
tags: [dpo, rlhf, compute-budget, preference-data, alignment]
minutes: 12
lessons: [phases/10-llms-from-scratch/08-dpo, phases/09-reinforcement-learning/09-reward-modeling-rlhf]
manuals: []
practice: []
cheatsheet: [rlhf-dpo]
related: [post-training/dpo-implicit-reward, post-training/kl-penalty-purpose]
updated: 2026-11-03
---

A team of four engineers with eight GPUs has about 20,000 preference pairs for a customer support assistant and wants it aligned in three weeks. One engineer wants the full RLHF stack with a reward model and PPO. Another wants DPO. Which do you pick, and under what conditions would you reverse the choice?

## Short answer

Pick DPO. With tens of thousands of pairs it matches or beats the full stack, it trains one model against a frozen reference in a supervised loop, it needs about a third of the compute, and each experiment takes hours instead of days. Reverse the choice when the signal has several dimensions and needs a learned reward you can inspect and reuse, when you want an online loop that rates fresh samples, or when DPO plateaus on your eval.

## Full answer

### What DPO buys

| Aspect | RLHF with PPO | DPO |
|---|---|---|
| Models trained | three: SFT, reward, policy | one: the policy |
| Models in memory | three or four during PPO | two: policy and reference |
| Hyperparameters | learning rate, KL coefficient, clip ratio, reward model rate, epochs for each stage | learning rate, beta, epochs |
| Stability | sensitive to the settings | close to SFT |

For a 70B model each copy takes 140GB in FP16, so one model fewer in memory is a different hardware tier.

### When DPO wins

- Small datasets, 5,000 to 20,000 pairs. A reward model needs enough data to generalize and overfits below that; DPO never fits one.
- Limited compute. One training loop instead of three, roughly one third of the full stack.
- Fast iteration. Trying 10 preference sets takes ten runs of hours each, with no reward model to retrain for each one.

The lesson's reference result: a 7B model aligned with DPO on 60K pairs scored 6.47 on a chat benchmark against 6.86 for a 70B chat model trained with the full stack, within six percent of a model ten times its size.

### When the full stack wins

- Several quality dimensions at once, such as helpfulness, harmlessness and honesty. A reward model learns the trade-off; DPO sees each pair as one binary signal.
- An online loop: sample from the current policy, rate, retrain the reward model, continue. DPO works on a fixed set.
- A reward model you can reuse for best-of-N sampling or as a judge at decode time.
- The largest scales, where a separate reward model has captured more nuance in published pipelines.

### The practical path

Start with DPO. Switch to the full stack when the eval plateaus. Several production pipelines run both: the full stack first for broad alignment, DPO after it for targeted refinement.

## Follow-ups

- **Level 3:** What does the DPO run still need from the RLHF recipe? Expected: an SFT checkpoint as the frozen reference, a held-out eval, and a beta choice that plays the role of the KL coefficient.
- **Level 3:** The pairs come from an older model's outputs. Does that matter for DPO? Expected: yes; pairs that are rare under the reference produce arbitrary implicit rewards, so sample the pairs from the SFT model or filter them by reference likelihood.
- **Level 4:** How would you turn the three weeks into an iterative loop without PPO? Expected: run DPO, generate from the new policy, collect preferences on those samples, run DPO again; the lesson's exercise calls this iterative DPO.
- **Level 4:** Which failure mode do both methods share? Expected: over-optimization of a proxy, the reward model in one case and the ratio to the reference in the other; both need a blind eval and early stopping.

## Wrong answers

- "RLHF is the proven path, so start there." The full stack is fragile to tune and needs three training loops; the lesson's practical guidance starts with DPO and switches only on a plateau.
- "DPO needs no SFT stage." It needs a reference policy, and that reference is the SFT checkpoint; the single-stage methods are different losses.
- "DPO has no hyperparameters to worry about." Beta decides how far the policy moves from the reference, and the lesson's sweep shows degenerate answers at a small value and no learning at a large one.

## Taught in

The [DPO lesson](../../../phases/10-llms-from-scratch/08-dpo/) compares both methods on data, compute and memory, and the [reward modeling lesson](../../../phases/09-reinforcement-learning/09-reward-modeling-rlhf/) places each in the layered alignment stack.
