# Stop Ray from killing the job on unified memory

> On a GB10, the GPU allocations and the host share one memory, so a Ray memory kill there means the machine really was close to full.

Our Qwen3-4B run finished its first rollout, then stopped in the training phase of that step, 15 minutes after start. The log holds no CUDA out-of-memory error. Ray had stopped the trainer because the node was nearly full.

When you finish this section, you can recognize a Ray memory kill and lower the memory that the run needs.

**Our result:** Ray stopped our 4B trainer twice, with the node at 115.86 and then 119.18 of 121.69 GB. Both stops were real memory pressure.

## Read the kill message

Search the log for `OutOfMemoryError` before you change anything. A Ray memory kill names the node, not a GPU:

```listing
title: Ray stops the trainer of a Qwen3-4B run
source: capture/gpu/out-gb10/ray-oom-4b.log
lang: text
note: The first line gives the share of node memory in use. The table lists the largest processes. The last line names the two settings that control the kill.
---
(TrainerController pid=2656) ray.exceptions.OutOfMemoryError: 1 worker(s) were killed due to the node running low on memory. Memory on the node (IP: 172.17.0.3, ID: 08904870a17c5413c623abfc21db2e7fcfdc39d5be90e997b2391f37) was 115.86GB / 121.69GB (0.952127)
(TrainerController pid=2656) Top 10 memory users: PID	MEM(GB)	COMMAND
(TrainerController pid=2656) 2657	36.77	ray::FSDPTrainRayActor.train
(TrainerController pid=2656) 3402	2.73	sglang::scheduler
(TrainerController pid=2656) 2650	1.33	ray::RolloutExecutor
To adjust the kill threshold, set the environment variable `RAY_memory_usage_threshold` when starting Ray. To disable worker killing, set the environment variable `RAY_memory_monitor_refresh_ms` to zero.
```

The node held 115.86 GB of 121.69 GB, which is 95.2 percent. The trainer process alone held 36.77 GB. The rest of the used memory was not in the process list.

## Why this happens on a GB10

On a GB10, the CPU and the GPU use one pool of memory. Ray reads the memory of the whole node. So the GPU allocations count in the number that Ray watches. Those are the model weights, the optimizer state, and the KV cache. That is our explanation of the memory that the process list does not show. We did not measure the split.

That number is real. When it reaches 100 percent, the machine has no memory left for anyone. So a Ray kill at 95 percent is a warning that the run does not fit, and not a false alarm.

```figure
id: fig-2-3
kind: layers
title: Ray reads one memory for the whole GB10
claim: On a GB10, Ray reads one memory for the whole node, so its kill means the machine is close to full.
caption: The memory Ray read when it stopped the first 4B run, drawn as one bar.
```

## Lower the memory the run needs

Change the run, not the watcher:

1. Use a smaller model. On our GB10, only a smaller model got past the kill.
2. Lower the work per step. Use fewer prompts, fewer answers per prompt, or shorter answers. We did not test this on 4B.
3. Lower the engine memory. `--sglang-mem-fraction-static` sets the share of GPU memory that the rollout engine takes. In our 4B test, 0.2 in place of 0.4 did not prevent the kill.

The log also names `RAY_memory_usage_threshold`. Do not raise it on unified memory. A higher threshold lets the node get closer to full. If the node does run out, the operating system can stop any process on the machine, and that stop leaves no Ray message to read.

We ran the same Qwen3-4B job again with `--sglang-mem-fraction-static 0.2` and the default Ray threshold. Ray stopped it again, at 119.18 GB. The trainer process held 36.75 GB, almost the same as in the first run, so the smaller engine share did not make room. [Section 2.1](#s-pick-a-model-size) shows how to choose a model size that fits.

```takeaways
- Read the Ray OutOfMemoryError line before you change anything.
- On unified memory, treat a Ray memory kill as a real shortage.
- Use a smaller model or less work per step, and leave the Ray threshold at its default.
```

Sources: capture/gpu/out-gb10/ray-oom-4b.log; capture/gpu/out-gb10/ray-oom-4b-timing.txt; capture/gpu/out-gb10/ray-oom-4b-lowmem.log; capture/gpu/summary/miles-gb10-lab.json (excluded.e4-4b); Ray memory monitor message in the e4-4b run log.
