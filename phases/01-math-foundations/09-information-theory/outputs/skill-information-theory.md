---
name: skill-information-theory
description: Apply information theory concepts to ML loss functions, model evaluation, and feature selection
version: 1.0.0
phase: 1
lesson: 9
tags: [information-theory, entropy, loss-functions]
---

# Information Theory for ML

When to use entropy, cross-entropy, KL divergence, and mutual information in machine learning systems.

## Decision Checklist

1. Measuring uncertainty in a single distribution? Use **entropy**.
2. Measuring how well a model approximates true labels? Use **cross-entropy** (this is your classification loss).
3. Measuring distance between two distributions? Use **KL divergence**.
4. Checking if two variables are related? Use **mutual information**.
5. Reporting language model quality? Use **perplexity** (exponential of cross-entropy).
6. Distilling one model into another? Minimize **KL divergence** from teacher to student.

## When to use each measure

| Measure | Formula | Use case | ML application |
|---|---|---|---|
| Entropy H(P) | -sum(p log p) | How uncertain is this distribution? | Data complexity, maximum entropy models |
| Cross-entropy H(P,Q) | -sum(p log q) | How good is model Q at predicting true P? | Classification loss, language model loss |
| KL divergence D(P\|\|Q) | sum(p log(p/q)) | How different are P and Q? | VAE loss (ELBO), knowledge distillation, RLHF |
| Mutual information I(X;Y) | H(X) - H(X\|Y) | How much does Y tell us about X? | Feature selection, representation learning |
| Perplexity | exp(H(P,Q)) or 2^H | How confused is the model? | Language model evaluation |
| Conditional entropy H(X\|Y) | -sum(p(x,y) log p(x\|y)) | Remaining uncertainty in X after knowing Y | Feature informativeness |

## Key relationships

```
Cross-entropy  = Entropy + KL divergence
H(P, Q)        = H(P)   + D_KL(P || Q)

Since H(P) is constant during training:
  Minimizing cross-entropy = Minimizing KL divergence

Mutual information = Entropy - Conditional entropy
I(X; Y) = H(X) - H(X|Y) = H(Y) - H(Y|X)

Perplexity = exp(cross-entropy in nats)
           = 2^(cross-entropy in bits)
```

## Quick reference: formulas and units

| Formula | Bits (log base 2) | Nats (log base e) |
|---|---|---|
| Information: -log(p) | -log2(p) | -ln(p) |
| Entropy: -sum(p log p) | bits | nats |
| 1 nat = | 1.4427 bits | 1 nat |
| PyTorch default | -- | nats |
| Information theory papers | bits | -- |

## Interpreting values

| Entropy value | What it means |
|---|---|
| 0 | Deterministic. One outcome has probability 1. |
| log(n) | Maximum uncertainty. Uniform distribution over n outcomes. |
| Low | Distribution is peaked. Model is confident. |
| High | Distribution is flat. Model is uncertain. |

| Perplexity value | Language model quality |
|---|---|
| 1 | Perfect prediction (never happens in practice) |
| 10 | Choosing among ~10 equally likely tokens on average |
| 50 | GPT-2 level on standard benchmarks |
| < 10 | State-of-the-art for well-represented domains |

## Common mistakes

- Computing KL divergence and treating it as symmetric. D_KL(P||Q) != D_KL(Q||P). For a symmetric measure, use Jensen-Shannon divergence: JS = 0.5 * KL(P||M) + 0.5 * KL(Q||M) where M = 0.5*(P+Q).
- Forgetting that cross-entropy with one-hot labels simplifies to -log(p_true_class). You do not need to sum over all classes when the true distribution is one-hot.
- Using log base 2 in code but reporting nats (or vice versa). PyTorch uses natural log by default. Multiply by log2(e) = 1.4427 to convert nats to bits.
- Computing entropy of an empty or zero-probability event. Convention: 0 * log(0) = 0, because lim(p->0) p*log(p) = 0.
- Comparing perplexity across different vocabularies. A model with vocab size 50k and perplexity 30 is not directly comparable to one with vocab size 10k and perplexity 30.

## Where each concept appears in production ML

| Concept | Where you see it |
|---|---|
| Cross-entropy loss | Every classification model (nn.CrossEntropyLoss) |
| KL divergence | VAE ELBO, PPO clipping, knowledge distillation |
| Entropy regularization | Exploration bonus in RL (higher entropy = more exploration) |
| Mutual information | Feature selection, InfoNCE loss (contrastive learning) |
| Perplexity | Language model benchmarks (lower = better) |
| Label smoothing | Replaces one-hot with soft targets, reduces cross-entropy overconfidence |
| Temperature scaling | Divides logits by T before softmax, controls entropy of output |
