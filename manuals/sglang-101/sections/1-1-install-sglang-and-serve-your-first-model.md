# Install SGLang and serve your first model

> In about ten minutes, we install SGLang, start a server on one GPU, and get the same answers from it that our recorded run got.

We start from a Linux machine with one NVIDIA GPU and its driver. We end with a server on port 30000 that answers `curl` and the OpenAI Python client.

When you finish this section, you can install SGLang with uv or Docker and start a server. You can also compare its first answers with ours and fix the common start errors.

## What you need

- Linux with one NVIDIA GPU and a driver for CUDA 13. SGLang 0.5.22 publishes CUDA 13 wheels and images only {{docs}}.
- 24 GB of GPU memory for the model in this section, `Qwen/Qwen3-8B`. With less memory, use `Qwen/Qwen3-0.6B`. The steps stay the same, and the numbers in the output change.
- About 16 GB of free disk for the weights of `Qwen/Qwen3-8B`.
- Docker with the NVIDIA Container Toolkit, or Python 3.11 or newer with `uv`.

We recorded every output in this section on an NVIDIA L4 with 24 GB. The listings name the capture file, so you can compare your run with ours line by line.

## Check the GPU

First, check that the driver can see the GPU:

```bash
nvidia-smi
```

The table names your GPU and the driver version. If the command is not found, install the NVIDIA driver before you go on. SGLang cannot start without it.

## Install SGLang

Choose one path. Use Docker on a machine that has only the GPU driver. Use uv on a machine that already has the full CUDA toolkit, including `nvcc`.

