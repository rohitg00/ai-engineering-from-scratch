# PyTorch 入门 (Introduction to PyTorch)

> 你用活塞和曲轴构建了引擎。现在学习那个所有人都在驾驶的引擎。

**类型：** 动手构建
**语言：** Python
**前置知识：** 第 03.10 课（构建你自己的迷你框架）
**时长：** ~75 分钟

## 学习目标

- 使用 PyTorch 的 nn.Module、nn.Sequential 和 autograd 构建并训练神经网络
- 使用 PyTorch tensor、GPU 加速和标准训练循环（zero_grad, forward, loss, backward, step）
- 将从零构建的迷你框架组件转换为对应的 PyTorch 等价物
- 在同一任务上对你的纯 Python 框架和 PyTorch 进行性能分析并比较训练速度

## 问题

你有一个可以工作的迷你框架。Linear 层、ReLU、dropout、batch norm、Adam、DataLoader、训练循环。它在纯 Python 中在圆形分类问题上训练一个 4 层网络。

但在同一问题上，它比 PyTorch 慢 500 倍。

你的迷你框架一次处理一个样本，使用嵌套的 Python 循环。PyTorch 将相同的操作分派到经过优化的 C++/CUDA 内核，在 GPU 上运行。在单个 NVIDIA A100 上，PyTorch 在大约 6 小时内训练一个 ResNet-50（2560 万参数）在 ImageNet（128 万图像）上。你的框架在同样的任务上大约需要 3,000 小时——如果它没有先耗尽内存的话。

速度不是唯一的差距。你的框架没有 GPU 支持。没有自动微分——你为每个模块手写了 backward()。没有序列化。没有分布式训练。没有混合精度。没有调试梯度流动的方法（除了 print 语句）。

PyTorch 填补了所有这些差距。而且它在保持与你已构建的完全相同的思维模型的同时做到了这一点：Module、forward()、parameters()、backward()、optimizer.step()。这些概念一一对应。语法几乎相同。区别在于 PyTorch 在你从零设计的相同接口背后封装了十年的系统工程。

## 概念

### 为什么 PyTorch 胜出

2015 年，TensorFlow 要求你在运行任何东西之前定义一个静态计算图。你构建图，编译它，然后输入数据。调试意味着盯着图的可视化。更改架构意味着从头重建图。

PyTorch 于 2017 年推出，采用不同的理念：即时执行 (eager execution)。你写 Python。它立即运行。`y = model(x)` 实际上现在就计算 y，而不是"向稍后才会计算 y 的图添加一个节点"。这意味着标准的 Python 调试工具可以工作。print() 可以工作。pdb 可以工作。forward pass 中的 if/else 可以工作。

到 2020 年，市场已经做出了选择。PyTorch 在 ML 研究论文中的份额从 7%（2017）增长到超过 75%（2022）。Meta、Google DeepMind、OpenAI、Anthropic 和 Hugging Face 都使用 PyTorch 作为其主要框架。TensorFlow 2.x 作为回应采用了即时执行——默认承认 PyTorch 的设计是正确的。

教训：开发者体验具有复利效应。一个慢 10% 但调试快 50% 的框架每次都会赢。

### 张量 (Tensors)

张量是一个多维数组，具有三个关键属性：形状 (shape)、数据类型 (dtype) 和设备 (device)。

```python
import torch

x = torch.zeros(3, 4)           # shape: (3, 4), dtype: float32, device: cpu
x = torch.randn(2, 3, 224, 224) # 批次 2 张 RGB 图像, 224x224
x = torch.tensor([1, 2, 3])     # 从 Python 列表
```

**Shape** 是维度。标量是 shape ()，向量是 (n,)，矩阵是 (m, n)，一批图像是 (batch, channels, height, width)。

**Dtype** 控制精度和内存。

| dtype | 位数 | 范围 | 用途 |
|-------|------|------|------|
| float32 | 32 | ~7 位小数 | 默认训练 |
| float16 | 16 | ~3.3 位小数 | 混合精度 |
| bfloat16 | 16 | 与 float32 范围相同，精度较低 | LLM 训练 |
| int8 | 8 | -128 到 127 | 量化推理 |

