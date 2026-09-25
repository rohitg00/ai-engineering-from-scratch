# 权重初始化与训练稳定性

> 初始化错误，训练永远无法开始。初始化正确，50 层网络能像 3 层一样平稳训练。

**Type:** Build
**Languages:** Python
**Prerequisites:** 第 03.04 课（激活函数）、第 03.07 课（正则化）
**Time:** 约 90 分钟

## 学习目标

- 实现零初始化、随机初始化、Xavier/Glorot 和 Kaiming/He 初始化策略，并测量它们在 50 层网络中对激活值大小的影响
- 推导为什么 Xavier 初始化使用 Var(w) = 2/(fan_in + fan_out)，而 Kaiming 使用 Var(w) = 2/fan_in
- 演示零初始化带来的对称性问题，并解释为什么仅靠随机缩放并不足够
- 将正确的初始化策略与激活函数匹配：sigmoid/tanh 用 Xavier，ReLU/GELU 用 Kaiming

## 问题所在

把所有权重初始化为零。什么都学不到。每个神经元计算相同的函数，接收相同的梯度，并以相同的方式更新。经过 10,000 个 epoch 后，你的 512 神经元隐藏层仍然是同一个神经元的 512 份拷贝。你为 512 个参数付费，却只得到了 1 个。

把权重初始化得太大。激活值在网络中爆炸。到第 10 层，数值达到 1e15。到第 20 层，溢出为无穷大。梯度沿相反方向经历同样的轨迹。

用标准正态分布随机初始化。3 层时没问题。到 50 层时，信号要么坍缩为零，要么爆炸为无穷大，取决于随机缩放是稍微偏小还是稍微偏大。“能用”与“崩溃”之间的界限极其狭窄。

权重初始化是深度学习中最被低估的决策。架构能发表论文。优化器能写出博客。初始化只配得到一个脚注。但一旦做错，其他一切都无关紧要——你的网络在训练开始之前就已经死了。

## 核心概念

### 对称性问题

一层中的每个神经元都有相同的结构：输入乘以权重，加上偏置，应用激活函数。如果所有权重都以相同的值开始（零是极端情况），每个神经元都会计算相同的输出。在反向传播期间，每个神经元接收相同的梯度。在更新步骤中，每个神经元改变相同的量。

你被困住了。网络有数百个参数，但它们全部同步移动。这称为对称性，而随机初始化是打破对称性的暴力手段。每个神经元在权重空间中从不同的起点开始，因此每个神经元学习不同的特征。

但“随机”还不够。随机性的*尺度*决定了网络能否训练。

### 方差在层间的传播

考虑一个有 fan_in 个输入的单层：

```
z = w1*x1 + w2*x2 + ... + w_n*x_n
```

如果每个权重 wi 采样自方差为 Var(w) 的分布，且每个输入 xi 的方差为 Var(x)，则输出方差为：

```
Var(z) = fan_in * Var(w) * Var(x)
```

如果 Var(w) = 1 且 fan_in = 512，输出方差是输入方差的 512 倍。经过 10 层后：512^10 = 1.2e27。你的信号已经爆炸了。

如果 Var(w) = 0.001，输出方差每层缩小 0.001 * 512 = 0.512。经过 10 层后：0.512^10 = 0.00013。你的信号已经消失了。

目标：选择 Var(w) 使得 Var(z) = Var(x)。信号大小在层间保持恒定。

### Xavier/Glorot 初始化

Glorot 和 Bengio（2010）为 sigmoid 和 tanh 激活推导出了该解。为了在前向和反向传播中都保持方差恒定：

```
Var(w) = 2 / (fan_in + fan_out)
```

实践中，权重采样自：

```
w ~ Uniform(-limit, limit)  where limit = sqrt(6 / (fan_in + fan_out))
```

或：

```
w ~ Normal(0, sqrt(2 / (fan_in + fan_out)))
```

这是有效的，因为 sigmoid 和 tanh 在零附近（即正确初始化的激活值所在之处）大致是线性的。方差在数十层之间保持稳定。

### Kaiming/He 初始化

ReLU 会杀死一半的输出（所有负值都变为零）。有效 fan_in 被减半，因为平均有一半的输入被置零。Xavier 初始化没有考虑这一点——它低估了所需的方差。

He 等人（2015）调整了公式：

```
Var(w) = 2 / fan_in
```

