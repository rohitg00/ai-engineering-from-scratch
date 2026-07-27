# 学习率调度与预热 (Learning Rate Schedules and Warmup)

> 学习率是最重要的单一超参数。不是架构。不是数据集大小。不是激活函数。是学习率。如果你只调一个东西，就调这个。

**类型：** 动手构建
**语言：** Python
**前置知识：** 第 03.06 课（优化器），第 03.08 课（权重初始化）
**时长：** ~90 分钟

## 学习目标

- 从零实现常数、阶梯衰减、余弦退火、预热+余弦和 1cycle 学习率调度
- 演示学习率选择的三种失败模式：发散（太高）、停滞（太低）和振荡（无衰减）
- 解释为什么预热对基于 Adam 的优化器是必要的，以及它如何稳定早期训练
- 在同一任务上比较所有五种调度的收敛速度，并为给定的训练预算选择合适的一种

## 问题

将学习率设为 0.1。训练发散——loss 在 3 步内跳到无穷大。设为 0.0001。训练爬行——100 个 epoch 后，模型几乎没有从随机状态移动。设为 0.01。训练工作 50 个 epoch，然后 loss 在一个它永远无法达到的最小值附近振荡，因为步长太大了。

最优学习率不是一个常数。它在训练过程中变化。早期，你需要大步子以快速覆盖地面。训练后期，你需要微小的步长以沉降到一个尖锐的最小值。90% 准确率模型和 95% 准确率模型之间的区别往往就是调度。

过去三年发布的每个主要模型都使用了学习率调度。Llama 3 使用峰值 lr=3e-4，2000 步预热，余弦衰减到 3e-5。GPT-3 使用 lr=6e-4，预热超过 3.75 亿个 token。这些不是随意的选择。它们是花费数百万美元的广泛超参数扫描的结果。

你需要理解调度，因为默认值对你的问题可能不适用。当你微调预训练模型时，正确的调度与从零训练时不同。当你增加批次大小时，预热期需要改变。当训练在第 10,000 步崩溃时，你需要知道这是调度问题还是其他问题。

## 概念

### 常数学习率 (Constant Learning Rate)

最简单的方法。选一个数字，每一步都使用它。

```
lr(t) = lr_0
```

很少是最优的。它对训练结束来说太高了（在最小值附近振荡）或对开始来说太低了（小步子上浪费算力）。对小模型和调试来说还行。对于训练超过一小时的任何东西来说，这是一个可怕的选择。

### 阶梯衰减 (Step Decay)

ResNet 时代的老派方法。在固定的 epoch 处将学习率乘以一个因子（通常是 10 倍）。

```
lr(t) = lr_0 * gamma^(floor(epoch / step_size))
```

其中 gamma = 0.1 且 step_size = 30 意味着：每 30 个 epoch lr 下降 10 倍。ResNet-50 使用了这个——lr=0.1，在第 30、60 和 90 个 epoch 处下降 10 倍。

问题：最优衰减点取决于数据集和架构。换到不同的问题时需要重新调整何时下降。过渡是突然的——当比率突然变化时 loss 可能飙升。

### 余弦退火 (Cosine Annealing)

从最大学习率平滑衰减到最小值，遵循余弦曲线：

```
lr(t) = lr_min + 0.5 * (lr_max - lr_min) * (1 + cos(pi * t / T))
```

其中 t 是当前步，T 是总步数。

在 t=0 时，余弦项为 1，所以 lr = lr_max。在 t=T 时，余弦项为 -1，所以 lr = lr_min。衰减开始时温和，中间加速，接近结束时再次变温和。

这是大多数现代训练运行的默认选择。除了 lr_max 和 lr_min 之外无需调整超参数。余弦形状符合经验观察：大多数学习发生在训练的中期——你希望在该关键时期有合理的步长。

### 预热 (Warmup)：为什么从小开始

Adam 和其他自适应优化器维护梯度均值和方差的运行估计。在第 0 步，这些估计被初始化为零。前几个梯度更新基于垃圾统计。如果你在此期间学习率很大，模型会迈出巨大而方向错误的一步。

预热解决了这个问题。从一个很小的学习率开始（通常是 lr_max / warmup_steps 甚至为零），并在前 N 步线性上升到 lr_max。到你达到完整学习率时，Adam 的统计量已经稳定。

```
lr(t) = lr_max * (t / warmup_steps)     for t < warmup_steps
```

典型预热：总训练步数的 1-5%。Llama 3 训练了约 1.8 万亿个 token，预热了 2000 步。GPT-3 预热了超过 3.75 亿个 token。

### 线性预热 + 余弦衰减

现代默认。线性上升，然后用余弦衰减：

