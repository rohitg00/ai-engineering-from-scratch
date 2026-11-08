# Install vLLM and serve your first model

> You can go from an empty machine to a streamed token from your own vLLM server with three commands and one request.

You have an NVIDIA GPU and a model name, and you want your own OpenAI-compatible endpoint. When you finish this section, you can install vLLM, start a server, send it a request, and read the startup log.

We use vLLM 0.31.0 in every command. vLLM publishes a new minor release about every two weeks, so pin the version in your install command.

## Check the GPU first

First, check that the driver sees your GPU. Run this command:

```bash
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv
```

You see one line for each GPU, with its name and its memory. If the command is not found, install the NVIDIA driver before you continue. vLLM does not install the driver for you.

Check the rest of your machine against this table. It comes from the vLLM 0.31.0 install guide. We did not test the lower limits.

| You need | Value at 0.31.0 |
|---|---|
| Operating system | Linux, or WSL on Windows, for the uv and pip paths. Docker needs a host with the NVIDIA container toolkit |
| GPU | NVIDIA, compute capability 7.5 or higher, such as a T4, an L4, an A100, or an H100 |
| Driver | new enough for CUDA 12.9 for the default wheel, and R580 or newer for the CUDA 13 image |
| Python | 3.10 to 3.13 |
| Hugging Face token | only for a model with restricted access, set as `HF_TOKEN` |

## Install vLLM

Pick one of three paths. Use the first path unless you have a reason to pick another.

**Path 1, uv.** uv creates a clean Python environment and picks the PyTorch build that matches your CUDA driver.

```bash
uv venv --python 3.12 --seed
source .venv/bin/activate
uv pip install vllm==0.31.0 --torch-backend=auto
```

**Path 2, pip.** Use a new virtual environment with Python 3.12, then install the same version.

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install vllm==0.31.0
```

**Path 3, Docker.** The official image holds vLLM, PyTorch, and CUDA. We pulled `vllm/vllm-openai:v0.31.0` on our arm64 DGX Spark, and it ran.

```bash
docker run --rm --gpus all --ipc=host -p 8000:8000 \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  vllm/vllm-openai:v0.31.0 Qwen/Qwen3-0.6B --reasoning-parser qwen3
```

The image starts the server for you, so with Docker you skip the next step. Mount your Hugging Face cache, or the container downloads the weights again on every start. Read the log with `docker logs` on the container.

Check the install with `vllm --version`. You see `0.31.0`.

On the uv and pip paths, the first start compiles FlashInfer kernels, so it needs a CUDA toolkit with `nvcc`, and `CUDA_HOME` set to it. The Docker image has one. We installed vLLM 0.31.0 with uv on a host with only a driver, and every start stopped with `Could not find nvcc`. Install the toolkit, set `CUDA_HOME`, and start again. [The troubleshooting page](#s-troubleshoot-by-symptom) covers this and a toolkit that does not match.

## Start the server

Now, start a small model. Qwen3-0.6B has 0.6 billion parameters, so its BF16 weights need about 1.2 GB.

```bash
vllm serve Qwen/Qwen3-0.6B --reasoning-parser qwen3 2>&1 | tee server.log
```

The server listens on port 8000. The first start downloads the weights, so it takes longer than the next start.

The `tee` command shows the log in the terminal and also writes it to `server.log`. Later pages search that file with `grep`, so keep this name for every start.

Qwen3 is a reasoning model. It writes its thinking first, between `<think>` tags, and then the answer. `--reasoning-parser qwen3` tells vLLM to move the thinking out of the answer text. Without it, the thinking stays at the start of the answer. [The reasoning models page](#s-serve-reasoning-models) explains the parser.

The startup log is long. Six lines tell you most of what you need. The listing shows them from our DGX Spark, where we served the larger Qwen3-30B-A3B. Your lines have the same shape with smaller numbers.

```listing
title: the startup lines to read, from a DGX Spark
source: capture/gpu/out-gb10/server-load-vllm.log
lang: text
note: Six lines cut from the start of the log. The banner, the full engine config, and the route list are cut.
---
(APIServer pid=1) INFO 10-21 10:53:02 [api_utils.py:347]  ▄▄ ▄█ █     █     █ ▀▄▀ █  version 0.31.0
(EngineCore pid=143) INFO 10-21 10:53:14 [gpu_worker.py:479] Using V2 Model Runner
(EngineCore pid=143) INFO 10-21 10:53:17 [cuda.py:526] Using FLASH_ATTN attention backend out of potential backends: ['FLASH_ATTN', 'FLASHINFER', 'TRITON_ATTN', 'FLEX_ATTENTION'].
(EngineCore pid=143) INFO 10-21 10:58:45 [model_runner.py:407] Model loading took 56.93 GiB memory and 330.542793 seconds
(EngineCore pid=143) INFO 10-21 10:59:46 [gpu_worker.py:692] Available KV cache memory: 31.32 GiB
(EngineCore pid=143) INFO 10-21 10:59:46 [kv_cache_utils.py:2464] GPU KV cache size: 234,960 tokens, Maximum concurrency for 8,192 tokens per request: 28.68x
```

Read the lines in this order:

1. **The version.** It must match the version you pinned.
2. **The model runner.** vLLM 0.31.0 uses the V2 model runner on CUDA by default. Some features switch it back to V1, and this line shows it.
3. **The attention backend.** vLLM picks one for your GPU. A change to the KV cache data type can change this line.
4. **Model loading.** This line gives the memory that the weights took and the time to load them.
5. **The available KV cache memory.** This line gives the memory that is left for the KV cache after the weights and the startup profile.
6. **The KV cache size.** This line gives the tokens that fit in the cache and the number of full-length requests that fit at the same time. Part 2 starts from this line.

The server is ready when the log shows `Application startup complete.`. On our DGX Spark, that took about eight minutes for 57 GiB of weights. The model loading line gives 330.5 seconds, and 325 of those seconds went to reading the weight files.

```figure
id: fig-1-2
kind: structure
title: the six startup lines to read
claim: Six startup lines show the version, the runner, the attention backend, the weight memory, the free KV memory, and the pool size.
caption: Read each row from left to right: the log line, our value on the DGX Spark, and what it decides. From capture/gpu/out-gb10/server-load-vllm.log.
```

## Send the first request

Open a second terminal. Send one chat request with curl:

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "Qwen/Qwen3-0.6B", "messages": [{"role": "user", "content": "Name three prime numbers."}], "max_tokens": 64, "chat_template_kwargs": {"enable_thinking": false}}'
```

