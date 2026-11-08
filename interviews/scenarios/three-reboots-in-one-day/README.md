---
id: three-reboots-in-one-day
title: Three reboots in one day under RL load
card: scenarios
kind: incident
level: 4
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review, system-design]
tags: [reboot, thermal, heat-guard, unified-memory, rl, guardrails]
minutes: 30
lessons: [phases/17-infrastructure-and-production/24-chaos-engineering-llm, phases/17-infrastructure-and-production/23-sre-for-ai]
manuals: [miles-101#s-ref-lab-notes, sglang-101#s-sglang-as-an-rl-rollout-engine]
practice: []
cheatsheet: [sre-for-ai]
related: [scenarios/rl-experiment-hygiene, scenarios/thermal-throttle-voided-ab-test]
updated: 2026-11-03
system:
  version: Miles main 08752a12 with its own SGLang 0.5.22 build
  model: Qwen/Qwen3-0.6B
  hardware: one GB10 with 128 GB of unified memory, a desktop machine under a 48-step RL run
source:
  - manuals/sglang-101/capture/gpu/incidents/gb10-boot-list.txt
  - manuals/sglang-101/sections/7-2-sglang-as-an-rl-rollout-engine.md
  - manuals/miles-101/capture/gpu/heat-guard.sh
  - manuals/miles-101/capture/gpu/out-gb10/thermostat.log
  - manuals/miles-101/sections/r-3-lab-notes.md
---

## Situation

A research team runs a 48-step GRPO run of `Qwen/Qwen3-0.6B` on a desktop machine with one GB10. On 2026-10-18 the machine reboots three times. The run dies with it each time, and so does every other job on the machine. The boot list shows that the three boots lasted 13, 26 and 74 minutes. The journal has no panic, no out-of-memory kill and no error line before any of the three ends. The team wants a cause and a fix before they start the next two seeds.

Two proposals are on the table. One says the engine ran out of memory and asks for a lower engine memory fraction. The other says the machine is unfit for RL and asks for a cloud GPU. You have the boot list, a guard script that someone wrote that morning, its log, and the lab notes of the manual.

## Evidence

- [the boot list of the machine, read four days later](evidence/the-boot-list.txt)
- [what the manual records about the load of that day and the guard](evidence/what-ran-that-day.txt)
- [the loop of the heat guard](evidence/the-guard-loop.txt)
- [the first pauses and the rule change](evidence/the-first-hour-of-the-guard.txt)
- [the guard four days later](evidence/a-later-afternoon.txt)
- [the heat guard and the pause count in the lab notes](evidence/the-pause-count.txt)

## Questions

1. Read the boot list. What do the three short boots have in common, and what does the last boot of that day show?
2. The journal gives no cause. Name the candidate causes for a machine that stops without a log line, and say which ones the evidence rules out.
3. Read the guard loop. What does it watch, what does it do, and what are its two timers for?
4. The guard paused the container 1,005 times. What does that do to every measurement from those runs, and which numbers survive?
5. The chaos lesson asks for a safety plane with a kill switch and blast-radius limits. Where does this guard sit in that design, and what does it lack?
6. You must state the cause in the postmortem. What can you write, and what must you not write?

## Walkthrough

1. **Read the boots.** The boots of the two days before ran through the whole working day. On the day of the incident the machine came up at 04:22 and was gone within a quarter of an hour, came up at 04:44 and lasted half an hour, came up at 07:52 and lasted a bit over an hour. The boot that began at 10:44 ran until 03:00 the next morning, and the boot of 2026-10-21 ran into the next day. Every short boot ended without a shutdown record. The guard log begins at 10:57 on that same morning, inside the first boot that lasted.
2. **Rule out what you can.** Four causes stop a whole machine and can leave the journal silent: a kernel panic, a memory kill, a power event and a thermal shutdown. A panic leaves a trace in the journal, and there is none. A memory kill on this machine is a logged event that stops one process: Ray writes the node memory line and kills a worker, and the machine stays up, as the Ray out-of-memory scenario shows. That rules out the proposal to lower the memory fraction of the engine, because the symptom does not match. Power and heat remain, and the evidence cannot separate them directly, because nobody recorded the GPU temperature at the moment of any stop. What the evidence can show is what happened once the heat was held down.
3. **Read the guard.** Every 5 s the script reads the GPU temperature. When a Miles container is running and the temperature is at or above 84, it pauses the container and notes the time. While paused, it resumes when the temperature is at or below 74 and at least 45 s have passed, or after 120 s no matter what. If the container is gone, it forgets it, and on exit it resumes whatever it paused, so no run stays frozen. The two timers are a floor and a ceiling: the floor gives the GPU time to cool, and the ceiling bounds the cost of any one pause.
4. **Read the first hour.** The first rule was 80 and 68. The log shows a pause at 80 C and a resume at 68 C fifteen seconds later, then pause after pause within a minute. The team changed the rule by hand twice that morning, and from 11:27 it ran at 84 and 74. Four days later the pattern is steady: pause at 84 or 85 C, resume at 72 or 73 C after 45 s, about once a minute under load. The lab notes count 1,005 pauses up to 2026-10-22.
5. **Read what the pauses cost.** Over the 9.3 hours of seeds 2 and 3, the container was paused for about 58 percent of the time. A pause stops the process and does not change its arithmetic, so the manual reads the reward, the answer lengths, the share of cut answers and the log-probability gap as valid, and says that it did not test this with a paused and an unpaused run of the same seed. The rollout times are not valid, and the manual does not report them for those seeds. Every wall-clock number from a guarded run needs the clean-step rule of the lab notes: time only steps that overlap no pause, and compare step numbers.
6. **Place the guard in the safety plane.** The chaos lesson names a safety plane of kill switch, suppression windows, blast-radius limits and error-budget gates. The guard is a blast-radius limit on one container, with a resume-on-exit that acts as a kill switch for the guard itself. It lacks an alert, a temperature log of its own beyond the pause and resume lines, a bound on the total paused share of a run, and a test that the pause leaves results unchanged. It is a mitigation, not a diagnosis.
7. **Write the postmortem.** The honest statement is that the machine stopped three times under sustained RL load with no cause in the journal, that a guard which holds the GPU at or under 84 C was running during every later boot, and that no stop recurred under it. That is a correlation with a plausible mechanism. The sentence "thermal shutdown confirmed" needs a temperature reading across a stop or a hardware event log, and neither exists.

## Resolution

The cause is not recorded, and the postmortem says so. The mitigation is a guard that treats the machine's heat as a budget: pause the container at 84 C, resume at 74 C after at least 45 s, and never hold one pause longer than 120 s. With the guard on, the boot that began at 10:44 on 2026-10-18 ran until 03:00 the next day, the boot of 2026-10-21 ran into 2026-10-22 while the guard logged pauses through the afternoon, and the machine did not stop again across 1,005 pauses. The cost is measured too: 58 percent of the wall-clock time of seeds 2 and 3 was spent paused, so their rollout times are not reported, and every later timing follows the clean-step rule.

The memory proposal is declined, because a memory kill is a logged event that stops a process and leaves the machine up. The cloud proposal is deferred, because the machine held for four days under the guard. The next steps are the ones that would turn the correlation into a cause: record the GPU temperature once a second to a file that survives a reboot, read the hardware event log after any stop, and run the same load once without the guard on a day when a stop costs nothing.

## Wrong turns

- "Lower the engine memory fraction, it must be out of memory." A memory kill writes a line and stops a process, and the journal has none while the whole machine stopped. A lower fraction also shrinks the pool for every rollout.
- "The journal is empty, so it was power, call facilities." Not excluded, and worth a check. But the stops came under sustained load on one day and did not recur once the GPU was held at or under 84 C. Record the correlation and keep both candidates open.
- "Set the guard to 80 C to be safe." The first rule ran at 80 and 68, and the log shows a pause every minute. The team raised it to 84 and 74 that morning. A tighter limit buys more pauses, and every pause enters a step time.
- "Keep the guard and trust the step times." Seeds 2 and 3 spent 58 percent of their time paused. Time only steps that overlap no pause, and compare step numbers, as the lab notes do.
- "Call it a thermal shutdown in the postmortem." No temperature was recorded at the moment of any stop. Write what was seen: three stops without a cause, and no stop since the guard.

## Generalize

When a machine stops without a log line, the honest postmortem names the candidates, the evidence that rules each one out, and the mitigation you applied with its cost. A guard that keeps a resource under a limit is a safety plane for one container: it buys uptime with wall-clock time, so the measurement rules change on the day you turn it on, and the postmortem says "did not recur under the guard", never "cause found".

## Taught in

The Miles lab notes give the guard and the clean-step rule in [the heat guard section](../../../manuals/miles-101/sections/r-3-lab-notes.md#the-heat-guard), the SGLang manual records the three shutdowns and the paused share in [the two more seeds part of the rollout engine page](../../../manuals/sglang-101/sections/7-2-sglang-as-an-rl-rollout-engine.md#two-more-seeds), and [the chaos engineering lesson](../../../phases/17-infrastructure-and-production/24-chaos-engineering-llm/docs/en.md#guardrails-are-mandatory) and [the SRE for AI lesson](../../../phases/17-infrastructure-and-production/23-sre-for-ai/docs/en.md#runbooks-as-code) give the safety plane and the runbook shape.
