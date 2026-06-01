# 16 · 差分注意力（V2）

> Softmax 注意力会把一小部分概率分散到每一个不匹配的 token 上。在超过 10 万个 token 的情况下，这些噪声累积起来会淹没信号。差分 Transformer（Differential Transformer，Ye 等人，ICLR 2025）通过把注意力计算为两个 softmax 之差来修复这一点，从而减去共享的噪声底噪。DIFF V2（微软，2026 年 1 月）是面向生产技术栈的重写版：解码延迟与基线 Transformer 持平，无需自定义 kernel，且与 FlashAttention 兼容。本课从头到尾讲清 V1 到 V2 的演进，并给出一个你可以用标准库 Python 运行的差分操作玩具实现。

**类型：** 构建（Build）
**语言：** Python（标准库）
**前置：** 阶段 7 · 02（自注意力）、阶段 7 · 15（注意力变体）、阶段 10 · 14（架构走查）
**时长：** 约 60 分钟

## 学习目标

- 精确说明为什么 softmax 注意力存在噪声底噪（noise floor），以及为什么它随上下文长度增长。
- 推导差分注意力公式，并解释为什么这个减法在保留信号的同时消除了共享的噪声成分。
- 走查 V1 到 V2 的差异：什么变快了、什么变简单了、什么变得更稳定，以及为什么每一处改动对生产级预训练都是必要的。
- 用纯 Python 从零实现差分注意力，并在一个合成的「信号加噪声」查询上实证验证其噪声消除特性。

## 问题所在

标准 softmax 注意力有一个数学性质，在大规模场景下会变成运维上的难题。对于一个查询 `q`，注意力权重为 `softmax(qK^T / sqrt(d))`。softmax 永远无法产生精确的零——每个不匹配的 token 都会分到一些正的概率质量。这部分残留质量就是噪声，并且它随上下文长度增长。在 128k 个 token 的情况下，即便每个不匹配 token 只分到 0.001% 的概率，把 127,999 个加起来也贡献了约 12% 的总量。模型不得不学会绕过一个随上下文增长的噪声底噪。

实证上，这表现为注意力头之间的干扰：长上下文 RAG 中的引用幻觉、在 10 万 token 检索任务上的「中间迷失（lost-in-the-middle）」失败，以及在大海捞针（needle-in-haystack）基准上超过 32k 后细微的准确率下降。差分 Transformer 论文（arXiv:2410.05258，ICLR 2025）测量了这一差距：相比同规模基线，DIFF Transformer 取得了更低的困惑度、更高的长上下文准确率以及更少的幻觉。

DIFF V1 有三个问题，使其无法进入前沿预训练流水线。它的 value 缓存在每个解码步骤需要加载两次；它需要自定义 CUDA kernel，破坏了 FlashAttention 兼容性；而它的逐头 RMSNorm 在 70B 以上规模下会使长程训练失稳。DIFF V2（微软 unilm 博客，2026 年 1 月 20 日）修复了这全部三点。本课走查两个版本、构建差分算子，并在一个玩具查询上对噪声消除进行基准测试。

## 概念

### softmax 的噪声底噪

对于一个查询 `q` 和键 `K = [k_1, ..., k_N]`，注意力权重为：

```
w_i = exp(q . k_i / sqrt(d)) / sum_j exp(q . k_j / sqrt(d))
```

任何 `w_i` 都不会为零。如果 `k_i` 与 `q` 完全无关，得分 `q . k_i` 也不是 0——它会以方差 `||q||^2 / d` 围绕零波动。经过 softmax 归一化后，每个无关 token 仍然向加权和贡献 `O(1/N)`。无关 token 的总贡献为 `O((N-1)/N) = O(1)`——这不是一个小量。

模型真正想要的是类似硬性 top-k 的东西：在匹配 token 上给出高权重，在其他所有位置上给出接近零的权重。softmax 太平滑，无法直接做到这一点。

