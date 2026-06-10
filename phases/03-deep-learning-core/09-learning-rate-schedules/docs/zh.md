# 09 · 学习率调度与预热

> 学习率是最重要的单一超参数。不是架构，不是数据集规模，也不是激活函数。就是学习率。如果你别的什么都不调，那就调它。

**类型：** 构建
**语言：** Python
**前置：** 课程 03.06（优化器）、课程 03.08（权重初始化）
**时长：** 约 90 分钟

## 学习目标

- 从零实现常量、阶梯衰减、余弦退火（cosine annealing）、预热 + 余弦、以及 1cycle 五种学习率调度
- 演示学习率选择的三种失败模式：发散（过高）、停滞（过低）、震荡（不衰减）
- 解释为何基于 Adam 的优化器需要预热（warmup），以及它如何稳定训练早期
- 在同一任务上对比全部五种调度的收敛速度，并为给定的训练预算选出合适的那一个

## 问题所在

把学习率设为 0.1。训练发散——损失在 3 步内飙到无穷大。设为 0.0001。训练原地爬行——跑完 100 个 epoch，模型几乎还停留在随机初始化的状态。设为 0.01。前 50 个 epoch 一切正常，然后损失在某个永远达不到的最小值附近来回震荡，因为步子迈得太大了。

最优学习率不是一个常量。它在训练过程中会变化。训练早期，你想用大步子快速覆盖大片区域。训练晚期，你想用极小的步子稳稳落入一个尖锐的最小值。一个准确率 90% 的模型和一个准确率 95% 的模型之间的差别，往往仅仅在于调度。

过去三年里发布的每一个主流模型都用了学习率调度。Llama 3 用的是峰值 lr=3e-4，配 2000 步预热，并以余弦衰减到 3e-5。GPT-3 用的是 lr=6e-4，在 3.75 亿个 token 上做预热。这些都不是随手定的，而是耗资数百万美元做大规模超参数扫描的结果。

你需要理解调度，因为默认设置不会适配你的问题。当你微调一个预训练模型时，合适的调度与从头训练时不一样。当你增大 batch size 时，预热周期需要随之改变。当训练在第 10000 步崩溃时，你需要判断这究竟是调度问题，还是别的什么问题。

## 概念解析

### 常量学习率

最简单的做法。挑一个数，每一步都用它。

```
lr(t) = lr_0
```

很少是最优的。它要么对训练末期太高（在最小值附近震荡），要么对训练初期太低（把算力浪费在微小的步子上）。对小模型和调试场景够用。但对任何训练时间超过一小时的任务来说都是个糟糕的选择。

### 阶梯衰减

ResNet 时代的老派做法。在固定的 epoch 处把学习率按某个因子（通常是 10 倍）砍一刀。

```
lr(t) = lr_0 * gamma^(floor(epoch / step_size))
```

其中 gamma = 0.1、step_size = 30 意味着：每隔 30 个 epoch，lr 下降 10 倍。ResNet-50 就是这么做的——lr=0.1，在第 30、60、90 个 epoch 处各下降 10 倍。

问题在于：最优的衰减点取决于数据集和架构。换一个问题，你就得重新调试在何时下降。而且这种切换是突变的——当学习率骤变时，损失可能会出现尖峰。

### 余弦退火

按余弦曲线，从最大学习率平滑衰减到最小学习率：

```
lr(t) = lr_min + 0.5 * (lr_max - lr_min) * (1 + cos(pi * t / T))
```

其中 t 是当前步数，T 是总步数。

在 t=0 时，余弦项为 1，所以 lr = lr_max。在 t=T 时，余弦项为 -1，所以 lr = lr_min。衰减一开始很缓和，在中段加速，临近末尾又重新变得缓和。

这是当下大多数训练任务的默认选择。除了 lr_max 和 lr_min，没有别的超参数需要调。余弦的形状契合一项经验观察：大部分学习都发生在训练的中段——在这个关键阶段你希望步长合理。

### 预热：为什么要从小开始

Adam 以及其他自适应优化器会维护对梯度均值和方差的滑动估计。在第 0 步，这些估计被初始化为零。最初几次梯度更新基于的是垃圾统计量。如果这段时期你的学习率很大，模型就会迈出巨大且方向糟糕的步子。

预热修正了这一点。先以一个极小的学习率起步（通常是 lr_max / warmup_steps，甚至是零），在最初的 N 步内线性爬升到 lr_max。等你到达完整学习率时，Adam 的统计量已经稳定下来了。

```
lr(t) = lr_max * (t / warmup_steps)     for t < warmup_steps
```

典型的预热长度：总训练步数的 1%~5%。Llama 3 训练了约 1.8 万亿个 token，预热了 2000 步。GPT-3 在 3.75 亿个 token 上做预热。

### 线性预热 + 余弦衰减

现代的默认方案。先线性爬升，再以余弦衰减：

