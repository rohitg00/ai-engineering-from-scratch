# Fit more users with an FP8 KV cache

> An FP8 KV cache doubles the tokens that fit, and on an L4 it also changes the attention backend without a warning.

Your server queues requests because the KV cache is full. When you finish this section, you can double the KV pool and check the cost in speed and accuracy.

**Our result:** on our L4, the first FP8 start failed, and the Triton backend fixed it. With the pool held fixed, one user got 2.3 percent faster per token.

## Turn it on

The KV cache stores two values for each layer, head, and token. By default, vLLM stores them in the model data type, BF16 for `Qwen/Qwen3-8B`, at 2 bytes per value. FP8 stores each value in 1 byte:

```bash
vllm serve Qwen/Qwen3-8B --kv-cache-dtype fp8
```

The weights stay in BF16. Only the KV cache changes.

## Count what it gives you

Use the formula from [the memory page](#s-count-the-memory-before-you-pick-a-gpu) with 1 byte per value. For `Qwen/Qwen3-8B`, a token needs 144 KiB in BF16 and 72 KiB in FP8.

```figure
id: fig-2-4
kind: chart
title: the KV tokens in one GiB
claim: For Qwen3-8B, one GiB of KV cache holds about 7,300 tokens in BF16 and about 14,600 tokens in FP8.
caption: The numbers come from the bytes per token, not from a run. From the model config of Qwen/Qwen3-8B.
```

The same memory holds twice the tokens. So twice the users fit at the same length, or each user can have a context twice as long.

## Fix the start on an L4

On our L4, the first start with `--kv-cache-dtype fp8` failed. The cause is the attention backend:

1. vLLM tries FlashAttention first on the L4.
2. FlashAttention in vLLM 0.31.0 reads an FP8 KV cache only on Hopper and Blackwell data center GPUs. The L4 is an Ada GPU, SM 8.9.
3. vLLM moves to FlashInfer, the next backend in its list.
4. FlashInfer builds its kernels on the first start. On our node, that build failed.

```listing
title: the FlashInfer build error on our L4
source: capture/gpu/incidents/l4-vllm-kv-fp8-flashinfer-attention-jit.txt
lang: text
note: Our FP8 start on 2026-10-22. vLLM picked FlashInfer from two valid backends. The build of its FP8 prefill kernel failed, because the CUDA compiler and the CUDA headers came from different releases.
---
(EngineCore pid=814129) INFO 10-22 09:11:03 [cuda.py:526] Using FLASHINFER attention backend out of potential backends: ['FLASHINFER', 'TRITON_ATTN'].
(EngineCore pid=814129) ERROR 10-22 09:11:53 [core.py:1433] /data/vllm/.venv/lib/python3.12/site-packages/flashinfer/data/cccl/libcudacxx/include/cuda/std/__cccl/cuda_toolkit.h:41:8: error: #error "CUDA compiler and CUDA toolkit headers are incompatible, please check your include paths"
RuntimeError: Engine core initialization failed. See root cause above. Failed core proc(s): {}
```

The FlashInfer sampler fails to build in the same way on this node. So our sweep tool starts vLLM with `VLLM_USE_FLASHINFER_SAMPLER=0`.

Pick the Triton backend. It reads an FP8 KV cache and does not use the FlashInfer build. Also turn off the FlashInfer sampler, as our sweep tool does:

```bash
VLLM_USE_FLASHINFER_SAMPLER=0 vllm serve Qwen/Qwen3-8B --kv-cache-dtype fp8 --attention-backend TRITON_ATTN
```

[The attention backend page](#s-change-the-attention-backend-only-for-a-reason) explains how vLLM picks a backend.

## See what our run shows

**We measured** the FP8 KV cache with the Triton backend against the BF16 default on our L4 with `Qwen/Qwen3-8B` on 2026-10-22. Both ran in [the throttled session](#l4-sessions), at 1 and 32 users.

We held the pool at 24,096 tokens in both runs, as a [fixed pool](#s-count-the-memory-before-you-pick-a-gpu). So this run does not show the larger pool. It shows only the change in speed.

| Users, L4 throttled session | Median TPOT, BF16 / FP8 | Output tok/s, BF16 / FP8 | Median SM clock, BF16 / FP8 | Seeds, BF16 / FP8 |
|---|---|---|---|---|
| 1 | 104.1 / 101.8 ms | 10.59 / 10.75 | 210 / 210 MHz | 3 / 2 |
| 32 | 142.7 / 138.0 ms | 186.68 / 192.00 | 450 / 480 MHz | 3 / 2 |

At one user, FP8 was 2.3 percent faster per token, at the same clock, and the seed ranges did not overlap. At 32 users, the seed ranges overlapped, and the FP8 run had a higher clock. So we do not claim a gain at 32 users.

Two things changed together: the KV data type and the backend. The table does not show which one gave the gain. The GPU was throttled for both runs, so read the ratio, not the times.

## Check the accuracy

On 2026-10-23 we ran the first 500 GSM8K questions, 8-shot and greedy, on our L4. Qwen3-8B has no KV scales, so the FP8 KV runs used a scale of 1.0. The FP8 KV runs used the Triton backend, as above.

```listing
title: GSM8K accuracy, 500 questions, 8-shot, Qwen3-8B on vLLM 0.31.0
source: capture/gpu/out-l4/gsm8k-fp8-accuracy.txt
lang: text
note: The vLLM rows. The SGLang rows of the same file are cut.
---
engine   config                     correct   accuracy   Wilson 95% interval
…
vLLM     BF16                       459/500   91.8%      89.1 to 93.9
vLLM     FP8 weights                453/500   90.6%      87.7 to 92.9
vLLM     FP8 KV cache               454/500   90.8%      87.9 to 93.0
vLLM     FP8 weights + FP8 KV       453/500   90.6%      87.7 to 92.9
```

Every interval overlaps the BF16 interval, so this run did not show a difference. With 500 questions, it cannot rule out a loss of a few points. That is one model and one benchmark, so run the same check on your model and your task. A model with a different attention layout can lose more.

The post "The State of FP8 KV-Cache and Attention Quantization in vLLM" on the vLLM blog, of April 2026, tested uncalibrated FP8 KV caches. Its authors are from AWS and Red Hat. In their tests, most models stayed close to BF16. Some did not. They name Kimi-K2.5, which uses the FlashMLA backend, as a model that did not work well with uncalibrated scales. We did not measure these results ourselves.

### Check that your scales load

A checkpoint with calibrated scales does not always use them. At 0.31.0, issue 54623 reports that the Qwen3.5 model family never loads its KV scales. Issue 60333 reports the same for one MTP draft loader. Both issues are open.

First, look for the scales in the checkpoint. Search the weight index in the Hugging Face cache for tensor names that end in `k_scale` or `v_scale`. Change the model folder name to your model:

```bash
grep -oE '"[^"]*(k|v)_scale"' ~/.cache/huggingface/hub/models--Qwen--Qwen3-8B/snapshots/*/model.safetensors.index.json | head
```

No output means that the checkpoint has no scales.

A checkpoint with one weight file has no index. For it, list the tensor names with the `safetensors` Python package.

Then read the startup log. The warning `Using KV cache scaling factor 1.0` means that vLLM uses a scale of 1.0. If the checkpoint has scales and the log still shows the warning, the loader dropped them.

Last, run your own prompts with and without FP8, and compare the answers before you go to production.

## Know what changed after 0.31.0

Release 0.32.0 adds an NVFP4 KV cache on SM 8.x and SM 12.x GPUs, which include the L4 and the GB10. It stores fewer bytes per token than FP8. We did not test it.

```takeaways
- Read the attention backend line after you change the KV data type.
- If the FlashInfer build fails, start with --attention-backend TRITON_ATTN.
- Check for the scale 1.0 warning and test quality on your own prompts.
```

Sources: capture/gpu/summary/l4.json (load.vllm-fast-b, load.vllm-kv-fp8-triton), capture/gpu/incidents/l4-vllm-kv-fp8-flashinfer-attention-jit.txt, capture/gpu/incidents/l4-vllm-flashinfer-jit.txt, the vLLM source at v0.31.0 (vllm/platforms/cuda.py, vllm/v1/attention/backends/fa_utils.py, vllm/v1/attention/backends/triton_attn.py), vLLM documentation at v0.31.0 (docs/features/quantization/quantized_kvcache.md), the vLLM blog post The State of FP8 KV-Cache and Attention Quantization in vLLM (2026-04-22), vLLM issues 54623 and 60333, the release notes for v0.32.0 (NVFP4 KV cache), capture/gpu/out-l4/gsm8k-fp8-accuracy.txt.
