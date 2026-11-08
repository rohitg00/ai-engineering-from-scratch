---
id: gpu-cloud-docker-keys
title: GPUs, Cloud, Docker and API Keys
code: GC
subtitle: Check the GPU, size a model for VRAM, run CUDA in Docker, store API keys and fix API errors.
hue: 135
sources: phases/00-setup-and-tooling/03-gpu-setup-and-cloud, phases/00-setup-and-tooling/04-apis-and-keys, phases/00-setup-and-tooling/07-docker-for-ai
source_hash: e45710fb5dcd7c6b
---

## Where to run
type: defaults
from: phases/00-setup-and-tooling/03-gpu-setup-and-cloud/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Local NVIDIA GPU | $0 | Install CUDA + cuDNN. Regular use, large datasets |
| Google Colab (free tier) | $0 | Runtime > Change runtime type > T4 GPU |
| Cloud GPU (Lambda, RunPod, Vast.ai) | $0.20-2.00/hr | SSH + install. Serious training |
| CPU | phases 1-3 | Most lessons run fine on CPU |
| fp16 rule of thumb | 2 bytes per parameter | Keep a margin for activations |

## Check the GPU
type: annotated-code
lang: python
from: phases/00-setup-and-tooling/03-gpu-setup-and-cloud/docs/en.md, phases/00-setup-and-tooling/03-gpu-setup-and-cloud/code/gpu_check.py

```python
torch.cuda.is_available()                     # False means no GPU
torch.version.cuda                            # PyTorch CUDA version
torch.cuda.get_device_name(0)                 # GPU name
props = torch.cuda.get_device_properties(0)
vram_gb = props.total_memory / 1e9            # VRAM in GB
params_fp16 = vram_gb * 1e9 / 2               # max parameters in fp16
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
torch.cuda.synchronize()                      # before and after a GPU timing
```

## Store and use an API key
type: flow
from: phases/00-setup-and-tooling/04-apis-and-keys/docs/en.md, phases/00-setup-and-tooling/04-apis-and-keys/code/first_api_call.py, phases/00-setup-and-tooling/04-apis-and-keys/code/first_api_call.ts

1. **Shell**: `export ANTHROPIC_API_KEY="sk-ant-..."`. Never put keys in code.
2. **.env file**: `ANTHROPIC_API_KEY=sk-ant-...`. Add `.env` to `.gitignore`.
3. **SDK**: `anthropic.Anthropic()` reads the key from the environment.
4. **Request**: endpoint, key, and a body with `model`, `max_tokens`, `messages`.
5. **Response**: JSON with `content`, `usage` and `stop_reason`.

## First call with the SDK
type: annotated-code
lang: python
from: phases/00-setup-and-tooling/04-apis-and-keys/docs/en.md, phases/00-setup-and-tooling/04-apis-and-keys/code/first_api_call.py

```python
client = anthropic.Anthropic()
MODEL = os.environ.get("LLM_MODEL", "claude-sonnet-5")   # model id
response = client.messages.create(
    model=MODEL,
    max_tokens=256,
    messages=[{"role": "user", "content": "<prompt>"}]
)
print(response.content[0].text)                          # reply text
response.usage.input_tokens, response.usage.output_tokens  # billed tokens
```

## Raw HTTP call
type: defaults
from: phases/00-setup-and-tooling/04-apis-and-keys/docs/en.md, phases/00-setup-and-tooling/04-apis-and-keys/code/first_api_call.py, phases/00-setup-and-tooling/04-apis-and-keys/code/first_api_call.ts

| Setting | Default | Note |
|---|---|---|
| Endpoint | `https://api.anthropic.com/v1/messages` | `method="POST"` |
| `x-api-key` | `ANTHROPIC_API_KEY` | Key header |
| `anthropic-version` | `2023-06-01` | Version header |
| `LLM_MODEL` | `claude-sonnet-5` | Un-dated Sonnet alias |
| `max_tokens` | 256 | Lesson value |
| `MOCK` | `"1"` | TypeScript port then skips the network |

## API errors
type: troubleshooting
from: phases/00-setup-and-tooling/04-apis-and-keys/outputs/prompt-api-troubleshooter.md, phases/00-setup-and-tooling/04-apis-and-keys/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| 401 Unauthorized | Key wrong or missing | `echo $ANTHROPIC_API_KEY \| head -c 10` |
| 403 Forbidden | No permission for endpoint or model | Check the key permissions |
| 429 Too Many Requests | Rate limited | Wait and retry, or reduce frequency |
| 400 Bad Request | Malformed body | Check fields, model name, message format |
| 500/502/503 | Server-side issue | Wait a minute and retry |
| Timeout | Request took too long | Reduce max_tokens or use streaming |
| Connection refused | Wrong base URL or network | `curl -I https://api.anthropic.com` |

