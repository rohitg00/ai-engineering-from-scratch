# 注意力变体 — 滑动窗口、稀疏、差分

> 完整注意力是一个圆。每个 token 都能看到每个 token，而内存为此付出代价。四种变体弯曲了这个圆的形状，并收回一半的成本。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02（Self-Attention）、Phase 7 · 03（Multi-Head）、Phase 7 · 12（KV Cache / Flash Attention）
**Time:** 约 60 分钟

## 问题所在

完整注意力的内存成本为 `O(N²)`，计算成本随序列长度按 `O(N²)` 增长。对于 128K 上下文的 Llama 3 70B，每层有 160 亿个注意力条目，再乘以 80 层。Flash Attention（第 12 课）隐藏了 `O(N²)` 的激活内存，但并未改变计算成本——每个 token 仍然要关注所有其他 token。

三类变体改变了注意力矩阵本身的拓扑结构：

1. **滑动窗口注意力（SWA）。** 每个 token 只关注固定窗口内的邻居，而不是完整前缀。内存和计算降至 `O(N · W)`，其中 `W` 是窗口大小。Gemma 2/3、Mistral 7B 的前几层、Phi-3-Long。
2. **稀疏 / 分块注意力。** 只对选定的注意力对 `(i, j)` 打分；其余强制为零权重。Longformer、BigBird、OpenAI sparse transformer。
3. **差分注意力。** 用两组独立的 Q/K 投影计算两个注意力图，然后相减。消除把权重泄漏到前几个 token 上的“注意力池”。微软的 DIFF Transformer（2024）。

这些变体可以共存。2026 年的前沿模型常常混合使用：大多数层是 SWA-1024，每五层有一个全局完整注意力层，另有少数差分注意力头用于清理检索。Gemma 3 的 5:1 SWA 与全局之比是当前的教科书默认配置。

## 核心概念

### 滑动窗口注意力（SWA）

位置 `i` 的每个 query 只关注 `[i - W, i]`（因果 SWA）或 `[i - W/2, i + W/2]`（双向）范围内的位置。窗口外的 token 在得分矩阵中为 `-inf`。

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

对于 `N = 8192` 和 `W = 1024`，得分矩阵期望只有 1024 × 8192 个非零行——8 倍的缩减。

**KV cache 随 SWA 缩小。** 每层只需保留最后 `W` 个 token 的 K 和 V。对于类似 Gemma-3 的配置（1024 窗口，128K 上下文），KV cache 下降 128 倍。

**质量代价。** 纯 SWA 的 Transformer 在长程检索上表现吃力。解决办法：将 SWA 层与完整注意力层交错。Gemma 3 使用 5:1 的 SWA:全局比例。Mistral 7B 使用因果 SWA 堆叠，信息通过重叠窗口“向前流动”——每层将有效感受野扩展 `W`，经过 `L` 层后模型可以回看 `L × W` 个 token。

### 稀疏 / 分块注意力

预先选定一种 `N × N` 稀疏模式。三种经典形状：

- **局部 + 跨步（OpenAI sparse transformer）。** 关注最后 `W` 个 token，加上之前的每个第 `stride` 个 token。以 `O(N · sqrt(N))` 的计算成本同时捕捉局部和长程信息。
- **Longformer / BigBird。** 局部窗口 + 少量全局 token（例如 `[CLS]`），这些全局 token 关注所有人并被所有人关注，再加上随机稀疏连接。在匹配质量下经验上达到 2 倍上下文。
- **Native Sparse Attention（DeepSeek，2025）。** 学习哪些 `(Q, K)` 块重要；在 kernel 层面跳过零块。与 FlashAttention 兼容。

稀疏注意力是一个 kernel 工程故事。数学很简单（对得分矩阵做掩码）；收益来自永不将零元素加载进 SRAM。FlashAttention-3 和 2026 年的 FlexAttention API 使自定义稀疏模式成为 PyTorch 中的一等公民。

### 差分注意力（DIFF Transformer，2024）

常规注意力存在“注意力池”问题：softmax 强制每行和为 1，因此不需要关注任何具体内容的 token 会把权重倾倒到第一个（或前几个）token 上。这窃取了本应分配给真实内容的容量。

差分注意力通过计算**两个**注意力图并相减来解决这个问题：

```
A1 = softmax(Q1 K1^T / √d)
A2 = softmax(Q2 K2^T / √d)
DiffAttn = (A1 - λ · A2) V
```

其中 `λ` 是一个可学习的标量（通常 0.5–0.8）。A1 捕捉真实内容权重；A2 捕捉注意力池。相减消除了池，把权重重新分配给相关 token。

报告结果（微软 2024）：困惑度降低 5–10%，在相同训练长度下有效上下文延长 1.5–2 倍，大海捞针检索更敏锐。

### 变体对比

