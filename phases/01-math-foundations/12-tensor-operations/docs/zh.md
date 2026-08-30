# 12 · 张量运算

> 张量是数据与深度学习之间的通用语言。每一张图片、每一句话、每一个梯度，都流经它。

**类型：** 构建
**语言：** Python
**前置：** 阶段 1，第 01 课（线性代数直觉）、第 02 课（向量、矩阵与运算）
**时长：** ~90 分钟

## 学习目标

- 从零实现一个张量类，包含形状（shape）、步长（strides）、reshape、transpose 以及逐元素运算
- 应用广播（broadcasting）规则，在不复制数据的前提下对不同形状的张量进行运算
- 编写 einsum 表达式来实现点积、矩阵乘法、外积以及批处理运算
- 逐步追踪多头注意力（multi-head attention）中每一步的精确张量形状

## 问题所在

你搭建了一个 transformer。前向传播的代码看起来很干净。你跑起来，却得到：`RuntimeError: mat1 and mat2 shapes cannot be multiplied (32x768 and 512x768)`。你盯着这些形状，尝试加一个 transpose。现在它又说 `Expected 4D input (got 3D input)`。你加了一个 unsqueeze。结果别的地方又崩了。

形状错误是深度学习代码中最常见的 bug。它们在概念上并不难——每个运算都有自己的形状契约（shape contract）——但它们扩散得极快。一个 transformer 里串联了几十个 reshape、transpose 和广播操作。一个轴错了，错误就会级联放大。更糟的是，有些形状错误根本不会抛异常。它们会沿错误的维度广播、或在错误的轴上求和，悄无声息地产出垃圾结果。

矩阵处理的是两组事物之间的成对关系。真实数据装不进二维。一批 32 张 224x224 的 RGB 图像是一个 4D 张量：`(32, 3, 224, 224)`。带 12 个头的自注意力同样是 4D：`(batch, heads, seq_len, head_dim)`。你需要一种能推广到任意维度数量的数据结构，且其上的运算能在所有维度间干净地组合。这种结构就是张量。掌握了它的运算，形状错误便可轻松调试。

## 核心概念

### 什么是张量

张量是一个具有统一数据类型的多维数字数组。维度的数量称为**秩（rank）**（或**阶，order**）。每个维度是一个**轴（axis）**。**形状（shape）**是一个元组，列出每个轴上的大小。

```mermaid
graph LR
    S["Scalar<br/>rank 0<br/>shape: ()"] --> V["Vector<br/>rank 1<br/>shape: (3,)"]
    V --> M["Matrix<br/>rank 2<br/>shape: (2,3)"]
    M --> T3["3D Tensor<br/>rank 3<br/>shape: (2,2,2)"]
    T3 --> T4["4D Tensor<br/>rank 4<br/>shape: (B,C,H,W)"]
```

元素总数 = 所有维度大小的乘积。形状 `(2, 3, 4)` 容纳 `2 * 3 * 4 = 24` 个元素。

### 深度学习中的张量形状

按照惯例，不同的数据类型映射到特定的张量形状。

```mermaid
graph TD
    subgraph Vision
        V1["(B, C, H, W)<br/>32, 3, 224, 224"]
    end
    subgraph NLP
        N1["(B, T, D)<br/>16, 128, 768"]
    end
    subgraph Attention
        A1["(B, H, T, D)<br/>16, 12, 128, 64"]
    end
    subgraph Weights
        W1["Linear: (out, in)<br/>Conv2D: (out_c, in_c, kH, kW)<br/>Embedding: (vocab, dim)"]
    end
```

PyTorch 使用 NCHW（通道在前，channels-first）。TensorFlow 默认使用 NHWC（通道在后，channels-last）。布局不匹配会导致悄无声息的性能下降或报错。

### 内存布局如何工作

内存中的二维数组其实是一段一维的字节序列。**步长（strides）**告诉你：沿每个轴前进一步需要跳过多少个元素。

```mermaid
graph LR
    subgraph "Row-major (C order)"
        R["a b c d e f<br/>strides: (3, 1)"]
    end
    subgraph "Column-major (F order)"
        C["a d b e c f<br/>strides: (1, 2)"]
    end
```

转置不会移动数据。它只是交换步长，使张量变为**非连续（non-contiguous）**——同一行的元素在内存中不再相邻。

### 广播规则

广播（broadcasting）让你能在不复制数据的前提下对不同形状的张量进行运算。从右侧对齐形状。当两个维度相等、或其中一个为 1 时，它们是兼容的。维度较少的一方会在左侧用 1 补齐。

