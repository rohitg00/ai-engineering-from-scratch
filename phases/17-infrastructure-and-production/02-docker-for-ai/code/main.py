import os
import json
import time
import hashlib
import random


def generate_dockerfile():
    return """FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \\
    python3.11 python3.11-dev python3.11-venv python3-pip \\
    build-essential git && \\
    rm -rf /var/lib/apt/lists/*

RUN python3.11 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \\
    python3.11 curl && \\
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
COPY . /app

ENV MODEL_PATH=/models
ENV PORT=8000
ENV MAX_BATCH_SIZE=8
ENV MAX_QUEUE_SIZE=50

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \\
    CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["python3.11", "server.py"]"""


def generate_dockerfile_single_stage():
    return """FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \\
    python3.11 python3.11-dev python3.11-venv python3-pip \\
    build-essential git curl && \\
    rm -rf /var/lib/apt/lists/*

RUN python3.11 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

WORKDIR /app
COPY . /app

ENV MODEL_PATH=/models
ENV PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \\
    CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["python3.11", "server.py"]"""


def generate_docker_compose():
    return """services:
  model-server:
    build:
      context: .
      dockerfile: Dockerfile
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    volumes:
      - ./models:/models:ro
      - model-cache:/root/.cache
    ports:
      - "8000:8000"
    environment:
      - MODEL_PATH=/models/llama-7b
      - MAX_BATCH_SIZE=8
      - MAX_QUEUE_SIZE=50
      - LOG_LEVEL=info
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 120s
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      model-server:
        condition: service_healthy

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    depends_on:
      - model-server

volumes:
  model-cache:"""


def generate_requirements():
    return """torch==2.3.0
vllm==0.4.2
transformers==4.41.0
tokenizers==0.19.1
accelerate==0.30.0
safetensors==0.4.3
uvicorn==0.29.0
fastapi==0.111.0
pydantic==2.7.0
prometheus-client==0.20.0"""


def generate_dockerignore():
    return """*.pyc
__pycache__
*.egg-info
.git
.gitignore
.env
*.md
models/
*.ckpt
*.bin
*.safetensors
.venv/
venv/
.mypy_cache/
.pytest_cache/
.idea/
.vscode/
*.log
docker-compose*.yml
Dockerfile*
.dockerignore"""


def generate_nginx_conf():
    return """events {
    worker_connections 1024;
}

http {
    upstream model_backend {
        server model-server:8000;
    }

    server {
        listen 80;

        location / {
            proxy_pass http://model_backend;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 120s;
            proxy_buffering off;
        }

        location /health {
            proxy_pass http://model_backend/health;
            proxy_read_timeout 5s;
        }
    }
}"""


class DockerLayer:
    def __init__(self, instruction, size_mb, cached=False, description=""):
        self.instruction = instruction
        self.size_mb = size_mb
        self.cached = cached
        self.description = description
        self.hash = hashlib.md5(instruction.encode()).hexdigest()[:12]


def simulate_build(dockerfile_content, name="multi-stage"):
    layers = []

    if "AS builder" in dockerfile_content:
        layers.append(DockerLayer(
            "FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04 AS builder",
            3800, True, "CUDA devel base (builder stage)"
        ))
        layers.append(DockerLayer(
            "RUN apt-get update && install python3.11 + build tools",
            450, True, "Python + build dependencies"
        ))
        layers.append(DockerLayer(
            "RUN pip install -r requirements.txt",
            2800, True, "PyTorch + ML libraries"
        ))
        layers.append(DockerLayer(
            "FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04",
            1900, True, "CUDA runtime base (final stage)"
        ))
        layers.append(DockerLayer(
            "RUN apt-get install python3.11 curl",
            120, True, "Minimal runtime deps"
        ))
        layers.append(DockerLayer(
            "COPY --from=builder /opt/venv /opt/venv",
            2800, True, "Compiled Python packages"
        ))
        layers.append(DockerLayer(
            "COPY . /app",
            5, False, "Application code"
        ))
    else:
        layers.append(DockerLayer(
            "FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04",
            3800, True, "CUDA devel base (includes compiler)"
        ))
        layers.append(DockerLayer(
            "RUN apt-get update && install python3.11 + build tools",
            450, True, "Python + build dependencies"
        ))
        layers.append(DockerLayer(
            "RUN pip install -r requirements.txt",
            2800, True, "PyTorch + ML libraries"
        ))
        layers.append(DockerLayer(
            "COPY . /app",
            5, False, "Application code"
        ))

    return layers


