---
id: lr-peak-sweep
title: Sweep the peak learning rate and mark divergence
card: coding
kind: take-home
level: 3
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [coding, take-home]
tags: [learning-rate, sweep, divergence, schedule]
minutes: 25
lessons: [phases/19-capstone-projects/44-cosine-lr-warmup]
manuals: []
practice: [lab-learning-rate-sweep]
cheatsheet: [optimizers-schedules]
related: [coding/adamw-decoupled-decay]
updated: 2026-11-03
---

Before a long training run you are asked to pick the peak learning rate for a warmup and cosine schedule. Write the sweep that trains a small seeded model at each candidate rate, decides which runs diverged, picks the best stable rate and reports the smallest rate that diverged. State what "diverged" means in code.

## Short answer

Run the same seeded training loop once per candidate rate and record the final loss and the loss history. A run diverged when its final loss is not finite or when the loss grew over the run, not only when it became NaN. The best rate is the lowest final loss among the stable runs, with the smaller rate on a tie, and the smallest diverging rate is reported as the ceiling, because it bounds how high the peak can go.

## Full answer

### Why the peak first

The schedule lesson's advice is to sweep the peak before anything else, because the peak is the most sensitive knob and its optimum scales weakly with model size. A sweep on a small model is a strong prior for the large run. The warmup fraction and the floor matter less and come after.

### The sweep

```python
def is_diverged(losses):
    final = losses[-1]
    return not np.isfinite(final) or final > losses[0]


def run_sweep(rates, train_fn, seed):
    results = {}
    for lr in rates:
        losses = train_fn(lr, seed)
        results[lr] = (losses[-1], is_diverged(losses))
    return results


def best_lr(results):
    stable = [(loss, lr) for lr, (loss, div) in results.items() if not div]
    return min(stable)[1] if stable else None


def smallest_diverging_lr(results):
    div = [lr for lr, (_, d) in results.items() if d]
    return min(div) if div else None
```

Every run uses the same seed so that the only difference between runs is the rate. The results are keyed by rate, and the divergence filter runs before any argmin, because a NaN final loss compares as neither larger nor smaller and would otherwise be selected. When every run diverged, `best_lr` returns `None` and the grid must move lower.

### What diverged means

A loss that ends finite but above where it started is a divergence too. A run can climb for the whole sweep and still return a number. Testing only for non-finite values marks that run stable and the sweep then recommends a rate that will blow up the long run after warmup ends.

### Reading the result

The schedule reaches the peak at the end of warmup and decays toward the floor. A peak just below the smallest diverging rate is aggressive; a peak with a margin below it survives the noisy gradient norms of the first steps. Log the gradient norm next to the rate on the chosen run: a well-tuned warmup shows the norm rising with the rate and settling, and a too-high peak shows a norm that stays high after warmup.

## Follow-ups

- **Level 3:** Two rates give the same final loss. Which one do you pick? Expected: the smaller one; it has more margin to the divergence ceiling.
- **Level 3:** Why does the practice compare the first diverging rate with two over the top curvature of the loss? Expected: for a quadratic loss, gradient descent is stable only below that bound, so the measured ceiling should land near it and a mismatch points at a bug in the sweep.
- **Level 4:** Warmup is set as an absolute count of steps. Why does the sweep on a short run then mislead the long one? Expected: the same count is a much smaller fraction of a long run, so the long run sits at the peak almost at once; set warmup as a fraction of total steps.

## Wrong answers

- "Pick the rate with the lowest loss across all runs." A NaN or a climbing run must be filtered first, otherwise the argmin can return a diverged rate.
- "A run diverged only if the loss is NaN or infinite." A finite loss that grew over the run is a divergence the long run will also show.
- "Sweep the warmup length first since it protects the start." The peak is the most sensitive knob; the warmup fraction is tuned after it.

## Taught in

The [cosine schedule lesson](../../../phases/19-capstone-projects/44-cosine-lr-warmup/) says to sweep the peak first and to record the gradient norm beside the rate, and the [learning rate sweep lab](../../../practice/lab-learning-rate-sweep/) implements the sweep with its divergence rule.
