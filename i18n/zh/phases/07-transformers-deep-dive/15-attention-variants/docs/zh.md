# 注意 变量 滑动窗口,稀疏,差异性

> 完全的注意力是圆. 每个代币都看到每一个代币,而记忆支付了代价. 三种变体折曲圆形,恢复了成本的一半.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head), Phase 7 · 12 (KV Cache / Flash Attention)
**Time:** ~60 minutes

## 问题

完全注意力成本$O(N^2)$记忆力和$O(N^2)$对于一个128K文本的Llama 3 70B,这就是每层16亿注意力输入,乘以80层.闪光注意力 (课 12) 隐藏了$O(N^2)$激活存储器,但不会改变算术成本 每个代币仍然会关注其他代币.

三类变体改变了注意力矩阵本身的拓学:

1. **Sliding window attention (SWA).**每个代币都会在一个固定的邻居窗口中,而不是完整的预सर्ग.$O(N \cdot W)$在哪里$W$马2/3,米斯特拉尔7B的第一层,菲-3-龙.
2. **Sparse / block attention.**只有选择的对`(i, j)`长,大鸟,开AI稀疏变压器.
3. **Differential attention.**计算两个注意力地图,使用不同的Q/K投影,减去一个.杀死"注意力沉浸器",使重量流入第一几个代币.微软的DIFF变压器 (2024).

它们共存.2026年边界模型经常混合它们:大多数层都是SWA-1024,每五层都是全球全关注,少数是分区头,清理检索.Gemma3的5:1 SWA-to-global ratio是当前的教科书默认.

## 概念

### 滑动窗口注意 (SWA)

每个查询在位置$i$仅在职位$[i - W, i]$(因果性SWA) 或$[i - W/2, i + W/2]$窗外的代币得到了$-\infty$在分数矩阵中.

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

为了$N = 8192$其他$W = 1024$预期的数值矩阵有1024 × 8192个非零行  8 × 减少.

**KV cache shrinks with SWA.**只有最后一个$W$对于Gemma-3ish配置 (1024窗口, 128K文本),KV缓存量下降 128x.

**Quality cost.**仅使用SWA的变压器与远程检索斗争.解决方案:将SWA层与全注意层交换.Gemma 3使用 5:1 SWA:全球.Mistral 7B使用了因果性SWA堆,信息通过重叠窗户"向前流动".$W$在此之后`L`模型可以参加的层次`L × W`返回代币.

### 缩/阻注意力

选择一个`N × N`率模式是提前的.

- **Local + strided (OpenAI sparse transformer).**待在最后一个$W$代币加上每一个`stride`捕捉了当地和远程的$O(N \cdot \sqrt{N})$计算.
- **Longformer / BigBird.**局部窗口+一个小组全球代币 (例如 `[CLS]`) 随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随时随的随时随时随时随时随的随时随时随时随的随时随时随时随时随的随时随时随时随的随时随时随的随时随的随时随的随时随时随的随时随的随时随的随时随的随的随时随的随的随时随的随的随的随时随时随的随的随的随的随的随的随的随的随的随的随的随的随的随的随的随的随的随的随的随的随的随的随的.
- **Native Sparse Attention (DeepSeek, 2025).**了解哪些区块的`(Q, K)`核层面的零块,可以兼容FlashAttention.

稀疏注意是一个核工程故事.数学很简单 (掩盖分数矩阵);获胜来自从未将零条目加载到SRAM中.FlashAttention-3和2026 FlexAttention API在 PyTorch中实现了自定义稀疏模式的第一类.

### 变化注意 (DIFF变压器, 2024)

定期关注有一个"注意力沉没"问题:软max强迫每一行总和到1,所以不想关注任何特定的代币在第一个代币 (或第一几个) 上掉了重量. 这就会窃取应该进入真实内容的容量.

