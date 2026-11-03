---
id: post-training-pipeline-take-home
title: Plan the post-training of a support assistant
card: post-training
kind: take-home
level: 4
roles: [applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [take-home, system-design]
tags: [sft, dpo, qlora, pipeline, evaluation]
minutes: 45
lessons: [phases/10-llms-from-scratch/06-instruction-tuning-sft, phases/11-llm-engineering/08-fine-tuning-lora, phases/10-llms-from-scratch/08-dpo, phases/09-reinforcement-learning/09-reward-modeling-rlhf, phases/19-capstone-projects/39-instruction-tuning-sft, phases/19-capstone-projects/40-dpo-from-scratch]
manuals: []
practice: [dpo-loss, lora-forward]
cheatsheet: [llm-pipeline-capstone, rlhf-dpo, lora-fine-tuning]
related: [post-training/dpo-or-rlhf, post-training/qlora-on-one-gpu, post-training/sft-learning-rate-gap]
updated: 2026-11-03
---

Take-home. A company wants a support assistant built from an open 8B base model. They have about 50,000 past support conversations with customer ratings, two 24 GB GPUs, and three weeks. Write the post-training plan on one page: the stages, the data for each stage, the settings you start from, what you measure after each stage, and the three failure modes you guard against.

## Short answer

Three stages: first, SFT with QLoRA on the top-rated conversations in one chat template with the loss masked to the assistant turns, at a low learning rate for one to three epochs with a few percent of raw text mixed in, measured by held-out instruction loss, raw-text drift and a sample read. Second, DPO against the SFT checkpoint as the frozen reference, on pairs built from high- and low-rated answers to the same prompt with a conservative beta, measured by a blind pairwise eval and the absolute chosen log-probability, not the training margin. Third, a release gate: a fixed prompt set rated blind, a refusal set, and a comparison with the base model on tasks the data never covered. The guards are catastrophic forgetting, length and agreement exploits in the ratings, and over-optimization of the preference proxy.

## Full answer

### Stage 0: data

- Convert every conversation into one chat template, with a fixed system prompt.
- SFT set: the top-rated answers, filtered for length, vocabulary diversity and a clean instruction-to-answer ratio. Tens of thousands of clean examples are enough; the reference SFT stage in the lesson used about 27,000.
- Preference set: for prompts with both a high-rated and a low-rated answer, build prompt, chosen and rejected triples. Where the data is thin, sample the rejected side from the SFT model, so that the pairs are in-distribution for the reference. A rater or a judge must confirm that each sampled answer is worse than the chosen one before it becomes a pair, because the SFT model trained on top-rated answers and its samples can be as good. Aim for the 5,000 to 20,000 pairs where DPO works well.
- A blind eval set of prompts never used in training, plus a forgetting set of tasks outside support, such as short code and arithmetic.

### Stage 1: SFT with QLoRA

Two 24 GB cards cannot hold a full update of this model; a 7B full update needs about 56 GB with gradients and optimizer states. QLoRA keeps the base in 4-bit and trains adapters of rank 16 on the attention projections in about 6 GB, so each card runs its own experiment.

Start from: the lesson's SFT learning rate of 2e-5 for a full update, with a higher rate for adapters as the LoRA lesson's trainer shows; one to three epochs; 2 to 5 percent raw pretraining text mixed into the batches.

Measure: held-out instruction loss, raw-text loss before and after with a budget of a 10 to 15 percent rise, exact match on the templated tasks where it applies, and a read of fifty samples.

### Stage 2: DPO

Reference: the merged SFT checkpoint, frozen. Policy: a copy with fresh adapters. Beta in the 0.1 to 0.3 range, a few epochs, and the four log-probabilities per pair over the answer tokens only.

Measure: a blind pairwise eval against the SFT model on the held-out prompts, the implicit reward margin, the absolute chosen log-probability, the response length by checkpoint, and the forgetting set again. Stop on the eval, not on the margin.

### Stage 3: release gate

- A fixed prompt set rated blind by people, against the SFT checkpoint and the base.
- A refusal and safety set with the expected behavior written down.
- The forgetting set.
- Adapters kept separate for a rollback; a merge only for the shipped artifact.

### The three guards

1. Catastrophic forgetting: low rate, short training, a pretraining mix, and a raw-text loss budget.
2. Exploits of the rating signal: raters liked long and agreeable answers, so watch the length and the agreement with the premise, and filter pairs where length alone separates them.
3. Over-optimization of the proxy: the DPO ratio can be pushed off the data, so stop early on the blind eval and keep beta conservative.

### Schedule

Week one: data and SFT. Week two: DPO and the first blind eval. Week three: the gate, a second seed of the best configuration, and the rollback plan.

## Follow-ups

- **Level 3:** Why DPO and not a reward model with PPO here? Expected: tens of thousands of pairs, two small GPUs and three weeks fit the DPO regime; a reward model and PPO need three loops and more memory.
- **Level 4:** The ratings are one to five stars on single answers, not pairs. What changes? Expected: build pairs only where one prompt has answers at both ends of the scale, or use the unpaired loss that works on good and bad labels and keep the pairs for the eval.
- **Level 4:** How do you prove that the DPO stage did not degrade the SFT behavior? Expected: the blind pairwise eval against the SFT checkpoint, the forgetting set, and the absolute chosen log-probability; a margin that grows while those fall is a stop signal.
- **Level 4:** What would make you add an RL stage with a verifier? Expected: a part of the task with a checkable answer, such as a correct order number or a passing code snippet, where a binary reward and group-relative advantages give a signal the ratings do not.

## Wrong answers

- "Skip SFT and run DPO on the base model." DPO needs a reference that already follows instructions; the single-stage loss is a different method, and the base model's pairs are out of distribution.
- "Fully fine-tune the 8B model across both GPUs." A full update of a model this size needs about 56 GB with the optimizer states; two 24 GB cards hold it only with adapters and a 4-bit base.
- "Use the star ratings as the reward and run PPO." A regression on absolute scores is the weak label the lessons warn about, and the full stack does not fit the compute or the timeline.

## Taught in

The [SFT lesson](../../../phases/10-llms-from-scratch/06-instruction-tuning-sft/) sets the SFT data and settings, the [LoRA lesson](../../../phases/11-llm-engineering/08-fine-tuning-lora/) sizes the QLoRA memory, the [DPO lesson](../../../phases/10-llms-from-scratch/08-dpo/) gives the beta range and the eval, and the [reward modeling lesson](../../../phases/09-reinforcement-learning/09-reward-modeling-rlhf/) lists the over-optimization guards.
