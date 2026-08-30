# 08 · 优化

> 训练神经网络无非就是找到山谷的谷底。

**类型：** 实现（Build）
**语言：** Python
**前置：** 阶段 1，第 04-05 课（导数、梯度）
**时长：** 约 75 分钟

## 学习目标

- 从零实现原始梯度下降、带动量的 SGD 以及 Adam
- 在 Rosenbrock 函数上对比各优化器的收敛表现，并解释 Adam 为何能为每个权重自适应调整学习率
- 区分凸（convex）与非凸（non-convex）损失曲面，并解释鞍点（saddle point）在高维空间中的作用
- 为训练稳定性配置学习率调度（阶梯衰减、余弦退火、预热）

## 问题所在

你有一个损失函数，它告诉你模型有多错。你有梯度，它告诉你哪个方向会让损失变得更糟。现在你需要一套下山的策略。

最朴素的做法很简单：朝梯度的反方向移动，用一个叫学习率（learning rate）的数来缩放步长，然后重复。这就是梯度下降，它确实管用。但「管用」是有附加条件的。学习率太大，你会彻底越过山谷，在两壁之间反复弹跳；太小，你要花上成千上万步多余的步子才能慢慢爬向答案；一旦踩到鞍点，即便还没找到极小值，你也会停滞不前。

深度学习中的每一个优化器，都是对同一个问题的回答：如何更快、更可靠地抵达山谷的谷底？

## 核心概念

### 优化是什么意思

优化就是寻找能让某个函数取得最小值（或最大值）的输入值。在机器学习里，这个函数就是损失，输入就是模型的权重。训练就是优化。

```
minimize L(w) where:
  L = loss function
  w = model weights (could be millions of parameters)
```

### 梯度下降（原始版）

最简单的优化器。计算损失关于每个权重的梯度，让每个权重朝其梯度的反方向移动，用学习率缩放步长。

```
w = w - lr * gradient
```

整个算法就这一行。

```mermaid
graph TD
    A["* Starting point (high loss)"] --> B["Moving downhill along gradient"]
    B --> C["Approaching minimum"]
    C --> D["o Minimum (low loss)"]
```

### 学习率：最重要的超参数

学习率控制步长，它决定了收敛的一切。

```mermaid
graph LR
    subgraph TooLarge["Too Large (lr = 1.0)"]
        A1["Step 1"] -->|overshoot| A2["Step 2"]
        A2 -->|overshoot| A3["Step 3"]
        A3 -->|diverging| A4["..."]
    end
    subgraph TooSmall["Too Small (lr = 0.0001)"]
        B1["Step 1"] -->|tiny step| B2["Step 2"]
        B2 -->|tiny step| B3["Step 3"]
        B3 -->|10,000 steps later| B4["Minimum"]
    end
    subgraph JustRight["Just Right (lr = 0.01)"]
        C1["Start"] --> C2["..."] --> C3["Converged in ~100 steps"]
    end
```

没有公式能算出合适的学习率，你只能通过实验去找。常见的起点：Adam 用 0.001，带动量的 SGD 用 0.01。

### SGD、批量与小批量

原始梯度下降会先在整个数据集上计算梯度，再走一步。这叫批量梯度下降（batch gradient descent），稳定但缓慢。

随机梯度下降（Stochastic Gradient Descent, SGD）在单个随机样本上计算梯度，然后立即走一步。它噪声大但快。

小批量梯度下降（mini-batch gradient descent）则取折中：在一个小批次（32、64、128、256 个样本）上计算梯度后再走一步。这才是大家实际都在用的方法。

| 变体 | 批次大小 | 梯度质量 | 单步速度 | 噪声 |
|---------|-----------|-----------------|---------------|-------|
| Batch GD | 整个数据集 | 精确 | 慢 | 无 |
| SGD | 1 个样本 | 噪声极大 | 快 | 高 |
| Mini-batch | 32-256 | 良好估计 | 均衡 | 适中 |

SGD 和小批量中的噪声并不是缺陷。它有助于逃离浅层局部极小值和鞍点。

### 动量：滚下山坡的球

原始梯度下降只看当前梯度。如果梯度来回锯齿状摆动（在狭窄山谷中很常见），进展就会很慢。动量（momentum）通过把过去的梯度累积进一个速度项来解决这个问题。

```
v = beta * v + gradient
w = w - lr * v
```