### 差分思想

把每个头的 Q 和 K 投影各拆成两份：Q = (Q_1, Q_2) 和 K = (K_1, K_2)。计算两张注意力图：

```
A_1 = softmax(Q_1 K_1^T / sqrt(d))
A_2 = softmax(Q_2 K_2^T / sqrt(d))
```

输出：

```
DiffAttn = (A_1 - lambda * A_2) V
```

这个减法会消除两张图共享的任意噪声分布。如果两张图在 12.7 万个无关 token 上都有大致均匀的权重（在随机初始化时确实会如此），那它们就相互抵消。而信号——集中在少数真正相关 token 上的峰值权重——只有在两张图中以相同幅度出现时才会被抵消，而一旦模型完成训练，这就不会发生。

`lambda` 是每个头一个的可学习标量，参数化为 `lambda = exp(lambda_q1 dot lambda_k1) - exp(lambda_q2 dot lambda_k2) + lambda_init`。它可以为负。`lambda_init` 默认取一个较小的正数，例如 0.8。

### 为什么这与定向降噪相对应

设想两个有噪声的麦克风录制同一段人声。两者都会拾取说话人加上相关的背景噪声。把一个减去另一个，共享噪声就消失了。人声之所以保留下来，是因为两路信号在相位或幅度上的差异足够大，从而避免被完全抵消。逐头的 `lambda` 学习的正是这种平衡。

### V1 与 V2：差异对比

V1 保持参数量与基线 Transformer 相等。为了在每个头里得到两个 query，它把头维度（head dimension）减半。这牺牲了头的表达力，并且——更痛苦的是——把每个头的 value 缓存也减半了。解码时不得不在每步加载 value 缓存两次（每个 softmax 分支一次）。结果：尽管参数量相当，解码却比基线更慢。

V2 把 query 头的数量翻倍，同时保持 KV 头数量不变（从上投影借用参数）。头维度保持与基线相同。在做完减法后，多出的维度被投影回去，以匹配基线 Transformer 的 O_W 投影。三件事同时发生：

1. 解码速度与基线持平（KV 缓存只加载一次）。
2. FlashAttention 无需改动即可运行（没有自定义 kernel）。
3. 解码时的算术强度（arithmetic intensity）提升（每从 HBM 加载一字节所做的计算更多）。

V2 还移除了 V1 用来稳定减法的逐头 RMSNorm。在 70B 级别的预训练规模下，那个 RMSNorm 会让训练后期失稳。V2 用一个更简单的初始化方案取而代之，在不需要额外模块的情况下保持训练稳定。

### 何时选用它

| 工作负载 | 收益 |
|----------|------|
| 长上下文 RAG（64k+） | 注意力图更干净，引用幻觉更少 |
| 大海捞针基准 | 超过 32k 后准确率显著提升 |
| 多文档问答 | 跨文档干扰更少 |
| 8k 处的代码补全 | 边际收益，不值得为此改架构 |
| 短对话（< 4k） | 与基线基本无法区分 |

其价值随上下文长度增长。在 4k token 时噪声底噪足够小，标准注意力就够用。在 128k 时它就在拖累你了。

### 它如何与 2026 年的其他旋钮叠加

| 特性 | 与 DIFF V2 兼容吗？ |
|------|------------------|
| GQA | 是（V2 增加的是 Q 头，而非 KV 头） |
| MLA（DeepSeek） | 原则上可以，但尚无公开论文将二者结合 |
| MoE | 是（注意力独立于 MLP 块） |
| RoPE | 是（不变） |
| YaRN / 长上下文扩展 | 是（这正是 DIFF 帮助最大的地方） |
| FlashAttention | V2 中是（V1 中否） |
| 投机解码（speculative decoding） | 是（注意力的改动对投机解码循环不可见） |

## 动手构建

