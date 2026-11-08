# Version pins

> This page lists the versions of vLLM, PyTorch, CUDA, and the images that our runs used.

Use this page to match your setup to ours before you compare a number.

## vLLM

| Item | Value |
|---|---|
| Release | 0.31.0 |
| Tag commit | `db9527a46873454610df6dbedf79a36d6bf1a7f6`, dated 2026-10-02 |
| GitHub release | published 2026-10-05 |
| PyTorch that the CUDA wheel requires | 2.13.0 |
| CUDA of the default image | 13.0 |
| Python of the default image | 3.12 |

## The machines

| Item | NVIDIA L4 | DGX Spark |
|---|---|---|
| GPU | NVIDIA L4, compute capability 8.9 | NVIDIA GB10, compute capability 12.1 |
| Memory | 24 GB GDDR6, 22.1 GiB visible | unified LPDDR5x sold as 128 GB, 121.69 GiB visible to the GPU |
| CPU architecture | x86_64 | aarch64 |
| Driver | 615.71.09 | 580.159.03 |
| How vLLM ran | the pip wheel in a virtual environment | the image `vllm/vllm-openai:v0.31.0` |
| Attention backend | FlashAttention 2, by the selection rule for this GPU | FlashAttention 2, named in the startup log as `FLASH_ATTN` |

## Models

| Model | Machine | Use |
|---|---|---|
| `Qwen/Qwen3-8B` | L4 | every L4 run except the FP8 weight run |
| `Qwen/Qwen3-8B-FP8` | L4 | the FP8 weight run |
| `Tengyunw/qwen3_8b_eagle3` | L4 | the EAGLE3 draft |
| `Qwen/Qwen3-30B-A3B-Instruct-2507` | DGX Spark | all GB10 runs |

## The comparison engine and the client

| Item | Value |
|---|---|
| SGLang | 0.5.22, for the head-to-head runs |
| Benchmark client | `sglang.benchmark.serving` from SGLang 0.5.22, with `--backend vllm` for the vLLM runs |
| PyTorch of the client environment | 2.14.1 with CUDA 13.0 |

Sources: the vLLM source at v0.31.0 (requirements/cuda.txt, docker/Dockerfile), the GitHub release list of vllm-project/vllm (fetched 2026-10-21), capture/gpu/summary/l4.json and gb10.json (environment), capture/gpu/out-gb10/server-load-vllm.log.
