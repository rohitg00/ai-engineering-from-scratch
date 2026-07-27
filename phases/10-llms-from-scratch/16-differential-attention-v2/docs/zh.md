# 差分注意力（V2）

> Softmax 注意力会在每一个不匹配的词元（token）上分摊少量概率。在 10 万词元上，这种噪声会累积起来，淹没信号。差分 Transformer（Differential Transformer, Ye et al., ICLR 2025）通过将注意力计算为两个 softmax 的差值来修正这一问题，从而减去共享的噪声基底。DIFF V2（Microsoft, 2026 年 1 月）是面向生产堆栈的重写版本：解码延迟与基线 Transformer 持平，无需自定义内核，兼容 FlashAttention。本课将 V1 到 V2 进行端到端讲解，并附带一个可在 Python 标准库中运行的玩具实现，演示差值操作。

**类型：** 动手构建  
**语言：** Python（标准库）  
**前置知识：** 阶段 7 · 02（自注意力），阶段 7 · 15（注意力变体），阶段 10 · 14（架构详解）  
**时长：** ~60 分钟

## 学习目标

- 精确阐述为什么 softmax 注意力存在噪声基底，以及该噪声为何会随上下文长度增长。
- 推导差分注意力公式，解释为什么减法能抵消共享的噪声分量而保留信号。
- 梳理 V1 到 V2 的差异：哪些地方更快了、哪些更简单了、哪些更稳定了，以及为什么每项改动对生产环境预训练都是必要的。
- 用纯 Python 从头实现差分注意力，并在带已知信号加噪声结构的合成查询上实证验证噪声抵消特性。

## 问题

标准 softmax 注意力有一个数学特性，在大规模应用时会变成操作上的麻烦。对于查询 `q`，注意力权重为 `softmax(qK^T / sqrt(d))`。Softmax 永远无法产生精确的零值——每个不匹配的词元都会获得一些正的质量。这些残余质量就是噪声，并且会随上下文长度缩放。在 128k 词元下，即使每个不匹配词元只获得 0.001% 的概率，127,999 个不匹配词元合计也会贡献约 12% 的总权重。模型必须学会绕过一个随上下文增长的噪声基底。

经验上，这表现为注意力头干扰：长上下文 RAG 中出现幻觉式引用，10 万词元检索任务中出现"丢失在中间"（lost-in-the-middle）的失败，以及超过 32k 的 needle-in-haystack 基准测试中细微的准确率下降。差分 Transformer 论文（arXiv:2410.05258, ICLR 2025）测量了这一差距：DIFF Transformer 在相同大小的基线上取得了更低的困惑度、更高的长上下文准确率和更少的幻觉。

DIFF V1 有三个问题使其无法进入前沿预训练流水线：其值缓存每次解码步骤需要加载两次；它需要自定义 CUDA 内核，破坏了 FlashAttention 兼容性；其逐头 RMSNorm 在 700 亿以上参数规模的长期训练中不稳定。DIFF V2（Microsoft unilm 博客，2026 年 1 月 20 日）修复了这三个问题。本课讲解这两个版本，构建差分算子，并在一个玩具查询上对噪声抵消进行基准测试。

## 概念

### Softmax 的噪声基底

对于查询 `q` 和键 `K = [k_1, ..., k_N]`，注意力权重为：

```
w_i = exp(q · k_i / sqrt(d)) / sum_j exp(q · k_j / sqrt(d))
```

没有 `w_i` 会是零。如果 `k_i` 与 `q` 完全无关，得分 `q · k_i` 并不是 0——它会在零附近波动，方差为 `||q||^2 / d`。经过 softmax 归一化后，每个无关词元仍然贡献 `O(1/N)` 的加权和。无关词元的总贡献为 `O((N-1)/N) = O(1)`——这不是一个小量。

模型真正想要的是类似硬 top-k 的效果：对匹配词元赋予高权重，对其他所有位置赋予接近零的权重。Softmax 过于平滑，无法直接做到这一点。

### 差分思想

将每个头的 Q 和 K 投影拆分为两组：Q = (Q_1, Q_2) 和 K = (K_1, K_2)。计算两个注意力图：

```
A_1 = softmax(Q_1 K_1^T / sqrt(d))
A_2 = softmax(Q_2 K_2^T / sqrt(d))
```

输出：

```
DiffAttn = (A_1 - lambda * A_2) V
```

减法抵消了两个图共享的任何噪声分布。如果两个图在 127k 个无关词元上都具有大致均匀的权重（随机初始化时确实如此），这些权重就会相互抵消。而信号——集中在少数几个相关词元上的尖峰权重——只有在两个图中以相同幅度出现时才会被抵消，这在模型训练后不会发生。

`lambda` 是每个头可学习的标量，参数化为 `lambda = exp(lambda_q1 · lambda_k1) - exp(lambda_q2 · lambda_k2) + lambda_init`。它可以是负值。`lambda_init` 默认为一个小的正数，如 0.8。

### 为什么这相当于耳机降噪

