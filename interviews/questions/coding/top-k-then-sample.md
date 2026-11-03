---
id: top-k-then-sample
title: Write the sampling step of a generation loop
card: coding
kind: take-home
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-developer-relations-engineer]
rounds: [coding, take-home]
tags: [sampling, top-k, temperature, generation]
minutes: 20
lessons: [phases/19-capstone-projects/35-gpt-model-assembly]
manuals: []
practice: [top-k-top-p-sampling]
cheatsheet: [bert-gpt-t5, gpt-from-scratch-training]
related: [coding/temperature-knob, coding/top-p-crossing-token]
updated: 2026-11-03
---

Given the logits of the last position, a temperature, a value of k and a seeded random generator, write the function that draws the next token. State the order of the operations, how ties are broken, and how the draw uses exactly one random number.

## Short answer

Divide the logits by the temperature, keep the k largest and set the rest to negative infinity, take the softmax, and draw one index from the result. Ties keep the lower index. The draw calls the generator once, takes the cumulative sum of the probabilities in vocabulary order, and returns the first index whose cumulative value exceeds the random number.

## Full answer

### The code

```python
def top_k_filter(logits, k):
    if k >= logits.shape[0]:
        return logits.copy()
    order = np.argsort(-logits, kind="stable")
    keep = order[:k]
    out = np.full_like(logits, -np.inf)
    out[keep] = logits[keep]
    return out


def sample(logits, rng, temperature=1, top_k=None):
    z = logits / temperature
    if top_k is not None:
        z = top_k_filter(z, top_k)
    probs = softmax(z)
    u = rng.random()
    c = np.cumsum(probs)
    hits = np.nonzero(u < c)[0]
    if hits.size:
        return int(hits[0])
    return int(np.nonzero(probs > 0)[0][-1])
```

### The order

Temperature first, then the filter, then the softmax. The filter has to see the scaled logits, because the scale changes which tokens hold the mass when a top-p cutoff is added later. The softmax runs last so that a removed token has probability exactly zero and the kept ones renormalize.

### Ties

Sorting the negated logits with a stable sort keeps the lower index first among equal values. Sorting ascending and reversing the result flips that, so the higher index wins and the output differs from the reference on every tie.

### One random number

A seeded generator gives reproducible samples only if every call consumes the same number of draws. The function reads one uniform number, compares it with the cumulative sum, and returns the first crossing. Rounding can leave the last cumulative value a hair below one, so the fallback returns the last token with positive probability instead of failing.

### Do not change the input

The filter writes into a new array. Writing negative infinity into the caller's logits destroys the values that the next step, or a log, still needs.

## Follow-ups

- **Level 2:** What does top-k one produce? Expected: greedy decoding, the argmax every time.
- **Level 2:** Why must the filter run before the softmax and not after? Expected: zeroing probabilities after the softmax leaves a distribution that does not sum to one unless it is renormalized; masking the logits does that for free.
- **Level 3:** The assembly lesson keeps the context inside a fixed length during generation. How? Expected: when the prompt plus generated tokens exceed the context length, the oldest tokens are dropped so the active window fits.
- **Level 3:** How do you make two runs with one seed produce the same text? Expected: the same generator, one draw per step, the same tie rule and the same temperature; any extra draw shifts every later token.

## Wrong answers

- "Call the generator's choice function with the probabilities." It works, but it consumes draws differently across versions and breaks the one-draw contract that the tests pin.
- "Apply the temperature after the filter." The filter then selects tokens at temperature one and the setting changes less than intended.
- "Sort descending by reversing an ascending sort." Equal logits then keep the higher index, which contradicts the tie rule.

## Taught in

The [GPT assembly lesson](../../../phases/19-capstone-projects/35-gpt-model-assembly/) describes the generation step as temperature, top-k mask, softmax and multinomial draw, and the [sampling practice](../../../practice/top-k-top-p-sampling/) pins the order, the tie rule and the single draw.