The `chat_template_kwargs` field turns the thinking off for this one request, so 64 tokens are enough for the answer. The reply is one JSON object. The answer text is in `choices[0].message.content`, and the token counts are in `usage`. In the server log, a new line shows the request path and `200 OK`.

If you leave the thinking on, the model can spend all 64 tokens on it. The thinking then goes to the `reasoning` field, `content` is null, and `finish_reason` is `length`. We saw exactly this on an L4. Give a thinking request a much larger `max_tokens`.

The server speaks the OpenAI API, so the OpenAI Python client works without a change to your code:

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="EMPTY")
stream = client.chat.completions.create(
    model="Qwen/Qwen3-0.6B",
    messages=[{"role": "user", "content": "Name three prime numbers."}],
    stream=True,
    extra_body={"chat_template_kwargs": {"enable_thinking": False}},
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)
```

The tokens print one by one as the server streams them. That is your first streamed token.

## When the output is different

- **The server stops with an out-of-memory error.** Another program uses the GPU, or the model is too large. Read [the out-of-memory page](#s-fix-out-of-memory-at-startup).
- **The answer starts with a long `<think>` block.** The server runs without a reasoning parser. Start it with `--reasoning-parser qwen3`, or send `"chat_template_kwargs": {"enable_thinking": false}` in the request.
- **The answer is empty and `finish_reason` is `length`.** The thinking used all of `max_tokens`. Raise `max_tokens`, or turn the thinking off for the request.
- **The request returns 404.** The model name in the request must match the name in `vllm serve`. Run `curl http://localhost:8000/v1/models` to see it.
- **The answers use different sampling than you set.** By default, vLLM applies the sampling settings from the model repository. Start the server with `--generation-config vllm` to use the vLLM defaults.
- **The start takes many minutes.** The first start downloads the weights. On a DGX Spark, weight loading is slow in 0.31.0 for large models.

```takeaways
- Pin the vLLM version in every install command.
- Start the server with `tee server.log`, and read the six startup lines at every start.
- Send one request with curl before you connect an application.
```

Sources: vLLM documentation at v0.31.0 (docs/getting_started/quickstart.md, docs/getting_started/installation/gpu.md, docs/getting_started/installation/gpu.cuda.inc.md, docs/deployment/docker.md, docs/features/reasoning_outputs.md), capture/gpu/out-gb10/server-load-vllm.log, issue 58726, capture/gpu/out-l4/livecheck-2026-10-23.txt.
