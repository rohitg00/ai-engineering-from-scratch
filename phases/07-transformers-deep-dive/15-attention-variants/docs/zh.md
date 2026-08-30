# Attention Variants — Sliding Window, Sparse, Differential

> 全神贯注是一个圆圈。每个代币都能看到每个代币，记忆付出了代价。四种变体弯曲了圆圈的形状并回收了一半的成本。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段7 · 02（自我注意）、阶段7 · 03（多头）、阶段7 · 12（KV缓存/闪存注意）
** 时间：** ~60分钟

## The Problem

完全注意力成本“O（N²）”内存和“O（N²）”以序列长度计算。对于128 K上下文Llama 3 70 B，每层有160亿个关注条目，乘以80层。Flash Attention（第12课）隐藏了“O（N²）”激活内存，但不会改变算术成本-每个令牌仍然关注每个其他令牌。

三类变体改变了注意力矩阵本身的布局：

1. ** 滑动窗注意（SWA）。**每个令牌都服务于邻居的固定窗口，而不是完整的前置码。内存和计算下降到“O（N · W）”，其中“W”是窗口。Gemma 2/3，Mistral 7 B的第一层，Phi-3-Long。
2. ** 稀疏/阻止注意力。**只有选定的配对“（i，j）”才会得分;其余配对被迫归零权重。Longformer、BigBird、OpenAI稀疏Transformer。
3. ** 注意力不同。**用单独的Q/K投影计算两个注意力图，将其中一个减去另一个。杀死将重量渗透到前几个代币中的“注意力下沉”。微软的DIFF Transformer（2024）。

这些共存。2026年的前沿模型经常混合它们：大多数层是SWA-1024，五分之一是全球全力关注，少数是清理检索的差异头。Gemma 3的SWA与全球比例为5：1是当前教科书默认的。

## The Concept

### Sliding Window Attention (SWA)

位置“i”处的每个查询仅涉及“[i-W，i]'（因果SWA）或“[i-W/2，i + W/2]'（双向）中的位置。窗口外的代币在分数矩阵中获得“-inf”。

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

对于“N = 8192”和“W = 1024”，分数矩阵预期有1024 x 8192个非零行-减少了8倍。

**KV缓存随着SWA而缩小。**每层只需要保留K和V的最后一个“W”令牌。对于Gemma-3-ish配置（1024窗口，128 K上下文），KV缓存下降128倍。

** 质量成本。**仅支持SWA的变压器难以进行远程检索。修复方法：将SWA层与全注意力层交织在一起。Gemma 3使用5：1 SWA：全球。Mistral 7 B使用cascar-SWA堆栈，其中信息通过重叠的窗口“向前流动”-每层将有效感受野扩展“W”，在“L”层之后，模型可以将“L x W”令牌重新引入。

### Sparse / Block Attention

提前选择“N × N”稀疏模式。三种典型形状：

- **Local + strided（OpenAI稀疏Transformer）。**注意最后一个“W”标记加上之前的每个“stride”标记。在“O（N · SQRT（N））”计算时捕获本地和远程。
- **Longformer / BigBird。**本地窗口+一小组全球代币（例如“[LIS]'），适用于每个人并由每个人参与+随机稀疏链接。经验2倍具有匹配质量的上下文。
- ** 原生稀疏注意力（DeepSeek，2025）。**了解“（Q，K）”的哪些块重要;跳过内核级别的零块。Flash Attention兼容。

稀疏注意力是一个内核工程的故事。数学很简单（屏蔽得分矩阵）;胜利来自于从不将零条目加载到SRAM中。FlashAttention-3和2026 FlexAttention API使自定义稀疏模式成为PyTorch中的一流模式。

### Differential Attention (DIFF Transformer, 2024)

定期注意力存在“注意力下沉”问题：softmax强制每一行的总和为1，因此不想注意任何特定内容的代币会在第一个代币（或前几个代币）上倾销权重。这窃取了本应用于真实内容的容量。

差异注意力通过计算 ** 两个 ** 注意力地图并减去来解决这个问题：

```
A1 = softmax(Q1 K1^T / √d)
A2 = softmax(Q2 K2^T / √d)
DiffAttn = (A1 - λ · A2) V
```

其中“A”是习得的纯量（通常为0.5-0.8）。A1捕获真实内容权重; A2捕获水槽。减法取消了水槽，将权重重新分配给相关代币。

报告的结果（Microsoft 2024）：困惑度降低5-10%，相同训练长度下有效上下文延长1.5-2倍，更清晰的海捞针检索。

### Variant Comparison

| 变体 | 计算 | KV缓存 | 质量与完整 | 生产使用 |
|---------|---------|----------|-----------------|----------------|
| 充分重视 | O（N²） | 每层O（N） | 基线 | 每个模型的默认层 |
| SWA（窗口1024） | O（N·W） | 每层O（W） | -0.1 ppl，适合全局层 | Gemma 2/3，Phi-3-Long |
| 本地+步行稀疏 | O（N·N） | 混合 | 类似于SWA | OpenAI稀疏Transformer，Longformer |
| BigBird（本地+全球+随机） | O（N）大约 | 混合 | 在2倍上下文下匹配完整 | 早期长背景BERT |
| 原生稀疏（DeepSeek-V3.2） | O（N ·活性分数） | O（N） | 0.05分以内 | DeepSeek-V3.2，2025 |
| 微分 | O（2·N²） | O（2N） | -5至-10% ppl | DIFF Transformer，2026年早期车型 |

