---
id: read-the-clock-first
title: Read the GPU clock before the throughput
card: inference-serving
kind: debug
level: 2
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, screen]
tags: [benchmark, thermal-throttle, sm-clock, telemetry, l4]
minutes: 8
lessons: []
manuals: [sglang-101#s-sglang-benchmark-serving, vllm-101#s-speed-up-decode-with-eagle3]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

Your first sweep on an L4 says that CUDA graphs do nothing: at one user the median per-token time is 103.4 ms with graphs and 103.4 ms without, and the three seeds at that cap spread from 10.0 to 14.9 tokens per second, half the median. What do you check before you report that graphs do nothing?

## Short answer

Check the GPU clock and the temperature during the run before you believe either number. The manual's L4 sat at 87 C with software thermal slowdown active and an SM clock of 360 MHz out of 2040 during that sweep, so the server under test was not the cause. A sweep with a cool-down to 72 C and the clock recorded gave 60.16 ms per token at one user against 103.38 hot, and 270.11 against 194.16 tokens per second at a cap of 32: the hot sweep reported up to 28 percent less throughput, with the same command on the same card.

## Full answer

### What the telemetry showed

One driver query during the sweep gave the row: 87 C, 58.36 W of a 72.00 W limit, an SM clock of 360 MHz against a maximum of 2040, the software thermal slowdown bit active, and 100 percent utilization. The L4 is a 72 W card with passive cooling, and the second card in the same chassis ran other work at the same time. The sweep had measured a hot GPU.

### The fix in the method

The sweep script now samples the driver once a second into a file beside each run. Before each run it waits up to 900 s for the GPU to cool below a limit, 65 C by default and 72 C for this chassis. The summary adds the median SM clock, the highest temperature and the share of samples with a thermal slowdown bit to each point. A run under a clock floor is set aside and repeated, up to three times.

The cooled runs are not at full speed either. Their median SM clock was 1,080 to 1,515 MHz of 2,040, and at caps of 1 and 64 the worst seed still had the thermal bit in 41 to 49 percent of its samples. The cool-down removes the worst error, and the recorded clock tells you how much is left.

### Overload heats the card

Under a fixed arrival rate the L4 completed fewer requests the more were offered: 2.01 per second at 4 offered, 1.91 at 8 and 1.62 at 16. The median SM clock fell from 1,320 MHz at 4 offered to 465 MHz at 16, and at 16 the thermal bit was set in 70 percent of the samples. On a passively cooled card overload costs throughput as well as latency. The GB10 showed the same at 16 offered per second: 89 C and 7.3 percent of the samples in thermal slowdown, while its clock stayed at 2,496 MHz up to 4 per second.

### Lock or record

For a comparison of two configs, lock the SM clock with the driver tool, at 900 MHz in the manual's runs, and release the lock after. A lock sets the highest clock and cannot stop the GPU from throttling below it: one run with no speculation fell to 210 MHz under a 900 MHz lock and was set aside. Compare two runs only at the same clock. When the clocks differ by a little, read the ratio between the runs rather than the absolute times, and say the clock in the report.

The manual's position: a benchmark without the clock and the temperature of each run is not evidence.

## Follow-ups

- **Level 2:** Which two columns do you add to every result row? Expected: the median SM clock and the highest temperature or the share of samples with the thermal flag, so that a reader can set aside hot runs.
- **Level 3:** You locked the clock at 900 MHz and one run still reports 210 MHz. How? Expected: a lock sets the highest clock and cannot stop the GPU from throttling below it; set that run aside, repeat it after a cool-down, and compare only runs at the same clock.
- **Level 3:** Under an open-loop overload the card finished fewer requests as you offered more. Why? Expected: the queue grew and the card heated, so the clock fell from 1,320 to 465 MHz and 70 percent of the samples showed thermal slowdown at 16 per second; on a passively cooled card overload costs throughput as well as latency.
- **Level 4:** Your chassis cannot cool the card below 72 C. How do you still compare two configs? Expected: run both in one session and alternate them, record the clock for every run, set aside runs under a floor and repeat them, read ratios between runs at similar clocks rather than absolute times, and print the clock next to every number.

## Wrong answers

- "The GPU shows 100 percent utilization, so it runs at full speed." Utilization says the GPU was busy, not how fast; the same card read 100 percent at 360 MHz of 2040 with the thermal flag active.
- "A spread of half the median between seeds is normal noise." On a cool card the bands were inside about 10 percent of their medians; a spread of half the median is a sign of a changing clock, so read the telemetry.
- "A clock lock makes every run comparable." It caps the clock and cannot stop a throttle; a run under the lock fell to 210 MHz and had to be set aside.
- "Record the clock once at the start of the sweep." The clock fell from 1,320 to 465 MHz across one open-loop sweep as the queue grew; sample it once a second during every run and report the median per run.

## Taught in

[The SGLang benchmark section](../../../manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md) shows the throttled sweep and the telemetry, and [Speed up decode with EAGLE3](../../../manuals/vllm-101/sections/4-1-speed-up-decode-with-eagle3.md) gives the clock lock rule.