**Device** 决定计算发生的位置。

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
x = torch.randn(3, 4, device=device)
x = x.to("cuda")
x = x.cpu()
```

每个操作要求所有张量在同一个设备上。这是初学者遇到的 #1 PyTorch 错误：`RuntimeError: Expected all tensors to be on the same device`。解决方法是在计算之前将所有内容移动到同一个设备。

**Reshaping** 是常数时间的——它更改元数据，而不更改数据。

```python
x = torch.randn(2, 3, 4)
x.view(2, 12)      # 重塑为 (2, 12) -- 必须连续
x.reshape(6, 4)    # 重塑为 (6, 4) -- 始终有效
x.permute(2, 0, 1) # 重排维度
x.unsqueeze(0)     # 添加维度: (1, 2, 3, 4)
x.squeeze()        # 移除大小为 1 的维度
```

### Autograd

你的迷你框架要求你为每个模块实现 backward()。PyTorch 不需要。它将对张量的每个操作记录到一个有向无环图中（计算图），然后反向遍历该图以自动计算梯度。

```mermaid
graph LR
    x["x (leaf)"] --> mul["*"]
    w["w (leaf, requires_grad)"] --> mul
    mul --> add["+"]
    b["b (leaf, requires_grad)"] --> add
    add --> loss["loss"]
    loss --> |".backward()"| add
    add --> |"grad"| b
    add --> |"grad"| mul
    mul --> |"grad"| w
```

与你的框架的关键区别：PyTorch 使用基于磁带 (tape) 的自动微分。每个操作在前向传播期间追加到一个"磁带"上。调用 `.backward()` 反向回放磁带。

```python
x = torch.randn(3, requires_grad=True)
y = x ** 2 + 3 * x
z = y.sum()
z.backward()
print(x.grad)  # dz/dx = 2x + 3
```

Autograd 的三条规则：

1. 只有 `requires_grad=True` 的叶子张量累积梯度
2. 梯度默认累积——在每次反向传播前调用 `optimizer.zero_grad()`
3. `torch.no_grad()` 禁用梯度跟踪（评估期间使用）

### nn.Module

`nn.Module` 是 PyTorch 中每个神经网络组件的基类。你已经在第 10 课中构建了这个抽象。PyTorch 的版本增加了自动参数注册、递归模块发现、设备管理和状态字典序列化。

```python
import torch.nn as nn

class MLP(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim):
        super().__init__()
        self.layer1 = nn.Linear(input_dim, hidden_dim)
        self.relu = nn.ReLU()
        self.layer2 = nn.Linear(hidden_dim, output_dim)

    def forward(self, x):
        x = self.layer1(x)
        x = self.relu(x)
        x = self.layer2(x)
        return x
```

当你在 `__init__` 中将 `nn.Module` 或 `nn.Parameter` 赋值为属性时，PyTorch 会自动注册它。`model.parameters()` 递归地收集每个注册的参数。这就是为什么你永远不需要像在迷你框架中那样手动收集权重。

关键构建块：

| Module | 作用 | 参数数量 |
|--------|------|---------|
| nn.Linear(in, out) | Wx + b | in*out + out |
| nn.Conv2d(in_ch, out_ch, k) | 2D 卷积 | in_ch*out_ch*k*k + out_ch |
| nn.BatchNorm1d(features) | 归一化激活 | 2 * features |
| nn.Dropout(p) | 随机置零 | 0 |
| nn.ReLU() | max(0, x) | 0 |
| nn.GELU() | 高斯误差线性 | 0 |
| nn.Embedding(vocab, dim) | 查找表 | vocab * dim |
| nn.LayerNorm(dim) | 逐样本归一化 | 2 * dim |

### 损失函数和优化器

PyTorch 提供了你构建的所有内容的生产级版本。

**损失函数**（来自 `torch.nn`）：

| 损失 | 任务 | 输入 |
|------|------|------|
| nn.MSELoss() | 回归 | 任意形状 |
| nn.CrossEntropyLoss() | 多分类 | Logits（非 softmax） |
| nn.BCEWithLogitsLoss() | 二分类 | Logits（非 sigmoid） |
| nn.L1Loss() | 回归（鲁棒） | 任意形状 |
| nn.CTCLoss() | 序列对齐 | Log 概率 |

注意：`CrossEntropyLoss` 内部组合了 `LogSoftmax` + `NLLLoss`。传入原始 logits，而非 softmax 输出。这是一个常见的错误，会静默地产生错误的梯度。

**优化器**（来自 `torch.optim`）：

| 优化器 | 何时使用 | 典型 LR |
|--------|---------|---------|
| SGD(params, lr, momentum) | CNN、调优良好的流水线 | 0.01--0.1 |
| Adam(params, lr) | 默认起点 | 1e-3 |
| AdamW(params, lr, weight_decay) | Transformer、微调 | 1e-4--1e-3 |
| LBFGS(params) | 小规模、二阶优化 | 1.0 |

### 训练循环

每个 PyTorch 训练循环都遵循相同的 5 步模式。你已经从第 10 课知道了这一点。

```mermaid
sequenceDiagram
    participant D as DataLoader
    participant M as Model
    participant L as Loss fn
    participant O as Optimizer

    loop 每个 Epoch
        D->>M: batch = next(dataloader)
        M->>L: predictions = model(batch)
        L->>L: loss = criterion(predictions, targets)
        L->>M: loss.backward()
        O->>M: optimizer.step()
        O->>O: optimizer.zero_grad()
    end
