# 07 · 面向 AI 的 Docker

> 容器让「在我机器上能跑」成为历史。

**类型：** 构建
**语言：** Docker
**前置：** 阶段 0，第 01 课和第 03 课
**时长：** 约 60 分钟

## 学习目标

- 基于 Dockerfile 构建一个支持 GPU、内置 CUDA、PyTorch 及各类 AI 库的 Docker 镜像
- 将宿主机目录挂载为「卷（Volume）」，使模型、数据集和代码在容器重建后依然保留
- 配置 NVIDIA Container Toolkit（NVIDIA 容器工具包），将 GPU 暴露到容器内部
- 使用 Docker Compose 编排多服务 AI 应用（推理服务器 + 向量数据库）

## 问题所在

你在自己的笔记本上用 PyTorch 2.3、CUDA 12.4 和 Python 3.12 训练了一个模型。你的同事用的是 PyTorch 2.1、CUDA 11.8 和 Python 3.10。你的模型在他的机器上崩溃了。而你的 Dockerfile 在两台机器上都能跑。

AI 项目是依赖噩梦的重灾区。一个典型的技术栈包含 Python、PyTorch、CUDA 驱动、cuDNN、系统级 C 库，以及像 flash-attn 这类需要精确编译器版本的专用包。Docker 把这一切打包进单个镜像，使其在任何地方都以完全相同的方式运行。

## 核心概念

Docker 把你的代码、运行时、库和系统工具封装进一个被称为「容器（Container）」的隔离单元。可以把它看作一台轻量级虚拟机，区别在于它共享宿主机的操作系统内核，而不是运行自己的内核，因此启动只需几秒，而非几分钟。

```mermaid
graph TD
    subgraph without["Without Docker"]
        A1["Your machine<br/>Python 3.12<br/>CUDA 12.4<br/>PyTorch 2.3"] -->|crashes| X1["???"]
        A2["Their machine<br/>Python 3.10<br/>CUDA 11.8<br/>PyTorch 2.1"] -->|crashes| X2["???"]
        A3["Server<br/>Python 3.11<br/>CUDA 12.1<br/>PyTorch 2.2"] -->|crashes| X3["???"]
    end

    subgraph with_docker["With Docker — Same image everywhere"]
        B1["Your machine<br/>Python 3.12 | CUDA 12.4<br/>PyTorch 2.3 | Your code"]
        B2["Their machine<br/>Python 3.12 | CUDA 12.4<br/>PyTorch 2.3 | Your code"]
        B3["Server<br/>Python 3.12 | CUDA 12.4<br/>PyTorch 2.3 | Your code"]
    end
```

### 为什么 AI 项目比大多数项目更需要 Docker

1. **GPU 驱动非常脆弱。** CUDA 12.4 的代码无法在 CUDA 11.8 上运行。Docker 把 CUDA 工具包隔离在容器内部，同时通过 NVIDIA Container Toolkit 共享宿主机的 GPU 驱动。

2. **模型权重体积庞大。** 一个 7B 参数的模型在 fp16 精度下有 14 GB。你不会想每次重建都重新下载它。Docker 卷允许你从宿主机挂载一个模型目录。

3. **多服务架构很常见。** 真实的 AI 应用不只是一个 Python 脚本。它是一个推理服务器、一个用于 RAG 的向量数据库，也许还有一个 Web 前端。Docker Compose 用一条命令就能编排这一切。

### 关键术语

| 术语 | 含义 |
|------|---------------|
| Image（镜像） | 一个只读模板。你的「菜谱」。由 Dockerfile 构建而来。 |
| Container（容器） | 镜像的一个运行实例。你的「厨房」。 |
| Dockerfile | 用于构建镜像的指令。逐层叠加。 |
| Volume（卷） | 在容器重启后依然存续的持久化存储。 |
| docker-compose | 一个用 YAML 定义多容器应用的工具。 |

### AI 中常见的容器模式

