---
id: alert-on-the-driver-line
title: An alert on a driver line that paged nine times
card: scenarios
kind: incident
level: 3
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review]
tags: [alerting, kernel-log, unified-memory, health, on-call, sre]
minutes: 25
lessons: [phases/17-infrastructure-and-production/23-sre-for-ai]
manuals: [sglang-101#s-mem-fraction-static-and-startup-sizing, sglang-101#s-ref-incident-index, sglang-101#s-operating-sglang]
practice: []
cheatsheet: [sre-for-ai]
related: [scenarios/health-probes-add-load, scenarios/cold-start-on-gb10]
updated: 2026-11-03
system:
  version: SGLang 0.5.22
  model: Qwen/Qwen3-30B-A3B-Instruct-2507
  hardware: one GB10 with 121.7 GiB of unified memory, shared with other users
source:
  - manuals/sglang-101/capture/gpu/incidents/gb10-driver-no-memory.txt
  - manuals/sglang-101/capture/gpu/out-gb10/server-default.log
  - manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md
  - manuals/sglang-101/sections/r-3-incident-index.md
  - manuals/sglang-101/sections/7-1-operating-sglang.md
---

## Situation

A platform team runs SGLang on desktop machines with unified memory, which several teams share. After a memory incident elsewhere, they add an alert rule to the kernel log: page on-call whenever the GPU driver logs `NV_ERR_NO_MEMORY`. On the first afternoon the rule pages nine times between 13:52 and 16:46. Each page is a burst of 3 to 13 identical lines inside one minute, then silence.

On-call finds no user complaint, no failed request and every server healthy. The team proposes to keep the rule and raise its threshold so that only a long burst pages. You review the alert design before the next on-call week, with the burst table, the server log of one start on that machine and the manual.

## Evidence

- [the kernel log bursts that the alert rule matched, by minute](evidence/the-alert-feed.txt)
- [a server start on the same machine: the probe before and after the ready line](evidence/a-server-that-became-healthy.txt)
- [the weights and the pool of one start on unified memory](evidence/the-startup-memory-moves.txt)
- [what the manual says about the driver line and what it could not match](evidence/what-the-manual-could-match.txt)
- [the row of the incident index for this line](evidence/the-incident-index-row.txt)

## Questions

1. Read the burst table. What pattern do the timestamps and the counts show, and what does a server do at those moments?
2. The server log shows a 503 and then a 200 on the health route. Which signal did on-call need, and did the rule carry it?
3. The manual could not match each burst to one start. Why not, and what does that say about the evidence you keep?
4. Design the alert: which signal pages a person, which signal is a diagnostic, and where does the driver line go?
5. Which runbook turns this page into a five-minute check instead of an investigation?

## Walkthrough

1. **Read the shape of the bursts.** Nine minutes carry lines, over about three hours of 2026-10-16, and every burst sits inside a single minute. The manual dates them: that was the day of the first test and sweep starts on that machine. A server start on unified memory is a burst of allocation. In the startup listing the weights settle at 57.75 GB, and three seconds later the pool takes 10.40 GB for keys and 10.40 GB for values. The manual's position is that every other program on the machine sees that memory go. The driver line is something the machine prints around a start, and the rule paged on starts.
2. **Read the signal that matters.** In the server log the first health probe returns 503 at 14:19:12, because the server is still starting. Two seconds later the ready line prints, and the probe at 14:19:15 returns 200. That transition answers the on-call question: did the server come up and serve? The driver line answers nothing about that. It fires on an allocation whether the start succeeds or fails, so it carries no health information at all.
3. **Read what could not be matched.** The manual says the server logs of that day were not kept, so no burst can be matched to one start, and that every server in the later captures became healthy and finished its benchmarks. The incident index records the same status and the same rule: alert on health, not on this line. The evidence lesson sits inside that sentence. A kernel line without the server log of the same minute is a clue with no suspect. Keep both logs, with timestamps, or you cannot say which process caused which line.
4. **Design the alert.** Page on a server that does not reach its ready line inside its start budget, and on a server that stops answering its readiness probe after it was ready. Page on a queue that grows for longer than the users accept. Turn the driver line into a counter on the dashboard, attached to a page as context and never a page on its own. On a shared machine of this kind the manual adds two more measures: run the server in a container with a memory limit, and log the free memory of the machine once a second during startup, so that the next burst comes with the number that explains it.
5. **Write the runbook.** The SRE lesson gives the shape: symptom, hypothesis, verify, act. Symptom: a burst of the driver line. Hypothesis: a server allocated its pool in that minute. Verify: find a start in the server log within the same minute, and read the health transition after its ready line. Act: nothing if the server became healthy; if a start failed, the startup page of the manual takes over. With the logs kept, this is a five-minute check.

## Resolution

The rule measured allocations, not failures. It paged on every start of a healthy server, nine times in one afternoon, and gave on-call nothing to act on. The rule is retired as a pager and kept as a diagnostic counter. The pages that replace it are the health transitions: a start that does not reach its ready line in its budget, and a ready server whose probe fails. On the days with server logs, every start on that machine reached its ready line, so the health rule pages zero times where the driver rule paged on every start.

Two changes to the evidence come with it. The kernel log and the server log of each machine are kept together, so that a future burst can be matched to a process. During startup the machine's free memory is logged once a second, which puts the allocation that the driver line reports next to the pool size the server prints. The threshold proposal is dropped, because a higher threshold silences a rule that was never a signal.

## Wrong turns

- "Raise the threshold so that only a long burst pages." The bursts were 3 to 13 lines. A threshold above them silences the rule on a day like this one, and on a worse day it still says nothing about whether a server serves.
- "Lower the memory fraction until the driver stops complaining." Nobody matched a burst to a start, so nobody knows that a smaller pool removes the line, and a smaller pool costs users at every load. Set the fraction on purpose for the shared machine, for its own reason.
- "Keep the page, a driver error is always serious." Every server in the later captures became healthy. A page with no action teaches on-call to ignore pages.
- "Drop the line from the log pipeline." Keep it as a diagnostic next to the health signal. It dates an allocation, and with the server logs kept it names the process.

## Generalize

Alert on the symptom a user would feel, and keep the mechanism lines as diagnostics. A line that fires on normal work pages you on every success. Before a rule pages a person, replay it against a known-good day, and keep the logs that let you match each firing to a cause.

## Taught in

The SGLang manual records the bursts and sets the rule in [the shared-pool part of the memory page](../../../manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md#a-pool-that-other-programs-see), lists the status in [the incident index](../../../manuals/sglang-101/sections/r-3-incident-index.md), names the health endpoints in [the operating page](../../../manuals/sglang-101/sections/7-1-operating-sglang.md), and [the SRE for AI lesson](../../../phases/17-infrastructure-and-production/23-sre-for-ai/docs/en.md#runbooks-as-code) gives the runbook shape.