差异性注意力通过计算来解决这个问题**two**关注地图和减值:

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d}) \\
\text{DiffAttn} &= (A_1 - \lambda \cdot A_2) V
\end{aligned}
```

在哪里$\lambda$取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取取

报告结果 (微软 2024): 510%较低的困惑,在相同的训练长度下效果较长的环境 1.52x,针在子中更敏的检索.

### 变量比较

| Variant | Compute | KV cache | Quality vs full | Production use |
|---------|---------|----------|-----------------|----------------|
| Full attention | $O(N^2)$ | $O(N)$ per layer | baseline | every model's default layer |
| SWA (window 1024) | $O(N \cdot W)$ | $O(W)$ per layer | -0.1 ppl, good with global layers | Gemma 2/3, Phi-3-Long |
| Local + strided sparse | $O(N \cdot \sqrt{N})$ | mixed | similar to SWA | OpenAI sparse transformer, Longformer |
| BigBird (local + global + random) | $O(N)$ approx | mixed | matches full at 2× context | early long-context BERT |
| Native Sparse (DeepSeek-V3.2) | $O(N \cdot \text{active fraction})$ | $O(N)$ | within 0.05 ppl | DeepSeek-V3.2, 2025 |
| Differential | $O(2 \cdot N^2)$ | $O(2N)$ | -5 to -10% ppl | DIFF Transformer, early 2026 models |

```figure
gqa-kv-sharing
```

## 建立它

看到`code/main.py`或其的港口`code/main.rs`运行了""版本:`rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson`我们实施了一个因果化面具比较器,显示一个玩具序列的全,SWA,本地+步骤,和差别注意力.

### 步骤1:完整的因果性面具 (基线)

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

从第七课开始的基线.

### 步骤2:滑窗因果化面具

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

一个参数`window`为了`window >= n`由于你已经开始恢复了完全的因果性注意力.`window = 1`每个代币只能为自己提供服务.

### 步骤3:局部+步骤稀疏面具

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

密集的地方窗户加上每一个`stride`接收场在日志步骤增加了额外的层次.

### 步骤4: 差异性注意

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

在代码中,我们比较单对差的注意力-沉热地图,看着洗崩.

### 步骤5: KV缓存尺寸

按每层打印缓存尺寸$N = 131072$对于每个变体.SWA和稀有变体下降了10100×. 差异性双倍. 意识地支付你的内存账单.

## 用它

2026年生产模式:

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

在 PyTorch 2.5+ 中,FlexAttention 接受一个面具功能:

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

这将编译成一个定制的Triton内核.在普通模式的FlashAttention-3速度的10%内,面具函数是Python调用.

**When to pick each:**

- **Pure full attention**每层到16K的文本,或者检索质量至关重要时.
- **SWA + global mix**长文本 (>32K),训练和推断内存. 2026年默认超过32K.
- **Sparse block attention**定制内核,定制模式. 专用工作负载 (检索,音频) 预留.
- **Differential attention**任何注意力污染造成伤害的工作负载 (长文本RAG,子子子).

## 运送它

看到`outputs/skill-attention-variant-picker.md`技能选择一个针对新模型的注意力拓,因为目标背景长度,检索要求和训练/推理计算配置.

## 运动

1. **Easy.**跑步`code/main.py`检查SWA`window=4`检查查,每行最后4个代币以外的所有东西都是零的.`window=n`完全因果注意力的重复比特相同.
2. **Medium.**执行因果性SWA`window=1024`训练1000步小小, 什么值减值与全注意力?
3. **Hard.**在顶点模型中实现Gemma-3式 5:1层混合 (5 SWA, 1 全球).在匹配参数时,对纯SWA和纯全球基线进行损失,内存和生成质量进行比较.
4. **Hard.**通过学习的学习者来实现分别注意力$\lambda$按头.训练一个合成检索任务 (一个针,2000个分心器).在匹配的参数上测量检索精度与单次注意的基线.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sliding window attention (SWA) | "Local attention" | Each query attends to its last $W$ tokens; KV cache shrinks to $O(W)$. |
| Effective receptive field | "How far back the model sees" | In an $L$-layer SWA stack with window $W$, up to $L \times W$ tokens. |
| Longformer / BigBird | "Local + global + random" | Sparse patterns with a few always-attending global tokens; early long-context approach. |
| Native Sparse Attention | "DeepSeek's kernel trick" | Learn block-level sparsity; skip zero blocks at the kernel level while keeping quality. |
| Differential attention | "Two maps, one subtracts" | DIFF Transformer: subtract a learned $\lambda$ times a second attention map from the first to cancel attention sinks. |
| Attention sink | "Weight bleeds to token 0" | Softmax normalization forces rows to sum to 1; uninformative queries dump weight on position 0. |
| FlexAttention | "Mask-as-Python" | PyTorch 2.5+ API that compiles arbitrary mask functions into FlashAttention-shape kernels. |
| Layer type mix | "5:1 SWA-to-global" | Interleave sparse and full attention layers in a stack to keep quality at lower memory. |

## 进一步阅读

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150)可行滑动窗口+全球标志纸.
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062)本地+全球+随机.
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509)OpenAI的本地+步骤模式.
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118)全球混合物:1:
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786)5:1的混合和窗口=1024现在是教科书默认的.
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) DIFF变压器纸.
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089)深度搜索V3.2的学习度注意力.
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/)使用它中的面具作为可调用模式的API参考.
