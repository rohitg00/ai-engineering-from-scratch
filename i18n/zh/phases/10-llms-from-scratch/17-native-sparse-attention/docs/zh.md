# 专注于本地节省 (深度搜索 NSA)

> 在64k代币时,注意力耗费了70到80%的解码延迟. 每个开放模型实验室都有一个解决方案. 密搜索的NSA (ACL 2025最佳论文) 是一个住的:三个平行关注分支压缩的粗粒的代币,选择性保留的细粒的代币,以及用于本地环境的滑窗通过学习门组合. 它是硬件配合 (核友好),可以本地训练 (在预训练中工作,在推断时不插电),在64k解码上,它比FlashAttention更快,同时匹配或超过全注意力质量. 这一课将三个分支构建到底,

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 7 · 12 (KV cache, flash-attention), Phase 7 · 15 (attention variants), Phase 10 · 16 (differential attention)
**Time:** ~60 minutes

## 学习目标

- 告诉我们, NSA 的三个关注部门,
- 解释为什么 NSA 是"本地训练的",而以前的稀疏注意力方法仅仅是推断的.
- 计算NSA的注意力计算节省率与64k文本中的全注意力,作为压缩块大小和选择顶-k的函数.
- 实现在 stdlib Python 中的三分组合在短合成序列上,并验证盖特权重的行为.

## 问题

完全关注序列长度N成本 `O(N^2)`时间和`O(N)`根据美国国家安全局 (NSA) 论文的测量理论估计,注意力占64k的总解码延迟的70-80%. 下游所有东西都由注意力成本主导.

很少有人注意, 之前的尝试都被分为两个桶. 固定模式稀缺性 (滑动窗口,步骤,区块本地) 丢弃信息,并失败于远程召回任务. 输入时间稀缺性 (KV缓存切割,H2O,流程LLM) 应用于密集注意力上预先训练的模型,并且只恢复了潜在的加速量的很小一部分,因为模型从未被要求通过稀疏模式路由信息.

产生的稀疏注意 (Yuan et al.,DeepSeek + PKU + UW,ACL 2025最佳论文,arXiv:2502.11089) 是两者:模型在预训练中学习的稀疏性模式,作为一个基于内核的算法实现,实际上在推断时提供了计算节省.

## 概念

### 两的三支

对于每一个查询,NSA三次向KV缓存的三个不同的视图运行注意力:

1. **Compressed branch.**代币分成大小的块`l`通过一个小的学习MLP,每个块被压缩成一个单个总结代币.查询通过这些压缩代币进行,从而获得整个序列的粗粒度视图.

2. **Selected branch.**通过使用压缩分支的注意力分数,确定了对当前查询最相关的顶级k块.这些块的细粒度 (未压缩) 代币被读取,查询会在所有这些块上进行. 想象压缩分支的注意力作为选择的路由信号.

3. **Sliding-window branch.**查询内容包括最新的查询内容.`W`对于本地语境,该分支捕捉到其他两个可能错过的结构重的短距离模式 (语法,本地核心引用).

通过学习的位置通道,三个分支输出组合在一起:

```math
\text{out} = g_{\text{cmp}} \cdot \text{out}_{\text{cmp}} + g_{\text{sel}} \cdot \text{out}_{\text{sel}} + g_{\text{win}} \cdot \text{out}_{\text{win}}
```

`g_cmp, g_sel, g_win`它们不必总和到1 ,它们可以独立权重分支.

### 为什么这"可以本地训练"

选择步骤 (顶-k块) 是离散的.离散操作打破梯度流量.以前的稀疏注意力工作要么通过选择 (限制训练) 跳过后方,要么使用连续放松,在推断时没有真正的稀疏性.

美国国家安全局忽略了这一点:压缩分支的关注是整个序列上的可分化粗粒度的关注. 压缩分支的最高注意力分数, 才能选择哪些细粒块要加载. 梯度通过压缩分支的产出,而不是通过选择块来达到压缩分支的分数. 在选定的块内,关注选定的键和值是普通的注意,因此它们对最终输出的贡献也可以区分. 其他`top_k`索引选择本身没有梯度:它只控制哪些块从内存中加载.

