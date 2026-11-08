# Train math reasoning on GSM8K

> GSM8K with a binary reward is the smallest recipe that shows GRPO learning, and its group size decides how much each step teaches.

When you finish this section, you can train a small model on GSM8K and choose how many answers to sample for each prompt.

**Our result:** in 24 steps, 4, 8, and 16 answers for each prompt gave reward gains inside one range. More answers made each rollout longer.

## Run the recipe

The launcher from [section 1.1](#s-run-grpo-on-one-gpu) is this recipe. These flags shape each step:

```bash
--rollout-batch-size 32 --n-samples-per-prompt 8 --global-batch-size 256 --rm-type math
```

**Group:** the answers that the engine writes for one prompt. GRPO compares each answer with the other answers in its group, so a group where every answer gets the same reward teaches nothing.

Keep `--global-batch-size` equal to the prompts times the answers, here 32 times 8. Then each rollout gives exactly one optimizer step.

## Choose the group size

We changed only `--n-samples-per-prompt` and set `--global-batch-size` to match. For 4 answers, the run of [section 1.1](#s-run-grpo-on-one-gpu) gets this line:

```bash
-e MILES_NUM_ROLLOUT=24 -e MILES_EXTRA_ARGS="--n-samples-per-prompt 4 --global-batch-size 128"
```

 The table compares the first 24 steps of each run. The gain is the mean reward of steps 16 to 23 minus the mean of steps 0 to 7.

| Answers per prompt | Runs | Reward gain | Answer length, first 8 to last 8 steps | Rollout time per step |
|---|---|---|---|---|
| 4 | 1 seed | +0.053 | 735 to 673 tokens | 32.5 s on 14 clean steps |
| 8 | 3 seeds | +0.038 to +0.098 | 712 to 734, then 580 to 637 | 59.1 s on the same 14 steps, 48-step run with the default seed |
| 16 | 1 seed | +0.097 | 728 to 591 tokens | 188.2 s, no clean step |

```figure
id: fig-3-1
kind: chart
title: More answers per prompt, same learning in 24 steps
claim: The reward gain with 4 and with 16 answers per prompt fell inside the range of three seeds with 8.
caption: Reward gain over the first 24 steps for each run. The three green bars are the same recipe with three seeds.
```

**We measured** no clear effect of the group size on the reward in 24 steps. The 16-answer run gained +0.097, and one of the three 8-answer seeds gained +0.098. The seed spread at 8 answers, 0.038 to 0.098, covers all the runs.

The cost is clear. More answers mean more tokens to write in each step. The 4-answer rollout took 32.5 s on its 14 clean steps. Our 48-step run with 8 answers and the default seed ran on another day, before we added the heat guard, so no pause touched it. On the same 14 step numbers it took 59.1 s.

Every step of the 16-answer run overlapped a heat pause, so it has no clean time. Its median of 188.2 s includes the pauses.

The 16-answer run also logged 22,357 `503 Service Unavailable` lines, in bursts of up to 60 s. The client retried each request, and the run went on. With 512 open requests, the router probably found no free engine for a short time. We did not confirm that cause. [Section 1.2](#s-add-a-watchdog) replays these bursts through the watchdog.

Read this result with its limits. The runs with 4 and 16 answers have one seed each. The 16-answer run finished all 24 steps. Then the time limit of our run queue stopped the container while it shut down, as [the lab notes](#s-ref-lab-notes) explain.

## What we did not run

We did not run the rollout batch size sweep with 16 and 64 prompts for each step. We stopped it to keep the lab inside its time limit.

```takeaways
- Start with 32 prompts and 8 answers for each prompt.
- Keep the global batch size equal to the prompts times the answers.
- Change the group size only with a second seed, because one run sits inside the seed spread.
```

Sources: capture/gpu/miles_grpo.py; capture/gpu/out-gb10/503-bursts.txt; capture/gpu/summary/miles-gb10-lab.json (runs.e2-n4, runs.e2-n16, runs.plain-48, runs.plain-48-s2, runs.plain-48-s3, partial).
