# Read your first ten steps

> Ten steps are enough to tell a healthy GRPO run from a broken one, if you read five numbers and not only the reward.

The reward goes up and down in the first steps, and it is easy to read too much into one step. Five numbers in the log tell you more. Each one has a healthy range on this setup, and each one breaks in a different way.

When you finish this section, you can pull five numbers out of a run log. You can then compare them with our ranges and decide if the run is healthy.

**Our result:** in the first ten steps of three seeds, the reward per step was 0.53 to 0.74. The log probability gap was 0.0141 to 0.0164.

## Pull the numbers out of the log

Each step writes its numbers on two lines: a `rollout N` line for the samples and a `step N` line for the training update. Go to the folder of the log from [section 1.1](#s-run-grpo-on-one-gpu) with `cd ~/miles-lab/runs`. Then use `grep` to read one number over the steps:

```listing
title: two numbers over the first ten steps
source: capture/gpu/out-gb10/read-steps.txt
lang: text
note: The reward and the log probability gap from our 12-step run. One line is one step.
---
$ grep -o "'rollout/raw_reward': [0-9.]*" plain.log | head -10
'rollout/raw_reward': 0.62890625
'rollout/raw_reward': 0.59375
'rollout/raw_reward': 0.7578125
…
$ grep -o "'train/train_rollout_logprob_abs_diff': [0-9.]*" plain.log | head -10
'train/train_rollout_logprob_abs_diff': 0.015336457639932632
'train/train_rollout_logprob_abs_diff': 0.01610221341252327
'train/train_rollout_logprob_abs_diff': 0.014312651939690113
…
```

Change the metric name in the pattern to read any other number.

## Compare with the healthy ranges

**KL:** the Kullback-Leibler divergence, a distance between two probability distributions. It is 0 when the two distributions are the same.

We ran the same 48-step job with three seeds. These are the values over the first ten steps of all three:

| Metric | Log name | Healthy range in steps 0 to 9 | What it tells you |
|---|---|---|---|
| reward | `rollout/raw_reward` | 0.53 to 0.74, mean 0.62 to 0.65 per seed | the share of correct answers |
| answer length | `rollout/response_lengths` | 626 to 787 tokens | how long the model talks |
| cut share | `rollout/truncated` | 0.19 to 0.43 | the share of answers that hit the 1,024-token limit |
| log probability gap | `train/train_rollout_logprob_abs_diff` | 0.0141 to 0.0164 | how far the trainer and the engine disagree on the same tokens |
| KL between trainer and engine | `train/train_rollout_kl` | 0.00063 to 0.00075 | the same disagreement, as a distance between two probability distributions |

**Log probability gap:** the mean absolute difference between the log probability that the engine gave each sampled token and the one the trainer computes. It is never zero, because the two sides run different kernels.

From one step to the next, the reward moved by up to 0.14 in the first ten steps. Over 48 steps, it moved by up to 0.21. Read the mean over five or more steps, not one step.

## Read the trend over the full run

Over 48 steps, all three seeds moved the same way. The reward rose, the answers got shorter, fewer answers hit the length limit, and the log probability gap stayed flat. [Section 5.3](#s-repeat-a-run) gives the numbers for each seed.

```figure
id: fig-1-3
kind: chart
title: Reward over 48 steps, three seeds
claim: The reward of one step jumps around, and the trend over 48 steps goes up for every seed.
caption: Mean reward per step for three seeds of the same run.
```

```figure
id: fig-1-3b
kind: chart
title: Answers get shorter as the model learns
claim: The mean answer length falls from about 720 to about 460 tokens, so fewer answers hit the 1,024-token cap.
caption: Mean answer length per step for the same three seeds.
```

## Know the signs of a broken run

| What you see | What it means | Where to go |
|---|---|---|
| no step lines after ten minutes | the engine or the trainer did not start | [section 7.1](#s-troubleshoot-by-symptom) |
| `503 Service Unavailable` lines that do not stop for minutes | the rollout engine died. Short bursts of a minute or less can come from a healthy engine | [section 1.2](#s-add-a-watchdog) |
| the log probability gap grows step after step | the trainer and the engine hold different weights | [section 5.2](#s-check-the-first-step) |
| the reward stays flat and many groups score the same | most groups give no learning signal | [section 3.1](#s-train-math-on-gsm8k) |

The last row needs one more number. The rollout side writes a `perf N` line for each step, and it counts groups where every answer got the same reward. In our first step, `rollout/zero_std/count_1` was 7 and `rollout/zero_std/count_0` was 3. So 10 of the 32 groups had every answer right or every answer wrong, and GRPO learns nothing from those groups.

```takeaways
- Read the reward as a mean over five or more steps.
- Check the log probability gap and the KL on every run, next to the reward.
- Count groups with one reward for every answer, because they teach nothing.
- Compare each new run with the ranges from your own seeds.
```

Sources: capture/gpu/out-gb10/read-steps.txt; capture/gpu/out-gb10/plain-first-step.log; capture/gpu/summary/miles-gb10-lab.json (runs.plain-48, runs.plain-48-s2, runs.plain-48-s3); Miles rollout metrics at main 08752a12.
