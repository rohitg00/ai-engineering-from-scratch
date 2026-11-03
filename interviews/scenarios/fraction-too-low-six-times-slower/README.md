---
id: fraction-too-low-six-times-slower
title: An engine share of 0.02 and a rollout six times slower
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [rl, kv-pool, mem-fraction-static, rollout-time, miles]
minutes: 20
lessons: []
manuals: [miles-101#s-troubleshoot-by-symptom, miles-101#s-stop-ray-killing-the-job, miles-101#s-read-your-first-ten-steps, miles-101#s-ref-lab-notes, sglang-101#s-mem-fraction-static-and-startup-sizing]
practice: []
cheatsheet: []
related: [scenarios/ray-oom-unified-memory]
updated: 2026-11-03
system:
  version: Miles main 08752a12 with its own SGLang 0.5.22 build
  model: Qwen/Qwen3-0.6B
  hardware: one GB10 with 128 GB of unified memory
source:
  - manuals/miles-101/capture/gpu/out-gb10/frac-low-kv.txt
  - manuals/miles-101/sections/7-1-troubleshoot-by-symptom.md
  - manuals/miles-101/sections/2-3-stop-ray-killing-the-job.md
  - manuals/miles-101/sections/r-3-lab-notes.md
  - manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md
---

## Situation

A team trains with GRPO on one GB10. The week before, a larger model was stopped by a memory kill, and the team learned to fear the node total. Someone sets the engine memory share, `--sglang-mem-fraction-static`, to 0.02 for the next runs, to leave the trainer as much room as possible. The launcher default is 0.4.

The next morning a one-step check run has finished, with a reward in the usual range. The step took far longer than the day before. Nobody saw an error. One engineer blames the heat guard, another blames a slow disk, and a third says the engine must have fallen back to a slow kernel. You get the log of the check run, the log of the same check at 0.25, and the log of a normal run at 0.4.

## Evidence

- [the pool size, the rollout time and the reward of three runs](evidence/three-runs.txt)
- [the KV cache line of the slow run at startup](evidence/engine-pool-line.txt)
- [the one flag that differed between the runs](evidence/what-each-run-set.txt)
- [the default run settings of the manual](evidence/default-run-settings.txt)
- [how the engine turns the fraction into a pool](evidence/how-the-split-works.txt)
- [the troubleshooting entry for the engine memory fraction](evidence/manual-entry.txt)

## Questions

1. Three rollout times, three pool sizes. Which number moved with the time, and which did not?
2. The reward of the slow run is normal. Why does that not clear the run?
3. The KV cache line prints before the first step. What in it tells you the step will be slow, and how slow is the GPU?
4. Count the sequences that one step must generate and the longest answer. What can a pool of this size hold at once?
5. Which direction do you change the share, by how much per try, and what do you read after each try?
6. The engine did not run out of memory and did not crash. Why is the low direction of this flag harder to notice than the high direction?

## Walkthrough

1. **Line up the three runs.** Read `perf/rollout_time` on each line. The run with the low share took 386 s for one rollout. The run at 0.25 took 61 s, and the normal run at 0.4 took about a minute as well. The rewards were 0.61328125, 0.66015625 and 0.625. The reward did not follow the setting. The time did, by about six times.
2. **Read the pool sizes on the same lines.** The slow run had `max_total_num_tokens=3082`. The other two had 211,813 and 347,841. The pool is the number of tokens that the engine can hold in its KV cache at one time. The rollout time moved with the pool, and nothing else in the three lines differed.
3. **Read the engine line that came first.** At startup the slow engine printed `KV Cache is allocated` with 3082 tokens, and a K size and a V size of 0.16 GB each. This line appears before any step runs. A reader who knows the normal value for the machine sees the problem here, minutes before the first slow step ends.
4. **Count the work of one step.** The manual's defaults are 32 prompts per step, 8 answers per prompt and an answer limit of 1,024 tokens. One step generates 256 answers. A pool of 3082 tokens holds three answers at the length limit at once, and fewer with their prompts. The engine must run the step as a long series of small batches. Nothing is broken. The GPU is almost idle while it waits for room.
5. **Follow the flag to the pool.** The share names the memory for the model weights plus the KV pool together. After the weights load, the engine measures free memory again and gives the pool what is left of the share. At 0.02 of the memory, the weights of even a small model take most of the share, and the pool gets the remainder.
6. **Use the manual's entry.** The troubleshooting page lists both failures of this flag. A share that is too high leaves no room for activations and CUDA graphs, so CUDA reports that it is out of memory. A share that is too low does not always stop the engine, so the check is to read `#tokens` in the KV cache line. The fix for the low case is to raise the share by 0.05 or 0.1 at a time.

## Resolution

The engine share of 0.02 left a pool of 3082 tokens, and the rollout of one step took 386 s against 61 s at 0.25 and about a minute at the default of 0.4. The reward stayed in range because the answers were the same work, only in many more rounds. The fix is to put the share back to 0.4, or to 0.25 when the trainer needs more room, and never below the point where the pool stops holding a full step.

The proving measurement is the pair of numbers at startup and after the first step: the `#tokens` in the KV cache line and `perf/rollout_time`. At 0.25 the pool held 211,813 tokens and the rollout took 61 s. Record both for every new setting of the flag, and change the share by 0.05 or 0.1 at a time. The memory kill of the week before was a trainer problem, and a smaller engine share did not prevent it, as the Ray incident shows.

## Wrong turns

- "The reward is fine, so the run is fine." The reward measures what the model learned, not what the step cost. At six times the rollout time, the same training takes six times the GPU hours.
- "The heat guard paused the run." A pause adds wall-clock time to a step, but the pool line of 3082 tokens explains the time without any pause, and the run at 0.25 on the same day took 61 s.
- "Raise the number of running requests." The engine admits requests only while the pool has room for their tokens. With 3082 tokens the pool, not the request cap, sets the batch.
- "Lower the share further, the trainer is what matters." The trainer kill of the week before happened at 0.4 and again at 0.2, so the share was not the cause there. Below 0.25 the trainer gains little and the rollout loses a lot.

## Generalize

A setting can be wrong in both directions, and the two failures look different. Too much memory for one component crashes it, which everyone sees. Too little makes it slow, which nobody sees until the bill arrives. Know the normal value of the sizing line that each component prints at startup, read it before the first step, and when you change a share, move it in small steps and record the size and the time together.

## Taught in

The Miles manual names the two ways an engine share goes wrong in [its symptom table](../../../manuals/miles-101/sections/7-1-troubleshoot-by-symptom.md), shows that a smaller share did not save the trainer in [the Ray page](../../../manuals/miles-101/sections/2-3-stop-ray-killing-the-job.md), gives the run defaults in [the lab notes](../../../manuals/miles-101/sections/r-3-lab-notes.md), and the SGLang manual explains how the share becomes a pool in [its memory sizing page](../../../manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md).
