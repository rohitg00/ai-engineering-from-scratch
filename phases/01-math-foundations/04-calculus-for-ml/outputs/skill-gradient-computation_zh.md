---
name: skill-gradient-computation
description: 计算常见ML损失函数的梯度并选择正确的求导方法
version: 1.0.0
phase: 1
lesson: 4
tags: [calculus, gradients, backpropagation]
---

# 用于ML的梯度计算

计算损失函数、激活函数和神经网络中层操作的梯度的实用参考。

## 决策清单

1. 函数是否由简单原语（幂、指数、对数、三角函数）组成？使用解析导数 + 链式法则。
2. 函数是否为自定义或黑箱操作？使用数值微分：`(f(x+h) - f(x-h)) / (2h)`，h = 1e-7。
3. 函数是否由PyTorch/JAX的张量操作构建？让自动求导处理。用数值检查验证。
4. 是否需要标量损失相对于权重矩阵的梯度？通过计算图逐节点应用链式法则。
5. 是否存在不可微操作（argmax、取整、采样）？使用直通估计器或重参数化技巧。

## 何时使用每种方法

| 方法 | 何时使用 | 代价 |
|---|---|---|
| 解析法（手工推导） | 简单函数，验证自动求导输出 | 运行时免费 |
| 数值法（有限差分） | 调试、梯度检查、黑箱函数 | n个参数需要2n次前向传播 |
| 自动微分 | 任何可微的计算图（默认选择） | 一次反向传播 |
| 符号法（SymPy、Mathematica） | 推导论文所需的闭式梯度 | 仅编译时 |

## 快速参考：常见导数

| 函数 | f(x) | f'(x) | ML场景 |
|---|---|---|---|
| MSE损失 | (1/n) sum(y_hat - y)^2 | (2/n)(y_hat - y) | 回归 |
| 交叉熵（二分类） | -(y log(p) + (1-y) log(1-p)) | p - y（sigmoid之后） | 二分类 |
| 交叉熵（多分类） | -log(p_true_class) | p - one_hot(y)（softmax之后） | 多分类 |
| Sigmoid | 1 / (1 + e^(-x)) | sigma(x) * (1 - sigma(x)) | 输出门、二分类输出 |
| Tanh | (e^x - e^(-x)) / (e^x + e^(-x)) | 1 - tanh(x)^2 | 隐藏激活（传统） |
| ReLU | max(0, x) | 1 如果 x > 0, 0 如果 x < 0 | 默认隐藏激活 |
| Leaky ReLU | max(0.01x, x) | 1 如果 x > 0, 0.01 如果 x < 0 | 避免神经元死亡 |
| GELU | x * Phi(x) | Phi(x) + x * phi(x) | Transformer |
| Softmax_i | e^(x_i) / sum(e^(x_j)) | i=j时 s_i(1-s_i), i≠j时 -s_i*s_j | 输出层（雅可比矩阵） |
| Log-softmax | x_i - log(sum(e^(x_j))) | 第i项为 1 - softmax(x_i) | 数值稳定的交叉熵 |
| 线性层 | y = Wx + b | dL/dW = dL/dy * x^T, dL/db = dL/dy | 每一层 |
| L2正则化 | lambda * sum(w^2) | 2 * lambda * w | 权重衰减 |
| L1正则化 | lambda * sum(\|w\|) | lambda * sign(w) | 稀疏性 |

## 常见错误

- 在批量平均损失（MSE、交叉熵）中忘记1/n因子。梯度按批量大小缩放。
- 将softmax梯度当作向量计算，而它实际上是一个雅可比矩阵。对于交叉熵+softmax组合，梯度简化为(p - y)，从而避免完整的雅可比计算。
- 以错误顺序应用链式法则。从损失反向推导：dL/dW = dL/dy * dy/dW。
- 数值导数使用过大（h = 0.1）或过小（h = 1e-15）的h。对于float64，使用 h = 1e-7。
- 忘记ReLU在x=0处梯度未定义。实践中设为0或0.5。

## 梯度检查方法

```
对于每个参数 w：
  numeric_grad = (loss(w + h) - loss(w - h)) / (2h)
  auto_grad = 反向传播得到的值
  relative_error = |numeric - auto| / max(|numeric|, |auto|, 1e-8)
  assert relative_error < 1e-5
```

相对误差大于1e-3说明有问题。在1e-5到1e-3之间需要调查。
