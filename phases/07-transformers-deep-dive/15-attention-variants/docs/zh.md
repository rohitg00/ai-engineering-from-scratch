# 注意力变体——滑动窗口、稀疏与差分注意力

> 全注意力是一个圆。每个词元关注每个词元，而内存则为此付出代价。四种变体改变了圆的形状，并回收了一半的成本。

**类型：** 构建  
**语言：** Python  
**前置知识：** 阶段7·02（自注意力），阶段7·03（多头注意力），阶段7·12（KV缓存 / Flash注意力）  
**时间：** 约60分钟  

## 问题

全注意力在序列长度上消耗 `O(N²)` 内存和 `O(N²)` 计算。对于一个128K上下文的Llama 3 70B模型，每层有160亿个注意力条目，乘以80层。Flash注意力（第12课）隐藏了 `O(N²)` 的激活内存，但并未改变算术代价——每个词元仍然关注每个其他词元。

三类变体改变了注意力矩阵本身的拓扑结构：

1. **滑动窗口注意力（Sliding Window Attention, SWA）**。每个词元仅关注一个固定的邻居窗口，而非完整的前缀。内存和计算降至 `O(N·W)`，其中 `W` 是窗口大小。Gemma 2/3、Mistral 7B的前几层、Phi-3-Long。
2. **稀疏/块注意力（Sparse/Block Attention）**。仅对选定的 `(i, j)` 对进行评分；其余强制为零权重。Longformer、BigBird、OpenAI稀疏Transformer。
3. **差分注意力（Differential Attention）**。使用独立的Q/K投影计算两个注意力图，然后将其中一个减去另一个。消除了将权重泄漏到前几个词元的“注意力沉没（Attention Sink）”。微软的DIFF Transformer（2024年）。

这些技术可以共存。2026年的前沿模型通常混合使用它们：大多数层是SWA-1024，每五层有一层是全局全注意力，还有少数是用于清理检索的差分注意力头。Gemma 3的SWA与全局比例为5:1，是当前教科书标准的默认配置。

## 概念

### 滑动窗口注意力（Sliding Window Attention, SWA）

位置 `i` 处的每个查询仅关注 `[i - W, i]`（因果SWA）或 `[i - W/2, i + W/2]`（双向）范围内的位置。窗口之外的词元在得分矩阵中得到 `-inf`。

```
完整因果：                    滑动窗口（W=4）：
位置0-7                      位置0-7，W=4
    0 1 2 3 4 5 6 7             0 1 2 3 4 5 6 7
0 | x                        0 | x
1 | x x                      1 | x x
2 | x x x                    2 | x x x
3 | x x x x                  3 | x x x x
4 | x x x x x                4 |   x x x x
5 | x x x x x x              5 |     x x x x
6 | x x x x x x x            6 |       x x x x
7 | x x x x x x x x          7 |         x x x x
```

对于 `N = 8192` 和 `W = 1024`，得分矩阵中预期有1024 × 8192个非零行——减少8倍。

**KV缓存随SWA缩小。** 每层只需保留最后 `W` 个K和V的token。对于Gemma-3风格的配置（窗口1024，上下文128K），KV缓存下降128倍。

**质量代价。** 仅使用SWA的Transformer难以进行长程检索。解决方法：将SWA层与全注意力层交错。Gemma 3使用5:1的SWA:全局比例。Mistral 7B使用因果SWA堆栈，信息通过重叠窗口“向前流动”——每一层将有效感受野扩展 `W`，在 `L` 层之后，模型可以关注回 `L × W` 个token。

### 稀疏/块注意力

预先选择一个 `N × N` 的稀疏模式。三种经典形状：

- **局部+步长（OpenAI稀疏Transformer）**。关注最后 `W` 个token以及之前每隔 `stride` 个token。以 `O(N·sqrt(N))` 的计算量同时捕获局部和长程信息。
- **Longformer / BigBird**。局部窗口 + 一组全局token（例如 `[CLS]`），这些全局token关注所有token并被所有token关注 + 随机稀疏连接。在同等质量下实验性地将上下文长度提升2倍。
- **原生稀疏注意力（DeepSeek，2025年）**。学习哪些 `(Q, K)` 块是重要的；在核函数层面跳过零块。与Flash注意力兼容。

稀疏注意力是一个核工程故事。数学很简单（对得分矩阵进行掩码）；收益来自从不将零项加载到SRAM中。FlashAttention-3和2026年的FlexAttention API使自定义稀疏模式在PyTorch中成为一等公民。

### 差分注意力（DIFF Transformer，2024年）

常规注意力存在一个“注意力沉没”问题：softmax强制每一行求和为1，因此那些不想关注任何特定内容的token会将权重倾注到第一个token（或前几个token）上。这窃取了本应分配给实际内容的容量。

差分注意力通过计算**两个**注意力图并相减来修复此问题：

```
A1 = softmax(Q1 K1^T / √d)
A2 = softmax(Q2 K2^T / √d)
DiffAttn = (A1 - λ · A2) V
```

其中 `λ` 是一个可学习的标量（通常为0.5–0.8）。A1捕获实际内容权重；A2捕获沉没。相减消除了沉没，将权重重新分配给相关token。

报告的结果（微软，2024年）：困惑度降低5–10%，在相同训练长度下有效上下文长度提升1.5–2倍，针在干草堆（Needle-in-Haystack，即长文本中检索指定信息）检索更精准。

### 变体对比