```
if t < warmup_steps:
    lr(t) = lr_max * (t / warmup_steps)
else:
    progress = (t - warmup_steps) / (total_steps - warmup_steps)
    lr(t) = lr_min + 0.5 * (lr_max - lr_min) * (1 + cos(pi * progress))
```

这就是 Llama、GPT、PaLM 和大多数现代 transformer 使用的。预热防止早期不稳定。余弦衰减将模型沉降到一个好的最小值。

### 1cycle 策略

Leslie Smith 的发现（2018）：在训练的前半段将学习率从低值上升到高值，然后在后半段再降回来。反直觉——为什么在训练中期*增加*学习率？

理论：高学习率通过向优化轨迹添加噪声来充当正则化。模型在上升阶段探索更多的 loss 景观，找到更好的盆地。下降阶段然后在找到的最佳盆地内精炼。

```
Phase 1 (0 到 T/2):    lr 从 lr_max/25 上升到 lr_max
Phase 2 (T/2 到 T):    lr 从 lr_max 下降到 lr_max/10000
```

在固定计算预算下，1cycle 通常比余弦退火训练更快。权衡：你必须提前知道总步数。

### 调度形状

```mermaid
graph LR
    subgraph "常数"
        C1["lr"] --- C2["lr"] --- C3["lr"]
    end

    subgraph "阶梯衰减"
        S1["0.1"] --- S2["0.1"] --- S3["0.01"] --- S4["0.001"]
    end

    subgraph "余弦退火"
        CS1["lr_max"] --> CS2["逐渐"] --> CS3["陡峭"] --> CS4["lr_min"]
    end

    subgraph "预热+余弦"
        WC1["0"] --> WC2["lr_max"] --> WC3["余弦"] --> WC4["lr_min"]
    end
```

### 决策流程图

```mermaid
flowchart TD
    Start["选择 LR 调度"] --> Know{"知道总<br/>训练步数？"}

    Know -->|"是"| Budget{"计算预算？"}
    Know -->|"否"| Constant["使用常数 LR<br/>带手动衰减"]

    Budget -->|"大（天/周）"| WarmCos["预热+余弦衰减<br/>（Llama/GPT 默认）"]
    Budget -->|"小（小时）"| OneCycle["1cycle 策略<br/>（最快收敛）"]
    Budget -->|"中等"| Cosine["余弦退火<br/>（安全默认）"]

    WarmCos --> Warmup["预热 = 1-5% 的步数"]
    OneCycle --> FindLR["用 LR 范围测试找到 lr_max"]
    Cosine --> MinLR["设置 lr_min = lr_max / 10"]
```

### 已发布模型的实际数字

```mermaid
graph TD
    subgraph "已发布的 LR 配置"
        L3["Llama 3 (405B)<br/>峰值: 3e-4<br/>预热: 2000 步<br/>调度: 余弦到 3e-5"]
        G3["GPT-3 (175B)<br/>峰值: 6e-4<br/>预热: 375M tokens<br/>调度: 余弦到 0"]
        R50["ResNet-50<br/>峰值: 0.1<br/>预热: 无<br/>调度: 阶梯衰减 x0.1 在 30,60,90"]
        B["BERT (340M)<br/>峰值: 1e-4<br/>预热: 10K 步<br/>调度: 线性衰减"]
    end
```

```figure
lr-schedule
```

## 动手构建

### 第 1 步：调度函数

每个函数接收当前步数并返回该步的学习率。

```python
import math


def constant_schedule(step, lr=0.01, **kwargs):
    return lr


def step_decay_schedule(step, lr=0.1, step_size=100, gamma=0.1, **kwargs):
    return lr * (gamma ** (step // step_size))


def cosine_schedule(step, lr=0.01, total_steps=1000, lr_min=1e-5, **kwargs):
    if step >= total_steps:
        return lr_min
    return lr_min + 0.5 * (lr - lr_min) * (1 + math.cos(math.pi * step / total_steps))


def warmup_cosine_schedule(step, lr=0.01, total_steps=1000, warmup_steps=100, lr_min=1e-5, **kwargs):
    if total_steps <= warmup_steps:
        return lr * (step / max(warmup_steps, 1))
    if step < warmup_steps:
        return lr * step / warmup_steps
    progress = (step - warmup_steps) / (total_steps - warmup_steps)
    return lr_min + 0.5 * (lr - lr_min) * (1 + math.cos(math.pi * progress))


def one_cycle_schedule(step, lr=0.01, total_steps=1000, **kwargs):
    mid = max(total_steps // 2, 1)
    if step < mid:
        return (lr / 25) + (lr - lr / 25) * step / mid
    else:
        progress = (step - mid) / max(total_steps - mid, 1)
        return lr * (1 - progress) + (lr / 10000) * progress
```

