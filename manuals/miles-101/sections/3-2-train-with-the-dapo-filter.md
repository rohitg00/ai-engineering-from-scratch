# Train with the DAPO filter

> The DAPO filter drops groups where every answer scored the same, so each step trains only on groups that teach something.

In a plain GRPO step, about half of our groups had every answer right or every answer wrong. Those groups give no learning signal. The filter drops them and asks the engine for more prompts until the step has enough groups that do.

When you finish this section, you can turn on the zero-variance filter and check how many groups it drops. You can also measure what the extra prompts cost.

**Our result:** the filter dropped 16 to 48 groups in each step, and most of them had every answer right. The rollout took 1.5 to 2.8 times as long. In 12 steps on one seed, the reward counted before the filter read higher than the run without it. We read that as a bias of the metric, not as learning.

## Turn it on

Add two flags to the run of [section 1.1](#s-run-grpo-on-one-gpu) with `MILES_EXTRA_ARGS`:

```bash
-e MILES_EXTRA_ARGS="--dynamic-sampling-filter-path miles.rollout.filter_hub.common_filters.apply_reward_nonzero_std_filter --over-sampling-batch-size 48"
```

Our lab runs used an older path for the same filter, which Miles marks as deprecated. At the version we ran, the older path calls the filter shown here, so the results are the same.

**Over-sampling batch:** the number of prompts that the rollout sends to the engine at a time. It must be at least `--rollout-batch-size`.

The rollout sends 48 prompts. As each group finishes, the filter keeps it or drops it. When the kept and the waiting groups cannot reach 32, the rollout sends 48 more prompts. When 32 groups are kept, it stops the rest of the requests. The answers of the stopped requests are not used.

## Count the dropped groups

The rollout writes three numbers for the filter in its `perf N` line:

| Log name | What it counts |
|---|---|
| `rollout/dynamic_filter/drop_zero_std_0` | dropped groups where every answer was wrong |
| `rollout/dynamic_filter/drop_zero_std_1` | dropped groups where every answer was right |
| `rollout/raw_reward_unfiltered` | the mean reward of every finished answer, before the filter |

Without the filter, the same groups stay in the batch. Read `rollout/zero_std/count_0` and `rollout/zero_std/count_1` to see how many there are.

**We measured** these counts over 12 steps with seed 1, with and without the filter:

| Run | Groups with one reward for every answer | Of those, every answer right |
|---|---|---|
| no filter, trained on | 191 of 384 | 142 |
| DAPO filter, dropped | 399, next to 384 kept | 306 |

Without the filter, half of the groups that the trainer used taught nothing. With the filter, the step dropped 16 to 48 groups, with a median of 36. Most dropped groups were easy prompts that the model already answered right every time.

## Measure the over-sampling cost

Every rollout of the filter run overlapped a heat-guard pause, so this run has no clean step. To compare the rollout times, we took the pause time out of each rollout. The run without the filter is our 12-step run with seed 1. With the pause time taken out, it gave a median of 58.0 s, close to the 59.1 s of its 6 clean steps.

```figure
id: fig-3-2
kind: chart
title: The filter costs one or two extra batches of prompts
claim: A step that dropped 16 groups or fewer needed one batch of 48 prompts, and a step that dropped more needed two.
caption: Rollout seconds per step with the pause time taken out, 12 steps with seed 1.
```

Three steps dropped 16 groups or fewer, so one batch of 48 prompts was enough. Their rollouts took a median of 88.7 s, 1.5 times the 58.0 s without the filter. The other nine steps needed a second batch and took a median of 164.4 s, 2.8 times as long.

One batch of 48 prompts is 1.5 times the work of 32 prompts, which matches the first ratio. A second batch adds more, and the step must wait for the slowest groups that it keeps. The sum of the 12 step times was 113 minutes with the filter and 60 minutes without it, with the heat pauses in both.

## Compare the reward

The filter changes what `rollout/raw_reward` means, because the dropped groups are not in it. To compare the two runs, read `rollout/raw_reward_unfiltered` for the filter run.

```figure
id: fig-3-2b
kind: chart
title: The reward before the filter read higher
claim: Over 12 steps on one seed, the reward counted before the filter was higher in 8 of the 12 steps.
caption: Mean reward per step over every finished answer, 12 steps with seed 1.
```

The mean over 12 steps was 0.686 with the filter and 0.657 without it. Our five baseline runs gave 12-step means of 0.638 to 0.660, so 0.686 is above all of them. The mean of the first four steps was also higher, 0.672 against 0.625, before the filter could have changed the model much.

We think the reason is in what the number counts. The reward before the filter counts only the groups that finished before the rollout stopped. The stopped requests are the slowest, with the longest answers. An answer cut at the length limit usually scores 0, as [section 4.2](#s-handle-long-responses) shows. So this number can lean high, and we read the higher mean as that bias, not as a learning effect.

This is one seed of 12 steps. The filter run finished all 12 steps. Then the time limit of our run queue stopped the container while it shut down. To see a reward effect, run more steps and a second seed, and compare against the spread of your baseline seeds.

## Decide

Use the filter when many groups score the same for every answer, and when you can pay for a longer rollout. Set the over-sampling batch from your drop rate. With half of the groups dropped, a batch of 48 prompts for 32 kept groups was too small for most of our steps.

```takeaways
- Turn on the filter when many groups score the same for every answer.
- Count the dropped groups in every step, and split them into all right and all wrong.
- Expect each extra batch of prompts to add to the rollout time.
- Compare the reward before the filter, and run a second seed before you report a gain.
```

Sources: Miles filter hub, common_filters and dynamic_sampling_filters, at main 08752a12; capture/gpu/summary/miles-gb10-lab.json (runs.e2b-dapo-filter, runs.e6a-base, runs.plain, runs.plain-48, runs.plain-48-s2, runs.plain-48-s3); capture/gpu/summarize_miles.py; Miles rollout loop and filter metrics at main 08752a12.
