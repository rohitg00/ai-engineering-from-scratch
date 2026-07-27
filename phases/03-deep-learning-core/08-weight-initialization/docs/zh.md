# 权重初始化与训练稳定性 (Weight Initialization and Training Stability)

> 初始化错误，训练永远无法开始。初始化正确，50 层和 3 层一样顺畅。

**类型：** 动手构建
**语言：** Python
**前置知识：** 第 03.04 课（激活函数），第 03.07 课（正则化）
**时长：** ~90 分钟

## 学习目标

- 实现零初始化、随机初始化、Xavier/Glorot 和 Kaiming/He 初始化策略，并测量它们对 50 层网络中激活幅度的影响
- 推导为什么 Xavier 使用 Var(w) = 2/(fan_in + fan_out) 而 Kaiming 使用 Var(w) = 2/fan_in
- 演示零初始化的对称性问题，并解释为什么仅靠随机尺度是不够的
- 将正确的初始化策略匹配到激活函数：Xavier 用于 sigmoid/tanh，Kaiming 用于 ReLU/GELU

## 问题

将所有权重设为零。什么都不学。每个神经元计算相同的函数，接收相同的梯度，并相同地更新。10,000 个 epoch 后，你的 512 神经元隐藏层仍然是同一个神经元的 512 个副本。你为 512 个参数付了钱，只得到了 1 个。

将它们初始化得太大。激活值在网络中爆炸。到第 10 层，值达到 1e15。到第 20 层，它们溢出到无穷大。梯度反向遵循同样的轨迹。

从标准正态分布随机初始化。对 3 层有效。在 50 层时，信号坍缩到零或引爆到无穷大，取决于随机尺度是略小还是略大。"有效"和"崩溃"之间的边界薄如刀锋。

权重初始化是深度学习中最被低估的决策。架构能发论文。优化器能写博客。初始化只能得到一个脚注。但搞错了，其他什么都不重要——你的网络在训练开始之前就已经死了。

## 概念

### 对称性问题

一层中的每个神经元都有相同的结构：将输入乘以权重，加偏置，应用激活函数。如果所有权重以相同的值开始（零是极端情况），每个神经元计算相同的输出。在反向传播期间，每个神经元接收相同的梯度。在更新步骤中，每个神经元变化相同的量。

你被卡住了。网络有数百个参数，但全部同步运动。这称为对称性，随机初始化是打破它的蛮力方法。每个神经元在权重空间中从不同的点开始，因此每个学习不同的特征。

但"随机"还不够。随机性的*尺度*决定了网络能否训练。

### 通过层的方差传播

考虑一个有 fan_in 个输入的单层：

```
z = w1*x1 + w2*x2 + ... + w_n*x_n
```

如果每个权重 wi 来自方差为 Var(w) 的分布，每个输入 xi 的方差为 Var(x)，则输出方差为：

```
Var(z) = fan_in * Var(w) * Var(x)
```

如果 Var(w) = 1 且 fan_in = 512，输出方差是输入方差的 512 倍。10 层之后：512^10 = 1.2e27。你的信号已经爆炸了。

如果 Var(w) = 0.001，输出方差每层缩小 0.001 * 512 = 0.512。10 层之后：0.512^10 = 0.00013。你的信号已经消失了。

目标：选择 Var(w) 使得 Var(z) = Var(x)。信号幅度在各层之间保持不变。

### Xavier/Glorot 初始化

Glorot 和 Bengio（2010）为 sigmoid 和 tanh 激活函数推导出解决方案。为了在前向和反向传播中保持方差恒定：

```
Var(w) = 2 / (fan_in + fan_out)
```

在实践中，权重从以下分布中抽取：

```
w ~ Uniform(-limit, limit)  其中 limit = sqrt(6 / (fan_in + fan_out))
```

或：

```
w ~ Normal(0, sqrt(2 / (fan_in + fan_out)))
```

这有效是因为 sigmoid 和 tanh 在零附近大致是线性的，而正确初始化的激活值就在那里。方差在数十层中保持稳定。

### Kaiming/He 初始化

ReLU 杀死了一半的输出（所有负数变为零）。有效的 fan_in 减半，因为平均一半的输入被置零。Xavier 初始化没有考虑到这一点——它低估了所需的方差。

