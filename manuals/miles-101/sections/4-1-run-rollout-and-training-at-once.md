# Run rollout and training at the same time

> Async training lets rollout run during training, but on one GPU the two phases still wait for each other.

In a normal Miles step, rollout runs, then training runs, then rollout runs again. On many GPUs, the rollout GPUs wait while the trainer works, and the trainer waits while the rollout GPUs work. Async training removes part of that wait, and pays for it with samples from older weights.

When you finish this section, you can decide if async training helps your layout, and which settings control the cost.

We have not run async training on our GB10. This page comes from the Miles source and documentation.

## Two async modes

Both modes start from `train_async.py` instead of `train.py`:

| Mode | How to start it | What overlaps |
|---|---|---|
| One step ahead | `train_async.py` | the rollout of the next step runs while the current step trains |
| Fully async | `train_async.py --fully-async` | a worker keeps generation going, and the trainer takes groups from a buffer |

In the first mode, with the default update interval, every sample is at most one weight version old. In the fully async mode, the age of a sample depends on how fast the trainer drains the buffer.

## What async gives on one GPU

With `--colocate`, the trainer and the engine share the GPU. Miles allows colocation only with `--fully-async`, so the one-step-ahead mode needs separate GPUs. The fully async mode can run on one GPU with `--colocate`, but only with the Megatron trainer, not the FSDP trainer of this manual. Generation also stops for the whole training window, so the two phases still take turns.

So on one GPU, async training does not save time. It adds the cost of older samples and gives no overlap. Use it on one GPU only to learn its settings before a larger run.

## Control the age of the samples

On a layout with separate rollout GPUs, these settings decide how old a sample can get:

- `--update-weights-interval` sets how many steps run between weight updates to the engine.
- `--max-weight-staleness` drops samples that are older than this many weight versions. Unset means no limit.
- `--async-unused-samples-handler` decides what happens to a dropped sample: `drop` or `retry`.
- `--async-max-concurrent-samples` caps the number of samples that the engines generate at one time.
- `--pause-generation-mode` decides what happens to running requests during a weight update: `abort`, `retract`, or `in_place`. The default is `retract`. The fully async mode refuses `abort`, and refuses `in_place` with `--colocate`.

`--over-sampling-batch-size` has no effect under `--fully-async`.

## Lower the learning rate as samples get older

Sample age and learning rate work together. A 2026 study of async GRPO on Llama models of 1B and 3B parameters changed both. [The sources](#s-ref-sources) list it as the study of collapse in asynchronous GRPO. The largest stable learning rate fell in proportion to the number of steps between weight updates. Twice the steps allowed about half the learning rate.

We have not tested this. Use it as a starting rule: when you raise `--update-weights-interval` or the age limit, lower the learning rate by the same factor. Then watch the gap and the reward.

## What to watch

- The weight version of each sample. The rollout metrics report how old the samples are.
- The share of dropped or retried samples. A high share means the engine works for nothing.
- The gap between the trainer and the engine, as in [section 5.2](#s-check-the-first-step). Older samples add a gap that the kernels did not cause.

On our single GB10, we cannot measure the overlap that async training gives, because there is no second GPU to overlap with.

```takeaways
- Use async training only when rollout and training run on different GPUs.
- Set a limit on sample age, and lower the learning rate as you let samples get older.
- On one GPU, use async mode only to learn its settings.
```

Sources: Miles fully async documentation, train_async.py, and async rollout arguments at main 08752a12; Scaling Laws for Collapse in Asynchronous GRPO, arXiv 2607.01083.
