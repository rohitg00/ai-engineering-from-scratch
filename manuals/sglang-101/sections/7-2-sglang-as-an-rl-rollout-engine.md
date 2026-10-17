# SGLang as an RL rollout engine

> In reinforcement learning the server becomes part of the training loop, so its memory, its weights, and its log probabilities all become the trainer's problem.

You train a model with GRPO. Every step, an inference server writes thousands of answers, a reward function scores them, and the trainer updates the weights. Then the server must answer the next prompts with the new weights, on the same GPUs that the trainer just used. A serving engine built for chat never had to give its memory back or change its weights while it runs. It never had to match another program's numbers to the last bit.

When you finish this section, you can describe one RL step with SGLang as the rollout engine and name the SGLang endpoints each phase calls. You can also choose a weight transfer method and say what "true on-policy" covers and what it does not. The example is Miles v0.1.2 (commit `a22fd824`), the RL framework that RadixArk maintains next to SGLang.

## The receipt for training on stale numbers

Miles is a fork of slime, an RL framework from THUDM, and keeps slime's history. RadixArk describes it as "Enterprise-Grade Reinforcement Learning for Large-Scale Model Post-Training". The docs never define "enterprise". In the code it means three things: correctness checks between rollout and training, recovery from engine faults, and observability.

Each of those exists because RL changes what an inference server is. The server's output is the training data. The log probabilities it reports are the "old policy" in the PPO and GRPO ratio. So any numerical difference between SGLang kernels and the trainer's kernels becomes a bias in the gradient. Miles is the receipt for training on numbers that the server did not produce.

## The loop that borrows the server

The training driver is short on purpose. At v0.1.2, `train.py` has 175 lines. These are the lines of one step when the trainer and SGLang share GPUs:

```python
for rollout_id in range(args.start_rollout_id, args.num_rollout):
    await inference_controller.prepare_rollout(rollout_id)
    rollout_data_pack = await rollout_executor.get(rollout_id)

    if args.offload_rollout:
        ...
            offload_tags = [GPU_MEMORY_TYPE_CUDA_GRAPH]
            if "kv_cache" in args.offload_rollout_level:
                offload_tags.append(GPU_MEMORY_TYPE_KV_CACHE)
            if "weight" in args.offload_rollout_level:
                offload_tags.append(GPU_MEMORY_TYPE_WEIGHTS)
            await inference_controller.offload(tags=offload_tags)
    ...
        await actor_model.train(rollout_id, rollout_data_pack)
    ...
            await offload_train()
            if args.offload_rollout:
                await inference_controller.onload_weights()
        await update_weights(args, actor_model, rollout_executor, inference_controller, rollout_id=rollout_id)
        if args.offload_rollout:
            await inference_controller.onload_kv()
```