```

规范模式：

```python
for epoch in range(num_epochs):
    model.train()
    for inputs, targets in train_loader:
        inputs, targets = inputs.to(device), targets.to(device)
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, targets)
        loss.backward()
        optimizer.step()
```

批次循环内的五行代码。这五行代码训练了 GPT-4、Stable Diffusion 和 LLaMA。架构在变化。数据在变化。这五行代码不变。

### Dataset 和 DataLoader

PyTorch 的 `Dataset` 是一个抽象类，有两个方法：`__len__` 和 `__getitem__`。`DataLoader` 将其包装，提供批处理、打乱和多进程数据加载。

```python
from torch.utils.data import Dataset, DataLoader

class MNISTDataset(Dataset):
    def __init__(self, images, labels):
        self.images = images
        self.labels = labels

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return self.images[idx], self.labels[idx]

loader = DataLoader(dataset, batch_size=64, shuffle=True, num_workers=4)
```

`num_workers=4` 生成 4 个进程并行加载数据，同时 GPU 在当前批次上训练。在磁盘密集型工作负载（大图像、音频）上，仅此一项就能使训练速度翻倍。

### GPU 训练

将模型移动到 GPU：

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = model.to(device)
```

这会递归地将每个参数和缓冲区移动到 GPU。然后在训练期间移动每个批次：

```python
inputs, targets = inputs.to(device), targets.to(device)
```

**混合精度** 通过以 float16 运行前向/反向传播，同时将主权重保持在 float32，在现代 GPU（A100、H100、RTX 4090）上将内存使用减半并将吞吐量翻倍：

```python
from torch.amp import autocast, GradScaler

scaler = GradScaler()
for inputs, targets in loader:
    with autocast(device_type="cuda"):
        outputs = model(inputs)
        loss = criterion(outputs, targets)
    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()
    optimizer.zero_grad()
```

### 对比：迷你框架 vs PyTorch vs JAX

| 特性 | 迷你框架 (L10) | PyTorch | JAX |
|------|---------------|---------|-----|
| 自动微分 | 手动 backward() | 基于磁带的 autograd | 函数式变换 |
| 执行 | 即时（Python 循环） | 即时（C++ 内核） | 跟踪 + JIT 编译 |
| GPU 支持 | 无 | 有 (CUDA, ROCm, MPS) | 有 (CUDA, TPU) |
| 速度 (MNIST MLP) | ~300s/epoch | ~0.5s/epoch | ~0.3s/epoch |
| 模块系统 | 自定义 Module 类 | nn.Module | 无状态函数 (Flax/Equinox) |
| 调试 | print() | print(), pdb, breakpoint() | 较难（JIT 跟踪破坏 print） |
| 生态系统 | 无 | Hugging Face, Lightning, timm | Flax, Optax, Orbax |
| 学习曲线 | 你构建了它 | 中等 | 陡峭（函数式范式） |
| 生产使用 | 玩具问题 | Meta, OpenAI, Anthropic, HF | Google DeepMind, Midjourney |

```figure
dropout-mask
```

## 动手构建

一个仅使用 PyTorch 原语在 MNIST 上训练的 3 层 MLP。没有高级封装。没有 `torchvision.datasets`。我们自己下载并解析原始数据。

### 第 1 步：从原始文件加载 MNIST

MNIST 以 4 个 gzip 文件形式提供：训练图像（60,000 x 28 x 28）、训练标签、测试图像（10,000 x 28 x 28）、测试标签。我们下载它们并解析二进制格式。

```python
import torch
import torch.nn as nn
import struct
import gzip
import urllib.request
import os

def download_mnist(path="./mnist_data"):
    base_url = "https://storage.googleapis.com/cvdf-datasets/mnist/"
    files = [
        "train-images-idx3-ubyte.gz",
        "train-labels-idx1-ubyte.gz",
        "t10k-images-idx3-ubyte.gz",
        "t10k-labels-idx1-ubyte.gz",
    ]
    os.makedirs(path, exist_ok=True)
    for f in files:
        filepath = os.path.join(path, f)
        if not os.path.exists(filepath):
            urllib.request.urlretrieve(base_url + f, filepath)

def load_images(filepath):
    with gzip.open(filepath, "rb") as f:
        magic, num, rows, cols = struct.unpack(">IIII", f.read(16))
        data = f.read()
        images = torch.frombuffer(bytearray(data), dtype=torch.uint8)
        images = images.reshape(num, rows * cols).float() / 255.0
    return images

def load_labels(filepath):
    with gzip.open(filepath, "rb") as f:
        magic, num = struct.unpack(">II", f.read(8))
        data = f.read()
        labels = torch.frombuffer(bytearray(data), dtype=torch.uint8).long()
    return labels
```