On an L4 host with only a driver, `pip install sglang==0.5.22` finished with no error. Then the first four starts of the server failed, each on a different missing part of the toolkit. [Section 7.1](#s-operating-sglang) lists the four errors and the repairs.

### With Docker

Pull the image for the version this manual tests:

```bash
docker pull lmsysorg/sglang:v0.5.22
```

We pin the tag. The `latest` tag moves to each new release, and the releases change defaults.

### With uv

Create an environment and install SGLang with the version pinned:

```bash
uv venv --python 3.12
source .venv/bin/activate
uv pip install --prerelease=allow "sglang==0.5.22"
```

Keep `--prerelease=allow`. Some dependencies of SGLang publish only prereleases, and without the flag an older uv installs SGLang 0.5.9 with no warning {{docs}}.

Now check the version:

```bash
sglang version
```

```listing
title: the installed version
source: capture/gpu/out-gb10/sglang-version.txt
lang: text
---
$ sglang version
sglang version: 0.5.22
git revision: N/A
```

If you see another version, the install picked another release. Run the install command again with the version pinned.

## Start the server

Start the server in the environment where you installed SGLang. This is the command of our recorded L4 run:

```bash
sglang serve --model-path Qwen/Qwen3-8B --host 127.0.0.1 --port 30000 \
  --enable-cache-report --enable-metrics --mem-fraction-static 0.85
```

With Docker, run the same server inside the container. Mount your Hugging Face cache, so the weights download once:

```bash
docker run --rm --gpus all --ipc=host --shm-size 32g -p 127.0.0.1:30000:30000 \
  -v "$HOME/.cache/huggingface:/root/.cache/huggingface" \
  lmsysorg/sglang:v0.5.22 \
  sglang serve --model-path Qwen/Qwen3-8B --host 0.0.0.0 --port 30000 \
  --enable-cache-report --enable-metrics --mem-fraction-static 0.85
```

We ran the uv path. The Docker command follows the SGLang install page {{docs}}. It uses `--host 0.0.0.0` because the port must be open outside the container. The `127.0.0.1:` prefix on `-p` keeps that port on your own machine. The server has no API key, so do not publish it on a network interface.

Three flags in the command are our choice:

- `--enable-cache-report` puts `cached_tokens` in every response. Without it, a client cannot see the cache hits of its own request.
- `--enable-metrics` turns on the `/metrics` endpoint, which [section 1.2](#s-check-that-the-server-is-healthy) reads.
- `--mem-fraction-static 0.85` sets how much GPU memory SGLang takes. [Section 3.2](#s-mem-fraction-static-and-startup-sizing) shows how to choose the value.

The first start downloads the weights. Then the server sizes its memory and prepares its kernels. Wait for the last line of this listing:

```listing
title: the startup lines of our L4 server
source: capture/gpu/out-l4/server-default.log
lang: text
note: Five lines from the startup log. The import, download, and warning lines between them are cut.
---
[2026-10-17 14:42:45] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 22939, K size: 1.58 GB, V size: 1.58 GB
…
[2026-10-17 14:43:36] max_total_num_tokens=22939, chunked_prefill_size=4096, max_prefill_tokens=16384, max_running_requests=2048, context_len=40960, available_gpu_mem=1.31 GB
…
[2026-10-17 14:43:36] Tree cache initialized: source=default impl=UnifiedRadixCache hybrid_swa=False hybrid_ssm=False hicache_attached=False
[2026-10-17 14:43:37] Engine startup timings (s): load_weight=3.73, kv_cache_allocation=0.40, scheduler_e2e=59.11, cuda_graph={prefill=48.33, decode=2.61, target_verify=0.00, draft_prefill=0.00, draft_decode=0.00, draft_extend=0.00}, tokenizer_e2e=69.10
…
[2026-10-17 14:43:38] The server is fired up and ready to roll!
```

Our weights were already on disk, so loading them took 3.73 s. The start still took about a minute. Most of that minute, 48.33 s, went to the capture of CUDA graphs for prefill. A later start on the same machine can reuse the compiled kernels from `~/.cache/sglang`.

### If the server does not start

Read the last error line in the log, then find it here:

- **The log names `Python.h`, `nvcc`, or `-lcudart`.** The host has no full CUDA toolkit. Use the Docker path, or apply the four repairs in [section 7.1](#s-operating-sglang).
- **The log says the GPU is out of memory.** The model and its cache do not fit. Lower `--mem-fraction-static`, or use a smaller model. [Section 3.2](#s-mem-fraction-static-and-startup-sizing) shows the crash and the fix.
- **The download fails.** Check the network and the model name. With `HF_HUB_OFFLINE=1`, the model must already be in the cache.
- **Another program uses port 30000.** Start the server with `--port 30001`, and use that port in every request below.

## Send a request with curl

Open a second terminal. Send a request to the native API of SGLang:

```bash
curl -s http://127.0.0.1:30000/generate \
  -H 'Content-Type: application/json' \
  -d '{"text": "The capital of France is", "sampling_params": {"max_new_tokens": 12, "temperature": 0}}'
```

Our L4 server answered like this:

```listing
title: the answer from the native API
source: capture/gpu/out-l4/generate.txt
lang: json
note: Cut from the /generate response. The token ids, the request id, and the timing fields other than e2e_latency are cut.
---
  "text": " Paris. The capital of Italy is Rome. The capital of",
…
  "meta_info": {
…
    "finish_reason": {
      "type": "length",
      "length": 12
…
    "prompt_tokens": 5,
…
    "completion_tokens": 12,
    "cached_tokens": 2,
…
    "e2e_latency": 0.7252887019421905,
```

At temperature 0, your text with `Qwen/Qwen3-8B` can match ours word for word. The answer stopped after 12 tokens because we asked for 12, and `finish_reason` says `length`.

Two of the five prompt tokens were already in the cache. At startup, the server sent itself the prompt "The capital city of France is". Our prompt shares its first two tokens with that warm-up prompt, so the prefix cache skipped them.

## Send the same question through the OpenAI API

Most clients use the OpenAI chat API, and SGLang serves it on the same port. First, send a chat request with curl:

```bash
curl -s http://127.0.0.1:30000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model": "default", "messages": [{"role": "user", "content": "Name one planet. Answer in one word."}], "max_tokens": 64, "temperature": 0, "chat_template_kwargs": {"enable_thinking": false}}'
```

```listing
title: the answer from the OpenAI chat API
source: capture/gpu/out-l4/generate.txt
lang: json
note: Cut from the /v1/chat/completions response. The id, the timestamp, and the metadata block are cut.
---
  "model": "default",
…
      "message": {
        "role": "assistant",
        "content": "Earth",
…
      "finish_reason": "stop",
…
  "usage": {
    "prompt_tokens": 21,
    "total_tokens": 23,
    "completion_tokens": 2,
    "prompt_tokens_details": {
      "cached_tokens": 0
    },
    "reasoning_tokens": 0
```

The question has seven words and became 21 prompt tokens. The chat template adds role markers around the message, so count them when you plan the context length. `"enable_thinking": false` turns off the thinking mode of Qwen3, so the answer is one word, and `reasoning_tokens` is 0.

Now send the same request from Python with the OpenAI client:

```python
from openai import OpenAI

client = OpenAI(base_url="http://127.0.0.1:30000/v1", api_key="none")
response = client.chat.completions.create(
    model="default",
    messages=[{"role": "user", "content": "Name one planet. Answer in one word."}],
    max_tokens=64,
    temperature=0,
    extra_body={"chat_template_kwargs": {"enable_thinking": False}},
)
print(response.choices[0].message.content)
```

The script prints the `content` field of the response. Our capture sent the same JSON body with the Python standard library and got `Earth`. Without `--api-key` on the server, SGLang does not check the key, so any value works.

## Stop the server

Press **Ctrl+C** in the server terminal to stop the server {{docs}}. In production, send the stop signal to the main process only. [Section 7.1](#s-operating-sglang) explains why.

## On an Apple silicon Mac

SGLang also runs on Apple silicon through its MLX backend. You need macOS 14 or newer and about 8 GB of free disk. Install SGLang from the tag with the MLX extra:

```bash
git clone --branch v0.5.22 --depth 1 https://github.com/sgl-project/sglang.git
cd sglang
uv venv -p 3.12 .venv && source .venv/bin/activate
cp python/pyproject_other.toml python/pyproject.toml
uv pip install -e "python[srt_mps]"
```

On our Mac, the install took 3 minutes and 15 seconds. Start a server with a small 4-bit model:

```bash
SGLANG_USE_MLX=1 sglang serve --model-path mlx-community/Qwen3-0.6B-4bit \
  --disable-cuda-graph --enable-cache-report --mem-fraction-static 0.4
```

Then send the same `/generate` request as above. Our Mac answered " Paris, and the capital of Germany is Berlin. The capital". The smaller model gives other text, and the token counts stay the same. Set `--mem-fraction-static` on a Mac that you also use for other work. [Section 3.2](#s-mem-fraction-static-and-startup-sizing) shows the crash we got without it.

```takeaways
- Pin the SGLang version in the install command and in the image tag.
- Use the Docker image on a host that has only the GPU driver.
- Start the server with --enable-cache-report and --enable-metrics.
- Wait for the ready line before you send the first request.
- Compare your first answers with the recorded ones before you change any setting.
```

Sources: capture/gpu/out-gb10/sglang-version.txt, capture/gpu/out-l4/server-default.command.txt, capture/gpu/out-l4/server-default.log, capture/gpu/out-l4/generate.txt, capture/gpu/out-l4/environment.json, capture/one_request.py, capture/gpu/incidents/l4-toolchain-failures.txt, capture/out/generate.txt; docs/docs/get-started/install.mdx and docs/docs/get-started/quickstart.mdx at v0.5.22; docs/docs/hardware-platforms/apple_metal.mdx and python/pyproject_other.toml at v0.5.22.
