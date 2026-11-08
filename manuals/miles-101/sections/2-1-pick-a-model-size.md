# Pick a model size for one GPU

> The largest model you can train on one GPU is the one whose trainer copy and engine copy fit together.

When you finish this section, you can estimate the memory of a run before you start it. You can also choose the largest model that fits.

**Our result:** on one GB10 with 128 GB of shared memory, Qwen3-1.7B fit for 4 short steps with answers cut at 256 tokens. Qwen3-4B did not fit, even with those short answers. We did not train 1.7B with the 1,024-token recipe.

## Count the trainer memory first

The trainer is the large part of a colocated run. Full fine-tuning with Adam keeps the model weights, the gradients, and two optimizer values for each weight. With mixed precision that is about 16 bytes for each parameter, before activations. The engine adds its own copy of the weights and its KV cache on top.

| Model | Trainer state, estimate | Result on our GB10 |
|---|---|---|
| Qwen3-0.6B | about 10 GB | trains |
| Qwen3-1.7B | about 27 GB | fits for 4 steps at 256 tokens |
| Qwen3-4B | about 64 GB | stopped by Ray in the first step at 256 tokens, twice |
| Qwen3-8B | about 128 GB | not tried, larger than the machine |

The estimate is a lower bound. Activations, the engine, and the process overhead come on top, and the measured node memory below shows how large that overhead is.

```figure
id: fig-2-1
kind: chart
title: 1.7B fits for short steps, and 4B does not
claim: The estimated trainer state of a 4B model is about half the machine, and both 4B runs reached the Ray limit.
caption: Blue bars are estimates at 16 bytes for each parameter. Rose bars are the node memory that Ray read when it stopped each 4B run.
```

## What happened with 4B

Ray stopped both of our 4B runs in the training phase of the first step, at 115.86 and then 119.18 GB of 121.69 GB. The second run lowered the engine memory fraction from 0.4 to 0.2, and the kill came anyway. [Section 2.3](#s-stop-ray-killing-the-job) shows the kill message, why it happens on a GB10, and what to change.

## Choose the size

1. Start with the smallest model that can answer your task.
2. Multiply the parameter count by 16 bytes. On our 128 GB GB10, the limit fell between 27 GB and 64 GB of this estimate. Use half of your GPU memory as a first guess.
3. Run 4 steps at your real answer length. Read the node memory with `free -g` on the host, or in the Ray kill line. On a GB10, `nvidia-smi` reports no memory size.
4. Move up one size only when the short run leaves room.

To train a model of 4B or more, you need more GPUs ([Part 6](#s-split-rollout-and-training)) or a recipe that keeps less optimizer state.

## Train a larger model with LoRA

**LoRA:** low-rank adaptation. The trainer keeps the model weights frozen and trains two small matrices next to some of the layers. Only those small matrices get gradients and optimizer state.

LoRA is the usual way to train a model whose full trainer state does not fit. In the Miles version we ran, only the Megatron trainer supports it. The FSDP trainer of this manual refuses LoRA at start. To try it:

1. Switch to the Megatron trainer, as [section 6.1](#s-split-rollout-and-training-choose-the-trainer) shows.
2. Add `--lora-rank 16`, or another rank above 0. The default rank of 0 turns LoRA off.
3. Keep one adapter. Under `--colocate`, Miles trains one adapter, and several adapters need a split layout.

The engine serves the same adapter that the trainer updates. We have not run LoRA or the Megatron trainer on our GB10. So we do not know if a 4B model fits this way on 128 GB.

```takeaways
- Estimate the trainer state at 16 bytes for each parameter before you start.
- On one 128 GB GB10, plan for 1.7B at most, and test it at your answer length.
- After a Ray memory kill, make the run smaller, as section 2.3 shows.
- Try LoRA on the Megatron trainer before you rent more GPUs for a larger model.
```

Sources: capture/gpu/out-gb10/ray-oom-4b.log; capture/gpu/out-gb10/ray-oom-4b-lowmem.log; capture/gpu/out-gb10/gpu-check.txt; Miles LoRA arguments and LoRA documentation at main 08752a12; capture/gpu/summary/miles-gb10-lab.json (runs.e4-0.6b, runs.e4-1.7b, excluded.e4-4b, excluded.e4-4b-lowmem).
