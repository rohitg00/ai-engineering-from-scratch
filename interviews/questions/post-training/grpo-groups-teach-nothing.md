---
id: grpo-groups-teach-nothing
title: A flat GRPO reward and the groups that teach nothing
card: post-training
kind: debug
level: 2
roles: [inference-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [debugging, ml-depth]
tags: [grpo, dynamic-sampling, zero-variance, reward, miles]
minutes: 12
lessons: []
manuals: [miles-101#s-train-with-the-dapo-filter, miles-101#s-read-your-first-ten-steps, miles-101#s-train-math-on-gsm8k, miles-101#s-write-a-custom-reward, miles-101#s-read-the-run]
practice: [grpo-advantages]
cheatsheet: [miles-rl]
related: [post-training/rl-custom-reward-take-home, post-training/logprob-gap-at-step-zero]
updated: 2026-11-03
---

A GRPO run trains a small model on grade-school math with a binary reward. The reward per step jumps around, and the trend over many steps looks flat. The team wants to raise the learning rate. What do you read first, and what do you suspect?

## Short answer

Read the group statistics before you touch the learning rate. GRPO scores each answer against the mean of its group, so a group where every answer is right or every answer is wrong has a zero advantage for every member and teaches nothing. In the manual's runs, 10 of the 32 groups in the first step had one reward for all 8 answers, and about half of the groups did over 12 steps. If most groups are like that, the signal is thin, and the fix is the prompt mix or the dynamic sampling filter, not a bigger step.

## Full answer

### Read five numbers, not the reward

The reward of one step moved by up to 0.14 between steps in the first ten steps of the manual's runs, and by up to 0.21 over a long run, so read a mean over five or more steps. Next to it read the answer length, the share of answers cut at the length limit, the log-probability gap between the trainer and the engine, and the KL between them. A flat reward with a flat gap and a normal length points at the signal, not at the kernels.

### Count the groups that carry no advantage

The rollout `perf` line counts groups with a zero standard deviation: `rollout/zero_std/count_1` for all right and `rollout/zero_std/count_0` for all wrong. In the first step of the manual's baseline, 7 groups were all right and 3 were all wrong, 10 of 32. Over 12 steps with one seed, 191 of 384 groups had one reward for every answer, and 142 of those were all right: easy prompts the model already solved.

### The filter and its cost

The dynamic sampling filter drops those groups and asks the engine for more prompts until the step holds enough groups with a spread. With batches of 48 prompts for 32 kept groups, the manual's steps dropped 16 to 48 groups each, median 36, and most dropped groups were all right. The rollout took 1.5 times as long when one extra batch was enough and 2.8 times as long when a second batch was needed. The sum of the twelve step times went from 60 minutes to 113.

### Read the reward with the filter on

`rollout/raw_reward` no longer includes the dropped groups, so compare `rollout/raw_reward_unfiltered` instead. Even that number leaned high in the manual's run, 0.686 against 0.657, because the slowest and longest answers were stopped before they counted, and a cut answer usually scores 0. Treat a gain inside the spread of your baseline seeds as noise.

### What a higher learning rate would do

A larger step on a thin signal raises the gradient norm and the variance of the update without adding information. The manual's rule for a gradient norm that grows step after step is the opposite: lower the rate.

## Follow-ups

- **Level 2:** Why does a group with one reward give a zero advantage? Expected: GRPO subtracts the group mean and divides by the group standard deviation; equal rewards give a zero numerator for every answer.
- **Level 2:** What else makes a math reward score 0 besides a wrong answer? Expected: an answer cut at the length limit before its final line; read the cut share next to the reward.
- **Level 3:** The filter run shows a higher mean reward than the baseline. How do you decide if it learned more? Expected: compare the unfiltered reward, account for the bias from stopped long answers, and run a second seed against the spread of the baseline seeds.
- **Level 3:** Your reward returns fractions, and a group with identical rewards still shows small nonzero advantages. Why? Expected: float32 rounding of the group mean leaves a remainder that the division by a near-zero standard deviation blows up; round rewards to values a float32 holds exactly.

## Wrong answers

- "Raise the learning rate; the reward is flat because the steps are small." The signal is thin because many groups carry no advantage; a larger step amplifies noise and raises the gradient norm.
- "Sample more answers per prompt to get a spread." In the manual's runs, 4, 8 and 16 answers per prompt gave reward gains inside one seed range, and more answers made each rollout longer.
- "Read the reward of the last step." One step moves by up to a fifth of the scale; read the mean over five or more steps.

## Taught in

[Section 3.2 of Miles 101](../../../manuals/miles-101/sections/3-2-train-with-the-dapo-filter.md) measures the dropped groups and the cost of the filter, [section 1.3](../../../manuals/miles-101/sections/1-3-read-your-first-ten-steps.md) counts the groups that teach nothing, and [section 3.1](../../../manuals/miles-101/sections/3-1-train-math-on-gsm8k.md) compares group sizes.
