# 07 · 正则化

> 你的模型在训练数据上拿到 99%，在测试数据上只有 60%。它是在死记硬背，而不是在学习。正则化（regularization）就是你对复杂度征收的「税」，以此逼迫模型去泛化。

**类型：** 实践构建
**语言：** Python
**前置：** 第 03.06 课（优化器）
**时长：** 约 75 分钟

## 学习目标

- 从零实现带反向缩放的 dropout、L2 权重衰减、批归一化、层归一化以及 RMSNorm
- 测量训练—测试准确率差距，并通过正则化实验诊断过拟合
- 解释为什么 transformer 使用 LayerNorm 而非 BatchNorm，以及为什么现代大语言模型偏好 RMSNorm
- 根据过拟合的严重程度，应用正确的正则化技术组合

## 问题所在

只要参数足够多，神经网络就能记住任何数据集。这并非假设——Zhang 等人（2017）通过在 ImageNet 上用随机标签训练标准网络证明了这一点。这些网络在完全随机的标签分配上达到了接近零的训练损失。它们记住了一百万对毫无规律可学的随机输入—输出对。训练损失完美无缺，测试准确率却为零。

这就是「过拟合（overfitting）」问题，而且模型越大，问题越严重。GPT-3 有 1750 亿个参数，训练集大约有 5000 亿个 token。在参数如此之多的情况下，模型有足够的容量逐字记住训练数据中的大段内容。如果没有正则化，它只会照搬训练样本，而不是学习可泛化的模式。

训练表现与测试表现之间的差距就是「过拟合差距（overfitting gap）」。本课中的每一种技术都从不同角度攻击这个差距。Dropout 迫使网络不依赖任何单个神经元。权重衰减（weight decay）防止任何单个权重变得过大。批归一化（batch normalization）平滑了损失曲面，使优化器找到更平坦、更易泛化的极小值。层归一化（layer normalization）做的是同样的事，但在批归一化失效的场景下（小批量、变长序列）依然有效。RMSNorm 通过省去均值计算，把速度再提升 10%。每种技术都很简单。但它们合在一起，就是「会死记硬背的模型」和「会泛化的模型」之间的分水岭。

## 核心概念

### 过拟合谱系

每个模型都位于一条谱系上的某处：一端是欠拟合（underfitting，过于简单，捕捉不到模式），另一端是过拟合（过于复杂，连噪声都捕捉了）。最佳点在两者之间，而正则化把模型从过拟合那一侧往最佳点推。

```mermaid
graph LR
    Under["Underfitting<br/>Train: 60%<br/>Test: 58%<br/>Model too simple"] --> Good["Good Fit<br/>Train: 95%<br/>Test: 92%<br/>Generalizes well"]
    Good --> Over["Overfitting<br/>Train: 99.9%<br/>Test: 65%<br/>Memorized noise"]

    Dropout["Dropout"] -->|"Pushes left"| Over
    WD["Weight Decay"] -->|"Pushes left"| Over
    BN["BatchNorm"] -->|"Pushes left"| Over
    Aug["Data Augmentation"] -->|"Pushes left"| Over
```

### Dropout

最简单的正则化技术，却拥有最优雅的解释。训练期间，以概率 p 随机把每个神经元的输出置为零。

```
output = activation(z) * mask    where mask[i] ~ Bernoulli(1 - p)
```

当 p = 0.5 时，每次前向传播都有一半神经元被置零。网络必须学习冗余表示，因为它无法预测哪些神经元会可用。这阻止了「协同适应（co-adaptation）」——即神经元学会依赖特定的其他神经元存在。

集成（ensemble）解释：一个有 N 个神经元并带 dropout 的网络，会产生 2^N 个可能的子网络（每种神经元开/关的组合）。用 dropout 训练，约等于同时训练所有这 2^N 个子网络，每个子网络在不同的小批量上训练。在测试时，你使用全部神经元（不做 dropout），并把输出乘以 (1 - p) 来匹配训练期间的期望值。这等价于对 2^N 个子网络的预测求平均——从单个模型中得到一个庞大的集成。

在实践中，缩放是在训练期间而非测试期间应用的（反向 dropout，inverted dropout）：

