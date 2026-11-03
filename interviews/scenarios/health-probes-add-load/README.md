---
id: health-probes-add-load
title: Health probes that add load
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, forward-deployed-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review]
tags: [health-check, readiness, liveness, kubernetes, probes, shutdown]
minutes: 15
lessons: [phases/17-infrastructure-and-production/23-sre-for-ai]
manuals: [sglang-101#s-check-that-the-server-is-healthy, sglang-101#s-operating-sglang, vllm-101#s-check-that-the-server-is-healthy, vllm-101#s-run-vllm-in-production]
practice: []
cheatsheet: [sre-for-ai]
related: [scenarios/load-knee-and-admission-cap]
updated: 2026-11-03
system:
  version: SGLang 0.5.22 against vLLM 0.31.0
  model: Qwen/Qwen3-8B
  hardware: one L4 with 24 GB of memory
source:
  - manuals/sglang-101/capture/gpu/out-l4/server-default.log
  - manuals/sglang-101/sections/7-1-operating-sglang.md
  - manuals/vllm-101/capture/gpu/out-l4/livecheck-2026-10-22.txt
  - manuals/vllm-101/sections/1-2-check-that-the-server-is-healthy.md
---

## Situation

A platform team runs SGLang pods on Kubernetes. The liveness probe asks `/health` every few seconds with a short timeout, and a failed probe restarts the pod. During a traffic spike the busiest pods restart in a loop. A probe times out, the pod is killed in the middle of its answers, its users move to the other pods, and the next busiest pod fails its probe. The service recovers only when the spike passes.

The scheduler log of a restarted pod shows the probes themselves, as prefill batches of one token between the user requests. The ticket proposes two changes: a longer probe timeout and a higher memory limit for the pod.

## Evidence

- [the health probe around the ready line of our L4 server](evidence/probe-in-the-log.txt)
- [the three health endpoints and the two settings behind them](evidence/three-endpoints.txt)
- [what the code claims and what two incidents showed](evidence/the-docstring-and-the-incident.txt)
- [the routes of a vLLM server with an API key, with and without the key](evidence/the-other-engine.txt)
- [the first health check of a vLLM server after startup](evidence/vllm-health-semantics.txt)

## Questions

1. Read the log around the ready line. What did the server do when the probe asked for its health, and what does that cost under load?
2. Name the three endpoints and the question that each one answers.
3. The code says that the probe costs nothing when the server is busy. Why is that true for the work and false for the timing?
4. Design the probes: readiness, liveness and a deep check. Give the endpoint, the setting, the timeout and what happens on a failure.
5. The other engine answers its health route without generating. What does that change for a deep check there?
6. A restart in the middle of answers also needs a clean stop. Which signal, to which process, and how long do you wait?

## Walkthrough

Read the eight log lines in order. At 14:43:37 the probe asked `/health` and got a 503, because the server was still starting. The server then sent itself one request to `/generate`, froze the garbage collector, and printed the ready line. Two seconds later the scheduler logged a prefill batch of one new token, and right after it the probe got its 200. Nothing else was running. That one-token batch was the probe. By default `/health` does not only answer, it sends a request through the model and waits for the result.

The second listing names the three endpoints. `/ready` returns 200 when the tokenizer manager is ready, and it sends nothing to the model. `/health` and `/health_generate` share one handler: they return 503 while the server starts or shuts down, and otherwise they send a one-token request with `max_new_tokens` of 1 and wait for any output from the detokenizer. `SGLANG_ENABLE_HEALTH_ENDPOINT_GENERATION` defaults to true, so a plain `/health` generates too. The wait is `SGLANG_HEALTH_CHECK_TIMEOUT`, 20 s by default, after which the handler marks the server unhealthy and returns 503.

The third listing is the subtle part. The docstring is right about the work: any output from the scheduler counts as proof of life, so a busy server does not need to finish the probe's token. It is wrong about the timing. The probe request waits in the same queue as the users, and when the first token of anyone takes longer than the probe timeout, the probe fails. The two incidents show both halves. One report saw the health check fail with no response from the detokenizer for 20 seconds, on a large model under high load. A second found that a timed-out probe left its request in the scheduler, so failed probes accumulated. Under a spike, the probe is a user who gives up after 20 s and tells the orchestrator to kill the server.

The last two listings are the other engine. Its `/health`, `/ping` and `/load` routes answer 200 without an API key, and its first health check after startup is followed by the model list, not by a prefill batch. The manual says why: that health route answers 200 when the engine runs and does not generate a token, so a 200 does not prove that a request completes. On that engine the health route is a liveness check by design, and a deep check means one short request.

## Resolution

The probes were the incident. The liveness probe generated a token on every call, waited in the user queue, timed out under load and killed the busiest pod, which moved its load to the next pod.

Set `/ready` as the readiness probe, so a pod joins the service when it can accept requests. For liveness, set `SGLANG_ENABLE_HEALTH_ENDPOINT_GENERATION=false`, after which `/health` returns 200 without a request to the scheduler, and keep that probe on the pod. Move `/health_generate` to a slower deep check that alerts a person and restarts nothing. The probe timeout then stops mattering under load, and the memory limit was never the problem. On the other engine, use `/health` for liveness as it is, and make the deep check one short request.

Then fix the stop. Only a SIGTERM to the main process drains the running requests: the server returns 503 on `/health` during the drain, logs the remaining requests every 5 s, and exits when none remain. A signal to the whole process group or a forced exit stops work in progress. Set the termination grace period longer than the longest request at the output cap, and cap `max_tokens` first, or a drain can never finish in time.

## Wrong turns

- "Raise the probe timeout to a minute." The probe still waits in the user queue, and a timed-out probe left its request in the scheduler in one report. A longer timeout hides the overload for longer and then kills the pod anyway.
- "Raise the memory limit of the pod." The pods did not run out of memory. They were killed by the orchestrator after a probe waited too long.
- "Use the generating endpoint for liveness, because it proves that the model works." A deep check that restarts the busiest pod under load is the incident. A deep check should alert a person.
- "Kill the pod fast so the others take over." A signal to the process group killed the scheduler child first and failed every running request. Only a SIGTERM to the main process drains.

## Generalize

A probe is a client, and a client that waits in the same queue as the users will fail exactly when the users wait, which is when a restart hurts most. Separate the questions: can the process accept requests, is the process alive, and can the model produce a token. Give each question its own endpoint, its own schedule and its own consequence, and never let the slow question trigger a restart.

## Taught in

The SGLang manual shows the probe in the log in [the health page](../../../manuals/sglang-101/sections/1-2-check-that-the-server-is-healthy.md) and gives the probe settings, the incidents and the drain in [the operating page](../../../manuals/sglang-101/sections/7-1-operating-sglang.md), the vLLM manual explains its health route in [its health page](../../../manuals/vllm-101/sections/1-2-check-that-the-server-is-healthy.md) and the production probes in [the production page](../../../manuals/vllm-101/sections/7-2-run-vllm-in-production.md), and [the SRE for AI lesson](../../../phases/17-infrastructure-and-production/23-sre-for-ai/docs/en.md) covers runbooks for this class of loop.
