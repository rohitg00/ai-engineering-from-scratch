# 15 · 注意力变体——滑动窗口、稀疏、差分

> 完整注意力是一个圆。每个 token 都看到所有其他 token，而内存为此付出代价。四种变体扭曲了这个圆的形状，挽回了一半的开销。

**类型：** 构建
**语言：** Python
**前置：** 阶段 7 · 02（自注意力）、阶段 7 · 03（多头注意力）、阶段 7 · 12（KV 缓存 / Flash Attention）
**时长：** 约 60 分钟

## 问题所在

完整注意力在序列长度上的内存开销为 `O(N²)`，计算开销也为 `O(N²)`。对于一个 128K 上下文的 Llama 3 70B 来说，这意味着每层有 160 亿个注意力条目，再乘以 80 层。Flash Attention（第 12 课）隐藏了 `O(N²)` 的激活内存，但并未改变算术开销——每个 token 仍然要关注其他所有 token。

有三类变体改变了注意力矩阵本身的拓扑结构：

1. **滑动窗口注意力（Sliding Window Attention，SWA）。** 每个 token 只关注固定窗口内的邻居，而非完整前缀。内存和计算下降到 `O(N · W)`，其中 `W` 是窗口大小。代表：Gemma 2/3、Mistral 7B 的前几层、Phi-3-Long。
2. **稀疏 / 分块注意力（Sparse / Block Attention）。** 只对选定的 `(i, j)` 对进行打分；其余被强制为零权重。代表：Longformer、BigBird、OpenAI 稀疏 transformer。
3. **差分注意力（Differential Attention）。** 用两组独立的 Q/K 投影计算两张注意力图，再相减。它消除了把权重泄漏到前几个 token 上的「注意力沉没（attention sink）」。代表：微软的 DIFF Transformer（2024）。

这些变体可以共存。一个 2026 年的前沿模型往往会混用它们：大多数层是 SWA-1024，每隔五层有一层是全局完整注意力，还有少数几个差分头用于清理检索。Gemma 3 的 5:1 SWA-to-global 比例是目前的教科书默认配置。

## 概念解析

### 滑动窗口注意力（SWA）

位置 `i` 处的每个查询只关注 `[i - W, i]` 范围内的位置（因果 SWA）或 `[i - W/2, i + W/2]` 范围内的位置（双向）。窗口外的 token 在分数矩阵中得到 `-inf`。

```
full causal:           sliding window (W=4):
positions 0-7          positions 0-7, W=4
    0 1 2 3 4 5 6 7        0 1 2 3 4 5 6 7
0 | x                0 |  x
1 | x x              1 |  x x
2 | x x x            2 |  x x x
3 | x x x x          3 |  x x x x
4 | x x x x x        4 |    x x x x
5 | x x x x x x      5 |      x x x x
6 | x x x x x x x    6 |        x x x x
7 | x x x x x x x x  7 |          x x x x
```

对于 `N = 8192` 和 `W = 1024`，分数矩阵期望上有 1024 × 8192 个非零行——减少了 8 倍。

**KV 缓存随 SWA 缩小。** 每层只需保留 K 和 V 的最后 `W` 个 token。对于一个类 Gemma-3 的配置（1024 窗口，128K 上下文），KV 缓存下降 128 倍。

**质量代价。** 纯 SWA 的 transformer 在长距离检索上表现吃力。解决办法：把 SWA 层与完整注意力层交错。Gemma 3 采用 5:1 的 SWA:global 比例。Mistral 7B 使用了一种因果 SWA 堆叠，信息通过重叠的窗口「向前流动」——每一层都把有效感受野扩展 `W`，经过 `L` 层后，模型可以回看 `L × W` 个 token。

### 稀疏 / 分块注意力

提前选定一个 `N × N` 的稀疏模式。三种典型形态：