`code/main.py` 用纯 Python 实现差分注意力。一个具有已知「信号加噪声」结构的玩具查询，能让你直接测量噪声消除比率。

### 第 1 步：标准 softmax 注意力

标准库矩阵运算：用列表的列表、手写 matmul、以及减去最大值以保证数值稳定的 softmax。

```python
def softmax(row):
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]
```

### 第 2 步：把 Q、K 拆成两半

V1 风格：把头维度减半。V2 风格：保持头维度并把头数量翻倍。这个玩具实现采用 V1 是为了教学上的清晰——数学完全相同，区别只在记账方式上。

### 第 3 步：两个 softmax 分支 + 减法

```python
A1 = [softmax([dot(q1, k) / scale for k in K1]) for q1 in Q1]
A2 = [softmax([dot(q2, k) / scale for k in K2]) for q2 in Q2]
diff_weights = [[a1 - lam * a2 for a1, a2 in zip(r1, r2)] for r1, r2 in zip(A1, A2)]
out = [[sum(w * v[j] for w, v in zip(row, V)) for j in range(d_v)] for row in diff_weights]
```

注意：输出权重可以为负。这没问题——value 缓存依然能处理带符号的贡献。后续的 V 投影会吸收符号。

### 第 4 步：噪声消除度量

构建一个长度为 1024 的合成序列。把信号 token 放在一个已知位置，其余用噪声填充。计算 (a) 信号位置上的标准 softmax 注意力权重，以及 (b) 差分注意力权重。测量两者各自的信噪比。DIFF 注意力可靠地产生更高的信噪比，提升幅度为 3 倍到 10 倍，具体取决于两个分支被训练得有多大差异。

### 第 5 步：V1 与 V2 的参数账

给定一个配置（hidden=4096, heads=32, d_head=128），打印：

- 基线 Transformer：Q、K、V 各为 `hidden * hidden` 大小，MLP 为 `4 * hidden`。
- DIFF V1：Q、K 各为 `hidden * hidden` 大小，V 为 `hidden * hidden`（不变），内部头维度减半。额外增加逐头 `lambda` 参数（`O(heads * d_head)`）。
- DIFF V2：Q 为 `2 * hidden * hidden`，K 为 `hidden * hidden`，V 为 `hidden * hidden`。多出的维度在 O_W 前被投影回去。额外增加同样的 `lambda` 参数。

这个玩具会测量 V2 的额外参数开销（每个注意力块大约多出 `hidden * hidden`）并打印出来。

## 实际运用

截至 2026 年 4 月，DIFF V2 尚未在每个生产推理服务器中上线，但在 vLLM 和 SGLang 中的集成正在进行。与此同时，这一模式已出现在：

- 微软内部的长上下文生产模型中。
- 若干面向 256k 以上上下文的开放模型训练运行的研究复现中。
- 在交替层上将 DIFF 注意力与滑动窗口注意力（sliding-window attention）结合的混合架构中。

2026 年你会在何时选用它：

- 从零训练一个面向 64k 以上有效上下文的新模型。从一开始就加入差分注意力；事后再重训代价高昂。
- 微调一个长上下文模型，其评测中「中间迷失」失败占主导。在 Q 投影上做 LoRA 可以近似 DIFF 结构。

何时不会选用它：

- 你正在服务一个长上下文性能稳定的预训练稠密模型。在已有权重上重训的成本很少能回本。
- 你的上下文始终在 16k 以下。噪声底噪可忽略不计。

## 交付成果

本课产出 `outputs/skill-diff-attention-integrator.md`。给定一个模型架构、目标上下文长度、幻觉画像和训练预算，它会产出一份集成方案，用于把差分注意力加入新的预训练运行或 LoRA 微调。

## 练习

1. 运行 `code/main.py`。验证差分注意力在合成查询上报告的信噪比高于标准 softmax 注意力。改变噪声幅度，展示标准注意力变得不可用的临界点。

