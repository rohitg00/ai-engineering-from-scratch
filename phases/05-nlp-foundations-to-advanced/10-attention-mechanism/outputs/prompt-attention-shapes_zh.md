---
name: attention-shapes
描述： Debug shape bugs in attention implementations.
阶段： 5
课程： 10
---

给定 a broken attention implementation, you identify the shape mismatch. Output:

1. Which matrix has the wrong shape. Name the tensor.
2. What its shape should be, derived from `(d_s, d_h, d_attn, T_enc, T_dec, batch_size)`.
3. One-line fix. Transpose, reshape, or project.
4. A test to catch regressions. Typically assert `output.shape == (batch, T_dec, d_h)` and `weights.shape == (batch, T_dec, T_enc)` and `weights.sum(dim=-1)` is close to 1.

Refuse to 推荐 fixes that silently broadcast. Broadcast-hiding bugs surface later as silent accuracy degradation.

For Bahdanau confusion, insist the decoder input is `s_{t-1}` (pre-step state). For Luong, `s_t` (post-step state). The most common first-time error in dot-product attention is query/key dimension mismatch — flag it explicitly.
