# Attention 变体 —— 滑动窗口、稀疏、差分

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 完整 attention（注意力）是一个圈：每个 token 看到每个 token，而内存为此付出代价。四种变体扭曲这个圆的形状，能省下一半成本。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head), Phase 7 · 12 (KV Cache / Flash Attention)
**Time:** ~60 minutes

## 问题（The Problem）

完整 attention 在序列长度上的内存和计算代价都是 `O(N²)`。对于 128K 上下文的 Llama 3 70B，这意味着每层有 160 亿个 attention 项，再乘以 80 层。Flash Attention（第 12 课）隐藏了 `O(N²)` 的激活内存，但并没有改变算术成本——每个 token 仍然要 attend 到其他每个 token。

有三类变体改变了 attention 矩阵自身的拓扑：

1. **滑动窗口 attention（Sliding window attention，SWA）。** 每个 token 只 attend 到固定窗口内的邻居，而不是整个前缀。内存和计算降到 `O(N · W)`，其中 `W` 是窗口大小。Gemma 2/3、Mistral 7B 的前几层、Phi-3-Long 都是这种。
2. **稀疏 / 块状 attention。** 只对选定的 `(i, j)` 对打分；其余被强制为零权重。代表是 Longformer、BigBird、OpenAI sparse transformer。
3. **差分 attention（Differential attention）。** 用两套独立的 Q/K 投影计算两张 attention 图，然后相减。这能消掉「attention sink」——本来权重会泄漏到前几个 token。微软 DIFF Transformer（2024）。

它们可以共存。2026 年的前沿模型常常把它们混着用：大多数层是 SWA-1024，每隔五层来一层全局完整 attention，再加少量做检索清理的差分 head。Gemma 3 的 5:1 SWA-比-全局的比例，是当下的教科书默认配置。

## 概念（The Concept）

### 滑动窗口 Attention（Sliding Window Attention，SWA）

位置 `i` 处的 query 只 attend 到 `[i - W, i]`（因果 SWA）或 `[i - W/2, i + W/2]`（双向）范围内的位置。窗口外的 token 在打分矩阵里取 `-inf`。

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

当 `N = 8192`、`W = 1024` 时，打分矩阵期望非零行数是 1024 × 8192——8 倍缩减。

**KV cache 也随 SWA 缩小。** 每层只需要保留 K 和 V 的最后 `W` 个 token。对一份 Gemma-3 风格的配置（窗口 1024，128K 上下文），KV cache 直接降到 1/128。

**质量代价。** 纯 SWA 的 transformer 在长程检索上吃不消。修补办法：在 SWA 层中间穿插全 attention 层。Gemma 3 用 5:1 的 SWA:global。Mistral 7B 用了一个因果 SWA 栈，让信息「向前流动」穿过相邻窗口——每一层把有效感受野扩大 `W`，`L` 层之后模型可以 attend 到 `L × W` 个 token 之前。

### 稀疏 / 块状 Attention

提前选定一个 `N × N` 的稀疏模式。三种经典形态：

- **局部 + 跨步（OpenAI sparse transformer）。** Attend 到最后 `W` 个 token，再加上之前每隔 `stride` 个 token 中的一个。在 `O(N · sqrt(N))` 计算量内捕捉局部和长程信号。
- **Longformer / BigBird。** 局部窗口 + 一小撮全局 token（比如 `[CLS]`），它们 attend 所有人也被所有人 attend，再加上随机稀疏连边。在质量持平的前提下经验上能扩到 2 倍上下文。
- **Native Sparse Attention（DeepSeek，2025）。** 学习哪些 `(Q, K)` 块重要；在 kernel 层面跳过零块。FlashAttention 兼容。

稀疏 attention 是个 kernel 工程故事。数学很简单（mask 打分矩阵），收益来自永远不把零项加载进 SRAM。FlashAttention-3 和 2026 年的 FlexAttention API 把自定义稀疏模式变成了 PyTorch 里的一等公民。

### 差分 Attention（DIFF Transformer，2024）

普通 attention 有个「attention sink（注意力沉降）」问题：softmax 强迫每行加和为 1，于是那些没什么好 attend 的 token 就会把权重倾倒到第一个 token（或前几个）上。这等于偷走了本该用于真实内容的容量。

差分 attention 通过计算**两张** attention 图并相减来修这个问题：

```
A1 = softmax(Q1 K1^T / √d)
A2 = softmax(Q2 K2^T / √d)
DiffAttn = (A1 - λ · A2) V
```

其中 `λ` 是一个学得的标量（一般在 0.5–0.8）。A1 捕捉真实内容权重，A2 捕捉 sink。相减把 sink 抵消，把权重重新分给相关 token。

报告结果（微软 2024）：困惑度（perplexity）降低 5–10%，在相同训练长度下有效上下文延长 1.5–2 倍，大海捞针式检索更锐利。

### 变体对比

| 变体 | 计算量 | KV cache | 相对于完整 attention 的质量 | 生产环境用途 |
|---------|---------|----------|-----------------|----------------|
| 完整 attention | O(N²) | 每层 O(N) | 基准（baseline） | 每个模型的默认层 |
| SWA（窗口 1024） | O(N·W) | 每层 O(W) | -0.1 ppl，配合全局层效果不错 | Gemma 2/3、Phi-3-Long |
| 局部 + 跨步稀疏 | O(N·√N) | 混合 | 与 SWA 接近 | OpenAI sparse transformer、Longformer |
| BigBird（局部 + 全局 + 随机） | 近似 O(N) | 混合 | 在 2 倍上下文下与完整持平 | 早期长上下文 BERT |
| Native Sparse（DeepSeek-V3.2） | O(N · 激活比例) | O(N) | 与完整相差 0.05 ppl 以内 | DeepSeek-V3.2，2025 |
| 差分 | O(2·N²) | O(2N) | ppl 降低 5–10% | DIFF Transformer，2026 年初的模型 |

