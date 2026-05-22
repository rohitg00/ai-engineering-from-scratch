# 开发环境

> 工具塑造你的思维。一次性设置好，正确设置好。

**类型：** 构建
**语言：** Python、Node.js、Rust
**前置条件：** 无
**时间：** 约45分钟

## 学习目标

- 从零开始设置 Python 3.11+、Node.js 20+ 和 Rust 工具链
- 配置虚拟环境和包管理器以实现可复现构建
- 使用 CUDA/MPS 验证 GPU 访问权限并运行张量操作测试
- 理解四层栈：系统、包、运行时、AI 库

## 问题

你即将在 200 多节课中使用 Python、TypeScript、Rust 和 Julia 学习 AI 工程。如果你的环境配置有误，每节课都会变成与工具的斗争，而非学习。

大多数人跳过环境设置，然后花费数小时调试导入错误、版本冲突和缺少 CUDA 驱动的问题。我们将一次性、正确地完成这项任务。

## 概念

AI 工程环境包含四个层级：

```mermaid
graph TD
    A["4. AI/ML 库\nPyTorch, JAX, transformers 等"] --> B["3. 语言运行时\nPython 3.11+, Node 20+, Rust, Julia"]
    B --> C["2. 包管理器\nuv, pnpm, cargo, juliaup"]
    C --> D["1. 系统基础\n操作系统, shell, git, 编辑器, GPU 驱动"]
```

我们自底向上安装。每一层都依赖于其下的层级。

## 构建它

### 第一步：系统基础

检查你的系统并安装基础组件。

```bash
# macOS
xcode-select --install
brew install git curl wget

# Ubuntu/Debian
sudo apt update && sudo apt install -y build-essential git curl wget

# Windows（使用 WSL2）
wsl --install -d Ubuntu-24.04
```

### 第二步：使用 uv 管理 Python

我们使用 `uv`——它比 pip 快 10-100 倍，并能自动处理虚拟环境。

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh

uv python install 3.12

uv venv
source .venv/bin/activate  # Windows 上使用 .venv\Scripts\activate

uv pip install numpy matplotlib jupyter
```

验证：

```python
import sys
print(f"Python {sys.version}")

import numpy as np
print(f"NumPy {np.__version__}")
a = np.array([1, 2, 3])
print(f"向量: {a}, 与自身的点积: {np.dot(a, a)}")
```

### 第三步：使用 pnpm 管理 Node.js

用于 TypeScript 课程（代理、MCP 服务器、Web 应用）。

```bash
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 22
fnm use 22

npm install -g pnpm

node -e "console.log('Node', process.version)"
```

### 第四步：Rust

用于性能关键的课程（推理、系统编程）。

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

rustc --version
cargo --version
```

### 第五步：Julia（可选）

用于数学密集型课程，Julia 在此表现出色。

```bash
curl -fsSL https://install.julialang.org | sh

julia -e 'println("Julia ", VERSION)'
```

### 第六步：GPU 设置（如果你有 GPU）

```bash
# NVIDIA
nvidia-smi

# 安装带 CUDA 支持的 PyTorch
uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
```

```python
import torch
print(f"CUDA 可用: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
```

没有 GPU？没问题。大多数课程可在 CPU 上运行。对于训练密集型课程，请使用 Google Colab 或云端 GPU。

### 第七步：全部验证

运行验证脚本：

```bash
python phases/00-setup-and-tooling/01-dev-environment/code/verify.py
```

## 使用它

你的环境现已为本课程的所有课程准备就绪。以下是各语言的使用场景：

| 语言 | 使用位置 | 包管理器 |
|------|----------|----------|
| Python | 阶段 1-12（机器学习、深度学习、自然语言处理、视觉、音频、大语言模型） | uv |
| TypeScript | 阶段 13-17（工具、代理、群体、基础设施） | pnpm |
| Rust | 阶段 12、15-17（性能关键系统） | cargo |
| Julia | 阶段 1（数学基础） | Pkg |

## 交付它

本节课生成一个验证脚本，任何人都可以运行它来检查自己的设置。

有关帮助 AI 助手诊断环境问题的提示，请参阅 `outputs/prompt-env-check.md`。

## 练习

1. 运行验证脚本并修复所有失败项
2. 为本课程创建一个 Python 虚拟环境并安装 PyTorch
3. 用四种语言各写一个"hello world"并运行它们