---
id: dead-engine-and-watchdog
title: A dead rollout engine and a watchdog that kills
card: scenarios
kind: incident
level: 3
roles: [inference-engineer, ai-evaluation-reliability-engineer, agentic-ai-engineer]
rounds: [debugging, design-review]
tags: [rl, rollout-engine, watchdog, http-503, alerting, miles]
minutes: 25
lessons: [phases/17-infrastructure-and-production/23-sre-for-ai]
manuals: [miles-101#s-add-a-watchdog, miles-101#s-survive-failures, miles-101#s-troubleshoot-by-symptom, miles-101#s-which-router-to-use]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
system:
  version: Miles main 08752a12 with its own SGLang 0.5.22 build
  model: Qwen/Qwen3-0.6B
  hardware: one GB10 with 128 GB of unified memory
source:
  - manuals/miles-101/capture/gpu/out-gb10/engine-died-503.log
  - manuals/miles-101/capture/gpu/out-gb10/engine-died-count.txt
  - manuals/miles-101/capture/gpu/out-gb10/503-bursts.txt
  - manuals/miles-101/capture/gpu/out-gb10/watchdog-test.txt
  - manuals/miles-101/capture/gpu/watchdog.sh
  - manuals/miles-101/sections/1-2-add-a-watchdog.md
---

## Situation

A team runs GRPO on one GB10 and leaves a run alone for an hour. When they come back, the GPU is idle, the container is still running, and the log has grown to 147 MB. No failure appeared in the output of the run. The rollout engine had been started with an attention setting that this GPU cannot run, and it stopped during startup. The trainer did not stop: it went on sending requests to the dead engine.

The team writes a watchdog. Every 30 seconds it counts the `503 Service Unavailable` lines of the last 60 seconds and, when it finds more than 100 such lines in six checks in a row, it stops the container. The next day the watchdog stops a healthy run that generated 16 answers per prompt, in the middle of its steps. The team now distrusts both the run and the watchdog.

## Evidence

- [the engine failure and the first and last error from the trainer side](evidence/engine-died.txt)
- [how many error lines the run wrote](evidence/error-count.txt)
- [the quietest and the busiest minutes of the dead run](evidence/errors-per-minute-dead.txt)
- [the first fifteen minutes of errors in a run that finished every step](evidence/errors-per-minute-healthy.txt)
- [the watchdog against two containers that print the error on purpose](evidence/watchdog-test.txt)
- [the watchdog rule replayed on the real error times of the healthy run](evidence/replay.txt)

## Questions

1. The trainer never failed. Which component returned the 503, and why did the trainer treat it as something to retry?
2. A count of errors alone cannot separate the dead run from the healthy one. Which property can, and how do you write it as a rule?
3. Replay the six-check rule on the healthy run. Why did it fire, and in how many of the 30 start offsets?
4. Pick the number of checks. What does each extra check cost when the engine really is dead?
5. The script exits with 0, 1 or 2. What should a queue of runs do with each code?
6. On a cluster of many GPUs you would not run this script. What replaces it, and what did the fault tolerance of the version we ran not cover?

## Walkthrough

Read the first listing from the top. The engine enabled deterministic inference for the on-policy target, then an assertion stopped it: the FlashAttention v3 backend needs an SM between 80 and 90, and the GB10 is outside that range. The parent received a SIGQUIT from the child. From that moment the trainer's rollout executor logged `503 Service Unavailable` from the router at `172.17.0.3:20035`. The router is the small service that forwards each rollout request to an engine, and 503 is what it returns when no engine can take the request. The client retries a 503, because a busy engine returns it too. The last two lines are 63 minutes apart, from 21:03 to 22:06, and the second listing counts 200,533 such lines in that log.

The third and fourth listings compare the two runs minute by minute. The dead run never went quiet. Its two partial minutes held 1,838 and 2,281 errors, and every full minute held at least 2,669, up to 3,719. The healthy 16-answer run logged 22,357 errors in total, but in bursts: 286 and 271 in the first two minutes, nothing for ten minutes, then 686 and 882, then 18. One minute reached 2,209. The client retried each request and the run finished all its steps. A count alone cannot tell these two runs apart. The time can. A dead engine produces errors in every window, a busy engine produces them in bursts with gaps.

The watchdog turns that into a rule: every 30 s, count the errors of the last 60 s, and stop only once the count has stayed above 100 for a set number of checks in a row. The fifth listing tests it on two containers with no GPU. A container that prints ten error lines a second was stopped after 183 s with six checks, and the script exited with 1. A container that prints for 60 s and then stays quiet for two minutes, three times over, ran to its end after 541 s, and the script exited with 0.

The last listing shows why six checks was still wrong. Replayed on the real error times of the healthy run, for each of the 30 possible start offsets of the checks, six checks stopped the run in 17 of 30 cases. Two bursts came 45 s apart, so the 60 s window held errors for six consecutive checks. No offset reached more than six checks in a row. With eight checks the rule stopped the healthy run in 0 of 30 cases, and with ten checks also 0 of 30. The cost is time on a dead engine: 153 to 182 s at six checks, 273 to 302 s at ten.

## Resolution

The engine died because of a backend assertion, and the run did not notice because a 503 looks like a busy engine to the client. The fix for the run is to read the engine lines above the first error and change the attention backend, as the assertion message says.

The fix for the watchdog is the number of checks. Set it to 10, because a healthy run did not reach more than 6 checks in a row and 8 or 10 stopped it in 0 of 30 replays, while a dead engine is still stopped in about five minutes. Keep the limit at 100 errors per 60 s window and the check every 30 s. Test the script on the two fake containers before you trust it, and keep the replay against a real healthy log, because the fake burst container has quiet gaps of two minutes, longer than the real gaps of 45 s.

Give the exit codes meaning. Exit 1 means the watchdog stopped the run, so a queue skips to the next run and keeps the log. Exit 0 means the run ended on its own. Exit 2 means the watchdog lost its view of the containers, so the run has no guard and a person must look.

## Wrong turns

- "Alert when the count of 503 lines in a minute is high." A healthy run logged 2,209 in one minute and finished every step. The count fires on bursts, the time between bursts is the signal.
- "Six checks in a row is enough, the test passed." The test container paused for two minutes between bursts. The real run had bursts 45 s apart, and the replay on its real times fired in 17 of 30 cases.
- "Raise the limit until the healthy run passes." The largest healthy minute held 2,209 errors and the quietest full minute of the dead run 2,669. A limit between them fits this pair of runs only, and a slower dead engine or a busier healthy run breaks it. The time rule does not depend on the rate.
- "Turn on fault tolerance instead of a script." On one GPU a dead engine means a dead run. In the version we ran, rollout fault tolerance did not work with a dedicated eval fleet or with the fully async colocated layout, and without it the trainer keeps sending requests to a dead engine and never fails.
- "Let the watchdog restart the engine." The script only stops the run. The cause is in the engine lines above the first error, and a restart with the same setting fails the same way.

## Generalize

A component that retries forever turns a dead dependency into a silent hang, and the only honest signal is time, not count. Build the alarm from the duration of the error condition, replay the rule on the logs of real healthy runs before you trust it, and give the alarm an exit code that a queue can act on. Then read the first error, not the last, because the cause sits above the noise.

## Taught in

The Miles manual builds and tests the watchdog in [the watchdog page](../../../manuals/miles-101/sections/1-2-add-a-watchdog.md), covers checkpoints and fault tolerance in [the failures page](../../../manuals/miles-101/sections/6-3-survive-failures.md), lists the engine causes in [the troubleshooting page](../../../manuals/miles-101/sections/7-1-troubleshoot-by-symptom.md) and explains the 503 in [the router page](../../../manuals/miles-101/sections/8-6-which-router-to-use.md), and [the SRE for AI lesson](../../../phases/17-infrastructure-and-production/23-sre-for-ai/docs/en.md) frames the alarm design.
