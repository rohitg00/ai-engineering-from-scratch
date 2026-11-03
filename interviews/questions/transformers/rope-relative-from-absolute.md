---
id: rope-relative-from-absolute
title: Absolute angles, relative distances
card: transformers
kind: concept
level: 2
roles: [inference-engineer, applied-ai-engineer]
rounds: [ml-depth, coding]
tags: [rope, positional-encoding, relative-position, rotation]
minutes: 8
lessons: [phases/07-transformers-deep-dive/04-positional-encoding]
manuals: []
practice: [rope]
cheatsheet: [positional-encoding]
related: [transformers/permutation-blind-attention]
updated: 2026-11-03
---

The rotary scheme rotates every query and every key by an angle that is proportional to the token's absolute position. Yet everyone says it encodes relative position. Resolve the apparent contradiction, and tell me the one unit test you would write to prove the property.

## Short answer

The rotation acts on pairs of coordinates with the angle `pos * theta_i`. When a query from position m meets a key from position n, the dot product on each pair picks up `cos((m - n) * theta_i)`, so only the gap survives and the two absolute positions cancel. The test: rotate two random vectors at positions (a, b) and again at (a + k, b + k), then assert that the two dot products agree within floating-point error.

## Full answer

### The rotation

For each pair of dimensions (2i, 2i + 1) in a head of width `d_head`:

```python
def apply_rope(x, pos, base=10000):
    d = len(x)
    out = list(x)
    for i in range(d // 2):
        theta = pos / (base ** (2 * i / d))
        c, s = math.cos(theta), math.sin(theta)
        a, b = x[2 * i], x[2 * i + 1]
        out[2 * i]     = a * c - b * s
        out[2 * i + 1] = a * s + b * c
    return out
```

Each pair is a point in a plane, and the rotation turns it by `pos * theta_i`. Low values of i turn fast and high values turn slowly, because `theta_i = base ** (-2i / d_head)`.

### Why the dot product only sees the gap

A rotation by angle alpha followed by the dot product with a vector rotated by angle beta equals the dot product of the originals rotated by `alpha - beta`. Apply the same function to Q at position m and to K at position n, and every pair contributes a factor that depends on `(m - n) * theta_i`. The score depends on the distance even though the rotation was keyed off the absolute position. Attention gets relative position for free, with no table and no parameters.

### Where it applies

The rotation applies to Q and K after their projection and before the score matmul. It never touches V, because the values carry content that should not be rotated by position, and it never touches the input embedding.

### Why it won

It slots into attention without a change to the architecture. Its `base` is a clean knob: scale it and the model reaches longer contexts, which is how one model family reached a 128K context from 8K with scaling schemes such as NTK-aware interpolation and YaRN.

### The unit test

```text
a, b = random vectors of width d_head
s1 = dot(apply_rope(a, pos_a), apply_rope(b, pos_b))
s2 = dot(apply_rope(a, pos_a + k), apply_rope(b, pos_b + k))
assert abs(s1 - s2) < tolerance
```

The property is the whole point of the method. If the test fails, the rotation was applied to only one side, or the two sides use different pairs or angles. A pass does not prove the pairing or the angles match the reference: a consistent wrong pairing passes too, so also compare one rotated vector with a value computed by hand.

## Follow-ups

- **Level 2:** Why rotate Q and K but not V? Expected: position should shape the match between tokens, not the content that is returned once a token is picked.
- **Level 3:** What happens at a position the model never saw in training? Expected: the fast-turning pairs reach angles the model never learned to read; scaling the base or interpolating positions brings them back into the trained range.
- **Level 3:** How does linear-bias attention get relative position without any rotation? Expected: it adds a penalty proportional to `|i - j|` to the scores, one slope per head.
- **Level 4:** Why does increasing the base help a longer context? Expected: a larger base lowers every frequency except the first pair, which always turns at one radian per position, so the high-frequency pairs are not squeezed into unseen angles when the context grows; the NTK-aware rule rescales the base by the extension factor raised to `d / (d - 2)`.

## Wrong answers

- "RoPE adds a position vector to the embedding." It rotates the queries and the keys inside attention; the embedding is untouched.
- "RoPE needs a table of size maximum length times width." The angles come from a formula; there is no table and no parameter.
- "Rotate the keys only and save half the work." Then the score depends on the absolute position of the key, and the relative property is gone.

## Taught in

The [positional encoding lesson](../../../phases/07-transformers-deep-dive/04-positional-encoding/) derives the rotation and gives the relative-distance check as a build step.