| 变体 | 计算 | KV cache | 相对完整注意力的质量 | 生产使用 |
|---------|---------|----------|-----------------|----------------|
| 完整注意力 | O(N²) | 每层 O(N) | 基线 | 所有模型的默认层 |
| SWA（窗口 1024） | O(N·W) | 每层 O(W) | -0.1 ppl，配合全局层表现良好 | Gemma 2/3、Phi-3-Long |
| 局部 + 跨步稀疏 | O(N·√N) | 混合 | 类似 SWA | OpenAI sparse transformer、Longformer |
| BigBird（局部 + 全局 + 随机） | O(N) 近似 | 混合 | 在 2 倍上下文下匹配完整注意力 | 早期长上下文 BERT |
| Native Sparse（DeepSeek-V3.2） | O(N · active fraction) | O(N) | 0.05 ppl 以内 | DeepSeek-V3.2，2025 |
| 差分 | O(2·N²) | O(2N) | -5 到 -10% ppl | DIFF Transformer、2026 年早期模型 |

```figure
gqa-kv-sharing
```

## 动手构建

参见 `code/main.py`。我们实现一个因果掩码比较器，在玩具序列上并排展示完整、SWA、局部+跨步和差分注意力。

### 步骤 1：完整因果掩码（基线）

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

来自第 07 课的基线。下三角；对角线以上权重为零。

### 步骤 2：滑动窗口因果掩码

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

一个参数——`window`。当 `window >= n` 时，退化为完整因果注意力。当 `window = 1` 时，每个 token 只关注自身。

### 步骤 3：局部 + 跨步稀疏掩码

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

稠密的局部窗口，加上回到序列开头的每个第 `stride` 个 token。感受野随层数按对数步长增长。

### 步骤 4：差分注意力

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

两次注意力计算，用可学习的混合系数相减。代码中我们对比单注意力与差分注意力的注意力池热力图，观察池的坍缩。

### 步骤 5：KV cache 大小

打印每种变体在 `N = 131072` 下每层的缓存大小。SWA 和稀疏变体下降 10–100 倍。差分翻倍。有意识地支付你的内存账单。

## 实际应用

2026 年生产模式：

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
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

这会编译为自定义 Triton kernel。在常见模式下速度达到 FlashAttention-3 的 90% 以内，且掩码函数就是一个 Python callable。

**何时选择哪种：**

- **纯完整注意力** — 上下文不超过约 16K 的所有层，或检索质量至上的场景。
- **SWA + 全局混合** — 长上下文（>32K），训练和推理受内存限制。这是 2026 年 32K 以上的默认选择。
- **稀疏分块注意力** — 自定义 kernel、自定义模式。留给特殊工作负载（检索、音频）。
- **差分注意力** — 任何受注意力池污染伤害的工作负载（长上下文 RAG、大海捞针）。

## 上线交付

参见 `outputs/skill-attention-variant-picker.md`。该技能根据目标上下文长度、检索需求和训练/推理计算画像，为新模型选择注意力拓扑。

## 练习

1. **简单。** 运行 `code/main.py`。验证 `window=4` 下的 SWA 将每行最后 4 个 token 之外的所有内容置零。验证 `window=n` 在位级上完全复现完整因果注意力。
2. **中等。** 在第 07 课毕业项目之上实现带 `window=1024` 的因果 SWA。在 tinyshakespeare 上训练 1,000 步。验证损失相对完整注意力回退多少？峰值内存下降多少？
3. **困难。** 在毕业项目模型中实现 Gemma-3 风格的 5:1 层混合（5 层 SWA，1 层全局）。在匹配参数量下，比较损失、内存和生成质量与纯 SWA 和纯全局基线。
4. **困难。** 实现带每头可学习 `λ` 的差分注意力。在合成检索任务（一根针，2,000 个干扰项）上训练。在匹配参数量下测量检索准确率与单注意力基线的差异。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 滑动窗口注意力（SWA） | “局部注意力” | 每个 query 关注其最后 `W` 个 token；KV cache 缩小到 `O(W)`。 |
| 有效感受野 | “模型能看多远” | 在窗口为 `W` 的 `L` 层 SWA 堆叠中，最多 `L × W` 个 token。 |
| Longformer / BigBird | “局部 + 全局 + 随机” | 带少量始终参与注意力的全局 token 的稀疏模式；早期长上下文方案。 |
| Native Sparse Attention | “DeepSeek 的 kernel 技巧” | 学习块级稀疏性；在 kernel 层面跳过零块，同时保持质量。 |
| 差分注意力 | “两个图，一个相减” | DIFF Transformer：从第一个注意力图中减去可学习的 `λ` 乘以第二个注意力图，以消除注意力池。 |
| 注意力池 | “权重泄漏到 token 0” | softmax 归一化强制每行和为 1；无信息量的 query 将权重倾倒在位置 0 上。 |
| FlexAttention | “掩码即 Python” | PyTorch 2.5+ API，将任意掩码函数编译为 FlashAttention 形态的 kernel。 |
| 层类型混合 | “5:1 SWA 与全局之比” | 在堆叠中交错稀疏与完整注意力层，以更低的内存保持质量。 |

## 延伸阅读

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) — 经典的滑动窗口 + 全局 token 论文。
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062) — 局部 + 全局 + 随机。
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) — OpenAI 的局部+跨步模式。
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) — 1:1 的 SWA:全局混合。
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) — 窗口为 1024 的 5:1 混合，现已成为教科书默认配置。
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) — DIFF Transformer 论文。
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089) — DeepSeek-V3.2 的学习型稀疏注意力。
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/) — “应用实践”部分掩码即 callable 模式的 API 参考。