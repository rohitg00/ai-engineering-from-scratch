---
id: compute-split-params-tokens
title: Split a fixed compute budget between size and tokens
card: transformers
kind: tradeoff
level: 4
roles: [inference-engineer, ai-data-engineer, applied-ai-engineer]
rounds: [system-design, ml-depth]
tags: [scaling-laws, compute-optimal, over-training, pretraining, inference-cost]
minutes: 15
lessons: [phases/07-transformers-deep-dive/13-scaling-laws]
manuals: []
practice: []
cheatsheet: [scaling-laws-pretraining]
related: [transformers/block-parameter-count]
updated: 2026-11-03
---

You lead a pretraining run with a fixed compute budget. One plan trains a 175B-parameter model on 300B tokens. Another trains a much smaller model on far more tokens. Which do you pick, how do you defend it to leadership, and when would you deliberately train past the point that the scaling law calls optimal?

## Short answer

Compute is about 6 times the parameter count times the training tokens, so the budget fixes the product and leaves the split open. The compute-optimal split is about 20 tokens per parameter; the first plan has about 1.7 tokens per parameter, which the lesson calls ten times undertrained, and a 70B model trained on 1.4T tokens beat that 175B model on every benchmark at 2.5 times less inference cost. If the model will serve a large volume, go past the optimum on purpose: train smaller and longer, because training is paid once and inference is paid forever.

## Full answer

### The law

```text
L(N, D) = A / N^alpha + B / D^beta + E
alpha about 0.34, beta about 0.28, E about 1.69, A about 406, B about 411
```

N is the non-embedding parameter count, D the training tokens, E the irreducible loss of the data itself. Minimize L under `C = 6 N D` and the two optimal quantities grow with about the square root of the budget:

```text
N_opt about 0.22 * (C / 6)^0.5
D_opt about 4.5  * (C / 6)^0.5
D_opt / N_opt about 20
```

The fitted exponents drift slowly, about 0.45 for N and 0.55 for D with the constants above, so the ratio moves with the budget; the lesson's code finds the optimum by grid search.

### What the two plans look like

| Plan | N | D | Tokens per parameter |
|---|---|---|---|
| Large and short | 175B | 300B | about 1.7 |
| Compute-optimal | 70B | 1.4T | 20 |
| Inference-optimized | 8B | 15T | 1,875 |

The rows do not share one budget: the second and third rows use about twice the compute of the first, so they compare ratios, not alternatives at the same cost. The last row is a production model family that trained a small model ninety-four times past the compute-optimal ratio. For a service that answers a trillion tokens a month, inference dominates total cost, and a model that fits consumer hardware with a fraction of the latency wins even though its training loss per training FLOP was worse. The lesson's range for inference-dominated workloads is 100 to 500 tokens per parameter depending on serving volume.

### How to defend it

1. Show the budget as `6 N D` and the loss contours over N and D; the first plan sits far from the valley.
2. Show the inference bill at the expected volume for each N; the small model's saving repeats every month.
3. Show the loss gap you accept by over-training, read from the law at the chosen N and D.

### What changes the constants but not the shape

Data curation can shift the curves by more than 2 times effective compute. A mixture-of-experts model decouples total parameters from active FLOPs, so the law applies per active parameter. A better optimizer shifted the constant by about 2 times in one 2024 result. None of these change the power-law shape.

### The fine-tuning corollary

The lesson's rule of thumb: if your task data holds fewer than 20 tokens per parameter of the base model, expect saturation at some loss floor. Treat it as a warning to measure, not as a rule for the base size.

## Follow-ups

- **Level 3:** What is the E term and why can no budget remove it? Expected: the irreducible loss, the entropy of the data itself; the law approaches it but never crosses it.
- **Level 4:** How does a sparse expert architecture change the plan? Expected: FLOPs follow the active parameters, so the optimal D is set against active N while total N sets memory.
- **Level 4:** The web runs out of high-quality tokens for your budget. What are the levers? Expected: the lesson puts filtered English at about 5 to 10 trillion tokens; the levers are synthetic data, multilingual and multimodal data, and better curation.
- **Level 4:** How would you check the law on your own stack before betting the budget? Expected: fit it on five small models from 100K to 10M parameters on the same data and compare the exponents with the published ones.

## Wrong answers

- "The bigger model always wins at fixed compute." The 70B model trained on 1.4T tokens beat the 175B model trained on 300B.
- "Compute-optimal is also the cheapest model to serve." It minimizes training loss per training FLOP; serving cost scales with N, which is why production models over-train.
- "A loss prediction is useless because abilities appear suddenly." The continuous loss is smooth and predictable; sudden benchmark jumps are mostly scorer artifacts.

## Taught in

The [scaling laws lesson](../../../phases/07-transformers-deep-dive/13-scaling-laws/) gives the law, the optimal split and the case for over-training.
