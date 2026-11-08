<!-- vendored source: Docker Model Runner docs; origin https://docs.docker.com/ai/model-runner/; fetched 2026-10-08; each page is the raw markdown served at the page URL with .md appended; page text is verbatim, only the page marker lines are added -->

<!-- page: https://docs.docker.com/ai/model-runner/ fetched 2026-10-08 -->

# Docker Model Runner




Docker Model Runner (DMR) makes it easy to manage, run, and
deploy AI models using Docker. Designed for developers,
Docker Model Runner streamlines the process of pulling, running, and serving
large language models (LLMs) and other AI models directly from Docker Hub,
any OCI-compliant registry, or [Hugging Face](https://huggingface.co/).

With seamless integration into Docker Desktop and Docker
Engine, you can serve models via OpenAI and Ollama-compatible APIs, package GGUF files as
OCI Artifacts, and interact with models from both the command line and graphical
interface.

Whether you're building generative AI applications, experimenting with machine
learning workflows, or integrating AI into your software development lifecycle,
Docker Model Runner provides a consistent, secure, and efficient way to work
with AI models locally.

## Key features

- [Pull and push models to and from Docker Hub or any OCI-compliant registry](https://hub.docker.com/u/ai)
- [Pull models from Hugging Face](https://huggingface.co/)
- Serve models on [OpenAI and Ollama-compatible APIs](/ai/model-runner/api-reference/) for easy integration with existing apps
- Support for [llama.cpp, vLLM, and Diffusers inference engines](/ai/model-runner/inference-engines/) (vLLM and Diffusers on Linux with NVIDIA GPUs)
- [Generate images from text prompts](/ai/model-runner/inference-engines/#diffusers) using Stable Diffusion models with the Diffusers backend
- Package GGUF and Safetensors files as OCI Artifacts and publish them to any Container Registry
- Run and interact with AI models directly from the command line or from the Docker Desktop GUI
- [Connect to AI coding tools](/ai/model-runner/ide-integrations/) like Cline, Continue, Cursor, and Aider
- [Configure context size and model parameters](/ai/model-runner/configuration/) to tune performance
- [Set up Open WebUI](/ai/model-runner/openwebui-integration/) for a ChatGPT-like web interface
- Manage local models and display logs
- Display prompt and response details
- Conversational context support for multi-turn interactions

## Requirements

Docker Model Runner is supported on the following platforms:

**Windows**



Windows(amd64):
-  NVIDIA GPUs
-  NVIDIA drivers 576.57+

Windows(arm64):
- OpenCL for Adreno
- Qualcomm Adreno GPU (6xx series and later)

  > [!NOTE]
  > Some llama.cpp features might not be fully supported on the 6xx series.

**MacOS**



- Apple Silicon

**Linux**



Docker Engine only:

- Supports CPU, NVIDIA (CUDA), AMD (ROCm), and Vulkan backends
- Requires NVIDIA driver 575.57.08+ when using NVIDIA GPUs



## How Docker Model Runner works

Models are pulled from Docker Hub, an OCI-compliant registry, or
[Hugging Face](https://huggingface.co/) the first time you use them and are
stored locally. They load into memory only at runtime when a request is made,
and unload when not in use to optimize resources. Because models can be large,
the initial pull may take some time. After that, they're cached locally for
faster access. You can interact with the model using
[OpenAI and Ollama-compatible APIs](/ai/model-runner/api-reference/).

### Inference engines

Docker Model Runner supports three inference engines:

| Engine | Best for | Model format |
|--------|----------|--------------|
| [llama.cpp](/ai/model-runner/inference-engines/#llamacpp) | Local development, resource efficiency | GGUF (quantized) |
| [vLLM](/ai/model-runner/inference-engines/#vllm) | Production, high throughput | Safetensors |
| [Diffusers](/ai/model-runner/inference-engines/#diffusers) | Image generation (Stable Diffusion) | Safetensors |

llama.cpp is the default engine and works on all platforms. vLLM requires NVIDIA GPUs and is supported on Linux x86_64 and Windows with WSL2. Diffusers enables image generation and requires NVIDIA GPUs on Linux (x86_64 or ARM64). See [Inference engines](/ai/model-runner/inference-engines/) for detailed comparison and setup.

### Context size

Models have a configurable context size (context length) that determines how many tokens they can process. The default varies by model but is typically 2,048-8,192 tokens. You can adjust this per-model:

```console
$ docker model configure --context-size 8192 ai/qwen2.5-coder
```

See [Configuration options](/ai/model-runner/configuration/) for details on context size and other parameters.

> [!TIP]
>
> Using Testcontainers or Docker Compose?
> [Testcontainers for Java](https://java.testcontainers.org/modules/docker_model_runner/)
> and [Go](https://golang.testcontainers.org/modules/dockermodelrunner/), and
> [Docker Compose](/compose/how-tos/models-and-compose/) support Docker
> Model Runner.

## Security and isolation

### Execution environment

Docker Model Runner isolates inference engines from your host:

- On Linux, Docker Model Runner and its inference engines, such as Diffusers,
  run inside a container, which provides the isolation boundary.
- On macOS and Windows, the engines don't run inside a container, so Docker
  Model Runner runs them in a sandboxed environment (seatbelt/sandbox-exec and Job Objects respectively)

### Networking

The Model Runner API is not authenticated. Any client that can reach it,
including other containers on the same Docker network, can pull, load, and
run models, and send inference requests.

## Known issues

### `docker model` is not recognised

If you run a Docker Model Runner command and see:

```text
docker: 'model' is not a docker command
```

It means Docker can't find the plugin because it's not in the expected CLI plugins directory.

To fix this, create a symlink so Docker can detect it:

```console
$ ln -s /Applications/Docker.app/Contents/Resources/cli-plugins/docker-model ~/.docker/cli-plugins/docker-model
```

Once linked, rerun the command.

## Privacy and data collection

Docker Model Runner respects your privacy settings in Docker Desktop. Data collection is controlled by the **Send usage statistics** setting:

- **Disabled**: No usage data is collected
- **Enabled**: Only minimal, non-personal data is collected:
  - [Model names](https://github.com/docker/model-runner/blob/eb76b5defb1a598396f99001a500a30bbbb48f01/pkg/metrics/metrics.go#L96) (via HEAD requests to Docker Hub)
  - User agent information
  - Whether requests originate from the host or containers

When using Docker Model Runner with Docker Engine, HEAD requests to Docker Hub are made to track model names, regardless of any settings.

No prompt content, responses, or personally identifiable information is ever collected.

## Share feedback

Thanks for trying out Docker Model Runner. To report bugs or request features, [open an issue on GitHub](https://github.com/docker/model-runner/issues). You can also give feedback through the **Give feedback** link next to the **Enable Docker Model Runner** setting.

## Next steps

- [Get started with DMR](/ai/model-runner/get-started/) - Enable DMR and run your first model
- [API reference](/ai/model-runner/api-reference/) - OpenAI and Ollama-compatible API documentation
- [Configuration options](/ai/model-runner/configuration/) - Context size and runtime parameters
- [Inference engines](/ai/model-runner/inference-engines/) - llama.cpp, vLLM, and Diffusers details
- [IDE integrations](/ai/model-runner/ide-integrations/) - Connect Cline, Continue, Cursor, and more
- [Open WebUI integration](/ai/model-runner/openwebui-integration/) - Set up a web chat interface

<!-- page: https://docs.docker.com/ai/model-runner/api-reference/ fetched 2026-10-08 -->

# DMR REST API


Once Model Runner is enabled, new API endpoints are available. You can use
these endpoints to interact with a model programmatically. Docker Model Runner
provides compatibility with OpenAI, Anthropic, and Ollama API formats.

## Determine the base URL

The base URL to interact with the endpoints depends on how you run Docker and
which API format you're using.

**Docker Desktop**



| Access from | Base URL |
|-------------|----------|
| Containers | `http://model-runner.docker.internal` |
| Host processes (TCP) | `http://localhost:12434` |

> [!NOTE]
> TCP host access must be enabled. See [Enable Docker Model Runner](/ai/model-runner/api-reference/get-started/#enable-docker-model-runner-in-docker-desktop).

**Docker Engine**



| Access from | Base URL |
|-------------|----------|
| Containers | `http://172.17.0.1:12434` |
| Host processes | `http://localhost:12434` |

> [!NOTE]
> The `172.17.0.1` interface may not be available by default to containers
  within a Compose project.
> In this case, add an `extra_hosts` directive to your Compose service YAML:
>
> ```yaml
> extra_hosts:
>   - "model-runner.docker.internal:host-gateway"
> ```
> Then you can access the Docker Model Runner APIs at `http://model-runner.docker.internal:12434/`



### Base URLs for third-party tools

When configuring third-party tools that expect OpenAI-compatible APIs, use these base URLs:

| Tool type | Base URL format |
|-----------|-----------------|
| OpenAI SDK / clients | `http://localhost:12434/engines/v1` |
| Anthropic SDK / clients | `http://localhost:12434` |
| Ollama-compatible clients | `http://localhost:12434` |

See [IDE and tool integrations](/ai/model-runner/api-reference/ide-integrations/) for specific configuration examples.

## Supported APIs

Docker Model Runner supports multiple API formats:

| API | Description | Use case |
|-----|-------------|----------|
| [OpenAI API](#openai-compatible-api) | OpenAI-compatible chat completions, embeddings | Most AI frameworks and tools |
| [Anthropic API](#anthropic-compatible-api) | Anthropic-compatible messages endpoint | Tools built for Claude |
| [Ollama API](#ollama-compatible-api) | Ollama-compatible endpoints | Tools built for Ollama |
| [Image Generation API](#image-generation-api-diffusers) | Diffusers-based image generation | Generating images from text prompts |
| [DMR API](#dmr-native-endpoints) | Native Docker Model Runner endpoints | Model management |

## OpenAI-compatible API

DMR implements the OpenAI API specification for maximum compatibility with existing tools and frameworks.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/engines/v1/models` | GET | [List models](https://platform.openai.com/docs/api-reference/models/list) |
| `/engines/v1/models/{namespace}/{name}` | GET | [Retrieve model](https://platform.openai.com/docs/api-reference/models/retrieve) |
| `/engines/v1/chat/completions` | POST | [Create chat completion](https://platform.openai.com/docs/api-reference/chat/create) |
| `/engines/v1/completions` | POST | [Create completion](https://platform.openai.com/docs/api-reference/completions/create) |
| `/engines/v1/embeddings` | POST | [Create embeddings](https://platform.openai.com/docs/api-reference/embeddings/create) |

> [!NOTE]
> You can optionally include the engine name in the path: `/engines/llama.cpp/v1/chat/completions`.
> This is useful when running multiple inference engines.

### Model name format

When specifying a model in API requests, use the full model identifier including the namespace:

```json
{
  "model": "ai/smollm2",
  "messages": [...]
}
```

Common model name formats:
- Docker Hub models: `ai/smollm2`, `ai/llama3.2`, `ai/qwen2.5-coder`
- Tagged versions: `ai/smollm2:360M-Q4_K_M`
- Custom models: `myorg/mymodel`

### Supported parameters

The following OpenAI API parameters are supported:

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | Required. The model identifier. |
| `messages` | array | Required for chat completions. The conversation history. |
| `prompt` | string | Required for completions. The prompt text. |
| `max_tokens` | integer | Maximum tokens to generate. |
| `temperature` | float | Sampling temperature (0.0-2.0). |
| `top_p` | float | Nucleus sampling parameter (0.0-1.0). |
| `stream` | Boolean | Enable streaming responses. |
| `stop` | string/array | Stop sequences. |
| `presence_penalty` | float | Presence penalty (-2.0 to 2.0). |
| `frequency_penalty` | float | Frequency penalty (-2.0 to 2.0). |

### Limitations and differences from OpenAI

Be aware of these differences when using DMR's OpenAI-compatible API:

| Feature | DMR behavior |
|---------|--------------|
| API key | Not required. DMR ignores the `Authorization` header. |
| Function calling | Supported with llama.cpp for compatible models. |
| Vision | Supported for multi-modal models (e.g., LLaVA). |
| JSON mode | Supported via `response_format: {"type": "json_object"}`. |
| Logprobs | Supported. |
| Token counting | Uses the model's native token encoder, which may differ from OpenAI's. |

## Anthropic-compatible API

DMR provides [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages) compatibility for tools and frameworks built for Claude.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/anthropic/v1/messages` | POST | [Create a message](https://platform.claude.com/docs/en/api/messages/create) |
| `/anthropic/v1/messages/count_tokens` | POST | [Count tokens](https://docs.anthropic.com/en/api/messages-count-tokens) |

### Supported parameters

The following Anthropic API parameters are supported:

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | Required. The model identifier. |
| `messages` | array | Required. The conversation messages. |
| `max_tokens` | integer | Maximum tokens to generate. |
| `temperature` | float | Sampling temperature (0.0-1.0). |
| `top_p` | float | Nucleus sampling parameter. |
| `top_k` | integer | Top-k sampling parameter. |
| `stream` | Boolean | Enable streaming responses. |
| `stop_sequences` | array | Custom stop sequences. |
| `system` | string | System prompt. |

### Example: Chat with Anthropic API

```bash
curl http://localhost:12434/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ai/smollm2",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Example: Streaming response

```bash
curl http://localhost:12434/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ai/smollm2",
    "max_tokens": 1024,
    "stream": true,
    "messages": [
      {"role": "user", "content": "Count from 1 to 10"}
    ]
  }'
```

## Ollama-compatible API

DMR also provides Ollama-compatible endpoints for tools and frameworks built for Ollama.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tags` | GET | List available models |
| `/api/show` | POST | Show model information |
| `/api/chat` | POST | Generate chat completion |
| `/api/generate` | POST | Generate completion |
| `/api/embeddings` | POST | Generate embeddings |

### Example: Chat with Ollama API

```bash
curl http://localhost:12434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ai/smollm2",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Example: List models

```bash
curl http://localhost:12434/api/tags
```

## Image generation API (Diffusers)

DMR supports image generation through the Diffusers backend, enabling you to generate
images from text prompts using models like Stable Diffusion.

> [!NOTE]
> The Diffusers backend requires an NVIDIA GPU with CUDA support and is only
> available on Linux (x86_64 and ARM64). See [Inference engines](/ai/model-runner/api-reference/inference-engines/#diffusers)
> for setup instructions.

### Endpoint

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/engines/diffusers/v1/images/generations` | POST | Generate an image from a text prompt |

### Supported parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | Required. The model identifier (e.g., `stable-diffusion:Q4`). |
| `prompt` | string | Required. The text description of the image to generate. |
| `size` | string | Image dimensions in `WIDTHxHEIGHT` format (e.g., `512x512`). |

### Response format

The API returns a JSON response with the generated image encoded in base64:

```json
{
  "data": [
    {
      "b64_json": "<base64-encoded-image-data>"
    }
  ]
}
```

### Example: Generate an image

```bash
curl -s -X POST http://localhost:12434/engines/diffusers/v1/images/generations \
  -H "Content-Type: application/json" \
  -d '{
    "model": "stable-diffusion:Q4",
    "prompt": "A picture of a nice cat",
    "size": "512x512"
  }' | jq -r '.data[0].b64_json' | base64 -d > image.png
```

This command:
1. Sends a POST request to the Diffusers image generation endpoint
2. Specifies the model, prompt, and output image size
3. Extracts the base64-encoded image from the response using `jq`
4. Decodes the base64 data and saves it as `image.png`


## DMR native endpoints

These endpoints are specific to Docker Model Runner for model management:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/models/create` | POST | Pull/create a model |
| `/models` | GET | List local models |
| `/models/{namespace}/{name}` | GET | Get model details |
| `/models/{namespace}/{name}` | DELETE | Delete a local model |

## REST API examples

### Request from within a container

To call the `chat/completions` OpenAI endpoint from within another container using `curl`:

```bash
#!/bin/sh

curl http://model-runner.docker.internal/engines/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "ai/smollm2",
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful assistant."
            },
            {
                "role": "user",
                "content": "Please write 500 words about the fall of Rome."
            }
        ]
    }'

```

### Request from the host using TCP

To call the `chat/completions` OpenAI endpoint from the host via TCP:

1. Enable the host-side TCP support from the Docker Desktop GUI, or via the [Docker Desktop CLI](/desktop/features/desktop-cli/).
   For example: `docker desktop enable model-runner --tcp <port>`.

   If you are running on Windows, also enable GPU-backed inference.
   See [Enable Docker Model Runner](/ai/model-runner/api-reference/get-started/#enable-docker-model-runner-in-docker-desktop).

1. Interact with it as documented in the previous section using `localhost` and the correct port.

```bash
#!/bin/sh

curl http://localhost:12434/engines/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
      "model": "ai/smollm2",
      "messages": [
          {
              "role": "system",
              "content": "You are a helpful assistant."
          },
          {
              "role": "user",
              "content": "Please write 500 words about the fall of Rome."
          }
      ]
  }'
```

### Request from the host using a Unix socket

To call the `chat/completions` OpenAI endpoint through the Docker socket from the host using `curl`:

```bash
#!/bin/sh

curl --unix-socket $HOME/.docker/run/docker.sock \
    localhost/exp/vDD4.40/engines/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "ai/smollm2",
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful assistant."
            },
            {
                "role": "user",
                "content": "Please write 500 words about the fall of Rome."
            }
        ]
    }'
```

### Streaming responses

To receive streaming responses, set `stream: true`:

```bash
curl http://localhost:12434/engines/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
      "model": "ai/smollm2",
      "stream": true,
      "messages": [
          {"role": "user", "content": "Count from 1 to 10"}
      ]
  }'
```

## Using with OpenAI SDKs

### Python

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:12434/engines/v1",
    api_key="not-needed"  # DMR doesn't require an API key
)

response = client.chat.completions.create(
    model="ai/smollm2",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

### Node.js

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:12434/engines/v1',
  apiKey: 'not-needed',
});

const response = await client.chat.completions.create({
  model: 'ai/smollm2',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

## What's next

- [IDE and tool integrations](/ai/model-runner/api-reference/ide-integrations/) - Configure Cline, Continue, Cursor, and other tools
- [Configuration options](/ai/model-runner/api-reference/configuration/) - Adjust context size and runtime parameters
- [Inference engines](/ai/model-runner/api-reference/inference-engines/) - Learn about llama.cpp, vLLM, and Diffusers options

<!-- page: https://docs.docker.com/ai/model-runner/configuration/ fetched 2026-10-08 -->

# Configuration options


Docker Model Runner provides several configuration options to tune model behavior,
memory usage, and inference performance. This guide covers the key settings and
how to apply them.

## Context size (context length)

The context size determines the maximum number of tokens a model can process in
a single request, including both the input prompt and generated output. This is
one of the most important settings affecting memory usage and model capabilities.

### Default context size

By default, Docker Model Runner uses a context size that balances capability with
resource efficiency:

| Engine | Default behavior |
|--------|------------------|
| llama.cpp | 4096 tokens |
| vLLM | Uses the model's maximum trained context size |

> [!NOTE]
> The actual default varies by model. Most models support between 2,048 and 8,192
> tokens by default. Some newer models support 32K, 128K, or even larger contexts.

### Configure context size

You can adjust context size per model using the `docker model configure` command:

```console
$ docker model configure --context-size 8192 ai/qwen2.5-coder
```

Or in a Compose file:

```yaml
models:
  llm:
    model: ai/qwen2.5-coder
    context_size: 8192
```

### Context size guidelines

| Context size | Typical use case | Memory impact |
|--------------|------------------|---------------|
| 2,048 | Simple queries, short code snippets | Low |
| 4,096 | Standard conversations, medium code files | Moderate |
| 8,192 | Long conversations, larger code files | Higher |
| 16,384+ | Extended documents, multi-file context | High |

> [!IMPORTANT]
> Larger context sizes require more memory (RAM/VRAM). If you experience out-of-memory
> errors, reduce the context size. As a rough guide, each additional 1,000 tokens
> requires approximately 100-500 MB of additional memory, depending on the model size.

### Check a model's maximum context

To see a model's configuration including context size:

```console
$ docker model inspect ai/qwen2.5-coder
```

> [!NOTE]
> The `docker model inspect` command shows the model's maximum supported context length
> (e.g., `gemma3.context_length`), not the configured context size. The configured context
> size is what you set with `docker model configure --context-size` and represents the
> actual limit used during inference, which should be less than or equal to the model's
> maximum supported context length.

## Runtime flags

Runtime flags let you pass parameters directly to the underlying inference engine.
This provides fine-grained control over model behavior.

### Using runtime flags

Runtime flags can be provided through multiple mechanisms:

#### Using Docker Compose

In a Compose file:

```yaml
models:
  llm:
    model: ai/qwen2.5-coder
    context_size: 4096
    runtime_flags:
      - "--temp"
      - "0.7"
      - "--top-p"
      - "0.9"
```

#### Using Command Line

With the `docker model configure` command:

```console
$ docker model configure ai/qwen2.5-coder -- --temp 0.7 --top-p 0.9
```

### Common llama.cpp parameters

These are the most commonly used llama.cpp parameters. You don't need to look up
the llama.cpp documentation for typical use cases.

#### Sampling parameters

| Flag | Description | Default | Range |
|------|-------------|---------|-------|
| `--temp` | Temperature for sampling. Lower = more deterministic, higher = more creative | 0.8 | 0.0-2.0 |
| `--top-k` | Limit sampling to top K tokens. Lower = more focused | 40 | 1-100 |
| `--top-p` | Nucleus sampling threshold. Lower = more focused | 0.9 | 0.0-1.0 |
| `--min-p` | Minimum probability threshold | 0.05 | 0.0-1.0 |
| `--repeat-penalty` | Penalty for repeating tokens | 1.1 | 1.0-2.0 |

**Example: Deterministic output (for code generation)**

```yaml
runtime_flags:
  - "--temp"
  - "0"
  - "--top-k"
  - "1"
```

**Example: Creative output (for storytelling)**

```yaml
runtime_flags:
  - "--temp"
  - "1.2"
  - "--top-p"
  - "0.95"
```

#### Performance parameters

| Flag | Description | Default | Notes |
|------|-------------|---------|-------|
| `--threads` | CPU threads for generation | Auto | Set to number of performance cores |
| `--threads-batch` | CPU threads for batch processing | Auto | Usually same as `--threads` |
| `--batch-size` | Batch size for prompt processing | 512 | Higher = faster prompt processing |
| `--mlock` | Lock model in memory | Off | Prevents swapping, requires sufficient RAM |
| `--no-mmap` | Disable memory mapping | Off | May improve performance on some systems |

**Example: Optimized for multi-core CPU**

```yaml
runtime_flags:
  - "--threads"
  - "8"
  - "--batch-size"
  - "1024"
```

#### GPU parameters

| Flag | Description | Default | Notes |
|------|-------------|---------|-------|
| `--n-gpu-layers` | Layers to offload to GPU | All (if GPU available) | Reduce if running out of VRAM |
| `--main-gpu` | GPU to use for computation | 0 | For multi-GPU systems |
| `--split-mode` | How to split across GPUs | layer | Options: `none`, `layer`, `row` |

**Example: Partial GPU offload (limited VRAM)**

```yaml
runtime_flags:
  - "--n-gpu-layers"
  - "20"
```

#### Advanced parameters

| Flag | Description | Default |
|------|-------------|---------|
| `--rope-scaling` | RoPE scaling method | Auto |
| `--rope-freq-base` | RoPE base frequency | Model default |
| `--rope-freq-scale` | RoPE frequency scale | Model default |
| `--no-prefill-assistant` | Disable assistant pre-fill | Off |
| `--reasoning-budget` | Token budget for reasoning models | 0 (disabled) |

### vLLM parameters

When using the vLLM backend, different parameters are available.

Use `--hf_overrides` to pass HuggingFace model config overrides as JSON:

```console
$ docker model configure --hf_overrides '{"rope_scaling": {"type": "dynamic", "factor": 2.0}}' ai/model-vllm
```

## Configuration presets

Here are complete configuration examples for common use cases.

### Code completion (fast, deterministic)

```yaml
models:
  coder:
    model: ai/qwen2.5-coder
    context_size: 4096
    runtime_flags:
      - "--temp"
      - "0.1"
      - "--top-k"
      - "1"
      - "--batch-size"
      - "1024"
```

### Chat assistant (balanced)

```yaml
models:
  assistant:
    model: ai/llama3.2
    context_size: 8192
    runtime_flags:
      - "--temp"
      - "0.7"
      - "--top-p"
      - "0.9"
      - "--repeat-penalty"
      - "1.1"
```

### Creative writing (high temperature)

```yaml
models:
  writer:
    model: ai/llama3.2
    context_size: 8192
    runtime_flags:
      - "--temp"
      - "1.2"
      - "--top-p"
      - "0.95"
      - "--repeat-penalty"
      - "1.0"
```

### Long document analysis (large context)

```yaml
models:
  analyzer:
    model: ai/qwen2.5-coder:14B
    context_size: 32768
    runtime_flags:
      - "--mlock"
      - "--batch-size"
      - "2048"
```

### Low memory system

```yaml
models:
  efficient:
    model: ai/smollm2:360M-Q4_K_M
    context_size: 2048
    runtime_flags:
      - "--threads"
      - "4"
```

## Environment-based configuration

You can also configure models via environment variables in containers:

| Variable | Description |
|----------|-------------|
| `LLM_URL` | Auto-injected URL of the model endpoint |
| `LLM_MODEL` | Auto-injected model identifier |

See [Models and Compose](/compose/how-tos/models-and-compose/) for details on how these are populated.

## Reset configuration

Configuration set via `docker model configure` persists until the model is removed.
To reset configuration:

```console
$ docker model configure --context-size -1 ai/qwen2.5-coder
```

Using `-1` resets to the default value.

## What's next

- [Inference engines](/ai/model-runner/configuration/inference-engines/) - Learn about llama.cpp and vLLM
- [API reference](/ai/model-runner/configuration/api-reference/) - API parameters for per-request configuration
- [Models and Compose](/compose/how-tos/models-and-compose/) - Configure models in Compose applications

<!-- page: https://docs.docker.com/ai/model-runner/examples/ fetched 2026-10-08 -->

# DMR examples


See some examples of complete workflows using Docker Model Runner.

## Sample project

You can now start building your generative AI application powered by Docker
Model Runner.

If you want to try an existing GenAI application, follow these steps:

1. Set up the sample app. Clone and run the following repository:

   ```console
   $ git clone https://github.com/docker/hello-genai.git
   ```

1. In your terminal, go to the `hello-genai` directory.

1. Run `run.sh` to pull the chosen model and run the app.

1. Open your app in the browser at the addresses specified in the repository
   [README](https://github.com/docker/hello-genai).

You see the GenAI app's interface where you can start typing your prompts.

You can now interact with your own GenAI app, powered by a local model. Try a
few prompts and notice how fast the responses are — all running on your machine
with Docker.

## Use Model Runner in GitHub Actions

Here is an example of how to use Model Runner as part of a GitHub workflow.
The example installs Model Runner, tests the installation, pulls and runs a
model, interacts with the model via the API, and deletes the model.

```yaml {title="dmr-run.yml", collapse=true}
name: Docker Model Runner Example Workflow

permissions:
  contents: read

on:
  workflow_dispatch:
    inputs:
      test_model:
        description: 'Model to test with (default: ai/smollm2:360M-Q4_K_M)'
        required: false
        type: string
        default: 'ai/smollm2:360M-Q4_K_M'

jobs:
  dmr-test:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Set up Docker
        uses: docker/setup-docker-action@v5

      - name: Install docker-model-plugin
        run: |
          echo "Installing docker-model-plugin..."
          # Add Docker's official GPG key:
          sudo apt-get update
          sudo apt-get install ca-certificates curl
          sudo install -m 0755 -d /etc/apt/keyrings
          sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
          sudo chmod a+r /etc/apt/keyrings/docker.asc
          
          # Add the repository to Apt sources:
          echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
          $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
          sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
          sudo apt-get update
          sudo apt-get install -y docker-model-plugin
          
          echo "Installation completed successfully"

      - name: Test docker model version
        run: |
          echo "Testing docker model version command..."
          sudo docker model version
          
          # Verify the command returns successfully
          if [ $? -eq 0 ]; then
            echo "✅ docker model version command works correctly"
          else
            echo "❌ docker model version command failed"
            exit 1
          fi

      - name: Pull the provided model and run it
        run: |
          MODEL="${{ github.event.inputs.test_model || 'ai/smollm2:360M-Q4_K_M' }}"
          echo "Testing with model: $MODEL"
          
          # Test model pull
          echo "Pulling model..."
          sudo docker model pull "$MODEL"
          
          if [ $? -eq 0 ]; then
            echo "✅ Model pull successful"
          else
            echo "❌ Model pull failed"
            exit 1
          fi
                  
          # Test basic model run (with timeout to avoid hanging)
          echo "Testing docker model run..."
          timeout 60s sudo docker model run "$MODEL" "Give me a fact about whales." || {
            exit_code=$?
            if [ $exit_code -eq 124 ]; then
              echo "✅ Model run test completed (timed out as expected for non-interactive test)"
            else
              echo "❌ Model run failed with exit code: $exit_code"
              exit 1
            fi
          }

      - name: Test API endpoint
        run: |
          MODEL="${{ github.event.inputs.test_model || 'ai/smollm2:360M-Q4_K_M' }}"
          echo "Testing API endpoint with model: $MODEL"
                  
          # Test API call with curl
          echo "Testing API call..."
          RESPONSE=$(curl -s http://localhost:12434/engines/llama.cpp/v1/chat/completions \
            -H "Content-Type: application/json" \
            -d "{
                \"model\": \"$MODEL\",
                \"messages\": [
                    {
                        \"role\": \"user\",
                        \"content\": \"Say hello\"
                    }
                ],
                \"top_k\": 1,
                \"temperature\": 0
            }")
          
          if [ $? -eq 0 ]; then
            echo "✅ API call successful"
            echo "Response received: $RESPONSE"
            
            # Check if response contains "hello" (case-insensitive)
            if echo "$RESPONSE" | grep -qi "hello"; then
              echo "✅ Response contains 'hello' (case-insensitive)"
            else
              echo "❌ Response does not contain 'hello'"
              echo "Full response: $RESPONSE"
              exit 1
            fi
          else
            echo "❌ API call failed"
            exit 1
          fi

      - name: Test model cleanup
        run: |
          MODEL="${{ github.event.inputs.test_model || 'ai/smollm2:360M-Q4_K_M' }}"
          
          echo "Cleaning up test model..."
          sudo docker model rm "$MODEL" || echo "Model removal failed or model not found"
          
          # Verify model was removed
          echo "Verifying model cleanup..."
          sudo docker model ls
          
          echo "✅ Model cleanup completed"

      - name: Report success
        if: success()
        run: |
          echo "🎉 Docker Model Runner daily health check completed successfully!"
          echo "All tests passed:"
          echo "  ✅ docker-model-plugin installation successful"
          echo "  ✅ docker model version command working"
          echo "  ✅ Model pull and run operations successful"
          echo "  ✅ API endpoint operations successful"
          echo "  ✅ Cleanup operations successful"
```

## Related pages

- [Models and Compose](/compose/how-tos/models-and-compose/)

<!-- page: https://docs.docker.com/ai/model-runner/get-started/ fetched 2026-10-08 -->

# Get started with DMR


Docker Model Runner (DMR) lets you run and manage AI models locally using Docker. This page shows you how to enable DMR, pull and run a model, configure model settings, and publish custom models.

## Enable Docker Model Runner

You can enable DMR using Docker Desktop or Docker Engine. Follow the instructions below based on your setup.

### Docker Desktop

1. In the settings view, go to the **AI** tab.
1. Select the **Enable Docker Model Runner** setting.
1. If you use Windows with a supported NVIDIA GPU, you also see and can select
   **Enable GPU-backed inference**.
1. Optional: To enable TCP support, select **Enable host-side TCP support**.
   1. In the **Port** field, type the port you want to use.
   1. If you interact with Model Runner from a local frontend web app, in
      **CORS Allows Origins**, select the origins that Model Runner should
      accept requests from. An origin is the URL where your web app runs, for
      example `http://localhost:3131`.

You can now use the `docker model` command in the CLI and view and interact
with your local models in the **Models** tab in the Docker Desktop Dashboard.

### Docker Engine

1. Ensure you have installed [Docker Engine](/engine/install/).
1. Docker Model Runner is available as a package. To install it, run:

   **Ubuntu/Debian**



   ```bash
   $ sudo apt-get update
   $ sudo apt-get install docker-model-plugin
   ```

   **RPM-base distributions**



   ```bash
   $ sudo dnf update
   $ sudo dnf install docker-model-plugin
   ```

   

1. Test the installation:

   ```bash
   $ docker model version
   $ docker model run ai/smollm2
   ```

> [!NOTE]
> TCP support is enabled by default for Docker Engine on port `12434`.

### Update DMR in Docker Engine

To update Docker Model Runner in Docker Engine, uninstall it with
[`docker model uninstall-runner`](/reference/cli/docker/model/uninstall-runner/)
then reinstall it:

```bash
docker model uninstall-runner --images && docker model install-runner
```
> [!NOTE]
> With the above command, local models are preserved and only the Docker Model Runner images are removed.
> To also delete the local models during the upgrade, add the `--models` option to the `uninstall-runner` command.

## Pull a model

Models are cached locally.

> [!NOTE]
>
> When you use the Docker CLI, you can also pull models directly from
> [HuggingFace](https://huggingface.co/).

**From Docker Desktop**



1. Select **Models** and select the **Docker Hub** tab.
1. Find the model you want and select **Pull**.

![Screenshot showing the Docker Hub view.](/ai/model-runner/get-started/images/dmr-catalog.png)

**From the Docker CLI**



Use the [`docker model pull` command](/reference/cli/docker/model/pull/).
For example:

```bash {title="Pulling from Docker Hub"}
docker model pull ai/smollm2:360M-Q4_K_M
```

```bash {title="Pulling from HuggingFace"}
docker model pull hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF
```



## Run a model

**From Docker Desktop**



1. Select **Models** and select the **Local** tab.
1. Select the play button. The interactive chat screen opens.

![Screenshot showing the Local view.](/ai/model-runner/get-started/images/dmr-run.png)

**From the Docker CLI**



Use the [`docker model run` command](/reference/cli/docker/model/run/).



## Configure a model

You can configure a model, such as its maximum token limit and more,
use Docker Compose.
See [Models and Compose - Model configuration options](/compose/how-tos/models-and-compose/#model-configuration-options).

## Publish a model

> [!NOTE]
>
> This works for any Container Registry supporting OCI Artifacts, not only
> Docker Hub.

You can tag existing models with a new name and publish them under a different
namespace and repository:

```bash
# Tag a pulled model under a new name
$ docker model tag ai/smollm2 myorg/smollm2

# Push it to Docker Hub
$ docker model push myorg/smollm2
```

For more details, see the [`docker model tag`](/reference/cli/docker/model/tag)
and [`docker model push`](/reference/cli/docker/model/push) command
documentation.

You can also package a model file in GGUF format as an OCI Artifact and publish
it to Docker Hub.

```bash
# Download a model file in GGUF format, for example from HuggingFace
$ curl -L -o model.gguf https://huggingface.co/TheBloke/Mistral-7B-v0.1-GGUF/resolve/main/mistral-7b-v0.1.Q4_K_M.gguf

# Package it as OCI Artifact and push it to Docker Hub
$ docker model package --gguf "$(pwd)/model.gguf" --push myorg/mistral-7b-v0.1:Q4_K_M
```

For more details, see the
[`docker model package`](/reference/cli/docker/model/package/) command
documentation.

## Troubleshooting

### Display the logs

To troubleshoot issues, display the logs:

**From Docker Desktop**



Select **Models** and select the **Logs** tab.

![Screenshot showing the Models view.](/ai/model-runner/get-started/images/dmr-logs.png)

**From the Docker CLI**



Use the [`docker model logs` command](/reference/cli/docker/model/logs/).



### Inspect requests and responses

Inspecting requests and responses helps you diagnose model-related issues.
For example, you can evaluate context usage to verify you stay within the model's context
window or display the full body of a request to control the parameters you are passing to your models
when developing with a framework.

In Docker Desktop, to inspect the requests and responses for each model:

1. Select **Models** and select the **Requests** tab. This view displays all the requests to all models:
   - The time the request was sent.
   - The model name and version
   - The prompt/request
   - The context usage
   - The time it took for the response to be generated.
1. Select one of the requests to display further details:
   - In the **Overview** tab, view the token usage, response metadata and generation speed, and the actual prompt and response.
   - In the **Request**  and **Response** tabs, view the full JSON payload of the request and the response.

> [!NOTE]
> You can also display the requests for a specific model when you select a model and then select the **Requests** tab.

## Related pages

- [API reference](/ai/model-runner/get-started/api-reference/) - OpenAI and Ollama-compatible API documentation
- [Configuration options](/ai/model-runner/get-started/configuration/) - Context size and runtime parameters
- [Inference engines](/ai/model-runner/get-started/inference-engines/) - llama.cpp and vLLM details
- [IDE integrations](/ai/model-runner/get-started/ide-integrations/) - Connect Cline, Continue, Cursor, and more
- [Open WebUI integration](/ai/model-runner/get-started/openwebui-integration/) - Set up a web chat interface
- [Models and Compose](/compose/how-tos/models-and-compose/) - Use models in Compose applications
- [Docker Model Runner CLI reference](/reference/cli/docker/model) - Complete CLI documentation

<!-- page: https://docs.docker.com/ai/model-runner/ide-integrations/ fetched 2026-10-08 -->

# IDE and tool integrations


Docker Model Runner can serve as a local backend for popular AI coding assistants
and development tools. This guide shows how to configure common tools to use
models running in DMR.

## Prerequisites

Before configuring any tool:

1. [Enable Docker Model Runner](/ai/model-runner/ide-integrations/get-started/#enable-docker-model-runner) in Docker Desktop or Docker Engine.
2. Enable TCP host access:
   - Docker Desktop: Enable **host-side TCP support** in Settings > AI, or run:
     ```console
     $ docker desktop enable model-runner --tcp 12434
     ```
   - Docker Engine: TCP is enabled by default on port 12434.
3. Pull a model:
   ```console
   $ docker model pull ai/qwen2.5-coder
   ```

> [!TIP]
> 
> The default context size for many models (such as `gpt-oss`) is 4,096 tokens, which is limiting for coding tasks.
> You can repackage it with a larger context window:
>
> ```console
> $ docker model pull gpt-oss
> $ docker model package --from ai/gpt-oss --context-size 32000 gpt-oss:32k
> ```
> Alternatively, models like ai/glm-4.7-flash, ai/qwen2.5-coder, and ai/devstral-small-2
> come with 128K context by default and work without repackaging.

## Cline (VS Code)

[Cline](https://github.com/cline/cline) is an AI coding assistant for VS Code.

### Configuration

1. Open VS Code and go to the Cline extension settings.
2. Select **OpenAI Compatible** as the API provider.
3. Configure the following settings:

| Setting | Value |
|---------|-------|
| Base URL | `http://localhost:12434/engines/v1` |
| API Key | `not-needed` (or any placeholder value) |
| Model ID | `ai/qwen2.5-coder` (or your preferred model) |

> [!IMPORTANT]
> The base URL must include `/engines/v1` at the end. Do not include a trailing slash.

### Troubleshooting Cline

If Cline fails to connect:

1. Verify DMR is running:
   ```console
   $ docker model status
   ```

2. Test the endpoint directly:
   ```console
   $ curl http://localhost:12434/engines/v1/models
   ```

3. Check that CORS is configured if running a web-based version:
   - In Docker Desktop Settings > AI, add your origin to **CORS Allowed Origins**

## Continue (VS Code / JetBrains)

[Continue](https://continue.dev) is an open-source AI code assistant that works with VS Code and JetBrains IDEs.

### Configuration

Edit your Continue configuration file (`~/.continue/config.json`):

```json
{
  "models": [
    {
      "title": "Docker Model Runner",
      "provider": "openai",
      "model": "ai/qwen2.5-coder",
      "apiBase": "http://localhost:12434/engines/v1",
      "apiKey": "not-needed"
    }
  ]
}
```

### Using Ollama provider

Continue also supports the Ollama provider, which works with DMR:

```json
{
  "models": [
    {
      "title": "Docker Model Runner (Ollama)",
      "provider": "ollama",
      "model": "ai/qwen2.5-coder",
      "apiBase": "http://localhost:12434"
    }
  ]
}
```

## Cursor

[Cursor](https://cursor.sh) is an AI-powered code editor.

### Configuration

1. Open Cursor Settings (Cmd/Ctrl + ,).
2. Navigate to **Models** > **OpenAI API Key**.
3. Configure:

   | Setting | Value |
   |---------|-------|
   | OpenAI API Key | `not-needed` |
   | Override OpenAI Base URL | `http://localhost:12434/engines/v1` |

4. In the model drop-down, enter your model name: `ai/qwen2.5-coder`

> [!NOTE]
> Some Cursor features may require models with specific capabilities (e.g., function calling).
> Use capable models like `ai/qwen2.5-coder` or `ai/llama3.2` for best results.

## Zed

[Zed](https://zed.dev) is a high-performance code editor with AI features.

### Configuration

Edit your Zed settings (`~/.config/zed/settings.json`):

```json
{
  "language_models": {
    "openai": {
      "api_url": "http://localhost:12434/engines/v1",
      "available_models": [
        {
          "name": "ai/qwen2.5-coder",
          "display_name": "Qwen 2.5 Coder (DMR)",
          "max_tokens": 8192
        }
      ]
    }
  }
}
```

## Open WebUI

[Open WebUI](https://github.com/open-webui/open-webui) provides a ChatGPT-like interface for local models.

See [Open WebUI integration](/ai/model-runner/ide-integrations/openwebui-integration/) for detailed setup instructions.

## Aider

[Aider](https://aider.chat) is an AI pair programming tool for the terminal.

### Configuration

Set environment variables or use command-line flags:

```bash
export OPENAI_API_BASE=http://localhost:12434/engines/v1
export OPENAI_API_KEY=not-needed

aider --model openai/ai/qwen2.5-coder
```

Or in a single command:

```console
$ aider --openai-api-base http://localhost:12434/engines/v1 \
        --openai-api-key not-needed \
        --model openai/ai/qwen2.5-coder
```

## LangChain

### Python

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="http://localhost:12434/engines/v1",
    api_key="not-needed",
    model="ai/qwen2.5-coder"
)

response = llm.invoke("Write a hello world function in Python")
print(response.content)
```

### JavaScript/TypeScript

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  configuration: {
    baseURL: "http://localhost:12434/engines/v1",
  },
  apiKey: "not-needed",
  modelName: "ai/qwen2.5-coder",
});

const response = await model.invoke("Write a hello world function");
console.log(response.content);
```

## LlamaIndex

```python
from llama_index.llms.openai_like import OpenAILike

llm = OpenAILike(
    api_base="http://localhost:12434/engines/v1",
    api_key="not-needed",
    model="ai/qwen2.5-coder"
)

response = llm.complete("Write a hello world function")
print(response.text)
```

## OpenCode

[OpenCode](https://opencode.ai/) is an open-source coding assistant designed to integrate directly into developer workflows. It supports multiple model providers and exposes a flexible configuration system that makes it easy to switch between them.

See [Use OpenCode with Docker Model Runner](/guides/opencode-model-runner/)
for a task-focused guide that walks through model setup, configuration, and
troubleshooting.

### Configuration

1. Install OpenCode (see [docs](https://opencode.ai/docs/#install))
2. Reference DMR in your OpenCode configuration, either globally at `~/.config/opencode/opencode.json` or project specific with a `opencode.json` file in the root of your project
   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "provider": {
       "dmr": {
         "npm": "@ai-sdk/openai-compatible",
         "name": "Docker Model Runner",
         "options": {
           "baseURL": "http://localhost:12434/v1"
         },
         "models": {
           "ai/qwen2.5-coder": {
             "name": "ai/qwen2.5-coder"
           },
           "ai/llama3.2": {
             "name": "ai/llama3.2"
           }
         }
       }
     }
   }
   ```
3. Select the model you want in OpenCode

You can find more details in [this Docker Blog post](https://www.docker.com/blog/opencode-docker-model-runner-private-ai-coding/)

## Claude Code

[Claude Code](https://claude.com/product/claude-code) is [Anthropic's](https://www.anthropic.com/) command-line tool for agentic coding. It lives in your terminal, understands your codebase, and executes routine tasks, explains complex code, and handles Git workflows through natural language commands.

See [Use Claude Code with Docker Model Runner](/guides/claude-code-model-runner/)
for a task-focused guide that walks through model setup, configuration, and
inspecting requests. To run Claude Code in an isolated Docker Sandbox against
a local model, see
[Run Claude Code in a Docker Sandbox with Docker Model Runner](/guides/claude-code-sandbox-model-runner/).

### Configuration

1. Install Claude Code (see [docs](https://code.claude.com/docs/en/quickstart#step-1-install-claude-code))
2. Use the `ANTHROPIC_BASE_URL` environment variable to point Claude Code at DMR. On Mac or Linux, you can do this, for example if you want to use the `gpt-oss:32k` model:
    ```bash
    ANTHROPIC_BASE_URL=http://localhost:12434 claude --model qwen2.5-coder
    ```
    On Windows (PowerShell) you can do it like this:
    ```powershell
    $env:ANTHROPIC_BASE_URL="http://localhost:12434"
    claude --model gpt-oss:32k
    ```

> [!TIP]
>
> To avoid setting the variable each time, add it to your shell profile (`~/.bashrc`, `~/.zshrc`, or equivalent):
>
> ```shell
> export ANTHROPIC_BASE_URL=http://localhost:12434
> ```

You can find more details in [this Docker Blog post](https://www.docker.com/blog/run-claude-code-locally-docker-model-runner/)

> [!NOTE]
>
> While the other integrations on this page use the [OpenAI-compatible API](/ai/model-runner/api-reference/#openai-compatible-api), DMR also exposes a [Anthropic-compatible API](/ai/model-runner/api-reference/#anthropic-compatible-api) used here.

## Common issues

### "Connection refused" errors

1. Ensure Docker Model Runner is enabled and running:
   ```console
   $ docker model status
   ```

2. Verify TCP access is enabled:
   ```console
   $ curl http://localhost:12434/engines/v1/models
   ```

3. Check if another service is using port 12434.

4. If you run your tool in WSL and want to connect to DMR on the host via `localhost`, this might not directly work. Configuring WSL to use [mirrored networking](https://learn.microsoft.com/en-us/windows/wsl/networking#mirrored-mode-networking) can solve this.

### "Model not found" errors

1. Verify the model is pulled:
   ```console
   $ docker model list
   ```

2. Use the full model name including namespace (e.g., `ai/qwen2.5-coder`, not just `qwen2.5-coder`).

### Slow responses or timeouts

1. For first requests, models need to load into memory. Subsequent requests are faster.

2. Consider using a smaller model or adjusting the context size:
   ```console
   $ docker model configure --context-size 4096 ai/qwen2.5-coder
   ```

3. Check available system resources (RAM, GPU memory).

### CORS errors (web-based tools)

If using browser-based tools, add the origin to CORS allowed origins:

1. Docker Desktop: Settings > AI > CORS Allowed Origins
2. Add your tool's URL (e.g., `http://localhost:3000`)

## Recommended models by use case

| Use case | Recommended model | Notes |
|----------|-------------------|-------|
| Code completion | `ai/qwen3-coder` | Optimized for coding tasks with a large context window |
| Agentic coding | `ai/devstral-small-2` | Good fit for tools such as Claude Code and OpenCode |
| General assistant | `ai/llama3.2` | Good balance of capabilities |
| Small/fast | `ai/smollm2` | Low resource usage |
| Embeddings | `ai/all-minilm` | For RAG and semantic search |

## What's next

- [API reference](/ai/model-runner/ide-integrations/api-reference/) - Full API documentation
- [Configuration options](/ai/model-runner/ide-integrations/configuration/) - Tune model behavior
- [Open WebUI integration](/ai/model-runner/ide-integrations/openwebui-integration/) - Set up a web interface

<!-- page: https://docs.docker.com/ai/model-runner/inference-engines/ fetched 2026-10-08 -->

# Inference engines


Docker Model Runner supports three inference engines: **llama.cpp**, **vLLM**, and **Diffusers**.
Each engine has different strengths, supported platforms, and model format
requirements. This guide helps you choose the right engine and configure it for
your use case.

## Engine comparison

| Feature | llama.cpp | vLLM | Diffusers                           |
|---------|-----------|------|-------------------------------------|
| **Model formats** | GGUF | Safetensors, HuggingFace | DDUF                                |
| **Platforms** | All (macOS, Windows, Linux) | Linux x86_64 only | Linux (x86_64, ARM64)               |
| **GPU support** | NVIDIA, AMD, Apple Silicon, Vulkan | NVIDIA CUDA only | NVIDIA CUDA only                    |
| **CPU inference** | Yes | No | No                                  |
| **Quantization** | Built-in (Q4, Q5, Q8, etc.) | Limited | Limited                             |
| **Memory efficiency** | High (with quantization) | Moderate | Moderate                            |
| **Throughput** | Good | High (with batching) | Good                                |
| **Best for** | Local development, resource-constrained environments | Production, high throughput | Image generation                    |
| **Use case** | Text generation (LLMs) | Text generation (LLMs) | Image generation (Stable Diffusion) |

## llama.cpp

[llama.cpp](https://github.com/ggerganov/llama.cpp) is the default inference
engine in Docker Model Runner. It's designed for efficient local inference and
supports a wide range of hardware configurations.

### Platform support

| Platform | GPU support | Notes |
|----------|-------------|-------|
| macOS (Apple Silicon) | Metal | Automatic GPU acceleration |
| Windows (x64) | NVIDIA CUDA | Requires NVIDIA drivers 576.57+ |
| Windows (ARM64) | Adreno OpenCL | Qualcomm 6xx series and later |
| Linux (x64) | NVIDIA, AMD, Vulkan | Multiple backend options |
| Linux | CPU only | Works on any x64/ARM64 system |

### Model format: GGUF

llama.cpp uses the GGUF format, which supports efficient quantization for reduced
memory usage without significant quality loss.

#### Quantization levels

| Quantization | Bits per weight | Memory usage | Quality |
|--------------|-----------------|--------------|---------|
| Q2_K | ~2.5 | Lowest | Reduced |
| Q3_K_M | ~3.5 | Minimal | Acceptable |
| Q4_K_M | ~4.5 | Low | Good |
| Q5_K_M | ~5.5 | Moderate | Excellent |
| Q6_K | ~6.5 | Higher | Excellent |
| Q8_0 | 8 | High | Near-original |
| F16 | 16 | Highest | Original |

**Recommended**: Q4_K_M offers the best balance of quality and memory usage for
most use cases.

#### Pulling quantized models

Models on Docker Hub often include quantization in the tag:

```console
$ docker model pull ai/llama3.2:3B-Q4_K_M
```

### Using llama.cpp

llama.cpp is the default engine. No special configuration is required:

```console
$ docker model run ai/smollm2
```

To explicitly specify llama.cpp when running models:

```console
$ docker model run ai/smollm2 --backend llama.cpp
```

### llama.cpp API endpoints

When using llama.cpp, API calls use the llama.cpp engine path:

```text
POST /engines/llama.cpp/v1/chat/completions
```

Or without the engine prefix:

```text
POST /engines/v1/chat/completions
```

## vLLM

[vLLM](https://github.com/vllm-project/vllm) is a high-performance inference
engine optimized for production workloads with high throughput requirements.

### Platform support

| Platform | GPU | Support status |
|----------|-----|----------------|
| Linux x86_64 | NVIDIA CUDA | Supported |
| Windows with WSL2 | NVIDIA CUDA | Supported (Docker Desktop 4.54+) |
| macOS | - | Not supported |
| Linux ARM64 | - | Not supported |
| AMD GPUs | - | Not supported |

> [!IMPORTANT]
> vLLM requires an NVIDIA GPU with CUDA support. It does not support CPU-only
> inference.

### Model format: Safetensors

vLLM works with models in Safetensors format, which is the standard format for
HuggingFace models. These models typically use more memory than quantized GGUF
models but may offer better quality and faster inference on powerful hardware.

### Setting up vLLM

#### Docker Engine (Linux)

Install the Model Runner with vLLM backend:

```console
$ docker model install-runner --backend vllm --gpu cuda
```

Verify the installation:

```console
$ docker model status
Docker Model Runner is running

Status:
llama.cpp: running llama.cpp version: c22473b
vllm: running vllm version: 0.11.0
```

#### Docker Desktop (Windows with WSL2)

1. Ensure you have:
   - Docker Desktop 4.54 or later (minimum version for vLLM support)
   - NVIDIA GPU with updated drivers
   - WSL2 enabled

2. Install vLLM backend:
   ```console
   $ docker model install-runner --backend vllm --gpu cuda
   ```

### Running models with vLLM

vLLM models are typically tagged with `-vllm` suffix:

```console
$ docker model run ai/smollm2-vllm
```

To specify the vLLM backend explicitly:

```console
$ docker model run ai/model --backend vllm
```

### vLLM API endpoints

When using vLLM, specify the engine in the API path:

```text
POST /engines/vllm/v1/chat/completions
```

### vLLM configuration

#### HuggingFace overrides

Use `--hf_overrides` to pass model configuration overrides:

```console
$ docker model configure --hf_overrides '{"max_model_len": 8192}' ai/model-vllm
```

#### Common vLLM settings

| Setting | Description | Example |
|---------|-------------|---------|
| `max_model_len` | Maximum context length | 8192 |
| `gpu_memory_utilization` | Fraction of GPU memory to use | 0.9 |
| `tensor_parallel_size` | GPUs for tensor parallelism | 2 |

### vLLM and llama.cpp performance comparison

| Scenario | Recommended engine |
|----------|-------------------|
| Single user, local development | llama.cpp |
| Multiple concurrent requests | vLLM |
| Limited GPU memory | llama.cpp (with quantization) |
| Maximum throughput | vLLM |
| CPU-only system | llama.cpp |
| Apple Silicon Mac | llama.cpp |
| Production deployment | vLLM (if hardware supports it) |

## Diffusers

[Diffusers](https://github.com/huggingface/diffusers) is an inference engine
for image generation models, including Stable Diffusion. Unlike llama.cpp and
vLLM which focus on text generation with LLMs, Diffusers enables you to generate
images from text prompts.

### Platform support

| Platform | GPU | Support status |
|----------|-----|----------------|
| Linux x86_64 | NVIDIA CUDA | Supported |
| Linux ARM64 | NVIDIA CUDA | Supported |
| Windows | - | Not supported |
| macOS | - | Not supported |

> [!IMPORTANT]
> Diffusers requires an NVIDIA GPU with CUDA support. It does not support
> CPU-only inference.

### Setting up Diffusers

Install the Model Runner with Diffusers backend:

```console
$ docker model reinstall-runner --backend diffusers --gpu cuda
```

Verify the installation:

```console
$ docker model status
Docker Model Runner is running

Status:
llama.cpp: running llama.cpp version: 34ce48d
mlx: not installed
sglang: sglang package not installed
vllm: vLLM binary not found
diffusers: running diffusers version: 0.36.0
```

### Pulling Diffusers models

Pull a Stable Diffusion model:

```console
$ docker model pull stable-diffusion:Q4
```

### Generating images with Diffusers

Diffusers uses an image generation API endpoint. To generate an image:

```console
$ curl -s -X POST http://localhost:12434/engines/diffusers/v1/images/generations \
  -H "Content-Type: application/json" \
  -d '{
    "model": "stable-diffusion:Q4",
    "prompt": "A picture of a nice cat",
    "size": "512x512"
  }' | jq -r '.data[0].b64_json' | base64 -d > image.png
```

This command:
1. Sends a POST request to the Diffusers image generation endpoint
2. Specifies the model, prompt, and output image size
3. Extracts the base64-encoded image from the response
4. Decodes it and saves it as `image.png`

### Diffusers API endpoint

When using Diffusers, specify the engine in the API path:

```text
POST /engines/diffusers/v1/images/generations
```

### Supported parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | Required. The model identifier (e.g., `stable-diffusion:Q4`). |
| `prompt` | string | Required. The text description of the image to generate. |
| `size` | string | Image dimensions in `WIDTHxHEIGHT` format (e.g., `512x512`). |

## Running multiple engines

You can run llama.cpp, vLLM, and Diffusers simultaneously. Docker Model Runner routes
requests to the appropriate engine based on the model or explicit engine selection.

Check which engines are running:

```console
$ docker model status
Docker Model Runner is running

Status:
llama.cpp: running llama.cpp version: 34ce48d
mlx: not installed
sglang: sglang package not installed
vllm: running vllm version: 0.11.0
diffusers: running diffusers version: 0.36.0
```

### Engine-specific API paths

| Engine | API path | Use case |
|--------|----------|----------|
| llama.cpp | `/engines/llama.cpp/v1/chat/completions` | Text generation |
| vLLM | `/engines/vllm/v1/chat/completions` | Text generation |
| Diffusers | `/engines/diffusers/v1/images/generations` | Image generation |
| Auto-select | `/engines/v1/chat/completions` | Text generation (auto-selects engine) |

## Managing inference engines

### Install an engine

```console
$ docker model install-runner --backend <engine> [--gpu <type>]
```

Options:
- `--backend`: `llama.cpp`, `vllm`, or `diffusers`
- `--gpu`: `cuda`, `rocm`, `vulkan`, or `metal` (depends on platform)

### Reinstall an engine

```console
$ docker model reinstall-runner --backend <engine>
```

### Check engine status

```console
$ docker model status
```

### View engine logs

```console
$ docker model logs
```

## Packaging models for each engine

### Package a GGUF model (llama.cpp)

```console
$ docker model package --gguf ./model.gguf --push myorg/mymodel:Q4_K_M
```

### Package a Safetensors model (vLLM)

```console
$ docker model package --safetensors ./model/ --push myorg/mymodel-vllm
```

## Troubleshooting

### vLLM won't start

1. Verify NVIDIA GPU is available:
   ```console
   $ nvidia-smi
   ```

2. Check Docker has GPU access:
   ```console
   $ docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
   ```

3. Verify you're on a supported platform (Linux x86_64 or Windows WSL2).

### llama.cpp is slow

1. Ensure GPU acceleration is working (check logs for Metal/CUDA messages).

2. Try a more aggressive quantization:
   ```console
   $ docker model pull ai/model:Q4_K_M
   ```

3. Reduce context size:
   ```console
   $ docker model configure --context-size 2048 ai/model
   ```

### Out of memory errors

1. Use a smaller quantization (Q4 instead of Q8).
2. Reduce context size.
3. For vLLM, adjust `gpu_memory_utilization`:
   ```console
   $ docker model configure --hf_overrides '{"gpu_memory_utilization": 0.8}' ai/model
   ```

## What's next

- [Configuration options](/ai/model-runner/inference-engines/configuration/) - Detailed parameter reference
- [API reference](/ai/model-runner/inference-engines/api-reference/) - API documentation
- [GPU support](/desktop/features/gpu/) - GPU configuration for Docker Desktop

<!-- page: https://docs.docker.com/ai/model-runner/openwebui-integration/ fetched 2026-10-08 -->

# Open WebUI integration


[Open WebUI](https://github.com/open-webui/open-webui) is an open-source,
self-hosted web interface that provides a ChatGPT-like experience for local
AI models. You can connect it to Docker Model Runner to get a polished chat
interface for your models.

## Prerequisites

- Docker Model Runner enabled with TCP access
- A model pulled (e.g., `docker model pull ai/llama3.2`)

## Quick start with Docker Compose

The easiest way to run Open WebUI with Docker Model Runner is using Docker Compose.

Create a `compose.yaml` file:

```yaml
services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    ports:
      - "3000:8080"
    environment:
      - OLLAMA_BASE_URL=http://host.docker.internal:12434
      - WEBUI_AUTH=false
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - open-webui:/app/backend/data

volumes:
  open-webui:
```

Start the services:

```console
$ docker compose up -d
```

Open your browser to [http://localhost:3000](http://localhost:3000).

## Configuration options

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OLLAMA_BASE_URL` | URL of Docker Model Runner | Required |
| `WEBUI_AUTH` | Enable authentication | `true` |
| `OPENAI_API_BASE_URL` | Use OpenAI-compatible API instead | - |
| `OPENAI_API_KEY` | API key (use any value for DMR) | - |

### Using OpenAI-compatible API

If you prefer to use the OpenAI-compatible API instead of the Ollama API:

```yaml
services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    ports:
      - "3000:8080"
    environment:
      - OPENAI_API_BASE_URL=http://host.docker.internal:12434/engines/v1
      - OPENAI_API_KEY=not-needed
      - WEBUI_AUTH=false
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - open-webui:/app/backend/data

volumes:
  open-webui:
```

## Network configuration

### Docker Desktop

On Docker Desktop, `host.docker.internal` automatically resolves to the host machine.
The previous example works without modification.

### Docker Engine (Linux)

On Docker Engine, you may need to configure the network differently:

```yaml
services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    network_mode: host
    environment:
      - OLLAMA_BASE_URL=http://localhost:12434
      - WEBUI_AUTH=false
    volumes:
      - open-webui:/app/backend/data

volumes:
  open-webui:
```

Or use the host gateway:

```yaml
services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    ports:
      - "3000:8080"
    environment:
      - OLLAMA_BASE_URL=http://172.17.0.1:12434
      - WEBUI_AUTH=false
    volumes:
      - open-webui:/app/backend/data

volumes:
  open-webui:
```

## Using Open WebUI

### Select a model

1. Open [http://localhost:3000](http://localhost:3000)
2. Select the model drop-down in the top-left
3. Select from your pulled models (they appear with `ai/` prefix)

### Pull models through the UI

Open WebUI can pull models directly:

1. Select the model drop-down
2. Enter a model name: `ai/llama3.2`
3. Select the download icon

### Chat features

Open WebUI provides:

- Multi-turn conversations with context
- Message editing and regeneration
- Code syntax highlighting
- Markdown rendering
- Conversation history and search
- Export conversations

## Complete example with multiple models

This example sets up Open WebUI with Docker Model Runner and pre-pulls several models:

```yaml
services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    ports:
      - "3000:8080"
    environment:
      - OLLAMA_BASE_URL=http://host.docker.internal:12434
      - WEBUI_AUTH=false
      - DEFAULT_MODELS=ai/llama3.2
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - open-webui:/app/backend/data
    depends_on:
      model-setup:
        condition: service_completed_successfully

  model-setup:
    image: docker:cli
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: >
      sh -c "
        docker model pull ai/llama3.2 &&
        docker model pull ai/qwen2.5-coder &&
        docker model pull ai/smollm2
      "

volumes:
  open-webui:
```

## Enabling authentication

For multi-user setups or security, enable authentication:

```yaml
services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    ports:
      - "3000:8080"
    environment:
      - OLLAMA_BASE_URL=http://host.docker.internal:12434
      - WEBUI_AUTH=true
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - open-webui:/app/backend/data

volumes:
  open-webui:
```

On first visit, you'll create an admin account.

## Troubleshooting

### Models don't appear in the drop-down

1. Verify Docker Model Runner is accessible:
   ```console
   $ curl http://localhost:12434/api/tags
   ```

2. Check that models are pulled:
   ```console
   $ docker model list
   ```

3. Verify the `OLLAMA_BASE_URL` is correct and accessible from the container.

### "Connection refused" errors

1. Ensure TCP access is enabled for Docker Model Runner.

2. On Docker Desktop, verify `host.docker.internal` resolves:
   ```console
   $ docker run --rm alpine ping -c 1 host.docker.internal
   ```

3. On Docker Engine, try using `network_mode: host` or the explicit host IP.

### Slow response times

1. First requests load the model into memory, which takes time.

2. Subsequent requests are much faster.

3. If consistently slow, consider:
   - Using a smaller model
   - Reducing context size
   - Checking GPU acceleration is working

### CORS errors

If running Open WebUI on a different host:

1. In Docker Desktop, go to Settings > AI
2. Add the Open WebUI URL to **CORS Allowed Origins**

## Customization

### Custom system prompts

Open WebUI supports setting system prompts per model. Configure these in the UI under Settings > Models.

### Model parameters

Adjust model parameters in the chat interface:

1. Select the settings icon next to the model name
2. Adjust temperature, top-p, max tokens, etc.

These settings are passed through to Docker Model Runner.

## Running on a different port

To run Open WebUI on a different port:

```yaml
services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    ports:
      - "8080:8080"  # Change first port number
    # ... rest of config
```

## What's next

- [API reference](/ai/model-runner/openwebui-integration/api-reference/) - Learn about the APIs Open WebUI uses
- [Configuration options](/ai/model-runner/openwebui-integration/configuration/) - Tune model behavior
- [IDE integrations](/ai/model-runner/openwebui-integration/ide-integrations/) - Connect other tools to DMR