想象两个噪音麦克风同时录制同一个人声。两者都拾取了说话者的声音以及相关的背景噪声。将其中一个减去另一个，共享的噪声就会消失。人声得以保留，因为两个信号在相位或幅度上有足够差异，避免了完全抵消。逐头的 `lambda` 正是学习这种平衡。

### V1 与 V2 的差异

V1 保持了与基线 Transformer 相等的参数量。为了让每个头获得两个查询，它将头维度减半。这牺牲了头的表达能力，更麻烦的是——每个头的值缓存也减半了。解码步骤需要加载两次值缓存（每个 softmax 分支一次）。结果是：尽管参数量匹配基线，解码速度却比基线慢。

V2 将查询头数量翻倍，同时保持 KV 头数量不变（参数量从上投影层借调）。头维度与基线保持一致。减法之后，额外的维度被投影回基线 Transformer 的 O_W 投影大小。这一改动同时带来了三个好处：

1. 解码速度与基线持平（KV 缓存只加载一次）。
2. FlashAttention 无需修改即可运行（无需自定义内核）。
3. 解码时的算术强度提高（从 HBM 加载的每字节数据对应更多计算）。

V2 还移除了 V1 用来稳定差值的逐头 RMSNorm。在 700 亿参数规模的预训练中，该 RMSNorm 会在训练后期引发不稳定。V2 用更简单的初始化方案代替了它，无需额外模块即可保持训练稳定。

### 何时使用

| 工作负载 | 收益 |
|----------|------|
| 长上下文 RAG（64k+） | 更清晰的注意力图，更少的幻觉式引用 |
| Needle-in-haystack 基准测试 | 超过 32k 后准确率显著提升 |
| 多文档问答 | 减少跨文档干扰 |
| 8k 代码补全 | 收益有限，不值得改动架构 |
| 短对话（< 4k） | 与基线基本无区别 |

收益随上下文长度增长。在 4k 词元时，噪声基底足够小，标准注意力完全够用。在 128k 时，它正在损害你的效果。

### 与 2026 年其他技术的兼容性

| 特性 | 是否兼容 DIFF V2？ |
|------|-------------------|
| GQA | 是（V2 增加的是 Q 头，而非 KV 头） |
| MLA（DeepSeek） | 原则上可以，但尚无已发表的论文将两者结合 |
| MoE | 是（注意力与 MLP 块相互独立） |
| RoPE | 是（保持不变） |
| YaRN / 长上下文扩展 | 是（这正是 DIFF 最能发挥作用的地方） |
| FlashAttention | V2 支持（V1 不支持） |
| 推测解码 | 是（注意力变化对推测解码循环不可见） |

```figure
differential-attention
```

## 动手实现

`code/main.py` 用纯 Python 实现了差分注意力。一个带有已知信号加噪声结构的玩具查询让你可以直接测量噪声抵消比率。

### 第 1 步：标准 softmax 注意力

标准库矩阵运算：列表的列表、手动矩阵乘法、带有数值稳定性（减去最大值）的 softmax。

```python
def softmax(row):
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]
```

### 第 2 步：将 Q、K 拆分为两半

V1 风格：将头维度减半。V2 风格：保持头维度不变，将头数量翻倍。玩具实现采用 V1 风格以方便教学——数学本质相同，只是记账方式不同。

### 第 3 步：两个 softmax 分支 + 减法

```python
A1 = [softmax([dot(q1, k) / scale for k in K1]) for q1 in Q1]
A2 = [softmax([dot(q2, k) / scale for k in K2]) for q2 in Q2]
diff_weights = [[a1 - lam * a2 for a1, a2 in zip(r1, r2)] for r1, r2 in zip(A1, A2)]
out = [[sum(w * v[j] for w, v in zip(row, V)) for j in range(d_v)] for row in diff_weights]
```

注意：输出权重可以是负数。这没问题——值缓存仍然能处理有符号贡献。后续的 V 投影会吸收符号。

### 第 4 步：噪声抵消测量

构建长度为 1024 的合成序列。将信号词元放在已知位置，其余位置填充噪声。计算（a）标准 softmax 注意力在信号位置上的权重和（b）差分注意力的权重。测量每种方法的信噪比。差分注意力可靠地产生更高的信噪比——根据两个分支训练后的差异程度，通常是标准注意力的 3 到 10 倍。

### 第 5 步：V1 与 V2 的参数量核算

给定配置（hidden=4096, heads=32, d_head=128），打印：

- 基线 Transformer：Q、K、V 各为 `hidden * hidden`，MLP 为 4 * hidden。
- DIFF V1：Q、K 各为 `hidden * hidden`，V 为 `hidden * hidden`（不变），头维度在内部减半。增加逐头 `lambda` 参数（O(heads * d_head)）。
- DIFF V2：Q 为 `2 * hidden * hidden`，K 为 `hidden * hidden`，V 为 `hidden * hidden`。额外的维度在送入 O_W 前投影回原大小。增加相同的 `lambda` 参数。

玩具实现会测量 V2 的额外参数量成本（每个注意力块约 `hidden * hidden` 额外参数）并打印出来。

## 使用

