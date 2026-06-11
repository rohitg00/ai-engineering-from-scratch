---
name: skill-gradient-computation
description: 计算常见ML损失函数的梯度并选择正确的导数方法
version: 1.0.0
phase: 1
lesson: 4
tags: [calculus, gradients, backpropagation]
---

# ML梯度计算

用于计算神经网络中损失函数、激活函数和层运算梯度的实用参考。

## 决策清单

1. 函数是由简单原语（幂、指数、对数、三角）组成的吗？使用解析导数和链式法则。
2. 函数是自定义或黑盒操作吗？使用数值微分：`(f(x+h) - f(x-h)) / (2h)`，其中 h = 1e-7。
3. 函数是由 PyTorch/JAX 中的张量运算构建的吗？让 autograd 处理它。用数值检查验证。
4. 您需要标量损失相对于权重矩阵的梯度吗？通过计算图应用链式法则，一次一个节点。
5. 是否存在不可微的操作（argmax、舍入、采样）？使用直通估计器或重参数化技巧。

## 何时使用每种方法

| 方法 | 何时使用 | 成本 |
|---|---|---|
| 解析（手工推导） | 简单函数，验证 autograd 输出 | 运行时免费 |
| 数值（有限差分） | 调试，梯度检查，黑盒函数 | 对于 n 个参数需要 2n 次前向传递 |
| 自动微分 | 任何可微计算图（默认） | 一次反向传递 |
| 符号（SymPy、Mathematica） | 为论文推导闭式梯度 | 仅编译时 |

## 快速参考：常见导数

| 函数 | f(x) | f'(x) | ML上下文 |
|---|---|---|---|
| MSE损失 | (1/n) sum(y_hat - y)^2 | (2/n)(y_hat - y) | 回归 |
| 交叉熵（二分类） | -(y log(p) + (1-y) log(1-p)) | p - y（sigmoid 后） | 二分类 |
| 交叉熵（多分类） | -log(p_true_class) | p - one_hot(y)（softmax 后） | 多分类 |
| Sigmoid | 1 / (1 + e^(-x)) | sigma(x) * (1 - sigma(x)) | 输出门，二分类输出 |
| Tanh | (e^x - e^(-x)) / (e^x + e^(-x)) | 1 - tanh(x)^2 | 隐藏激活（传统） |
| ReLU | max(0, x) | 1 如果 x > 0，0 如果 x < 0 | 默认隐藏激活 |
| Leaky ReLU | max(0.01x, x) | 1 如果 x > 0，0.01 如果 x < 0 | 避免死神经元 |
| GELU | x * Phi(x) | Phi(x) + x * phi(x) | Transformer |
| Softmax_i | e^(x_i) / sum(e^(x_j)) | s_i(1 - s_i) 当 i=j，-s_i*s_j 当 i!=j | 输出层（雅可比） |
| Log-softmax | x_i - log(sum(e^(x_j))) | 1 - softmax(x_i) 对于第 i 个条目 | 数值稳定CE |
| 线性层 | y = Wx + b | dL/dW = dL/dy * x^T，dL/db = dL/dy | 每一层 |
| L2正则化 | lambda * sum(w^2) | 2 * lambda * w | 权重衰减 |
| L1正则化 | lambda * sum(\|w\|) | lambda * sign(w) | 稀疏性 |

## 常见错误

- 忘记批量平均损失中的 1/n 因子（MSE、交叉熵）。梯度按批次大小缩放。
- 将 softmax 梯度计算为向量，而实际上它是一个雅可比矩阵。对于交叉熵 + softmax 组合，梯度简化为 (p - y)，这避免了完整的雅可比矩阵。
- 以错误的顺序应用链式法则。从损失向后工作：dL/dW = dL/dy * dy/dW。
- 对于数值导数使用太大（h = 0.1）或太小（h = 1e-15）的 h。对于 float64 坚持使用 h = 1e-7。
- 忘记 ReLU 在正好 x = 0 处有未定义的梯度。在实践中，将其设置为 0 或 0.5。

## 梯度检查配方

```
对于每个参数 w：
  numeric_grad = (loss(w + h) - loss(w - h)) / (2h)
  auto_grad = 反向传递值
  relative_error = |numeric - auto| / max(|numeric|, |auto|, 1e-8)
  assert relative_error < 1e-5
```

相对误差超过 1e-3 意味着有问题。在 1e-5 和 1e-3 之间，需要调查。