```
During training:  output = activation(z) * mask / (1 - p)
During testing:   output = activation(z)   (no change needed)
```

这样更干净，因为测试代码完全不需要知道 dropout 的存在。

默认比率：transformer 用 p = 0.1，多层感知机（MLP）用 p = 0.5，卷积神经网络（CNN）用 p = 0.2-0.3。dropout 越高 = 正则化越强 = 欠拟合风险越大。

### 权重衰减（L2 正则化）

把所有权重的平方幅值加进损失里：

```
total_loss = task_loss + (lambda / 2) * sum(w_i^2)
```

正则项的梯度是 lambda * w。这意味着在每一步，每个权重都会按与其幅值成正比的比例朝零收缩。大权重受到的惩罚更重。模型被推向那种没有任何单个权重占主导地位的解。

它为什么有助于泛化：过拟合的模型往往拥有放大训练数据中噪声的大权重。权重衰减让权重保持较小，从而限制模型的有效容量，迫使它依赖鲁棒、可泛化的特征，而不是死记下来的怪异细节。

超参数 lambda 控制其强度。典型取值：

- transformer 上用 AdamW 时取 0.01
- CNN 上用 SGD 时取 1e-4
- 严重过拟合的模型取 0.1

正如第 06 课所讨论的：权重衰减和 L2 正则化在 SGD 中等价，但在 Adam 中不等价。用 Adam 训练时，请始终使用 AdamW（解耦的权重衰减，decoupled weight decay）。

### 批归一化

在把每一层的输出传给下一层之前，先在小批量（mini-batch）范围内对其做归一化。

对于某一层的一个小批量激活值：

```
mu = (1/B) * sum(x_i)           (batch mean)
sigma^2 = (1/B) * sum((x_i - mu)^2)   (batch variance)
x_hat = (x_i - mu) / sqrt(sigma^2 + eps)   (normalize)
y = gamma * x_hat + beta        (scale and shift)
```

Gamma 和 beta 是可学习参数，如果撤销归一化才是最优的，它们能让网络做到这一点。没有它们，你就是在强迫每一层的输出都变成零均值、单位方差，而这未必是网络想要的。

**训练与推理的区别：** 训练期间，mu 和 sigma 来自当前小批量。推理期间，你使用训练过程中累积的滑动平均（指数移动平均，momentum = 0.1，意即 90% 旧值 + 10% 新值）。

BatchNorm 为何有效，至今仍有争议。原始论文宣称它减少了「内部协变量偏移（internal covariate shift）」（随着前面的层更新，层输入的分布发生变化）。Santurkar 等人（2018）证明这种解释是错的。真正的原因是：BatchNorm 让损失曲面更平滑。梯度更具预测性，Lipschitz 常数更小，优化器能安全地迈出更大的步子。这就是为什么 BatchNorm 能让你使用更高的学习率并更快收敛。

BatchNorm 有一个根本性的局限：它依赖于批统计量。当批大小为 1 时，均值和方差毫无意义。当批量很小时（< 32），统计量噪声很大，会损害性能。这对目标检测（内存限制了批大小）和语言建模（序列长度各不相同）这类任务影响很大。

### 层归一化

在特征维度而非批维度上做归一化。对于单个样本：

```
mu = (1/D) * sum(x_j)           (feature mean)
sigma^2 = (1/D) * sum((x_j - mu)^2)   (feature variance)
x_hat = (x_j - mu) / sqrt(sigma^2 + eps)
y = gamma * x_hat + beta
```

D 是特征维度。每个样本独立归一化——不依赖批大小。这就是为什么 transformer 使用 LayerNorm 而非 BatchNorm。序列长度可变，批大小往往很小（生成时甚至为 1），而且训练与推理的计算完全相同。

transformer 中的 LayerNorm 应用在每个自注意力块和每个前馈块之后（Post-LN），或者应用在它们之前（Pre-LN，训练时更稳定）。

### RMSNorm

不做均值减法的 LayerNorm。由 Zhang 与 Sennrich（2019）提出。

```
rms = sqrt((1/D) * sum(x_j^2))
y = gamma * x / rms
```

就这么简单。没有均值计算，也没有 beta 参数。其观察是：LayerNorm 中的重新居中（均值减法）对模型性能贡献极小，却要消耗算力。去掉它能在大约少 10% 开销的情况下获得相同的准确率。

