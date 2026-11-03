---
id: rl-custom-reward-take-home
title: Write and prove a custom reward for GRPO
card: post-training
kind: take-home
level: 3
roles: [applied-ai-engineer, inference-engineer]
rounds: [take-home, coding]
tags: [grpo, reward-function, custom-reward, float32, miles]
minutes: 30
lessons: []
manuals: [miles-101#s-write-a-custom-reward, miles-101#s-how-rollout-functions-plug-in, miles-101#s-troubleshoot-by-symptom, miles-101#s-keep-runs-comparable]
practice: [grpo-advantages]
cheatsheet: [miles-rl]
related: [post-training/grpo-groups-teach-nothing]
updated: 2026-11-03
---

Take-home. The RL framework you use scores each sampled answer with a reward function that you swap in by import path. Write a reward for a task with a numeric final answer, write a test plan for it, and explain how you would prove that your reward does not break the GRPO advantages before a long run. Keep the function and the plan short enough to read in five minutes.

## Short answer

Write an async function that receives the run arguments and one sample, extracts the last number from the answer and from the label, and returns 1.0 for a match and 0.0 otherwise, comparing as values so that 142 never matches 42. Test it on ten answers you scored by hand, with a correct one, a wrong one, an empty one and one cut at the length limit, because a reward that crashes on an empty answer stops the rollout of the whole step. Then check the advantages: a group where every answer gets the same reward must get an advantage of 0 for every member, and a fractional reward can fail that through float32 rounding.

## Full answer

### The function

```python
import re


def last_number(text):
    found = re.findall(r"-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?", text.replace(",", ""))
    return float(found[-1]) if found else None


async def custom_rm(args, sample, **kwargs):
    answer = last_number(sample.response)
    label = last_number(str(sample.label))
    return 1.0 if answer is not None and answer == label else 0.0
```

Three rules from the manual. Write it as `async def`, because the framework awaits the result and a plain function fails at the first call. The function receives the run arguments and one sample, with the answer in `sample.response` and the label in `sample.label`. If it returns a dict, name the field that holds the reward with the reward key flag; with the group flag, the function receives the whole group as a list and returns one reward per sample.

### Plug it in

Save the module in the mounted lab folder, put that folder on `PYTHONPATH`, and pass the import path with `--custom-rm-path my_rewards.custom_rm`. When the import works, the first `rollout 0` line shows a reward that your function produced. When it does not, the log shows `ModuleNotFoundError`, and the run does not stop by itself. The manual's test stayed up for two hours with no step, and the watchdog did not fire, because the engine wrote only 44 error lines. Stop the container, fix the path, and start again.

### The test plan

1. One call inside the container on a hand-written sample before any GPU work: the answer "So the answer is 42." with the label "42" must return 1.0.
2. Ten answers scored by hand: correct, wrong, correct in a different format, a number with a comma, an empty answer, an answer with no number, an answer cut at the length limit, a negative label, a decimal label, and an answer with two numbers where the last is right.
3. A two-step run with the reward in place; read `rollout/raw_reward` on the first step and compare a few logged samples with your hand scores.

### Prove the advantages

GRPO subtracts the group mean from each reward and divides by the group standard deviation. A binary reward gives an exact mean, so a group of equal rewards gets exactly 0 for every member. A fractional reward can fail: in float32 the mean of 16 rewards of 0.3 is not exactly 0.3, and the division by a standard deviation near 0 inflates the remainder to about 0.029 per answer. If you move to partial credit, use values a float32 holds exactly, such as multiples of 0.25, and check a group of equal rewards for zero advantages before the long run.

### Use the smallest hook

A scoring rule needs only the reward hook. The group filter and the generate function stay as they are, so batching, the metrics and the gap checks keep working for you.

## Follow-ups

- **Level 3:** Why compare the numbers as values and not as strings? Expected: so that a trailing zero or a comma does not fail a right answer, and so that 142 does not match 42 by substring.
- **Level 3:** The task has a free-text answer. What changes? Expected: the extraction; use a built-in overlap or multiple-choice scorer when one fits, because it is already tested, and keep the same ten-answer test plan.
- **Level 4:** Which built-in reward gives minus one for a wrong answer, and what does that change downstream? Expected: the DAPO-style reward returns a dict with the score, so it needs the reward key flag; the sign changes the mean, not the zero-advantage property of a two-valued reward.
- **Level 4:** How would you test a reward change without new rollouts? Expected: save the rollout samples of one run and replay them with the trainer alone, so that every candidate reward scores the same samples.

## Wrong answers

- "Write a plain function; the flag help shows one." The framework awaits the result, so a plain function fails at the first call; write it as an async function.
- "Return any float between 0 and 1 for partial credit; GRPO handles it." Fractions that float32 cannot hold exactly give groups of equal rewards a nonzero advantage; round to exact values and test such a group.
- "Skip the empty-answer case; the model always writes something." A cut or empty answer reaches the reward every step, and a crash there stops the whole rollout.

## Taught in

[Section 3.5 of Miles 101](../../../manuals/miles-101/sections/3-5-write-a-custom-reward.md) gives the function, the import rules and the float32 advantage check, and [section 8.5](../../../manuals/miles-101/sections/8-5-how-rollout-functions-plug-in.md) explains why the reward hook is the smallest one for this change.
