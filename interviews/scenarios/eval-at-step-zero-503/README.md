---
id: eval-at-step-zero-503
title: An eval that stopped the run before step 0
card: scenarios
kind: incident
level: 4
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review, system-design]
tags: [rl, evaluation, http-503, router, eval-fleet, miles]
minutes: 30
lessons: []
manuals: [miles-101#s-run-a-separate-eval-fleet, miles-101#s-add-a-watchdog, miles-101#s-survive-failures]
practice: []
cheatsheet: []
related: [scenarios/dead-engine-and-watchdog]
updated: 2026-11-03
system:
  version: Miles main 08752a12 with its own SGLang 0.5.22 build
  model: Qwen/Qwen3-0.6B
  hardware: one GB10 with 128 GB of unified memory
source:
  - manuals/miles-101/capture/gpu/out-gb10/tracker-eval-checks.txt
  - manuals/miles-101/sections/6-2-run-a-separate-eval-fleet.md
  - manuals/miles-101/sections/1-2-add-a-watchdog.md
---

## Situation

An RL team wants an accuracy score on a held-out math set during its long GRPO runs. Before they touch the long run, they do the right thing and add the eval flags to a 2-step smoke test, with the interval set to every step. The job stops before it finishes step 0, with a Ray task error from the eval task after thousands of HTTP 503 lines. They run it again. It stops the same way.

In the review, one engineer says the rollout engine died, as in the dead-engine incident, and wants the watchdog tuned. Another says the test set is too large for one GPU. The lead asks for a design that puts an eval score next to each step of the long run without this risk, and asks what the two failed tries prove and what they do not.

## Evidence

- [two tries of eval on the training engines, both before step 0](evidence/two-eval-tries.txt)
- [two 2-step runs of the same day without eval, which reached step 0 and step 1](evidence/same-day-runs-without-eval.txt)
- [the flags that run eval on the training engines](evidence/eval-command.txt)
- [how eval on the training engines works, and what happened on the GB10](evidence/what-the-manual-saw.txt)
- [the three places where eval can run, and the limits of the fleet](evidence/three-places.txt)
- [what the router is and what a 503 from it means](evidence/router-and-503.txt)

## Questions

1. Compare this failure with a run whose engine died. Which component raised, which component retried, and why did this job stop while that one hung for an hour?
2. The same recipe ran twice that day without the eval flags. What do those two runs rule out?
3. Name what the two failed tries prove about the router and the eval client, and name the one thing they do not prove.
4. Which component in this layout answered 503, and why does the count of those lines not tell you the cause?
5. Lay out the three places eval can run, with the cost and the limit of each, and pick one for a long run on this machine.
6. Write the gate that every eval configuration passes before it joins a long run, and the signal that proves it passed.

## Walkthrough

1. **Read the two tries.** Both ran the 2-step recipe with `--eval-interval 1` and the GSM8K test file. Both finished zero steps. The first wrote 5311 lines of `503 Service Unavailable`, the second 4339, and each ended with `ray.exceptions.RayTaskError` raised inside `RolloutExecutor.eval()`, from an `HTTPStatusError`. The eval client raised on the status code. This job did not hang, it failed and stopped. In the run whose engine died, the training rollout path retried the same status for 63 minutes and never raised. Two paths, two behaviors on one status code.
2. **Read the runs without eval.** The tracker checks of the same day ran the same 2-step recipe, on the same image and machine, and logged `step 0` and `step 1`. They differ from the failed tries only in the eval flags. So the recipe, the engine start and the trainer were healthy that day. The eval flags are the change that broke the job.
3. **Read what the eval sends.** The documented command sets the interval in steps and names the test split that the launcher downloads. With the interval at 1, the first eval ran at once, and the manual's record says that it sent the 1,319 test questions and that the router answered 503 to them. That is the whole burst: one eval of 1,319 prompts, many of them refused, counted as 5311 and 4339 error lines.
4. **Separate what is proven from what is not.** The router is the small service that forwards each rollout request to an engine, and 503 is what it returns when no engine can take the request. So the evidence proves that, at the moment of the eval, the router had no engine that would take those requests, and that the eval client treats that status as fatal. It does not prove why the engine was not available at that moment. The manual ran this twice and did not find the cause. A design that depends on the cause being known is not available.
5. **Read the three places.** On the training engines, the default, rollout production stops while the eval runs, the engines already hold the current weights, and on this machine the path failed twice. On a dedicated fleet, `--eval-num-gpus N` takes N GPUs of the job for eval and training never stops for it, with `eval/lag_steps` telling how late each score arrives, but the fleet cannot be combined with a checkpoint eval function and rollout fault tolerance does not work with it. Through your own service, `--eval-function-path` runs a checkpoint eval function, and the cost is only the checkpoint export.
6. **Place the two proposals.** The watchdog guards a run that never stops. This job stopped by itself, so a watchdog finds no container and exits. The size of the test set is a guess with no measurement behind it, because the manual did not isolate the cause, and the only way to test the guess is the same 2-step smoke test with a smaller set.

## Resolution

The two tries prove that eval on the training engines fails on this machine at the first eval, loudly and before step 0, and that the cause is open. The team should not add that mode to a long run, and the smoke test did its job by failing first. For the long run on one GB10, run eval through a checkpoint eval function with `--eval-function-path`, which costs only the checkpoint export and keeps the training engines out of the eval. When a second GPU is available, use a dedicated fleet with `--eval-num-gpus 1`, give its engines their own memory share with `--eval-sglang-mem-fraction-static 0.9`, read `eval/lag_steps`, and accept that rollout fault tolerance is off with that layout.

The gate stays: each new eval setting runs on the 2-step recipe first, with the interval at 1, and passes only when the log shows `step 0`, `step 1` and an eval score, with no `RayTaskError`. Keep the watchdog for the engine-death case, which is a different failure with a different signature.

## Wrong turns

- "The engine died, tune the watchdog." The job raised and stopped within its first step. The watchdog exists for the opposite case, a job that keeps sending requests to a dead engine and never fails.
- "Cut the test set to a few hundred questions and start the long run." The cause is not known, so a smaller set is a guess. Test it on the 2-step recipe, and only a pass earns a place in the long run.
- "Set the interval to 10 so that eval runs less often." The failure happened at the first eval. A longer interval moves the first eval later into a long run, where the same stop costs the work of every step before it.
- "Use the fleet together with rollout fault tolerance." Rollout fault tolerance does not work with a dedicated fleet in this version. Pick one.
- "Eval on the training engines is free, because they already hold the weights." It stops rollout production for the whole eval, and on this machine it stopped the job.

## Generalize

A smoke test that fails is a result, not a delay. Record what the failure proves and what it leaves open, and design around the open part instead of guessing at it. When one dependency answers the same error to two clients, know how each client treats it, because a retry turns an outage into a hang and a raise turns it into a fast stop. Keep the work that must not stop, here training, on different engines from the work that may fail, here eval, and let every new configuration earn its place through the same short test.

## Taught in

The Miles manual lays out the three places for eval and records the two failed tries in [the eval fleet page](../../../manuals/miles-101/sections/6-2-run-a-separate-eval-fleet.md), defines the router and the 503 in [the watchdog page](../../../manuals/miles-101/sections/1-2-add-a-watchdog.md), and gives the fault tolerance limits in [the failures page](../../../manuals/miles-101/sections/6-3-survive-failures.md).
