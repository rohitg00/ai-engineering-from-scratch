---
id: temperature-knob
title: What temperature does to sampling
card: coding
kind: concept
level: 1
roles: [applied-ai-engineer, inference-engineer, ai-developer-relations-engineer]
rounds: [coding, screen]
tags: [sampling, temperature, generation]
minutes: 6
lessons: [phases/19-capstone-projects/35-gpt-model-assembly]
manuals: []
practice: [lab-sampling-temperature]
cheatsheet: [bert-gpt-t5]
related: [coding/top-k-then-sample, coding/top-p-crossing-token]
updated: 2026-11-03
---

Write the one line that applies a sampling temperature to a vector of logits, then tell me what happens to the distribution as the temperature goes toward zero, equals one, and goes above one.

## Short answer

Divide the logits by the temperature before the softmax. Near zero the division stretches the gaps between logits, so the largest one takes almost all the mass and sampling becomes greedy. At one the model's own distribution is used, and above one the gaps shrink, the distribution flattens, and rare tokens are drawn more often.

## Full answer

### The line

```python
probs = softmax(logits / temperature)
```

The order matters in a full sampler: the generation loop reads the final position's logits, divides by the temperature, applies any top-k or top-p filter, takes the softmax, and draws one token.

### Three regimes

| Temperature | Effect on the gaps between logits | Behavior |
|---|---|---|
| Toward zero | Gaps grow without bound | Argmax; the same token every time |
| Equal to one | Unchanged | The model's natural distribution |
| Above one | Gaps shrink | Flatter distribution, more surprise, more errors |

### Why division and not multiplication

Multiplying the logits by the temperature does the opposite of what people expect: a higher value sharpens the distribution. The practice lab has a mutant that makes this mistake, and the sign of the effect is the first thing its tests check.

### Reading the effect

Two measurements show what a temperature did: the probability of the top token, and the entropy of the distribution. As the temperature rises the top probability falls and the entropy rises. A sweep over temperatures on fixed logits makes both curves visible without a model in the loop.

## Follow-ups

- **Level 1:** Why does temperature zero need a special case in code? Expected: division by zero; implement it as argmax rather than dividing.
- **Level 2:** A product wants deterministic output. Is temperature zero enough? Expected: it removes sampling randomness, but ties and numeric differences across batches can still change the argmax.
- **Level 2:** How does temperature interact with a top-p cutoff? Expected: the cutoff must run on the temperature-scaled probabilities, otherwise it cuts the distribution at temperature one and the setting does less than expected.

## Wrong answers

- "Temperature scales the probabilities after the softmax." Scaling probabilities and renormalizing changes nothing; the division happens on the logits.
- "A higher temperature makes the model smarter." It only flattens the distribution, which trades repetition for more mistakes.
- "Temperature one means no sampling." It means sampling from the unchanged distribution; greedy is temperature zero or argmax.

## Taught in

The [GPT assembly lesson](../../../phases/19-capstone-projects/35-gpt-model-assembly/) describes the three temperature regimes in its generation loop, and the [temperature lab](../../../practice/lab-sampling-temperature/) sweeps them on fixed logits.
