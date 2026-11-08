# Evidence: cheatsheets/gpu-cloud-docker-keys.md

Abbreviations: P0 = phases/00-setup-and-tooling. D3 = P0/03-gpu-setup-and-cloud/docs/en.md, C = P0/03-gpu-setup-and-cloud/code/gpu_check.py, D4 = P0/04-apis-and-keys/docs/en.md, F = P0/04-apis-and-keys/code/first_api_call.py, FT = P0/04-apis-and-keys/code/first_api_call.ts, PT = P0/04-apis-and-keys/outputs/prompt-api-troubleshooter.md, D7 = P0/07-docker-for-ai/docs/en.md, DF = P0/07-docker-for-ai/code/Dockerfile, DC = P0/07-docker-for-ai/code/docker-compose.yml.

## Where to run (defaults, 5)
- Local NVIDIA GPU, $0, CUDA + cuDNN, regular use, large datasets: D3:28-31
- Google Colab free tier, $0, Runtime > Change runtime type > T4 GPU: D3:33-36, 73
- Cloud GPU (Lambda, RunPod, Vast.ai), $0.20-2.00/hr, SSH + install, serious training: D3:38-41
- Phases 1-3 run fine on CPU: D3:19, 91
- fp16 rule of thumb 2 bytes per parameter, keep a margin: D3:131, 139

## Check the GPU (annotated-code, 8 lines)
- torch.cuda.is_available(): D3:63, C:13
- torch.version.cuda: D3:64, C:20
- torch.cuda.get_device_name(0): D3:66, C:21
- get_device_properties(0), total_memory / 1e9: C:23-24, 49
- params_fp16 = vram_gb * 1e9 / 2: C:50
- device line: D3:94
- torch.cuda.synchronize() around the GPU timing: D3:118-121, C:40-44

## Store and use an API key (flow, 5 steps)
1. export ANTHROPIC_API_KEY, never put keys in code: D4:45-48
2. .env file, add it to .gitignore: D4:52-55, FT:24-25, 54
3. anthropic.Anthropic() client: D4:66, F:15
4. endpoint, key, body with model, max_tokens, messages: D4:31-34, F:37-41
5. content, usage, stop_reason fields: D4:153

## First call with the SDK (annotated-code, 9 lines)
- anthropic.Anthropic(): D4:66
- LLM_MODEL default claude-sonnet-5: D4:68, 79, F:5
- client.messages.create with model, max_tokens=256, messages: D4:70-74
- response.content[0].text: D4:76
- response.usage.input_tokens, output_tokens: F:22

## Raw HTTP call (defaults, 6)
- https://api.anthropic.com/v1/messages, method="POST": D4:106, 118
- x-api-key from ANTHROPIC_API_KEY: D4:109
- anthropic-version 2023-06-01: D4:110
- LLM_MODEL default claude-sonnet-5, un-dated Sonnet alias: D4:113, 79
- max_tokens 256: D4:114
- MOCK set to "1" skips the network: FT:3, 71

## API errors (troubleshooting, 7)
- 401 Unauthorized, key wrong or missing: PT:12, echo check PT:21, D4:155
- 403 Forbidden: PT:13
- 429 Too Many Requests: PT:14
- 400 Bad Request: PT:15
- 500/502/503: PT:16
- Timeout, reduce max_tokens or use streaming: PT:17
- Connection refused, curl -I https://api.anthropic.com: PT:18, 24

## Install Docker and GPU access (command-table, 6)
- curl -fsSL https://get.docker.com | sh: D7:90
- sudo usermod -aG docker $USER, log out and back in: D7:91-92
- docker run hello-world: D7:99
- sudo apt-get install -y nvidia-container-toolkit: D7:114
- sudo nvidia-ctk runtime configure --runtime=docker, sudo systemctl restart docker: D7:115-116
- docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi: D7:122

## Base images (defaults, 4)
- nvidia/cuda:12.4.1-devel-ubuntu22.04, ~4 GB, nvcc for flash-attn, bitsandbytes: D7:132-135
- nvidia/cuda:12.4.1-runtime-ubuntu22.04, ~1.5 GB, no compilers: D7:137-140
- pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime, ~6 GB: D7:142-145
- python:3.12-slim, ~150 MB, CPU only: D7:147-150

## Build and run the dev image (annotated-code, 6 lines)
- docker build -t ai-dev -f .../Dockerfile .: D7:214
- docker run --rm -it --gpus all, -v $(pwd):/workspace, -v ~/models:/models, -p 8888:8888, jupyter command: D7:233-237
- models survive rebuilds: D7:242, 263
- Dockerfile EXPOSE 8888: DF:49

## Compose stack (architecture, 4 nodes, 3 edges)
- Host folders ../../../, ~/models, ~/datasets mounted into ai-dev: DC:13-16
- ai-dev with Jupyter on 8888 and nvidia GPU reservation: DC:2-21
- qdrant image qdrant/qdrant:v1.12.5: DC:23-24
- qdrant_data volume at /qdrant/storage: DC:28-32
- http://qdrant:6333 by service name: D7:313

## Docker tasks (task-table, 7)
- docker compose up -d: D7:310
- docker compose down -v deletes the qdrant volume: D7:330-333
- docker compose exec ai-dev bash: D7:382
- docker images: D7:343
- docker system prune -a: D7:346
- docker exec -it <container_id> nvidia-smi: D7:349
- docker logs -f <container_id>: D7:355

## Docker fixes (troubleshooting, 4)
- No matching distribution for torch==2.6.0+cu124 on a Mac, --platform=linux/amd64: D7:219, DF:1
- No GPU: drop --gpus all and the NVIDIA deploy block: D7:219, 369
- 14 GB model downloads vanish without volume mounts: D7:242, 249
- Server bound to localhost not reachable, host="0.0.0.0", -p 5000:5000: D7:375, 384

## Tips (tips, 5)
- First GPU run includes start-up cost: D3:135
- Run !nvidia-smi in Colab first: D3:137
- Set up keys when the lesson requires it: D4:136
- Raw HTTP helps when debugging: D4:124
- Add packages to the Dockerfile and rebuild, cached layers: D7:364, 393
