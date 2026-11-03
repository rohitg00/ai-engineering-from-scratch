---
id: rl-engine-died-silent
title: The GPU is idle and the RL log keeps growing
card: post-training
kind: debug
level: 2
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging]
tags: [rl-infrastructure, rollout-engine, watchdog, miles, 503]
minutes: 10
lessons: []
manuals: [miles-101#s-add-a-watchdog, miles-101#s-troubleshoot-by-symptom, miles-101#s-write-a-custom-reward, miles-101#s-know-the-true-on-policy-limits]
practice: []
cheatsheet: [miles-rl]
related: [post-training/grpo-groups-teach-nothing]
updated: 2026-11-03
---

You left a one-GPU RL training run alone for an hour. When you come back, the GPU is idle, the process is still alive, and the log file has grown to more than a hundred megabytes. Nothing reports a failure. What happened, how do you confirm it, and what do you put in place so that it cannot happen again?

## Short answer

The rollout engine died and the trainer never noticed. The engine failed during startup, and the rollout client kept sending requests to it, got a 503 from the router on each one, and retried. The failed run in the manual wrote 200,533 such error lines in 63 minutes and never reported a failure. Confirm it by counting the error lines per minute and by reading the engine lines above the first error, then run every unattended job with a watchdog that stops the container when the errors do not stop.

## Full answer

### What a dead engine looks like

The run that the manual lost asked for an attention backend that its GPU could not run. The engine raised an assertion during startup and exited. The trainer process stayed up and sent generate requests to the router for an hour, and the router returned `503 Service Unavailable` for each one. The first and the last error were 63 minutes apart.

### Confirm the cause, in this order

1. Count `503 Service Unavailable` over the whole log. The manual's healthy runs held none at all, with one exception below.
2. Count the errors per minute. The dead engine wrote at least 2,669 in every full minute. A healthy but busy engine wrote bursts of up to about a minute and then nothing: the run with 16 answers per prompt logged 22,357 errors in bursts of up to 2,209 in one minute, the client retried, and the run finished every step.
3. Read the engine lines above the first error. The cause lives there, not in the trainer lines.

### Why a count alone is not enough

A count cannot separate a burst from a death, but time can. The watchdog in the manual reads the last 60 seconds of the container log every 30 seconds and counts the errors. It stops the run only when the count passes 100 in ten checks in a row. Replayed on the real error times of the busy run, a rule with six checks would have stopped that healthy run in 17 of 30 cases, because two bursts came 45 seconds apart. With ten checks it stopped no healthy case and still stops a dead engine in about five minutes.

### What the watchdog cannot see

A run that hangs after a reward module import error writes almost no error lines. The manual's test stayed up for two hours with 44 of them, and the watchdog did not fire. For that symptom, look for `ModuleNotFoundError` with no `rollout 0` line after it.

### Practice

- Start the watchdog in a second terminal for every run you leave alone, and test it first on a container that prints the error on purpose; the manual's test stopped a fake dead engine in 183 seconds.
- Give each run its own container name and its own log file.
- Read the exit code: 1 means the watchdog stopped the run, 2 means it lost contact with the container runtime and the run had no guard.

## Follow-ups

- **Level 2:** Why does the trainer not fail when the engine is gone? Expected: the rollout client treats the 503 as a transient error and retries each request; nothing in the loop limits the retries or the idle time.
- **Level 2:** Where do you look for the reason the engine died? Expected: the engine lines above the first 503 in the same log; in the manual's case an attention backend assertion for a GPU outside its supported range.
- **Level 3:** Why did the manual raise the watchdog from six checks to ten? Expected: a replay on a healthy run showed bursts 45 seconds apart that six checks mistook for a death; ten checks never fired on a healthy run and still caught a dead engine in about five minutes.
- **Level 3:** What does the watchdog miss, and what do you add for it? Expected: a run that hangs with few errors, such as a reward import failure; add a check that the first step line appears within a time limit.

## Wrong answers

- "Kill the run as soon as a 503 appears." A busy engine with hundreds of open requests writes bursts of these errors and recovers; the manual's busy run finished all its steps.
- "Raise the client retry limit so the run survives." Retries are why the dead run lived for an hour; the engine will not come back by itself, and the GPU sits idle.
- "The trainer crashed; look at the trainer lines." The trainer was alive and logging errors; the cause is in the engine startup lines above the first error.

## Taught in

[Section 1.2 of Miles 101](../../../manuals/miles-101/sections/1-2-add-a-watchdog.md) replays the watchdog rule on real error times, and [section 7.1](../../../manuals/miles-101/sections/7-1-troubleshoot-by-symptom.md) lists the symptom next to the hang after a reward import error.
