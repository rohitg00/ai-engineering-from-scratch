---
name: skill-frame-sampler-auditor
description: Audit a video pipeline's frame sampler for off-by-one, short-clip handling, and crop consistency
version: 1.0.0
phase: 4
lesson: 12
tags: [computer-vision, video, sampling, debugging]
---

# Frame Sampler Auditor

Frame sampling is where video pipelines break. Bugs here propagate into every downstream metric.

## When to use

- Writing a new video data loader.
- Reproducing numbers from a paper and training accuracy is lower than reported.
- Debugging a video model whose eval accuracy is unstable across runs.

## Inputs

- `sampler_code`: Python function that takes (num_frames_total, T) and returns T indices.
- `T`: target clip length.
- Optional test cases: `num_frames_total` values to exercise (e.g. `[3, T-1, T, T+1, 30, 300, 3000]`).

## Checks

### 1. Short clip handling
Feed `num_frames_total < T`. Every returned index must be in `[0, num_frames_total - 1]`. The standard padding policy is to repeat the last frame for the remaining positions.

### 2. Boundary indices
Feed `num_frames_total == T`. Returned indices should be `[0, 1, ..., T-1]` exactly.

### 3. Uniform distribution
Feed `num_frames_total == 10 * T`. Returned indices should be monotonically increasing and roughly evenly spaced.

### 4. Dense window bounds
For dense sampling, feed `num_frames_total == 3 * T`. Returned indices should form a contiguous window, never crossing the end of the clip.

### 5. Determinism
Call the sampler twice with the same inputs and (for deterministic samplers) the same RNG. Indices should match.

### 6. Crop consistency
If the pipeline also returns a spatial crop per frame, run the sampler twice for the same clip with the same seed and confirm every frame uses the same crop box (same `(x, y, w, h)`). Different crops per frame inside one clip destroys temporal coherence and is a classic silent bug. Acceptable variation: augmentation applied *per clip*, consistent within a clip.

## Report

```
[sampler audit]
  name: <function name>
  T:    <int>

[short-clip handling]
  passed | failed (<details>)

[boundary]
  passed | failed

[uniform spacing]
  passed | failed (<stddev of gaps>)

[dense window]
  passed | failed (<details>)

[determinism]
  passed | failed

[crop consistency]
  passed | failed (<per-frame crop varies: yes/no>)

[verdict]
  ok | fix required
```

## Rules

- Never mark a sampler "ok" if short-clip handling returns out-of-range indices.
- Dense samplers should never return a window that crosses `num_frames_total - 1`.
- If the sampler is stochastic (dense), test determinism only with an explicit seeded RNG.
- Suggest, but do not silently fix, the canonical policies: pad with last frame, clamp window to end, round half-open intervals.
