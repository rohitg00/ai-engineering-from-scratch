# The correction methods for the gap

> Miles has several ways to deal with the gap between the trainer and the engine, and each one fixes a different cause.

[Section 8.1](#s-why-rl-owns-an-engine) names five sources of disagreement: tokens, routing, sampling, numbers, and staleness. Miles has a method for each. Some methods remove a cause, and others only reduce its effect on the gradient.

When you finish this section, you can explain which correction fixes which cause, and which of them we measured.

## Two kinds of method

**A method that removes a cause** makes the two sides compute the same thing. After it, that part of the gap is gone.

**A method that reweights** leaves the gap in place and changes how much each token counts in the loss. It keeps a token that the two sides disagree on from pulling the update too far.

Remove causes first, because every reweighting adds variance to the gradient.

## The methods

| Method | Kind | Cause it targets | How to turn it on |
|---|---|---|---|
| Sampling replay | removes | top-p and top-k sampling | a positive `--rollout-top-k`, with or without `--rollout-top-p` below 1 |
| Routing replay | removes | MoE expert choices | `--use-rollout-routing-replay` |
| Token-in, token-out sessions | removes | text round trips between turns | `--use-session-server` |
| True on-policy mode | removes | all kernel differences | the contract in [section 8.3](#s-why-true-on-policy-is-a-contract) |
| Truncated importance sampling | reweights | any remaining gap | `--use-tis --tis-clip 2.0` |
| A custom importance or rejection function | reweights | any remaining gap | `--custom-tis-function-path`, with a masked version in the Miles examples |
| Engine log probabilities in the ratio | changes the reference | the denominator of the ratio | `--use-rollout-logprobs` |
| Score centering | changes the loss | drift in the score of off-policy samples | `--loss-type score_centering` |
| A sample age limit | drops samples | staleness | `--max-weight-staleness` |

**Truncated importance sampling:** each token gets the ratio of the trainer probability to the engine probability as a weight, and the weight is capped. The cap keeps one token from dominating the update.

**Score centering:** a separate loss that uses the top-k probabilities of the engine's sampler to correct the score of off-policy samples. It turns on an FP32 output layer in the engine, which costs serving compute and memory.

## What we measured

On our GB10 with Qwen3-0.6B, two of these touched our runs:

- Sampling replay lowered the gap by 11.5 percent, from 0.0153 to 0.0135. [Section 4.4](#s-lower-the-logprob-gap) has the run.
- Deterministic inference is not on the list, because it removes no cause of the gap. It made the engine repeat itself, and the gap did not move. [Section 4.5](#s-use-deterministic-inference) has the runs.

We have not run the other methods. Most of them only matter with a MoE model, multi-turn rollouts, low precision, async training, or a Hopper GPU.

## Our view

Read the gap before you pick a method. On a dense model with plain sampling, a flat gap of about 0.015 is the kernel difference of that setup. A reweighting method only hides it. A gap that grows after a change points to a cause you added: a new sampler, a MoE model, FP8 rollout, or older samples. Match the method to that cause.

```takeaways
- Remove a cause before you reweight its effect.
- Match each method to its source: sampler, routing, tokens, kernels, or staleness.
- Measure the gap before and after each method, on the same seed.
```

Sources: Miles importance sampling, routing replay, sampling replay, score centering, and async arguments at main 08752a12; Miles train-infer mismatch example; capture/gpu/summary/miles-gb10-lab.json (runs.e6a-base, runs.e11-topp-topk, runs.e6b-det-triton, runs.e6c-det-flashinfer).
