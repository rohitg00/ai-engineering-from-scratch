---
id: sleep-mode-for-rl-rollouts
title: Sleep, wake and weight updates for an RL loop
card: inference-serving
kind: concept
level: 2
roles: [inference-engineer]
rounds: [ml-depth, system-design]
tags: [sleep-mode, rl-rollout, weight-update, logprobs, dev-mode]
minutes: 8
lessons: []
manuals: [vllm-101#s-use-vllm-as-an-rl-rollout-engine]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

Your RL trainer shares its GPUs with the vLLM server that generates the rollouts. Between rollout steps the trainer needs the GPU memory back, and after each step the server needs the new weights. What does vLLM give you for this loop, and what can go wrong at the pinned version?

## Short answer

vLLM has development-mode routes for the loop: sleep mode frees GPU memory on `/sleep` and takes it back on `/wake_up`, `/pause` and `/resume` stop and restart generation, and a weight transfer runs through `/init_weight_transfer_engine`, `/start_weight_update` and `/finish_weight_update`, over NCCL between GPUs or through CUDA memory handles on one machine. At level 1 the sleep keeps the weights, and at level 2 it drops them too, which suits a step where the trainer sends new weights anyway. Three problems are known at 0.31.0: a level 2 wake does not reload a speculative draft, a level 2 sleep clears calibrated KV scales, and a weight update during sleep stops the engine, so wake first, reload, reset the prefix cache and read the acceptance counters.

## Full answer

### The loop

An RL step has two halves. The rollout half generates answers with the current weights. The training half computes a loss and updates the weights, and the generator needs the new weights before the next rollout. On one set of GPUs the two halves take turns on the same memory, so the generator must give its memory back during training and take it again after.

### The pieces

All of these routes exist only when the server starts with `VLLM_SERVER_DEV_MODE=1`. They free memory, replace weights and run methods on every worker, so never expose a server in this mode outside the network of the trainer; bind it to the local host when you try it by hand.

- **Sleep mode.** Start with `--enable-sleep-mode`. `/sleep?level=1` frees the KV cache and other memory and keeps the weights; level 2 drops the weights too. `--sleep-preserve-parameter-names` keeps frozen weights on the GPU so that they do not move each step. `/is_sleeping` reports the state.
- **Pause and resume.** `/pause` stops new generation and can abort the running requests, wait for them or keep them; `/resume` starts again.
- **Weight updates.** The trainer starts a transfer, calls start, sends the weights, calls finish, and records the version with `/update_weight_version` so that the next rollouts are labelled.
- **Collective calls.** `/collective_rpc` runs a method on every worker, for setup that vLLM does not cover.
- **External launch.** With the external launcher backend, a launcher such as torchrun starts the vLLM workers inside the trainer's processes.

### What the manual saw

A level 1 sleep with Qwen3-0.6B on an L4: each POST returned 200 with an empty body, the sleep took 1.9 s, the GPU memory fell from 14,861 to 4,245 MiB and came back after the wake, and the log line read `Sleep mode freed 10.37 GiB memory`. That is the only timing the manual has; a level 2 sleep and a weight update were not timed.

### What can go wrong at 0.31.0

- A level 2 wake does not reload a speculative draft. The reload covers only the target model, so the target rejects every draft token and decode falls to about the speed with no speculation. The output stays correct and no error appears. The issue is open.
- A level 2 sleep clears calibrated KV scales on some checkpoints with an FP8 cache. The first request after a reload returned NaN logprobs and a wrong first token. The next release fixes this.
- A weight update during sleep segfaults the engine. The API server stays up and every later request fails. The issue is open.

So after each level 2 wake, reload the weights, reset the prefix cache and read the speculative acceptance counters. A reload does not bring back cleared KV scales at 0.31.0; release 0.32.0 fixes that case. Always wake the server before the trainer sends weights.

### The logprob gap

The trainer compares the logprobs that the server returned with the ones it computes itself. They never match exactly, because the kernels differ; a small steady gap is normal, and a growing gap means the weights did not reach the generator. Check which value the server returns first. `--logprobs-mode raw_logprobs`, the default, gives the logprob over the full vocabulary; `processed_logprobs` gives it after the sampling settings change the distribution. With top-p 0.9 the raw mode matched a full-vocabulary reference with a median absolute gap of 0.005, and the processed mode was higher by minus the log of the kept mass, a median shift of about 0.053. Match the mode to the way the trainer scores tokens.

## Follow-ups

- **Level 2:** What is the difference between the two sleep levels? Expected: level 1 frees the KV cache and other memory and keeps the weights; level 2 drops the weights too, which suits a step where new weights arrive anyway and costs a reload.
- **Level 3:** After a level 2 wake the output is correct but decode runs as slowly as with no speculation. Why? Expected: the weight reload covers only the target model, so the draft is not reloaded and the target rejects every draft token; no error appears, and the acceptance counters show it.
- **Level 3:** The trainer's logprobs differ from the server's on every token. Bug or not? Expected: a small steady gap is normal because the kernels differ, 0.005 median absolute with raw logprobs; a growing gap means the weights did not arrive, and a constant offset near the log of the kept mass means the server returned processed logprobs under top-p while the trainer scored the full vocabulary.
- **Level 4:** Order the steps of one RL iteration around these routes. Expected: pause or drain generation, sleep, train, wake, then start and finish the weight update and record the version, reset the prefix cache, reload the draft if speculation is on, read the acceptance counters, resume; never send weights while the server sleeps, because that stops the engine.

## Wrong answers

- "Expose the sleep and weight routes on the public port." They exist only in development mode, and they free memory, replace weights and run methods on every worker; keep them on the trainer's network, bound to the local host when you test by hand.
- "Send the new weights while the server sleeps to save time." At 0.31.0 that segfaults the engine; the API server stays up and every later request fails, so always wake before the trainer sends weights.
- "Logprobs from the server and the trainer should match exactly." The kernels differ, so a small steady gap is normal; track it every step and treat a growing gap as a sign that the weights did not reach the generator.
- "A level 2 wake restores the server to its state before the sleep." It reloads the target weights only; the speculative draft is not reloaded and calibrated KV scales were cleared on some checkpoints, so reload, reset the cache and read the acceptance after each level 2 wake, and on 0.31.0 a reload does not bring back the scales.

## Taught in

[Use vLLM as an RL rollout engine](../../../manuals/vllm-101/sections/3-9-use-vllm-as-an-rl-rollout-engine.md) lists the routes, the sleep check and the known problems.
