# --attention-backend

> SGLang has many attention kernels because none wins on every GPU and model, and its default choice records regressions that someone already paid for.

In January 2026 a user upgraded FlashInfer and served Qwen3-235B on H20 GPUs. Median inter-token latency went from 39.44 ms to 283.52 ms, seven times slower, and nothing else in the setup had changed. The FA3 kernel gave 56.73 ms on the same run. That report is issue #17411, and the code that picks your attention backend at v0.5.22 still cites it.

When you finish this section, you can name the backend SGLang picks for your GPU and model, and explain why. You can also split prefill and decode across two backends and decide when to override the default.

## What an attention backend is

**Attention backend:** the class that computes attention over the paged KV cache for one batch. Every backend implements the same interface. It builds per-batch metadata such as page tables and index buffers. It prepares state for CUDA graph capture and replay. It runs `forward_extend` for prefill and `forward_decode` for decode.

The model code never calls a kernel by name. Each attention layer calls whatever backend the model runner installed at startup. So one flag swaps the kernel for every layer of every model.

At v0.5.22 the flag accepts 25 names. Two are aliases (`nsa` for `dsa`, and `compressed` for `dsv4`), so there are 23 backends.

| Backend | What it is for |
|---|---|
| `flashinfer` | Paged MHA and MLA. Supports speculative topk above 1 and page sizes above 1. The general default. |
| `fa3` | FlashAttention 3 for Hopper. The Hopper default. |
| `fa4` | FlashAttention 4, for Blackwell. Picked when a model has different K and V head widths. |
| `trtllm_mha`, `trtllm_mla` | TensorRT-LLM kernels through FlashInfer, for Blackwell SM100 and SM103. |
| `flashmla`, `cutedsl_mla`, `tokenspeed_mla` | Decode kernels for MLA models such as DeepSeek. |
| `dsa`, `dsv4`, `qsa`, `minicpm_*` | Sparse attention for one model family each. |
| `triton` | Portable Triton kernels. The default when FlashInfer cannot run the model. |
| `torch_native`, `flex_attention` | PyTorch reference paths. `torch_native` is the default on Apple MPS and ARM64 CPUs. |
| `aiter`, `wave` | AMD ROCm kernels. `aiter` is the default on AMD for MHA. |
| `intel_amx`, `intel_xpu`, `ascend`, `hpc_ops` | x86 CPUs with AMX, Intel GPUs, Huawei NPUs, and Tencent kernels for SM90. |
| `llada2_cfg_flashinfer` | A diffusion language model variant. |

## The obvious fix, and why it fails

The obvious fix is to read a benchmark, find the fastest kernel, and pass it on every server. That fails because each backend has limits that a benchmark does not show.

`trtllm_mha` rejects speculative decoding with topk above 1 and does not run on SM120. FlashInfer cannot run models that use attention sinks. `fa4` has a native page size of 128. Some backends accept FP8 KV caches and some do not. A kernel that wins on one model and GPU can refuse to start on the next.

## How SGLang picks a default

When you do not pass `--attention-backend`, startup calls one function that reads your GPU, the attention type of the model, and your speculative decoding settings.

```figure
id: fig-4-3
kind: decision
title: the default attention backend at v0.5.22
claim: SGLang picks the attention backend from the GPU generation and the attention type of the model, and each branch records a measured limit.
caption: Read top to bottom. MHA models follow the left path and MLA models the right. Hopper means CUDA 12.3 or later. From get_default_attn_backend at v0.5.22.
```

For MHA models, such as Llama and Qwen, the order is this:

1. On Hopper with CUDA 12.3 or later, and no speculative topk above 1, the default is `fa3`. The code comment cites issue #17411.
2. On Blackwell SM100 or SM103, the default is `trtllm_mha`, or `fa4` when K and V widths differ.
3. On AMD the default is `aiter`, and on Apple MPS it is `torch_native`.
4. In every other case the default is `flashinfer` when it is installed and the model has no attention sinks, else `triton`.

For MLA models, such as DeepSeek V3, Hopper gets `fa3` and Blackwell gets `flashinfer`. AMD gets `aiter` when each rank has 16 or 128 KV heads. A model override then moves DeepSeek V3 on SM100 to `trtllm_mla`.

The docstring of the same function says FA3 is avoided when the page size is above 1. The code does not check the page size. When a comment and the code disagree, the code is what runs.

## Two backends in one server

Prefill and decode stress different things. Prefill reads long query blocks, and decode reads one query against a long cache. `--prefill-attention-backend` and `--decode-attention-backend` set each phase separately. When they differ, SGLang wraps both in a hybrid backend that dispatches by `ForwardMode`. With speculative decoding, `--speculative-attention-mode` decides which of the two runs the verify pass. Its default is `prefill`.

## Docs and code disagree