```
Tensor A:     (8, 1, 6, 1)
Tensor B:        (7, 1, 5)
Padded B:     (1, 7, 1, 5)
Result:       (8, 7, 6, 5)
```

### Einsum：通用张量运算

爱因斯坦求和（Einstein summation）用一个字母标注每个轴。出现在输入中但不出现在输出中的轴会被求和（消去）。同时出现在两侧的轴则被保留。

```mermaid
graph LR
    subgraph "matmul: ik,kj -> ij"
        A["A(I,K)"] --> |"sum over k"| C["C(I,J)"]
        B["B(K,J)"] --> |"sum over k"| C
    end
```

关键模式：`i,i->`（点积）、`i,j->ij`（外积）、`ii->`（迹）、`ij->ji`（转置）、`bij,bjk->bik`（批量矩阵乘法）、`bhtd,bhsd->bhts`（注意力分数）。

## 动手构建

代码位于 `code/tensors.py`。每一步都对应那里的实现。

### 第 1 步：张量存储与步长

一个张量存储一个扁平的数字列表，外加形状元数据。步长告诉索引逻辑如何将多维索引映射到扁平位置。

```python
class Tensor:
    def __init__(self, data, shape=None):
        if isinstance(data, (list, tuple)):
            self._data, self._shape = self._flatten_nested(data)
        elif isinstance(data, np.ndarray):
            self._data = data.flatten().tolist()
            self._shape = tuple(data.shape)
        else:
            self._data = [data]
            self._shape = ()

        if shape is not None:
            total = reduce(lambda a, b: a * b, shape, 1)
            if total != len(self._data):
                raise ValueError(
                    f"Cannot reshape {len(self._data)} elements into shape {shape}"
                )
            self._shape = tuple(shape)

        self._strides = self._compute_strides(self._shape)

    @staticmethod
    def _compute_strides(shape):
        if len(shape) == 0:
            return ()
        strides = [1] * len(shape)
        for i in range(len(shape) - 2, -1, -1):
            strides[i] = strides[i + 1] * shape[i + 1]
        return tuple(strides)
```

对于形状 `(3, 4)`，步长是 `(4, 1)`——跳过 4 个元素前进一行，跳过 1 个元素前进一列。

### 第 2 步：reshape、squeeze、unsqueeze

reshape 在不改变元素顺序的前提下改变形状。元素总数必须保持不变。可以用 `-1` 代表某一个维度，让其大小被自动推断。

```python
t = Tensor(list(range(12)), shape=(2, 6))
r = t.reshape((3, 4))
r = t.reshape((-1, 3))
```

squeeze 移除大小为 1 的轴。unsqueeze 插入一个。unsqueeze 对广播至关重要——一个偏置向量 `(D,)` 要加到批次 `(B, T, D)` 上，需要先 unsqueeze 成 `(1, 1, D)`。

```python
t = Tensor(list(range(6)), shape=(1, 3, 1, 2))
s = t.squeeze()
v = Tensor([1, 2, 3])
u = v.unsqueeze(0)
```

### 第 3 步：transpose 与 permute

transpose 交换两个轴。permute 重排所有轴。这正是你在 NCHW 与 NHWC 之间转换的方式。

```python
mat = Tensor(list(range(6)), shape=(2, 3))
tr = mat.transpose(0, 1)

t4d = Tensor(list(range(24)), shape=(1, 2, 3, 4))
perm = t4d.permute((0, 2, 3, 1))
```

经过 transpose 或 permute 后，张量在内存中变为非连续。在 PyTorch 中，`view` 在非连续张量上会失败——此时应改用 `reshape`，或先调用 `.contiguous()`。

### 第 4 步：逐元素运算与归约

逐元素运算（加、乘、减）独立地作用于每个元素并保持形状不变。归约（sum、mean、max）则会折叠一个或多个轴。

```python
a = Tensor([[1, 2], [3, 4]])
b = Tensor([[10, 20], [30, 40]])
c = a + b
d = a * 2
s = a.sum(axis=0)
```

CNN 中的全局平均池化：`(B, C, H, W).mean(axis=[2, 3])` 产生 `(B, C)`。NLP 中的序列均值池化：`(B, T, D).mean(axis=1)` 产生 `(B, D)`。

### 第 5 步：使用 NumPy 进行广播

`tensors.py` 中的 `demo_broadcasting_numpy()` 函数展示了核心模式。