```
if t < warmup_steps:
    lr(t) = lr_max * (t / warmup_steps)
else:
    progress = (t - warmup_steps) / (total_steps - warmup_steps)
    lr(t) = lr_min + 0.5 * (lr_max - lr_min) * (1 + cos(pi * progress))
```

Llama、GPT、PaLM 以及大多数现代 Transformer 用的都是这个方案。预热防止早期的不稳定，余弦衰减则让模型稳稳落入一个好的最小值。

### 1cycle 策略

Leslie Smith 在 2018 年的发现：在训练的前半程把学习率从一个低值拉升到一个高值，然后在后半程再把它拉回低值。这有点反直觉——为什么要在训练中途*提高*学习率呢？

理论是这样的：高学习率通过给优化轨迹注入噪声，起到了正则化的作用。在拉升阶段，模型探索了更大范围的损失曲面，从而找到更好的盆地（basin）。随后的拉降阶段则在找到的最佳盆地内做精细打磨。

```
Phase 1 (0 to T/2):    lr ramps from lr_max/25 to lr_max
Phase 2 (T/2 to T):    lr ramps from lr_max to lr_max/10000
```

在固定算力预算下，1cycle 往往比余弦退火训练得更快。代价是：你必须事先知道总步数。

### 各种调度的形状

```mermaid
graph LR
    subgraph "Constant"
        C1["lr"] --- C2["lr"] --- C3["lr"]
    end

    subgraph "Step Decay"
        S1["0.1"] --- S2["0.1"] --- S3["0.01"] --- S4["0.001"]
    end

    subgraph "Cosine Annealing"
        CS1["lr_max"] --> CS2["gradual"] --> CS3["steep"] --> CS4["lr_min"]
    end

    subgraph "Warmup + Cosine"
        WC1["0"] --> WC2["lr_max"] --> WC3["cosine"] --> WC4["lr_min"]
    end
```

### 决策流程图

```mermaid
flowchart TD
    Start["Choosing a LR schedule"] --> Know{"Know total<br/>training steps?"}

    Know -->|"Yes"| Budget{"Compute budget?"}
    Know -->|"No"| Constant["Use constant LR<br/>with manual decay"]

    Budget -->|"Large (days/weeks)"| WarmCos["Warmup + Cosine Decay<br/>(Llama/GPT default)"]
    Budget -->|"Small (hours)"| OneCycle["1cycle Policy<br/>(fastest convergence)"]
    Budget -->|"Moderate"| Cosine["Cosine Annealing<br/>(safe default)"]

    WarmCos --> Warmup["Warmup = 1-5% of steps"]
    OneCycle --> FindLR["Find lr_max with LR range test"]
    Cosine --> MinLR["Set lr_min = lr_max / 10"]
```

### 来自已发布模型的真实数字

```mermaid
graph TD
    subgraph "Published LR Configs"
        L3["Llama 3 (405B)<br/>Peak: 3e-4<br/>Warmup: 2000 steps<br/>Schedule: Cosine to 3e-5"]
        G3["GPT-3 (175B)<br/>Peak: 6e-4<br/>Warmup: 375M tokens<br/>Schedule: Cosine to 0"]
        R50["ResNet-50<br/>Peak: 0.1<br/>Warmup: none<br/>Schedule: Step decay x0.1 at 30,60,90"]
        B["BERT (340M)<br/>Peak: 1e-4<br/>Warmup: 10K steps<br/>Schedule: Linear decay"]
    end
```

## 动手构建

### 第 1 步：调度函数

每个函数接收当前步数，返回该步的学习率。

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

### 第 2 步：可视化全部调度

打印一张基于文本的图，展示每种调度在训练过程中如何演变。

```python
def visualize_schedule(name, schedule_fn, total_steps=500, **kwargs):
    steps = list(range(0, total_steps, total_steps // 20))
    if total_steps - 1 not in steps:
        steps.append(total_steps - 1)

    lrs = [schedule_fn(s, total_steps=total_steps, **kwargs) for s in steps]
    max_lr = max(lrs) if max(lrs) > 0 else 1.0

    print(f"\n{name}:")
    for s, lr_val in zip(steps, lrs):
        bar_len = int(lr_val / max_lr * 40)
        bar = "#" * bar_len
        print(f"  Step {s:4d}: lr={lr_val:.6f} {bar}")
```

### 第 3 步：训练网络

一个在 circle 数据集上的简单两层网络，与之前的课程相同，只不过这次我们改变调度。

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

### 第 4 步：对比全部调度

用每种调度训练同一个网络，对比最终损失与收敛行为。

