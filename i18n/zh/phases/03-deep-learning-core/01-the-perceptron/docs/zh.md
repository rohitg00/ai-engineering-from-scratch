# 感知机

> 感知机是神经网络的原子。把它拆开，你会发现权重、偏置和一个决策。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 1 (Linear Algebra Intuition)
**Time:** ~60 minutes

## 学习目标

- 用 Python 从零实现一个感知机，包括权重更新规则和阶跃激活函数
- 解释为什么单个感知机只能解决线性可分问题，并演示 XOR 失败案例
- 通过组合 OR、NAND 和 AND 门构建多层感知机来解决 XOR
- 训练一个带 sigmoid 激活和反向传播的两层网络，自动学习 XOR

## 问题

你已经了解向量和点积。你也知道矩阵可以把输入变换为输出。但机器是如何*学习*该使用哪种变换的？

感知机回答了这个问题。它是最简单的学习机器：接收一些输入，乘以权重，加上偏置，然后做出二元决策。接着进行调整。就这么简单。迄今构建的每一个神经网络都是把这一想法层层堆叠而成。

理解感知机，就意味着理解“学习”在代码中究竟意味着什么：不断调整数字，直到输出与现实相符。

## 概念

### 一个神经元，一个决策

感知机接收 n 个输入，将每个输入乘以一个权重，求和，加上偏置，再把结果通过一个激活函数。

```mermaid
graph LR
    x1["x1"] -- "w1" --> sum["Σ(wi*xi) + b"]
    x2["x2"] -- "w2" --> sum
    x3["x3"] -- "w3" --> sum
    bias["bias"] --> sum
    sum --> step["step(z)"]
    step --> out["output (0 or 1)"]
```

阶跃函数非常直接：如果加权和加上偏置 >= 0,输出 1。否则输出 0。

```
step(z) = 1  if z >= 0
           0  if z < 0
```

这是一个线性分类器。权重和偏置定义了一条直线(在高维空间中是超平面)，将输入空间分成两个区域。

### 决策边界

对于两个输入，感知机在二维空间中画出一条直线：

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

直线一侧的所有点输出 0。另一侧的所有点输出 1。训练的过程就是移动这条直线，直到它正确地分开两类。

### 学习规则

感知机学习规则很简单：

```
For each training example (x, y_true):
    y_pred = predict(x)
    error = y_true - y_pred

    For each weight:
        w_i = w_i + learning_rate * error * x_i
    bias = bias + learning_rate * error
```

如果预测正确，误差 = 0,什么都不变。如果预测为 0 但应为 1,权重增大。如果预测为 1 但应为 0,权重减小。学习率控制每次调整的幅度。

### XOR 问题

问题在这里出现了。看看这些逻辑门：

```
AND gate:           OR gate:            XOR gate:
x1  x2  out         x1  x2  out         x1  x2  out
0   0   0           0   0   0           0   0   0
0   1   0           0   1   1           0   1   1
1   0   0           1   0   1           1   0   1
1   1   1           1   1   1           1   1   0
```

AND 和 OR 是线性可分的：你可以画出一条直线把 0 和 1 分开。XOR 不是。没有任何一条直线能把 [0,1] 和 [1,0] 与 [0,0] 和 [1,1] 分开。

```
AND (separable):        XOR (not separable):

  x2                      x2
  1 ┤  0     1            1 ┤  1     0
    │     /                 │
  0 ┤  0 / 0              0 ┤  0     1
    ┼──/──────── x1         ┼──────────── x1
       line works!          no single line works!
```

这是一个根本性的限制。单个感知机只能解决线性可分问题。Minsky 和 Papert 在 1969 年证明了这一点，这使得神经网络研究几乎停滞了十年。

解决办法：把感知机堆叠成层。多层感知机可以通过把两个线性决策组合成一个非线性决策来解决 XOR。

```figure
perceptron-boundary
```

## 动手实现

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

### 第 3 步：观察 XOR 失败

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

它永远不会收敛。这就是单个感知机无法学习 XOR 的有力证明。

### 第 4 步：用两层解决 XOR

