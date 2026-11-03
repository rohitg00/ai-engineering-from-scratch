---
id: rl-experiment-hygiene
title: An RL speedup that was not an effect
card: scenarios
kind: incident
level: 3
roles: [ai-evaluation-reliability-engineer, inference-engineer]
rounds: [design-review, ml-depth, behavioral]
tags: [rl, experiment-design, seeds, heat-pauses, logprob-gap, miles]
minutes: 25
lessons: []
manuals: [miles-101#s-keep-runs-comparable, miles-101#s-repeat-a-run, miles-101#s-choose-what-to-offload, miles-101#s-use-deterministic-inference, miles-101#s-ref-lab-notes]
practice: []
cheatsheet: []
related: [scenarios/thermal-throttle-voided-ab-test, scenarios/ray-oom-unified-memory]
updated: 2026-11-03
system:
  version: Miles main 08752a12 with its own SGLang 0.5.22 build
  model: Qwen/Qwen3-0.6B
  hardware: one GB10 with 128 GB of unified memory, with a heat guard that pauses the run at 84 C
source:
  - manuals/miles-101/capture/gpu/out-gb10/unpaused-timing.txt
  - manuals/miles-101/sections/2-2-choose-what-to-offload.md
  - manuals/miles-101/sections/5-3-repeat-a-run.md
  - manuals/miles-101/capture/gpu/out-gb10/engine-settings.txt
  - manuals/miles-101/capture/gpu/out-gb10/image-identity.txt
  - manuals/miles-101/capture/gpu/out-l4/logprob-gap-by-dtype.txt
---

## Situation

A teammate posts a result in the team channel: keeping the rollout engine loaded between phases makes the rollout 12 percent faster. The post shows two runs on the GB10, a baseline with a median rollout of 59.1 s and the new setting at 52.0 s, and proposes to make the new setting the default. The same post reports a reward gain of 0.01 from a second change, on one seed, with a loss curve that "looks better".

A reviewer asks for the run manifest. The two runs were four days apart. The memory fraction for the engine was not the same in the second run either. The medians cover different steps, because the heat guard put the container on hold whenever the GPU reached 84 C, 1,005 times that week. A third teammate, who wants the trainer and engine log probabilities to agree more closely, has switched the engine to FP16 and left the trainer in BF16.

## Evidence

- [the rollout time per step of every run, over all steps and over clean steps](evidence/all-steps-against-clean-steps.txt)
- [the same-day pair that changed only the engine offload](evidence/same-day-pair.txt)
- [three seeds of the same 48-step run](evidence/three-seeds.txt)
- [the engine settings of five runs, read from their logs](evidence/what-each-run-changed.txt)
- [the image digest, the commit and the engine version that every run used](evidence/what-we-ran.txt)
- [the log probability gap between the engine and a trainer forward pass, by dtype](evidence/dtype-on-one-side.txt)

## Questions

1. Two runs, two medians, 12 percent. List everything that differed between the runs before you believe the number.
2. The same-day pair shows 60.7 s against 56.7 s over different clean steps. Why is even that not enough, and what comparison is?
3. Three seeds of the baseline ended at 0.758, 0.736 and 0.766. What does a gain of 0.01 on one seed mean, and what would make it reportable?
4. The heat guard paused the container 1,005 times. How does a pause enter a median, and which steps may you time?
5. Predict from the dtype table what FP16 on the engine alone does to the gap.
6. Write the manifest that every run records before it starts, and the rule for reporting a change.

## Walkthrough

Start with the timing table. Every row has two medians, one over all steps and one over the steps whose rollout overlapped no heat pause. For the baseline, `e6a-base`, they are 83.9 s and 59.1 s, from 6 clean steps of 12. For the two runs of the offload pair at a fraction of 0.25 they are 102.0 against 60.7 s and 102.2 against 56.7 s, from 4 and 3 clean steps. The 48-step run from before the heat guard existed, `plain-48`, has 47.5 s in both columns, because no pause could touch it. A 16-answer run has no clean step at all. So a median over all steps is a median over pauses, and the pause count differs between any two runs.

The same-day pair is the honest version of the claim. Only `--no-offload-rollout` differed, the fraction was 0.25 in both runs, and the clean medians were 60.7 s against 56.7 s. Even that is not a fair pair, because the two medians come from different steps. The rollout time follows the answer length, and answers get shorter as the model learns, from about 800 tokens in early steps to about 690 later. On the three steps that were clean in both runs the engine kept loaded saved 69.4 against 68.0 s, 58.5 against 56.7 s and 55.8 against 55.2 s. That is 0.6 to 1.8 s of a rollout of about a minute, 1 to 3 percent, on one seed. The original 12 percent came from a pair that changed the fraction as well and compared different steps.

The three seeds give the noise floor. Seeds 1234, 2 and 3 of the same 48-step recipe reached final rewards of 0.758, 0.736 and 0.766 over the last 8 steps, with answer lengths of 447, 480 and 456 tokens. All three learned, and the final reward still spread by 0.03 with nothing changed. One seed cannot see a gain of 0.01 inside that spread. A change of 0.05 on two seeds is worth a third run.

The engine settings table is what a manifest looks like after the fact. It was read from the server arguments line of each run log, and it shows which runs differ in one column only: the deterministic runs differ from the base in the flag, the sampler and sometimes the backend, and the top-p run differs in the two sampler flags alone. The identity listing is the other half, taken before the runs: the image digest, the commit inside the image and the version of the engine build. Without those three lines, a run from last week cannot be compared with one from today, because the `latest` tag moves.

The dtype table answers the third teammate before the run. With BF16 on both sides the median gap per token was 0.0073. With FP16 on the engine only it was 0.0085, and with FP16 on the trainer only 0.0079. Neither helped. With FP16 on both sides the median fell to 0.00094, about 7.8 times lower. The BF16 engine stayed near 0.0076 even against an FP32 trainer, so the rounding of the engine set that floor. A dtype change pays only when both sides make it.

## Resolution

The 12 percent is withdrawn. The defensible statement is that keeping the engine loaded saved 0.6 to 1.8 s of a rollout of about a minute on the steps that were clean in both runs of a same-day pair, on one seed, which is inside the step-to-step noise of this machine under heat pauses. The default offload stays. The reward gain of 0.01 is not reportable until it appears on two seeds and falls outside the 0.736 to 0.766 spread of the baseline seeds.

Before it starts, every run now records the image digest, the commit, the engine version, the full command, the seeds and the names of its log files. During the run the trainer, the engine and the heat guard each write their own log, and at the end the run writes one exit code line. A change gets one run against a baseline from the same day with one setting different, two seeds, and a comparison on the same step numbers, from clean steps only. The dtype of the engine and the trainer move together or not at all, and deterministic inference is kept for repeating an experiment, because it made the engine repeat its step 0 exactly and left the gap at 0.01518 against 0.01526 while it cost 40 to 45 percent more rollout time.

## Wrong turns

- "Both runs had pauses, so the medians over all steps are fair." The pauses are not equal. The two runs of the pair had 4 and 3 clean steps, and their all-step medians of 102.0 and 102.2 s sit forty seconds above their clean medians.
- "The run from before the heat guard is the clean baseline." Its 47.5 s covers 48 steps, with the late short answers inside. On the same 6 step numbers as the later run it took 60.9 s. Compare step numbers, not whole runs.
- "A gain of 0.01 is small but the curve looks better." Three seeds of the same recipe spread by 0.03 at the end. One seed cannot see 0.01.
- "Switch the engine to FP16 to lower the gap." On one side only the gap was 0.0085 and 0.0079, no better than 0.0073 with BF16 on both. Both sides or neither.
- "Turn on deterministic inference so runs are comparable." It makes the engine repeat itself and costs 40 to 45 percent of the rollout time. The gap stayed between 0.01515 and 0.01526, and the trainer still drifted from step 1.

## Generalize

A measured difference is a claim about everything that differed between two runs, so write down what differed before you write down the number. Hold the machine, the code and the data identity fixed, change one thing, pay for a second seed, and compare like with like down to the step. A result that survives that is small, and it is yours.

## Taught in

The Miles manual gives the manifest in [the comparable runs page](../../../manuals/miles-101/sections/7-2-keep-runs-comparable.md), the seeds and the clean steps in [the repeat page](../../../manuals/miles-101/sections/5-3-repeat-a-run.md), the same-day pair in [the offload page](../../../manuals/miles-101/sections/2-2-choose-what-to-offload.md), the deterministic runs in [the repeatable engine page](../../../manuals/miles-101/sections/4-5-use-deterministic-inference.md) and the clean-step rule in [the lab notes](../../../manuals/miles-101/sections/r-3-lab-notes.md).