打个比方：一个球滚下山坡，它不会在每个坑洼处都停下重启，而是在一致的方向上积累速度，同时抑制振荡。

```mermaid
graph TD
    subgraph Without["Without Momentum (zigzag, slow)"]
        W1["Start"] -->|left| W2[" "]
        W2 -->|right| W3[" "]
        W3 -->|left| W4[" "]
        W4 -->|right| W5[" "]
        W5 -->|left| W6[" "]
        W6 --> W7["Minimum"]
    end
    subgraph With["With Momentum (smooth, fast)"]
        M1["Start"] --> M2[" "] --> M3[" "] --> M4["Minimum"]
    end
```

`beta`（通常取 0.9）控制保留多少历史。beta 越高，动量越大，路径越平滑，但对方向变化的响应也越慢。

### Adam：自适应学习率

不同的权重需要不同的学习率。一个很少遇到大梯度的权重，在终于遇到时应该走更大的步子；一个不断遇到巨大梯度的权重，则应该走更小的步子。

Adam（Adaptive Moment Estimation，自适应矩估计）为每个权重跟踪两样东西：

1. 一阶矩（m）：梯度的滑动平均（类似动量）
2. 二阶矩（v）：梯度平方的滑动平均（梯度幅度）

```
m = beta1 * m + (1 - beta1) * gradient
v = beta2 * v + (1 - beta2) * gradient^2

m_hat = m / (1 - beta1^t)    bias correction
v_hat = v / (1 - beta2^t)    bias correction

w = w - lr * m_hat / (sqrt(v_hat) + epsilon)
```

除以 `sqrt(v_hat)` 是关键所在。梯度大的权重会被一个大数相除（有效步长变小），梯度小的权重会被一个小数相除（有效步长变大）。每个权重都获得了自己的自适应学习率。

默认超参数：`lr=0.001, beta1=0.9, beta2=0.999, epsilon=1e-8`。这些默认值对大多数问题都表现良好。

### 学习率调度

固定学习率是一种妥协。训练早期，你希望大步前进、快速推进；训练后期，你希望小步微调、逼近极小值。

常见调度：

| 调度 | 公式 | 适用场景 |
|----------|---------|----------|
| 阶梯衰减 | lr = lr * factor every N epochs | 简单，手动控制 |
| 指数衰减 | lr = lr_0 * decay^t | 平滑下降 |
| 余弦退火 | lr = lr_min + 0.5 * (lr_max - lr_min) * (1 + cos(pi * t / T)) | Transformer、现代训练 |
| 预热 + 衰减 | 先线性爬升，再衰减 | 大模型，防止早期不稳定 |

### 凸与非凸

凸函数只有一个极小值，梯度下降总能找到它。像 `f(x) = x^2` 这样的二次函数就是凸的。

神经网络的损失函数是非凸的。它们有许多局部极小值、鞍点和平坦区域。

```mermaid
graph LR
    subgraph Convex["Convex: One valley, one answer"]
        direction TB
        CV1["High loss"] --> CV2["Global minimum"]
    end
    subgraph NonConvex["Non-convex: Multiple valleys, saddle points"]
        direction TB
        NC1["Start"] --> NC2["Local minimum"]
        NC1 --> NC3["Saddle point"]
        NC1 --> NC4["Global minimum"]
    end
```

实践中，高维神经网络里的局部极小值很少成为问题。大多数局部极小值的损失值都接近全局极小值。真正的障碍是鞍点（在某些方向平坦、在另一些方向弯曲）。动量和小批量带来的噪声有助于逃离它们。

### 损失曲面可视化

损失是所有权重的函数。对于一个有 100 万个权重的模型，损失曲面存在于 1,000,001 维空间中。我们的可视化方法是：在权重空间中挑选两个随机方向，沿这两个方向绘制损失，得到一个二维曲面。

```mermaid
graph TD
    HL["High loss region"] --> SP["Saddle point"]
    HL --> LM["Local minimum"]
    SP --> LM
    SP --> GM["Global minimum"]
    LM -.->|"shallow barrier"| GM
    style HL fill:#ff6666,color:#000
    style SP fill:#ffcc66,color:#000
    style LM fill:#66ccff,color:#000
    style GM fill:#66ff66,color:#000
```

尖锐的极小值泛化能力差，平坦的极小值泛化能力好。这也是带动量的 SGD 在最终测试准确率上常常胜过 Adam 的一个原因：它的噪声能阻止模型陷入尖锐的极小值。

