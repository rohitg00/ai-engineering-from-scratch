---
id: memory-guard-paused-the-scheduler
title: A memory guard paused the scheduler mid-start
card: scenarios
kind: incident
level: 4
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review]
tags: [unified-memory, gb10, kv-pool, memory-guard, startup, alerting]
minutes: 30
lessons: []
manuals: [sglang-101#s-mem-fraction-static-and-startup-sizing, sglang-101#s-ref-incident-index]
practice: []
cheatsheet: []
related: [scenarios/cold-start-on-gb10, scenarios/ray-oom-unified-memory]
updated: 2026-11-03
system:
  version: SGLang 0.5.22
  model: Qwen/Qwen3-30B-A3B-Instruct-2507
  hardware: one GB10 with unified memory, a desktop that other users share
source:
  - manuals/sglang-101/capture/gpu/incidents/gb10-memory-guard-pauses.txt
  - manuals/sglang-101/capture/gpu/incidents/gb10-driver-no-memory.txt
  - manuals/sglang-101/capture/gpu/out-gb10/server-default.log
  - manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md
  - manuals/sglang-101/sections/r-3-incident-index.md
---

## Situation

A team gets time on a GB10 desktop that several people share, and starts an SGLang server for `Qwen/Qwen3-30B-A3B-Instruct-2507`. Three starts in one afternoon stall after the weights load. The server log stops, the scheduler process is alive but does nothing for a while, then the log continues as if nothing happened. Nobody sees an error.

That afternoon the on-call channel also gets pages from a kernel-log alert. Nine bursts of an NVIDIA driver line that says `Out of memory` arrive between 13:52 and 16:46, up to 13 lines in one minute. The team puts the two things together: the driver is faulty, and the server leaks memory until the driver fails. They ask to move the model to a smaller, dedicated card. The owner of the desktop asks you to review before anyone changes hardware.

## Evidence

- [the guard log around the first pause](evidence/first-pause.txt)
- [two more pauses in the next hour](evidence/two-more-pauses.txt)
- [the weights and the pool of a default start that was kept](evidence/the-pool-size.txt)
- [the driver line in the kernel log, counted by minute](evidence/driver-bursts.txt)
- [what the manual can and cannot say about the three pauses](evidence/what-is-not-proven.txt)
- [the driver bursts and the position of the manual](evidence/alert-on-health.txt)
- [how to start on a shared machine with unified memory](evidence/the-container-rule.txt)

## Questions

1. The scheduler stopped and later continued, and the server log shows no error. Which process stopped it, and on what rule?
2. The guard saw one process grow by tens of GiB in five seconds. Which allocation is that likely to be, and how do you check it against a start whose log was kept?
3. The three pauses report different growth. What can you conclude from the guard log alone, and what can you not?
4. Nine bursts of the driver line fell on one day. What does the manual claim about them, and what would it take to tie one burst to one start?
5. Which alert do you keep and which do you remove, and what is the start procedure for this machine from now on?

## Walkthrough

1. **Read the guard log first.** The desktop runs a memory guard daemon for its other users. It stops the process that grows fastest when free memory gets low. Its first entry reads `Critical: 34.2 GiB left before the freeze zone`, and the same second it paused `sglang::schedul` because it grew 36.7 GiB in 5s. Eight seconds later the guard logged `Back to normal: 28.9 GiB available`. The scheduler was the fastest-growing process on the machine, so the guard was correct by its own rule. That is the stall the team saw, and no server log records it, because the server was not told anything.
2. **Match the growth against a kept start.** The default start that the manual kept shows what the scheduler allocates right after the weights: a KV pool that holds 227,243 tokens, with 10.40 GB for K and 10.40 GB for V, allocated in a few seconds, with 54.84 GB free before and 31.22 GB free after. The manual reads the 36.7 GiB as the size of a KV pool allocation. It also notes a field report of 25 to 40 GB of short-lived allocations outside the fraction, from the autotuner and the graph capture, and says plainly that the guard log does not separate the pool from those. So the growth is the startup allocation of a server on unified memory, and its exact split is not proven.
3. **Read the other two pauses with the same care.** They report 9.4 GiB and 28.1 GiB of growth, and each time the guard reported normal within seconds. The server logs of those three starts were not kept, so nobody can say which allocation each pause caught. The manual's table of six kept starts shows why a single number would mislead anyway: the same weights measured between 54.78 and 57.92 GB, and the pools ran from 216,775 to 258,017 tokens, because the kernel's file cache changed during each load. What the guard log does prove is a process that grows by tens of GiB in seconds and then stops growing. A leak would keep the guard busy after the pool line, and no entry shows that.
4. **Read the driver bursts as a count, not a verdict.** The kernel line is `NV_ERR_NO_MEMORY` from the driver's allocator. The bursts are dated 2026-10-16, the day of the first test and sweep starts, with 3 to 13 lines per minute. The manual kept no server logs from that day, so it cannot match a burst to a start and refuses to. What it can say is that every server in its later captures became healthy and finished its benchmarks. To tie a burst to a start you would need the server log with timestamps and the free-memory log of the machine for the same minute.
5. **Turn the reading into a procedure.** The manual's position for a shared GB10 has four steps: start SGLang in a container with a memory limit, start below the fraction of 0.7 that its kit used, log the free memory of the machine once a second during startup, and raise the fraction only after you saw the peak. Add two more from the same page: pass `--mem-fraction-static` on purpose, and tell the other users of the machine before you start. For the guard, the manual agreed with the owner to stop it for the time of its runs. On the alert, the position is one sentence: do not alert on the driver line alone, alert when a server does not become healthy.

## Resolution

As far as the evidence shows, the server did not leak and the driver was not faulty. A guard that watches the whole machine paused the scheduler while it allocated its pool, three times, and resumed it each time within seconds. The driver bursts fell on the same day, and the captures hold no link from any burst to a failed start or to a user who saw an error.

The team kept the model on the GB10 and changed how it starts: an explicit fraction, a container with a memory cap, a free-memory log during startup, and an agreement with the owner about the guard while the server runs. The kernel-line page was replaced with a health alert on the server's ready line and its health endpoint, which in the kept start returned 503 before the ready line and 200 after it. The measurement that supports the change is the set of later starts, which reached their pool lines and ran their benchmarks with no pause and no page.

Two things stay open, and the write-up says so. No capture ties a driver burst to a start, and the field report of allocations outside the fraction is from before this version and was not measured here.

## Wrong turns

- "The server leaks memory until the driver fails." The guard logged normal within seconds of each pause, and no entry shows growth after the pool was in place. A pool of tens of GB allocated in seconds is the design, not a leak.
- "Replace the driver." The bursts carry no user-visible failure in the captures, and every later server became healthy. A line in the kernel log is not an incident until a user or a probe sees one.
- "Raise the fraction, so the pool is allocated once and the guard stops complaining." The fraction sets the pool size. A larger pool grows faster and leaves less for the other users. Lower it, cap the container, and watch the peak.
- "Match each burst to a start from the timestamps." Without the server logs of that day the match is a guess, and the manual refused to make it. Keep the logs that let you correlate before you correlate.
- "Move to a smaller dedicated card." That trades a shared machine for a smaller pool and gives up the result that the GB10 served every later run. Fix the start procedure first, then decide.

## Generalize

On unified memory, a KV pool is memory that the whole machine gives up in a few seconds, and every guard, daemon and user on that machine sees it go. Treat the start of a server as an event that you announce, cap and log, not as something that happens inside one process. When an alert fires, ask what it measured and who was harmed. Keep the logs that let you connect an event to a cause, and when they are missing, write down that the connection is not proven instead of asserting it.

## Taught in

The memory page of SGLang 101 records the pauses and the driver bursts in [a pool that other programs see](../../../manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md#a-pool-that-other-programs-see) and gives the start procedure in [memory outside the fraction](../../../manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md#memory-outside-the-fraction), and [the incident index](../../../manuals/sglang-101/sections/r-3-incident-index.md#our-capture) lists both with their status.