### 第 2 步：可视化所有调度

打印一个基于文本的图表，显示每个调度在训练过程中的演变。

```python
def visualize_schedule(name, schedule_fn, total_steps=500, **kwargs):
    steps = list(range(0, total_steps, total_steps // 20))
    if total_steps - 1 not in steps:
        steps.append(total_steps - 1)

    lrs = [schedule_fn(s, total_steps=total_steps, **kwargs) for s in steps]
    max_lr = max(lrs) if max(lrs) > 0 else 1.0

    print(f"
{name}:")
    for s, lr_val in zip(steps, lrs):
        bar_len = int(lr_val / max_lr * 40)
        bar = "#" * bar_len
        print(f"  Step {s:4d}: lr={lr_val:.6f} {bar}")
```

### 第 3 步：训练网络

一个简单的两层网络在圆形数据集上，与之前课程相同，但现在我们改变调度。

```python
import random


def sigmoid(x):
    x = max(-500, min(500, x))
    return 1.0 / (1.0 + math.exp(-x))


def relu(x):
    return max(0.0, x)


def relu_deriv(x):
    return 1.0 if x > 0 else 0.0


def make_circle_data(n=200, seed=42):
    random.seed(seed)
    data = []
    for _ in range(n):
        x = random.uniform(-2, 2)
        y = random.uniform(-2, 2)
        label = 1.0 if x * x + y * y < 1.5 else 0.0
        data.append(([x, y], label))
    return data


def train_with_schedule(schedule_fn, schedule_name, data, epochs=300, base_lr=0.05, **kwargs):
    random.seed(0)
    hidden_size = 8
    total_steps = epochs * len(data)

    std = math.sqrt(2.0 / 2)
    w1 = [[random.gauss(0, std) for _ in range(2)] for _ in range(hidden_size)]
    b1 = [0.0] * hidden_size
    w2 = [random.gauss(0, std) for _ in range(hidden_size)]
    b2 = 0.0

    step = 0
    epoch_losses = []

    for epoch in range(epochs):
        total_loss = 0
        correct = 0

        for x, target in data:
            lr = schedule_fn(step, lr=base_lr, total_steps=total_steps, **kwargs)

            z1 = []
            h = []
            for i in range(hidden_size):
                z = w1[i][0] * x[0] + w1[i][1] * x[1] + b1[i]
                z1.append(z)
                h.append(relu(z))

            z2 = sum(w2[i] * h[i] for i in range(hidden_size)) + b2
            out = sigmoid(z2)

            error = out - target
            d_out = error * out * (1 - out)

            for i in range(hidden_size):
                d_h = d_out * w2[i] * relu_deriv(z1[i])
                w2[i] -= lr * d_out * h[i]
                for j in range(2):
                    w1[i][j] -= lr * d_h * x[j]
                b1[i] -= lr * d_h
            b2 -= lr * d_out

            total_loss += (out - target) ** 2
            if (out >= 0.5) == (target >= 0.5):
                correct += 1
            step += 1

        avg_loss = total_loss / len(data)
        accuracy = correct / len(data) * 100
        epoch_losses.append(avg_loss)

    return epoch_losses
```

### 第 4 步：比较所有调度

使用每个调度训练相同的网络，并比较最终 loss 和收敛行为。

```python
def compare_schedules(data):
    configs = [
        ("Constant", constant_schedule, {}),
        ("Step Decay", step_decay_schedule, {"step_size": 15000, "gamma": 0.1}),
        ("Cosine", cosine_schedule, {"lr_min": 1e-5}),
        ("Warmup+Cosine", warmup_cosine_schedule, {"warmup_steps": 3000, "lr_min": 1e-5}),
        ("1cycle", one_cycle_schedule, {}),
    ]

    print(f"
{'Schedule':<20} {'Start Loss':>12} {'Mid Loss':>12} {'End Loss':>12} {'Best Loss':>12}")
    print("-" * 70)

    for name, schedule_fn, extra_kwargs in configs:
        losses = train_with_schedule(schedule_fn, name, data, epochs=300, base_lr=0.05, **extra_kwargs)
        mid_idx = len(losses) // 2
        best = min(losses)
        print(f"{name:<20} {losses[0]:>12.6f} {losses[mid_idx]:>12.6f} {losses[-1]:>12.6f} {best:>12.6f}")
```

### 第 5 步：LR 太高 vs 太低

演示三种失败模式：太高（发散）、太低（爬行）和刚好。

