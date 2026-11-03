---
id: sliding-window-dataset
title: Count the windows a token stream gives you
card: tokenization-decoding
kind: code-reading
level: 2
roles: [ai-data-engineer, applied-ai-engineer, inference-engineer]
rounds: [coding, ml-depth]
tags: [dataset, sliding-window, stride, shift-by-one, reproducibility]
minutes: 8
lessons: [phases/19-capstone-projects/31-tokenized-dataset-sliding-window]
manuals: []
practice: []
cheatsheet: [gpt-from-scratch-training]
related: [tokenization-decoding/read-the-decoder-round-trip]
updated: 2026-11-03
---

Read this dataset code from the lesson. `ids` is the whole corpus as one tensor of token ids.

```python
@staticmethod
def count_windows(num_ids, context_length, stride):
    usable = num_ids - (context_length + 1)
    if usable < 0:
        return 0
    return 1 + usable // stride

def __getitem__(self, index):
    start = index * self.stride
    end = start + self.context_length + 1
    window = self.ids[start:end]
    return window[:-1].clone(), window[1:].clone()
```

Why does each window need one more id than the context length, how does the count change when you halve the stride, and what does the loader do to make two runs see the same order?

## Short answer

The target is the input shifted left by one, so an example of T input ids needs T plus 1 ids, and the count is 1 plus the floor of (N minus T minus 1) over the stride, or zero when the stream is too short. Halving the stride from T to T over 2 gives about twice the examples with half of each window shared with its neighbor, and a stride of 1 multiplies the count by about T. The loader seeds a generator with the base seed plus the epoch index, so the shuffle is the same on every restart and each epoch gets a new shuffle.

## Full answer

### The shape contract

A causal language model consumes `(B, T)` input ids and `(B, T)` target ids where the target at position t is the input at t plus 1. One slice of T plus 1 ids gives both tensors from the same memory, which makes the shift mistake impossible: `window[:-1]` and `window[1:]`.

### The count

```text
examples = max(0, 1 + (N - (T + 1)) // S)
```

The last window is dropped when it cannot fill T plus 1 ids. Padding it is valid too, but it complicates the loss mask, so the lesson drops.

### Stride against redundancy

| Stride | Overlap | Examples |
|---|---|---|
| T | none | about N over T |
| T over 2 | half of each window | about twice as many |
| 1 | almost all | about T times as many |

More overlap moves the window boundaries around, so the model sees more distinct predict-next-token tasks per epoch, at the price of more compute per epoch. Most pretraining runs use a stride equal to the context length because the corpus is already larger than one epoch can cover.

### Memory

The dataset stores one copy of the id stream and computes each window's start on the fly, so the memory cost does not grow with the number of examples the stride creates.

### Determinism

```python
generator = torch.Generator()
generator.manual_seed(base_seed + epoch)
```

The same base seed gives the same order in every epoch of every run, and the epoch index gives each epoch a new shuffle. Without this, two runs that differ in one hyperparameter also differ in data order, and the loss curves diverge for reasons unrelated to the change.

## Follow-ups

- **Level 2:** Why not pad the last window instead of dropping it? Expected: padding needs a loss mask so the pad positions do not count; dropping keeps the loss simple.
- **Level 3:** Why seed per epoch and not once per run? Expected: a generator seeded once and advanced across epochs is also reproducible, but epoch k's order then depends on replaying every earlier epoch; seeding with the base seed plus the epoch index builds epoch k's order directly, which a resumed run needs.
- **Level 3:** What does a stride of 1 cost and buy? Expected: about T times the compute per epoch and heavy redundancy, against maximum boundary diversity.
- **Level 4:** You split the id stream into train and validation after windowing. What goes wrong? Expected: overlapping windows straddle the split, so validation text appears in training; split the stream first, then window each part.

## Wrong answers

- "The number of examples is N divided by T." That ignores the extra id per window and the stride; the formula has both.
- "A fixed seed makes every epoch see the same order." The epoch index is added to the seed, so each epoch gets a new shuffle and each run is reproducible.
- "The target is the same window as the input." It is the window shifted left by one; the same ids give both tensors from one slice.

## Taught in

The [sliding-window dataset capstone](../../../phases/19-capstone-projects/31-tokenized-dataset-sliding-window/) gives the count formula, the shift-by-one slice and the seeded loader.
