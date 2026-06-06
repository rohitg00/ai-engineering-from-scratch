# Attention Mechanism — The Breakthrough

> The decoder stops squinting at a compressed summary and starts looking at the whole source. Everything after this is attention plus engineering.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 09 (Sequence-to-Sequence Models)
**Time:** ~45 minutes

## The Problem

Lesson 09 ended on a measured failure. A GRU encoder-decoder trained on a toy copy task goes from 89% accuracy at length 5 to near-chance at length 80. The reason is structural, not a training bug: every bit of information the encoder gleaned has to fit in one fixed-size hidden state, and the decoder never sees anything else.

Bahdanau, Cho, and Bengio published a three-line fix in 2014. Instead of giving the decoder only the final encoder state, keep every encoder state. At each decoder step, compute a weighted average of encoder states where the weights say "how much does the decoder need to look at encoder position `i` right now?" That weighted average is the context, and it changes every decoder step.

That is the whole idea. Transformers extended it. Self-attention applied it to a single sequence. Multi-head attention ran it in parallel. But the 2014 version already broke the bottleneck, and once you have it, the pivot to transformers is engineering, not conceptual.

## The Concept

![Bahdanau attention: decoder queries all encoder states](../assets/attention.svg)

At each decoder step `t`:

1. Use the previous decoder hidden state `s_{t-1}` as a **query**.
2. Score it against every encoder hidden state `h_1, ..., h_T`. One scalar per encoder position.
3. Softmax the scores to get attention weights `α_{t,1}, ..., α_{t,T}` that sum to 1.
4. Context vector `c_t = Σ α_{t,i} * h_i`. Weighted average of encoder states.
5. Decoder takes `c_t` plus the previous output token, produces the next token.

The weighted average is the point. When the decoder needs to translate "Je" to "I", it weights the encoder state over "Je" high and the others low. When it needs "not", it weights "pas" high. The context vector reshapes each step.

## Shapes (the thing that bites everyone)

This is where every attention implementation goes wrong the first time. Read slowly.

| Thing | Shape | Notes |
|-------|-------|-------|
| Encoder hidden states `H` | `(T_enc, d_h)` | If BiLSTM, `d_h = 2 * d_hidden` |
| Decoder hidden state `s_{t-1}` | `(d_s,)` | One vector |
| Attention score `e_{t,i}` | scalar | One per encoder position |
| Attention weight `α_{t,i}` | scalar | After softmax over all `i` |
| Context vector `c_t` | `(d_h,)` | Same shape as an encoder state |

**Bahdanau (additive) score.** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`.

- `s_{t-1}` has shape `(d_s,)`, `h_i` has shape `(d_h,)`.
- `W_a` has shape `(d_attn, d_s)`. `U_a` has shape `(d_attn, d_h)`.
- Their sum inside the tanh has shape `(d_attn,)`.
- `v_α` has shape `(d_attn,)`. The inner product with `v_α` collapses to a scalar. **This is what `v_α` does.** It is not magic. It is the projection that turns an attention-dim vector into a scalar score.

**Luong (multiplicative) score.** Three variants:

- `dot`: `e_{t,i} = s_t^T * h_i`. Requires `d_s == d_h`. Hard constraint. Skip if your encoder is bidirectional.
- `general`: `e_{t,i} = s_t^T * W * h_i` with `W` shape `(d_s, d_h)`. Removes the equal-dim constraint.
- `concat`: essentially the Bahdanau form. Rarely used since the first two are cheaper.

**One Bahdanau / Luong gotcha worth naming.** Bahdanau uses `s_{t-1}` (the decoder state *before* generating the current word). Luong uses `s_t` (the state *after*). Mixing them up produces subtly wrong gradients that are extremely hard to debug. Pick one paper and stick to its convention.

## Build It

### Step 1: additive (Bahdanau) attention

```python
import numpy as np


def additive_attention(decoder_state, encoder_states, W_a, U_a, v_a):
    projected_dec = W_a @ decoder_state
    projected_enc = encoder_states @ U_a.T
    combined = np.tanh(projected_enc + projected_dec)
    scores = combined @ v_a
    weights = softmax(scores)
    context = weights @ encoder_states
    return context, weights


def softmax(x):
    x = x - np.max(x)
    e = np.exp(x)
    return e / e.sum()
```

Check your shapes against the table above. `encoder_states` has shape `(T_enc, d_h)`. `projected_enc` has shape `(T_enc, d_attn)`. `projected_dec` has shape `(d_attn,)` and broadcasts. `combined` has shape `(T_enc, d_attn)`. `scores` has shape `(T_enc,)`. `weights` has shape `(T_enc,)`. `context` has shape `(d_h,)`. Ship it.

### Step 2: Luong dot and general

```python
def dot_attention(decoder_state, encoder_states):
    scores = encoder_states @ decoder_state
    weights = softmax(scores)
    return weights @ encoder_states, weights


def general_attention(decoder_state, encoder_states, W):
    projected = W.T @ decoder_state
    scores = encoder_states @ projected
    weights = softmax(scores)
    return weights @ encoder_states, weights
