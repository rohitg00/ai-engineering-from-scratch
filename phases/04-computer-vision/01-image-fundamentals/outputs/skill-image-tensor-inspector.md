---
name: skill-image-tensor-inspector
description: Inspect any image-shaped tensor or array and report dtype, layout, range, and whether it looks raw, normalized, or standardized
version: 1.0.0
phase: 4
lesson: 1
tags: [computer-vision, debugging, preprocessing, tensors]
---

# Image Tensor Inspector

A diagnostic skill for any point in a vision pipeline where you are holding an image-shaped array and need to know exactly what state it is in.

## When to use

- A pretrained model returns garbage predictions and you suspect the preprocessing.
- Migrating a pipeline between OpenCV and torchvision and the channel order is unclear.
- Stacking layers from multiple frameworks and the batch axis keeps appearing in the wrong place.
- Debugging a training loop where loss is stuck at `log(num_classes)`.

## Inputs

- `x`: any 2-D, 3-D, or 4-D array-like (NumPy, PyTorch, JAX).
- Optional `expected`: a dict of invariants to check against, e.g. `{"layout": "CHW", "range": "standardized"}`.

## Steps

1. **Resolve backend** — detect whether `x` is NumPy, Torch, or JAX. Convert to NumPy for inspection without altering the original.

2. **Classify rank**:
   - rank 2 -> single-channel image (H, W).
   - rank 3 -> `HWC` if the last axis is 1, 3, or 4 and is strictly smaller than the other two; otherwise `CHW`.
   - rank 4 -> prefer `NCHW` if axis 1 is in {1, 3, 4} **and** either axis 2 or axis 3 is larger than 16; otherwise prefer `NHWC`. Pure axis-1 check misclassifies small-image NHWC batches like `(3, 4, 224, 3)`.
   - Always flag ambiguous cases (e.g. `(1, 3, 3, 3)`) as `ambiguous` rather than guessing; require the caller to provide `expected`.

3. **Classify dtype and range**:
   - `uint8` in [0, 255] -> `raw`.
   - `float*` with min >= 0 and max <= 1.01 -> `normalized`.
   - `float*` with min < 0 and |mean| < 0.5 and 0.5 <= std <= 1.5 -> `standardized`.
   - Anything else -> `unusual`, print the histogram.

4. **Per-channel stats** — report mean and std per channel. Compare against ImageNet mean/std if the array looks standardized and surface a match confidence.

5. **Report** in this exact block:

```
[inspector]
  backend:   numpy | torch | jax
  rank:      2 | 3 | 4
  layout:    HW | HWC | CHW | NHWC | NCHW
  dtype:     <dtype>
  shape:     <shape>
  range:     raw | normalized | standardized | unusual
  min/max:   <min> / <max>
  per-channel mean: [ ... ]
  per-channel std:  [ ... ]
  likely source:    camera | PIL | OpenCV | torchvision | random init
  likely target:    display | training | inference
```

6. **Recommend next action** based on the `likely target`:
   - For `display`: transpose to HWC, clip, convert to uint8.
   - For `training`: standardize with dataset stats, transpose to CHW, add batch axis.
   - For `inference`: match the exact invariants in the model card.

## Rules

- Never mutate the input. Print diagnostics only.
- If `expected` is provided, flag every mismatch with `[expected X got Y]`.
- Call out silent-failure risks when the layout or channel order is ambiguous.
- Recommend one action at a time, not a list of options.
