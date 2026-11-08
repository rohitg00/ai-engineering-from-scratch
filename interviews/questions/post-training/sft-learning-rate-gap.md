---
id: sft-learning-rate-gap
title: Reusing the pretraining learning rate for SFT
card: post-training
kind: concept
level: 2
roles: [applied-ai-engineer, ai-data-engineer]
rounds: [ml-depth, debugging]
tags: [sft, learning-rate, catastrophic-forgetting, epochs]
minutes: 8
lessons: [phases/10-llms-from-scratch/06-instruction-tuning-sft]
manuals: []
practice: []
cheatsheet: [llm-pipeline-capstone]
related: [post-training/sft-data-quality-wins]
updated: 2026-11-03
---

A colleague copies the pretraining configuration into an SFT run: the same peak learning rate, the same warmup, three epochs over 27,000 examples. The loss on the SFT set drops fast and everyone is happy. What do you expect to see when you test the model, and what do you change?

## Short answer

Expect catastrophic forgetting: the model answers in the training format, but its loss on raw text rises and it gets worse at code, math and anything outside the set. Pretraining used a peak rate about fifteen times higher than the SFT value in the lesson, 3e-4 against 2e-5. Cut the rate into the 1e-5 to 5e-5 range, keep one to three epochs, and track raw-text loss next to the SFT loss.

## Full answer

### Two very different regimes

| Setting | Pretraining | SFT |
|---|---|---|
| Peak learning rate | 3e-4 | 2e-5 |
| Epochs | 1 | 2 |
| Warmup steps | 2,000 | 0 to 100 |
| Data | 2T tokens | 27,000 examples |

The SFT run adjusts a model that already works. A large step overwrites pretrained features with the patterns of a small set.

### How to see the damage

Hold out a slice of raw text and measure its next-token loss before and after SFT. The lesson's rule: a rise of more than 10 to 15 percent means the run is too aggressive. Lower the rate or the epochs. Run a small eval on tasks outside the SFT set as well.

### Three mitigations

1. A low learning rate, 1e-5 to 5e-5.
2. Short training, 1 to 3 epochs. More than 3 epochs on a small set leads to memorization, and the model repeats training examples word for word.
3. A mix of 2 to 5 percent raw pretraining text in the SFT batches, with no mask, so that the model keeps its general ability.

### Why the loss curve misleads

A fast drop in SFT loss at a high rate is overfitting to the set, not learning. The lesson's exercise compares 1e-4, 2e-5 and 1e-6: the high rate falls fast and ends higher, the low rate barely moves, and the middle value is the sweet spot.

## Follow-ups

- **Level 2:** Why does a rate that works for pretraining destroy an SFT run? Expected: pretraining starts from noise and averages over trillions of tokens; SFT starts from a working model and a small set, so each large step overwrites features that the set does not cover.
- **Level 2:** How many epochs, and how do you decide? Expected: one to three; stop when the held-out instruction loss stops improving and the raw-text loss has not risen past the budget.
- **Level 3:** The raw-text loss rose by a quarter, but the product team likes the answers. Ship it? Expected: not as it is; the model lost general ability that users will hit; rerun with a lower rate or a pretraining mix and compare on an eval outside the set.
- **Level 3:** How does LoRA change this picture? Expected: the base weights stay frozen, so the damage is bounded to the adapter and a merge is reversible; the adapter also tolerates a higher rate than a full update.

## Wrong answers

- "The SFT loss dropped, so the run worked." The loss on the set says nothing about what the model forgot; measure the raw-text loss and an eval outside the set.
- "Warm up for 2,000 steps, like pretraining." The SFT set gives few steps in total; the lesson uses 0 to 100 warmup steps.
- "Use a higher rate to finish faster, the data is small." A high rate on a small set overfits and overwrites pretrained knowledge; small data needs smaller steps, not larger ones.

## Taught in

The [SFT lesson](../../../phases/10-llms-from-scratch/06-instruction-tuning-sft/) compares the pretraining and SFT hyperparameters and measures forgetting with a raw-text loss.
