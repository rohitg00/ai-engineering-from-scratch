---
id: ray-oom-unified-memory
title: Ray stops the trainer on unified memory
card: scenarios
kind: incident
level: 3
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [rl, ray, unified-memory, gb10, oom, miles]
minutes: 20
lessons: []
manuals: [miles-101#s-stop-ray-killing-the-job, miles-101#s-memory-on-unified-memory, miles-101#s-pick-a-model-size, vllm-101#s-size-memory-on-a-dgx-spark]
practice: []
cheatsheet: []
related: [scenarios/dead-engine-and-watchdog]
updated: 2026-11-03
system:
  version: Miles main 08752a12 with its own SGLang 0.5.22 build
  model: Qwen/Qwen3-4B
  hardware: one GB10 with 128 GB of unified memory
source:
  - manuals/miles-101/capture/gpu/out-gb10/ray-oom-4b-timing.txt
  - manuals/miles-101/capture/gpu/out-gb10/ray-oom-4b.log
  - manuals/miles-101/capture/gpu/out-gb10/ray-oom-4b-lowmem.log
  - manuals/miles-101/capture/gpu/out-gb10/frac-low-kv.txt
  - manuals/miles-101/sections/2-1-pick-a-model-size.md
  - manuals/miles-101/sections/2-3-stop-ray-killing-the-job.md
---

## Situation

A team trains with GRPO on one GB10. Their runs with a 0.6B model work, so they move to `Qwen/Qwen3-4B` for better rewards. The run starts, loads the trainer, loads the engine, and finishes its first rollout. Then it stops in the training phase of that same step, about 15 minutes after the start. The log has no CUDA out-of-memory error.

The on-call engineer finds a Ray message that names the node, not a GPU, and lists three processes. The plan on the ticket has two steps: raise the Ray memory threshold, and give the engine a smaller memory fraction so the trainer gets more room. A second run with the fraction at 0.2 dies the same way.

## Evidence

- [three timestamps from the log of the failed run](evidence/run-timeline.txt)
- [the Ray message that stopped the trainer](evidence/ray-kill.txt)
- [the same run with the engine memory share lowered from 0.4 to 0.2](evidence/smaller-engine-share.txt)
- [the trainer state estimate by model size, and what happened on the GB10](evidence/estimate-table.txt)
- [what a very small engine share did to the pool and the rollout time](evidence/engine-share-cost.txt)

## Questions

1. The log has no CUDA out-of-memory error. Read the kill line: which component stopped the trainer, what did it measure, and on what?
2. The three listed processes hold far less than the node total. Where is the rest, and why can a process list not show it?
3. The second run lowered the engine's share from 0.4 to 0.2 and died at a higher node total. What does that tell you about where the memory went?
4. Raising the Ray threshold is a common fix on a machine with a separate GPU. Why is it the wrong fix here?
5. Estimate the trainer state of a 4B model with mixed precision and an Adam optimizer, and pick the largest model that fits this machine.
6. What does a very small engine share cost, and which line in the engine log tells you before the run starts?

## Walkthrough

The timeline gives the shape. The launcher started at 05:58, the trainer logged `rollout 0` about six minutes later, and the fault-tolerance line reported `phase=fail` for the train function after 629.7 s. So the engine generated a full step of answers, and the trainer died while it trained on them. That is the phase that holds the most memory.

The second listing is a Ray memory kill, not a CUDA error. Ray's memory monitor measured the whole node and read 115.86 GB of 121.69 GB in use, which the message itself gives as 0.952127. The table under it gives 36.77 GB for the trainer, 2.73 GB for the engine scheduler and 1.33 GB for the rollout executor. The rest of the memory in use is not in the process list. On a GB10 the CPU and the GPU use one pool of memory, so the GPU allocations, the model weights, the optimizer state and the KV cache, count in the number that Ray watches. A process list shows the host side of each process and cannot show that part.

The third listing is the second run. With the engine share at 0.2 the node reached 119.18 GB before the kill, higher than before, and the trainer process held 36.75 GB, almost the same as the 36.77 GB of the first run. A smaller engine share made no room, because the trainer side is what does not fit.

The estimate table says why. Full fine-tuning with Adam and mixed precision keeps about 16 bytes for each parameter. That gives about 10 GB for the 0.6B model, about 27 GB for 1.7B and about 64 GB for 4B. The 4B estimate alone is half the machine, and activations, the engine and the process overhead come on top. On this GB10 the 1.7B model fit for 4 steps with answers cut at 256 tokens, and the 4B model was stopped by Ray in the first step, twice.

The last listing shows the cost of the other direction. With the engine share at 0.02 the pool held 3,082 tokens against 211,813 at 0.25, and the rollout of one step took about six times longer. A tiny engine share starves the rollout and buys nothing for a trainer that still does not fit.

## Resolution

The kill was real memory pressure, not a false alarm. On unified memory the number that Ray reads includes the GPU allocations, so a kill at 95.2 percent means the machine is close to full for every process on it.

Change the run, not the watcher. Use a smaller model: on this machine the recipe fits 1.7B at most, and the team should test it at their real answer length for 4 steps while they read node memory with `free -g`. If they must train the 4B model, they need more GPUs or a recipe that keeps less optimizer state, such as LoRA on the Megatron trainer, which we did not test. Leave `RAY_memory_usage_threshold` at its default. Keep the engine share at the launcher default or near 0.25, because 0.2 did not prevent the kill and a very small share made the rollout several times slower.

## Wrong turns

- "Raise the Ray threshold." The threshold lets the node get closer to full. If it does run out, the operating system stops any process on the machine, and that stop leaves no Ray message to read.
- "Lower the engine fraction to make room for the trainer." The second run did that and died at 119.18 GB with the trainer at 36.75 GB. The engine was not the part that did not fit.
- "It is a CUDA out of memory, so lower the engine batch." The log has no CUDA error, and the engine scheduler held 2.73 GB. The kill came from node memory.
- "Set the Ray refresh to zero so the monitor stops killing." The log names that variable, and it only removes the warning. The operating system then stops whichever process it chooses, with no message.

## Generalize

On a machine where the CPU and the GPU share one memory, every tool that reads host memory also reads the GPU allocations, and every tool that reads GPU memory reads a number without a hard limit. Read a memory kill from such a tool as a true shortage, estimate the largest consumer from first principles before you start, and make the run smaller rather than the monitor quieter.

## Taught in

The Miles manual reads the kill in [the Ray page](../../../manuals/miles-101/sections/2-3-stop-ray-killing-the-job.md), explains the one pool in [the unified memory page](../../../manuals/miles-101/sections/8-4-memory-on-unified-memory.md) and sizes the model in [the model size page](../../../manuals/miles-101/sections/2-1-pick-a-model-size.md), and the vLLM manual shows the same memory rule for serving in [its DGX Spark page](../../../manuals/vllm-101/sections/2-3-size-memory-on-a-dgx-spark.md).
