# 10 · 构建你自己的迷你框架

> 你已经构建了神经元、层、网络、反向传播、激活函数、损失函数、优化器、正则化、初始化以及学习率调度。它们都是彼此独立的零件。现在，把它们组装成一个框架。不是 PyTorch，也不是 TensorFlow，而是你自己的框架。

**类型：** 构建
**语言：** Python
**前置：** 阶段 03 全部内容（第 01-09 课）
**时长：** 约 120 分钟

## 学习目标

- 构建一个完整的深度学习框架（约 500 行），包含 Module、Linear、ReLU、Sigmoid、Dropout、BatchNorm、Sequential、损失函数、优化器以及 DataLoader
- 解释「模块抽象（Module abstraction）」（forward、backward、parameters），以及为什么需要在训练模式与评估模式之间切换
- 把所有组件组装成一个可工作的训练循环，在「圆形分类（circle classification）」任务上训练一个 4 层网络
- 把你框架中的每个组件与其 PyTorch 对应物建立映射（nn.Module、nn.Sequential、optim.Adam、DataLoader）

## 问题所在

你有十节课的构件，散落在一个个独立的文件里。这里一个 `Value` 类，那里一个训练循环，权重初始化在另一个文件，学习率调度又在别处。要训练一个网络，你得从五个不同的课程里复制粘贴，再手动把它们拼接起来。

这正是框架所要解决的问题。PyTorch 给了你 `nn.Module`、`nn.Sequential`、`optim.Adam`、`DataLoader`，以及一套把它们串联起来的训练循环范式。TensorFlow 给了你 `keras.Layer`、`keras.Sequential`、`keras.optimizers.Adam`。这些都不是魔法。它们只是一套组织模式，让你能够定义、训练和评估网络，而不必每次都重新发明那套底层管道。

你将要用约 500 行 Python 构建同样的东西。不用 numpy，不用任何外部依赖。一个能定义任意前馈网络、用 SGD 或 Adam 训练它、对数据分批、应用 dropout 与批归一化、使用任意激活函数并调度学习率的框架。

完成之后，你将切实理解当你在 PyTorch 里写下 `model = nn.Sequential(...)` 时究竟发生了什么。你会理解为什么会有 `model.train()` 和 `model.eval()`。你会理解为什么 `optimizer.zero_grad()` 要单独调用。这一切你都会理解，因为这一切都是你亲手构建的。

## 核心概念

### 模块抽象

PyTorch 中的每一层都继承自 `nn.Module`。一个 Module 有三项职责：

1. **forward()** —— 给定输入，计算输出
2. **parameters()** —— 返回所有可训练的权重
3. **backward()** —— 计算梯度（在 PyTorch 中由 autograd 处理，在我们的框架中则显式实现）

Linear 层是一个 Module。ReLU 激活是一个 Module。dropout 层是一个 Module。批归一化层也是一个 Module。它们都拥有相同的接口。

### Sequential 容器

`nn.Sequential` 把多个 Module 串联起来。前向传播：把数据依次喂给 Module 1、Module 2、Module 3。反向传播：沿着链条反向走。容器本身也是一个 Module —— 它有 forward()、parameters() 和 backward()。这就是「组合模式（composite pattern）」：一串 Module 本身也是一个 Module。

### 训练模式与评估模式

Dropout 在训练时随机将神经元置零，但在评估时让一切原样通过。批归一化在训练时使用批统计量，在评估时则使用滑动平均。`train()` 和 `eval()` 方法切换这种行为。每个 Module 都有一个 `training` 标志位。

### 优化器

优化器用参数的梯度来更新参数。SGD：`param -= lr * grad`。Adam：维护动量和方差的估计量，然后进行更新。优化器并不了解网络的架构 —— 它只看到一个扁平的参数列表及其梯度。

### DataLoader

分批之所以重要，有两个原因。第一，对于大型问题，你无法把整个数据集放进内存。第二，小批量梯度下降会带来噪声，有助于跳出局部极小值。DataLoader 把数据切分成批次，并可选地在每个 epoch 之间打乱顺序。

