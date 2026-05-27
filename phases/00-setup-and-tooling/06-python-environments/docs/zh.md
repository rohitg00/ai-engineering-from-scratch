# Python 环境

> 依赖地狱真实存在。虚拟环境就是解药。

**类型：** 构建  
**语言：** Python  
**前置条件：** 阶段 0，课程 01  
**时间：** 约30分钟

## 学习目标

- 使用 `uv`、`venv` 或 `conda` 创建隔离的虚拟环境
- 编写包含可选依赖组的 `pyproject.toml`，并生成锁文件（Lockfile）以实现可复现性
- 诊断并修复常见问题：全局安装、pip/conda 混合使用、CUDA 版本不匹配
- 针对存在依赖冲突的项目实现分阶段的环境策略

## 问题

你为微调项目安装了 PyTorch 2.4。下周，另一个项目需要 PyTorch 2.1，因为其 CUDA 构建被固定。你全局升级，第一个项目坏了。你降级，第二个项目又坏了。

这就是依赖地狱。在 AI/ML 工作中经常发生，因为：

- PyTorch、JAX 和 TensorFlow 各自携带自己的 CUDA 绑定
- 模型库固定了特定的框架版本
- 全局 `pip install` 会覆盖之前已有的内容
- CUDA 11.8 的构建无法与 CUDA 12.x 驱动协同工作（反之亦然）

解决方法：每个项目拥有自己独立的环境和包。

## 概念

```mermaid
graph TD
    subgraph without["没有虚拟环境"]
        SP[系统 Python] --> T24["torch 2.4.0 (CUDA 12.4)\n项目 A 需要此版本"]
        SP --> T21["torch 2.1.0 (CUDA 11.8)\n项目 B 需要此版本"]
        SP --> CONFLICT["冲突：只能存在一个\ntorch 版本"]
    end

    subgraph with["使用虚拟环境"]
        PA["项目 A (.venv/)"] --> PA1["torch 2.4.0 (CUDA 12.4)"]
        PA --> PA2["transformers 4.44"]
        PB["项目 B (.venv/)"] --> PB1["torch 2.1.0 (CUDA 11.8)"]
        PB --> PB2["diffusers 0.28"]
    end
```

## 动手搭建

### 选项 1：uv venv（推荐）

`uv` 是最快的 Python 包管理器（比 pip 快 10-100 倍）。它在一个工具中处理虚拟环境、Python 版本和依赖解析。

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh

uv python install 3.12

cd your-project
uv venv
source .venv/bin/activate
```

安装包：

```bash
uv pip install torch numpy
```

一步创建带有 `pyproject.toml` 的项目：

```bash
uv init my-ai-project
cd my-ai-project
uv add torch numpy matplotlib
```

### 选项 2：venv（内置）

如果无法安装 `uv`，Python 自带 `venv`：

```bash
python3 -m venv .venv
source .venv/bin/activate  # Linux/macOS
.venv\Scripts\activate     # Windows

pip install torch numpy
```

比 `uv` 慢，但只要有 Python 安装就能用。

### 选项 3：conda（当你需要它时）

Conda 管理非 Python 依赖，如 CUDA 工具包、cuDNN 和 C 库。在以下情况使用：

- 你需要特定版本的 CUDA 工具包，但不想在系统范围内安装
- 你在共享集群上，无法安装系统包
- 某个库的安装说明写着“使用 conda”

```bash
# 安装 miniconda（不是完整的 Anaconda）
curl -LsSf https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -o miniconda.sh
bash miniconda.sh -b

conda create -n myproject python=3.12
conda activate myproject

conda install pytorch torchvision torchaudio pytorch-cuda=12.4 -c pytorch -c nvidia
```

一条规则：如果你对某个环境使用 conda，那么该环境中的所有包都用 conda。在 conda 环境中混用 `pip install` 会导致依赖冲突，调试起来非常痛苦。

### 本课程的分阶段策略

你可以为整个课程创建一个环境。但不要这样做。不同阶段需要不同（有时冲突）的依赖。

策略：

```
ai-engineering-from-scratch/
├── .venv/                    <-- 共享的轻量级环境，用于阶段 0-3
├── phases/
│   ├── 04-neural-networks/
│   │   └── .venv/            <-- PyTorch 环境
│   ├── 05-cnns/
│   │   └── .venv/            <-- 相同的 PyTorch 环境（符号链接或共享）
│   ├── 08-transformers/
│   │   └── .venv/            <-- 可能需要不同的 transformer 版本
│   └── 11-llm-apis/
│       └── .venv/            <-- API SDK，不需要 torch
```

`code/env_setup.sh` 脚本会为本课程创建基础环境。

## pyproject.toml 基础知识

每个 Python 项目都应该有一个 `pyproject.toml`。它用单个文件取代了 `setup.py`、`setup.cfg` 和 `requirements.txt`。

```toml
[project]
name = "ai-engineering-from-scratch"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "numpy>=1.26",
    "matplotlib>=3.8",
    "jupyter>=1.0",
    "scikit-learn>=1.4",
]