### 第 2 步：定义模型

一个 3 层 MLP：784 -> 256 -> 128 -> 10。ReLU 激活。Dropout 用于正则化。不包含 batch norm 以保持简单。

```python
class MNISTModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(784, 256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 10),
        )

    def forward(self, x):
        return self.net(x)
```

输出层产生 10 个原始 logits（每个数字一个）。没有 softmax——`CrossEntropyLoss` 内部处理。

参数数量：784*256 + 256 + 256*128 + 128 + 128*10 + 10 = 235,146。按现代标准很小。GPT-2 small 有 1.24 亿。这个在几秒钟内训练完成。

### 第 3 步：训练循环

标准的前向-损失-反向-步长模式。

```python
def train_one_epoch(model, loader, criterion, optimizer, device):
    model.train()
    total_loss = 0
    correct = 0
    total = 0
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * images.size(0)
        _, predicted = outputs.max(1)
        correct += predicted.eq(labels).sum().item()
        total += labels.size(0)
    return total_loss / total, correct / total


def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss = 0
    correct = 0
    total = 0
    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)
            total_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            correct += predicted.eq(labels).sum().item()
            total += labels.size(0)
    return total_loss / total, correct / total
```

注意评估期间的 `torch.no_grad()`。这会禁用 autograd，减少内存使用并加快推理速度。没有它，PyTorch 会构建一个你永远不会使用的计算图。

### 第 4 步：将所有内容组合在一起

```python
def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    download_mnist()
    train_images = load_images("./mnist_data/train-images-idx3-ubyte.gz")
    train_labels = load_labels("./mnist_data/train-labels-idx1-ubyte.gz")
    test_images = load_images("./mnist_data/t10k-images-idx3-ubyte.gz")
    test_labels = load_labels("./mnist_data/t10k-labels-idx1-ubyte.gz")

    train_dataset = torch.utils.data.TensorDataset(train_images, train_labels)
    test_dataset = torch.utils.data.TensorDataset(test_images, test_labels)
    train_loader = torch.utils.data.DataLoader(
        train_dataset, batch_size=64, shuffle=True
    )
    test_loader = torch.utils.data.DataLoader(
        test_dataset, batch_size=256, shuffle=False
    )

    model = MNISTModel().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

    num_params = sum(p.numel() for p in model.parameters())
    print(f"Device: {device}")
    print(f"Parameters: {num_params:,}")
    print(f"Train samples: {len(train_dataset):,}")
    print(f"Test samples: {len(test_dataset):,}")
    print()

    for epoch in range(10):
        train_loss, train_acc = train_one_epoch(
            model, train_loader, criterion, optimizer, device
        )
        test_loss, test_acc = evaluate(
            model, test_loader, criterion, device
        )
        print(
            f"Epoch {epoch+1:2d} | "
            f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.4f} | "
            f"Test Loss: {test_loss:.4f} | Test Acc: {test_acc:.4f}"
        )

    torch.save(model.state_dict(), "mnist_mlp.pt")
    print(f"
Model saved to mnist_mlp.pt")
    print(f"Final test accuracy: {test_acc:.4f}")
```

10 个 epoch 后的预期输出：~97.8% 测试准确率。CPU 训练时间：~30 秒。GPU 训练时间：~5 秒。在你的迷你框架上使用相同架构：~45 分钟。

## 使用它

### 快速对比：迷你框架 vs PyTorch

| 迷你框架 (第 10 课) | PyTorch |
|-------------------|---------|
| `model = Sequential(Linear(784, 256), ReLU(), ...)` | `model = nn.Sequential(nn.Linear(784, 256), nn.ReLU(), ...)` |
| `pred = model.forward(x)` | `pred = model(x)` |
| `optimizer.zero_grad()` | `optimizer.zero_grad()` |
| `grad = criterion.backward()` 然后 `model.backward(grad)` | `loss.backward()` |
| `optimizer.step()` | `optimizer.step()` |
| 无 GPU | `model.to("cuda")` |
| 为每个模块手动实现 backward | Autograd 处理一切 |