### 框架架构

```mermaid
graph TD
    subgraph "Modules"
        Linear["Linear<br/>W*x + b"]
        ReLU["ReLU<br/>max(0, x)"]
        Sigmoid["Sigmoid<br/>1/(1+e^-x)"]
        Dropout["Dropout<br/>random zero mask"]
        BatchNorm["BatchNorm<br/>normalize activations"]
    end

    subgraph "Containers"
        Sequential["Sequential<br/>chains modules"]
    end

    subgraph "Loss Functions"
        MSE["MSELoss<br/>(pred - target)^2"]
        BCE["BCELoss<br/>binary cross-entropy"]
    end

    subgraph "Optimizers"
        SGD["SGD<br/>param -= lr * grad"]
        Adam["Adam<br/>adaptive moments"]
    end

    subgraph "Data"
        DataLoader["DataLoader<br/>batching + shuffle"]
    end

    Sequential --> |"contains"| Linear
    Sequential --> |"contains"| ReLU
    Sequential --> |"forward/backward"| MSE
    SGD --> |"updates"| Sequential
    DataLoader --> |"feeds"| Sequential
```

### 训练循环

```mermaid
sequenceDiagram
    participant DL as DataLoader
    participant M as Model
    participant L as Loss
    participant O as Optimizer

    loop Each Epoch
        DL->>M: batch of inputs
        M->>M: forward pass (layer by layer)
        M->>L: predictions
        L->>L: compute loss
        L->>M: backward pass (gradients)
        M->>O: parameters + gradients
        O->>M: updated parameters
        O->>O: zero gradients
    end
```

### Module 层级关系

```mermaid
classDiagram
    class Module {
        +forward(x)
        +backward(grad)
        +parameters()
        +train()
        +eval()
    }

    class Linear {
        -weights
        -biases
        +forward(x)
        +backward(grad)
    }

    class ReLU {
        +forward(x)
        +backward(grad)
    }

    class Sequential {
        -modules[]
        +forward(x)
        +backward(grad)
        +parameters()
    }

    Module <|-- Linear
    Module <|-- ReLU
    Module <|-- Sequential
    Sequential *-- Module
```

## 动手构建

### 第 1 步：Module 基类

每一层都要实现的抽象接口。

```python
class Module:
    def __init__(self):
        self.training = True

    def forward(self, x):
        raise NotImplementedError

    def backward(self, grad):
        raise NotImplementedError

    def parameters(self):
        return []

    def train(self):
        self.training = True

    def eval(self):
        self.training = False
```

### 第 2 步：Linear 层

最基础的构件。它存储权重和偏置，前向计算 Wx + b，反向计算权重梯度和输入梯度。

```python
import math
import random


class Linear(Module):
    def __init__(self, fan_in, fan_out):
        super().__init__()
        std = math.sqrt(2.0 / fan_in)
        self.weights = [[random.gauss(0, std) for _ in range(fan_in)] for _ in range(fan_out)]
        self.biases = [0.0] * fan_out
        self.weight_grads = [[0.0] * fan_in for _ in range(fan_out)]
        self.bias_grads = [0.0] * fan_out
        self.fan_in = fan_in
        self.fan_out = fan_out
        self.input = None

    def forward(self, x):
        self.input = x
        output = []
        for i in range(self.fan_out):
            val = self.biases[i]
            for j in range(self.fan_in):
                val += self.weights[i][j] * x[j]
            output.append(val)
        return output

    def backward(self, grad):
        input_grad = [0.0] * self.fan_in
        for i in range(self.fan_out):
            self.bias_grads[i] += grad[i]
            for j in range(self.fan_in):
                self.weight_grads[i][j] += grad[i] * self.input[j]
                input_grad[j] += grad[i] * self.weights[i][j]
        return input_grad

    def parameters(self):
        params = []
        for i in range(self.fan_out):
            for j in range(self.fan_in):
                params.append((self.weights, i, j, self.weight_grads))
            params.append((self.biases, i, None, self.bias_grads))
        return params
```

