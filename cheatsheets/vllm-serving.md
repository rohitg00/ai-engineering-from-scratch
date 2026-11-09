---
id: vllm-serving
title: LLM Serving with vLLM
code: LV
subtitle: Install, start, size, tune and debug a vLLM 0.31.0 server. Flags, defaults, metrics and known failures.
hue: 210
sources: manuals/vllm-101
source_hash: c5e8d324d6b0c26b
---

## Serving stack
type: architecture
from: manuals/vllm-101/sections/8-1-why-vllm-runs-three-kinds-of-process.md, manuals/vllm-101/sections/8-3-how-the-block-pool-manages-kv-memory.md, manuals/vllm-101/sections/1-1-install-vllm-and-serve-your-first-model.md, manuals/vllm-101/sections/1-2-check-that-the-server-is-healthy.md

```arch
node | client | 1,1 | Client | curl or OpenAI SDK | client
node | api | 2,1 | API server | HTTP and tokenizer | process
node | engine | 3,1 | Engine core | scheduler | process
node | gpu | 4,1 | GPU worker | weights and forward pass | gpu
node | kv | 3,2 | KV block pool | 16-token blocks | store
node | metrics | 2,2 | Metrics | /metrics endpoint | store
edge | client | api | HTTP
edge | api | engine | requests
edge | engine | gpu | one step
edge | engine | kv | allocate
edge | api | metrics | read
```

## One request
type: flow
from: manuals/vllm-101/sections/8-2-why-one-token-budget-replaces-a-prefill-phase.md

1. **Budget**: each step has a token budget set by `--max-num-batched-tokens`.
2. **Running requests**: each gets the tokens it needs, up to the budget.
3. **Waiting requests**: admitted while budget and room remain. `--max-num-seqs` limits them.
4. **Memory full**: a running request is stopped and computed again later.

## Start the server
type: annotated-code
lang: bash
from: manuals/vllm-101/sections/1-1-install-vllm-and-serve-your-first-model.md, manuals/vllm-101/sections/1-2-check-that-the-server-is-healthy.md

```bash
uv venv --python 3.12 --seed                       # clean Python 3.12 environment
source .venv/bin/activate                          # use it in this shell
uv pip install vllm==0.31.0 --torch-backend=auto   # pinned install
vllm serve Qwen/Qwen3-0.6B --reasoning-parser qwen3 2>&1 | tee server.log  # start and keep a log
curl http://localhost:8000/v1/models               # run in a second terminal
```

## Tasks
type: task-table
from: manuals/vllm-101/sections/1-1-install-vllm-and-serve-your-first-model.md, manuals/vllm-101/sections/1-2-check-that-the-server-is-healthy.md

| Task | Code |
|---|---|
| Install vLLM 0.31.0 | `uv pip install vllm==0.31.0 --torch-backend=auto` |
| Start a server with the reasoning parser | `vllm serve Qwen/Qwen3-0.6B --reasoning-parser qwen3` |
| Check the health route | `curl -i http://localhost:8000/health` |
| List the model name | `curl http://localhost:8000/v1/models` |
| Turn the thinking off for one request | `"chat_template_kwargs": {"enable_thinking": false}` |

## Commands
type: command-table
from: manuals/vllm-101/sections/1-1-install-vllm-and-serve-your-first-model.md

| Command | What it does |
|---|---|
| `vllm --version` | Prints the installed version. It must read `0.31.0`. |
| `docker logs` | Reads the log of the container that runs the server. |
| `nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv` | Prints the GPU name, memory and driver. |

## Defaults
type: defaults
from: manuals/vllm-101/sections/r-1-flags-and-defaults.md