LLaMA、LLaMA 2、LLaMA 3、Mistral 以及大多数现代大语言模型都用 RMSNorm 而非 LayerNorm。在数十亿参数、数万亿 token 的规模下，那 10% 的节省非常可观。

### 归一化对比

```mermaid
graph TD
    subgraph "Batch Normalization"
        BN_D["Normalize across BATCH<br/>for each feature"]
        BN_S["Batch: [x1, x2, x3, x4]<br/>Feature 1: normalize [x1f1, x2f1, x3f1, x4f1]"]
        BN_P["Needs batch > 32<br/>Different train vs eval<br/>Used in CNNs"]
    end
    subgraph "Layer Normalization"
        LN_D["Normalize across FEATURES<br/>for each sample"]
        LN_S["Sample x1: normalize [f1, f2, f3, f4]"]
        LN_P["Batch-independent<br/>Same train vs eval<br/>Used in Transformers"]
    end
    subgraph "RMS Normalization"
        RN_D["Like LayerNorm<br/>but skip mean subtraction"]
        RN_S["Just divide by RMS<br/>No centering"]
        RN_P["10% faster than LayerNorm<br/>Same accuracy<br/>Used in LLaMA, Mistral"]
    end
```

### 作为正则化手段的数据增强

这不是对模型的修改，而是对数据的修改。在保持标签不变的前提下变换训练输入：

- 图像：随机裁剪、翻转、旋转、色彩抖动、cutout
- 文本：同义词替换、回译（back-translation）、随机删除
- 音频：时间拉伸、音高变换、加噪

其效果与正则化别无二致：它增大了训练集的有效规模，使模型更难记住具体的样本。一个只见过每张图原始形态一次的模型可以把它记住；一个见过每张图 50 个增强版本的模型，则被迫去学习不变的结构。

### 提前停止

最简单的正则化手段：当验证损失开始上升时停止训练。在那个时间点，模型尚未过拟合。实践中，你每个 epoch 都跟踪验证损失，保存最优模型，并在一个「耐心（patience）」窗口内继续训练（通常 5-20 个 epoch）。如果在耐心窗口内验证损失没有改善，就停止训练并加载保存的最优模型。

### 何时使用何种手段

```mermaid
flowchart TD
    Gap{"Train-test<br/>accuracy gap?"} -->|"> 10%"| Heavy["Heavy regularization"]
    Gap -->|"5-10%"| Medium["Moderate regularization"]
    Gap -->|"< 5%"| Light["Light regularization"]

    Heavy --> D5["Dropout p=0.3-0.5"]
    Heavy --> WD2["Weight decay 0.01-0.1"]
    Heavy --> Aug["Aggressive data augmentation"]
    Heavy --> ES["Early stopping"]

    Medium --> D3["Dropout p=0.1-0.2"]
    Medium --> WD1["Weight decay 0.001-0.01"]
    Medium --> Norm["BatchNorm or LayerNorm"]

    Light --> D1["Dropout p=0.05-0.1"]
    Light --> WD0["Weight decay 1e-4"]
```

## 动手构建

### 第 1 步：Dropout（训练模式与评估模式）

```python
import random
import math


class Dropout:
    def __init__(self, p=0.5):
        self.p = p
        self.training = True
        self.mask = None

    def forward(self, x):
        if not self.training:
            return list(x)
        self.mask = []
        output = []
        for val in x:
            if random.random() < self.p:
                self.mask.append(0)
                output.append(0.0)
            else:
                self.mask.append(1)
                output.append(val / (1 - self.p))
        return output

    def backward(self, grad_output):
        grads = []
        for g, m in zip(grad_output, self.mask):
            if m == 0:
                grads.append(0.0)
            else:
                grads.append(g / (1 - self.p))
        return grads
```

### 第 2 步：L2 权重衰减

```python
def l2_regularization(weights, lambda_reg):
    penalty = 0.0
    for w in weights:
        penalty += w * w
    return lambda_reg * 0.5 * penalty

def l2_gradient(weights, lambda_reg):
    return [lambda_reg * w for w in weights]
```