### 第 3 步：激活模块

把 ReLU、Sigmoid 和 Tanh 作为 Module 实现。每个模块都缓存反向传播所需的内容。

```python
class ReLU(Module):
    def __init__(self):
        super().__init__()
        self.mask = None

    def forward(self, x):
        self.mask = [1.0 if v > 0 else 0.0 for v in x]
        return [max(0.0, v) for v in x]

    def backward(self, grad):
        return [g * m for g, m in zip(grad, self.mask)]


class Sigmoid(Module):
    def __init__(self):
        super().__init__()
        self.output = None

    def forward(self, x):
        self.output = []
        for v in x:
            v = max(-500, min(500, v))
            self.output.append(1.0 / (1.0 + math.exp(-v)))
        return self.output

    def backward(self, grad):
        return [g * o * (1 - o) for g, o in zip(grad, self.output)]


class Tanh(Module):
    def __init__(self):
        super().__init__()
        self.output = None

    def forward(self, x):
        self.output = [math.tanh(v) for v in x]
        return self.output

    def backward(self, grad):
        return [g * (1 - o * o) for g, o in zip(grad, self.output)]
```

### 第 4 步：Dropout 模块

在训练时随机将元素置零。把保留下来的元素按 1/(1-p) 缩放，使其期望值保持不变。在评估模式下什么都不做。

```python
class Dropout(Module):
    def __init__(self, p=0.5):
        super().__init__()
        self.p = p
        self.mask = None

    def forward(self, x):
        if not self.training:
            return x
        self.mask = [0.0 if random.random() < self.p else 1.0 / (1 - self.p) for _ in x]
        return [v * m for v, m in zip(x, self.mask)]

    def backward(self, grad):
        if self.mask is None:
            return grad
        return [g * m for g, m in zip(grad, self.mask)]
```

### 第 5 步：BatchNorm 模块

按特征维度，在整个批次上把激活值归一化为零均值、单位方差。维护滑动统计量供评估模式使用。

```python
class BatchNorm(Module):
    def __init__(self, size, momentum=0.1, eps=1e-5):
        super().__init__()
        self.size = size
        self.gamma = [1.0] * size
        self.beta = [0.0] * size
        self.gamma_grads = [0.0] * size
        self.beta_grads = [0.0] * size
        self.running_mean = [0.0] * size
        self.running_var = [1.0] * size
        self.momentum = momentum
        self.eps = eps
        self.x_norm = None
        self.std_inv = None
        self.batch_input = None

    def forward_batch(self, batch):
        batch_size = len(batch)
        output_batch = []

        if self.training:
            mean = [0.0] * self.size
            for sample in batch:
                for j in range(self.size):
                    mean[j] += sample[j]
            mean = [m / batch_size for m in mean]

            var = [0.0] * self.size
            for sample in batch:
                for j in range(self.size):
                    var[j] += (sample[j] - mean[j]) ** 2
            var = [v / batch_size for v in var]

            self.std_inv = [1.0 / math.sqrt(v + self.eps) for v in var]

            self.x_norm = []
            self.batch_input = batch
            for sample in batch:
                normed = [(sample[j] - mean[j]) * self.std_inv[j] for j in range(self.size)]
                self.x_norm.append(normed)
                output = [self.gamma[j] * normed[j] + self.beta[j] for j in range(self.size)]
                output_batch.append(output)

            for j in range(self.size):
                self.running_mean[j] = (1 - self.momentum) * self.running_mean[j] + self.momentum * mean[j]
                self.running_var[j] = (1 - self.momentum) * self.running_var[j] + self.momentum * var[j]
        else:
            std_inv = [1.0 / math.sqrt(v + self.eps) for v in self.running_var]
            for sample in batch:
                normed = [(sample[j] - self.running_mean[j]) * std_inv[j] for j in range(self.size)]
                output = [self.gamma[j] * normed[j] + self.beta[j] for j in range(self.size)]
                output_batch.append(output)

        return output_batch

    def forward(self, x):
        result = self.forward_batch([x])
        return result[0]

    def backward(self, grad):
        if self.x_norm is None:
            return grad
        for j in range(self.size):
            self.gamma_grads[j] += self.x_norm[0][j] * grad[j]
            self.beta_grads[j] += grad[j]
        return [grad[j] * self.gamma[j] * self.std_inv[j] for j in range(self.size)]

    def parameters(self):
        params = []
        for j in range(self.size):
            params.append((self.gamma, j, None, self.gamma_grads))
            params.append((self.beta, j, None, self.beta_grads))
        return params
```

