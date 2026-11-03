---
id: char-level-gpt-take-home
title: Take-home, a character-level decoder on a laptop
card: transformers
kind: take-home
level: 3
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [take-home, coding]
tags: [take-home, decoder-only, training-loop, validation-loss, sampling]
minutes: 15
lessons: [phases/07-transformers-deep-dive/14-build-a-transformer-capstone, phases/19-capstone-projects/34-transformer-block]
manuals: []
practice: [train-char-bigram]
cheatsheet: [gpt-from-scratch-training]
related: [transformers/loss-drops-to-zero-no-mask, transformers/modernize-a-2017-block]
updated: 2026-11-03
---

This is the take-home we send: train a small decoder-only transformer on a character-level text corpus of about one megabyte, on a laptop, and return the code, the loss curves and a few samples. Tell me how you would approach it, what a reviewer checks in your submission, and which results prove that the model works.

## Short answer

Build the small reference shape: a character tokenizer over the 65 symbols of the corpus, a token embedding plus a learned positional embedding, a stack of pre-norm blocks with RMSNorm, causal multi-head attention and a SwiGLU network, a final norm and a head tied to the embedding, trained with a shift-by-one cross-entropy on random 256-character windows. Use AdamW, a cosine schedule with warmup and gradient clipping at 1.0, and hold out the last 10 percent of the text for validation. The bar from the lesson: a 4-layer, 4-head model of width 128, about 800K parameters, goes from about 4.2 to about 1.5 training loss in 2,000 steps, about 6 minutes on a laptop, with validation loss under 2.0 that tracks the training loss and samples that look like the corpus.

## Full answer

### What to build

```text
tokens (B, N) -> embedding + position -> [norm, causal attention, residual, norm, SwiGLU, residual] x L
            -> final norm -> head tied to the embedding -> logits (B, N, V) -> shift-by-one loss
```

A byte-level character tokenizer needs no training. The data split is 90 to 10 by position in the text, so that the validation text is never seen in training.

### The training loop

```python
for step in range(max_steps):
    x, y = get_batch("train")
    logits = model(x)
    loss = F.cross_entropy(logits.view(-1, vocab_size), y.view(-1))
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step()
    opt.zero_grad()
```

Log the training and validation loss on the same axis. Sample after training with top-p and stop after 500 characters.

### What a reviewer checks

1. **Correctness of the objective.** The causal mask is applied before the softmax and the targets are the inputs shifted by one. A unit test that perturbs a later token and checks earlier outputs is a strong signal.
2. **The first loss.** About 4.2 at step zero, the uniform baseline, the logarithm of 65. A start well below it is a reason to check for a leak.
3. **Validation discipline.** A held-out split, logged at intervals, that tracks the training loss; the lesson records no overfitting at this size and budget. A validation loss far below training is a reason to check the split and the loss code, because the final 10 percent of text can also be easier.
4. **Training hygiene.** Gradient clipping, a schedule, a fixed seed, and a run that reproduces.
5. **Reading the samples.** Line breaks, archaic words and speaker names in capitals appear; the text is corpus-shaped, not the corpus.

### What proves it works

The loss curve from about 4.2 to about 1.5, a validation loss under 2.0 that follows it, and samples that a reader recognizes as the style of the corpus. A write-up that names the failure the candidate hit and fixed counts for more than a lower loss.

### Stretch goals that separate candidates

Replace the learned positions with rotation of the queries and keys and show the validation loss is at least as low. Add a cache of keys and values to the sampling loop and show the 500-character sample runs 5 to 20 times faster. Train to 5,000 steps and report whether validation keeps improving.

## Follow-ups

- **Level 2:** What is the training loss at step zero and how do you know it is right? Expected: about the logarithm of the vocabulary size, about 4.2 for 65 symbols, because a random model is uniform.
- **Level 3:** How does a reviewer know your causal mask works without reading the code? Expected: a test that changes a later character and asserts the earlier logits are unchanged, and a loss that starts at the random baseline.
- **Level 3:** Why tie the head to the embedding at this size? Expected: it saves parameters and the lesson records a quality improvement; the head weight is the transpose of the embedding.
- **Level 4:** A candidate swaps the character tokenizer for a subword vocabulary of about 50,000. What else must change? Expected: the embedding and head grow from 65 rows to about 50,000, the model needs more capacity to use them, and the windows now cover more text per token.

## Wrong answers

- "Use a bigger model to reach a lower loss within the time budget." A larger model trains slower on a laptop and the lesson's bar is reached at 800K parameters in about 6 minutes.
- "Skip the validation split; the corpus is tiny." The split is the only check against a leak and the reviewer looks for it first.
- "Report the sample quality instead of the loss." Samples are evidence, not a metric; the curves and the held-out loss are what a reviewer compares across candidates.

## Taught in

The [transformer capstone](../../../phases/07-transformers-deep-dive/14-build-a-transformer-capstone/) sets the architecture and the target numbers, and the [block capstone](../../../phases/19-capstone-projects/34-transformer-block/) builds the block it stacks.