```
Dev Container
  Full toolkit. Editor support. Jupyter. Debugging tools.
  Used during development and experimentation.

Training Container
  Minimal. Just the training script and dependencies.
  Runs on GPU clusters. No editor, no Jupyter.

Inference Container
  Optimized for serving. Small image. Fast cold start.
  Runs behind a load balancer in production.
```

## 动手构建

### 第 1 步：安装 Docker

```bash
# macOS
brew install --cask docker
open /Applications/Docker.app

# Ubuntu
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 注销并重新登录，使用户组变更生效
```

验证：

```bash
docker --version
docker run hello-world
```

### 第 2 步：安装 NVIDIA Container Toolkit（搭载 NVIDIA GPU 的 Linux）

它让 Docker 容器能够访问你的 GPU。macOS 和 Windows（WSL2）用户可以跳过这一步；Docker Desktop 在这些平台上以不同方式处理 GPU 透传。

```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

测试容器内的 GPU 访问：

```bash
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
```

如果你看到了自己的 GPU 信息，说明工具包正常工作。

### 第 3 步：理解基础镜像

选对基础镜像能省下数小时的调试时间。

```
nvidia/cuda:12.4.1-devel-ubuntu22.04
  Full CUDA toolkit. Compilers included.
  Use for: building packages that need nvcc (flash-attn, bitsandbytes)
  Size: ~4 GB

nvidia/cuda:12.4.1-runtime-ubuntu22.04
  CUDA runtime only. No compilers.
  Use for: running pre-built code
  Size: ~1.5 GB

pytorch/pytorch:2.3.1-cuda12.4-cudnn9-runtime
  PyTorch pre-installed on top of CUDA.
  Use for: skipping the PyTorch install step
  Size: ~6 GB

python:3.12-slim
  No CUDA. CPU only.
  Use for: inference on CPU, lightweight tools
  Size: ~150 MB
```

### 第 4 步：为 AI 开发编写 Dockerfile

这是 `code/Dockerfile` 中的 Dockerfile。逐行看一遍：

```dockerfile
FROM nvidia/cuda:12.4.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-venv \
    python3.12-dev \
    python3-pip \
    git \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.12 1

RUN python -m pip install --no-cache-dir --upgrade pip setuptools wheel

RUN python -m pip install --no-cache-dir \
    torch==2.3.1 \
    torchvision==0.18.1 \
    torchaudio==2.3.1 \
    --index-url https://download.pytorch.org/whl/cu124

RUN python -m pip install --no-cache-dir \
    numpy \
    pandas \
    scikit-learn \
    matplotlib \
    jupyter \
    transformers \
    datasets \
    accelerate \
    safetensors

WORKDIR /workspace

VOLUME ["/workspace", "/models"]

EXPOSE 8888

CMD ["python"]
```

构建它：

```bash
docker build -t ai-dev -f phases/00-setup-and-tooling/07-docker-for-ai/code/Dockerfile .
```

第一次会花一些时间（下载 CUDA 基础镜像 + PyTorch）。后续构建会使用缓存层。

运行它：

```bash
docker run --rm -it --gpus all \
    -v $(pwd):/workspace \
    -v ~/models:/models \
    ai-dev python -c "import torch; print(f'PyTorch {torch.__version__}, CUDA: {torch.cuda.is_available()}')"
```

在容器内运行 Jupyter：

```bash
docker run --rm -it --gpus all \
    -v $(pwd):/workspace \
    -v ~/models:/models \
    -p 8888:8888 \
    ai-dev jupyter notebook --ip=0.0.0.0 --port=8888 --no-browser --allow-root
```

### 第 5 步：为数据和模型挂载卷

卷挂载对 AI 工作至关重要。没有它，你那 14 GB 的模型下载会在容器停止时灰飞烟灭。

```bash
# 挂载你的代码
-v $(pwd):/workspace

# 挂载一个共享的模型目录
-v ~/models:/models

# 挂载数据集
-v ~/datasets:/data
```

在你的训练脚本中，从挂载路径加载：

```python
from transformers import AutoModel

