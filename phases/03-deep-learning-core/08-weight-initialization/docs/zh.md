# 08 · 权重初始化与训练稳定性

> 初始化错了，训练根本无法启动。初始化对了，50 层网络的训练能像 3 层一样平滑。

**类型：** 实战构建
**语言：** Python
**前置：** 第 03.04 课（激活函数）、第 03.07 课（正则化）
**时长：** 约 90 分钟

## 学习目标

- 实现零初始化、随机初始化、Xavier/Glorot 与 Kaiming/He 初始化策略，并测量它们在 50 层网络中对激活值幅度的影响
- 推导为什么 Xavier 初始化使用 Var(w) = 2/(fan_in + fan_out)，而 Kaiming 使用 Var(w) = 2/fan_in
- 演示零初始化带来的对称性问题，并解释为什么仅靠随机的尺度（scale）是不够的
- 把正确的初始化策略与激活函数匹配起来：sigmoid/tanh 用 Xavier，ReLU/GELU 用 Kaiming

## 问题所在

把所有权重初始化为零，什么都学不到。每个神经元计算出相同的函数、收到相同的梯度、做出完全相同的更新。训练 10000 个 epoch 之后，你那拥有 512 个神经元的隐藏层，仍然只是同一个神经元的 512 份拷贝。你为 512 个参数买了单，最终只得到了 1 个。

把权重初始化得太大，激活值会在网络中爆炸式增长。到第 10 层时，数值飙到 1e15；到第 20 层时，溢出为无穷大。梯度在反向传播时也沿着同样的轨迹演进。

从标准正态分布中随机初始化权重，对 3 层网络奏效。但到了 50 层，信号要么坍缩为零，要么引爆到无穷大——取决于这个随机尺度是稍微偏小还是稍微偏大。「能用」和「崩溃」之间的边界薄如刀刃。

权重初始化是深度学习中最被低估的决策。架构能发论文，优化器能写博客，而初始化只能拿到一个脚注。但只要它做错了，其他一切都不重要了——你的网络在训练开始之前就已经死了。

## 核心概念

### 对称性问题

一层中的每个神经元结构都相同：把输入乘以权重，加上偏置，再施加激活函数。如果所有权重都从同一个值开始（零是最极端的情况），那么每个神经元都会算出相同的输出。在反向传播时，每个神经元收到相同的梯度。在更新步骤中，每个神经元都按相同的幅度变化。

你被卡住了。网络拥有数百个参数，但它们全部步调一致地移动。这被称为对称性（symmetry），而随机初始化就是打破它的暴力手段。每个神经元从权重空间中的不同位置出发，于是各自学到不同的特征。

但「随机」还不够。随机性的*尺度*决定了网络能否完成训练。

### 方差在层间的传播

考虑一个拥有 fan_in 个输入的单层：

```
z = w1*x1 + w2*x2 + ... + w_n*x_n
```

如果每个权重 wi 都从一个方差为 Var(w) 的分布中抽取，且每个输入 xi 的方差为 Var(x)，那么输出方差为：

```
Var(z) = fan_in * Var(w) * Var(x)
```

如果 Var(w) = 1 且 fan_in = 512，那么输出方差是输入方差的 512 倍。经过 10 层后：512^10 = 1.2e27。你的信号爆炸了。

如果 Var(w) = 0.001，那么每层的输出方差会缩小为原来的 0.001 * 512 = 0.512 倍。经过 10 层后：0.512^10 = 0.00013。你的信号消失了。

目标是：选择合适的 Var(w)，使得 Var(z) = Var(x)。这样信号幅度就能在各层之间保持恒定。

### Xavier/Glorot 初始化

Glorot 和 Bengio（2010）针对 sigmoid 和 tanh 激活函数推导出了解决方案。为了让方差在前向和反向传播中都保持恒定：

```
Var(w) = 2 / (fan_in + fan_out)
```

实践中，权重从以下分布中抽取：

```
w ~ Uniform(-limit, limit)  where limit = sqrt(6 / (fan_in + fan_out))
```

或：

```
w ~ Normal(0, sqrt(2 / (fan_in + fan_out)))
```

之所以有效，是因为 sigmoid 和 tanh 在零点附近近似线性，而正确初始化的激活值恰好就落在那个区间。这样方差就能在几十层中保持稳定。

### Kaiming/He 初始化

ReLU 会杀掉一半的输出（所有负值都变成零）。有效的 fan_in 被减半了，因为平均而言有一半的输入被置零。Xavier 初始化没有考虑这一点——它低估了所需的方差。

He 等人（2015）调整了公式：

```
Var(w) = 2 / fan_in
```

权重从以下分布中抽取：

```
w ~ Normal(0, sqrt(2 / fan_in))
```

其中的因子 2 补偿了 ReLU 将一半激活值置零的效应。如果没有它，信号每层会缩小约 0.5 倍。经过 50 层：0.5^50 = 8.8e-16。Kaiming 初始化避免了这种情况。

### Transformer 初始化

GPT-2 引入了一种不同的模式。残差连接（residual connection）会把每个子层的输出加回到它的输入上：

```
x = x + sublayer(x)
```

每一次相加都会增大方差。当有 N 个残差层时，方差会随 N 成比例增长。GPT-2 把残差层的权重按 1/sqrt(2N) 缩放，其中 N 是层数。这能让累积的信号幅度保持稳定。