| Setting | Default | Note |
|---|---|---|
| `--host` | every network interface | Set `127.0.0.1` for a local test |
| `--port` | 8000 | HTTP port of the server |
| `--gpu-memory-utilization` | 0.92 | Share of total GPU memory for one instance |
| `--max-num-batched-tokens` | 2048 | Under 70 GiB of GPU memory. 8192 from 70 GiB |
| `--max-num-seqs` | 256 | Under 70 GiB of GPU memory. 1024 from 70 GiB |
| `--block-size` | 16 | Tokens in one KV block |
| `--kv-cache-dtype` | `auto` | Model data type. `fp8` halves the bytes per token |
| `-O0` to `-O3` | `-O2` | Compile and CUDA graph level |

## Key terms
type: concepts
from: manuals/vllm-101/sections/8-3-how-the-block-pool-manages-kv-memory.md, manuals/vllm-101/sections/8-2-why-one-token-budget-replaces-a-prefill-phase.md

- **Prefix hash**: a hash of a block and the block before it, so one hash names a whole prefix.
- **Preemption**: vLLM stops a request to free its blocks and computes it again later.

## Troubleshooting
type: troubleshooting
from: manuals/vllm-101/sections/7-1-troubleshoot-by-symptom.md

| Symptom | Cause | Fix |
|---|---|---|
| Start stops about KV cache and maximum length | One request at `--max-model-len` needs more KV cache than is left | Set `--max-model-len` to your longest request |
| Start stops with nvcc missing | FlashInfer compiles at first start and the host has no CUDA toolkit | Install the toolkit, set `CUDA_HOME`, and start again |
| Server crashes after an FP8 KV cache | The FP8 cache selects FlashInfer, which cannot compile here | Add `--attention-backend TRITON_ATTN` |
| Answer starts with a long thinking block | A reasoning model runs without a parser | Start with `--reasoning-parser qwen3` |
| HTTP 400 about maximum context length | Prompt tokens plus `max_tokens` exceed `--max-model-len` | Send a shorter prompt or a smaller `max_tokens` |
| Second benchmark run is faster | A fixed seed repeats prompts and the prefix cache serves them | Reset the prefix cache and use a new seed |

## Glossary
type: glossary
from: manuals/vllm-101/sections/8-1-why-vllm-runs-three-kinds-of-process.md, manuals/vllm-101/sections/8-3-how-the-block-pool-manages-kv-memory.md, manuals/vllm-101/sections/8-2-why-one-token-budget-replaces-a-prefill-phase.md

- **API server**: the process that serves HTTP, tokenizes and streams the answer.
- **Engine core**: the process that runs the scheduler and the KV cache manager.
- **Block**: a fixed group of 16 tokens in the KV cache.
- **Preemption**: stopping a running request to free its blocks, then computing it again.

## Questions
type: qa
from: manuals/vllm-101/sections/1-2-check-that-the-server-is-healthy.md, manuals/vllm-101/sections/1-1-install-vllm-and-serve-your-first-model.md, manuals/vllm-101/sections/8-2-why-one-token-budget-replaces-a-prefill-phase.md, manuals/vllm-101/sections/8-3-how-the-block-pool-manages-kv-memory.md

- **Does a 200 from /health prove a request completes?** No. The route does not generate a token.
- **Why is the answer empty with `finish_reason` set to length?** The thinking used all of `max_tokens`. Raise `max_tokens` or turn the thinking off.
- **Why does the scheduler serve decode first?** Each running request takes its tokens from the budget first, so the stream stays smooth.
- **Why are blocks not reserved per request?** No memory sits reserved for a length the request never reaches.

## Tips
type: tips
from: manuals/vllm-101/sections/1-1-install-vllm-and-serve-your-first-model.md, manuals/vllm-101/sections/1-2-check-that-the-server-is-healthy.md, manuals/vllm-101/sections/7-1-troubleshoot-by-symptom.md

- Keep the log with `tee server.log`, and read the startup lines at every start.
- On the pip path, install the CUDA toolkit before the first start.
- Use the health route for liveness, and one real request for readiness.
- Read the symptom section before you change a flag.