### 第 6 步：Sequential 容器

把多个模块串联起来。前向从左到右，反向从右到左。

```python
class Sequential(Module):
    def __init__(self, *modules):
        super().__init__()
        self.modules = list(modules)

    def forward(self, x):
        for module in self.modules:
            x = module.forward(x)
        return x

    def backward(self, grad):
        for module in reversed(self.modules):
            grad = module.backward(grad)
        return grad

    def parameters(self):
        params = []
        for module in self.modules:
            params.extend(module.parameters())
        return params

    def train(self):
        self.training = True
        for module in self.modules:
            module.train()

    def eval(self):
        self.training = False
        for module in self.modules:
            module.eval()
```

### 第 7 步：损失函数

MSE 和「二元交叉熵（Binary Cross-Entropy）」。每个损失函数都返回损失值，并提供一个返回梯度的 backward()。

```python
class MSELoss:
    def __call__(self, predicted, target):
        self.predicted = predicted
        self.target = target
        n = len(predicted)
        self.loss = sum((p - t) ** 2 for p, t in zip(predicted, target)) / n
        return self.loss

    def backward(self):
        n = len(self.predicted)
        return [2 * (p - t) / n for p, t in zip(self.predicted, self.target)]


class BCELoss:
    def __call__(self, predicted, target):
        self.predicted = predicted
        self.target = target
        eps = 1e-7
        n = len(predicted)
        self.loss = 0
        for p, t in zip(predicted, target):
            p = max(eps, min(1 - eps, p))
            self.loss += -(t * math.log(p) + (1 - t) * math.log(1 - p))
        self.loss /= n
        return self.loss

    def backward(self):
        eps = 1e-7
        n = len(self.predicted)
        grads = []
        for p, t in zip(self.predicted, self.target):
            p = max(eps, min(1 - eps, p))
            grads.append((-t / p + (1 - t) / (1 - p)) / n)
        return grads
```

### 第 8 步：SGD 与 Adam 优化器

两者都接收一个参数列表，并用梯度更新权重。

```python
class SGD:
    def __init__(self, parameters, lr=0.01):
        self.params = parameters
        self.lr = lr

    def step(self):
        for container, i, j, grad_container in self.params:
            if j is not None:
                container[i][j] -= self.lr * grad_container[i][j]
            else:
                container[i] -= self.lr * grad_container[i]

    def zero_grad(self):
        for container, i, j, grad_container in self.params:
            if j is not None:
                grad_container[i][j] = 0.0
            else:
                grad_container[i] = 0.0


class Adam:
    def __init__(self, parameters, lr=0.001, beta1=0.9, beta2=0.999, eps=1e-8):
        self.params = parameters
        self.lr = lr
        self.beta1 = beta1
        self.beta2 = beta2
        self.eps = eps
        self.t = 0
        self.m = [0.0] * len(parameters)
        self.v = [0.0] * len(parameters)

    def step(self):
        self.t += 1
        for idx, (container, i, j, grad_container) in enumerate(self.params):
            if j is not None:
                g = grad_container[i][j]
            else:
                g = grad_container[i]

            self.m[idx] = self.beta1 * self.m[idx] + (1 - self.beta1) * g
            self.v[idx] = self.beta2 * self.v[idx] + (1 - self.beta2) * g * g

            m_hat = self.m[idx] / (1 - self.beta1 ** self.t)
            v_hat = self.v[idx] / (1 - self.beta2 ** self.t)

            update = self.lr * m_hat / (math.sqrt(v_hat) + self.eps)

            if j is not None:
                container[i][j] -= update
            else:
                container[i] -= update

    def zero_grad(self):
        for container, i, j, grad_container in self.params:
            if j is not None:
                grad_container[i][j] = 0.0
            else:
                grad_container[i] = 0.0
```

