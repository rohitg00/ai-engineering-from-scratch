# 01 · 感知机

> 感知机是神经网络的原子。把它剖开，你会看到权重、偏置，以及一次决策。

**类型：** 动手构建
**语言：** Python
**前置：** 阶段 1（线性代数直觉）
**时长：** 约 60 分钟

## 学习目标

- 用 Python 从零实现一个「感知机（perceptron）」，包括权重更新规则与阶跃激活函数
- 解释为什么单个感知机只能解决线性可分问题，并演示 XOR 失败的案例
- 通过组合 OR、NAND 和 AND 门，构造一个「多层感知机（multi-layer perceptron）」来解决 XOR
- 用带「Sigmoid（sigmoid）」激活和「反向传播（backpropagation）」的两层网络，自动学会 XOR

## 问题所在

你已经懂向量和点积，也知道矩阵能把输入变换为输出。但机器究竟是如何*学习*该用哪种变换的？

感知机给出了答案。它是最简单的学习机器：取若干输入，乘以权重，加上偏置，然后做一次二元决策。接着进行调整。仅此而已。有史以来构建的每一个神经网络，都是把这个思想一层层堆叠起来的产物。

理解感知机，意味着理解「学习」在代码中究竟意味着什么：不断调整数字，直到输出与现实相符。

## 核心概念

### 一个神经元，一次决策

感知机接收 n 个输入，将每个输入乘以一个权重，求和，加上偏置，再把结果传入一个激活函数。

```mermaid
graph LR
    x1["x1"] -- "w1" --> sum["Σ(wi*xi) + b"]
    x2["x2"] -- "w2" --> sum
    x3["x3"] -- "w3" --> sum
    bias["bias"] --> sum
    sum --> step["step(z)"]
    step --> out["output (0 or 1)"]
```

阶跃函数非常粗暴：如果加权和加上偏置 >= 0，则输出 1；否则输出 0。

```
step(z) = 1  if z >= 0
           0  if z < 0
```

这是一个线性分类器。权重与偏置定义了一条直线（在更高维度中则是超平面），它把输入空间分割成两个区域。

### 决策边界

对于两个输入，感知机会在二维空间中画出一条直线：

```
  x2
  ┤
  │  Class 1        /
  │    (0)          /
  │                /
  │               / w1·x1 + w2·x2 + b = 0
  │              /
  │             /     Class 2
  │            /        (1)
  ┼───────────/──────────── x1
```

直线一侧的所有点输出 0，另一侧的所有点输出 1。训练就是不断移动这条直线，直到它能正确地把两个类别分开。

### 学习规则

感知机的学习规则很简单：

```
For each training example (x, y_true):
    y_pred = predict(x)
    error = y_true - y_pred

    For each weight:
        w_i = w_i + learning_rate * error * x_i
    bias = bias + learning_rate * error
```

如果预测正确，error = 0，什么都不变。如果它预测为 0 但本应为 1，权重就增大；如果它预测为 1 但本应为 0，权重就减小。学习率控制着每次调整的幅度大小。

### XOR 问题

问题就出在这里。看看下面这些逻辑门：

```
AND gate:           OR gate:            XOR gate:
x1  x2  out         x1  x2  out         x1  x2  out
0   0   0           0   0   0           0   0   0
0   1   0           0   1   1           0   1   1
1   0   0           1   0   1           1   0   1
1   1   1           1   1   1           1   1   0
```

AND 和 OR 是线性可分的：你可以画出一条直线，把 0 与 1 分开。而 XOR 不行。没有任何一条直线能把 [0,1] 和 [1,0] 与 [0,0] 和 [1,1] 分隔开。

```
AND (separable):        XOR (not separable):

  x2                      x2
  1 ┤  0     1            1 ┤  1     0
    │     /                 │
  0 ┤  0 / 0              0 ┤  0     1
    ┼──/──────── x1         ┼──────────── x1
       line works!          no single line works!
```

这是一个根本性的限制。单个感知机只能解决线性可分问题。Minsky 和 Papert 在 1969 年证明了这一点，这一结论几乎使神经网络研究停滞了整整十年。

解决之道：把感知机堆叠成多层。多层感知机能够通过把两个线性决策组合成一个非线性决策，从而解决 XOR。

## 动手构建

### 第 1 步：Perceptron 类

```python
class Perceptron:
    def __init__(self, n_inputs, learning_rate=0.1):
        self.weights = [0.0] * n_inputs
        self.bias = 0.0
        self.lr = learning_rate

    def predict(self, inputs):
        total = sum(w * x for w, x in zip(self.weights, inputs))
        total += self.bias
        return 1 if total >= 0 else 0

    def train(self, training_data, epochs=100):
        for epoch in range(epochs):
            errors = 0
            for inputs, target in training_data:
                prediction = self.predict(inputs)
                error = target - prediction
                if error != 0:
                    errors += 1
                    for i in range(len(self.weights)):
                        self.weights[i] += self.lr * error * inputs[i]
                    self.bias += self.lr * error
            if errors == 0:
                print(f"Converged at epoch {epoch + 1}")
                return
        print(f"Did not converge after {epochs} epochs")
```