```python
def lr_sensitivity(data):
    learning_rates = [1.0, 0.1, 0.01, 0.001, 0.0001]

    print("
LR Sensitivity (constant schedule, 100 epochs):")
    print(f"  {'LR':>10} {'Start Loss':>12} {'End Loss':>12} {'Status':>15}")
    print("  " + "-" * 52)

    for lr in learning_rates:
        losses = train_with_schedule(constant_schedule, f"lr={lr}", data, epochs=100, base_lr=lr)
        start = losses[0]
        end = losses[-1]

        if end > start or math.isnan(end) or end > 1.0:
            status = "DIVERGED"
        elif end > start * 0.9:
            status = "BARELY MOVED"
        elif end < 0.15:
            status = "CONVERGED"
        else:
            status = "LEARNING"

        end_str = f"{end:.6f}" if not math.isnan(end) else "NaN"
        print(f"  {lr:>10.4f} {start:>12.6f} {end_str:>12} {status:>15}")
```

## 使用它

PyTorch 在 `torch.optim.lr_scheduler` 中提供了调度器：

```python
import torch
import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR, OneCycleLR, StepLR

model = nn.Sequential(nn.Linear(10, 64), nn.ReLU(), nn.Linear(64, 1))
optimizer = optim.Adam(model.parameters(), lr=3e-4)

scheduler = CosineAnnealingLR(optimizer, T_max=1000, eta_min=1e-5)

for step in range(1000):
    loss = train_step(model, optimizer)
    scheduler.step()
```

对于预热+余弦，使用 lambda 调度器或 HuggingFace 的 `get_cosine_schedule_with_warmup`：

```python
from transformers import get_cosine_schedule_with_warmup

scheduler = get_cosine_schedule_with_warmup(
    optimizer,
    num_warmup_steps=2000,
    num_training_steps=100000,
)
```

HuggingFace 函数是大多数 Llama 和 GPT 微调脚本所使用的。如有疑问，使用预热+余弦，预热占总步数的 3-5%。它对几乎所有事情都有效。

## 交付物

本课程产出：
- `outputs/prompt-lr-schedule-advisor.md` —— 一个为你的训练设置推荐正确学习率调度和超参数的提示词

## 练习

1. 实现指数衰减：lr(t) = lr_0 * gamma^t 其中 gamma = 0.999。在圆形数据集上与余弦退火比较。
2. 实现学习率范围测试（Leslie Smith）：训练几百步，同时从 1e-7 到 1 指数级增加 LR。绘制 loss vs LR。最佳最大 LR 就在 loss 开始增加之前。
3. 使用预热+余弦训练，但改变预热长度：总步数的 0%、1%、5%、10%、20%。找到训练最稳定的最佳点。
4. 实现带热重启的余弦退火 (SGDR)：每 T 步将学习率重置为 lr_max 并再次衰减。在更长的训练运行中与标准余弦比较。
5. 构建一个"调度外科医生"，监控训练 loss，并在 loss 稳定时自动从预热切换到余弦，如果 loss 停滞太久则降低 lr。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Learning rate | "模型学习的速度" | 乘以梯度以确定参数更新大小的标量 |
| Schedule | "随时间改变 LR" | 将训练步映射到学习率的函数，旨在优化收敛 |
| Warmup | "从小 LR 开始" | 在前 N 步将 LR 从接近零线性上升到目标值，以稳定优化器统计量 |
| Cosine annealing | "平滑 LR 衰减" | 在训练过程中按照余弦曲线从 lr_max 递减 LR 到 lr_min |
| Step decay | "在里程碑处降低 LR" | 在固定的 epoch 间隔处将 LR 乘以一个因子（通常为 0.1） |
| 1cycle policy | "先上后下" | Leslie Smith 的方法，在单个周期中先上升再下降 LR，实现更快的收敛 |
| LR range test | "找到最佳学习率" | 在增加 LR 的同时短暂训练，以找到 loss 开始发散时的值 |
| Cosine with warm restarts | "重置并重复" | 周期性地将 LR 重置为 lr_max 并再次衰减 (SGDR) |
| Eta min | "LR 的底线" | 调度衰减到的最小学习率 |
| Peak learning rate | "最大 LR" | 训练中达到的最高 LR，通常在预热后 |

## 延伸阅读

- Loshchilov & Hutter, "SGDR: Stochastic Gradient Descent with Warm Restarts" (2017) —— 引入了余弦退火和热重启
- Smith, "Super-Convergence: Very Fast Training of Neural Networks Using Large Learning Rates" (2018) —— 1cycle 策略论文
- Touvron et al., "Llama 2: Open Foundation and Fine-Tuned Chat Models" (2023) —— 记录了大规模使用的预热+余弦调度
- Goyal et al., "Accurate, Large Minibatch SGD: Training ImageNet in 1 Hour" (2017) —— 大批次训练的线性缩放规则和预热
