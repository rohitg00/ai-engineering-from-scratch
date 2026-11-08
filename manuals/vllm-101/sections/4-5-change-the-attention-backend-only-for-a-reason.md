# Change the attention backend only for a reason

> vLLM picks the attention backend for your GPU, and you have two reasons to override it.

A forum post says a different attention backend is faster. When you finish this section, you can read the backend vLLM picked and decide when to override it.

**Our result:** on our L4, a forced Triton backend fixed a start that failed in the backend vLLM picked.

## Read the backend vLLM picked

vLLM writes one line at startup that names the backend and the other backends that could run. Search the log for it:

```bash
grep "attention backend" server.log
```

On our DGX Spark, with `Qwen3-30B-A3B` and the default settings, the line was:

```listing
title: the attention backend line on our DGX Spark
source: capture/gpu/out-gb10/server-load-vllm.log
lang: text
note: The list holds only the backends that can run with this model and these settings, in the order vLLM tries them.
---
(EngineCore pid=143) INFO 10-21 10:53:17 [cuda.py:526] Using FLASH_ATTN attention backend out of potential backends: ['FLASH_ATTN', 'FLASHINFER', 'TRITON_ATTN', 'FLEX_ATTENTION'].
```

## Know the order vLLM tries

vLLM has one list of backends for each GPU class. It removes each backend that cannot run with your model and your settings, and it picks the first one that is left. For a standard model in vLLM 0.31.0, the order is:

| GPU | Examples | Order |
|---|---|---|
| SM 10.x | B200, GB200 | FlashInfer, FlashAttention, Triton, FlexAttention, TurboQuant |
| other NVIDIA GPUs | L4 (SM 8.9), H100 (SM 9.0), DGX Spark (SM 12.1) | FlashAttention, FlashInfer, Triton, FlexAttention, TurboQuant |

The reasons for each removal go to the debug log, not to the info log. To see them, compare the list in the startup line with the table. A backend that is missing from the list was removed.

## Know the switch that an FP8 KV cache makes

In vLLM 0.31.0, FlashAttention reads an FP8 KV cache only on SM 9.0 and on the SM 10.x family. So on an L4 or a DGX Spark, `--kv-cache-dtype fp8` changes the backend with no warning. [The FP8 KV cache page](#s-fit-more-users-with-an-fp8-kv-cache) tells what happened on our L4.

## Force a backend

Set the backend with `--attention-backend`:

```bash
vllm serve Qwen/Qwen3-8B --kv-cache-dtype fp8 --attention-backend TRITON_ATTN
```

If the backend you set cannot run with your model and settings, vLLM stops at startup with an error that gives the reason. It does not move to another backend. So a forced backend is safe to try: it runs, or it fails at once.

`--block-size` also removes backends. If it removes a backend that is higher in the list, vLLM writes a warning that names it.

## See what our run shows

Our only forced-backend run changed the backend and the KV data type together, so [its result](#s-fit-more-users-with-an-fp8-kv-cache) does not show which backend is faster. We have not compared backends with one KV data type on any of our GPUs.

## Decide

Leave the backend to vLLM. Override it for one of two reasons:

- The start fails in the backend that vLLM picked, as FlashInfer did on our L4.
- You measured a slowdown on your own load, and a different backend fixed it on the same load.

A forum post that says a backend is faster tested a different GPU, model, or load. Measure on yours before you change it.

```takeaways
- Read the attention backend line in the startup log before you change it.
- Override the backend only to fix a startup failure or a measured slowdown.
- Expect a forced backend that cannot run to stop the start with a reason.
```

Sources: capture/gpu/out-gb10/server-load-vllm.log, capture/gpu/incidents/l4-vllm-kv-fp8-flashinfer-attention-jit.txt, capture/gpu/summary/l4.json (load.vllm-fast-b, load.vllm-kv-fp8-triton), the vLLM source at v0.31.0 (vllm/platforms/cuda.py, vllm/v1/attention/backends/fa_utils.py, vllm/v1/attention/backends/flash_attn.py).