```python
def compare_schedules(data):
    configs = [
        ("Constant", constant_schedule, {}),
        ("Step Decay", step_decay_schedule, {"step_size": 15000, "gamma": 0.1}),
        ("Cosine", cosine_schedule, {"lr_min": 1e-5}),
        ("Warmup+Cosine", warmup_cosine_schedule, {"warmup_steps": 3000, "lr_min": 1e-5}),
        ("1cycle", one_cycle_schedule, {}),
    ]

    print(f"\n{'Schedule':<20} {'Start Loss':>12} {'Mid Loss':>12} {'End Loss':>12} {'Best Loss':>12}")
    print("-" * 70)

    for name, schedule_fn, extra_kwargs in configs:
        losses = train_with_schedule(schedule_fn, name, data, epochs=300, base_lr=0.05, **extra_kwargs)
        mid_idx = len(losses) // 2
        best = min(losses)
        print(f"{name:<20} {losses[0]:>12.6f} {losses[mid_idx]:>12.6f} {losses[-1]:>12.6f} {best:>12.6f}")
```

### 第 5 步：学习率过高 vs 过低

演示三种失败模式：过高（发散）、过低（爬行）、恰到好处。

```python
def lr_sensitivity(data):
    learning_rates = [1.0, 0.1, 0.01, 0.001, 0.0001]

    print("\nLR Sensitivity (constant schedule, 100 epochs):")
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

## 实际运用

PyTorch 在 `torch.optim.lr_scheduler` 中提供了各种调度器：

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

要实现预热 + 余弦，可以用一个 lambda 调度器，或者用 HuggingFace 的 `get_cosine_schedule_with_warmup`：

```python
from transformers import get_cosine_schedule_with_warmup

scheduler = get_cosine_schedule_with_warmup(
    optimizer,
    num_warmup_steps=2000,
    num_training_steps=100000,
)
```

这个 HuggingFace 函数正是大多数 Llama 和 GPT 微调脚本所用的。拿不准时，就用预热 + 余弦，预热取总步数的 3%~5%。它几乎适用于一切场景。

## 交付成果

本课产出：
- `outputs/prompt-lr-schedule-advisor.md`——一个提示词，可为你的训练设置推荐合适的学习率调度与超参数

## 练习

1. 实现指数衰减：lr(t) = lr_0 * gamma^t，其中 gamma = 0.999。在 circle 数据集上与余弦退火做对比。

2. 实现学习率范围测试（Leslie Smith 提出）：训练几百步，同时把 LR 从 1e-7 指数级地增加到 1。绘制损失对 LR 的曲线。最优的最大 LR 就在损失开始上升之前的位置。

3. 用预热 + 余弦训练，但改变预热长度：分别取总步数的 0%、1%、5%、10%、20%。找出让训练最稳定的那个甜蜜点。

4. 实现带热重启的余弦退火（SGDR）：每隔 T 步把学习率重置回 lr_max，再次衰减。在一次更长的训练运行中与标准余弦做对比。

5. 构建一个「调度外科医生」：它监控训练损失，在损失稳定时自动从预热切换到余弦，并在损失平台期持续过久时降低 lr。

## 关键术语

| 术语 | 大家口头怎么说 | 实际含义 |
|------|----------------|----------------------|
| 学习率（Learning rate） | 「模型学得多快」 | 乘在梯度上、用以决定参数更新步长的标量 |
| 调度（Schedule） | 「让 LR 随时间变化」 | 一个把训练步数映射到学习率的函数，旨在优化收敛 |
| 预热（Warmup） | 「从一个小 LR 起步」 | 在最初的 N 步内将 LR 从接近零线性爬升到目标值，以稳定优化器的统计量 |
| 余弦退火（Cosine annealing） | 「平滑的 LR 衰减」 | 在训练过程中按余弦曲线把 LR 从 lr_max 降到 lr_min |
| 阶梯衰减（Step decay） | 「在里程碑处下调 LR」 | 在固定的 epoch 间隔处把 LR 乘以一个因子（通常是 0.1） |
| 1cycle 策略（1cycle policy） | 「先升后降」 | Leslie Smith 的方法，在单个周期内把 LR 先拉升再拉降，以实现更快收敛 |
| 学习率范围测试（LR range test） | 「找出最佳学习率」 | 一边短暂训练一边增大 LR，找出损失开始发散时的取值 |
| 带热重启的余弦（Cosine with warm restarts） | 「重置并重复」 | 周期性地把 LR 重置回 lr_max 并再次衰减（SGDR） |
| Eta min | 「LR 的下限」 | 调度衰减到的最小学习率 |
| 峰值学习率（Peak learning rate） | 「最大 LR」 | 训练期间达到的最高 LR，通常出现在预热之后 |

## 延伸阅读

- Loshchilov & Hutter，《SGDR: Stochastic Gradient Descent with Warm Restarts》（2017）——引入了余弦退火与热重启
- Smith，《Super-Convergence: Very Fast Training of Neural Networks Using Large Learning Rates》（2018）——1cycle 策略的论文
- Touvron 等，《Llama 2: Open Foundation and Fine-Tuned Chat Models》（2023）——记录了大规模训练所用的预热 + 余弦调度
- Goyal 等，《Accurate, Large Minibatch SGD: Training ImageNet in 1 Hour》（2017）——大批量训练的线性缩放规则与预热