截至 2026 年 4 月，DIFF V2 尚未在每一个生产推理服务器中部署，但 vLLM 和 SGLang 正在集成中。与此同时，该模式出现在以下场景：

- Microsoft 内部的長上下文生产模型。
- 多个面向 256k+ 上下文的目标开放模型训练运行中的研究复现。
- 将 DIFF 注意力与滑动窗口注意力在交替层中结合的混合架构。

2026 年你应该采用它的时机：

- 从头训练一个新模型，目标有效上下文为 64k 以上。从一开始就加入差分注意力；后续再重新训练成本高昂。
- 微调一个长上下文模型，且"丢失在中间"类型的失败主导了你的评估。在 Q 投影上使用 LoRA 可以近似 DIFF 结构。

你不应该采用它的时机：

- 你正在服务一个已预训练的稠密模型，其长上下文性能稳定。在已有权重上重新训练的成本通常难以收回。
- 你的上下文始终在 16k 以下。噪声基底可以忽略。

## 交付物

本课产出 `outputs/skill-diff-attention-integrator.md`。给定模型架构、目标上下文长度、幻觉概况和训练预算，它将生成一个将差分注意力加入新预训练运行或 LoRA 微调中的集成计划。

## 练习

1. 运行 `code/main.py`。验证在合成查询上，差分注意力的信噪比高于标准 softmax 注意力。改变噪声幅度，展示标准注意力变得不可用的交叉点。

2. 计算一个 70 亿参数级模型（hidden=4096, heads=32, d_head=128, 32 层）从基线到 DIFF V1 以及从基线到 DIFF V2 的参数量变化。展示哪些组件增加了参数，哪些保持不变。

3. 阅读 DIFF V1 论文第 3 节（arXiv:2410.05258）和 DIFF V2 Hugging Face 博客第 2 节。用两句话解释为什么 V1 需要逐头 RMSNorm，以及 V2 为何可以移除它而不会导致训练发散。

4. 实现一个消融实验：分别用 `lambda = 0`（纯第一个 softmax）和 `lambda = 1`（完全减法）计算差分注意力。在合成查询上测量信噪比在扫描过程中的变化。找出使信噪比最大化的 `lambda` 值。

5. 将玩具实现扩展到 GQA + DIFF V2。选择 8 个 KV 头和 32 个 Q 头。证明 KV 缓存大小与具有相同（8, 32）配置的基线 GQA 模型一致。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| 差分注意力（Differential attention） | "两个 softmax 相减" | 将 Q、K 拆分为两半，计算两个 softmax 图，将第二个（乘以 lambda）从第一个中减去，再乘以 V |
| 噪声基底（Noise floor） | "softmax 的非零尾部" | Softmax 在每个无关词元上分配的 O(1/N) 权重，在长上下文中总和为 O(1) |
| lambda | "减法缩放因子" | 逐头可学习标量，参数化为 `exp(lq1·lk1) - exp(lq2·lk2) + lambda_init`；可以为负 |
| DIFF V1 | "ICLR 2025 版本" | 原始差分 Transformer；将头维度减半以保持参数量，需要自定义内核，解码更慢 |
| DIFF V2 | "2026 年 1 月的改进版" | Q 头翻倍，KV 头不变；解码速度与基线持平，兼容 FlashAttention |
| 逐头 RMSNorm | "V1 的稳定器" | V1 在差值之后应用的额外归一化；V2 移除了它以防止训练后期不稳定 |
| 信噪比（Signal-to-noise ratio） | "有多少注意力被浪费了" | 真实信号位置上的权重与无关位置上的平均权重的比值 |
| 丢失在中间（Lost in the middle） | "长上下文失效模式" | 检索准确率在长上下文中间位置的文档时下降的经验现象——DIFF 注意力减轻了这一问题 |
| 算术强度（Arithmetic intensity） | "每字节加载的 FLOPs" | V2 通过每次 KV 加载进行双倍查询计算而提高的比率；对内存受限的解码至关重要 |

## 延伸阅读

- [Ye et al. — Differential Transformer (arXiv:2410.05258, ICLR 2025)](https://arxiv.org/abs/2410.05258) — 原始论文，包含噪声抵消理论和长上下文消融实验
- [Microsoft unilm — Differential Transformer V2 (Hugging Face 博客, 2026 年 1 月)](https://huggingface.co/blog/microsoft/diff-attn-v2) — 生产堆栈重写，解码速度与基线持平，兼容 FlashAttention
- [Understanding Differential Transformer Unchains Pretrained Self-Attentions (arXiv:2505.16333)](https://arxiv.org/abs/2505.16333) — 关于减法为何能恢复预训练注意力结构的理论分析
- [Shared DIFF Transformer (arXiv:2501.17900)](https://arxiv.org/html/2501.17900) — 参数共享变体
- [Vaswani et al. — Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762) — DIFF 从中减去的基线 Transformer
- [Liu et al. — Lost in the Middle (arXiv:2307.03172)](https://arxiv.org/abs/2307.03172) — DIFF 注意力所针对的长上下文基准测试