```python
activations = np.random.randn(4, 3)
bias = np.array([0.1, 0.2, 0.3])
result = activations + bias

images = np.random.randn(2, 3, 4, 4)
scale = np.array([0.5, 1.0, 1.5]).reshape(1, 3, 1, 1)
result = images * scale

a = np.array([1, 2, 3]).reshape(-1, 1)
b = np.array([10, 20, 30, 40]).reshape(1, -1)
outer = a * b
```

通过广播计算成对距离：将 `(M, 2)` reshape 为 `(M, 1, 2)`，将 `(N, 2)` reshape 为 `(1, N, 2)`，相减、平方、沿最后一个轴求和、再开平方根。结果为 `(M, N)`。

### 第 6 步：einsum 运算

`demo_einsum()` 和 `demo_einsum_gallery()` 函数逐一演示了每一种常见模式。

```python
a = np.array([1.0, 2.0, 3.0])
b = np.array([4.0, 5.0, 6.0])
dot = np.einsum("i,i->", a, b)

A = np.array([[1, 2], [3, 4], [5, 6]], dtype=float)
B = np.array([[7, 8, 9], [10, 11, 12]], dtype=float)
matmul = np.einsum("ik,kj->ij", A, B)

batch_A = np.random.randn(4, 3, 5)
batch_B = np.random.randn(4, 5, 2)
batch_mm = np.einsum("bij,bjk->bik", batch_A, batch_B)
```

一次张量收缩（contraction）的计算开销，是所有索引大小（保留的和求和的）的乘积。对于 `bij,bjk->bik`，当 B=32、I=128、J=64、K=128 时：`32 * 128 * 64 * 128 = 33,554,432` 次乘加运算。

### 第 7 步：用 einsum 实现注意力机制

`demo_attention_einsum()` 函数端到端地实现了多头注意力。

```python
B, H, T, D = 2, 4, 8, 16
E = H * D

X = np.random.randn(B, T, E)
W_q = np.random.randn(E, E) * 0.02

Q = np.einsum("bte,ek->btk", X, W_q)
Q = Q.reshape(B, T, H, D).transpose(0, 2, 1, 3)

scores = np.einsum("bhtd,bhsd->bhts", Q, K) / np.sqrt(D)
weights = softmax(scores, axis=-1)
attn_output = np.einsum("bhts,bhsd->bhtd", weights, V)

concat = attn_output.transpose(0, 2, 1, 3).reshape(B, T, E)
output = np.einsum("bte,ek->btk", concat, W_o)
```

每一步都是一次张量运算：投影（通过 einsum 实现的 matmul）、拆分多头（reshape + transpose）、注意力分数（通过 einsum 实现的批量 matmul）、加权求和（通过 einsum 实现的批量 matmul）、合并多头（transpose + reshape）、输出投影（通过 einsum 实现的 matmul）。

## 实际运用

### 从零实现 vs NumPy

| 运算 | 从零实现（Tensor 类） | NumPy |
|---|---|---|
| 创建 | `Tensor([[1,2],[3,4]])` | `np.array([[1,2],[3,4]])` |
| Reshape | `t.reshape((3,4))` | `a.reshape(3,4)` |
| Transpose | `t.transpose(0,1)` | `a.T` 或 `a.transpose(0,1)` |
| Squeeze | `t.squeeze(0)` | `np.squeeze(a, 0)` |
| Sum | `t.sum(axis=0)` | `a.sum(axis=0)` |
| Einsum | 不适用 | `np.einsum("ij,jk->ik", a, b)` |

### 从零实现 vs PyTorch

```python
import torch

t = torch.tensor([[1, 2, 3], [4, 5, 6]], dtype=torch.float32)
t.shape
t.stride()
t.is_contiguous()

t.reshape(3, 2)
t.unsqueeze(0)
t.transpose(0, 1)
t.transpose(0, 1).contiguous()

torch.einsum("ik,kj->ij", A, B)
```

PyTorch 在此之上增加了自动微分（autograd）、GPU 支持以及优化的 BLAS 内核。形状语义则完全一致。如果你理解了从零实现的版本，PyTorch 的形状错误就会变得清晰可读。

### 把每一个神经网络层都看作张量运算

