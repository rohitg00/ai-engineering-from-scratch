# Memory and weight updates on unified memory

> On a GB10 the CPU and the GPU share one memory, so offload moves bytes inside one pool and the weight update never leaves the chip.

On one GPU, the trainer and the rollout engine cannot both hold all their memory at once. Miles makes them take turns. This page explains what each turn gives back, what the weight update does, and why a GB10 changes both stories.

When you finish this section, you can explain what offload and the weight update do on a machine with shared memory.

## Two sides take turns

With `--colocate`, the trainer and the engine share the same GPU. Each step has the same order:

1. The engine generates the answers for the step.
2. The engine releases its memory.
3. The trainer loads its state, computes the log probabilities, and trains.
4. The trainer releases its state.
5. The engine loads again and receives the new weights.

The `--colocate` flag also turns on offload for both sides. `--offload-rollout-level` decides what the engine gives back. The default is both of its memory tags: `kv_cache`, the cache of attention keys and values, and `weight`, the model weights.

```figure
id: fig-8-4
kind: timeline
title: The engine and the trainer take turns on one memory
claim: Only one side holds the GPU memory at a time, and the timed hand-offs take about 2 s of each step.
caption: Phase medians of 48 steps of a run made before we added the heat guard, drawn to scale.
```

## Offload on a normal machine and on a GB10

On a machine with a separate GPU, offload copies bytes from GPU memory to CPU memory over the bus. The copy is the cost.

On a GB10 there is no second memory. GPU memory and CPU memory are the same 128 GB. So offload frees the GPU allocation, and the bytes stay in the same pool. For Qwen3-0.6B, the trainer moved its state to host memory in a median of 0.76 s and back in 0.87 s, over 48 steps. That is small next to a step of more than two minutes.

The engine release before training has no timer. The engine resume after the weight update is in `perf/finalize_and_resume_engines_time`.

Our view: on a GB10, part of the trainer offload and onload time is probably setup work, not copying. We have not measured that split.

## The weight update stays inside the GPU

After training, the engine needs the new weights. Under `--colocate`, the trainer shares handles to its GPU tensors with the engine, and the engine copies from them. The bytes never travel over a network.

The trainer sends the weights in buckets. `--update-weight-buffer-size` sets the bucket size, and our runs used 512 MiB. The update took 0.64 s for Qwen3-0.6B and 0.91 s for Qwen3-1.7B, under one percent of a step. [Section 2.4](#s-size-the-weight-update) has the table.

## One pool changes what Ray sees

Shared memory also changes what other tools see. Ray reads the memory of the whole node. On a GB10 that number includes the model weights, the optimizer state, and the KV cache. So Ray can stop the trainer before any single GPU allocation fails. On a GB10 that stop is a real warning, because the node is close to full for every process. [Section 2.3](#s-stop-ray-killing-the-job) shows the kill and how to lower the memory the run needs.

## What we do not know yet

Keeping the engine loaded between phases saved little rollout time on our GB10. We ran a same-day pair on one seed. On the steps that were clean in both runs, it saved 0.6 to 1.8 s of a rollout of about a minute. [Section 2.2](#s-choose-what-to-offload) has the runs.

```takeaways
- With --colocate, the engine and the trainer take turns, and offload decides what each side gives back.
- On a GB10, offload frees memory inside one pool, and the weight update copies inside the GPU.
- Count the GPU allocations as node memory, and treat a Ray memory kill as a real shortage.
```

Sources: Miles placement, offload, and weight update code at main 08752a12; capture/gpu/miles_grpo.py; capture/gpu/summary/miles-gb10-lab.json (runs.e4-0.6b, runs.e4-1.7b, runs.plain-48); capture/gpu/out-gb10/ray-oom-4b.log.
