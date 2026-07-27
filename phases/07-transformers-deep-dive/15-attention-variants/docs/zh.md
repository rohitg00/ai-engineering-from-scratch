# Attention Variants — Sliding Window、Sparse、Differential

> 完整注意力是一个圆。每个 token 看到每个 token，内存付出代价。四种变体改变了圆的形状，收回了一半成本。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head), Phase 7 · 12 (KV Cache / Flash Attention)
**Time:** ~60 分钟

## 问题

完整注意力在序列长度上成本为 `O(N²)` 内存和 `O(N²)` 计算。对于一个 128K 上下文的 Llama 3 70B，每层有 160 亿个注意力条目，乘以 80 层。Flash Attention（第 12 课）隐藏了 `O(N²)` 的激活内存，但不改变算术成本——每个 token 仍然关注每个其他 token。

三类变体改变了注意力矩阵本身的拓扑：

1. **Sliding window attention (SWA)。** 每个 token 关注一个固定的邻居窗口，而不是整个前缀。内存和计算降至 `O(N · W)`，其中 `W` 是窗口。Gemma 2/3、Mistral 7B 的前几层、Phi-3-Long。
2. **Sparse / block attention。** 只有选定的 `(i, j)` 对被评分；其余被强制为零权重。Longformer、BigBird、OpenAI sparse transformer。
3. **Differential attention。** 用独立的 Q/K 投影计算两个注意力图，一个减去另一个。消灭了将权重泄漏到前几个 token 的"注意力汇"。微软的 DIFF Transformer（2024）。

这些并存。一个 2026 年的前沿模型经常混合使用它们：大多数层是 SWA-1024，每五个有一层全局完整注意力，少数是清理检索的 differential heads。Gemma 3 的 5:1 SWA 与全局比率是当前的教科书默认。

## 概念

### Sliding Window Attention (SWA)

位置 `i` 的每个 query 只关注 `[i - W, i]`（因果 SWA）或 `[i - W/2, i + W/2]`（双向）中的位置。窗口外的 token 在分数矩阵中获取 `-inf`。

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

对于 `N = 8192` 和 `W = 1024`，分数矩阵在期望中有 1024 × 8192 个非零行——8 倍减少。

**KV cache 随 SWA 缩小。** 每层只需保留最后的 `W` 个 token 的 K 和 V。对于类似 Gemma-3 的配置（1024 窗口，128K 上下文），KV cache 减少 128 倍。

**质量成本。** 纯 SWA transformer 难以应对长距离检索。修复方案：在 SWA 层之间穿插完整注意力层。Gemma 3 使用 5:1 SWA:global。Mistral 7B 使用了因果 SWA 堆叠，其中信息通过重叠窗口"向前流动"——每层将有效感受野扩展 `W`，经过 `L` 层后，模型可以关注回 `L × W` 个 token。

### Sparse / Block Attention

提前选择一个 `N × N` 稀疏模式。三种经典形状：

- **Local + strided（OpenAI sparse transformer）。** 关注最后的 `W` 个 token 加上之前每 `stride` 个 token。以 `O(N · sqrt(N))` 计算同时捕获局部和长程信息。
- **Longformer / BigBird。** 局部窗口 + 一小组全局 token（如 `[CLS]`），它们关注所有人并被所有人关注 + 随机稀疏链接。在匹配质量下经验性 2× 上下文。
- **Native Sparse Attention（DeepSeek, 2025）。** 学习哪些 `(Q, K)` 块重要；在内核级别跳过零块。兼容 FlashAttention。

Sparse attention 是一个内核工程故事。数学很简单（掩码分数矩阵）；胜利来自于从不将零条目加载到 SRAM 中。FlashAttention-3 和 2026 年的 FlexAttention API 使自定义稀疏模式在 PyTorch 中成为一等公民。

### Differential Attention（DIFF Transformer, 2024）

常规注意力有一个"注意力汇"问题：softmax 强制每行求和为 1，所以不想特别关注任何东西的 token 将权重倾倒在第一个 token（或前几个）上。这偷走了本应用于真实内容的容量。

Differential attention 通过计算**两个**注意力图并相减来修复：

```
A1 = softmax(Q1 K1^T / √d)
A2 = softmax(Q2 K2^T / √d)
DiffAttn = (A1 - λ · A2) V
```

其中 `λ` 是一个学习的标量（通常 0.5–0.8）。A1 捕获真实内容权重；A2 捕获汇。相减抵消汇，将权重重新分配给相关 token。

报告的结果（微软 2024）：perplexity 降低 5–10%，在相同训练长度下有效上下文延长 1.5–2×，更尖锐的 needle-in-haystack 检索。

### 变体比较

