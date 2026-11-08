---
id: sigterm-to-the-process-group
title: A rolling update that dropped every running answer
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, forward-deployed-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review]
tags: [shutdown, sigterm, drain, rolling-update, kubernetes, grace-period]
minutes: 20
lessons: [phases/17-infrastructure-and-production/23-sre-for-ai]
manuals: [sglang-101#s-operating-sglang]
practice: []
cheatsheet: [sre-for-ai, sglang-serving]
related: [scenarios/health-probes-add-load]
updated: 2026-11-03
system:
  version: SGLang 0.5.22 on its MLX path
  model: mlx-community/Qwen3-0.6B-4bit
  hardware: one laptop with unified memory, which captures no CUDA graphs
source:
  - manuals/sglang-101/capture/out/server-default.log
  - manuals/sglang-101/capture/out/shutdown-exploratory.log
  - manuals/sglang-101/capture/out/shutdown-exploratory.txt
  - manuals/sglang-101/sections/7-1-operating-sglang.md
---

## Situation

A platform team deploys SGLang pods with a rolling update. The container starts the server through a small wrapper script. When the orchestrator asks the pod to stop, the wrapper forwards the signal it receives to its whole process group. Every deploy produces a burst of failed requests. The users who were in the middle of an answer get a broken stream, and the pod log of each stopped server reports a crash, although nothing was wrong with the model.

The on-call engineer reads the end of one log and finds the crash in it. The team has two proposals: raise the grace period for termination from 30 s to five minutes, and add a retry in the gateway for the broken streams. You review the evidence before either change ships.

## Evidence

- [the end of a stopped server's log, as the team read it](evidence/group-signal.txt)
- [what the server does on a SIGTERM to its main process](evidence/how-the-drain-works.txt)
- [a SIGTERM to the main process only, with one request running](evidence/main-process-signal.txt)
- [the request completes and the server exits](evidence/drain-finishes.txt)
- [what the client saw across the drain](evidence/what-the-client-saw.txt)
- [the two exits that skip the drain, and the grace period rule](evidence/two-exits-skip-the-drain.txt)

## Questions

1. The log says that a subprocess crashed with exit code -15. What is that exit code, and who sent it?
2. Read the drain description. Which process must receive the signal, and what happens to the health endpoint while the drain runs?
3. The second capture sends the signal to one process while a request runs. Trace the request from the signal to the exit code.
4. A longer grace period was proposed. What decides the right value, and why does the output cap come first?
5. Name the two ways a server skips the drain, and the environment variable trap at this version.

## Walkthrough

1. **Read the exit code.** A negative exit code is a signal number, and 15 is SIGTERM. In the first listing the parent logs that it received SIGTERM and starts to drain, and in the same second its scheduler child dies of the same signal. Two processes do not receive one signal at the same instant unless the sender addressed the group. The wrapper did that. The scheduler died first, the parent found a dead child, took the crash path, slept 5 seconds for diagnostics and killed the tree. Every running request died with the scheduler. The crash in the log is the symptom of the wrapper, not a fault in the server.
2. **Read who owns the drain.** The manual describes the path. On SIGTERM the HTTP server sets `gracefully_exit`, and `/health` begins to answer 503. A watchdog in the tokenizer manager checks the flag every 5 s and logs the remaining requests every 5 s until none remain. Then it sends `ShutdownReq` to the schedulers and gives them 15 s to exit before it kills them. The drain lives in the main process. A scheduler that gets the signal itself never gets the shutdown request, so the drain cannot begin.
3. **Read the clean stop.** In the second capture, the probe sent SIGTERM to the server process alone while one request for 3000 tokens ran. The decode batches continue after the signal line, and one second later the log says that a health check arrived during shutdown and returned 503. That 503 is what the orchestrator needs: stop sending traffic here, the pod is on its way out. Ten seconds later the request returns 200, the watchdog logs zero remaining requests, and the server process finishes.
4. **Read what the client saw.** Health 200 before the signal, 503 during the drain, the request complete with all 3000 tokens and the finish reason `length` after 14.2 s, and an exit code of 0. Nothing was lost, and the server was gone about thirteen seconds after the signal.
5. **Read the two exits that skip the drain.** A server that is already `UnHealthy` exits at once, and so does a server with `SGL_FORCE_SHUTDOWN` set. The environment module declares the new name `SGLANG_FORCE_SHUTDOWN`, and its compatibility code copies old names to new names only, so the watchdog at this version still reads the old name. Setting only the new name does nothing. The manual read this in the code, did not run it, and calls it a likely bug. The same listing gives the rule for the grace period: longer than one request at the output cap, and a 32K-token answer at 30 tokens per second needs more than 18 minutes.

## Resolution

The wrapper was the incident. It turned one SIGTERM into a signal for every process, the scheduler died before the parent could drain, and the parent reported a crash it did not cause. The fix is to make `sglang serve` the main process of the container, with `exec` in the script or as the entrypoint, so that the orchestrator's signal reaches the server alone. The capture is the proof: with the signal sent to one process, the request for 3000 tokens finished, `/health` returned 503 during the drain, and the exit code was 0.

Then size the stop. Cap `max_tokens` first, and set the grace period longer than one request at that cap. A five-minute grace period with no output cap still cuts every answer that runs longer than five minutes. For a forced stop in a test environment, set `SGL_FORCE_SHUTDOWN=1`, never only the new name. The gateway retry stays out: a drain finishes the answer on the pod that holds its cache, and a retry starts the answer again from its first token on another pod.

## Wrong turns

- "Raise the grace period to five minutes." The signal reached the scheduler child directly, so the drain never began. No grace period helps a drain that does not start, and a grace period shorter than one answer at the output cap still cuts answers.
- "Retry the broken streams at the gateway." A retry pays for the prompt and the generated tokens a second time on another pod. The drain finishes the answer where it runs.
- "Set SGLANG_FORCE_SHUTDOWN=1 for a fast stop in staging." At this version the watchdog reads SGL_FORCE_SHUTDOWN, so the new name does nothing, and a forced stop skips the drain, which is the incident.
- "The scheduler crashed, so file a bug against the engine." Exit code -15 is a signal, not a fault. The log says who died first and who sent the signal.

## Generalize

A graceful stop is a protocol between one sender and one receiver. Know which process holds the drain, make sure only that process gets the signal, and size the time you give it from the longest work you allow. Then test the stop with a request in flight and read the exit code, because a stop that works on an idle server proves nothing.

## Taught in

The SGLang manual records both stops and the variable name trap in [the shutdown part of the operating page](../../../manuals/sglang-101/sections/7-1-operating-sglang.md#graceful-shutdown-signal-the-main-process-only), and [the SRE for AI lesson](../../../phases/17-infrastructure-and-production/23-sre-for-ai/docs/en.md#runbooks-as-code) gives the runbook shape that turns this reading into a repeatable check.
