---
id: top-p-crossing-token
title: Nucleus sampling that drops the token which reaches p
card: coding
kind: debug
level: 3
roles: [applied-ai-engineer, inference-engineer, ai-developer-relations-engineer]
rounds: [coding, debugging]
tags: [sampling, top-p, nucleus, generation]
minutes: 10
lessons: [phases/19-capstone-projects/35-gpt-model-assembly]
manuals: []
practice: [top-k-top-p-sampling]
cheatsheet: [bert-gpt-t5]
related: [coding/top-k-then-sample, coding/temperature-knob]
updated: 2026-11-03
---

A nucleus filter is reviewed because a product team says small values of p give an empty distribution on some prompts:

```python
def top_p_filter(logits, p):
    probs = softmax(logits)
    c = np.cumsum(probs)
    out = np.where(c <= p, logits, -np.inf)
    return out
```

Find the two bugs and explain how the filter must interact with the temperature in the full sampler.

## Short answer

The cumulative sum runs in vocabulary order instead of in order of decreasing probability, so the kept set is not the most probable prefix at all. The comparison also drops the token that makes the sum reach p, which for a small p leaves nothing and yields an empty distribution. Sort by probability first, keep the shortest prefix whose sum reaches p including the crossing token, and run the filter on the temperature-scaled logits.

## Full answer

### Bug one: the order

Nucleus sampling keeps the smallest set of most probable tokens whose mass reaches p. That requires sorting by probability, highest first, before the cumulative sum. In vocabulary order the sum crosses p at an arbitrary place and the kept set is a prefix of the vocabulary, not of the ranking.

### Bug two: the crossing token

The token whose addition makes the cumulative sum reach p is part of the nucleus. A strict comparison excludes it. When the top token alone carries more mass than p, nothing passes and the softmax of all negative infinities is NaN. Keep the prefix up to and including the first index where the sum is at least p, and if rounding keeps the sum from ever reaching p, keep every token.

### The fix

```python
def top_p_filter(logits, p):
    probs = softmax(logits)
    order = np.argsort(-probs, kind="stable")
    c = np.cumsum(probs[order])
    cut = np.searchsorted(c, p, side="left")
    keep = order[: min(cut + 1, logits.shape[0])]
    out = np.full_like(logits, -np.inf)
    out[keep] = logits[keep]
    return out
```

The stable sort on the negated probabilities keeps the lower index first on ties.

### Temperature comes first

The full sampler divides by the temperature, applies top-k, applies top-p to that result, and takes the softmax last. If the temperature is applied after the filters, the nucleus is chosen at temperature one and a hot or cold setting changes less than the user asked for. The assembly lesson lists nucleus sampling as the extension of its top-k generation loop, with the check that the kept probabilities sum to at least p.

## Follow-ups

- **Level 3:** Why does the filter return logits with negative infinity rather than probabilities? Expected: so the final softmax renormalizes the kept tokens and gives removed tokens exactly zero, and so top-k and top-p compose.
- **Level 3:** What does p equal to one keep? Expected: every token, unless rounding leaves the sum short, in which case the rule to keep all tokens applies.
- **Level 4:** Top-k and top-p are both set. Which one acts first and why does it matter? Expected: top-k first, then top-p on the survivors; the reverse order can keep a different set because the nucleus mass is computed over different candidates.

## Wrong answers

- "Use a strict comparison so you never exceed p." The definition is the smallest prefix that reaches p; excluding the crossing token breaks it and can leave an empty set.
- "Take the cumulative sum in index order; the vocabulary is already sorted by frequency." Token ids are not sorted by probability for a given context.
- "Apply the temperature after the filter so the nucleus is stable." The nucleus is then chosen at the wrong temperature and the knob loses most of its effect.

## Taught in

The [GPT assembly lesson](../../../phases/19-capstone-projects/35-gpt-model-assembly/) adds nucleus sampling next to top-k in its exercises, and the [sampling practice](../../../practice/top-k-top-p-sampling/) pins the crossing token and the order of operations.