def calculate_image_size(layers, multi_stage=True):
    if multi_stage:
        final_stage_start = None
        for i, layer in enumerate(layers):
            if "runtime" in layer.instruction.lower() or "final" in layer.description.lower():
                final_stage_start = i
                break

        if final_stage_start is not None:
            return sum(l.size_mb for l in layers[final_stage_start:])

    return sum(l.size_mb for l in layers)


class GPUDetector:
    def __init__(self, gpus_available=None):
        if gpus_available is None:
            self.gpus = []
        else:
            self.gpus = gpus_available

    def detect(self):
        return {
            "cuda_available": len(self.gpus) > 0,
            "device_count": len(self.gpus),
            "devices": self.gpus,
        }

    def verify_container_access(self, gpus_flag):
        if gpus_flag == "all":
            return self.gpus
        if gpus_flag == "none" or gpus_flag is None:
            return []
        if gpus_flag.startswith("device="):
            device_ids = gpus_flag.replace("device=", "").split(",")
            return [g for g in self.gpus if str(g["id"]) in device_ids]
        return []


class HealthChecker:
    def __init__(self, model_loaded=False, gpu_available=False):
        self.model_loaded = model_loaded
        self.gpu_available = gpu_available
        self.last_inference_ok = False
        self.uptime_start = time.time()

    def check(self):
        status = "healthy" if all([
            self.model_loaded,
            self.gpu_available,
            self.last_inference_ok,
        ]) else "unhealthy"

        return {
            "status": status,
            "model_loaded": self.model_loaded,
            "gpu_available": self.gpu_available,
            "last_inference_ok": self.last_inference_ok,
            "uptime_seconds": round(time.time() - self.uptime_start, 1),
        }

    def run_inference_check(self):
        success = self.model_loaded and self.gpu_available
        self.last_inference_ok = success
        return success


def simulate_model_weights_scenarios():
    scenarios = {
        "baked_into_image": {
            "image_size_gb": 22.5,
            "pull_time_seconds": 450,
            "rebuild_on_code_change_gb": 22.5,
            "swap_model_requires_rebuild": True,
        },
        "volume_mounted": {
            "image_size_gb": 5.2,
            "pull_time_seconds": 104,
            "rebuild_on_code_change_gb": 0.005,
            "swap_model_requires_rebuild": False,
        },
    }
    return scenarios