[project.optional-dependencies]
torch = ["torch>=2.3", "torchvision>=0.18"]
llm = ["anthropic>=0.39", "openai>=1.50"]
```

然后安装：

```bash
uv pip install -e ".[torch]"    # 基础 + PyTorch
uv pip install -e ".[llm]"     # 基础 + LLM SDK
uv pip install -e ".[torch,llm]" # 全部
```

## 锁文件

锁文件（Lockfile）将每个依赖（包括传递依赖）固定到精确版本。这保证了可复现性：任何从锁文件安装的人都会得到完全相同的包。

```bash
# uv 在使用 uv add 时自动生成 uv.lock
uv add numpy

# pip-tools 方式
uv pip compile pyproject.toml -o requirements.lock
uv pip install -r requirements.lock
```

将锁文件提交到 git 仓库。当其他人克隆仓库时，他们从锁文件安装，得到完全相同的版本。

## 常见错误

### 1. 全局安装

```bash
pip install torch  # 错误：安装到系统 Python

source .venv/bin/activate
pip install torch  # 正确：安装到虚拟环境
```

检查包的安装位置：

```bash
which python       # 应显示 .venv/bin/python，而不是 /usr/bin/python
which pip           # 应显示 .venv/bin/pip
```

### 2. 混用 pip 和 conda

```bash
conda create -n myenv python=3.12
conda activate myenv
conda install pytorch -c pytorch
pip install some-other-package   # 错误：会破坏 conda 的依赖追踪
conda install some-other-package # 正确：让 conda 管理所有内容
```

如果你必须在 conda 内使用 pip（某些包仅通过 pip 提供），请先安装所有 conda 包，最后安装 pip 包。

### 3. 忘记激活环境

```bash
python train.py           # 使用系统 Python，缺少包
source .venv/bin/activate
python train.py           # 使用项目 Python，包已找到
```

你的 shell 提示符应显示环境名称：

```
(.venv) $ python train.py
```

### 4. 将 .venv 提交到 git

```bash
echo ".venv/" >> .gitignore
```

虚拟环境大小为 200MB-2GB。它们是本地的，不能在机器间移植。应提交 `pyproject.toml` 和锁文件。

### 5. CUDA 版本不匹配

```bash
nvidia-smi                # 显示驱动 CUDA 版本（例如 12.4）
python -c "import torch; print(torch.version.cuda)"  # 显示 PyTorch CUDA 版本

# 这些必须兼容。
# PyTorch CUDA 版本必须 <= 驱动 CUDA 版本。
```

## 使用它

运行设置脚本以创建课程环境：

```bash
bash phases/00-setup-and-tooling/06-python-environments/code/env_setup.sh
```

这会在仓库根目录创建一个 `.venv` 目录，其中安装了核心依赖并通过验证。

## 练习

1. 运行 `env_setup.sh` 并验证所有检查通过
2. 创建第二个虚拟环境，在其中安装不同版本的 numpy，并确认两个环境相互隔离
3. 为一个需要同时使用 PyTorch 和 Anthropic SDK 的项目编写 `pyproject.toml`
4. 故意（不激活 venv）全局安装一个包，注意它的安装位置，然后卸载它

## 关键术语

| 术语 | 口头说法 | 实际含义 |
|------|---------|---------|
| 虚拟环境（Virtual environment） | “一个 venv” | 一个隔离的目录，包含 Python 解释器和包，与系统 Python 分离 |
| 锁文件（Lockfile） | “固定的依赖” | 一个列出每个包及其精确版本的文件，确保跨机器安装完全相同 |
| pyproject.toml | “新的 setup.py” | 标准 Python 项目配置文件，取代 setup.py/setup.cfg/requirements.txt |
| 传递依赖（Transitive dependency） | “依赖的依赖” | 包 B 依赖包 C；如果你安装依赖 B 的包 A，那么 C 就是 A 的传递依赖 |
| CUDA 不匹配 | “我的 GPU 不工作” | PyTorch 编译时所针对的 CUDA 版本与你的 GPU 驱动所支持的版本不同 |