# Repeat a run and compare

> One run cannot tell an effect from noise, so a change needs a second seed before you trust it.

We ran the same GRPO setup three times. The first run used the default seed, which the engine logged as 1234, and the others used seeds 2 and 3. Nothing else changed. The three runs still ended in different places.

When you finish this section, you can tell a real effect from seed noise, and time a run on a hot GPU.

**Our result:** in our 12-step run with seed 1, the median rollout was 83.9 s over all steps. Over its 6 clean steps, it was 59.1 s.

## Know the noise of your setup

Each run trained Qwen3-0.6B on GSM8K for 48 steps, with 32 prompts and 8 answers each. We compare the mean of the first 8 steps with the mean of the last 8:

| Seed | Reward, first 8 steps | Reward, last 8 steps | Length, first 8 | Length, last 8 | Cut share, first 8 | Cut share, last 8 |
|---|---|---|---|---|---|---|
| default (1234) | 0.636 | 0.758 | 724 | 447 | 0.33 | 0.08 |
| 2 | 0.653 | 0.736 | 712 | 480 | 0.30 | 0.12 |
| 3 | 0.614 | 0.766 | 734 | 456 | 0.34 | 0.09 |

**Length:** the mean answer length in tokens. **Cut share:** the share of answers that reached the 1,024-token limit.

All three seeds learned: the reward rose and the answers got shorter. The final reward still spread from 0.736 to 0.766, so a difference under 0.03 in that number is inside the noise of this setup.

The gap between the trainer and the engine stayed between 0.0136 and 0.0164 in every step of the three runs.

## Compare a change against the spread

Before you report that a change helped:

1. Run the change with at least two seeds.
2. Compare it with the spread of your baseline seeds, not with one baseline run.
3. Report the change only when it falls outside that spread.

A change of 0.01 in reward on one seed tells you nothing on this setup. A change of 0.05 on two seeds is worth a third run.

## Time only clean steps

Our GB10 got hot under long runs. The heat guard of [section 1.2](#s-add-a-watchdog-guard-the-gpu-heat) pauses the container at 84 C. It resumes the container after the GPU cools, or after two minutes. A pause adds to the phase time of the step it falls in. We expect a pause to leave the samples and the losses unchanged. We have not tested that yet.

So we report times from steps whose rollout overlapped no pause. Our summary script finds those steps from the pause log and the step timestamps. [The lab notes](#s-ref-lab-notes) give the rule.

Clean steps are not enough on their own. The same setting gave a median rollout of 47.5 s in our first 48-step run. That run came before we added the heat guard, so no pause could touch it. Our 12-step run with seed 1, four days later, gave 59.1 s over its 6 clean steps. On the same 6 step numbers, the 48-step run took 60.9 s.

The rollout time follows the answer length, and the 48-step median includes the late steps with short answers. So compare times on the same step numbers, and repeat them with a second seed.
```figure
id: fig-5-3
kind: chart
title: A heat pause adds time that is not the work
claim: Steps that overlapped a heat pause took about 45 s longer than the clean steps.
caption: Rollout seconds per step for one 12-step run.
```


```takeaways
- Run at least two seeds for every change you want to report.
- Report a change only when it falls outside the spread of your baseline seeds.
- Time only steps without a pause, and compare the same step numbers.
```

Sources: capture/gpu/summary/miles-gb10-lab.json (runs.plain-48, runs.plain-48-s2, runs.plain-48-s3, runs.e6a-base, median_unpaused); capture/gpu/summarize_miles.py; capture/gpu/out-gb10/thermostat.log; capture/gpu/out-gb10/unpaused-timing.txt.