这就是为什么 NSA 可以用于预训练的终端. 该模型学习通过三个分支共同路由信息,产生稀疏的模式,

### 硬件对齐的内核

由于每个查询组看到相同的选定的块 (选择是每个查询组,而不是每个查询头),因此KV负载在整个组中被抵消.算术强度保持高.

该论文报告说,Triton内核在64k解码上运行速度比FlashAttention快9倍,随着序列长度而增长速度.

### 计算预算

让我们`N`连续时间`l`压缩块大小`k`选拔的最高数量,`w`滑窗,`b`选择的块大小 (通常等于`l`)

- 压缩的分支:`O(N/l)`按查询的密钥,所以`O(N * N / l)`总的来说.
- 选择的分支:`O(k * b)`按查询的密钥,所以`O(N * k * b)`现在,我们要去.
- 滑动分支: `O(w)`按查询的密钥,所以`O(N * w)`现在,我们要去.

总数:`O(N * (N/l + k*b + w))`现在,我们要去.

随着`N = 64k, l = 64, k = 16, b = 64, w = 512`:每次查询成本为`1000 + 1024 + 512 = 2536 keys`完全关注`64000 keys`计算减少了25倍.

随着`N = 128k, l = 64, k = 16, b = 64, w = 512`:每次查询成本为`2000 + 1024 + 512 = 3536 keys`完全关注`128000 keys`效益随着序列长度而增长,这是整个观点.

### 如何比较

| Method | Differentiable | Real inference speedup | Long-range recall |
|--------|---------------|----------------------|-------------------|
| Sliding window only | yes | yes | fails |
| Strided / block-sparse | yes | yes | partial |
| KV pruning (H2O, StreamingLLM) | N/A (inference-time) | yes | partial |
| MoBA (Moonshot) | partial | yes | good |
| NSA | yes (natively) | yes (9x at 64k) | matches full attention |

根据MoE原则,MoBA (Moonshot, arXiv:2502.13189) 同时发布,并采用类似的三比一个方法,将MoE原则应用于注意力块.

```figure
sliding-window-attention
```

## 建立它

`code/main.py`执行三个分支在短的合成序列上,并显示:

- 压缩MLP (用于教学清晰度使用简单的平均池基线;真正的NSA使用学习MLP).
- 根据压缩分支的分数进行的顶级k区块选择.
- 滑窗的注意力在最后`w`它们是什么?
- 封闭的组合.
- 计算计算的打印,比较于全注意力.

### 步骤1:将代币压缩成块

```python
def compress(K, l):
    n = len(K)
    n_blocks = (n + l - 1) // l
    out = []
    for b in range(n_blocks):
        start, end = b * l, min((b + 1) * l, n)
        block = K[start:end]
        summary = [sum(row[d] for row in block) / len(block) for d in range(len(K[0]))]
        out.append(summary)
    return out
```

### 步骤2:压缩分支注意

运行软max注意力对压缩键.压缩分支分数是双重的信号.

### 步骤3: 选择顶部k块

选择该类型的指数`k`输入原始的未压缩代币,并关注它们.

### 步骤4:滑动窗口注意

接下来拿下最后一个`w`通过电子商务来控制这些代币,并对它们进行标准的注意.

### 步骤5:门 + 组合

查询中的一个小 MLP 产生三个门权重.最终输出是三个分支输出的权重总和.

### 步骤 6:计算计算

打印每一个分支的每个查询中参观的键数量和总数.`N`通过1024代币的合成,`l = 32, k = 4, w = 128`美国国家安全局看到`32 + 128 + 128 = 288`对于全重关注,每次查询的密钥比1024低了3.5倍.

## 用它

美国国家安全局正在 DeepSeek 的长文本预训练管道中运输.