model = AutoModel.from_pretrained("/models/llama-7b")
```

模型存放在你的宿主机文件系统上。你可以随心所欲地重建容器，无需重新下载。

### 第 6 步：用 Docker Compose 搭建多服务 AI 应用

一个真实的 RAG 应用需要一个推理服务器和一个向量数据库。Docker Compose 用一条命令同时运行两者。

参见 `code/docker-compose.yml`：

```yaml
services:
  ai-dev:
    build:
      context: .
      dockerfile: Dockerfile
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    volumes:
      - ../../../:/workspace
      - ~/models:/models
      - ~/datasets:/data
    ports:
      - "8888:8888"
    stdin_open: true
    tty: true
    command: jupyter notebook --ip=0.0.0.0 --port=8888 --no-browser --allow-root

  qdrant:
    image: qdrant/qdrant:v1.12.5
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  qdrant_data:
```

启动所有服务：

```bash
cd phases/00-setup-and-tooling/07-docker-for-ai/code
docker compose up -d
```

现在你的 AI 开发容器可以通过服务名在 `http://qdrant:6333` 访问向量数据库。Docker Compose 会自动创建一个共享网络。

在 AI 容器内部测试连接：

```python
from qdrant_client import QdrantClient

client = QdrantClient(host="qdrant", port=6333)
print(client.get_collections())
```

停止所有服务：

```bash
docker compose down
```

加上 `-v` 可以同时删除 qdrant 的卷：

```bash
docker compose down -v
```

### 第 7 步：AI 工作中实用的 Docker 命令

```bash
# 列出正在运行的容器
docker ps

# 列出所有镜像及其大小
docker images

# 删除未使用的镜像（回收磁盘空间）
docker system prune -a

# 查看运行中容器内的 GPU 使用情况
docker exec -it <container_id> nvidia-smi

# 从容器复制文件到宿主机
docker cp <container_id>:/workspace/results.csv ./results.csv

# 查看容器日志
docker logs -f <container_id>
```

## 实际运用

现在你拥有了一个可复现的 AI 开发环境。在本课程接下来的内容中：

- 使用 `docker compose up` 同时启动你的开发环境和向量数据库
- 把你的代码、模型和数据挂载为卷，使其在重建之间不会丢失
- 当某一课需要一个新的 Python 包时，把它加进 Dockerfile 并重建
- 把你的 Dockerfile 分享给队友。他们会得到完全相同的环境。

### 没有 GPU？

去掉 `--gpus all` 标志以及 NVIDIA 的 deploy 块。容器对于基于 CPU 的课程依然可用。PyTorch 会检测到 CUDA 不存在，并自动回退到 CPU。

## 练习

1. 构建该 Dockerfile，并在容器内运行 `python -c "import torch; print(torch.__version__)"`
2. 启动 docker-compose 服务栈，并验证可以从 AI 容器在 `http://qdrant:6333/collections` 访问 Qdrant
3. 把 `flask` 加进 Dockerfile，重建，并在 5000 端口运行一个简单的 API 服务器。用 `-p 5000:5000` 映射端口
4. 用 `docker images` 测量镜像大小。试着把基础镜像从 `devel` 切换为 `runtime`，并对比大小

## 关键术语

| 术语 | 人们常说 | 实际含义 |
|------|----------------|----------------------|
| Container（容器） | 「轻量级虚拟机」 | 一个使用宿主机内核的隔离进程，拥有自己的文件系统和网络 |
| Image layer（镜像层） | 「缓存的步骤」 | Dockerfile 中每条指令都会创建一层。未变更的层会被缓存，因此重建很快。 |
| NVIDIA Container Toolkit | 「Docker 里的 GPU」 | 一个运行时钩子，通过 `--gpus` 标志把宿主机 GPU 暴露给容器 |
| Volume mount（卷挂载） | 「共享文件夹」 | 宿主机上的一个目录被映射进容器。变更在容器停止后依然保留。 |
| Base image（基础镜像） | 「起点」 | 你的 Dockerfile 在其之上构建的 `FROM` 镜像。决定了预装了哪些内容。 |
