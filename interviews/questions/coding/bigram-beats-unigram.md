---
id: bigram-beats-unigram
title: Train the smallest language model past its baseline
card: coding
kind: take-home
level: 3
roles: [applied-ai-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [coding, take-home]
tags: [training-loop, baseline, held-out-loss, bigram]
minutes: 30
lessons: [phases/19-capstone-projects/36-training-loop-eval]
manuals: []
practice: [train-char-bigram]
cheatsheet: [gpt-from-scratch-training, text-processing-classic]
related: [coding/loss-shift-flatten, coding/lr-peak-sweep]
updated: 2026-11-03
---

Write a training loop for a table of next-character logits: one row per context character, one column per next character. Train it with gradient descent on a text, under a fixed step budget and a seeded generator, until its held-out NLL is lower than a model that ignores the context. Tell me what the held-out check must look like for the comparison to mean anything.

## Short answer

Build the pairs so that the current character is the context and the following character is the target, compute the log-softmax over each row, and descend the mean of the negative target log-probabilities over the training pairs within the step budget. The held-out check scores a fixed split that training never saw, with the same loss definition for the bigram and the unigram baseline, and the model only passes when its held-out value is lower than the baseline's. Reproducibility comes from drawing the initial table from the generator that the caller passes, not from a global one.

## Full answer

### The model and the loop

```python
def train(text, rng, steps, lr):
    pairs = [(ord(a), ord(b)) for a, b in zip(text, text[1:])]
    W = rng.normal(0, 1, (V, V))
    for _ in range(steps):
        logits = W[[a for a, _ in pairs]]
        logp = log_softmax(logits)
        grad = softmax(logits)
        grad[np.arange(len(pairs)), [b for _, b in pairs]] -= 1
        gW = np.zeros_like(W)
        np.add.at(gW, [a for a, _ in pairs], grad / len(pairs))
        W = W - lr * gW
    return W


def next_log_probs(W, context):
    return log_softmax(W[context])
```

The pair direction is the whole model: context first, target second. Reversing them trains a model that predicts the previous character, and counting each next character as its own context trains nothing about what follows what.

### The gradient sign

The update subtracts the gradient. Adding it climbs the loss, which is visible on the first evaluation, and is the first mutant the practice checks.

### The held-out check

The loop lesson's rule is that evaluation runs on a fixed held-out slice with no gradient, and the number must be comparable across runs. For this task that means three things. The split is fixed before training and never touched by the loop. The unigram baseline, which assigns each character its frequency in the training text regardless of context, is scored on the same held-out characters with the same loss definition. The bigram passes only when its held-out value is strictly lower. A model that wins on the training text and not on the held-out text has memorized the training text.

### The budget

A step budget is part of the contract. A loop that runs more steps than the budget may reach the target but fails the task, and in a real run it is the difference between a planned job and an overrun.

## Follow-ups

- **Level 3:** Why return log-probabilities and not raw logits from the scoring function? Expected: the loss needs a normalized distribution per row; raw logits are not comparable across contexts.
- **Level 3:** The model beats the baseline on training text and loses on held-out text. What happened? Expected: it memorized the training pairs; a held-out split exists to catch exactly that.
- **Level 4:** How does this toy loop map onto the full training loop in the lesson? Expected: the pair construction is the shift-by-one, the row lookup is the forward, the held-out check is the fixed evaluation, and the budget is the step count of the schedule.

## Wrong answers

- "Evaluate on the training text to save time." The comparison then measures memorization and the baseline comparison means nothing.
- "Draw the initial table from the global random state." Two runs with one seed then differ, and the test for reproducibility fails.
- "Train until the loss stops improving." The budget is part of the contract and an open-ended loop hides a slow or stuck run.

## Taught in

The [training loop lesson](../../../phases/19-capstone-projects/36-training-loop-eval/) sets the rules for held-out evaluation and loss alignment, and the [character bigram practice](../../../practice/train-char-bigram/) trains the smallest model under a step budget.
