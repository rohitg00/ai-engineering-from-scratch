# Phase 00 — Docker for AI

## Environment

- Host: macOS 14.1 on Apple Silicon
- Host architecture: ARM64
- Docker Engine: 28.0.1
- Docker Desktop: 4.39.0
- Container platform: Linux ARM64
- Docker resources: 16 CPUs and approximately 8.2 GB memory

## Docker image

Built a native ARM64 AI development image containing:

- Python 3.12
- NumPy 2.2.6
- PyTorch 2.6.0 CPU
- Flask 3.1.2

The image successfully performed a PyTorch tensor dot product:

- Tensor device: CPU
- Result: 14.0
- CUDA available: false

Apple MPS is available to native macOS PyTorch but is not exposed to
Linux containers through Docker Desktop. NVIDIA CUDA container exercises
therefore require an NVIDIA Linux machine or cloud GPU.

## Persistent storage

Verified a bind mount between macOS and a temporary container:

- The container read a file created on the host
- The container wrote a second file into the mounted directory
- The output file remained available after the container exited

Docker volumes and bind mounts keep datasets, model weights, and database
state outside a container's temporary writable layer.

## Docker Compose

Created a Compose stack containing:

- `ai-dev`: the Python, PyTorch, and Flask application
- `qdrant`: Qdrant vector database 1.19.0
- A private Compose network
- A named Qdrant storage volume

Verified:

- Qdrant was reachable from macOS on port 6333
- The AI container reached Qdrant using `qdrant` as the internal hostname
- Container-to-container communication returned HTTP 200
- Qdrant returned an empty collection list successfully

## Flask API

Added a Flask health endpoint and mapped container port 5000 to the Mac.

The endpoint reported:

- Status: OK
- Architecture: AArch64
- PyTorch: 2.6.0 CPU
- Device: CPU
- CUDA unavailable, as expected

## Image-size comparison

Compared identical applications using two Python base images:

| Image | Base image | Size |
|---|---|---:|
| `aiefs-ai-dev:cpu` | `python:3.12-slim` | 1.0 GB |
| `aiefs-ai-dev:full` | `python:3.12` | 2.4 GB |

The slim image saved approximately 1.4 GB, or 58 percent. Smaller runtime
images reduce downloads, deployment time, storage use, and attack surface.

## Key lessons

- An image is an immutable application blueprint
- A container is a running instance of an image
- Port mappings expose container services to the host
- Compose manages related services and their private network
- Service names provide DNS discovery inside a Compose network
- Volumes preserve data independently of container lifetimes
- Base-image selection significantly affects deployment size
- Versioned image tags are more reproducible than `latest`
- Docker configurations must account for host CPU and GPU architecture

## Cleanup

Stopped and removed the lesson containers, Compose network, and demonstration
volume. Removed the temporary full-sized comparison image and retained the
reusable slim CPU image.