## Build It

请参阅' code/main.py '。我们实现了一个因果面具比较器，它在玩具序列上并排显示完全注意力、SWA、局部+步进注意力和差异注意力。

### Step 1: full causal mask (baseline)

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

第07课的基线。下部三角形;对角线上方重量为零。

### Step 2: sliding window causal mask

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

一个参数-“窗口”。对于“窗口>= n”，您将恢复全部因果注意力。对于“窗口= 1”，每个令牌只负责其自身。

### Step 3: local + strided sparse mask

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

密集的本地窗口加上每个“stride”-th令牌，返回到序列的开始。感受场随着额外的层以日志步骤增长。

### Step 4: differential attention

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

两次注意力传递，减去学习的混合系数。在代码中，我们比较了单一与差异的注意力下沉热图，并观察下沉的崩溃。

### Step 5: KV cache sizes

为每个变体打印每层的缓存大小' N = 131072 '。SWA和稀疏变体下降10-100倍。差异双打。有意识地支付你的记忆费用。

## Use It

2026年生产模式：

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

PyTorch 2.5+中的FlexAttention接受掩码函数：

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

这将编译为自定义Triton内核。对于常见模式，速度在Flash Attention-3的10%以内，并且面具函数是Python可调用的。

** 何时选择每个：**

- ** 纯粹的全力关注 ** -每一层高达~ 16 K上下文，或者当检索质量至关重要时。
- **SWA +全球混合 ** -长上下文（> 32 K）、训练和推理受内存限制。2026年默认高于32 K。
- ** 稀疏块注意力 ** -自定义内核，自定义模式。保留用于专业工作负载（检索、音频）。
- ** 注意力差异 ** -注意力水槽污染会造成伤害的任何工作量（长背景RAG、大海捞针）。

## Ship It

请参阅“输出/skill-attention-variant-picker.md”。该技能在给定目标上下文长度、检索需求和训练/推理计算配置文件的情况下为新模型选择注意力布局。

## Exercises

1. ** 简单。**运行'代码/main.py '。验证“窗口=4”处的SWA将各行最后4个令牌以外的所有内容归零。验证“窗口=n”完全相同地再现了因果注意力。
2. ** 中等。**在第07课的顶部实施具有“窗口=1024”的因果SWA。在tinyshakespeare上训练1，000级台阶。与完全注意力相比，价值损失会倒退多少？峰值内存下降多少？
3. ** 很难。**在Capstone模型中实施Gemma-3风格的5：1分层混合（5 SWA，1全局）。将丢失、内存和发电质量与匹配参数下的纯SWA和纯全球基线进行比较。
4. ** 很难。**通过每人学习的“A”来实施差异关注。训练合成检索任务（一根针，2，000个干扰器）。在匹配参数下测量检索准确性与单注意基线。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 滑动窗注意（SWA） | “当地关注” | 每个查询处理其最后的“W”令牌; KV缓存缩小为“O（W）”。 |
| 有效感受野 | “模型看到了多远” | 在窗口为“W”的“L”层SWA堆栈中，最多为“L x W”令牌。 |
| Longformer / BigBird | “本地+全球+随机” | 稀疏模式，带有一些始终关注的全球代币;早期的长上下文方法。 |
| 原生稀疏注意力 | “DeepSeek的内核技巧” | 了解块级稀疏性;在内核级跳过零块，同时保持质量。 |
| 差异注意力 | “两张地图，一张减” | Diff Transformer：从第一个注意力地图中减去学习的“A”乘以第二个注意力地图，以取消注意力下沉。 |
| 注意力下沉 | “体重流血至0” | Softmax规范化强制行总和为1;无信息查询将权重转储到位置0。 |
| 弹性注意力 | “面具像蟒蛇” | PyTorch 2.5+ API，可将任意屏蔽函数编译为Flash Attention形状的内核。 |
| 层类型混合 | “5：1 SWA到全球” | 在堆栈中交错排列稀疏和全注意力层，以保持较低内存的质量。 |

## Further Reading

- [Beltagy、Peters、Kohan（2020）。Longformer：Long-Document Transformer]（https：//arxiv.org/ab/2004.05150）-规范的滑动窗口+全球代币文件。
- [Zaheer等人（2020）。大鸟：更长序列的变形金刚]（https：//arxiv.org/abs/2007.14062）-本地+全局+随机。
- [Child等人（2019）。使用稀疏变形器生成长序列]（https：//arxiv.org/abs/1904.10509）- OpenAI的本地+步进模式。
- [杰玛团队（2024）。Gemma 2：以实际规模改进开放语言模型]（https：//arxiv.org/ab/2408.00118）-1：1 SWA：全球混合。
- [杰玛团队（2025）。Gemma 3技术报告]（https：//arxiv.org/ab/2503.19786）-窗口=1024的5：1混合，这是现在教科书默认的。
- [Ye等人（2024）。Differential Transformer]（https：//arxiv.org/abs/2410.05258）-DIFS Transformer论文。
- [Yuan等人（2025）。原生稀疏注意力]（https：//arxiv.org/ab/2502.11089）- DeepSeek-V3.2的习得稀疏注意力。
- [PyTorch - FlexAttention博客和文档]（https：//pytorch.org/blog/flexattention/）-Use It中的掩蔽可调用模式的API引用。