### 第 2 步：在逻辑门上训练

```python
and_data = [
    ([0, 0], 0),
    ([0, 1], 0),
    ([1, 0], 0),
    ([1, 1], 1),
]

or_data = [
    ([0, 0], 0),
    ([0, 1], 1),
    ([1, 0], 1),
    ([1, 1], 1),
]

not_data = [
    ([0], 1),
    ([1], 0),
]

print("=== AND Gate ===")
p_and = Perceptron(2)
p_and.train(and_data)
for inputs, _ in and_data:
    print(f"  {inputs} -> {p_and.predict(inputs)}")

print("\n=== OR Gate ===")
p_or = Perceptron(2)
p_or.train(or_data)
for inputs, _ in or_data:
    print(f"  {inputs} -> {p_or.predict(inputs)}")

print("\n=== NOT Gate ===")
p_not = Perceptron(1)
p_not.train(not_data)
for inputs, _ in not_data:
    print(f"  {inputs} -> {p_not.predict(inputs)}")
```

### 第 3 步：观察 XOR 如何失败

```python
xor_data = [
    ([0, 0], 0),
    ([0, 1], 1),
    ([1, 0], 1),
    ([1, 1], 0),
]

print("\n=== XOR Gate (single perceptron) ===")
p_xor = Perceptron(2)
p_xor.train(xor_data, epochs=1000)
for inputs, expected in xor_data:
    result = p_xor.predict(inputs)
    status = "OK" if result == expected else "WRONG"
    print(f"  {inputs} -> {result} (expected {expected}) {status}")
```

它永远无法收敛。这是单个感知机无法学习 XOR 的硬证据。

### 第 4 步：用两层网络解决 XOR

诀窍在于：XOR = (x1 OR x2) AND NOT (x1 AND x2)。把三个感知机组合起来：

```mermaid
graph LR
    x1["x1"] --> OR["OR neuron"]
    x1 --> NAND["NAND neuron"]
    x2["x2"] --> OR
    x2 --> NAND
    OR --> AND["AND neuron"]
    NAND --> AND
    AND --> out["output"]
```

```python
def xor_network(x1, x2):
    or_neuron = Perceptron(2)
    or_neuron.weights = [1.0, 1.0]
    or_neuron.bias = -0.5

    nand_neuron = Perceptron(2)
    nand_neuron.weights = [-1.0, -1.0]
    nand_neuron.bias = 1.5

    and_neuron = Perceptron(2)
    and_neuron.weights = [1.0, 1.0]
    and_neuron.bias = -1.5

    hidden1 = or_neuron.predict([x1, x2])
    hidden2 = nand_neuron.predict([x1, x2])
    output = and_neuron.predict([hidden1, hidden2])
    return output


print("\n=== XOR Gate (multi-layer network) ===")
for inputs, expected in xor_data:
    result = xor_network(inputs[0], inputs[1])
    print(f"  {inputs} -> {result} (expected {expected})")
```

四种情况全部正确。把感知机堆叠成多层，便能产生任何单个感知机都无法产生的决策边界。

### 第 5 步：训练一个两层网络

第 4 步是手工写死了权重。这对 XOR 行得通，但对那些事先并不知道正确权重的真实问题就行不通了。解决之道：用 Sigmoid 替换阶跃函数，并通过反向传播自动学习权重。

```python
class TwoLayerNetwork:
    def __init__(self, learning_rate=0.5):
        import random
        random.seed(0)
        self.w_hidden = [[random.uniform(-1, 1), random.uniform(-1, 1)] for _ in range(2)]
        self.b_hidden = [random.uniform(-1, 1), random.uniform(-1, 1)]
        self.w_output = [random.uniform(-1, 1), random.uniform(-1, 1)]
        self.b_output = random.uniform(-1, 1)
        self.lr = learning_rate

    def sigmoid(self, x):
        import math
        x = max(-500, min(500, x))
        return 1.0 / (1.0 + math.exp(-x))

    def forward(self, inputs):
        self.inputs = inputs
        self.hidden_outputs = []
        for i in range(2):
            z = sum(w * x for w, x in zip(self.w_hidden[i], inputs)) + self.b_hidden[i]
            self.hidden_outputs.append(self.sigmoid(z))
        z_out = sum(w * h for w, h in zip(self.w_output, self.hidden_outputs)) + self.b_output
        self.output = self.sigmoid(z_out)
        return self.output

    def train(self, training_data, epochs=10000):
        for epoch in range(epochs):
            total_error = 0
            for inputs, target in training_data:
                output = self.forward(inputs)
                error = target - output
                total_error += error ** 2

                d_output = error * output * (1 - output)

                saved_w_output = self.w_output[:]
                hidden_deltas = []
                for i in range(2):
                    h = self.hidden_outputs[i]
                    hd = d_output * saved_w_output[i] * h * (1 - h)
                    hidden_deltas.append(hd)

                for i in range(2):
                    self.w_output[i] += self.lr * d_output * self.hidden_outputs[i]
                self.b_output += self.lr * d_output

                for i in range(2):
                    for j in range(len(inputs)):
                        self.w_hidden[i][j] += self.lr * hidden_deltas[i] * inputs[j]
                    self.b_hidden[i] += self.lr * hidden_deltas[i]
```