| 变体 | 计算量 | KV缓存 | 与完整注意力相比的质量 | 生产用途 |
|------|--------|--------|------------------------|----------|
| 全注意力 | O(N²) | 每层O(N) | 基线 | 每个模型的默认层 |
| SWA（窗口1024） | O(N·W) | 每层O(W) | -0.1 ppl，配合全局层效果良好 | Gemma 2/3, Phi-3-Long |
| 局部+步长稀疏 | O(N·√N) | 混合 | 与SWA类似 | OpenAI稀疏Transformer, Longformer |
| BigBird（局部+全局+随机） | 近似O(N) | 混合 | 在2倍上下文上匹配完整注意力 | 早期长上下文BERT |
| 原生稀疏（DeepSeek-V3.2） | O(N·活跃比例) | O(N) | 困惑度差距在0.05以内 | DeepSeek-V3.2, 2025 |
| 差分注意力 | O(2·N²) | O(2N) | 困惑度降低5–10% | DIFF Transformer, 2026年初模型 |

## 动手构建

参见 `code/main.py`。我们实现了一个因果掩码比较器，在玩具序列上并排展示完整注意力、SWA、局部+步长稀疏和差分注意力。

### 第一步：完整因果掩码（基线）

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

源于第07课的基线。下三角；对角线以上为零权重。

### 第二步：滑动窗口因果掩码

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

一个参数——`window`。当 `window >= n` 时，恢复完整的因果注意力。当 `window = 1` 时，每个token只关注自身。

### 第三步：局部+步长稀疏掩码

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

密集的局部窗口加上每隔 `stride` 个token回溯到序列开头。随着更多层的叠加，感受野呈对数步长增长。

### 第四步：差分注意力

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

两次注意力计算，使用可学习的混合系数相减。在代码中，我们比较了单注意力与差分注意力的注意力沉没热力图，并观察沉没的消失。

### 第五步：KV缓存大小

在 `N = 131072` 下打印每种变体的每层缓存大小。SWA和稀疏变体下降了10–100倍。差分注意力翻倍。有意识地支付你的内存账单。

## 使用它

2026年的生产模式：

```python
from transformers import AutoModelForCausalLM
# Gemma 3 以5:1的比例混合SWA（窗口=1024）和全局层。
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

PyTorch 2.5+ 中的FlexAttention接受一个掩码函数：

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

这会编译为一个自定义的Triton核函数。对于常见模式，速度在FlashAttention-3的10%以内，并且掩码函数是一个可调用的Python对象。

**何时选择每种变体：**

- **纯全注意力**——每层，上下文长度上限约16K，或检索质量至关重要时。
- **SWA + 全局混合**——长上下文（>32K），训练和推理内存受限。2026年32K以上的默认选择。
- **稀疏块注意力**——自定义核函数，自定义模式。保留用于专门的工作负载（检索、音频）。
- **差分注意力**——任何注意力沉没污染有害的工作负载（长上下文RAG、针在干草堆检索）。

## 交付

参见 `outputs/skill-attention-variant-picker.md`。该技能根据目标上下文长度、检索需求以及训练/推理的计算配置文件，为新模型选择注意力拓扑。

## 练习

1. **简单。** 运行 `code/main.py`。验证 `window=4` 的SWA每行仅保留最后4个token，其余清零。验证 `window=n` 与原版因果注意力在比特级别上一致。
2. **中等。** 在第07课毕业设计的基础上实现 `window=1024` 的因果SWA。在tinyshakespeare上训练1000步。与全注意力相比，验证损失退化了多少？峰值内存下降了多少？
3. **困难。** 在毕业设计模型中实现Gemma-3风格的5:1层混合（5层SWA，1层全局）。在相同参数量下，比较与纯SWA和纯全局基线的损失、内存和生成质量。
4. **困难。** 实现带有每头可学习 `λ` 的差分注意力。在合成检索任务（一个目标，2000个干扰项）上训练。在相同参数量下，测量与单注意力基线的检索准确率。

## 关键术语

| 术语 | 人们常说的含义 | 实际含义 |
|------|----------------|----------|
| 滑动窗口注意力（SWA） | “局部注意力” | 每个查询关注其最后 `W` 个token；KV缓存缩小至 `O(W)`。 |
| 有效感受野 | “模型能回溯多远” | 在 `L` 层、窗口为 `W` 的SWA堆栈中，最多可达 `L × W` 个token。 |
| Longformer / BigBird | “局部 + 全局 + 随机” | 稀疏模式，包含少数始终关注的全局token；早期的长上下文方法。 |
| 原生稀疏注意力 | “DeepSeek的核技巧” | 学习块级稀疏性；在核函数层面跳过零块，同时保持质量。 |
| 差分注意力 | “两个图，其中一个减去另一个” | DIFF Transformer：从第一个注意力图中减去第二个注意力图的 `λ` 倍，以消除注意力沉没。 |
| 注意力沉没 | “权重泄漏到token 0” | Softmax归一化强制行求和为1；无信息量的查询将权重倾注到位置0。 |
| FlexAttention | “掩码即Python” | PyTorch 2.5以上的API，可将任意掩码函数编译成FlashAttention形状的核函数。 |
| 层类型混合 | “5:1 SWA与全局比例” | 在堆栈中交错稀疏和全注意力层，以较低的内存保持质量。 |

## 延伸阅读

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) — 滑动窗口+全局token的经典论文。
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062) — 局部+全局+随机。
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) — OpenAI的局部+步长模式。
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) — 1:1的SWA与全局混合。
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) — 5:1混合，窗口=1024，现在已成为教科书默认配置。
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) — DIFF Transformer论文。
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089) — DeepSeek-V3.2的学习稀疏注意力。
- [PyTorch — FlexAttention博客和文档](https://pytorch.org/blog/flexattention/) — “使用它”部分中掩码即可调用模式的API参考。