| 运算 | 张量形式 | Einsum |
|---|---|---|
| 线性层 | `Y = X @ W.T + b` | `"bd,od->bo"` + 偏置 |
| 注意力 QKV | `Q = X @ W_q` | `"btd,dh->bth"` |
| 注意力分数 | `Q @ K.T / sqrt(d)` | `"bhtd,bhsd->bhts"` |
| 注意力输出 | `softmax(scores) @ V` | `"bhts,bhsd->bhtd"` |
| 批归一化（Batch norm） | `(X - mu) / sigma * gamma` | 逐元素 + 广播 |
| Softmax | `exp(x) / sum(exp(x))` | 逐元素 + 归约 |

## 交付成果

本课产出两份可复用的提示词（prompt）：

1. **`outputs/prompt-tensor-shapes.md`**——一份用于调试张量形状不匹配的系统化提示词。包含针对每种常见运算（matmul、broadcast、cat、Linear、Conv2d、BatchNorm、softmax）的决策表，以及一张修复查找表。

2. **`outputs/prompt-tensor-debugger.md`**——一份分步调试提示词，当形状错误卡住你时，把它粘贴到任意 AI 助手中。喂给它错误信息和你的张量形状，它会回传确切的修复方案。

## 练习

1. **简单——reshape 往返。** 取一个形状为 `(2, 3, 4)` 的张量。将它 reshape 成 `(6, 4)`，再到 `(24,)`，再变回 `(2, 3, 4)`。在每一步打印扁平数据，验证元素顺序得到保持。

2. **中等——实现广播。** 为 `Tensor` 类扩展一个 `broadcast_to(shape)` 方法，将大小为 1 的维度扩展以匹配目标形状。然后修改 `_elementwise_op`，使其在运算前自动广播。用形状 `(3, 1)` 和 `(1, 4)` 产生 `(3, 4)` 进行测试。

3. **困难——从零构建 einsum。** 实现一个基础的 `einsum(subscripts, *tensors)` 函数，至少能处理：点积（`i,i->`）、矩阵乘法（`ij,jk->ik`）、外积（`i,j->ij`）和转置（`ij->ji`）。解析下标字符串，识别被收缩的索引，并遍历所有索引组合。将你的结果与 `np.einsum` 对比。

4. **困难——注意力形状追踪器。** 编写一个函数，以 `batch_size`、`seq_len`、`embed_dim` 和 `num_heads` 为输入，打印多头注意力每一步的精确形状：输入、Q/K/V 投影、拆分多头、注意力分数、softmax 权重、加权求和、合并多头、输出投影。与 `demo_attention_einsum()` 的输出进行验证。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|---|---|---|
| 张量（Tensor） | “就是维度更多的矩阵” | 一个具有统一类型，并定义了形状、步长与运算的多维数组 |
| 秩（Rank） | “维度的数量” | 轴的数量。矩阵的秩为 2，而不是等于它在线性代数意义上的矩阵秩 |
| 形状（Shape） | “张量的大小” | 一个列出每个轴大小的元组。`(2, 3)` 表示 2 行 3 列 |
| 步长（Stride） | “内存是怎么布局的” | 沿每个轴前进一个位置需要跳过的元素数量 |
| 广播（Broadcasting） | “形状不同时它自己就能搞定” | 一套严格的规则：从右对齐，维度必须相等或其中一个必须为 1 |
| 连续（Contiguous） | “张量是正常的” | 元素在内存中按顺序存储，相对逻辑布局没有间隙或重排 |
| Einsum | “一种花哨的 matmul 写法” | 一种通用记号，用一行表达任意张量收缩、外积、迹或转置 |
| 视图（View） | “和 reshape 一样” | 一个共享同一内存缓冲区、但拥有不同形状/步长元数据的张量。在非连续数据上会失败 |
| 收缩（Contraction） | “对某个索引求和” | 一种通用运算：将张量间的共享索引相乘并求和，产出秩更低的结果 |
| NCHW / NHWC | “PyTorch 与 TensorFlow 的格式” | 图像张量的内存布局惯例。NCHW 把通道放在空间维度之前，NHWC 放在之后 |

## 延伸阅读

- [NumPy Broadcasting](https://numpy.org/doc/stable/user/basics.broadcasting.html)——附带可视化示例的权威规则
- [PyTorch Tensor Views](https://pytorch.org/docs/stable/tensor_view.html)——视图何时生效、何时发生复制
- [einops](https://github.com/arogozhnikov/einops)——让张量 reshape 变得可读且安全的库
- [The Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/)——可视化流经注意力的张量形状
- [Einstein Summation in NumPy](https://numpy.org/doc/stable/reference/generated/numpy.einsum.html)——完整的 einsum 文档与示例