权重采样自：

```
w ~ Normal(0, sqrt(2 / fan_in))
```

因子 2 补偿了 ReLU 将一半激活置零的事实。没有它，信号每层缩小约 0.5 倍。经过 50 层：0.5^50 = 8.8e-16。Kaiming 初始化防止了这一点。

### Transformer 初始化

GPT-2 引入了不同的模式。残差连接将每个子层的输出加到其输入上：

```
x = x + sublayer(x)
```

每次相加都会增加方差。有 N 个残差层时，方差与 N 成正比增长。GPT-2 将残差层的权重缩放 1/sqrt(2N)，其中 N 是层数。这使累积的信号大小保持稳定。

Llama 3（4050 亿参数，126 层）使用了类似的方案。没有这种缩放，残差流将在 126 层的注意力块和前馈块中无界增长。

```mermaid
flowchart TD
    subgraph "Zero Init"
        Z1["Layer 1<br/>All weights = 0"] --> Z2["Layer 2<br/>All neurons identical"]
        Z2 --> Z3["Layer 3<br/>Still identical"]
        Z3 --> ZR["Result: 1 effective neuron<br/>regardless of width"]
    end

    subgraph "Xavier Init"
        X1["Layer 1<br/>Var = 2/(fan_in+fan_out)"] --> X2["Layer 2<br/>Signal stable"]
        X2 --> X3["Layer 50<br/>Signal stable"]
        X3 --> XR["Result: Trains with<br/>sigmoid/tanh"]
    end

    subgraph "Kaiming Init"
        K1["Layer 1<br/>Var = 2/fan_in"] --> K2["Layer 2<br/>Signal stable"]
        K2 --> K3["Layer 50<br/>Signal stable"]
        K3 --> KR["Result: Trains with<br/>ReLU/GELU"]
    end
```

### 50 层中的激活值大小

```mermaid
graph LR
    subgraph "Mean Activation Magnitude"
        direction LR
        L1["Layer 1"] --> L10["Layer 10"] --> L25["Layer 25"] --> L50["Layer 50"]
    end

    subgraph "Results"
        R1["Random N(0,1): EXPLODES by layer 5"]
        R2["Random N(0,0.01): Vanishes by layer 10"]
        R3["Xavier + Sigmoid: ~1.0 at layer 50"]
        R4["Kaiming + ReLU: ~1.0 at layer 50"]
    end
```

### 选择正确的初始化

```mermaid
flowchart TD
    Start["What activation?"] --> Act{"Activation type?"}

    Act -->|"Sigmoid / Tanh"| Xavier["Xavier/Glorot<br/>Var = 2/(fan_in + fan_out)"]
    Act -->|"ReLU / Leaky ReLU"| Kaiming["Kaiming/He<br/>Var = 2/fan_in"]
    Act -->|"GELU / Swish"| Kaiming2["Kaiming/He<br/>(same as ReLU)"]
    Act -->|"Transformer residual"| GPT["Scale by 1/sqrt(2N)<br/>N = num layers"]

    Xavier --> Check["Verify: activation magnitudes<br/>stay between 0.5 and 2.0<br/>through all layers"]
    Kaiming --> Check
    Kaiming2 --> Check
    GPT --> Check
```

```figure
weight-init-variance
```

## 动手实现

### 步骤 1：初始化策略

四种初始化权重矩阵的方法。每个方法返回一个列表的列表（二维矩阵），包含 fan_in 列和 fan_out 行。

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

### 步骤 2：激活函数

我们需要 sigmoid、tanh 和 ReLU，以便用各自配套的激活函数测试每种初始化策略。

```python
def sigmoid(x):
    x = max(-500, min(500, x))
    return 1.0 / (1.0 + math.exp(-x))


def tanh_act(x):
    return math.tanh(x)


def relu(x):
    return max(0.0, x)
```

### 步骤 3：前向传播经过 50 层

将随机数据传入一个深层网络，并测量每层的平均激活值大小。

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

### 步骤 4：实验

运行所有组合：零初始化、随机 N(0,1)、随机 N(0,0.01)、Xavier + sigmoid、Xavier + tanh、Kaiming + ReLU。打印关键层的大小。

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

### 步骤 5：对称性演示