### 第 9 步：DataLoader

把数据切分成批次，并可选地在每个 epoch 打乱顺序。

```python
class DataLoader:
    def __init__(self, data, batch_size=32, shuffle=True):
        self.data = data
        self.batch_size = batch_size
        self.shuffle = shuffle

    def __iter__(self):
        indices = list(range(len(self.data)))
        if self.shuffle:
            random.shuffle(indices)
        for start in range(0, len(indices), self.batch_size):
            batch_indices = indices[start:start + self.batch_size]
            batch = [self.data[i] for i in batch_indices]
            inputs = [item[0] for item in batch]
            targets = [item[1] for item in batch]
            yield inputs, targets

    def __len__(self):
        return (len(self.data) + self.batch_size - 1) // self.batch_size
```

### 第 10 步：在圆形分类任务上训练一个 4 层网络

把所有东西组装起来。定义模型，选一个损失函数，选一个优化器，运行训练循环。

```python
def make_circle_data(n=500, seed=42):
    random.seed(seed)
    data = []
    for _ in range(n):
        x = random.uniform(-2, 2)
        y = random.uniform(-2, 2)
        label = 1.0 if x * x + y * y < 1.5 else 0.0
        data.append(([x, y], [label]))
    return data


def train():
    random.seed(42)

    model = Sequential(
        Linear(2, 16),
        ReLU(),
        Linear(16, 16),
        ReLU(),
        Linear(16, 8),
        ReLU(),
        Linear(8, 1),
        Sigmoid(),
    )

    criterion = BCELoss()
    optimizer = Adam(model.parameters(), lr=0.01)

    data = make_circle_data(500)
    split = int(len(data) * 0.8)
    train_data = data[:split]
    test_data = data[split:]

    loader = DataLoader(train_data, batch_size=16, shuffle=True)

    model.train()

    for epoch in range(100):
        total_loss = 0
        total_correct = 0
        total_samples = 0

        for batch_inputs, batch_targets in loader:
            batch_loss = 0
            for x, t in zip(batch_inputs, batch_targets):
                pred = model.forward(x)
                loss = criterion(pred, t)
                batch_loss += loss

                optimizer.zero_grad()
                grad = criterion.backward()
                model.backward(grad)
                optimizer.step()

                predicted_class = 1.0 if pred[0] >= 0.5 else 0.0
                if predicted_class == t[0]:
                    total_correct += 1
                total_samples += 1

            total_loss += batch_loss

        avg_loss = total_loss / total_samples
        accuracy = total_correct / total_samples * 100

        if epoch % 10 == 0 or epoch == 99:
            print(f"Epoch {epoch:3d} | Loss: {avg_loss:.6f} | Train Accuracy: {accuracy:.1f}%")

    model.eval()
    correct = 0
    for x, t in test_data:
        pred = model.forward(x)
        predicted_class = 1.0 if pred[0] >= 0.5 else 0.0
        if predicted_class == t[0]:
            correct += 1
    test_accuracy = correct / len(test_data) * 100
    print(f"\nTest Accuracy: {test_accuracy:.1f}% ({correct}/{len(test_data)})")

    return model, test_accuracy
```

## 实际运用

下面是你刚刚构建的东西在 PyTorch 中的对应写法：

```python
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

model = nn.Sequential(
    nn.Linear(2, 16),
    nn.ReLU(),
    nn.Linear(16, 16),
    nn.ReLU(),
    nn.Linear(16, 8),
    nn.ReLU(),
    nn.Linear(8, 1),
    nn.Sigmoid(),
)

criterion = nn.BCELoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

for epoch in range(100):
    model.train()
    for inputs, targets in dataloader:
        optimizer.zero_grad()
        predictions = model(inputs)
        loss = criterion(predictions, targets)
        loss.backward()
        optimizer.step()

    model.eval()
    with torch.no_grad():
        test_predictions = model(test_inputs)
```