The attention backend page in the docs at v0.5.22 still lists Cutlass MLA and Dual Chunk FlashAttention. PR #32114 deleted both on 2026-09-10, and neither name is a valid choice at the tag. The same page says Blackwell MHA uses `trtllm_mha`. The code picks `fa4` for models with asymmetric K and V widths. In both cases the code wins, and this manual follows the code.

## What to measure

Read the resolved backend in the startup log before you benchmark anything. Then change one flag, rerun the same benchmark at your real concurrency, and compare inter-token latency at p50 and p99. Attention is one part of a decode step, so a faster kernel can move end-to-end numbers less than its own benchmark suggests.

On our Mac capture, SGLang ran through the MLX runtime. The server arguments resolve to `torch_native`, but MLX runs its own attention path, so none of these backends ran there.

## What we measured on an L4

We ran the load sweep of [section 5.1](#s-sglang-benchmark-serving) on one L4 with `Qwen/Qwen3-8B`, three seeds per point. The default server resolved its backend to `flashinfer` and ran on 2026-10-16. The second server set `--attention-backend triton` and ran on 2026-10-18. Both had the same pool of 24,094 tokens and replayed decode graphs up to 48 running requests. Every run had a median SM clock of 1,000 MHz or more.

```listing
title: the Triton server under load
source: capture/gpu/out-l4/server-load-triton.log
lang: text
note: The pool at startup, and one decode line at 33 running requests.
---
[2026-10-18 14:28:40] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 24094, K size: 1.65 GB, V size: 1.65 GB
[2026-10-18 16:11:42] Decode batch, #running-req: 33, #token: 20422, token usage: 0.85, cuda graph: True, gen throughput (token/s): 311.50, #queue-req: 0
```

| Concurrency | Output tok/s, flashinfer / triton | Median TPOT, flashinfer / triton | Median TTFT, flashinfer / triton |
|---|---|---|---|
| 1 | 13.42 / 13.94 | 60.16 / 59.98 ms | 189 / 183 ms |
| 8 | 112.62 / 112.90 | 66.01 / 65.83 ms | 170 / 187 ms |
| 32 | 270.11 / 270.91 | 96.18 / 96.99 ms | 2,970 / 2,833 ms |
| 64 | 250.85 / 257.29 | 107.42 / 107.76 ms | 18,349 / 18,260 ms |

**We measured** a tie on throughput and time per token. Throughput was within 4 percent and the median time per token within 1 ms at every concurrency. The median TTFT differed by up to 9 percent, in both directions, outside the seed spread at 2, 16, and 32 users. The two servers ran two days apart. Our reading: on a dense 8B model with contexts under 1,000 tokens, the attention kernel is a small part of each step. The weight reads set the pace.

## Our position

Leave `--attention-backend` unset unless you have a benchmark on your own traffic. The default encodes regressions that other users found, such as #17411, and model overrides, such as DeepSeek V3 on SM100. The same issue is also the exception: a user who measures can beat a default that a library upgrade broke. Measure, then override, and write the reason next to the flag.

Prefer the backend that supports every feature you need over the one that wins a microbenchmark. Speculative decoding with topk above 1 needs `flashinfer`, `fa3`, or `triton` when the page size is above 1.

## Incidents

**A library upgrade made Hopper seven times slower.** Issue #17411 (2026-01-20): FlashInfer 0.6.1 regressed the Hopper attention kernel. Median inter-token latency on H20 went from 39.44 ms to 283.52 ms. SGLang made `fa3` the Hopper MHA default two days later.

**The other engine lost its graphs.** A field report by Varad More {{field Varad More 2026-04}} measured Gemma 3 4B on one A10G at 149 tok/s on SGLang and 84 tok/s on vLLM. The cause was outside attention speed. vLLM ran that model with `--enforce-eager`, without CUDA graphs, because of its interleaved sliding-window attention. A backend comparison is only fair when both servers replay graphs.

```takeaways
- Read the resolved attention backend in the startup log before every benchmark.
- Leave --attention-backend unset until a benchmark on your traffic shows a better choice.
- Check feature limits, such as speculative topk and page size, before choosing a backend.
- Pin your kernel library versions and rerun latency tests after every upgrade.
```

Sources: python/sglang/srt/arg_groups/model_override_base.py (get_default_attn_backend), arg_groups/choices.py (ATTENTION_BACKEND_CHOICES), layers/attention/base_attn_backend.py, layers/attention/attention_registry.py, model_executor/model_runner_components/attention_backend_setup.py, arg_groups/fields/spec.py, and docs/docs/advanced_features/attention_backend.mdx at v0.5.22; PR #32114; issue #17411; field report by Varad More (2026-04-22); capture/gpu/out-l4/server-load-triton.log, capture/gpu/summary/l4.json (load.default, load.triton).
