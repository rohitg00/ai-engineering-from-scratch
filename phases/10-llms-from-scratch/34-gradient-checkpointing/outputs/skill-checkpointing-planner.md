---
name: checkpointing-planner
description: Choose an activation recomputation policy per layer (none / selective / full / offload) given a training config and HBM budget.
version: 1.0.0
phase: 10
lesson: 34
tags: [gradient-checkpointing, activation-recomputation, selective-checkpoint, fsdp-offload, training-memory]
---

Given the training config (layer count L, hidden size d, sequence length S, microbatch B, dtype bytes per value, attention kernel, tensor-parallel degree TP, pipeline-parallel degree PP, expert-parallel degree EP if MoE) and the per-rank HBM budget after weights and optimizer state, output:

1. Per-layer policy. For each layer family in the stack (embedding, attention, FFN, MoE expert, norm, output head) pick none, selective, full, or offload. Default to selective for attention when S exceeds 4_096; default to none on residual streams and norms; default to offload on FFN only when the measured PCIe transfer time for that layer's activations is less than its measured recompute time.
2. Segment size k. If full checkpointing is on, pick k as round(sqrt(L)) for uniform layer cost, smaller k when activation memory dominates the budget. Report extra FLOP percentage as (1/k) of forward FLOPs.
3. FlashAttention interaction. Confirm whether the attention kernel already recomputes softmax. If yes, selective attention checkpointing buys little; downgrade to none. State the kernel by name (FlashAttention-2/3, xFormers memory-efficient, vanilla).
4. TP / PP plan. For TP, name the activations that need gather or rescatter on recompute and the per-step communication bytes added. For PP, confirm which pipeline stages get checkpointed end-to-end so reverse microbatches free activation memory before flowing back.
5. Budget math. Predict activation memory before and after the policy (in MB per rank). Predict FLOP overhead as percent of fwd+bwd. Reject any plan that does not fit in the HBM budget with 10 percent headroom.

Refuse full checkpointing every layer when selective on attention alone closes the budget; profile shows the FLOP overhead is many times higher than selective for the same memory savings, and the exact ratio is workload-specific. Refuse offload when the layer's measured activation transfer time on the target PCIe link exceeds its measured recompute time; recompute wins. Refuse "checkpoint everywhere" for FP8 training when the chosen framework does not snapshot amax history; the recompute will drift the scale and silently corrupt gradients.

Example input: "L=64, d=8192, S=8192, B=1, bf16, FlashAttention-3, TP=8, PP=4, HBM budget per rank 32 GB after weights, MoE with 8 experts and EP=8."

Example output:
- Per-layer policy: attention selective, FFN none, MoE expert full, embedding none, output head offload.
- Segment size: full applied on MoE only at k=8; FLOP overhead 12 percent on expert path, 0 elsewhere.
- FlashAttention interaction: FA-3 already recomputes softmax; selective at the layer wrapper, not inside the kernel.
- TP / PP plan: TP gather of the attention input on recompute, 0.3 GB per step extra comms; PP stages each checkpoint their full forward; PP stage 3 retains its activations for the final backward.
- Budget math: activations 38 GB without policy, 11 GB with policy. Total FLOP overhead 7.5 percent fwd+bwd.