### 第 3 步：批归一化

```python
class BatchNorm:
    def __init__(self, num_features, momentum=0.1, eps=1e-5):
        self.gamma = [1.0] * num_features
        self.beta = [0.0] * num_features
        self.eps = eps
        self.momentum = momentum
        self.running_mean = [0.0] * num_features
        self.running_var = [1.0] * num_features
        self.training = True
        self.num_features = num_features

    def forward(self, batch):
        batch_size = len(batch)
        if self.training:
            mean = [0.0] * self.num_features
            for sample in batch:
                for j in range(self.num_features):
                    mean[j] += sample[j]
            mean = [m / batch_size for m in mean]

            var = [0.0] * self.num_features
            for sample in batch:
                for j in range(self.num_features):
                    var[j] += (sample[j] - mean[j]) ** 2
            var = [v / batch_size for v in var]

            for j in range(self.num_features):
                self.running_mean[j] = (1 - self.momentum) * self.running_mean[j] + self.momentum * mean[j]
                self.running_var[j] = (1 - self.momentum) * self.running_var[j] + self.momentum * var[j]
        else:
            mean = list(self.running_mean)
            var = list(self.running_var)

        self.x_hat = []
        output = []
        for sample in batch:
            normalized = []
            out_sample = []
            for j in range(self.num_features):
                x_h = (sample[j] - mean[j]) / math.sqrt(var[j] + self.eps)
                normalized.append(x_h)
                out_sample.append(self.gamma[j] * x_h + self.beta[j])
            self.x_hat.append(normalized)
            output.append(out_sample)
        return output
```

### 第 4 步：层归一化

```python
class LayerNorm:
    def __init__(self, num_features, eps=1e-5):
        self.gamma = [1.0] * num_features
        self.beta = [0.0] * num_features
        self.eps = eps
        self.num_features = num_features

    def forward(self, x):
        mean = sum(x) / len(x)
        var = sum((xi - mean) ** 2 for xi in x) / len(x)

        self.x_hat = []
        output = []
        for j in range(self.num_features):
            x_h = (x[j] - mean) / math.sqrt(var + self.eps)
            self.x_hat.append(x_h)
            output.append(self.gamma[j] * x_h + self.beta[j])
        return output
```

### 第 5 步：RMSNorm

```python
class RMSNorm:
    def __init__(self, num_features, eps=1e-6):
        self.gamma = [1.0] * num_features
        self.eps = eps
        self.num_features = num_features

    def forward(self, x):
        rms = math.sqrt(sum(xi * xi for xi in x) / len(x) + self.eps)
        output = []
        for j in range(self.num_features):
            output.append(self.gamma[j] * x[j] / rms)
        return output
```

### 第 6 步：带正则化与不带正则化的训练对比