| 变体 | 计算量 | KV cache | 质量 vs 完整 | 生产使用 |
|---------|---------|----------|-----------------|----------------|
| Full attention | O(N²) | 每层 O(N) | 基线 | 每个模型的默认层 |
| SWA (window 1024) | O(N·W) | 每层 O(W) | -0.1 ppl，配合全局层效果好 | Gemma 2/3, Phi-3-Long |
| Local + strided sparse | O(N·√N) | 混合 | 类似 SWA | OpenAI sparse transformer, Longformer |
| BigBird (local + global + random) | O(N) 近似 | 混合 | 在 2× 上下文中匹配完整 | 早期长上下文 BERT |
| Native Sparse (DeepSeek-V3.2) | O(N · active fraction) | O(N) | 在 0.05 ppl 内 | DeepSeek-V3.2, 2025 |
| Differential | O(2·N²) | O(2N) | -5 到 -10% ppl | DIFF Transformer, 早期 2026 模型 |

## 动手构建

参见 `code/main.py`。我们实现一个因果掩码比较器，在一个玩具序列上并排显示完整、SWA、local+strided 和 differential attention。

### 步骤 1：完整因果掩码（基线）

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

来自第 07 课的基线。下三角；对角线以上为零权重。

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

一个参数——`window`。当 `window >= n` 时，你恢复了完整因果注意力。当 `window = 1` 时，每个 token 只关注自己。

### 步骤 3：local + strided 稀疏掩码

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

稠密局部窗口加上每 `stride` 个 token 回到序列开头。随着额外层的增加，感受野以对数步长增长。

### 步骤 4：Differential attention

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

两次注意力传递，用一个学习到的混合系数相减。在代码中我们比较单注意力与 differential 的注意力汇热力图，观察汇的消失。

### 步骤 5：KV cache 大小

在 `N = 131072` 时打印每种变体的每层缓存大小。SWA 和稀疏变体下降 10–100×。Differential 加倍。有意识地支付你的内存账单。

## 实际应用

2026 年生产模式：

```python
from transformers import AutoModelForCausalLM
# Gemma 3 以 5:1 混合 SWA（window=1024）和全局层。
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

这编译为一个自定义 Triton 内核。对常见模式，速度在 FlashAttention-3 的 10% 以内，且掩码函数是一个 Python 可调用对象。

**何时选择每种：**

- **纯完整注意力** — 每层直至约 16K 上下文，或当检索质量至关重要时。
- **SWA + 全局混合** — 长上下文（>32K），训练和推理内存受限。32K 以上的 2026 年默认。
- **稀疏块注意力** — 自定义内核，自定义模式。保留给专门工作负载（检索、音频）。
- **Differential attention** — 任何注意力汇污染有害的工作负载（长上下文 RAG、needle-in-haystack）。

## 交付

参见 `outputs/skill-attention-variant-picker.md`。该 skill 根据目标上下文长度、检索需求和训练/推理计算概况选择注意力拓扑。

## 练习

1. **简单。** 运行 `code/main.py`。验证 `window=4` 的 SWA 将每行最后 4 个 token 之外的所有内容清零。验证 `window=n` 比特一致地再现完整因果注意力。
2. **中等。** 在第 07 课收官之作上实现 `window=1024` 的因果 SWA。在 tinyshakespeare 上训练 1,000 步。验证损失相对于完整注意力退化了多少？峰值内存下降了多？
3. **困难。** 在收官模型上实现 Gemma-3 风格的 5:1 层混合（5 SWA, 1 global）。在匹配参数下与纯 SWA 和纯 global 基线比较损失、内存和生成质量。
4. **困难。** 实现带有每 head 学习 `λ` 的 differential attention。在合成检索任务（一个 needle，2,000 个干扰项）上训练。在匹配参数下测量与单注意力基线的检索准确率。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| Sliding window attention (SWA) | "局部注意力" | 每个 query 关注其最后的 `W` 个 token；KV cache 缩小到 `O(W)`。 |
| Effective receptive field | "模型能看多远" | 在 `L` 层 SWA 堆叠中，窗口 `W`，最多 `L × W` 个 token。 |
| Longformer / BigBird | "局部 + 全局 + 随机" | 带有少量始终关注的全局 token 的稀疏模式；早期长上下文方法。 |
| Native Sparse Attention | "DeepSeek 的内核技巧" | 学习块级稀疏性；在内核级别跳过零块同时保持质量。 |
| Differential attention | "两个图，一个相减" | DIFF Transformer：从第一个注意力图中减去学习的 `λ` 乘以第二个注意力图以消除注意力汇。 |
| Attention sink | "权重泄漏到 token 0" | Softmax 归一化强制行求和为 1；无信息的 query 将权重倾倒在位置 0。 |
| FlexAttention | "掩码即 Python" | PyTorch 2.5+ API，将任意掩码函数编译为 FlashAttention 形状的内核。 |
| Layer type mix | "5:1 SWA 与全局" | 在堆叠中交错稀疏和完整注意力层，以较低内存保持质量。 |

## 延伸阅读

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) — 典范的滑动窗口 + 全局 token 论文。
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062) — local + global + random。
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) — OpenAI 的 local+strided 模式。
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) — 1:1 SWA:global 混合。
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) — 5:1 混合，window=1024，现在是教科书默认。
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) — DIFF Transformer 论文。
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089) — DeepSeek-V3.2 的学习稀疏注意力。
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/) — 关于 Use It 中掩码即回调模式的 API 参考。
