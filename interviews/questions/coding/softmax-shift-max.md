---
id: softmax-shift-max
title: Why softmax subtracts the row maximum first
card: coding
kind: code-reading
level: 1
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [coding, screen]
tags: [softmax, numerical-stability, numpy]
minutes: 6
lessons: [phases/07-transformers-deep-dive/02-self-attention-from-scratch]
manuals: []
practice: [softmax-cross-entropy]
cheatsheet: [transformers-attention]
related: [coding/loss-shift-flatten, coding/scale-by-sqrt-dk]
updated: 2026-11-03
---

A candidate writes this softmax for a batch of logits and the tests pass on small inputs but return NaN on a real attention row:

```python
def softmax(x):
    e = np.exp(x)
    return e / e.sum(axis=-1, keepdims=True)
```

What is wrong, how do you fix it, and why does the fix not change the result?

## Short answer

A large logit overflows the exponential to infinity, and infinity divided by infinity is NaN. Subtract the maximum of each row before the exponential. The softmax of a row is unchanged when the same constant is subtracted from every entry, because the constant cancels between the numerator and the denominator.

## Full answer

### The failure

Attention scores and language model logits can reach values in the tens or hundreds. The exponential of such a value does not fit in a float, so the row becomes infinite and the division gives NaN. Small test inputs never show it.

### The fix

```python
def softmax(x):
    shifted = x - np.max(x, axis=-1, keepdims=True)
    e = np.exp(shifted)
    return e / e.sum(axis=-1, keepdims=True)
```

After the shift the largest entry of each row is zero, so the largest exponential is one and nothing overflows. Entries far below the maximum underflow to zero, which is the correct limit.

### Why the result is the same

Softmax of a row divides each exponential by the sum of all exponentials in that row. Subtracting a constant multiplies every exponential by the same factor, and that factor cancels in the ratio. The shift must be per row, over the last axis. A single maximum taken across the entire batch changes nothing about correctness but lets one hot row push every other row into underflow.

### Two more details that bite

- Keep the dimension with `keepdims=True` so the subtraction broadcasts along the row and not along the batch.
- Do not subtract in place when the caller still needs the logits.

## Follow-ups

- **Level 1:** Where does this same shift appear inside attention? Expected: in the softmax over the scaled scores, which is why the attention lesson writes the shifted version first.
- **Level 2:** Why is a global maximum over the whole batch a bug? Expected: one row with a very large logit shifts every other row far below zero, so those rows underflow to all zeros and divide by zero.
- **Level 2:** The practice task also asks for the gradient of the mean cross-entropy. What is it? Expected: the softmax minus the one-hot target, divided by the batch size.

## Wrong answers

- "Clip the logits to a safe range." Clipping changes the distribution; the shift does not.
- "Use float64 and the problem goes away." It moves the threshold, and attention scores still overflow in long rows.
- "Subtract the mean instead of the maximum." The mean does not bound the largest entry, so a row can still overflow.

## Taught in

The [self-attention lesson](../../../phases/07-transformers-deep-dive/02-self-attention-from-scratch/) builds the shifted softmax as its first step, and the [softmax and cross-entropy practice](../../../practice/softmax-cross-entropy/) checks it with large logits.