- **局部 + 跨步（OpenAI 稀疏 transformer）。** 关注最后 `W` 个 token，外加之前每隔 `stride` 个的 token。以 `O(N · sqrt(N))` 的计算量同时捕获局部和长距离信息。
- **Longformer / BigBird。** 局部窗口 + 一小组全局 token（例如 `[CLS]`），这些全局 token 关注所有 token 也被所有 token 关注，再加上随机稀疏连接。经验上可在质量持平的情况下把上下文翻倍。
- **原生稀疏注意力（Native Sparse Attention，DeepSeek，2025）。** 学习哪些 `(Q, K)` 块是重要的；在 kernel 层面跳过零块。与 FlashAttention 兼容。

稀疏注意力本质上是一个 kernel 工程问题。数学很简单（对分数矩阵做掩码）；收益来自永远不把零条目加载进 SRAM。FlashAttention-3 和 2026 年的 FlexAttention API 让自定义稀疏模式在 PyTorch 中成为一等公民。

### 差分注意力（DIFF Transformer，2024）

常规注意力有一个「注意力沉没」问题：softmax 强制每一行求和为 1，于是那些并不想特别关注任何内容的 token 会把权重倾倒在第一个 token（或前几个）上。这窃取了本该用于真实内容的容量。

差分注意力通过计算**两张**注意力图并相减来解决这个问题：

```
A1 = softmax(Q1 K1^T / √d)
A2 = softmax(Q2 K2^T / √d)
DiffAttn = (A1 - λ · A2) V
```

其中 `λ` 是一个可学习的标量（通常为 0.5–0.8）。A1 捕获真实的内容权重；A2 捕获沉没。相减抵消了沉没，把权重重新分配给相关 token。

报告结果（微软 2024）：困惑度（perplexity）降低 5–10%，在相同训练长度下有效上下文延长 1.5–2 倍，大海捞针式检索更加锐利。

### 变体对比

| 变体 | 计算 | KV 缓存 | 相对完整注意力的质量 | 生产应用 |
|---------|---------|----------|-----------------|----------------|
| 完整注意力 | O(N²) | 每层 O(N) | 基准 | 每个模型的默认层 |
| SWA（窗口 1024） | O(N·W) | 每层 O(W) | -0.1 ppl，配合全局层效果好 | Gemma 2/3、Phi-3-Long |
| 局部 + 跨步稀疏 | O(N·√N) | 混合 | 与 SWA 相近 | OpenAI 稀疏 transformer、Longformer |
| BigBird（局部 + 全局 + 随机） | O(N) 近似 | 混合 | 在 2 倍上下文下追平完整注意力 | 早期长上下文 BERT |
| 原生稀疏（DeepSeek-V3.2） | O(N · 活跃比例) | O(N) | 困惑度差距在 0.05 以内 | DeepSeek-V3.2，2025 |
| 差分 | O(2·N²) | O(2N) | 困惑度降低 5%–10% | DIFF Transformer、2026 年初的模型 |

## 动手构建

参见 `code/main.py`。我们实现了一个因果掩码对比器，在一个玩具序列上并排展示完整、SWA、局部+跨步、以及差分注意力。

### 第 1 步：完整因果掩码（基准）

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

来自第 07 课的基准。下三角矩阵；对角线以上为零权重。

### 第 2 步：滑动窗口因果掩码

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

只有一个参数——`window`。当 `window >= n` 时，恢复为完整因果注意力。当 `window = 1` 时，每个 token 只关注自己。

### 第 3 步：局部 + 跨步稀疏掩码

```python
def strided_mask(n, window, stride):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
        for j in range(0, i + 1, stride):
            M[i][j] = 0.0
    return M
```

稠密的局部窗口，外加回溯到序列起点的每隔 `stride` 个的 token。随着层数增加，感受野以对数步长增长。

### 第 4 步：差分注意力

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

两次注意力计算，用一个可学习的混合系数相减。在代码中我们对比了单一注意力与差分注意力的注意力沉没热力图，观察沉没如何坍缩消失。

### 第 5 步：KV 缓存大小

在 `N = 131072` 下打印每种变体的每层缓存大小。SWA 和稀疏变体下降 10–100 倍。差分则翻倍。要清醒地为你的内存账单买单。

## 实际使用