## Install Docker and GPU access
type: command-table
from: phases/00-setup-and-tooling/07-docker-for-ai/docs/en.md
span: 2

| Command | What it does |
|---|---|
| `curl -fsSL https://get.docker.com \| sh` | Install Docker on Ubuntu |
| `sudo usermod -aG docker $USER` | Docker without sudo. Log out and back in |
| `docker run hello-world` | Verify the install |
| `sudo apt-get install -y nvidia-container-toolkit` | GPU access for containers (Linux) |
| `sudo nvidia-ctk runtime configure --runtime=docker` | Register the runtime, then `sudo systemctl restart docker` |
| `docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi` | Test the GPU in a container |

## Base images
type: defaults
from: phases/00-setup-and-tooling/07-docker-for-ai/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `nvidia/cuda:12.4.1-devel-ubuntu22.04` | ~4 GB | nvcc for flash-attn, bitsandbytes |
| `nvidia/cuda:12.4.1-runtime-ubuntu22.04` | ~1.5 GB | Pre-built code. No compilers |
| `pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime` | ~6 GB | PyTorch already installed |
| `python:3.12-slim` | ~150 MB | No CUDA. CPU only |

## Build and run the dev image
type: annotated-code
lang: bash
from: phases/00-setup-and-tooling/07-docker-for-ai/docs/en.md, phases/00-setup-and-tooling/07-docker-for-ai/code/Dockerfile

```bash
docker build -t ai-dev -f phases/00-setup-and-tooling/07-docker-for-ai/code/Dockerfile .
docker run --rm -it --gpus all \
    -v $(pwd):/workspace \               # your code
    -v ~/models:/models \                # models survive rebuilds
    -p 8888:8888 \                       # Jupyter port
    ai-dev jupyter notebook --ip=0.0.0.0 --port=8888 --no-browser --allow-root
```

## Compose stack
type: architecture
from: phases/00-setup-and-tooling/07-docker-for-ai/code/docker-compose.yml, phases/00-setup-and-tooling/07-docker-for-ai/docs/en.md

```arch
node | host | 1,1 | Host folders | ~/models, ~/datasets, repo | store
node | dev | 2,1 | ai-dev | Jupyter on 8888, nvidia GPU | gpu
node | qd | 3,1 | qdrant | qdrant/qdrant:v1.12.5 | store
node | vol | 3,2 | qdrant_data | /qdrant/storage | store
edge | host | dev | volumes
edge | dev | qd | http://qdrant:6333
edge | qd | vol | volume
```

## Docker tasks
type: task-table
from: phases/00-setup-and-tooling/07-docker-for-ai/docs/en.md

| Task | Code |
|---|---|
| Start the stack | `docker compose up -d` |
| Stop and delete the volume | `docker compose down -v` |
| Shell in a service | `docker compose exec ai-dev bash` |
| Image sizes | `docker images` |
| Reclaim disk | `docker system prune -a` |
| GPU in a container | `docker exec -it <container_id> nvidia-smi` |
| Follow logs | `docker logs -f <container_id>` |

## Docker fixes
type: troubleshooting
from: phases/00-setup-and-tooling/07-docker-for-ai/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `No matching distribution found for torch==2.6.0+cu124` | Mac picks the arm64 image | `FROM --platform=linux/amd64` |
| No GPU on a Mac or CPU box | No CUDA there | Drop `--gpus all` and the NVIDIA deploy block |
| 14 GB model gone after stop | No volume mount | `-v ~/models:/models` |
| Server not reachable from host | Bound to localhost | `host="0.0.0.0"` and `-p 5000:5000` |

## Tips
type: tips
from: phases/00-setup-and-tooling/03-gpu-setup-and-cloud/docs/en.md, phases/00-setup-and-tooling/04-apis-and-keys/docs/en.md, phases/00-setup-and-tooling/07-docker-for-ai/docs/en.md

- Time the second GPU run. The first run includes start-up cost.
- Run `!nvidia-smi` in Colab before you trust a benchmark.
- Set up each API key when a lesson needs it.
- Read the raw HTTP call when an SDK call fails.
- Add new packages to the Dockerfile and rebuild. Unchanged layers come from cache.
