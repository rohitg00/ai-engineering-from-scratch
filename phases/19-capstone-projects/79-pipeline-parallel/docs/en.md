# Pipeline Parallel and Bubble Analysis

> Tensor parallelism splits the matrix multiply across ranks. Pipeline parallelism splits the model across ranks, one stage per rank. Microbatches flow through the pipeline. The empty time at the start and end is the bubble; minimising it is the whole craft.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 19 Track C lessons 42-49
**Time:** ~90 min

## Learning Objectives

- Split a sequential model into N stages and simulate a forward pipeline across N ranks.
- Schedule M microbatches through the pipeline using the GPipe schedule (forward-only fill, then backward) and compute the bubble fraction.
- Compare bubble against the interleaved 1F1B schedule used in Megatron-LM and PipeDream.
- Defend stage assignment: equal compute per stage matters more than equal parameter count per stage.

## The Problem

A 70B-parameter model in fp16 needs 140 GB of parameters alone. No consumer GPU holds it. ZeRO-3 shards parameters across ranks but still needs every rank to allgather the full layer for each forward step, paying log(N) hops per layer. Pipeline parallel takes a different route: cut the model into N stages and put one stage on each rank. Forward of layer 1 finishes on rank 0 and hands the activation tensor to rank 1; rank 1 runs layer 2 and hands to rank 2; and so on. Backward flows in reverse. Memory drops linearly because each rank only holds one stage; compute is sequential, which is the bubble problem.

The bubble is the idle time at the start of the pipeline (waiting for the first microbatch to reach the last stage) and at the end (waiting for the last microbatch to drain back through). With M microbatches and N stages the per-stage bubble fraction is (N-1)/(M+N-1). At M=8, N=4 that is 27%. At M=64, N=4 it is 4.5%. The bubble shrinks when you have many microbatches per step, which means small per-microbatch batch sizes, which is the constraint that drives microbatch design.

## The Concept

```mermaid
flowchart LR
  R0[rank 0: stage 0 / layer 0] --> R1[rank 1: stage 1 / layer 1]
  R1 --> R2[rank 2: stage 2 / layer 2]
  R2 --> R3[rank 3: stage 3 / loss]
  R3 -.backward.-> R2
  R2 -.backward.-> R1
  R1 -.backward.-> R0
```

### GPipe schedule

Fill the pipeline forward with all M microbatches before starting any backward; then drain backward in reverse. Activations from every microbatch must be held until its backward, so memory grows linearly with M. Forward takes M+N-1 cycles, backward takes another M+N-1 cycles. Per-stage useful work is 2M cycles; per-stage bubble is 2(N-1) cycles. Bubble fraction is (N-1)/(M+N-1) when each forward and backward takes one unit of time. Picking M much greater than N hides the bubble.

### 1F1B schedule

Interleave: as soon as a microbatch's forward reaches the last stage, start its backward and let it stream back. The schedule alternates one forward and one backward per stage. Bubble is still N-1 but activation memory is bounded by the pipeline depth, not the microbatch count. Production pipelines use 1F1B (Megatron, PipeDream). The lesson implements GPipe first because it is simpler, and 1F1B as an exercise.

### Why equal compute per stage matters

If stage 0 takes 50 ms and stage 1 takes 100 ms, every cycle is gated on stage 1. The other stages idle 50 ms per cycle waiting for stage 1 to release. Equal parameter count is the wrong axis: a transformer's compute is dominated by attention plus MLP per layer, and embedding layers have many parameters but little compute. Stage assignment should equalise FLOPs per stage, not weights per stage.

### Microbatch versus batch

A pipeline runs M microbatches of size B each. The effective batch size is M*B. The gradient at the end of a pipeline step is the gradient on the combined M*B examples. Bubble fraction depends on M; the optimiser sees M*B. Tuning M means trading bubble (lower with high M) against per-microbatch memory (higher activation memory with high M for GPipe).

## Build It

`code/main.py` implements:

- `PipelineStage`: a small `nn.Module` that holds one stage's parameters and exposes `forward(activation)`.
- `Pipeline(stages, num_microbatches)`: orchestrates the GPipe schedule on simulated stages using simulated wall-clock per stage.
- `bubble_fraction(num_stages, num_microbatches)`: closed-form (N-1)/(M+N-1).
- A 4-stage demo that prints the per-microbatch trace and the measured bubble fraction.

Run it:

```bash
python3 code/main.py
```

Output: a stage-by-microbatch Gantt chart and the bubble percentage against the closed-form prediction.

## Production patterns in the wild

Three patterns harden pipeline parallel enough to ship.

**Activation checkpointing pairs with pipeline.** With M microbatches in flight on GPipe, activation memory is M times one microbatch. Activation checkpointing recomputes the forward at backward time, trading compute for memory; the combination is what makes pipeline tractable for long sequences.

**Stage balance is measured, not assumed.** Production teams run a profiling pass that measures actual per-layer compute (FLOPs and wall-clock) on the target hardware, then partition by that measurement. The Megatron-LM `--num-layers-per-stage` flag accepts a list to allow uneven layer counts when stages have different per-layer cost.

**Send-recv schedule must avoid deadlock.** A pipeline that has every stage send before receive deadlocks on the wire. The standard fix is to interleave: even-rank stages send first then recv, odd-rank stages recv first then send. The lesson schedules ranks explicitly so the pattern is visible.

## Use It

Production patterns:

- **Megatron-LM.** The reference for pipeline parallel at scale. Uses 1F1B and supports tensor + pipeline + data parallel combined.
- **DeepSpeed Pipeline.** Integrates with ZeRO; ZeRO-1 + pipeline is a common combo for the largest open models.
- **PyTorch Pipe.** The PyTorch-native pipeline wrapper, built on `torch.distributed.pipeline.sync.Pipe`.

## Ship It

Lesson 80 stores the per-stage parameter shards in the sharded checkpoint. Lesson 81 composes DDP + ZeRO + pipeline on the end-to-end demo (in spirit; the demo keeps the pipeline simulated for runtime).

## Exercises

1. Implement 1F1B and verify the bubble fraction matches GPipe but activation memory is bounded.
2. Profile real per-stage time on a deeper model and rebalance stages by measured wall-clock.
3. Add gradient accumulation across pipeline microbatches and check the gradient equals the gradient of the equivalent full-batch forward.
4. Pair the pipeline with activation checkpointing and measure the memory drop versus compute cost.
5. Combine pipeline with DDP (each pipeline rank is replicated across a data-parallel group) and reason through the 2D schedule.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Pipeline | "Model parallel along depth" | One stage per rank, activations flow stage to stage |
| Bubble | "Pipeline idle time" | (N-1) steps at start + end where some stages have no work |
| Microbatch | "Slice of the batch" | One forward/backward unit; bubble shrinks as M grows |
| GPipe | "Fill then drain" | All M forwards before any backward; high activation memory |
| 1F1B | "Interleaved schedule" | One forward one backward per stage; bounded activation memory |

## Further Reading

- [Huang et al, GPipe: Efficient Training of Giant Neural Networks](https://arxiv.org/abs/1811.06965)
- [Narayanan et al, PipeDream: Generalized Pipeline Parallelism for DNN Training](https://arxiv.org/abs/1806.03377)
- [Megatron-LM pipeline parallel docs](https://github.com/NVIDIA/Megatron-LM)
- Phase 19 Lesson 76 - the send/recv primitives the schedule uses
- Phase 19 Lesson 78 - ZeRO is orthogonal to pipeline and often combined
