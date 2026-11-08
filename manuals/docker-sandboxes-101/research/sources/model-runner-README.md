# Docker Model Runner
<img width="2071" height="269" alt="docker-model-runner-white" src="https://github.com/user-attachments/assets/f3b2ed27-ea0e-47d5-8ed0-82ee338f3eae" />

Docker Model Runner (DMR) makes it easy to manage, run, and deploy AI models using Docker. Designed for developers, Docker Model Runner streamlines the process of pulling, running, and serving large language models (LLMs) and other AI models directly from Docker Hub or any OCI-compliant registry.

## Overview

This package supports the Docker Model Runner in Docker Desktop, Docker Engine, and as the standalone `dmr` binary (no Docker installation required — see [Standalone (dmr)](#standalone-dmr) below).

### Installation

### Docker Desktop (macOS and Windows)

For macOS and Windows, install Docker Desktop:

https://docs.docker.com/desktop/

Docker Model Runner is included in Docker Desktop.

### Docker Engine (Linux)

For Linux, install Docker Engine from the official Docker repository:

```bash
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER # give user permission to access docker daemon, relogin to take effect
```

Docker Model Runner is included in Docker Engine when installed from Docker's official repositories.

### Standalone (dmr)

If you don't want to install Docker Desktop or Docker Engine at all, `dmr`
is a single self-contained binary that bundles both the inference daemon and
the full model management CLI (`run`, `ls`, `pull`, `rm`, `ps`, ...). It has
no dependency on Docker Desktop or a running Docker Engine.

```bash
# macOS (arm64)
brew install docker/tap/dmr

# Windows (amd64)
winget install Docker.dmr
```

Linux users can download a prebuilt archive from the
[latest `dmr-v*` release](https://github.com/docker/model-runner/releases)
or build it from source (see [`cmd/dmr`](./cmd/dmr)):

```bash
make build-dmr
./dmr serve &      # start the daemon
./dmr pull ai/gemma3
./dmr run ai/gemma3 "Hello"
```

`dmr serve` listens on TCP port `12434` by default (see `dmr serve --help`
for `--port`/`--socket`/`--models-path`), and the bundled CLI talks to it
there automatically. Point any dmr command at a different daemon with
`MODEL_RUNNER_HOST` (or `--host`), exactly as with `docker model`.

### Verifying Your Installation

To verify that Docker Model Runner is available:

```bash
# Check if the Docker CLI plugin is available
docker model --help

# Check Docker version
docker version

# Check Docker Model Runner version
docker model version

# Run a model to test the full setup
docker model run ai/gemma3 "Hello"
```

If `docker model` is not available, see the troubleshooting section below.

### Troubleshooting: Docker Installation Source

If you encounter errors like `Package 'docker-model-plugin' has no installation candidate` or `docker model` command is not found:

1. **Check your Docker installation source:**
   ```bash
   # Check Docker version
   docker version

   # Check Docker Model Runner version
   docker model version
   ```

   Look for the source in the output. If it shows a package from your distro, you'll need to reinstall from Docker's official repositories.

2. **Remove the distro version and install from Docker's official repository:**
   ```bash
   # Remove distro version (Ubuntu/Debian example)
   sudo apt-get purge docker docker.io containerd runc

   # Install from Docker's official repository
   curl -fsSL https://get.docker.com | sudo bash

   # Verify Docker Model Runner is available
   docker model --help
   ```

3. **For NVIDIA DGX systems:** If Docker came pre-installed, verify it's from Docker's official repositories. If not, follow the reinstallation steps above.

For more details refer to:

https://docs.docker.com/ai/model-runner/get-started/

### Prerequisites

Before building from source, ensure you have the following installed:

- **Go 1.25+** - Required for building both model-runner and model-cli
- **Git** - For cloning repositories
- **Make** - For using the provided Makefiles
- **Docker** (optional) - For building and running containerized versions
- **CGO dependencies** - Required for model-runner's GPU support:
  - On macOS: Xcode Command Line Tools (`xcode-select --install`)
  - On Linux: gcc/g++ and development headers
  - On Windows: MinGW-w64 or Visual Studio Build Tools

### Building the Complete Stack

After cloning, a single `make` builds everything — the server, CLI plugin, and a `dmr` convenience wrapper:

```bash
make
```

`dmr` starts the server on a free port, waits for it to be ready, runs your CLI command, then shuts the server down:

```bash
./dmr run ai/smollm2 "Hello, how are you?"
./dmr ls
./dmr run qwen3:0.6B-Q4_0 tell me today's news
```

These components can also be built, run, and tested separately using the Makefile.

### Testing the Complete Stack End-to-End

> **Note:** We use port 13434 in these examples to avoid conflicts with Docker Desktop's built-in Model Runner, which typically runs on port 12434.

#### Option 1: Manual two-terminal setup

1. **Start model-runner in one terminal:**
```bash
MODEL_RUNNER_PORT=13434 ./model-runner
```

2. **Use model-cli in another terminal:**
```bash
# List available models
MODEL_RUNNER_HOST=http://localhost:13434 ./cmd/cli/model-cli list

# Pull and run a model
MODEL_RUNNER_HOST=http://localhost:13434 ./cmd/cli/model-cli run ai/smollm2 "Hello, how are you?"
```

#### Option 2: Using Docker

1. **Build and run model-runner in Docker:**
```bash
cd model-runner
make docker-build
make docker-run PORT=13434 MODELS_PATH=/path/to/models
```

2. **Connect with model-cli:**
```bash
cd cmd/cli
MODEL_RUNNER_HOST=http://localhost:13434 ./model-cli list
```

### Additional Resources

- [Model Runner Documentation](https://docs.docker.com/desktop/features/model-runner/)
- [Model CLI README](./cmd/cli/README.md)
- [Model Specification](https://github.com/docker/model-spec/blob/main/spec.md)
- [Community Slack Channel](https://dockercommunity.slack.com/archives/C09H9P5E57B)

## Using the Makefile

This project includes a Makefile to simplify common development tasks. Docker targets require Docker Desktop >= 4.41.0.

Run `make help` for a full list, but the key targets are:

- `build` - Build the Go application
- `build-cli` - Build the CLI (`docker-model` plugin)
- `install-cli` - Build and install the CLI as a Docker plugin
- `docs` - Generate CLI documentation
- `run` - Run the application locally
- `clean` - Clean build artifacts
- `test` - Run tests
- `validate-all` - **Run all CI validations locally** (lint, test, shellcheck, go mod tidy)
- `lint` - Run Go linting with golangci-lint
- `validate` - Run shellcheck validation on shell scripts
- `integration-tests` - Run integration tests (requires Docker)
- `docker-build` - Build the Docker image for current platform
- `docker-run` - Run the application in a Docker container with TCP port access and mounted model storage
- `help` - Show all available targets and configuration options

### Running in Docker

The application can be run in Docker with the following features enabled by default:
- TCP port access (default port 8080)
- Persistent model storage in a local `models` directory

```sh
# Run with default settings
make docker-run

# Customize port and model storage location
make docker-run PORT=3000 MODELS_PATH=/path/to/your/models
```

This will:
- Create a `models` directory in your current working directory (or use the specified path)
- Mount this directory into the container
- Start the service on port 8080 (or the specified port)
- All models downloaded will be stored in the host's `models` directory and will persist between container runs

> NOTE: The [`.versions`](.versions) file is the single source of truth for all version variables (Go, vLLM, SGLang, llama-server, etc.).

### llama.cpp integration

The Docker image vendors the Linux `llama-server` binary from the official
`ghcr.io/ggml-org/llama.cpp` container images. The build keeps the existing
model-runner runtime layout by normalizing the upstream `/app/llama-server`
binary and shared libraries into `/app/bin/com.docker.llama-server` and
`/app/lib`.

You can select the upstream build by setting `LLAMA_SERVER_VERSION` and
`LLAMA_SERVER_VARIANT`:

```sh
# Build with a specific llama.cpp server version
make docker-build LLAMA_SERVER_VERSION=b8840

# Specify all parameters
make docker-build LLAMA_SERVER_VERSION=b8840 LLAMA_SERVER_VARIANT=cpu
```

Default values:
- `LLAMA_SERVER_VERSION`: latest
- `LLAMA_SERVER_VARIANT`: cpu

Available variants:
- `cpu`: Default Linux image, backed by the upstream Vulkan build
- `cuda`: CUDA 13-accelerated version for NVIDIA GPUs
- `rocm`: ROCm-accelerated version for AMD GPUs

Supported `LLAMA_SERVER_VERSION` values:
- `latest`
- `bNNNN`

The resolved upstream image tags are:
- `cpu` -> `ghcr.io/ggml-org/llama.cpp:server-vulkan`
- `cuda` -> `ghcr.io/ggml-org/llama.cpp:server-cuda13`
- `rocm` -> `ghcr.io/ggml-org/llama.cpp:server-rocm`

For direct `docker buildx build` usage, pass the fully resolved image through
`LLAMA_UPSTREAM_IMAGE`:

```sh
docker buildx build \
  --target final-llamacpp \
  --build-arg LLAMA_UPSTREAM_IMAGE=ghcr.io/ggml-org/llama.cpp:server-vulkan-b8840 \
  -t docker/model-runner:llama-b8840 .
```

GPU variants still require a matching runtime base image. For example:

```sh
# CUDA-backed Linux image
make docker-build \
  LLAMA_SERVER_VARIANT=cuda \
  BASE_IMAGE=nvidia/cuda:13.0.2-runtime-ubuntu24.04

# ROCm-backed Linux image
make docker-build \
  LLAMA_SERVER_VARIANT=rocm \
  BASE_IMAGE=rocm/dev-ubuntu-24.04:7.2.1-complete
```

### vLLM integration

The Docker image also supports vLLM as an alternative inference backend.

#### Building the vLLM variant

To build a Docker image with vLLM support:

```sh
# Build with default settings (vLLM 0.19.1)
make docker-build DOCKER_TARGET=final-vllm BASE_IMAGE=nvidia/cuda:13.0.2-runtime-ubuntu24.04 LLAMA_SERVER_VARIANT=cuda

# Build for specific architecture
docker buildx build \
  --platform linux/amd64 \
  --target final-vllm \
  --build-arg BASE_IMAGE=nvidia/cuda:13.0.2-runtime-ubuntu24.04 \
  --build-arg LLAMA_SERVER_VARIANT=cuda \
  --build-arg VLLM_VERSION=0.19.1 \
  -t docker/model-runner:vllm .
```

#### Build Arguments

The vLLM variant supports the following build arguments:

- **VLLM_VERSION**: The vLLM version to install (default: `0.19.1`)
- **VLLM_CUDA_VERSION**: The CUDA version suffix for the wheel (default: `cu130`)
- **VLLM_PYTHON_TAG**: The Python compatibility tag (default: `cp38-abi3`, compatible with Python 3.8+)

#### Multi-Architecture Support

The vLLM variant supports both x86_64 (amd64) and aarch64 (arm64) architectures. The build process automatically selects the appropriate prebuilt wheel:

- **linux/amd64**: Uses `manylinux1_x86_64` wheels
- **linux/arm64**: Uses `manylinux2014_aarch64` wheels

To build for multiple architectures:

```sh
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --target final-vllm \
  --build-arg BASE_IMAGE=nvidia/cuda:13.0.2-runtime-ubuntu24.04 \
  --build-arg LLAMA_SERVER_VARIANT=cuda \
  -t docker/model-runner:vllm .
```

#### Updating to a New vLLM Version

To update to a new vLLM version:

```sh
docker buildx build \
  --target final-vllm \
  --build-arg VLLM_VERSION=0.19.1 \
  -t docker/model-runner:vllm-0.17.0 .
```

The vLLM wheels are sourced from the official vLLM GitHub Releases at `https://github.com/vllm-project/vllm/releases`, which provides prebuilt wheels for each release version.

## API Examples

The Model Runner exposes a REST API that can be accessed via TCP port. You can interact with it using curl commands.

### Using the API

When running with `docker-run`, you can use regular HTTP requests:

```sh
# List all available models
curl http://localhost:8080/models

# Create a new model
curl http://localhost:8080/models/create -X POST -d '{"from": "ai/smollm2"}'

# Get information about a specific model
curl http://localhost:8080/models/ai/smollm2

# Chat with a model
curl http://localhost:8080/engines/llama.cpp/v1/chat/completions -X POST -d '{
  "model": "ai/smollm2",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello, how are you?"}
  ]
}'

# Delete a model
curl http://localhost:8080/models/ai/smollm2 -X DELETE

# Get metrics
curl http://localhost:8080/metrics
```

The response will contain the model's reply:

```json
{
  "id": "chat-12345",
  "object": "chat.completion",
  "created": 1682456789,
  "model": "ai/smollm2",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "I'm doing well, thank you for asking! How can I assist you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 24,
    "completion_tokens": 16,
    "total_tokens": 40
  }
}
```

### Features

- **Automatic GPU Detection**: Automatically configures NVIDIA GPU support if available
- **Persistent Caching**: Models are cached in `~/.cache/nim` (or `$LOCAL_NIM_CACHE` if set)
- **Interactive Chat**: Supports both single prompt and interactive chat modes
- **Container Reuse**: Existing NIM containers are reused across runs

### Example Usage

**Single prompt:**
```bash
docker model run nvcr.io/nim/google/gemma-3-1b-it:latest "Explain quantum computing"
```

**Interactive chat:**
```bash
docker model run nvcr.io/nim/google/gemma-3-1b-it:latest
> Tell me a joke
...
> /bye
```

### Configuration

- **NGC_API_KEY**: Set this environment variable to authenticate with NVIDIA's services
- **LOCAL_NIM_CACHE**: Override the default cache location (default: `~/.cache/nim`)

### Technical Details

NIM containers:
- Run on port 8000 (localhost only)
- Use 16GB shared memory by default
- Mount `~/.cache/nim` for model caching
- Support NVIDIA GPU acceleration when available

## Metrics

The Model Runner exposes [the metrics endpoint](https://github.com/ggml-org/llama.cpp/tree/master/tools/server#get-metrics-prometheus-compatible-metrics-exporter) of llama.cpp server at the `/metrics` endpoint. This allows you to monitor model performance, request statistics, and resource usage.

### Accessing Metrics

```sh
# Get metrics in Prometheus format
curl http://localhost:8080/metrics
```

### Configuration

- **Enable metrics (default)**: Metrics are enabled by default
- **Disable metrics**: Set `DISABLE_METRICS=1` environment variable
- **Monitoring integration**: Add the endpoint to your Prometheus configuration

Check [METRICS.md](./METRICS.md) for more details.

##  Kubernetes

Experimental support for running in Kubernetes is available
in the form of [a Helm chart and static YAML](charts/docker-model-runner/README.md).

If you are interested in a specific Kubernetes use-case, please start a
discussion on the issue tracker.

## dmrlet: Container Orchestrator for AI Inference

dmrlet is a purpose-built container orchestrator for AI inference workloads. Unlike Kubernetes, it focuses exclusively on running stateless inference containers with zero configuration overhead. Multi-GPU mapping "just works" without YAML, device plugins, or node selectors.

### Building dmrlet

```bash
# Build the dmrlet binary
go build -o dmrlet ./cmd/dmrlet

# Verify it works
./dmrlet --help
```

### Usage

**Serve a model:**
```bash
# Auto-detect backend and GPUs
dmrlet serve gemma3
```

## Community

For general questions and discussion, please use [Docker Model Runner's Slack channel](https://dockercommunity.slack.com/archives/C09H9P5E57B).

For discussions about issues/bugs and features, you can use GitHub Issues and Pull requests.
