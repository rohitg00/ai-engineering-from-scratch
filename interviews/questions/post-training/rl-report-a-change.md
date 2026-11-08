---
id: rl-report-a-change
title: Review a claimed RL speedup before it becomes a default
card: post-training
kind: design
level: 3
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [design-review, ml-depth]
tags: [experiment-hygiene, seeds, benchmarking, thermal, miles]
minutes: 12
lessons: []
manuals: [miles-101#s-repeat-a-run, miles-101#s-keep-runs-comparable, miles-101#s-ref-lab-notes, miles-101#s-choose-what-to-offload]
practice: []
cheatsheet: [miles-rl]
related: [scenarios/prefix-cache-inflated-benchmark]
updated: 2026-11-03
---

An engineer shows you two RL training runs. The new one, with a changed offload setting, finished its rollouts twelve percent faster and ended with a reward a few hundredths higher than the old one. They want to ship the change as the new default. Design the review: what do you ask for before you trust either number?

## Short answer

Ask for the spread of the baseline before you read the change. In the manual's three baseline seeds the final reward ranged from 0.736 to 0.766, so a gain of a few hundredths on one seed is inside the noise. Then ask what else differed: the manual's first offload pair also changed the engine memory fraction and compared different step numbers, and its twelve percent shrank to one to three percent in a same-day pair that changed one setting. Require two seeds, one change per run, the same step numbers, and times from steps that no thermal pause touched.

## Full answer

### Know the noise first

Three runs of one recipe, with nothing changed but the seed:

| Seed | Reward, first 8 steps | Reward, last 8 steps |
|---|---|---|
| default | 0.636 | 0.758 |
| 2 | 0.653 | 0.736 |
| 3 | 0.614 | 0.766 |

All three learned, and the final reward still spread by 0.03. The manual's rule: a change of 0.01 on one seed tells you nothing, and a change of 0.05 on two seeds is worth a third run.

### One change per run

The manual's first offload comparison showed a 12 percent faster rollout. The two runs also used different engine memory fractions, and their clean steps were different steps. On the one step that was clean in both runs, the faster run wrote answers of 599 tokens against 695, and rollout time follows the answer length. A same-day pair that changed only the offload setting measured 1 to 3 percent.

### Compare the same steps

Answers get shorter as the model learns, so the rollout time falls over a run. The same setting gave a median rollout of 47.5 seconds over 48 steps in one run and 59.1 seconds over the 6 clean steps of another; on the same 6 step numbers the first run took 60.9. Medians over different steps differ for that reason alone.

### Time only clean steps

The manual's GPU reached 84 C under load, and a guard paused the container until it cooled to 74 C. A pause adds wall-clock time to the phase it falls in. Report times from steps whose window overlapped no pause, and keep the pause log next to the run log.

### What to record for every run

The image digest and the framework commit, the full command, the seed, one log file per run, the GPU temperature and pauses, and the exit code. A run you cannot compare teaches nothing.

### The review checklist

1. Two seeds of the change, compared against the spread of the baseline seeds, not against one baseline run.
2. One setting changed, with everything else identical, the memory fraction included.
3. Rollout times on the same step numbers, from clean steps only.
4. A reward read as a mean over several steps, not from the last step.
5. A claim only when the change falls outside the spread.

## Follow-ups

- **Level 3:** Why compare against the spread of several baseline seeds and not against the best baseline? Expected: the best baseline is a lucky draw; the spread is the noise floor, and a change must clear it.
- **Level 3:** The new run has no clean steps, because every rollout overlapped a pause. What can you still report? Expected: take the pause time out of each step and say so, as the manual did for one run, and mark the result as unconfirmed.
- **Level 4:** How do you test a loss or reward change without paying for new rollouts? Expected: save the rollout samples of one run and replay them with the trainer alone; every replay sees the same samples, so a difference comes from the change.
- **Level 4:** Two seeds show a gain outside the spread, but the step-0 gap moved too. What next? Expected: the change touched the setup, not only the setting; check that both runs load the same model and sampler before you credit the gain.

## Wrong answers

- "Twelve percent is far above noise, ship it." The manual's twelve percent came from two settings changed at once and from different step numbers; one setting alone gave one to three percent.
- "Average the rollout time over the whole run." The median follows the answer length, which falls as the model learns; compare the same step numbers.
- "One seed is enough when the gain is clear." The three baseline seeds ended 0.03 apart with nothing changed; a few hundredths on one seed sit inside that.

## Taught in

[Section 5.3 of Miles 101](../../../manuals/miles-101/sections/5-3-repeat-a-run.md) gives the seed spread and the clean-step rule, [section 7.2](../../../manuals/miles-101/sections/7-2-keep-runs-comparable.md) lists what to record, and [the lab notes](../../../manuals/miles-101/sections/r-3-lab-notes.md) explain why the first offload pair does not hold.