技巧在于：XOR = (x1 OR x2) AND NOT (x1 AND x2)。组合三个感知机：

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

四种情况全部正确。将感知机堆叠成层，可以产生单个感知机无法产生的决策边界。

### 第 5 步：训练一个两层网络

第 4 步是手工设定权重。这对 XOR 有效，但对于你事先不知道正确权重的真实问题则行不通。解决办法：用 sigmoid 替换阶跃函数，并通过反向传播自动学习权重。

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

与第 4 步有两个关键区别。第一，sigmoid 替换了阶跃函数——它是平滑的，因此梯度存在。第二，`train` 方法将误差从输出层向后传播到隐藏层，按照每个权重对误差的贡献比例进行调整。这就是 20 行代码实现的反向传播。

这是通往第 03 课的桥梁。`d_output` 和 `hidden_deltas` 背后的数学是对网络图应用链式法则。我们将在那一课中正式推导它。

## 使用它

你刚刚从零构建的一切，都可以通过一次导入获得：

```python
from sklearn.linear_model import Perceptron as SkPerceptron
import numpy as np

X = np.array([[0,0],[0,1],[1,0],[1,1]])
y = np.array([0, 0, 0, 1])

clf = SkPerceptron(max_iter=100, tol=1e-3)
clf.fit(X, y)
print([clf.predict([x])[0] for x in X])
```

五行代码。你的 30 行 `Perceptron` 类做着同样的事情。sklearn 版本增加了收敛检查、多种损失函数和稀疏输入支持——但核心循环完全相同：加权和、阶跃函数、根据误差更新权重。

真正的差距体现在规模上。生产级网络中的变化：

- 阶跃函数被 sigmoid、ReLU 或其他平滑激活函数取代
- 权重通过反向传播自动学习(第 03 课)
- 层数更深：3 层、10 层、100 层以上
- 同样的原理仍然成立：每一层根据上一层的输出创建新的特征

单个感知机只能画出直线。把它们堆叠起来，你就能画出任意形状。

## 交付成果

本课产出：
- `outputs/skill-perceptron.md` - 一项关于何时需要单层与多层架构的技能

## 练习

1. 在 NAND 门(通用门——任何逻辑电路都可以由 NAND 构建)上训练一个感知机。验证它的权重和偏置构成一个有效的决策边界。
2. 修改 Perceptron 类，在每个 epoch 中跟踪决策边界 (w1*x1 + w2*x2 + b = 0)。打印在 AND 门训练过程中这条直线如何移动。
3. 构建一个 3 输入感知机，只有当 3 个输入中至少有 2 个为 1 时才输出 1(多数表决函数)。这是线性可分的吗？为什么？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| 感知机 | “一个模拟的神经元” | 一个线性分类器：输入与权重的点积，加上偏置，通过阶跃函数 |
| 权重 | “某个输入有多重要” | 一个乘数，缩放每个输入对决策的贡献 |
| 偏置 | “阈值” | 一个平移决策边界的常数，使感知机即使在输入全为零时也能激活 |
| 激活函数 | “压缩数值的东西” | 在加权和之后应用的函数——感知机用阶跃函数，现代网络用 sigmoid/ReLU |
| 线性可分 | “你可以在它们之间画一条线” | 一个数据集，其中单个超平面可以完美地分开各个类别 |
| XOR 问题 | “感知机做不到的事” | 证明单层网络无法学习非线性可分函数 |
| 决策边界 | “分类器切换的地方” | 将输入空间划分为两类的超平面 w*x + b = 0 |
| 多层感知机 | “一个真正的神经网络” | 堆叠成层的感知机，每层的输出作为下一层的输入 |

## 延伸阅读

- Frank Rosenblatt,“The Perceptron: A Probabilistic Model for Information Storage and Organization in the Brain”(1958)——开启这一切的原始论文
- Minsky & Papert,"Perceptrons"(1969)——这本书证明了单层网络无法解决 XOR,使感知机研究停滞了十年
- Michael Nielsen,"Neural Networks and Deep Learning",第 1 章(http://neuralnetworksanddeeplearning.com/)——免费在线，关于感知机如何组合成网络的最佳可视化讲解