结构是完全一致的。`Sequential`、`Linear`、`ReLU`、`Sigmoid`、`BCELoss`、`Adam`、`zero_grad`、`backward`、`step`、`train`、`eval`。每一个概念都是一一对应的。区别在于：PyTorch 会自动处理 autograd（不需要在每个模块里实现 backward()），它能在 GPU 上运行，而且已经被优化了多年。但骨架是一样的。

从此以后，当你看到 PyTorch 代码时，你就能确切知道每一行背后正在发生什么。这种理解正是这一切的意义所在。

## 交付物

本课产出：
- `outputs/prompt-framework-architect.md` —— 一个用于利用框架抽象来设计神经网络架构的提示词

## 练习

1. 添加一个用于多分类的 `SoftmaxCrossEntropyLoss` 类。对预测值做 softmax，计算交叉熵损失，并处理合并后的反向传播。在一个 3 类的螺旋数据集上测试它。

2. 在优化器中实现学习率调度：添加一个 `set_lr()` 方法，并接入第 09 课的余弦调度。用 warmup + 余弦调度训练这个圆形分类器，并与恒定学习率进行对比。

3. 给 Sequential 添加 `save()` 和 `load()` 方法，把所有权重序列化为一个 JSON 文件并能重新加载。验证加载后的模型与原始模型产生相同的预测。

4. 在 Adam 优化器中实现权重衰减（L2 正则化）。添加一个 `weight_decay` 参数，使其在每一步把权重向零收缩。对比 decay=0 与 decay=0.01 时的训练效果。

5. 把逐样本的训练循环替换为正确的小批量梯度累积：在一个批次的所有样本上累积梯度，然后除以批大小，再执行一次优化器步进。测量这是否改变了收敛速度。

## 关键术语

| 术语 | 人们口中的说法 | 它实际的含义 |
|------|----------------|----------------------|
| Module（模块） | "一个层" | 框架中的基础抽象 —— 任何拥有 forward()、backward() 和 parameters() 的东西 |
| Sequential | "按顺序堆叠层" | 一个把模块串联起来的容器，前向时顺序应用、反向时逆序应用 |
| Forward pass（前向传播） | "运行网络" | 通过依次把输入传过每个模块来计算输出 |
| Backward pass（反向传播） | "计算梯度" | 把损失梯度逆序地传播过每个模块，以计算参数梯度 |
| Parameters（参数） | "可训练的权重" | 网络中所有可被优化器更新的值 —— 权重和偏置 |
| Optimizer（优化器） | "那个更新权重的东西" | 一种使用梯度来更新参数的算法，实现 SGD、Adam 或其他规则 |
| DataLoader | "那个喂数据的东西" | 一个把数据集切分成批次的迭代器，可选地在每个 epoch 之间打乱顺序 |
| Training mode（训练模式） | "model.train()" | 一个开启随机行为的标志位，比如 dropout，以及使用批统计量的批归一化 |
| Evaluation mode（评估模式） | "model.eval()" | 一个关闭 dropout、并让批归一化使用滑动统计量的标志位 |
| Zero grad（梯度清零） | "清除梯度" | 在计算下一批次的梯度之前，把所有参数梯度重置为零 |

## 延伸阅读

- Paszke 等人，《PyTorch: An Imperative Style, High-Performance Deep Learning Library》(2019) —— 描述 PyTorch 设计决策的论文
- Chollet，《Deep Learning with Python, Second Edition》(2021) —— 第 3 章用相同的模块/层抽象介绍了 Keras 的内部机制
- Johnson，《Tiny-DNN》(https://github.com/tiny-dnn/tiny-dnn) —— 一个仅含头文件的 C++ 深度学习框架，可用于理解框架内部原理