## 动手实现（Build It）

见 `code/main.py`。我们实现一个因果 mask 比较器，把完整、SWA、局部+跨步、差分四种 attention 在一个玩具序列上并排展示。

### 第 1 步：完整因果 mask（基准）

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

第 07 课的基准。下三角；对角线之上权重为零。

### 第 2 步：滑动窗口因果 mask

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

只有一个参数——`window`。当 `window >= n` 时退化为完整因果 attention；当 `window = 1` 时每个 token 只 attend 自己。

### 第 3 步：局部 + 跨步稀疏 mask

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

稠密的局部窗口，再加上从序列起点起每 `stride` 个 token 取一个。每多一层，感受野按对数增长。

### 第 4 步：差分 attention

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

两次 attention 计算，用一个学得的混合系数相减。代码里我们把单 attention 与差分 attention 的「attention sink 热力图」放在一起对比，看着 sink 塌缩消失。

### 第 5 步：KV cache 大小

在 `N = 131072` 下，把每个变体每层的 cache 大小打印出来。SWA 和稀疏变体降 10–100 倍，差分翻倍。要清醒地为内存账单埋单。

## 用起来（Use It）

2026 年的生产模式：

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

PyTorch 2.5+ 的 FlexAttention 接受一个 mask 函数：

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

这会编译为一个自定义 Triton kernel。常见模式下速度在 FlashAttention-3 的 10% 误差以内，而 mask 函数本身就是个 Python 可调用对象。

**怎么挑：**

- **纯完整 attention**——每一层、上下文 ~16K 以内，或者检索质量至关重要的场景。
- **SWA + 全局混合**——长上下文（>32K），训练和推理都受内存约束。32K 以上的 2026 默认配置。
- **稀疏块 attention**——自定义 kernel、自定义模式。留给特殊负载（检索、音频）。
- **差分 attention**——任何被 attention-sink 污染拖累的负载（长上下文 RAG、大海捞针）。

## 上线部署（Ship It）

见 `outputs/skill-attention-variant-picker.md`。该 skill 会根据目标上下文长度、检索需求和训练/推理算力画像，为新模型挑选 attention 拓扑。

## 练习（Exercises）

1. **简单。** 跑一遍 `code/main.py`。验证 `window=4` 的 SWA 把每行最后 4 个 token 之外的位置全部置零。验证 `window=n` 能 bit-identical 地复刻完整因果 attention。
2. **中等。** 在第 07 课的 capstone 上加一层 `window=1024` 的因果 SWA。在 tinyshakespeare 上训练 1,000 步。相对完整 attention，验证集 loss 退化多少？峰值内存降多少？
3. **困难。** 在 capstone 模型里实现 Gemma-3 风格的 5:1 层混合（5 SWA，1 全局）。在参数对齐的前提下，比较 loss、内存和生成质量与纯 SWA、纯全局基线的差距。
4. **困难。** 实现每个 head 一个学得 `λ` 的差分 attention。在合成检索任务（1 根针，2000 个干扰项）上训练。在参数对齐的前提下，测量它相对单 attention 基线的检索准确率。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 滑动窗口 attention（SWA） | 「局部 attention」 | 每个 query attend 到自己之前的 `W` 个 token；KV cache 缩到 `O(W)`。 |
| 有效感受野 | 「模型能看多远」 | 在窗口为 `W` 的 `L` 层 SWA 栈里，最远 `L × W` 个 token。 |
| Longformer / BigBird | 「局部 + 全局 + 随机」 | 稀疏模式加几个永远参与 attention 的全局 token；早期的长上下文方案。 |
| Native Sparse Attention | 「DeepSeek 的 kernel 妙招」 | 学习块级稀疏；在 kernel 层面跳过零块，同时保住质量。 |
| 差分 attention | 「两张图，一减」 | DIFF Transformer：从第一张 attention 图里减掉学得 `λ` 倍的第二张，抵消 attention sink。 |
| Attention sink | 「权重漏到 token 0」 | softmax 归一化强迫每行加和为 1；信息量低的 query 会把权重倾倒到位置 0。 |
| FlexAttention | 「Python 写 mask」 | PyTorch 2.5+ 的 API，把任意 mask 函数编译成 FlashAttention 形态的 kernel。 |
| 层类型混合 | 「5:1 SWA-比-全局」 | 在栈里交替排布稀疏与完整 attention 层，以更低内存保住质量。 |

## 延伸阅读（Further Reading）

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150)——经典的滑动窗口 + 全局 token 论文。
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062)——局部 + 全局 + 随机。
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509)——OpenAI 的局部 + 跨步模式。
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118)——1:1 的 SWA:global 混合。
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786)——窗口 1024、5:1 混合，现已成教科书默认配置。
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258)——DIFF Transformer 论文。
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089)——DeepSeek-V3.2 的学得稀疏 attention。
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/)——Use It 中所述 mask-as-callable 模式的 API 参考。
