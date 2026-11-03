---
id: gradient-check-step-size
title: A gradient check that fails for the wrong reason
card: math-classical-ml
kind: debug
level: 3
roles: [applied-ai-engineer, inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [gradient-checking, finite-differences, numerical-stability, autodiff]
minutes: 12
lessons: [phases/01-math-foundations/13-numerical-stability, phases/01-math-foundations/05-chain-rule-and-autodiff]
manuals: []
practice: [mlp-backprop]
cheatsheet: [information-numerics]
related: [math-classical-ml/grad-accumulate-plus-equals, math-classical-ml/variance-of-large-numbers]
updated: 2026-11-03
---

You add a new layer to a from-scratch network and run a gradient check. The relative error between the analytical and the numerical gradient is about 1e-3 for one weight. A teammate says the backward pass has a bug. Before you agree, how do you decide whether the fault is in the backward pass or in the check itself?

## Short answer

A relative error near 1e-3 is in the warning band, so first make the check trustworthy. Use the two-sided difference, set the step to the range from 1e-5 to 1e-7, run the check in float64, and compute the relative error with the max of both magnitudes in the denominator. If the error stays near 1e-3 or grows under those conditions, the backward pass is wrong; if it drops below 1e-5, the check was at fault.

## Full answer

### What the check computes

The numerical gradient for one weight is the centered difference: the loss at the weight plus h, minus the loss at the weight minus h, divided by 2h. Its truncation error shrinks with h squared, while the one-sided difference only shrinks with h. The relative error compares it with the analytical value:

```text
rel_error = |analytical - numerical| / max(|analytical|, |numerical|, 1e-8)
```

The lesson's thresholds: below 1e-7 is a clean match, below 1e-5 is acceptable, above 1e-3 points at a bug, and above 1 means the gradient is wrong.

### Ways the check lies

1. **Step too large.** The difference measures the slope of a chord, not the tangent. Shrink h.
2. **Step too small.** The two losses are nearly equal, and their subtraction suffers catastrophic cancellation: the true difference is below the rounding noise, and the noise becomes the leading digits. In float32 this happens early, so run the check in float64 and keep h between 1e-5 and 1e-7.
3. **A kink at the test point.** A ReLU or a max has no derivative at zero, and a step that crosses the kink measures two different slopes. Check at points away from the kink, or on inputs where the active side is known.
4. **Stochastic parts.** Dropout or a random data order between the two loss evaluations changes the loss for a reason other than h. Fix the seed and run in evaluation mode.
5. **A wrong denominator.** Dividing by the analytical value alone blows up when it is near zero. Use the max of both magnitudes with a floor.

### Then look at the backward pass

With a trustworthy check, a stable 1e-3 is a bug. Check one parameter group at a time to find the layer, and compare the local derivative of each operation with its formula. The autodiff lesson's engine compares each new operation against a finite difference as part of adding it, which is the habit that prevents this situation.

## Follow-ups

- **Level 3:** Why prefer the two-sided formula over the one-sided one? Expected: its error falls with h squared instead of h, so a moderate h gives a close estimate without cancellation.
- **Level 3:** Why not run the check on every step of production training? Expected: it needs two forward passes for each parameter, so it is far too slow; it belongs in unit tests and in debugging.
- **Level 4:** The error is tiny for most weights and large for a few in one layer. What does that pattern say? Expected: the layer's backward pass is right in general and wrong on one path, such as a shared input whose contributions were overwritten rather than added, or a kink at those weights.
- **Level 4:** How do you check a layer that contains a random mask? Expected: fix the seed so both loss evaluations use the same mask, or run the check in evaluation mode where the mask is off.

## Wrong answers

- "Make h as small as possible for the most accurate derivative." Below the rounding scale the subtraction cancels and the result is noise. There is a floor on h, around 1e-7 in float64.
- "A relative error of 1e-3 is close enough, ship it." The lesson puts 1e-3 at the bug boundary. A stable error there means a wrong gradient that will slow or break training.
- "Use the absolute difference instead of a relative one." A large gradient and a tiny one need different tolerances. The relative error with a floored denominator handles both.

## Taught in

The [numerical stability lesson](../../../phases/01-math-foundations/13-numerical-stability/) gives the centered difference, the relative error and its thresholds, and the [chain rule and autodiff lesson](../../../phases/01-math-foundations/05-chain-rule-and-autodiff/) builds the check into the engine.
