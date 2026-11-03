---
id: sinusoidal-table-swap
title: Swap the learned position table for a fixed one
card: coding
kind: take-home
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [coding, take-home]
tags: [positional-encoding, sinusoidal, parameter-count]
minutes: 20
lessons: [phases/19-capstone-projects/35-gpt-model-assembly]
manuals: []
practice: [sinusoidal-positional-encoding]
cheatsheet: [positional-encoding, gpt-from-scratch-training]
related: [coding/top-k-then-sample]
updated: 2026-11-03
---

The reference small GPT configuration uses a learned position embedding of shape 1024 by 768. Replace it with a sinusoidal table computed at construction time, add it to a batch of token embeddings, and tell me by how much the parameter count changes and why the model still forwards.

## Short answer

Build a table with one row per position and one column per feature, where column `2i` holds the sine and column `2i + 1` holds the cosine of the position divided by the base raised to `2i` over the model width. Register it as a buffer, slice the first `T` rows at each forward and add them to the token embeddings without changing the caller's array. The table has the same shape as the learned one, so the forward pass is unchanged, and the count drops by 786,432 parameters because the table is no longer learned.

## Full answer

### The table

```python
def sinusoidal_pe(max_len, d_model, base):
    pos = np.arange(max_len)[:, None]
    end = 2 * (d_model // 2)
    i = np.arange(0, end, 2)
    angle = pos / base ** (i / d_model)
    pe = np.zeros((max_len, d_model))
    pe[:, 0:end:2] = np.sin(angle)
    pe[:, 1:end:2] = np.cos(angle)
    return pe


class SinusoidalPositions(nn.Module):
    def __init__(self, max_len, d_model, base):
        super().__init__()
        table = torch.as_tensor(sinusoidal_pe(max_len, d_model, base)).float()
        self.register_buffer("pe", table)

    def forward(self, x):
        return x + self.pe[: x.shape[1]]
```

The exponent is `2i` over the width, so the frequencies fall from one down to one over the base across the columns. The columns alternate between sine and cosine; putting all sines in the first half and all cosines in the second is a different layout and does not match the reference. Positions start at zero. An odd width has no pair for its last column, so that column stays zero. The table is built once with numpy and stored as a torch buffer, so it moves to the device of the model and the add sees two tensors on the same device.

### Why the forward pass is unchanged

The assembly adds a position vector to each token vector before the first block. Nothing downstream knows whether that vector came from a learned table or a fixed one. The shape contract is the same, so the blocks, the final LayerNorm and the tied head run unchanged.

### The parameter count

The learned table holds 1024 rows of 768 values each. Removing it from the parameter list drops the unique parameter count by 786,432. The parameter counter must count unique tensors, so that the tied language model head is not counted twice, and it must not count buffers.

### Two mistakes to avoid

- Adding the table in place with `+=` changes the caller's embeddings, which the training loop still holds.
- Dividing the exponent by the width of the even part instead of the full width gives an odd width the frequencies of a narrower model.

## Follow-ups

- **Level 2:** Why interleave sine and cosine rather than put them in two halves? Expected: a checkpoint trained with the interleaved layout expects each pair of neighbor columns to form one rotation, and the two layouts are not interchangeable.
- **Level 2:** What does the base control? Expected: the lowest frequency, and so the longest position range before the slowest columns repeat.
- **Level 3:** Which position scheme does the assembly lesson say turns this model into the next model family? Expected: a rotary scheme applied inside attention replaces the additive table and leaves the block and the head unchanged.
- **Level 3:** A fixed table has no parameters; what does the model lose? Expected: the ability to learn position features from data, in exchange for a table that extends to any length at construction.

## Wrong answers

- "Register the table as a parameter so the optimizer can refine it." Then it is a learned table again and the count does not drop.
- "Start positions at one so the first row is not all zeros and ones." The reference starts at zero; row zero is the code of position zero.
- "Use the same exponent for sine and cosine columns but a different base." Both columns of a pair share one angle; only the function differs.

## Taught in

The [GPT assembly lesson](../../../phases/19-capstone-projects/35-gpt-model-assembly/) sets this swap as an exercise and gives the parameter delta, and the [sinusoidal encoding practice](../../../practice/sinusoidal-positional-encoding/) checks the interleaved layout.