2. 为一个 7B 级别的模型（hidden=4096, heads=32, d_head=128, 32 层）计算从基线到 DIFF V1、以及从基线到 DIFF V2 的参数量差值。指出哪些组件增加了参数、哪些保持不变。

3. 阅读 DIFF V1 论文（arXiv:2410.05258）的第 3 节和 DIFF V2 Hugging Face 博客的第 2 节。用两句话解释为什么 V1 的逐头 RMSNorm 是必要的，以及为什么 V2 能在不导致训练发散的情况下移除它。

4. 实现一个消融实验：用 `lambda = 0`（纯第一个 softmax）和 `lambda = 1`（完整减法）计算差分注意力。在合成查询上，测量信噪比在这一扫描区间内如何变化。找出使信噪比最大化的 `lambda`。

5. 把这个玩具扩展到 GQA + DIFF V2。选择 8 个 KV 头和 32 个 Q 头。证明其 KV 缓存大小与具有相同 (8, 32) 配置的基线 GQA 模型相匹配。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------|-------------|
| 差分注意力（Differential attention） | 「两个 softmax 相减」 | 把 Q、K 各拆成两半，计算两张 softmax 图，从第一张中减去（按 lambda 缩放的）第二张，然后乘以 V |
| 噪声底噪（Noise floor） | 「softmax 的非零尾部」 | softmax 给每个无关 token 的 O(1/N) 权重，在长上下文中累加为 O(1) |
| lambda | 「减法的缩放系数」 | 逐头可学习标量，参数化为 `exp(lq1.lk1) - exp(lq2.lk2) + lambda_init`；可为负 |
| DIFF V1 | 「ICLR 2025 版本」 | 最初的差分 Transformer；把头维度减半以保持参数量，需要自定义 kernel，解码更慢 |
| DIFF V2 | 「2026 年 1 月的修复版」 | 把 Q 头翻倍同时保持 KV 头不变；解码速度与基线持平，并与 FlashAttention 配合工作 |
| 逐头 RMSNorm（Per-head RMSNorm） | 「V1 的稳定器」 | V1 在差分之后施加的额外归一化；V2 移除了它以防止训练后期失稳 |
| 信噪比（Signal-to-noise ratio） | 「有多少注意力被浪费」 | 真实信号位置上的权重与无关位置平均权重之比 |
| 中间迷失（Lost in the middle） | 「长上下文失败模式」 | 一种实证现象：对长上下文中间部位的文档，检索准确率会下降——DIFF 注意力可缓解这一点 |
| 算术强度（Arithmetic intensity） | 「每加载一字节做多少 FLOPs」 | V2 通过在每次 KV 加载上翻倍 query 来提升的比率；对内存受限的解码很重要 |

## 延伸阅读

- [Ye 等人 —— 差分 Transformer（arXiv:2410.05258，ICLR 2025）](https://arxiv.org/abs/2410.05258) —— 提出噪声消除理论与长上下文消融实验的原始论文
- [微软 unilm —— 差分 Transformer V2（Hugging Face 博客，2026 年 1 月）](https://huggingface.co/blog/microsoft/diff-attn-v2) —— 面向生产技术栈的重写版，解码与基线持平，且兼容 FlashAttention
- [理解差分 Transformer 如何解放预训练自注意力（arXiv:2505.16333）](https://arxiv.org/abs/2505.16333) —— 关于为什么这个减法能恢复预训练注意力结构的理论分析
- [共享 DIFF Transformer（arXiv:2501.17900）](https://arxiv.org/html/2501.17900) —— 参数共享变体
- [Vaswani 等人 —— Attention Is All You Need（arXiv:1706.03762）](https://arxiv.org/abs/1706.03762) —— DIFF 据以相减的基线 Transformer
- [Liu 等人 —— Lost in the Middle（arXiv:2307.03172）](https://arxiv.org/abs/2307.03172) —— DIFF 注意力针对的长上下文基准
