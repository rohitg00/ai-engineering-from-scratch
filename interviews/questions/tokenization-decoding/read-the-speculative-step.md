---
id: read-the-speculative-step
title: Read one speculative step and defend each line
card: tokenization-decoding
kind: code-reading
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [coding, ml-depth]
tags: [speculative-decoding, rejection-sampling, residual-distribution, bonus-token, code-reading]
minutes: 12
lessons: [phases/07-transformers-deep-dive/16-speculative-decoding, phases/10-llms-from-scratch/25-speculative-decoding]
manuals: []
practice: [speculative-decoding-acceptance]
cheatsheet: [speculative-decoding]
related: []
updated: 2026-11-03
---

Read this toy speculative step from the lesson. `q_model` is the verifier and `p_model` is the draft; each returns a probability vector for the next token given a prefix.

```python
def spec_step(prefix, q_model, p_model, N, rng):
    drafts, p_probs = [], []
    ctx = list(prefix)
    for _ in range(N):
        p_dist = p_model(ctx)
        d = sample(p_dist, rng)
        drafts.append(d)
        p_probs.append(p_dist[d])
        ctx.append(d)

    q_dists = [q_model(prefix + drafts[:i]) for i in range(N + 1)]

    for i, d in enumerate(drafts):
        u = rng.random()
        if u < min(1.0, q_dists[i][d] / p_probs[i]):
            prefix = prefix + [d]
        else:
            res = residual_dist(q_dists[i], p_model(prefix))
            prefix = prefix + [sample(res, rng)]
            return prefix
    return prefix + [sample(q_dists[N], rng)]
```

Why does `q_dists` hold N plus 1 entries, what happens when the first draft token fails the test, and why does the residual use `p_model(prefix)` rather than `p_probs[i]`?

## Short answer

The verifier gives a distribution at every drafted position and one more, N plus 1 in total, because when every draft is accepted the extra distribution supplies a bonus token at no extra verifier cost. At the first rejection at position i the code samples from the residual, the positive part of the verifier's distribution minus the draft's, renormalized, appends that token and returns, so every later draft is discarded. The residual needs the draft's whole distribution at that position, a vector, and `p_probs[i]` kept only the scalar probability of the token that was drafted.

## Full answer

### Why the rule is exact

Accepting a drafted token with probability `min(1, q(d) / p(d))` and otherwise sampling from `(q - p)` clamped at zero and renormalized gives samples distributed exactly as q. The theorem holds however poor p is: a bad draft rejects more often, and the output distribution does not move. That is the only reason the method is allowed in production. It is a latency optimization with no quality trade.

### Why N plus 1 verifier distributions

The verifier is queried on the prefix plus the first i drafts for i from zero to N. The first N distributions judge the drafts. The last one is the verifier's own next-token distribution after all N drafts; if everything was accepted it is free, and the step emits N plus 1 tokens from one verifier pass. In the toy the N plus 1 calls stand for a single batched forward pass over the prefix plus the drafts.

### The rejection branch

Return after the first rejection. Positions after it were drafted on a context that is now known to be wrong, so their verifier distributions are not for the sequence that is being generated. The step always produces at least one token, the residual sample, and at most N plus 1.

### The residual needs a vector

`residual_dist(q, p)` subtracts the two distributions element by element, clamps negatives to zero and renormalizes. `p_probs[i]` is one number, the draft's probability of the drafted token, enough for the acceptance test and not for the residual. The call `p_model(prefix)` recomputes the draft's full distribution at the position being corrected; in a real implementation the draft's distributions are kept from the drafting loop instead of being recomputed.

### The greedy case

At temperature zero the rule collapses to a comparison: accept if the drafted token equals the verifier's argmax, otherwise emit the argmax and stop.

### How you would test it

Run the step 10,000 times and compare the histogram of produced tokens with direct samples from q; a chi-square test passes within sampling error. Then perturb p away from q and watch the acceptance rate fall while the histogram stays put.

## Follow-ups

- **Level 3:** `p_probs[i]` is zero and the code divides by it. Can that happen? Expected: no, the token was sampled from p so its probability is positive; the production version still guards the division and accepts when p is zero.
- **Level 3:** When does `residual_dist` divide by zero, and what should it return? Expected: when q is nowhere larger than p, which means the two are equal; return q itself.
- **Level 4:** What does the single batched verifier pass do to the verifier's stored keys and values? Expected: it extends them by N entries, and a rejection at position j must roll the logical length back to the accepted prefix plus the correction.
- **Level 4:** How many tokens does one step emit at minimum and at maximum? Expected: one, the residual sample at an immediate rejection; N plus 1 when every draft is accepted and the bonus token is sampled.

## Wrong answers

- "Accept a draft whenever the verifier gives it a probability above a threshold." A threshold changes the output distribution; the ratio test with the residual is what keeps it exact.
- "On a rejection, resample from the verifier's distribution at that position." That over-weights tokens the draft already favored; the residual removes exactly that mass.
- "Drop the bonus token to be safe." It is a sample from the verifier's own distribution and costs nothing; dropping it wastes a token per step.

## Taught in

The [speculative decoding lesson](../../../phases/07-transformers-deep-dive/16-speculative-decoding/) gives this step and the distribution check, and the [Phase 10 speculative decoding lesson](../../../phases/10-llms-from-scratch/25-speculative-decoding/) states the greedy case and the rejection rule.