展示零初始化会产生完全相同的神经元。

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

    print("\nSymmetry Demo (4 neurons, zero init):")
    for i, out in enumerate(outputs):
        print(f"  Neuron {i}: output = {out:.6f}")
    all_same = all(abs(outputs[i] - outputs[0]) < 1e-10 for i in range(len(outputs)))
    print(f"  All identical: {all_same}")
    print(f"  Effective parameters: 1 (not {len(weights) * len(weights[0])})")
```

### 步骤 6：逐层大小报告

打印一张可视化条形图，展示 50 层中激活值的大小。

```python
def magnitude_report(name, magnitudes):
    print(f"\n{name}:")
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

PyTorch 将这些提供为内置函数：

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

当你调用 `nn.Linear(512, 256)` 时，PyTorch 默认使用 Kaiming 均匀初始化。这就是为什么大多数简单网络“开箱即用”——PyTorch 已经替你做出了正确的选择。但当你构建自定义架构或构建超过 20 层的网络时，你需要理解背后发生了什么，并可能需要覆盖默认设置。

对于 Transformer，HuggingFace 模型通常在其 `_init_weights` 方法中处理初始化。GPT-2 的实现将残差投影缩放 1/sqrt(N)。如果你从零开始构建 Transformer，你需要自己添加这一步。

## 交付成果

本课产出：
- `outputs/prompt-init-strategy.md` —— 一个诊断权重初始化问题并推荐正确策略的提示词

## 练习

1. 添加 LeCun 初始化（Var = 1/fan_in，为 SELU 激活设计）。用 LeCun 初始化 + tanh 运行 50 层实验，并与 Xavier + tanh 比较。

2. 实现 GPT-2 的残差缩放：在加到残差流之前，将每层的输出乘以 1/sqrt(2*N)。分别在有缩放和无缩放的情况下运行 50 层，测量残差大小增长的速度。

3. 创建一个“初始化健康检查”函数，接收网络的层维度和激活类型，然后推荐正确的初始化，并在当前初始化会导致问题时发出警告。

4. 用 fan_in = 16 与 fan_in = 1024 运行实验。Xavier 和 Kaiming 会自适应 fan_in，但随机初始化不会。展示“能用”与“崩溃”之间的差距如何随层规模增大而扩大。

5. 实现正交初始化（生成一个随机矩阵，计算其 SVD，使用正交矩阵 U）。在 50 层的 ReLU 网络上与 Kaiming 比较。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|----------------------|
| 权重初始化 | “随机设置初始权重” | 选择初始权重值的策略，决定网络是否能够训练 |
| 对称性打破 | “让神经元各不相同” | 使用随机初始化确保神经元学习不同的特征，而不是计算相同的函数 |
| Fan-in | “神经元的输入数量” | 输入连接的数量，决定输入方差在加权和中的累积方式 |
| Fan-out | “神经元的输出数量” | 输出连接的数量，与反向传播期间维持梯度方差有关 |
| Xavier/Glorot 初始化 | “sigmoid 的初始化” | Var(w) = 2/(fan_in + fan_out)，旨在通过 sigmoid 和 tanh 激活保持方差 |
| Kaiming/He 初始化 | “ReLU 的初始化” | Var(w) = 2/fan_in，考虑了 ReLU 将一半激活置零的影响 |
| 方差传播 | “信号如何在层间增长或缩小” | 基于权重尺度逐层分析激活方差变化的数学方法 |
| 残差缩放 | “GPT-2 的初始化技巧” | 将残差连接的权重缩放 1/sqrt(2N)，防止方差在 N 个 Transformer 层中增长 |
| 死亡网络 | “什么都训练不了” | 由于糟糕的初始化导致所有梯度为零或所有激活饱和的网络 |
| 爆炸激活 | “数值趋于无穷大” | 权重方差过高，导致激活值大小在层间呈指数增长 |

## 延伸阅读

- Glorot & Bengio, "Understanding the difficulty of training deep feedforward neural networks"（2010）—— Xavier 初始化的原始论文，包含方差分析
- He et al., "Delving Deep into Rectifiers"（2015）—— 提出了适用于 ReLU 网络的 Kaiming 初始化
- Radford et al., "Language Models are Unsupervised Multitask Learners"（2019）—— GPT-2 论文，包含残差缩放初始化
- Mishkin & Matas, "All You Need is a Good Init"（2016）—— 层序单位方差初始化，一种分析公式的经验性替代方案