```

Three lines each. This is why Luong's paper landed. Same accuracy on most tasks, a lot less code.

### Step 3: a worked numerical example

Given three encoder states (roughly "cat", "sat", "mat") and a decoder state that aligns most with the first, the attention distribution concentrates on position 0. If the decoder state shifts to align with the last, attention moves to position 2. The context vector tracks.

```python
H = np.array([
    [1.0, 0.0, 0.2],
    [0.5, 0.5, 0.1],
    [0.1, 0.9, 0.3],
])

s_close_to_cat = np.array([0.9, 0.1, 0.2])
ctx, w = dot_attention(s_close_to_cat, H)
print("weights:", w.round(3))
```

```
weights: [0.464 0.305 0.231]
```

First row wins. Then move the decoder state closer to the third encoder state and watch the weights shift. That is it. Attention is explicit alignment.

### Step 4: why this is the bridge to transformers

Translate the language above into Q/K/V:

- **Query** = decoder state `s_{t-1}`
- **Key** = encoder states (what we score against)
- **Value** = encoder states (what we weight and sum)

In classical attention, keys and values are the same thing. Self-attention separates them: you can query a sequence against itself, with different learned projections for K and V. Multi-head attention runs it in parallel with different learned projections. Transformers stack the whole stage many times and drop RNNs.

The math is the same. The shapes are the same. The pedagogical jump from Bahdanau attention to scaled dot-product attention is mostly notation.

## Use It

PyTorch and TensorFlow ship attention directly.

```python
import torch
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=128, num_heads=8, batch_first=True)
query = torch.randn(2, 5, 128)
key = torch.randn(2, 10, 128)
value = torch.randn(2, 10, 128)

output, weights = mha(query, key, value)
print(output.shape, weights.shape)
```

```
torch.Size([2, 5, 128]) torch.Size([2, 5, 10])
```

That is a transformer attention layer. Query batch of 5 positions, key/value batch of 10 positions, 128-dim each, 8 heads. `output` is the new context-augmented queries. `weights` is the 5x10 alignment matrix you can visualize.

### When classical attention still matters

- Pedagogy. The single-head, single-layer, RNN-based version makes every concept visible.
- On-device sequence tasks where transformers do not fit.
- Any paper from 2014-2017. You will misread it without knowing Bahdanau's convention.
- Fine-grained alignment analysis in MT. Raw attention weights are an interpretability tool even on transformer models, and reading them requires knowing what they are.

### The attention-weight-as-explanation trap

Attention weights look interpretable. They are weights that sum to one across positions; you can plot them; high means "looked at this." Reviewers love them.

They are not as interpretable as they look. Jain and Wallace (2019) showed that attention distributions can be permuted and replaced by arbitrary alternatives without changing model predictions for some tasks. Never report attention weights as evidence of reasoning without an ablation or counterfactual check.

## Ship It

Save as `outputs/prompt-attention-shapes.md`:

```markdown
---
name: attention-shapes
description: Debug shape bugs in attention implementations.
phase: 5
lesson: 10
---

Given a broken attention implementation, you identify the shape mismatch. Output:

1. Which matrix has the wrong shape. Name the tensor.
2. What its shape should be, derived from (d_s, d_h, d_attn, T_enc, T_dec, batch_size).
3. One-line fix. Transpose, reshape, or project.
4. A test to catch regressions. Typically: assert `output.shape == (batch, T_dec, d_h)` and `weights.shape == (batch, T_dec, T_enc)` and `weights.sum(dim=-1) close to 1`.

Refuse to recommend fixes that silently broadcast. Broadcast-hiding bugs surface later as silent accuracy degradation, the worst kind of attention bug.

For Bahdanau confusion, insist the decoder input is `s_{t-1}` (pre-step state). For Luong, `s_t` (post-step state). For dot-product, flag dimension mismatch between query and key as the most common first-time error.
```

## Exercises

1. **Easy.** Implement `softmax` masking so padding tokens in the encoder get attention weight zero. Test on a batch with variable-length sequences.
2. **Medium.** Add multi-head attention to the Luong `general` form. Split `d_h` into `n_heads` groups, run attention per head, concatenate. Verify the single-head case matches your earlier implementation.
3. **Hard.** Train a GRU encoder-decoder with Bahdanau attention on the toy copy task from lesson 09. Plot accuracy vs sequence length. Compare against the no-attention baseline. You should see the gap widen as length grows, confirming attention lifts the bottleneck.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Attention | Looking at things | Weighted average of a value sequence, weights computed from a query-key similarity. |
| Query, Key, Value | QKV | Three projections: Q asks, K is what to match, V is what to return. |
| Additive attention | Bahdanau | Feed-forward score: `v^T tanh(W q + U k)`. |
| Multiplicative attention | Luong dot / general | Score is `q^T k` or `q^T W k`. Cheaper, same accuracy on most tasks. |
| Alignment matrix | The pretty picture | Attention weights as a `(T_dec, T_enc)` grid. Read it to see what the model attended to. |

## Further Reading

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) — the paper.
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) — the three score variants and their comparison.
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) — the interpretability caveat.
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html) — runnable walkthrough with PyTorch.
