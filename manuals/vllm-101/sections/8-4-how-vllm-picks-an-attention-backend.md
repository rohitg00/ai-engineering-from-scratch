# How vLLM picks an attention backend

> This page explains the selection order for each GPU class and what vLLM picks when the first choice cannot run.

The attention kernel is the one part of the forward pass that changes most between GPUs. When you finish this section, you can predict the backend vLLM picks on your GPU, and explain why one flag change can swap it.

## A list for each GPU class

vLLM 0.31.0 has more than 30 attention backends. On a CUDA GPU, it walks an ordered list and takes the first backend that can run the model with your settings. For a model with standard attention, the list is:

| GPU | Order |
|---|---|
| Blackwell datacenter GPUs, such as the B200 | FlashInfer, FlashAttention, Triton, FlexAttention, TurboQuant |
| Every other CUDA GPU, which includes the L4 and the GB10 | FlashAttention, FlashInfer, Triton, FlexAttention, TurboQuant |

Models with multi-head latent attention, such as the DeepSeek family, have their own lists.

FlashAttention itself has versions. vLLM uses version 3 on Hopper GPUs and version 4 on the Blackwell datacenter GPUs where it is supported. Every other GPU gets version 2, so both our L4 and our GB10 ran FlashAttention 2. Our GB10 log names the choice and the list:

```listing
title: the backend line from a GB10 start
source: capture/gpu/out-gb10/server-load-vllm.log
lang: text
note: vLLM took the first entry of the list.
---
(EngineCore pid=143) INFO 10-21 10:53:17 [cuda.py:526] Using FLASH_ATTN attention backend out of potential backends: ['FLASH_ATTN', 'FLASHINFER', 'TRITON_ATTN', 'FLEX_ATTENTION'].
```

## Why a flag changes the backend

Each backend declares what it supports: the data type of the KV cache, the head size, the block size, and the CUDA graph modes. If your settings ask for something the first backend cannot do, vLLM moves to the next one.

The FP8 KV cache is the common case. On an L4, FlashAttention 2 cannot read an FP8 cache. With `--kv-cache-dtype fp8`, vLLM skips it and picks FlashInfer if it is installed, or Triton if it is not. Your FP8 result then measures a new data type and a new kernel at the same time. On our L4 the FlashInfer build failed, as [the FP8 KV cache page](#s-fit-more-users-with-an-fp8-kv-cache) shows.

## Why the order differs

Our reading: the order reflects which kernels were fastest and best tested on each class when the list was written. FlashInfer has kernels tuned for the Blackwell datacenter GPUs, so it comes first there. On older classes, FlashAttention has the longer record. The list is a judgment that changes between releases, not a law.

That is why the manual tells you to read the backend line after every start, and after every flag change. If two runs used different backends, you compared kernels, not settings. `--attention-backend` pins one backend by its enum name, such as `TRITON_ATTN`.

```takeaways
- vLLM takes the first backend in a list for your GPU class that supports your settings.
- An FP8 KV cache on an L4 swaps FlashAttention 2 for FlashInfer or Triton.
- Read the backend line after every start, and pin the backend when you compare settings.
```

Sources: the vLLM source at v0.31.0 (vllm/platforms/cuda.py, vllm/v1/attention/backends/registry.py, vllm/v1/attention/backends/fa_utils.py), vLLM documentation at v0.31.0 (docs/design/attention_backends.md), vLLM issue 60262, capture/gpu/out-gb10/server-load-vllm.log.
