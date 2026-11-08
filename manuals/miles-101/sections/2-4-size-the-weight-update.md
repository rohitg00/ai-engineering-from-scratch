# Size the weight update

> On one GPU the weight update is a small fixed cost, so it is not the step to tune first.

After each training phase, the trainer copies its new weights into the rollout engine. On one GPU this copy stays inside the GPU, and it takes under a second for the models we ran.

When you finish this section, you can measure the weight update and decide if it matters for your run.

**Our result:** the weight update took 0.64 s for Qwen3-0.6B and 0.91 s for Qwen3-1.7B, under one percent of a step.

## Read the update time

Every step logs `perf/update_weights_time` in seconds. Read it next to `perf/step_time`. We ran 4 short steps for two model sizes, with answers cut at 256 tokens:

| Model | Weight update, 4 steps | Trainer offload, steps 2 and 3 | Trainer onload, steps 2 and 3 |
|---|---|---|---|
| Qwen3-0.6B | 0.63 to 0.66 s | 1.08 to 1.20 s | 0.77 to 0.86 s |
| Qwen3-1.7B | 0.89 to 0.95 s | 2.63 to 3.20 s | 1.42 to 1.45 s |

Steps 0 and 1 are warm-up steps. In these 4-step runs, their trainer offload took up to 4.1 s for 0.6B and 11.8 s for 1.7B. The table leaves them out.

**Trainer offload:** the time the trainer takes to move its weights and optimizer state to host memory after training, logged as `perf/sleep_time`. **Trainer onload:** the time it takes to move them back before the next log probabilities, logged as `perf/wake_up_time`.

The larger model is about 2.8 times the size, and its update took about 1.4 times as long. The trainer offload and onload grew faster than the update did. A likely reason is that the update sends only the weights, while the offload also moves the gradients and the optimizer state.

The short answers cut almost every reply, so the reward in these runs stayed near 0. These runs measure the copy, not the training.

```figure
id: fig-2-4
kind: chart
title: A larger model costs more to offload than to update
claim: From 0.6B to 1.7B, the weight update grew 1.4 times, and the trainer offload grew 2.6 times.
caption: Mean seconds of steps 2 and 3, after two warm-up steps, for each model.
```

## Compare it with the step

In our 48-step run with Qwen3-0.6B, a full step took 152.6 s at the median, and the update took 0.64 s. That is under half a percent of the step. The 1.7B model gave a similar share.

So tune the rollout and the training phase first. Come back to the update only when it passes a few percent of the step.

## Change the bucket size only with a reason

The trainer sends the weights in buckets. `--update-weight-buffer-size` sets the bucket size in bytes. Our runs used 536870912, which is 512 MiB.

A larger bucket means fewer transfers and a higher memory peak during the update. On one GPU, with updates under a second, we left it at 512 MiB.

```takeaways
- Read perf/update_weights_time next to perf/step_time for each model size.
- Tune the rollout and the training phase before the weight update.
- Watch the trainer offload and onload too, because they grew faster than the update did.
```

Sources: capture/gpu/summary/miles-gb10-lab.json (runs.e4-0.6b, runs.e4-1.7b, runs.plain-48); capture/gpu/miles_grpo.py.
