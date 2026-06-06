---
name: skill-conv-shape-calculator
description: Walk a CNN spec layer by layer and report output shape, receptive field, and parameter count for every block
version: 1.0.0
phase: 4
lesson: 2
tags: [computer-vision, cnn, architecture, debugging]
---

# Conv Shape Calculator

A deterministic helper for planning or debugging a CNN. Given an input shape and a list of layer specs, trace shapes, receptive fields, and parameter counts without running the model.

## When to use

- Designing a new CNN and you want to verify every downsample lands on a clean size.
- Reading a paper and translating its architecture table into code.
- A pretrained backbone crashes with a shape mismatch at the classifier head and you need to know which layer changed the spatial size.
- Comparing two backbones on parameter efficiency before training either.

## Inputs

- `input_shape`: `(C, H, W)`.
- `layers`: ordered list of layer dicts. Each supports:
  - `{type: "conv", c_out, k, s, p, groups=1, bias=true}`
  - `{type: "pool", mode: "max"|"avg", k, s, p=0}`
  - `{type: "adaptive_pool", out_h, out_w}`
  - `{type: "flatten"}`
  - `{type: "linear", out_features, bias=true}`

## Steps

1. **Initialise trace** with `(C, H, W)`, receptive field `1`, effective stride `1`, cumulative params `0`.

2. **For each layer**, update in this order:
   - Compute `C_out` (conv/linear), or carry `C_in` through (pool).
   - Compute spatial output using `(H + 2P - K) / S + 1` for conv and pool, `out_h/out_w` for adaptive pool, `(1, 1)` for flatten output shape `(C * H * W, 1, 1)` before the linear, and scalar `1x1` for linear.
   - Update receptive field and effective stride:
     - Conv/pool: `RF_new = RF_old + (K - 1) * effective_stride`, `effective_stride *= S`.
     - Adaptive pool: treat as a pool with effective `S = H_in / out_h` (round down). `RF_new = RF_old + (H_in - 1) * effective_stride_old`; `effective_stride *= S`. Note that adaptive pool's RF equals the full previous spatial extent.
     - Flatten / linear: RF and effective stride are no longer meaningful; freeze them to the values before the flatten and omit from subsequent rows.
   - Compute params:
     - Conv: `C_out * (C_in / groups) * K * K + (C_out if bias else 0)`.
     - Linear: `out_features * in_features + (out_features if bias else 0)`.
     - Pool and flatten: 0.

3. **Detect problems** and flag them:
   - Non-integer output size (misaligned stride/padding).
   - `H_out <= 0` before the end of the stack.
   - Receptive field exceeding input size (possible wasted compute after that point).
   - Sudden 10x jumps in per-layer params that suggest the wrong channel plan.

4. **Report** as a single table:

```
idx  layer                C_in  C_out  K  S  P  H_out  W_out  RF    params     cum_params
1    conv 3x3 s=1 p=1     3     32     3  1  1  224    224    3     896        896
2    conv 3x3 s=2 p=1     32    64     3  2  1  112    112    7     18,496     19,392
3    pool max 2x2         64    64     2  2  0  56     56     11    0          19,392
...
```

5. **Summary line**: final `(C, H, W)`, final receptive field, total params, warnings.

## Rules

- Always return integers for spatial sizes. If the formula produces a non-integer, flag as an error and do not silently floor.
- When `groups > 1`, verify `C_in % groups == 0` and `C_out % groups == 0`; otherwise error.
- For depthwise conv (`groups == C_in`), label it in the `layer` column so the reader sees why params are low.
- If the user provides BatchNorm or activation layers, ignore them for shape purposes but carry params forward (`2 * C` per BatchNorm).
- Never guess defaults for missing fields. Require `k`, `s`, `p` on every conv and pool.