def main():
    print("=" * 60)
    print("DOCKER FOR AI WORKLOADS")
    print("=" * 60)

    print("\nSTEP 1: Generate Dockerfile (Multi-Stage)")
    print("-" * 40)

    dockerfile = generate_dockerfile()
    lines = dockerfile.strip().split("\n")
    print(f"  Generated Dockerfile: {len(lines)} lines")
    print(f"  Stages: 2 (builder + runtime)")
    print(f"  Builder base: nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04")
    print(f"  Runtime base: nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04")
    print()
    for i, line in enumerate(lines):
        if line.strip() and not line.startswith("#"):
            print(f"    {line}")

    print("\n\nSTEP 2: Simulate Build (Multi-Stage vs Single-Stage)")
    print("-" * 40)

    multi_layers = simulate_build(dockerfile, "multi-stage")
    single_layers = simulate_build(generate_dockerfile_single_stage(), "single-stage")

    multi_size = calculate_image_size(multi_layers, multi_stage=True)
    single_size = calculate_image_size(single_layers, multi_stage=False)

    print(f"\n  Multi-stage build layers:")
    for layer in multi_layers:
        cached = "CACHED" if layer.cached else "BUILD"
        print(f"    [{cached:6s}] {layer.size_mb:>5d}MB | {layer.description}")

    print(f"\n  Single-stage build layers:")
    for layer in single_layers:
        cached = "CACHED" if layer.cached else "BUILD"
        print(f"    [{cached:6s}] {layer.size_mb:>5d}MB | {layer.description}")

    print(f"\n  Final image comparison:")
    print(f"    Multi-stage:  {multi_size:>5d}MB ({multi_size/1024:.1f}GB)")
    print(f"    Single-stage: {single_size:>5d}MB ({single_size/1024:.1f}GB)")
    print(f"    Savings:      {single_size - multi_size:>5d}MB ({(single_size - multi_size)/1024:.1f}GB)")

    print("\n\nSTEP 3: Model Weights Strategy")
    print("-" * 40)

    scenarios = simulate_model_weights_scenarios()

    print(f"\n  Scenario A: Weights baked into image")
    baked = scenarios["baked_into_image"]
    print(f"    Image size:              {baked['image_size_gb']:.1f}GB")
    print(f"    Pull time (1Gbps):       {baked['pull_time_seconds']}s")
    print(f"    Rebuild on code change:  {baked['rebuild_on_code_change_gb']:.1f}GB re-upload")
    print(f"    Model swap:              Requires full rebuild")

    print(f"\n  Scenario B: Weights mounted as volume")
    mounted = scenarios["volume_mounted"]
    print(f"    Image size:              {mounted['image_size_gb']:.1f}GB")
    print(f"    Pull time (1Gbps):       {mounted['pull_time_seconds']}s")
    print(f"    Rebuild on code change:  {mounted['rebuild_on_code_change_gb']*1000:.0f}MB re-upload")
    print(f"    Model swap:              Change mount path, no rebuild")

    speedup = baked["pull_time_seconds"] / mounted["pull_time_seconds"]
    print(f"\n  Volume mounting is {speedup:.1f}x faster to deploy")

    print("\n\nSTEP 4: GPU Passthrough Simulation")
    print("-" * 40)

    host_gpus = [
        {"id": 0, "name": "NVIDIA A100 80GB", "memory_mb": 81920, "utilization": 0},
        {"id": 1, "name": "NVIDIA A100 80GB", "memory_mb": 81920, "utilization": 0},
    ]

    detector = GPUDetector(host_gpus)

    configs = [
        ("--gpus all", "all"),
        ("--gpus '\"device=0\"'", "device=0"),
        ("--gpus '\"device=0,1\"'", "device=0,1"),
        ("(no --gpus flag)", None),
    ]

    for flag_display, flag_value in configs:
        visible = detector.verify_container_access(flag_value)
        print(f"\n  docker run {flag_display}")
        print(f"    GPUs visible to container: {len(visible)}")
        if visible:
            for gpu in visible:
                print(f"      GPU {gpu['id']}: {gpu['name']} ({gpu['memory_mb']}MB)")
            print(f"    torch.cuda.is_available() = True")
        else:
            print(f"    torch.cuda.is_available() = False")
            print(f"    WARNING: Model will fall back to CPU silently!")

    print("\n\nSTEP 5: Health Check Scenarios")
    print("-" * 40)

    scenarios_health = [
        ("Container starting, model loading", False, True, "Starting up"),
        ("Model loaded, GPU available", True, True, "Normal operation"),
        ("GPU out of memory", True, False, "GPU crashed"),
        ("Process alive, model failed to load", False, True, "Silent failure"),
    ]

    for description, model_loaded, gpu_available, scenario_name in scenarios_health:
        checker = HealthChecker(model_loaded, gpu_available)
        checker.run_inference_check()
        result = checker.check()

        status_str = "HEALTHY" if result["status"] == "healthy" else "UNHEALTHY"
        print(f"\n  Scenario: {scenario_name}")
        print(f"    Model loaded:     {result['model_loaded']}")
        print(f"    GPU available:    {result['gpu_available']}")
        print(f"    Inference check:  {result['last_inference_ok']}")
        print(f"    Status:           {status_str}")

    print("\n\nSTEP 6: Docker Compose with GPU")
    print("-" * 40)

    compose = generate_docker_compose()
    compose_lines = compose.strip().split("\n")
    print(f"  Generated docker-compose.yml: {len(compose_lines)} lines")
    print(f"  Services: model-server (GPU), nginx, prometheus")
    print()
    for line in compose_lines:
        print(f"    {line}")

    print("\n\nSTEP 7: Supporting Files")
    print("-" * 40)

    requirements = generate_requirements()
    dockerignore = generate_dockerignore()
    nginx_conf = generate_nginx_conf()

    print(f"\n  requirements.txt ({len(requirements.strip().split(chr(10)))} packages):")
    for line in requirements.strip().split("\n"):
        print(f"    {line}")

    print(f"\n  .dockerignore ({len(dockerignore.strip().split(chr(10)))} patterns):")
    for line in dockerignore.strip().split("\n"):
        print(f"    {line}")

    print(f"\n  nginx.conf (reverse proxy for model server):")
    for line in nginx_conf.strip().split("\n")[:10]:
        print(f"    {line}")
    print(f"    ... ({len(nginx_conf.strip().split(chr(10))) - 10} more lines)")

    print("\n\nSTEP 8: Layer Caching Analysis")
    print("-" * 40)

    print("\n  Scenario: Code change only (no dependency changes)")
    print()
    print("  Multi-stage build:")
    total_time = 0
    for layer in multi_layers:
        if layer.cached:
            print(f"    CACHED   {layer.description}")
        else:
            build_time = layer.size_mb * 0.01
            total_time += build_time
            print(f"    BUILD    {layer.description} ({build_time:.1f}s)")
    print(f"    Total rebuild time: {total_time:.1f}s")

    print()
    print("  Scenario: Dependency change (new package in requirements.txt)")
    dep_time = 0
    for layer in multi_layers:
        if "requirements" in layer.instruction or "venv" in layer.instruction:
            build_time = layer.size_mb * 0.05
            dep_time += build_time
            print(f"    BUILD    {layer.description} ({build_time:.1f}s)")
        elif not layer.cached:
            build_time = layer.size_mb * 0.01
            dep_time += build_time
            print(f"    BUILD    {layer.description} ({build_time:.1f}s)")
        else:
            print(f"    CACHED   {layer.description}")
    print(f"    Total rebuild time: {dep_time:.1f}s")

    print("\n\nSTEP 9: Run Commands")
    print("-" * 40)

    commands = [
        (
            "Build the image",
            "docker build -t my-model-server:latest ."
        ),
        (
            "Run with GPU and volume-mounted weights",
            "docker run --gpus all -v /data/models:/models -p 8000:8000 my-model-server:latest"
        ),
        (
            "Run with specific GPU",
            'docker run --gpus \'"device=0"\' -v /data/models:/models -p 8000:8000 my-model-server:latest'
        ),
        (
            "Run with docker-compose",
            "docker compose up -d"
        ),
        (
            "Check health",
            "curl http://localhost:8000/health"
        ),
        (
            "View logs",
            "docker compose logs -f model-server"
        ),
        (
            "Pull NVIDIA NIM (alternative)",
            "docker run --gpus all -p 8000:8000 nvcr.io/nim/meta/llama-3.1-8b-instruct:latest"
        ),
    ]

    for description, command in commands:
        print(f"\n  {description}:")
        print(f"    $ {command}")

    print("\n\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print("  Built Docker configuration for AI model serving:")
    print(f"    - Multi-stage Dockerfile ({len(lines)} lines)")
    print(f"    - Docker Compose with GPU reservation (3 services)")
    print(f"    - Image size: {multi_size/1024:.1f}GB (multi-stage) vs {single_size/1024:.1f}GB (single-stage)")
    print(f"    - Health checks verifying model + GPU + inference")
    print(f"    - Volume mounts for model weights ({speedup:.1f}x faster deploys)")
    print(f"    - Layer caching for fast code-only rebuilds")
    print()
    print("  Key takeaways:")
    print("    1. Use NVIDIA base images (cuda:runtime for inference)")
    print("    2. Mount model weights as volumes, never bake into images")
    print("    3. Multi-stage builds save 2-3GB per image")
    print("    4. Always pass --gpus flag (silent CPU fallback otherwise)")
    print("    5. Health checks must verify inference, not just process liveness")


if __name__ == "__main__":
    main()