接口几乎相同。区别在引擎盖之下。

### 保存和加载模型

```python
torch.save(model.state_dict(), "model.pt")

model = MNISTModel()
model.load_state_dict(torch.load("model.pt", weights_only=True))
model.eval()
```

始终保存 `state_dict()`（参数字典），而不是模型对象。保存模型对象使用 pickle，当你重构代码时会损坏。状态字典是可移植的。

### 学习率调度

```python
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
    optimizer, T_max=10
)
for epoch in range(10):
    train_one_epoch(model, train_loader, criterion, optimizer, device)
    scheduler.step()
```

PyTorch 提供 15+ 个调度器：StepLR、ExponentialLR、CosineAnnealingLR、OneCycleLR、ReduceLROnPlateau。全部都接入同一个优化器接口。

## 交付物

本课程产出两个产物：

- `outputs/prompt-pytorch-debugger.md` —— 一个用于诊断常见 PyTorch 训练失败的提示词
- `outputs/skill-pytorch-patterns.md` —— 一个 PyTorch 训练模式的技能参考

## 练习

1. **添加 batch normalization。** 在每个线性层后（激活之前）插入 `nn.BatchNorm1d`。比较测试准确率和训练速度与仅使用 dropout 的版本。Batch norm 应该在更少的 epoch 内达到 98%+。
2. **实现学习率查找器。** 使用指数级增加的学习率（从 1e-7 到 1.0）训练一个 epoch。绘制 loss vs LR。最优 LR 就在 loss 开始上升之前。使用这个为 MNIST 模型选择一个更好的 LR。
3. **移植到带混合精度的 GPU。** 在训练循环中添加 `torch.amp.autocast` 和 `GradScaler`。测量 GPU 上使用和不使用混合精度的吞吐量（样本/秒）。在 A100 上，预期约 2 倍加速。
4. **构建一个自定义 Dataset。** 下载 Fashion-MNIST（与 MNIST 格式相同但包含衣物物品）。实现一个 `FashionMNISTDataset(Dataset)` 类，包含 `__getitem__` 和 `__len__`。训练相同的 MLP 并比较准确率。Fashion-MNIST 更难——预期 ~88% vs ~98%。
5. **将 Adam 替换为 SGD + momentum。** 使用 `SGD(params, lr=0.01, momentum=0.9)` 训练。比较收敛曲线。然后添加一个 `CosineAnnealingLR` 调度器，看看 SGD 是否能在第 10 个 epoch 赶上 Adam。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Tensor | "一个多维数组" | 一个类型化、设备感知的数组，每个操作内置自动微分支持 |
| Autograd | "自动反向传播" | 一个基于磁带的系统，在前向传播期间记录操作，然后反向回放以计算精确梯度 |
| nn.Module | "一个层" | 任何可微计算块的基类——注册参数、支持嵌套、处理训练/评估模式 |
| state_dict | "模型权重" | 一个将参数名映射到张量的 OrderedDict——训练模型的可移植、可序列化表示 |
| .backward() | "计算梯度" | 反向遍历计算图，为每个 requires_grad=True 的叶子张量计算并累积梯度 |
| .to(device) | "移动到 GPU" | 递归地将所有参数和缓冲区传输到指定的设备（CPU、CUDA、MPS） |
| DataLoader | "数据流水线" | 一个迭代器，从 Dataset 中批处理、打乱并可选地并行化数据加载 |
| Mixed precision | "使用 float16" | 以 float16 进行前向/反向传播以获得速度，同时保持 float32 主权重以保证数值稳定性 |
| Eager execution | "立即运行" | 操作在被调用时立即执行，而不是推迟到后续编译步骤——区分 PyTorch 与 TF 1.x 的核心设计选择 |
| zero_grad | "重置梯度" | 在下一次反向传播前将所有参数梯度设置为零，因为 PyTorch 默认累积梯度 |

## 延伸阅读

- Paszke et al., "PyTorch: An Imperative Style, High-Performance Deep Learning Library" (2019) —— 解释 PyTorch 设计权衡的原始论文
- PyTorch 教程: "Learning PyTorch with Examples" (https://pytorch.org/tutorials/beginner/pytorch_with_examples.html) —— 从张量到 nn.Module 的官方路径
- PyTorch Performance Tuning Guide (https://pytorch.org/tutorials/recipes/recipes/tuning_guide.html) —— 混合精度、DataLoader 工作进程、固定内存和其他生产级优化
- Horace He, "Making Deep Learning Go Brrrr" (https://horace.io/brrr_intro.html) —— 为什么 GPU 训练快，包含 PyTorch 特定的优化策略
