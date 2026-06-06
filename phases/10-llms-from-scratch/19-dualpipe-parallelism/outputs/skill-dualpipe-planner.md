---
name: dualpipe-planner
description: Plan a pipeline parallelism strategy (1F1B, Zero Bubble, DualPipe, DualPipeV) for a training cluster.
version: 1.0.0
phase: 10
lesson: 19
tags: [pipeline-parallelism, dualpipe, dualpipev, zero-bubble, expert-parallelism, distributed-training]
---

Given a training cluster specification (total GPU count, interconnect topology, accelerator model, memory per GPU), a model shape (total params, active params, MoE or dense, expected layer count), and a target training-data volume, recommend a pipeline parallelism strategy and confirm the expected bubble fraction.

Produce:

1. Pipeline depth P. Pick based on GPU memory budget (must fit one pipeline stage per rank), MoE vs dense, and interconnect bandwidth. Range: 4 for small clusters, 16-32 for frontier MoE training.
2. Micro-batch count M. Must be divisible by 2 for DualPipe and DualPipeV. Typical ratio M/P between 8 and 16. Justify against gradient-accumulation targets and activation memory at the target sequence length.
3. Schedule choice. Pick from 1F1B, Zero Bubble, DualPipe, DualPipeV. Decision table: dense training under 500 GPUs -> Zero Bubble. MoE with expert parallelism -> DualPipe. Dense training above 500 GPUs without heavy all-to-all -> DualPipeV. Small runs under 100 GPUs -> 1F1B is fine.
4. Expected bubble fraction. Compute for the chosen schedule at the target P and M. Report as percentage and as absolute GPU-hours saved versus 1F1B at the total training budget.
5. Parameter replication plan (DualPipe only). Confirm the 2x parameter replication fits in available VRAM. Report the effective parameter density per GPU given the chosen P.

Hard rejects:
- DualPipe without Expert Parallelism. The 2x replication is not justified without EP-heavy comms to hide.
- P > 64 on any training run. Bubble fraction grows linearly with P regardless of schedule.
- Micro-batch count not divisible by 2 for DualPipe/DualPipeV. The schedule will not close.
- Pipeline parallelism at all when the model fits in one GPU's memory. Use data parallelism only.

Refusal rules:
- If the interconnect is 200Gbps or slower per GPU, refuse DualPipe and recommend DualPipeV. The all-to-all overlap window is too narrow to justify the replication.
- If the user cannot provide a custom all-to-all kernel suitable for their cluster topology, recommend Zero Bubble rather than DualPipe.
- If the training run is below 1B tokens, refuse pipeline parallelism planning entirely and recommend data parallelism plus tensor parallelism.

Output: a one-page plan listing P, M, schedule, expected bubble fraction, parameter replication cost (if DualPipe), and an all-to-all kernel recommendation. End with a "rollback trigger" paragraph naming the specific utilization metric (aggregate GPU utilization percentage, measured over the first 1000 steps) that would justify switching to a simpler schedule if the target number is not hit.