Read it as a rental. SGLang generates and scores the rollout. SGLang releases its CUDA graphs, KV cache, and weights. The trainer loads, trains, and offloads itself. SGLang gets its weights back, receives the new weights, and then gets its KV cache and CUDA graphs back. [Figure 7.2b](#fig-7-2b) shows which memory is on the GPU in each phase.

```figure
id: fig-7-2b
kind: timeline
title: GPU memory across one colocated RL step
claim: SGLang and the trainer never hold the GPU at the same time in this mode, and SGLang gets its KV cache back only after the new weights arrive.
caption: Read left to right, one column per phase of train.py. A filled cell means the memory is on the GPU. From train.py and inference_controller.py in Miles at v0.1.2.
```

## What stock SGLang gives the trainer

The rental works through SGLang HTTP endpoints that exist in stock v0.5.22 {{code}}. SGLang's RL guide states the design rule as "Be a library, not a framework" {{docs}}. Miles drives each engine as an ordinary `sglang serve` process over HTTP.

**Memory release:** `POST /release_memory_occupation` frees GPU memory by tag, and `POST /resume_memory_occupation` gives it back. The server needs `--enable-memory-saver`, which is off by default. The tags are `kv_cache`, `weights`, and `cuda_graph`. The docs list only the first two, and the code accepts all three, so the code wins. The memory saver frees physical memory but keeps the virtual addresses, so captured CUDA graphs stay valid without a new capture. The call asserts that the server is idle, so pause generation first.

**Pause and resume:** `POST /pause_generation` takes a mode. SGLang's default is `abort`, which ends every running request. Miles uses `retract` by default, which puts running requests back in the waiting queue so they prefill again after the update. A third mode, `in_place`, keeps their KV cache from the old weights.

**The weight-update session:** `begin_weight_update`, then one or more `update_weights_from_*` calls, then `end_weight_update`. The session exists because quantized layers need a one-time repack after loading. Doing it once per refit is cheaper than once per bucket. After the session, `update_weight_version` stamps the new version. A request that lived through a refit reports `weight_versions` spans in its `meta_info`, so you can see which tokens came from which weights. [Figure 7.2](#fig-7-2) shows one update with the default transfer.

```figure
id: fig-7-2
kind: sequence
title: one weight update between Miles and SGLang
claim: A weight update is a session: pause, begin, send every bucket, end with one repack, set the version, and resume.
caption: Read top to bottom. Rows 3 and 4 repeat once per bucket of the default NCCL broadcast transfer. From weight_update/session.py and protocols/broadcast.py in Miles at v0.1.2 and the endpoints in http_server.py at v0.5.22.
```

## Four ways to move the weights

Miles picks the transfer with `--update-weight-transfer-mode` {{code}}:

| Mode | How the bytes move | Where it fits |
|---|---|---|
| `broadcast` (default) | one NCCL group per pipeline stage, trainer rank 0 broadcasts each bucket to every engine GPU | separate trainer and engine GPUs |
| `broadcast_packed` | the same group, one flat byte tensor per bucket | Megatron, not colocated |
| `p2p` | Mooncake RDMA writes into the GPU addresses that each engine rank publishes | multi-node MoE |
| `disk-delta` | changed bytes of the checkpoint go to shared storage, and each engine patches a local copy | no RDMA or NCCL path |

With `--colocate`, Miles ignores this flag and always sends CUDA IPC handles through `/update_weights_from_tensor`. A team that sets `p2p` on a colocated run measures the wrong thing and never knows.

**The Miles team reports** P2P timings on H100 clusters with a 1 GB bucket {{team 2026-10}}. Qwen3-235B-A22B on 8 nodes went from 10,754 ms with NCCL broadcast to 3,162 ms, 71% less. Kimi-K2 on 32 nodes went from 53,279 ms to 7,227 ms, 86% less. On one node P2P was slower: GLM-4.7-9B-Flash took 68.6% longer and a 4-layer GLM-5 test took 72.2% longer. The reason is in the design. Broadcast sends the full model to every engine rank, and with expert parallelism each rank needs only a fraction of it.

**RadixArk reports** that about 2% of BF16 parameters change in one step {{team 2026-08}}. For GLM-4.7-Flash the disk-delta payload fell from 62.4 GB to 0.69 to 0.83 GB per update, with a generation pause of 3 to 5 s. These are their numbers from the Miles v0.1 post of 2026-08-18. We did not reproduce them.

**Our position:** start colocated on one node with the CUDA IPC path. Move to separate GPUs only when rollout time dominates the step. Choose `p2p` only for multi-node MoE, where the vendor table shows the gain, and keep `broadcast` everywhere else.

## True on-policy, and where it stops

Here the serving engine and the trainer must agree on a number. Give SGLang and Megatron or FSDP the same weights and the same tokens. Their kernels can still return different log probabilities, because their reductions run in a different order. Then the PPO ratio mixes "the policy changed" with "the kernels differ". Miles reports the gap as `train/train_rollout_logprob_abs_diff`, which should be exactly 0 in true on-policy mode.

Two SGLang facts matter first. SGLang returns log probabilities after temperature scaling unless the request is greedy or `SGLANG_RETURN_ORIGINAL_LOGPROB` is set, as [section 4.6](#s-deterministic-inference-and-logprobs) explains. A trainer that compares at temperature 1 sees a mismatch that no kernel causes. Second, `--rl-on-policy-target` accepts one value at v0.5.22, `fsdp`, and it forces deterministic inference {{code}}. That mode replaces matrix multiply, softmax, and norm kernels with batch-invariant versions and forces the PyTorch sampler. It also turns off the radix cache unless the attention backend is `fa3`, `fa4`, `triton`, or `ascend`.

Miles builds on that with a launch plan that sets matching flags on both sides. The coverage is narrow. At v0.1.2 the only model profile is Qwen3 dense: Qwen3-0.6B, Qwen3-4B, Qwen3-4B-Base, and Qwen3-4B-Instruct-2507. Three open issues in the Miles repository show where bitwise parity still breaks:

- **Issue #1485:** Qwen3-4B `down_proj` outputs differ at tensor parallel 2. SGLang sums 38 partial results in two groups of 19, and Miles sums them in a pairwise tree. BF16 addition is not associative {{issue radixark/miles#1485}}.
- **Issue #3714:** deterministic serving pins the NCCL channel limit to 8 while the trainer uses 24. Weight transfer then fails with `Message truncated : received 6144 bytes instead of 2048` {{issue radixark/miles#3714}}.
- **Issue #3277:** after a retract, re-prefill under the new weights overwrites the recorded MoE routes. The response then carries new routes with old log probabilities {{issue radixark/miles#3277}}.

**Our position:** treat true on-policy as a diagnostic for Qwen3 dense models, not a switch for every run. Log the log-probability gap on every run anyway. A large gap means a conversion or kernel problem, and no RL algorithm fixes that.

## What we measured with Miles on a GB10

We ran GRPO with the `radixark/miles:latest` image on one NVIDIA GB10. The image held Miles commit `08752a12` and SGLang `0.5.22.dev46+g7b6993a`. The model was `Qwen/Qwen3-0.6B` on GSM8K, with FSDP and SGLang colocated on the one GPU. Each of the 12 steps sampled 32 prompts 8 times, up to 1,024 response tokens, at temperature 1. SGLang had a memory fraction of 0.4.

```listing
title: one GRPO step, as Miles logs it
source: capture/gpu/out-miles/plain-excerpt.log
lang: text
note: The rollout and training metrics of the first step, one weight update, and one warning. Long lines are cut.
---
metrics.py:94 - perf 0: {'rollout/raw_reward_unfiltered': 0.62890625, 'rollout/num_training_samples': 256, 'rollout/episode_raw_reward': 0.62890625, 'rollout/episode_response_length/mean': 739.92578125, 'rollout/episode_response_length/median': 759.5, 'rollout
{'train/loss': -4.656612873077393e-10, 'train/pg_loss': -4.656612873077393e-10, 'train/entropy_loss': 0.0, 'train/pg_clipfrac': 0.0, 'train/ppo_kl': 0.0, 'train/ess_ratio': 1.0, 'train/train_rollout_logprob_abs_diff': 0.015336457639932632, 'train/train_rollout_kl': 0.0006840902497060597, 'train/grad_norm': 0.5216571092605591, 'train/lr-pg_0': 1e-06, 'train/step': 0}
timer.py:42 - Timer update_weights end (elapsed: 0.7s)
[2026-10-17 15:55:01] post-warmup freeze_gc failed
```

**We measured** the step time by phase. The SGLang rollout took a median of 57.2 s, at about 3,113 tokens per second. The trainer then recomputed log probabilities in 25.2 s and trained in 80.3 s. The weight update into SGLang took 0.65 s through CUDA IPC. Releasing and taking back the SGLang memory took a median of 1.7 s, and 4.0 s at worst.

```figure
id: fig-7-2c
kind: chart
title: One GRPO step on a GB10, by phase
claim: On one GB10, the trainer phases took 1.8 times as long as the SGLang rollout, and the weight update took under a second.
caption: Median seconds per phase over 12 steps. Green is SGLang generation, violet is the trainer, and amber is the weight update and the memory release between them. From capture/gpu/summary/miles-gb10.json.
```

The rollout was not the bottleneck at this size. For a 0.6B model on one GPU, a faster serving engine would save at most a third of the step. The weight update and the memory release, which much of this section is about, cost 2.4 s of a 165 s step.

The log-probability gap stayed between 0.0143 and 0.0163 in all 12 steps. That is the number true on-policy mode exists to drive to 0, and plain mode does not move it. The raw reward went up and down between 0.586 and 0.758. Twelve steps are too few to show learning, so read the run as a timing and a gap, not as a training curve.

Two log lines are worth knowing before you trust a run. About 30 percent of the samples hit the 1,024-token limit, so the reward includes answers cut off before the end. And SGLang printed `post-warmup freeze_gc failed` once at startup. Training ran normally after it, so the warning cost nothing here.

### True on-policy did not start on a GB10

We then set `--true-on-policy-mode` with the flags of the Miles Triton example. SGLang started, and the trainer stopped 61 seconds after the launcher began.

```listing
title: the FSDP trainer rejects the Triton attention
source: capture/gpu/out-miles/true-on-policy-error.log
lang: text
note: The first launcher line, the trainer error, and the failed init. Long lines are cut.
---
[2026-10-17 16:28:41.340 launcher] common.py:290 - EXEC: mkdir -p /root/lab/mode
ValueError: Specified `attn_implementation="triton"` is not supported. The only possible arguments are `attn_implementation="eager"`, `"paged|eager"`, `"attn_implementation=flash_attention_2"`, `"attn_implementation=paged|flash_attention_2"`, `"attn_implementa
[2026-10-17 16:29:42.606 trainer_controller_actor] cell.py:251 - ft op=execute phase=fail cell=trainer-engine-actor-00000 fn=init elapsed_s=0.7
```

The flag value came from the wrong example. In the FSDP actor, the SGLang Triton attention bridge turns on only when `torch.version.hip` is set, which means AMD GPUs {{code}}. On an NVIDIA GPU the value goes straight to transformers, which has no attention named `triton`.

The only true on-policy contract in Miles pairs the SGLang `fa3` backend with `flash_attention_3` in FSDP {{code}}. In this image, the FlashAttention 3 package imports, but `sgl_kernel` reports `Can not import FA3 in sgl_kernel`. We ran the job again with the contract flags to see where it stops.

```listing
title: the contract flags on a GB10
source: capture/gpu/out-miles/true-on-policy-fa3-error.log
lang: text
note: The SGLang start, its failure, and the first and last of the rollout errors that followed. Process prefixes are cut.
---
[2026-10-17 21:03:03] Enable deterministic inference because of legacy rl_on_policy_target.
AssertionError: FlashAttention v3 Backend requires SM>=80 and SM<=90. Please use `--attention-backend flashinfer`.
[2026-10-17 21:03:24] Received sigquit from a child process. It usually means the child failed.
[2026-10-17 21:03:30.637 rollout_executor] http_utils.py:241 - Error: Server error '503 Service Unavailable' for url 'http://172.17.0.3:20035/generate'
[2026-10-17 22:06:46.137 rollout_executor] http_utils.py:241 - Error: Server error '503 Service Unavailable' for url 'http://172.17.0.3:20035/generate'
```

SGLang stopped 21 seconds after it started. Its FA3 backend accepts GPUs from SM 8.0 to SM 9.0, and the GB10 is SM 12.1. So on a GB10, true on-policy at v0.1.2 cannot start, whatever flags you pass.

What happened next is the part to remember. The rollout engine was gone, but the Miles job did not stop. Its rollout loop kept sending requests to the router, which answered `503 Service Unavailable`. The log holds 199,685 of those errors over 63 minutes, until we stopped the container. The job never reported a failure, and the GPU sat idle the whole time.

**Our position on the GB10 result:** before you plan a true on-policy run, check that your GPU and image have both kernels of the contract. Then watch the SGLang server log, not only the trainer, because a dead rollout engine can look like a slow one. At v0.1.2, that contract means FlashAttention 3 on both sides, a path written for Hopper GPUs.

## Miles runs on its own SGLang

Miles does not use the SGLang release that the rest of this manual describes. Its Docker image builds on `lmsysorg/sglang:v0.5.21` and checks out the `sglang-miles` branch. The v0.1.2 release lock pins SGLang commit `b84bec5761a6`. The Miles docs say it plainly: "installing stock `sglang` or upstream Megatron-LM next to Miles does not work." {{docs}}

At least four things that Miles calls do not exist at v0.5.22: the `/pull_weights` endpoint for disk-delta, `register_lora_adapter`, `get_parallelism_info`, and the `--true-on-policy-contract` flag.

That branch is a fair summary of this section. RL asks a serving engine for things that serving users never asked for. It must give memory back and change weights in a session. It must report which weights produced each token and match another program bit for bit. Some of those requests are now in stock SGLang. The rest live on a branch until they are ready.

**A real incident:** issue #860 in the Miles repository reports that `/release_memory_occupation` "silently does nothing" for models with sliding-window attention {{issue radixark/miles#860}}. The sliding-window KV pool turns the memory saver off in its constructor, so a colocated run runs out of memory when Megatron starts. One user saw 30.19 GB of KV pool stay resident on DeepSeek-V4-Flash. The issue was open on 2026-10-16. Check that every memory tag really frees memory on a new model before you trust colocation.

```takeaways
- Pin the Miles image and its release lock, and never mix a stock SGLang into it.
- Pause generation before you release memory, because the release asserts an idle server.
- Start colocated on one node, and expect `--colocate` to override the transfer mode.
- Choose `p2p` only for multi-node MoE runs, and measure the update time first.
- Log the rollout and training log-probability gap on every run.
- Set `SGLANG_RETURN_ORIGINAL_LOGPROB` when your trainer compares at temperature 1.
- Treat true on-policy as a Qwen3 dense diagnostic at v0.1.2.
- Check that your GPU and image have both kernels of the true on-policy contract.
- Alert on the rollout server's own errors, because the trainer can keep waiting on a dead engine.
```

Sources: Miles at v0.1.2 (a22fd824): train.py, release-lock.json, docker/Dockerfile, docs/developer/versions.md, miles/ray/rollout/inference_controller.py, miles/backends/training_utils/weight_update/protocol.py, session.py, protocols/broadcast.py, protocols/cuda_ipc.py, protocols/p2p.py, protocols/delta.py, miles/true_on_policy/model_profiles.py, docs/advanced/p2p-weight-transfer.md; SGLang at v0.5.22: python/sglang/srt/entrypoints/http_server.py, python/sglang/srt/managers/io_struct.py (PauseGenerationReqInput), python/sglang/srt/managers/scheduler_components/weight_updater.py, python/sglang/srt/constants.py, python/sglang/srt/arg_groups/fields/exec_.py, python/sglang/srt/arg_groups/choices.py, python/sglang/srt/arg_groups/attention_hook.py, python/sglang/srt/layers/logprob_processor.py, docs/docs/advanced_features/sglang_for_rl.mdx; Miles issues #860, #1485, #3277, #3714; RadixArk and LMSYS posts: lmsys.org/blog/2025-11-19-miles and lmsys.org/blog/2026-08-18-miles-v0-1. Miles at 08752a12: miles/backends/fsdp_utils/actor.py, miles/true_on_policy/schema.py, examples/infra_features/true_on_policy/run_simple.py and run_simple_amd_triton.py. capture/gpu/miles_grpo.py, capture/gpu/miles_summary.py, capture/gpu/out-miles/plain-excerpt.log, capture/gpu/out-miles/true-on-policy-error.log, capture/gpu/summary/miles-gb10.json. capture/gpu/out-miles/true-on-policy-fa3-error.log.