## 动手实现

### 第 1 步：定义一个测试函数

Rosenbrock 函数是经典的优化基准。它的极小值位于 (1, 1)，藏在一条狭窄的弯曲山谷里——这条谷容易找到，却很难沿着它走下去。

```
f(x, y) = (1 - x)^2 + 100 * (y - x^2)^2
```

```python
def rosenbrock(params):
    x, y = params
    return (1 - x) ** 2 + 100 * (y - x ** 2) ** 2

def rosenbrock_gradient(params):
    x, y = params
    df_dx = -2 * (1 - x) + 200 * (y - x ** 2) * (-2 * x)
    df_dy = 200 * (y - x ** 2)
    return [df_dx, df_dy]
```

### 第 2 步：原始梯度下降

```python
class GradientDescent:
    def __init__(self, lr=0.001):
        self.lr = lr

    def step(self, params, grads):
        return [p - self.lr * g for p, g in zip(params, grads)]
```

### 第 3 步：带动量的 SGD

```python
class SGDMomentum:
    def __init__(self, lr=0.001, momentum=0.9):
        self.lr = lr
        self.momentum = momentum
        self.velocity = None

    def step(self, params, grads):
        if self.velocity is None:
            self.velocity = [0.0] * len(params)
        self.velocity = [
            self.momentum * v + g
            for v, g in zip(self.velocity, grads)
        ]
        return [p - self.lr * v for p, v in zip(params, self.velocity)]
```

### 第 4 步：Adam

```python
class Adam:
    def __init__(self, lr=0.001, beta1=0.9, beta2=0.999, epsilon=1e-8):
        self.lr = lr
        self.beta1 = beta1
        self.beta2 = beta2
        self.epsilon = epsilon
        self.m = None
        self.v = None
        self.t = 0

    def step(self, params, grads):
        if self.m is None:
            self.m = [0.0] * len(params)
            self.v = [0.0] * len(params)

        self.t += 1

        self.m = [
            self.beta1 * m + (1 - self.beta1) * g
            for m, g in zip(self.m, grads)
        ]
        self.v = [
            self.beta2 * v + (1 - self.beta2) * g ** 2
            for v, g in zip(self.v, grads)
        ]

        m_hat = [m / (1 - self.beta1 ** self.t) for m in self.m]
        v_hat = [v / (1 - self.beta2 ** self.t) for v in self.v]

        return [
            p - self.lr * mh / (vh ** 0.5 + self.epsilon)
            for p, mh, vh in zip(params, m_hat, v_hat)
        ]
```

### 第 5 步：运行并对比

```python
def optimize(optimizer, func, grad_func, start, steps=5000):
    params = list(start)
    history = [params[:]]
    for _ in range(steps):
        grads = grad_func(params)
        params = optimizer.step(params, grads)
        history.append(params[:])
    return history

start = [-1.0, 1.0]

gd_history = optimize(GradientDescent(lr=0.0005), rosenbrock, rosenbrock_gradient, start)
sgd_history = optimize(SGDMomentum(lr=0.0001, momentum=0.9), rosenbrock, rosenbrock_gradient, start)
adam_history = optimize(Adam(lr=0.01), rosenbrock, rosenbrock_gradient, start)

for name, history in [("GD", gd_history), ("SGD+M", sgd_history), ("Adam", adam_history)]:
    final = history[-1]
    loss = rosenbrock(final)
    print(f"{name:6s} -> x={final[0]:.6f}, y={final[1]:.6f}, loss={loss:.8f}")
```

预期输出：Adam 收敛最快；带动量的 SGD 走出一条更平滑的路径；原始 GD 在狭窄山谷中进展缓慢。

## 实际运用

实践中，请使用 PyTorch 或 JAX 的优化器。它们会处理参数组、权重衰减、梯度裁剪以及 GPU 加速。

```python
import torch

model = torch.nn.Linear(784, 10)

sgd = torch.optim.SGD(model.parameters(), lr=0.01, momentum=0.9)
adam = torch.optim.Adam(model.parameters(), lr=0.001)
adamw = torch.optim.AdamW(model.parameters(), lr=0.001, weight_decay=0.01)

scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(adam, T_max=100)
```

经验法则：