He 等人（2015）调整了公式：

```
Var(w) = 2 / fan_in
```

权重从以下分布中抽取：

```
w ~ Normal(0, sqrt(2 / fan_in))
```

因子 2 补偿了 ReLU 将一半激活值置零的情况。没有它，信号每层缩小约 0.5 倍。50 层：0.5^50 = 8.8e-16。Kaiming 初始化防止了这种情况。

### Transformer 初始化

GPT-2 引入了一种不同的模式。残差连接将每个子层的输出加到其输入上：

```
x = x + sublayer(x)
```

每次加法都会增加方差。有 N 个残差层时，方差与 N 成比例增长。GPT-2 将残差层的权重缩放 1/sqrt(2N)，其中 N 是层数。这保持了累积信号幅度的稳定。

Llama 3（405B 参数，126 层）使用了类似的方案。没有这种缩放，残差流会在 126 层的注意力和前馈块中无界增长。

```mermaid
flowchart TD
    subgraph "零初始化"
        Z1["Layer 1<br/>所有权重 = 0"] --> Z2["Layer 2<br/>所有神经元相同"]
        Z2 --> Z3["Layer 3<br/>仍然相同"]
        Z3 --> ZR["结果: 1 个有效神经元<br/>无论宽度如何"]
    end

    subgraph "Xavier 初始化"
        X1["Layer 1<br/>Var = 2/(fan_in+fan_out)"] --> X2["Layer 2<br/>信号稳定"]
        X2 --> X3["Layer 50<br/>信号稳定"]
        X3 --> XR["结果: 可训练<br/>sigmoid/tanh"]
    end

    subgraph "Kaiming 初始化"
        K1["Layer 1<br/>Var = 2/fan_in"] --> K2["Layer 2<br/>信号稳定"]
        K2 --> K3["Layer 50<br/>信号稳定"]
        K3 --> KR["结果: 可训练<br/>ReLU/GELU"]
    end
```

### 通过 50 层的激活幅度

```mermaid
graph LR
    subgraph "平均激活幅度"
        direction LR
        L1["Layer 1"] --> L10["Layer 10"] --> L25["Layer 25"] --> L50["Layer 50"]
    end

    subgraph "结果"
        R1["随机 N(0,1): 到第 5 层爆炸"]
        R2["随机 N(0,0.01): 到第 10 层消失"]
        R3["Xavier + Sigmoid: 在第 50 层约 1.0"]
        R4["Kaiming + ReLU: 在第 50 层约 1.0"]
    end
```

### 选择正确的初始化

```mermaid
flowchart TD
    Start["使用什么激活函数？"] --> Act{"激活类型？"}

    Act -->|"Sigmoid / Tanh"| Xavier["Xavier/Glorot<br/>Var = 2/(fan_in + fan_out)"]
    Act -->|"ReLU / Leaky ReLU"| Kaiming["Kaiming/He<br/>Var = 2/fan_in"]
    Act -->|"GELU / Swish"| Kaiming2["Kaiming/He<br/>（与 ReLU 相同）"]
    Act -->|"Transformer 残差"| GPT["按 1/sqrt(2N) 缩放<br/>N = 层数"]

    Xavier --> Check["验证：激活幅度<br/>在所有层中保持在 0.5 到 2.0 之间"]
    Kaiming --> Check
    Kaiming2 --> Check
    GPT --> Check
```

```figure
weight-init-variance
```

## 动手构建

### 第 1 步：初始化策略

四种初始化权重矩阵的方式。每个返回一个列表的列表（2D 矩阵），有 fan_in 列和 fan_out 行。

```python
import math
import random


def zero_init(fan_in, fan_out):
    return [[0.0 for _ in range(fan_in)] for _ in range(fan_out)]


def random_init(fan_in, fan_out, scale=1.0):
    return [[random.gauss(0, scale) for _ in range(fan_in)] for _ in range(fan_out)]


def xavier_init(fan_in, fan_out):
    std = math.sqrt(2.0 / (fan_in + fan_out))
    return [[random.gauss(0, std) for _ in range(fan_in)] for _ in range(fan_out)]


def kaiming_init(fan_in, fan_out):
    std = math.sqrt(2.0 / fan_in)
    return [[random.gauss(0, std) for _ in range(fan_in)] for _ in range(fan_out)]
```

