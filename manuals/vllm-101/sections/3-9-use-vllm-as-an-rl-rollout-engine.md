# Use vLLM as an RL rollout engine

> An RL trainer borrows the server between steps, and vLLM gives it routes to sleep, wake, and load new weights.

Your RL trainer must generate rollouts and then update the weights. When you finish this section, you can name the control routes an RL framework calls.

## The loop

An RL step has two halves. The rollout half generates answers with the current weights. The training half computes a loss and updates the weights. Then the generator needs the new weights before the next rollout.

On one set of GPUs, the two halves take turns on the same memory. The generator must give its memory back during training and take it again after. The vLLM server provides the pieces for this, and many RL frameworks call them. The vLLM documentation lists verl, OpenRLHF, TRL, NeMo-RL, SkyRL, Prime-RL, and others among its users.

## The pieces

The routes below exist only when you start the server with `VLLM_SERVER_DEV_MODE=1`. They free memory, replace weights, and run methods on every worker. Never expose a server in this mode outside the network of the trainer.

**Sleep mode.** Start the server with `--enable-sleep-mode`. A call to `/sleep` frees GPU memory, and `/wake_up` takes it back. At the deeper of its two levels, sleep drops the weights too, which suits a step where the trainer sends new weights anyway. `--sleep-preserve-parameter-names` keeps frozen weights on the GPU, so they do not move each step.

**Pause and resume.** `/pause` stops new generation, and `/resume` starts it again. A pause can abort the running requests, wait for them, or keep them.

**Weight updates.** The trainer starts a transfer with `/init_weight_transfer_engine`, then calls `/start_weight_update`, sends the weights, and calls `/finish_weight_update`. The transfer can run over NCCL between GPUs or through CUDA memory handles on one machine. `/update_weight_version` records which version the next rollouts use.

**Collective calls.** `/collective_rpc` runs a method on every worker. Frameworks use it for setup that vLLM does not cover.

**External launch.** With `--distributed-executor-backend external_launcher`, a launcher such as `torchrun` starts the vLLM workers inside the trainer's processes. Some colocated frameworks use this path.

## Try sleep and wake by hand

Start a server in development mode with sleep mode on. `--host 127.0.0.1` keeps the control routes on your own machine:

```bash
VLLM_SERVER_DEV_MODE=1 vllm serve Qwen/Qwen3-8B --enable-sleep-mode --host 127.0.0.1 2>&1 | tee server.log
```

In a second terminal, put the server to sleep, check it, and wake it:

```bash
curl -X POST 'http://localhost:8000/sleep?level=1'
curl http://localhost:8000/is_sleeping
curl -X POST 'http://localhost:8000/wake_up'
curl http://localhost:8000/is_sleeping
```

The two POST routes return HTTP 200 with an empty body. The first `/is_sleeping` call returns `{"is_sleeping":true}`, and the second returns `{"is_sleeping":false}`. Run `nvidia-smi` between the calls to see the GPU memory fall during the sleep and rise after the wake.

We ran these calls at level 1 with the small Qwen3-0.6B on an L4. Each POST returned 200 with an empty body, and the sleep took 1.9 s. The GPU memory fell from 14,861 MiB to 4,245 MiB and came back after the wake. The log line `Sleep mode freed 10.37 GiB memory` confirms the sleep.

## Know the sleep mode problems at 0.31.0

Three problems with sleep mode are known at 0.31.0. We did not reproduce them ourselves:

- **A level 2 wake does not reload a speculative draft.** Issue 52479 reports that the weight reload covers only the target model. The target model then rejects every draft token, so decode falls to about the speed with no speculation. The output stays correct, and no error appears. The issue is open.
- **A level 2 sleep clears calibrated KV scales.** On compressed-tensors checkpoints with an FP8 KV cache, the first request after a reload of the weights returned NaN logprobs and a wrong first token. Release 0.32.0 fixes this.
- **A weight update during sleep stops the engine.** Issue 57853 reports a segfault when the trainer sends weights after `/sleep` and before `/wake_up`. The API server stays up, and every later request fails. The issue is open.

So after each level 2 wake, reload the weights, reset the prefix cache, and read the speculative acceptance counters. Always wake the server before the trainer sends weights.

## Check the rollout logprobs

The trainer often compares the logprobs that vLLM returned with the logprobs it computes itself. The two never match exactly, because the kernels differ. A small, steady gap is normal. A gap that grows means the weights did not reach the generator. Track the gap every step. [The reproducibility page](#s-get-reproducible-outputs) explains why the same weights still give different numbers.

Before you read the gap, check which logprob vLLM returns. With top-p or top-k, the two values differ for most tokens.

**Logprobs mode:** the server option `--logprobs-mode`, which picks the value that vLLM returns for each token. The default is `raw_logprobs`, the logprob over the full vocabulary. `processed_logprobs` gives the logprob after the sampling settings change the distribution. Two more modes, `raw_logits` and `processed_logits`, return logits.

We checked both logprob modes on the second GPU of our L4 node on 2026-10-23. We used `Qwen/Qwen3-0.6B` in BF16, 16 prompts of 48 tokens, temperature 1, and top-p 0.9. A float32 Transformers pass over the same tokens gave the reference. That GPU is shared and has no clock lock, but the clock does not change these values.

```listing
title: returned logprob minus the full-vocabulary reference
source: capture/gpu/out-l4/logprobs-top-p.txt
lang: text
note: The two vLLM rows. The SGLang rows are cut.
---
engine and mode                                  returned minus reference, median   median absolute
vLLM --logprobs-mode raw_logprobs                0.0000                             0.005
vLLM --logprobs-mode processed_logprobs          +0.0527
```

- `raw_logprobs` matched the full-vocabulary logprob, with a median absolute gap of 0.005 from the kernels.
- `processed_logprobs` was higher by minus the log of the probability mass that top-p kept. The residual against that formula had a median of 8e-9.
- At top-p 0.9, the kept mass was below 0.99 for most sampled tokens, and the median shift was about 0.053.

So compare `raw_logprobs` with a trainer that scores over the full vocabulary. Compare `processed_logprobs` only with a trainer that scores over the same kept set.

Not measured on our hardware. We ran only that one level 1 check and the logprob check, both with small models. We have not timed a level 2 sleep or a weight update. Our Miles 101 manual measures the same loop with SGLang as the generator.

```takeaways
- Sleep frees GPU memory for training, and wake takes it back.
- A weight update is a transfer that the trainer starts and finishes through the server routes.
- Track the gap between the generator and the trainer logprobs on every step.
- Match --logprobs-mode to the way your trainer scores tokens.
- At 0.31.0, read the draft acceptance after a level 2 wake, and wake before a weight update.
```

Sources: the vLLM source at v0.31.0 (vllm/config/model.py, vllm/config/parallel.py, vllm/entrypoints/serve/dev/sleep/api_router.py, vllm/entrypoints/serve/dev/rlhf/api_router.py, vllm/entrypoints/serve/dev/rpc/api_router.py, vllm/distributed/weight_transfer/base.py, vllm/distributed/weight_transfer/factory.py, vllm/distributed/weight_transfer/nccl_engine.py, vllm/distributed/weight_transfer/ipc_engine.py), vLLM documentation at v0.31.0 (docs/training/rlhf.md, docs/training/async_rl.md, docs/features/sleep_mode.md, docs/training/weight_transfer/), the release notes for v0.31.0 and v0.32.0, vLLM issues 52479 and 57853, the release notes for v0.32.0 (level 2 sleep and calibrated KV scales), capture/gpu/out-l4/livecheck-2026-10-22.txt, capture/gpu/out-l4/logprobs-top-p.txt.