```python
def sigmoid(x):
    x = max(-500, min(500, x))
    return 1.0 / (1.0 + math.exp(-x))


def make_circle_data(n=200, seed=42):
    random.seed(seed)
    data = []
    for _ in range(n):
        x = random.uniform(-2, 2)
        y = random.uniform(-2, 2)
        label = 1.0 if x * x + y * y < 1.5 else 0.0
        data.append(([x, y], label))
    return data


class RegularizedNetwork:
    def __init__(self, hidden_size=16, lr=0.05, dropout_p=0.0, weight_decay=0.0):
        random.seed(0)
        self.hidden_size = hidden_size
        self.lr = lr
        self.dropout_p = dropout_p
        self.weight_decay = weight_decay
        self.dropout = Dropout(p=dropout_p) if dropout_p > 0 else None

        self.w1 = [[random.gauss(0, 0.5) for _ in range(2)] for _ in range(hidden_size)]
        self.b1 = [0.0] * hidden_size
        self.w2 = [random.gauss(0, 0.5) for _ in range(hidden_size)]
        self.b2 = 0.0

    def forward(self, x, training=True):
        self.x = x
        self.z1 = []
        self.h = []
        for i in range(self.hidden_size):
            z = self.w1[i][0] * x[0] + self.w1[i][1] * x[1] + self.b1[i]
            self.z1.append(z)
            self.h.append(max(0.0, z))

        if self.dropout and training:
            self.dropout.training = True
            self.h = self.dropout.forward(self.h)
        elif self.dropout:
            self.dropout.training = False
            self.h = self.dropout.forward(self.h)

        self.z2 = sum(self.w2[i] * self.h[i] for i in range(self.hidden_size)) + self.b2
        self.out = sigmoid(self.z2)
        return self.out

    def backward(self, target):
        eps = 1e-15
        p = max(eps, min(1 - eps, self.out))
        d_loss = -(target / p) + (1 - target) / (1 - p)
        d_sigmoid = self.out * (1 - self.out)
        d_out = d_loss * d_sigmoid

        for i in range(self.hidden_size):
            d_relu = 1.0 if self.z1[i] > 0 else 0.0
            d_h = d_out * self.w2[i] * d_relu
            self.w2[i] -= self.lr * (d_out * self.h[i] + self.weight_decay * self.w2[i])
            for j in range(2):
                self.w1[i][j] -= self.lr * (d_h * self.x[j] + self.weight_decay * self.w1[i][j])
            self.b1[i] -= self.lr * d_h
        self.b2 -= self.lr * d_out

    def evaluate(self, data):
        correct = 0
        total_loss = 0.0
        for x, y in data:
            pred = self.forward(x, training=False)
            eps = 1e-15
            p = max(eps, min(1 - eps, pred))
            total_loss += -(y * math.log(p) + (1 - y) * math.log(1 - p))
            if (pred >= 0.5) == (y >= 0.5):
                correct += 1
        return total_loss / len(data), correct / len(data) * 100

    def train_model(self, train_data, test_data, epochs=300):
        history = []
        for epoch in range(epochs):
            total_loss = 0.0
            correct = 0
            for x, y in train_data:
                pred = self.forward(x, training=True)
                self.backward(y)
                eps = 1e-15
                p = max(eps, min(1 - eps, pred))
                total_loss += -(y * math.log(p) + (1 - y) * math.log(1 - p))
                if (pred >= 0.5) == (y >= 0.5):
                    correct += 1
            train_loss = total_loss / len(train_data)
            train_acc = correct / len(train_data) * 100
            test_loss, test_acc = self.evaluate(test_data)
            history.append((train_loss, train_acc, test_loss, test_acc))
            if epoch % 75 == 0 or epoch == epochs - 1:
                gap = train_acc - test_acc
                print(f"    Epoch {epoch:3d}: train_acc={train_acc:.1f}%, test_acc={test_acc:.1f}%, gap={gap:.1f}%")
        return history
```

## 实战应用

PyTorch 把所有归一化和正则化都提供为模块：

```python
import torch
import torch.nn as nn

model = nn.Sequential(
    nn.Linear(784, 256),
    nn.BatchNorm1d(256),
    nn.ReLU(),
    nn.Dropout(0.3),
    nn.Linear(256, 128),
    nn.BatchNorm1d(128),
    nn.ReLU(),
    nn.Dropout(0.3),
    nn.Linear(128, 10),
)

model.train()
out_train = model(torch.randn(32, 784))

model.eval()
out_test = model(torch.randn(1, 784))
```

`model.train()` / `model.eval()` 的切换至关重要。它开启/关闭 dropout，并告诉 BatchNorm 是使用批统计量还是滑动统计量。在推理前忘记调用 `model.eval()` 是深度学习中最常见的 bug 之一。你的测试准确率会随机波动，因为 dropout 仍在生效，而 BatchNorm 还在使用小批量统计量。

对于 transformer，模式有所不同：

```python
class TransformerBlock(nn.Module):
    def __init__(self, d_model=512, nhead=8, dropout=0.1):
        super().__init__()
        self.attention = nn.MultiheadAttention(d_model, nhead, dropout=dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.ff = nn.Sequential(
            nn.Linear(d_model, d_model * 4),
            nn.GELU(),
            nn.Linear(d_model * 4, d_model),
            nn.Dropout(dropout),
        )
        self.norm2 = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        attended, _ = self.attention(x, x, x)
        x = self.norm1(x + self.dropout(attended))
        x = self.norm2(x + self.ff(x))
        return x
```

用的是 LayerNorm，不是 BatchNorm。Dropout p=0.1，不是 p=0.5。这些都是 transformer 的默认值。