### 第 2 步：激活函数

我们需要 sigmoid、tanh 和 ReLU 来用预期的激活函数测试每种初始化策略。

```python
def sigmoid(x):
    x = max(-500, min(500, x))
    return 1.0 / (1.0 + math.exp(-x))


def tanh_act(x):
    return math.tanh(x)


def relu(x):
    return max(0.0, x)
```

### 第 3 步：通过 50 层的前向传播

将随机数据通过一个深度网络，并测量每层的平均激活幅度。

```python
def forward_deep(init_fn, activation_fn, n_layers=50, width=64, n_samples=100):
    random.seed(42)
    layer_magnitudes = []

    inputs = [[random.gauss(0, 1) for _ in range(width)] for _ in range(n_samples)]

    for layer_idx in range(n_layers):
        weights = init_fn(width, width)
        biases = [0.0] * width

        new_inputs = []
        for sample in inputs:
            output = []
            for neuron_idx in range(width):
                z = sum(weights[neuron_idx][j] * sample[j] for j in range(width)) + biases[neuron_idx]
                output.append(activation_fn(z))
            new_inputs.append(output)
        inputs = new_inputs

        magnitudes = []
        for sample in inputs:
            magnitudes.append(sum(abs(v) for v in sample) / width)
        mean_mag = sum(magnitudes) / len(magnitudes)
        layer_magnitudes.append(mean_mag)

    return layer_magnitudes
```

### 第 4 步：实验

运行所有组合：零初始化、随机 N(0,1)、随机 N(0,0.01)、带 sigmoid 的 Xavier、带 tanh 的 Xavier、带 ReLU 的 Kaiming。打印关键层的幅度。

```python
def run_experiment():
    configs = [
        ("Zero init + Sigmoid", lambda fi, fo: zero_init(fi, fo), sigmoid),
        ("Random N(0,1) + ReLU", lambda fi, fo: random_init(fi, fo, 1.0), relu),
        ("Random N(0,0.01) + ReLU", lambda fi, fo: random_init(fi, fo, 0.01), relu),
        ("Xavier + Sigmoid", xavier_init, sigmoid),
        ("Xavier + Tanh", xavier_init, tanh_act),
        ("Kaiming + ReLU", kaiming_init, relu),
    ]

    print(f"{'Strategy':<30} {'L1':>10} {'L5':>10} {'L10':>10} {'L25':>10} {'L50':>10}")
    print("-" * 80)

    for name, init_fn, act_fn in configs:
        mags = forward_deep(init_fn, act_fn)
        row = f"{name:<30}"
        for idx in [0, 4, 9, 24, 49]:
            val = mags[idx]
            if val > 1e6:
                row += f" {'EXPLODED':>10}"
            elif val < 1e-6:
                row += f" {'VANISHED':>10}"
            else:
                row += f" {val:>10.4f}"
        print(row)
```

### 第 5 步：对称性演示

展示零初始化产生相同的神经元。

```python
def symmetry_demo():
    random.seed(42)
    weights = zero_init(2, 4)
    biases = [0.0] * 4

    inputs = [0.5, -0.3]
    outputs = []
    for neuron_idx in range(4):
        z = sum(weights[neuron_idx][j] * inputs[j] for j in range(2)) + biases[neuron_idx]
        outputs.append(sigmoid(z))

    print("
Symmetry Demo (4 neurons, zero init):")
    for i, out in enumerate(outputs):
        print(f"  Neuron {i}: output = {out:.6f}")
    all_same = all(abs(outputs[i] - outputs[0]) < 1e-10 for i in range(len(outputs)))
    print(f"  All identical: {all_same}")
    print(f"  Effective parameters: 1 (not {len(weights) * len(weights[0])})")
```

### 第 6 步：逐层幅度报告

打印一个可视化条形图，显示 50 层中的激活幅度。

```python
def magnitude_report(name, magnitudes):
    print(f"
{name}:")
    for i, mag in enumerate(magnitudes):
        if i % 5 == 0 or i == len(magnitudes) - 1:
            if mag > 1e6:
                bar = "X" * 50 + " EXPLODED"
            elif mag < 1e-6:
                bar = "." + " VANISHED"
            else:
                bar_len = min(50, max(1, int(mag * 10)))
                bar = "#" * bar_len
            print(f"  Layer {i+1:3d}: {bar} ({mag:.6f})")
```

