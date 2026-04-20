---
name: skill-docker-ai
description: Containerize AI models with proper GPU support, weight management, and health checks
version: 1.0.0
phase: 17
lesson: 2
tags: [docker, gpu, nvidia, containers, model-deployment, infrastructure]
---

# Docker for AI Pattern

Every AI container follows this structure:

```
NVIDIA base image -> install deps -> copy code -> mount weights -> health check -> serve
```

Weights stay outside the image. GPU access requires explicit passthrough. Health checks verify inference, not just liveness.

## Base image selection

| Use case | Base image |
|----------|-----------|
| Inference only | nvidia/cuda:12.x-cudnn-runtime-ubuntu22.04 |
| Custom CUDA kernels | nvidia/cuda:12.x-cudnn-devel-ubuntu22.04 |
| Zero config | nvcr.io/nvidia/pytorch:24.xx-py3 |
| Pre-built model | NVIDIA NIM containers |

## Dockerfile checklist

1. Use multi-stage build (builder with devel, runtime with runtime base)
2. Install Python dependencies in builder stage, copy venv to runtime
3. Place COPY requirements.txt before COPY . for layer caching
4. Mount model weights as volumes, do not COPY them
5. Set HEALTHCHECK that verifies model loading and inference
6. Use --start-period for health checks (models take 30-120s to load)

## Common mistakes

- Baking model weights into the image (20GB+ images, slow deploys, rebuild on model swap)
- Forgetting --gpus flag (PyTorch silently falls back to CPU)
- Using devel base for inference (2GB wasted on compiler toolchain)
- Health check only pings HTTP (misses model-not-loaded failures)
- No .dockerignore (sending model weights and .venv to build context)
- Not setting PYTHONUNBUFFERED=1 (logs buffer and disappear on crash)

## GPU passthrough

```bash
docker run --gpus all ...          # all GPUs
docker run --gpus '"device=0"' ... # specific GPU
```

Requires NVIDIA Container Toolkit on host. Verify with `nvidia-smi` inside container.

## Docker Compose GPU syntax

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

## Production parameters

- Image size target: 5-8GB (without weights)
- Health check interval: 30s with 60-120s start period
- Volume mount weights as read-only (:ro)
- Set memory limits to prevent OOM from killing other containers
- Use restart: unless-stopped for automatic recovery