## 交付成果

本课产出：
- `outputs/prompt-regularization-advisor.md`——一个能诊断过拟合并推荐合适正则化策略的提示词

## 练习

1. 为二维数据实现「空间 dropout（spatial dropout）」：不是丢弃单个神经元，而是丢弃整个特征通道。可通过把若干连续特征视作通道、并整组丢弃来模拟这一过程。在 hidden_size=32 的圆形数据集上，将其训练—测试差距与标准 dropout 进行比较。

2. 把第 05 课的标签平滑（label smoothing）与本课的 dropout 结合实现。用四种配置训练：两者都不用、仅用 dropout、仅用标签平滑、两者都用。测量每种配置最终的训练—测试准确率差距。哪种组合给出最小的差距？

3. 在你的圆形数据集网络的隐藏层和激活函数之间加入一个 BatchNorm 层。在学习率 0.01、0.05 和 0.1 下，分别训练带 BatchNorm 和不带 BatchNorm 的版本。在原始网络会发散的更高学习率下，BatchNorm 应当能让训练保持稳定。

4. 实现提前停止：每个 epoch 跟踪测试损失，保存最优权重，如果测试损失连续 20 个 epoch 没有改善就停止。把正则化网络运行 1000 个 epoch。报告哪个 epoch 取得了最佳测试准确率，以及你节省了多少个 epoch 的计算量。

5. 在一个 4 层网络（不只是 2 层）上比较 LayerNorm 与 RMSNorm。用相同的权重初始化两者。训练 200 个 epoch，比较最终准确率、训练速度（每个 epoch 用时）以及第一层的梯度幅值。验证 RMSNorm 在相同准确率下速度更快。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|----------------------|
| 过拟合（Overfitting） | 「模型把数据背下来了」 | 当模型的训练表现显著超过其测试表现时，说明它学到的是噪声而非信号 |
| 正则化（Regularization） | 「防止过拟合」 | 任何约束模型复杂度以提升泛化能力的技术：dropout、权重衰减、归一化、数据增强 |
| Dropout | 「随机删除神经元」 | 训练期间以概率 p 把随机神经元置零，迫使形成冗余表示；等价于训练一个集成 |
| 权重衰减（Weight decay） | 「L2 惩罚」 | 在每一步通过减去 lambda * w 让所有权重朝零收缩；通过权重幅值来惩罚复杂度 |
| 批归一化（Batch normalization） | 「按批做归一化」 | 在批维度上对层输出做归一化，训练期间用批统计量、推理期间用滑动平均 |
| 层归一化（Layer normalization） | 「按样本做归一化」 | 在每个样本内部跨特征做归一化；与批无关，用于批大小可变的 transformer |
| RMSNorm | 「去掉均值的 LayerNorm」 | 均方根归一化；从 LayerNorm 中去掉均值减法，在准确率相同的前提下提速 10% |
| 提前停止（Early stopping） | 「在过拟合前停下」 | 当验证损失停止改善时中止训练；最简单的正则化手段，常与其他手段配合使用 |
| 数据增强（Data augmentation） | 「以少生多」 | 变换训练输入（翻转、裁剪、加噪）以增大有效数据集规模，迫使模型学习不变性 |
| 泛化差距（Generalization gap） | 「训练—测试之差」 | 训练表现与测试表现之间的差异；正则化的目标就是最小化这个差距 |

## 延伸阅读

- Srivastava 等人，《Dropout: A Simple Way to Prevent Neural Networks from Overfitting》（2014）——dropout 的原始论文，包含集成解释和大量实验
- Ioffe 与 Szegedy，《Batch Normalization: Accelerating Deep Network Training by Reducing Internal Covariate Shift》（2015）——引入了 BatchNorm 及其训练流程，是被引用最多的深度学习论文之一
- Zhang 与 Sennrich，《Root Mean Square Layer Normalization》（2019）——证明了 RMSNorm 在减少计算量的同时能达到与 LayerNorm 相当的准确率；被 LLaMA 和 Mistral 采用
- Zhang 等人，《Understanding Deep Learning Requires Rethinking Generalization》（2017）——里程碑式论文，展示神经网络能记住随机标签，挑战了传统的泛化观念