## 使用它

PyTorch 将这些作为内置函数提供：

```python
import torch
import torch.nn as nn

layer = nn.Linear(512, 256)

nn.init.xavier_uniform_(layer.weight)
nn.init.xavier_normal_(layer.weight)

nn.init.kaiming_uniform_(layer.weight, nonlinearity='relu')
nn.init.kaiming_normal_(layer.weight, nonlinearity='relu')

nn.init.zeros_(layer.bias)
```

当你调用 `nn.Linear(512, 256)` 时，PyTorch 默认使用 Kaiming 均匀初始化。这就是大多数简单网络"直接可用"的原因——PyTorch 已经做出了正确的选择。但当你构建自定义架构或超过 20 层时，你需要理解正在发生的事情并可能覆盖默认值。

对于 transformer，HuggingFace 模型通常在其 `_init_weights` 方法中处理初始化。GPT-2 的实现将残差投影缩放 1/sqrt(N)。如果你从零构建 transformer，你需要自己添加这个。

## 交付物

本课程产出：
- `outputs/prompt-init-strategy.md` —— 一个诊断权重初始化问题并推荐正确策略的提示词

## 练习

1. 添加 LeCun 初始化（Var = 1/fan_in，为 SELU 激活设计）。使用 LeCun 初始化 + tanh 运行 50 层实验，并与 Xavier + tanh 比较。
2. 实现 GPT-2 残差缩放：在添加到残差流之前，将每层的输出乘以 1/sqrt(2*N)。运行 50 层，有和没有缩放，测量残差幅度增长的速度。
3. 创建一个"初始化健康检查"函数，接收网络的层维度和激活类型，然后推荐正确的初始化，并在当前初始化会导致问题时发出警告。
4. 用 fan_in = 16 与 fan_in = 1024 运行实验。Xavier 和 Kaiming 适应 fan_in，但随机初始化不。展示"有效"和"失效"之间的差距如何随着更大的层而扩大。
5. 实现正交初始化（生成随机矩阵，计算其 SVD，使用正交矩阵 U）。在 50 层的 ReLU 网络上与 Kaiming 进行比较。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Weight initialization | "设置起始权重的随机值" | 选择初始权重值的策略，决定了网络是否能够训练 |
| Symmetry breaking | "让神经元不同" | 使用随机初始化确保神经元学习不同的特征，而非计算相同的函数 |
| Fan-in | "神经元的输入数" | 传入连接的数量，决定了输入方差在加权和中如何累积 |
| Fan-out | "神经元的输出数" | 传出连接的数量，与在反向传播期间保持梯度方差相关 |
| Xavier/Glorot init | "sigmoid 的初始化" | Var(w) = 2/(fan_in + fan_out)，旨在通过 sigmoid 和 tanh 激活保持方差 |
| Kaiming/He init | "ReLU 的初始化" | Var(w) = 2/fan_in，考虑了 ReLU 将一半激活置零的情况 |
| Variance propagation | "信号如何通过层增长或缩小" | 分析激活方差如何基于权重尺度逐层变化的数学方法 |
| Residual scaling | "GPT-2 的初始化技巧" | 将残差连接权重缩放 1/sqrt(2N) 以防止通过 N 个 transformer 层的方差增长 |
| Dead network | "什么都不训练" | 由于较差的初始化导致所有梯度为零或所有激活饱和的网络 |
| Exploding activations | "值变为无穷大" | 当权重方差过高时，导致激活值通过层呈指数级增长 |

## 延伸阅读

- Glorot & Bengio, "Understanding the difficulty of training deep feedforward neural networks" (2010) —— 原始的 Xavier 初始化论文，含方差分析
- He et al., "Delving Deep into Rectifiers" (2015) —— 为 ReLU 网络引入了 Kaiming 初始化
- Radford et al., "Language Models are Unsupervised Multitask Learners" (2019) —— GPT-2 论文，含残差缩放初始化
- Mishkin & Matas, "All You Need is a Good Init" (2016) —— 层序单位方差初始化，一种分析公式的经验替代方案