- **DeepSeek internal**:本土,发表的权重使用NSA或其继任者DSA (Deepseek Sparse Attention).
- **vLLM**: 实验性 NSA 支持开发 DeepSeek-V3.x 重量.
- **SGLang**: NSA 发布的基准;生产路径遵循vLLM.
- **llama.cpp / CPU**核分解的总费用在CPU吞吐量上不值得.

什么时候联系NSA:

- 预训或继续训练运行,针对64k以上的环境,具有严格的计算预算.
- 调查了深度搜索的长文本检查站.

什么时候不:

- 没有持续训练,就不能再调整NSA.
- 经过三支支的开支, 占据了储蓄的地位.
- 批量-1互动聊天, 缓慢解码效益, 但只有在长时间的环境中.

## 运送它

这一课产生了`outputs/skill-nsa-integrator.md`鉴于长文本预训练运行规格,它产生了NSA集成计划:压缩块大小,顶部k,滑窗,门 MLP宽度,内核选择,以及具体的长文本评估,这将证明建筑变化.

## 运动

1. 跑步`code/main.py`在1024代码的合成器上.`(l, k, w)`在一个子中针的测试中,保持95%的回忆,而完全注意力.

2. 替换中积压机用一个小的学习MLP (2层,隐藏32).训练它在一个合成任务,信号是一个块的平均值.测量与中积基线的困惑差距.

3. 执行门 MLP. 它将查询作为输入,并输出三个尺度. 显示门行为合理:随机查询几乎均的权重,查询击中远后区块时,选择的分支重量.

4. 计算NSA启用70B模型的KV缓存预算在128k语境下.KV头为8,头暗128,BF16.比较全注意和MLA (阶段10 · 14显示MLA的数字).确定NSA的细粒子分支KV缓存等于全注意的序列长度.

5. 阅读 NSA 论文的第 4 节 (arXiv:2502.11089) 并用三句话解释为什么压缩分支的注意力分数被重复用于顶级选项而不是计算单独的路由分数.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Compressed branch | "Coarse view" | Attention over block-averaged keys that provides global context in $O(N/l)$ keys per query |
| Selected branch | "Top-k blocks" | Fine-grained attention over the `k` blocks with highest compressed-branch scores |
| Sliding window | "Local context" | Attention over the last `W` tokens for short-range patterns |
| Native trainability | "Pre-train with the sparsity on" | The sparsity pattern is learned during pre-training, not bolted on at inference |
| Compression block size l | "Group size for coarse view" | How many tokens get merged into one summary; 32-64 typical |
| Top-k | "Blocks to keep" | Number of compressed blocks whose uncompressed tokens get read; 16 typical |
| Sliding window W | "Local attention radius" | Typically 512; shorter hurts local coherence, longer wastes compute |
| Branch gate | "How to mix the three" | Per-position MLP output that weights the three branches' contributions |
| Hardware alignment | "Kernel-friendly sparsity" | Sparse pattern chosen so that the actual GPU kernel achieves the theoretical speedup |
| DSA | "NSA's successor" | Deepseek Sparse Attention, the architecture that followed NSA in DeepSeek's lineage |

## 进一步阅读

- [Yuan et al. — Native Sparse Attention: Hardware-Aligned and Natively Trainable Sparse Attention (arXiv:2502.11089, ACL 2025 Best Paper)](https://arxiv.org/abs/2502.11089)报纸
- [DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437)建筑家族 NSA 目标
- [Moonshot AI — MoBA: Mixture of Block Attention for Long-Context LLMs (arXiv:2502.13189)](https://arxiv.org/abs/2502.13189)同时工作,以MoE风格的关注
- [Beltagy et al. — Longformer: The Long-Document Transformer (arXiv:2004.05150)](https://arxiv.org/abs/2004.05150)滑窗的起源
- [Xiao et al. — StreamingLLM: Efficient Streaming Language Models with Attention Sinks (arXiv:2309.17453)](https://arxiv.org/abs/2309.17453) 推断时间稀缺度基线 NSA改善
- [Dao et al. — FlashAttention-2 (arXiv:2307.08691)](https://arxiv.org/abs/2307.08691)全重视基线NSA核在64k