2026 年的生产模式：

```python
from transformers import AutoModelForCausalLM
# Gemma 3 以 5:1 的比例混用 SWA（window=1024）和全局层。
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

PyTorch 2.5+ 中的 FlexAttention 接受一个掩码函数：

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

这会编译成一个自定义 Triton kernel。对于常见模式，速度在 FlashAttention-3 的 10% 范围内，而掩码函数本身就是一个 Python 可调用对象。

**如何选择各变体：**

- **纯完整注意力**——上下文约 16K 以内的每一层，或当检索质量至关重要时。
- **SWA + 全局混合**——长上下文（>32K），训练和推理受内存限制时。这是 2026 年 32K 以上的默认选择。
- **稀疏分块注意力**——自定义 kernel、自定义模式。仅用于特殊工作负载（检索、音频）。
- **差分注意力**——任何受注意力沉没污染困扰的工作负载（长上下文 RAG、大海捞针）。

## 上线交付

参见 `outputs/skill-attention-variant-picker.md`。该 skill 会根据目标上下文长度、检索需求以及训练/推理计算特征，为一个新模型选择注意力拓扑。

## 练习

1. **简单。** 运行 `code/main.py`。验证 `window=4` 的 SWA 会把每行最后 4 个 token 之外的所有内容置零。验证 `window=n` 能逐位复现完整因果注意力。
2. **中等。** 在第 07 课的 capstone 之上实现 `window=1024` 的因果 SWA。在 tinyshakespeare 上训练 1,000 步。相比完整注意力，验证损失回退了多少？峰值内存下降了多少？
3. **困难。** 在 capstone 模型中实现 Gemma-3 风格的 5:1 层混合（5 层 SWA，1 层全局）。在参数匹配的条件下，将其损失、内存和生成质量与纯 SWA 和纯全局基准进行对比。
4. **困难。** 实现每个头带有可学习 `λ` 的差分注意力。在一个合成检索任务（1 根针，2,000 个干扰项）上训练。在参数匹配的条件下，测量其相对单一注意力基准的检索准确率。

## 关键术语

| 术语 | 人们常说 | 实际含义 |
|------|-----------------|-----------------------|
| 滑动窗口注意力（SWA） | 「局部注意力」 | 每个查询关注它最后的 `W` 个 token；KV 缓存缩减为 `O(W)`。 |
| 有效感受野 | 「模型能往回看多远」 | 在窗口为 `W` 的 `L` 层 SWA 堆叠中，最多 `L × W` 个 token。 |
| Longformer / BigBird | 「局部 + 全局 + 随机」 | 带有少量始终参与注意力的全局 token 的稀疏模式；早期的长上下文方案。 |
| 原生稀疏注意力 | 「DeepSeek 的 kernel 技巧」 | 学习块级稀疏性；在 kernel 层面跳过零块同时保持质量。 |
| 差分注意力 | 「两张图，一张做减法」 | DIFF Transformer：从第一张注意力图中减去 `λ` 倍的第二张，以抵消注意力沉没。 |
| 注意力沉没（attention sink） | 「权重泄漏到 token 0」 | softmax 归一化强制每行求和为 1；无信息量的查询把权重倾倒在位置 0 上。 |
| FlexAttention | 「掩码即 Python」 | PyTorch 2.5+ 的 API，把任意掩码函数编译成 FlashAttention 形态的 kernel。 |
| 层类型混合 | 「5:1 SWA-to-global」 | 在堆叠中交错稀疏层和完整注意力层，以更低内存保持质量。 |

## 延伸阅读

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) ——经典的滑动窗口 + 全局 token 论文。
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062) ——局部 + 全局 + 随机。
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) ——OpenAI 的局部+跨步模式。
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) ——1:1 的 SWA:global 混合。
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) ——5:1 混合、window=1024，现已成为教科书默认配置。
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) ——DIFF Transformer 论文。
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089) ——DeepSeek-V3.2 的可学习稀疏注意力。
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/) ——「实际使用」中掩码即可调用对象模式的 API 参考。
