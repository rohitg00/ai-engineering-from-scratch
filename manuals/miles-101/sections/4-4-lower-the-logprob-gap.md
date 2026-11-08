# Lower the log probability gap with top-p and top-k

> When you sample with top-p or top-k, Miles replays the sampled token set in the trainer, and the gap between the two sides gets smaller.

The engine samples each token from a cut-down set of the vocabulary when you use top-p or top-k. The trainer scores the same token over the full vocabulary. So the two sides give different probabilities for reasons that have nothing to do with the kernels.

When you finish this section, you can turn on sampling replay and check that it lowers the gap.

**Our result:** top-p and top-k replay lowered the median gap from 0.0153 to 0.0135, 11.5 percent, on one seed.

## Why the engine number is higher

Top-p keeps the smallest set of tokens whose probabilities add up to at least the top-p value. The engine then scales the kept probabilities so that they add up to 1 again. Take two sides that compute the same scores before the cut. For a kept token, the engine log probability is then higher than the full-vocabulary score by minus the log of the kept mass. If the kept tokens hold 0.9 of the mass, the difference is about 0.105. Top-k cuts the set in the same way, and the kernel gap comes on top of this.

That difference is not noise. It is different for each token, and it always pushes the ratio between the trainer and the engine the same way. A 2026 issue report for another RL library describes this bias in its importance-sampling ratio. Sampling replay removes it, because the trainer then scores over the same kept set.

We checked the formula on an L4 GPU on 2026-10-23, outside Miles. We used `Qwen/Qwen3-0.6B` in BF16, 16 prompts of 48 tokens, temperature 1, and top-p 0.9. A float32 Transformers pass over the full vocabulary gave the reference. The GPU was shared and had no clock lock, which does not change these values.

```listing
title: returned logprob minus the full-vocabulary reference
source: capture/gpu/out-l4/logprobs-top-p.txt
lang: text
note: Three rows of the summary. The second SGLang row, with the variable set to 1, gave the same value.
---
engine and mode                                  returned minus reference, median   median absolute
vLLM --logprobs-mode raw_logprobs                0.0000                             0.005
vLLM --logprobs-mode processed_logprobs          +0.0527
SGLang return_logprob, ORIGINAL_LOGPROB=0        0.0000                             0.0066
```

- vLLM can return the value after top-p, with `--logprobs-mode processed_logprobs`. That value was higher than the reference by minus the log of the kept mass, with a residual of 8e-9. This is the formula above.
- At top-p 0.9 the median shift was about 0.053, and the kept mass was below 0.99 for most sampled tokens.
- SGLang 0.5.22 returned the value from before top-p. The setting of `SGLANG_RETURN_ORIGINAL_LOGPROB` did not change it at temperature 1. Our Miles image runs a development build of the same version, and we did not repeat the check on it.

So the size of this gap depends on which value the engine returns. Check it on your engine version before you read the gap.

## Turn it on

Add the sampler settings to the run of [section 1.1](#s-run-grpo-on-one-gpu) with `MILES_EXTRA_ARGS`:

```bash
-e MILES_EXTRA_ARGS="--rollout-top-p 0.95 --rollout-top-k 64"
```

Miles turns on sampling replay by itself when `--rollout-top-p` is below 1 or `--rollout-top-k` is above 0. The engine then returns the set of tokens that each step could sample from. The trainer scores each token over that set only.

Set a positive top-k whenever you set a top-p below 1, because Miles requires both for replay. Miles refuses to start when replay is on together with a KL loss or on-policy distillation. It also refuses replay with `--recompute-logprobs-via-prefill`.

## Check the gap

Read `train/train_rollout_logprob_abs_diff` in each step. It is the mean absolute difference between the log probabilities of the trainer and of the engine.

```listing
title: the engine settings of the two runs
source: capture/gpu/out-gb10/engine-settings.txt
lang: text
note: Both runs used the same attention backend and sampler. Only the top-p and top-k flags differ.
---
run                    attention_backend  enable_deterministic_inference  sampling_backend  --rollout-top-p  --rollout-top-k
e6a-base               flashinfer         False                           flashinfer        not set          not set
e11-topp-topk          flashinfer         False                           flashinfer        0.95             64
```

| Run, 12 steps, seed 1 | Median gap | Lowest and highest step | Median reward |
|---|---|---|---|
| No top-p or top-k | 0.0153 | 0.0150 to 0.0159 | 0.66 |
| Top-p 0.95, top-k 64 | 0.0135 | 0.0128 to 0.0141 | 0.68 |

**We measured** a gap 11.5 percent lower with replay. No step of the replay run reached the lowest step of the run without it. The reward stayed in the same range.

This is one seed of 12 steps on Qwen3-0.6B. The step ranges did not overlap, so we report the direction. Run a second seed before you report the size for your own model.

```figure
id: fig-4-4
kind: chart
title: Replaying the sampled tokens lowers the gap
claim: With top-p and top-k replay, the gap was lower at every one of the 12 steps.
caption: The logprob gap per step for two 12-step runs with seed 1.
```

## What replay does not fix

Replay removes the part of the gap that comes from the sampler. The rest most likely comes from the kernels, because the engine and the trainer add the same numbers in a different order. [Section 4.5](#s-use-deterministic-inference) shows that deterministic inference does not remove that part. [Section 8.3](#s-why-true-on-policy-is-a-contract) explains what does.

```takeaways
- Set top-p and top-k together, and Miles replays the sampled set in the trainer.
- Compare train/train_rollout_logprob_abs_diff before and after, over the same steps and seed.
- Expect replay to lower the gap, not to close it.
```

Sources: capture/gpu/summary/miles-gb10-lab.json (runs.e6a-base, runs.e11-topp-topk); capture/gpu/out-gb10/engine-settings.txt; capture/gpu/out-l4/logprobs-top-p.txt; Miles sampling-support replay documentation and arguments at main 08752a12; TRL issue 6789.