- 从 Adam 开始（lr=0.001）。它对大多数问题无需调参就能奏效。
- 当你需要最佳最终准确率、且能承受更多调参成本时，改用带动量的 SGD（lr=0.01, momentum=0.9）。
- 对 Transformer 使用 AdamW（带解耦权重衰减的 Adam）。
- 对超过几个 epoch 的训练，始终使用学习率调度。
- 如果训练不稳定，降低学习率；如果训练太慢，提高学习率。

## 交付成果

本课产出一个用于选择合适优化器的提示词，见 `outputs/prompt-optimizer-guide.md`。

这里实现的优化器类会在阶段 3 中再次出现——那时我们将从零开始训练一个神经网络。

## 练习

1. **学习率扫描。** 在 Rosenbrock 函数上用学习率 [0.0001, 0.0005, 0.001, 0.005, 0.01] 运行原始梯度下降。为每个学习率绘制或打印 5000 步后的最终损失。找出仍能收敛的最大学习率。

2. **动量对比。** 在 Rosenbrock 函数上以动量值 [0.0, 0.5, 0.9, 0.99] 运行带动量的 SGD。记录每一步的损失。哪个动量值收敛最快？哪个会越过山谷？

3. **逃离鞍点。** 定义函数 `f(x, y) = x^2 - y^2`（原点处是一个鞍点）。从 (0.01, 0.01) 出发。对比原始 GD、带动量的 SGD 和 Adam 的表现。哪个能逃离鞍点？

4. **实现学习率衰减。** 给 GradientDescent 类加上指数衰减调度：`lr = lr_0 * 0.999^step`。在 Rosenbrock 函数上对比加衰减与不加衰减的收敛情况。

## 关键术语

| 术语 | 人们常说 | 它实际的含义 |
|------|----------------|----------------------|
| 梯度下降（Gradient descent） | 「往下走」 | 用学习率缩放后的梯度去减更新权重。最基础的优化器。 |
| 学习率（Learning rate） | 「步长」 | 一个标量，控制每次更新让权重移动多远。太大会发散，太小会浪费算力。 |
| 动量（Momentum） | 「继续滚」 | 把过去的梯度累积进一个速度向量。抑制振荡，并在一致方向上加速前进。 |
| SGD | 「随机采样」 | 随机梯度下降。在一个随机子集而非完整数据集上计算梯度。实践中几乎总是指小批量 SGD。 |
| 小批量（Mini-batch） | 「一小块数据」 | 用于估计梯度的一小份训练数据（32-256 个样本）。在速度与梯度精度之间取得平衡。 |
| Adam | 「默认的优化器」 | 自适应矩估计。为每个权重跟踪梯度及其平方的滑动平均，从而为每个权重赋予各自的学习率。 |
| 偏差修正（Bias correction） | 「修正冷启动」 | Adam 的一阶矩和二阶矩初始化为零。偏差修正通过除以 (1 - beta^t) 来补偿早期步骤。 |
| 学习率调度（Learning rate schedule） | 「随时间改变 lr」 | 一个在训练过程中调整学习率的函数。早期走大步，后期走小步。 |
| 凸函数（Convex function） | 「一个山谷」 | 任何局部极小值都是全局极小值的函数。梯度下降总能找到它。神经网络的损失不是凸的。 |
| 鞍点（Saddle point） | 「平坦但不是极小值」 | 梯度为零，但在某些方向是极小值、在另一些方向是极大值的点。在高维中很常见。 |
| 损失曲面（Loss landscape） | 「地形」 | 在权重空间上绘制的损失函数。通过沿两个随机方向切片来可视化。 |
| 收敛（Convergence） | 「到达终点」 | 优化器已抵达某个点，再多走几步也无法显著降低损失。 |

## 延伸阅读

- [Sebastian Ruder: An overview of gradient descent optimization algorithms](https://ruder.io/optimizing-gradient-descent/) —— 对所有主流优化器的全面综述
- [Why Momentum Really Works (Distill)](https://distill.pub/2017/momentum/) —— 动量动态过程的交互式可视化
- [Adam: A Method for Stochastic Optimization (Kingma & Ba, 2014)](https://arxiv.org/abs/1412.6980) —— Adam 的原始论文，易读且简短
- [Visualizing the Loss Landscape of Neural Nets (Li et al., 2018)](https://arxiv.org/abs/1712.09913) —— 揭示尖锐极小值与平坦极小值之别的论文