Llama 3（4050 亿参数，126 层）采用了类似的方案。如果没有这种缩放，残差流（residual stream）会在 126 层的注意力块和前馈块中无限增长。

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

### 50 层网络中的激活值幅度

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

## 动手构建

### 第 1 步：初始化策略

初始化权重矩阵的四种方式。每个函数返回一个由列表组成的列表（一个二维矩阵），它有 fan_in 列、fan_out 行。

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

我们需要 sigmoid、tanh 和 ReLU，以便用各自匹配的激活函数来测试每种初始化策略。

```python
def sigmoid(x):
    x = max(-500, min(500, x))
    return 1.0 / (1.0 + math.exp(-x))


def tanh_act(x):
    return math.tanh(x)


def relu(x):
    return max(0.0, x)
```

### 第 3 步：穿过 50 层的前向传播

让随机数据穿过一个深层网络，并测量每一层的平均激活值幅度。

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

跑遍所有组合：零初始化、随机 N(0,1)、随机 N(0,0.01)、Xavier 配 sigmoid、Xavier 配 tanh、Kaiming 配 ReLU。打印出关键层上的幅度。

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

### 第 6 步：逐层幅度报告

打印一张穿过 50 层的激活值幅度可视化条形图。

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

## 实际应用

PyTorch 把这些初始化方法作为内置函数提供：

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

当你调用 `nn.Linear(512, 256)` 时，PyTorch 默认采用 Kaiming uniform 初始化。这就是为什么大多数简单网络「开箱即用」——PyTorch 已经替你做出了正确的选择。但当你构建自定义架构，或网络深度超过 20 层时，你就需要理解背后究竟发生了什么，并可能需要覆盖掉默认设置。

对于 transformer，HuggingFace 模型通常在它们的 `_init_weights` 方法中处理初始化。GPT-2 的实现把残差投影按 1/sqrt(N) 缩放。如果你要从零构建一个 transformer，就需要自己加上这一步。

## 交付成果

本课产出：
- `outputs/prompt-init-strategy.md`——一个用于诊断权重初始化问题并推荐正确策略的提示词

## 练习

1. 加入 LeCun 初始化（Var = 1/fan_in，专为 SELU 激活函数设计）。用 LeCun 初始化 + tanh 跑一遍 50 层实验，并与 Xavier + tanh 对比。

2. 实现 GPT-2 的残差缩放：在把每层的输出加回残差流之前，先乘以 1/sqrt(2*N)。在有缩放和无缩放两种情况下跑 50 层，测量残差幅度增长的速度有多快。

3. 编写一个「初始化健康检查」函数，它接收一个网络的各层维度和激活类型，然后推荐正确的初始化方式，并在当前初始化会引发问题时发出警告。

4. 分别用 fan_in = 16 和 fan_in = 1024 跑实验。Xavier 和 Kaiming 会自适应 fan_in，而随机初始化不会。展示「能用」和「崩溃」之间的差距如何随着层变大而拉大。

5. 实现正交初始化（orthogonal initialization）（生成一个随机矩阵，计算它的 SVD，使用其中的正交矩阵 U）。在 50 层的 ReLU 网络上与 Kaiming 对比。

## 关键术语

| 术语 | 人们口中的说法 | 它实际的含义 |
|------|----------------|----------------------|
| 权重初始化（Weight initialization） | 「随机设置起始权重」 | 选择初始权重值的策略，它决定了一个网络究竟能不能训练起来 |
| 对称性破缺（Symmetry breaking） | 「让神经元各不相同」 | 用随机初始化确保神经元学到不同的特征，而不是计算出完全相同的函数 |
| 扇入（Fan-in） | 「一个神经元的输入数量」 | 输入连接的数量，它决定了输入方差在加权求和中如何累积 |
| 扇出（Fan-out） | 「一个神经元的输出数量」 | 输出连接的数量，与反向传播时维持梯度方差相关 |
| Xavier/Glorot 初始化 | 「sigmoid 初始化」 | Var(w) = 2/(fan_in + fan_out)，设计用于在 sigmoid 和 tanh 激活中保持方差 |
| Kaiming/He 初始化 | 「ReLU 初始化」 | Var(w) = 2/fan_in，考虑了 ReLU 将一半激活值置零的效应 |
| 方差传播（Variance propagation） | 「信号如何在层间增长或缩小」 | 对激活方差如何随权重尺度逐层变化的数学分析 |
| 残差缩放（Residual scaling） | 「GPT-2 的初始化技巧」 | 把残差连接权重按 1/sqrt(2N) 缩放，以防止方差在 N 个 transformer 层中增长 |
| 死网络（Dead network） | 「什么都训练不动」 | 一个因初始化不佳导致所有梯度为零或所有激活饱和的网络 |
| 激活值爆炸（Exploding activations） | 「数值变成无穷大」 | 当权重方差过高时，激活值幅度会随层数呈指数级增长 |

## 延伸阅读

- Glorot & Bengio，《Understanding the difficulty of training deep feedforward neural networks》（2010）——最初的 Xavier 初始化论文，附带方差分析
- He et al.，《Delving Deep into Rectifiers》（2015）——为 ReLU 网络引入了 Kaiming 初始化
- Radford et al.，《Language Models are Unsupervised Multitask Learners》（2019）——带有残差缩放初始化的 GPT-2 论文
- Mishkin & Matas，《All You Need is a Good Init》（2016）——逐层单位方差初始化，一种替代解析公式的经验性方案