```python
net = TwoLayerNetwork(learning_rate=2.0)
net.train(xor_data, epochs=10000)
for inputs, expected in xor_data:
    result = net.forward(inputs)
    predicted = 1 if result >= 0.5 else 0
    print(f"  {inputs} -> {result:.4f} (rounded: {predicted}, expected {expected})")
```

与第 4 步相比有两处关键区别。第一，Sigmoid 替换了阶跃函数——它是平滑的，因此梯度存在。第二，`train` 方法会把误差从输出层反向传播到隐藏层，按每个权重对误差的贡献程度成比例地进行调整。这就是 20 行代码写成的反向传播。

这是通向第 03 课的桥梁。`d_output` 和 `hidden_deltas` 背后的数学，就是应用在网络图上的链式法则。我们会在那一课里正式推导它。

## 上手使用

你刚刚从零构建的一切，只需一行 import 就已存在：

```python
from sklearn.linear_model import Perceptron as SkPerceptron
import numpy as np

X = np.array([[0,0],[0,1],[1,0],[1,1]])
y = np.array([0, 0, 0, 1])

clf = SkPerceptron(max_iter=100, tol=1e-3)
clf.fit(X, y)
print([clf.predict([x])[0] for x in X])
```

五行代码。你那个 30 行的 `Perceptron` 类做的是同一件事。sklearn 版本额外增加了收敛检查、多种损失函数以及稀疏输入支持——但其核心循环是完全相同的：加权求和、阶跃函数、在出错时更新权重。

真正的差距体现在规模上。在生产级网络中会发生哪些变化：

- 阶跃函数变成 Sigmoid、ReLU 或其他平滑激活函数
- 权重通过反向传播自动学习（第 03 课）
- 网络层数变得更深：3 层、10 层、100 层以上
- 同样的原理依然成立：每一层都从上一层的输出中创造出新的特征

单个感知机只能画直线。把它们堆叠起来，你就能画出任意形状。

## 交付产物

本课产出：
- `outputs/skill-perceptron.md`——一份技能文档，讲解何时需要单层架构、何时需要多层架构

## 练习

1. 在 NAND 门上训练一个感知机（NAND 是通用门——任何逻辑电路都可以由 NAND 构建）。验证其权重和偏置构成一个有效的决策边界。
2. 修改 Perceptron 类，使其在每个 epoch 都追踪决策边界（w1*x1 + w2*x2 + b = 0）。打印出在 AND 门上训练时这条直线是如何移动的。
3. 构建一个三输入感知机，仅当三个输入中至少有 2 个为 1 时才输出 1（一个多数表决函数）。这是否线性可分？为什么？

## 关键术语

| 术语 | 人们通常的说法 | 它实际的含义 |
|------|----------------|----------------------|
| 感知机（Perceptron） | "一个假的神经元" | 一个线性分类器：输入与权重的点积，加上偏置，再经过一个阶跃函数 |
| 权重（Weight） | "一个输入有多重要" | 一个乘数，用于缩放每个输入对决策的贡献 |
| 偏置（Bias） | "阈值" | 一个常数，用于平移决策边界，使感知机即便在输入全为零时也能被激活 |
| 激活函数（Activation function） | "把数值压扁的那个东西" | 在加权求和之后应用的函数——感知机用阶跃函数，现代网络用 sigmoid/ReLU |
| 线性可分（Linearly separable） | "你能在它们之间画一条线" | 一个数据集，其中单个超平面就能完美地分开各个类别 |
| XOR 问题（XOR problem） | "感知机做不到的那件事" | 证明单层网络无法学习非线性可分函数的例证 |
| 决策边界（Decision boundary） | "分类器切换的地方" | 把输入空间划分为两个类别的超平面 w*x + b = 0 |
| 多层感知机（Multi-layer perceptron） | "一个真正的神经网络" | 分层堆叠的感知机，其中每一层的输出馈入下一层的输入 |

## 延伸阅读

- Frank Rosenblatt，《The Perceptron: A Probabilistic Model for Information Storage and Organization in the Brain》（1958）——开创这一切的原始论文
- Minsky & Papert，《Perceptrons》（1969）——证明了 XOR 无法被单层网络求解、并使感知机研究停滞了十年的著作
- Michael Nielsen，《Neural Networks and Deep Learning》，第 1 章（http://neuralnetworksanddeeplearning.com/）——免费在线阅读，对感知机如何组合成网络给出了最佳的可视化讲解
