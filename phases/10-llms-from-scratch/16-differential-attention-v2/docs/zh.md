# 差分注意力（V2）

> Softmax attention 在每个非匹配 token 上散布少量概率。超过 100k token 时，这些噪声累积并淹没信号。差分 Transformer（Ye et al., ICLR 2025）通过计算两个 softmax 的差值来修复它，减去共享的噪声基底。DIFF V2（Microsoft，2026 年 1 月）是生产栈重写：匹配基线 Transformer 的解码延迟，无需自定义内核，兼容 FlashAttention。本课是 V1 到 V2 的端到端，带有一个你可以在标准库 Python 中运行的差分操作工作玩具实现。

**类型：** 构建
**语言：** Python（标准库）
**前置要求：** 第 7 阶段 · 02（self-attention），第 7 阶段 · 15（attention 变体），第 10 阶段 · 14（架构走读）
**时间：** ~60 分钟

## 学习目标

- 精确陈述为什么 softmax attention 有噪声基底，以及为什么它随上下文长度增长
- 推导差分注意力公式，并解释为什么减法抵消共享噪声分量同时保留信号
- 走过 V1 到 V2 的 diff：什么变快了、什么变简单了、什么更稳定了，以及为什么每个改动对生产预训练是必要的
- 在纯 Python 中从零实现差分注意力，并在合成信号加噪声查询上实证验证噪声抵消特性

## 问题

标准 softmax attention 有一个数学特性，在规模上转变为操作头痛。对于查询 `q`，注意力权重是 `softmax(qK^T / sqrt(d))`。Softmax 永远不能产生精确的零 —— 每个非匹配 token 都得到一些正质量。该残余质量是噪声，并随上下文长度缩放。在 128k token 时，即使每个非匹配 token 只获得 0.001% 的概率，127,999 个合计贡献约 12% 的总量。模型必须学习路由一个随上下文增长的噪声基底。

经验上这表现为 attention head 干扰：长上下文 RAG 中的幻觉引用、100k token 检索任务上的 lost-in-the-middle 失败，以及超过 32k 的 needle-in-haystack 基准上的微妙精度退化。差分 Transformer 论文（arXiv:2410.05258, ICLR 2025）测量了差距：DIFF Transformer 在相同大小基线上达到更低困惑度、更高长上下文精度和更少幻觉。

DIFF V1 有三个问题使其无法进入前沿预训练流水线。它的 value 缓存每解码步必须加载两次，它需要破坏 FlashAttention 兼容性的自定义 CUDA 内核，以及它的 per-head RMSNorm 在 70B 以上规模的长期训练中失稳。DIFF V2（Microsoft unilm 博客，2026 年 1 月 20 日）修复了所有三个。本课走过两个版本，构建差分操作符，并在玩具查询上基准测试噪声抵消。

## 核心概念

### Softmax 的噪声基底

对于查询 `q` 和键 `K = [k_1, ..., k_N]`，注意力权重为：

```
w_i = exp(q . k_i / sqrt(d)) / sum_j exp(q . k_j / sqrt(d))
```

没有 `w_i` 是零。如果 `k_i` 与 `q` 完全无关，分数 `q . k_i` 不是 0 —— 它以方差 `||q||^2 / d` 在零附近波动。Softmax 归一化后，每个无关 token 仍贡献 `O(1/N)` 到加权和。无关 token 的总贡献是 `O((N-1)/N) = O(1)` —— 不是小量。

模型想要的是类似硬 top-k：匹配 token 上高权重，其他地方近零权重。Softmax 太平滑，无法直接做到。

### 差分思想

将每个 head 的 Q 和 K 投影分成两个：Q = (Q_1, Q_2) 和 K = (K_1, K_2)。计算两个 attention 图：

```
A_1 = softmax(Q_1 K_1^T / sqrt(d))
A_2 = softmax(Q_2 K_2^T / sqrt(d))
```

输出：

```
DiffAttn = (A_1 - lambda * A_2) V
```

减法抵消两个图共享的任何噪声分布。如果两个图在 127k 无关 token 上都有大致均匀的权重（在随机初始化时它们会），那些抵消。信号 —— 在少数真正相关 token 上的峰值权重 —— 只在以相同幅度出现在两个图中时才抵消，一旦模型训练就不会这样。

`lambda` 是每 head 可学习的标量，参数化为 `lambda = exp(lambda_q1 dot lambda_k1) - exp(lambda_q2 dot lambda_k2) + lambda_init`。它可以是负数。`lambda_init` 默认为小的正数如 0.8。

### 为什么这匹配 headed 噪声抵消

想象两个嘈杂麦克风录制同一个声音。两者都拾取说话者加相关背景噪声。将一个从另一个减去，共享噪声下降。声音存活，因为两个信号在相位或幅度上差异足够大以防止完全抵消。Per-head `lambda` 学习正是这个平衡。

### V1 vs V2：diff

V1 保持参数数量与基线 Transformer 相等。为获得每 head 两个查询，它 halved head 维度。这损失了 head 表达能力，更痛苦地 —— halved 每 head 的 value 缓存。解码每步必须加载 value 缓存两次（每 softmax 分支一次）。结果：解码比基线慢，尽管参数数量匹配。

V2 将查询 head 数量加倍，保持 KV head 不变（从 up-projection 借用参数）。Head 维度保持与基线相同。减法后，额外维度被投影回以匹配基线 Transformer 的 O_W 投影。三件事同时发生：

1. 解码速度匹配基线（KV 缓存加载一次）。
2. FlashAttention 不变运行（无需自定义内核）。
3. 解码时算术强度上升（每从 HBM 加载的字节更多计算）。

V2 还移除了 V1 用于稳定减法的 per-head RMSNorm。在 70B 级预训练规模上，该 RMSNorm 使晚期训练失稳。V2 用一个更简单的初始化方案替代它，无需额外模块即可保持训练稳定。

### 何时使用它

| 工作负载 | 收益 |
|----------|---------|
| 长上下文 RAG (64k+) | 更干净的 attention 图，更少幻觉引用 |
| Needle-in-haystack 基准 | 超过 32k 后显著精度提升 |
| 多文档 QA | 更少跨文档干扰 |
| 8k 代码补全 | 边际，不值得架构变更 |
| 短聊天 (< 4k) | 与基线基本不可区分 |

价值随上下文长度增长。在 4k token 时噪声基底足够小，标准 attention 没问题。在 128k 时它在伤害你。

### 如何与其他 2026 旋钮叠加

| 特性 | 与 DIFF V2 兼容？ |
|---------|------------------------|
| GQA | 是（V2 增加 Q head，非 KV head） |
| MLA (DeepSeek) | 原则上可以，无已发表论文结合它们 |
| MoE | 是（attention 独立于 MLP block） |
| RoPE | 是（不变） |
| YaRN / 长上下文缩放 | 是（DIFF 最帮助的地方） |
| FlashAttention | V2 是（V1 否） |
| 推测解码 | 是（attention 变更对 spec-decode 循环不可见） |

## 构建

`code/main.py` 在纯 Python 中实现差分注意力。一个具有已知信号加噪声结构的玩具查询让你直接测量噪声抵消比率。

### 步骤 1：标准 softmax attention

标准库矩阵操作：列表的列表，手动 matmul，数值稳定性减去最大值的 softmax。

```python
def softmax(row):
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]
```

### 步骤 2：将 Q、K 分成两半

V1 风格：halve head 维度。V2 风格：保持 head 维度并加倍 head 数量。玩具实现为教学清晰使用 V1 —— 数学相同，只有簿记不同。

### 步骤 3：两个 softmax 分支 + 减法

```python
A1 = [softmax([dot(q1, k) / scale for k in K1]) for q1 in Q1]
A2 = [softmax([dot(q2, k) / scale for k in K2]) for q2 in Q2]
diff_weights = [[a1 - lam * a2 for a1, a2 in zip(r1, r2)] for r1, r2 in zip(A1, A2)]
out = [[sum(w * v[j] for w, v in zip(row, V)) for j in range(d_v)] for row in diff_weights]
```

注意：输出权重可以为负。这没问题 —— value 缓存仍处理有符号贡献。随后的 V 投影吸收符号。

### 步骤 4：噪声抵消测量

构建长度 1024 的合成序列。在已知位置放置信号 token，其余填充噪声。计算（a）标准 softmax attention 在信号位置的权重和（b）差分 attention 权重。测量每个的信噪比。DIFF attention 可靠地产生高 3 倍到 10 倍的信噪比，取决于两个分支被训练到多大程度不同。

### 步骤 5：V1 vs V2 参数核算

给定配置（hidden=4096, heads=32, d_head=128），打印：

- 基线 Transformer：Q、K、V 每个大小 `hidden * hidden`，MLP 在 4 * hidden。
- DIFF V1：Q、K 每个大小 `hidden * hidden`，V 大小 `hidden * hidden`（不变），内部 head 维度 halved。添加 per-head `lambda` 参数（O(heads * d_head)）。
- DIFF V2：Q 大小 `2 * hidden * hidden`，K 大小 `hidden * hidden`，V 大小 `hidden * hidden`。额外维度在 O_W 前投影回。添加相同 `lambda` 参数。

玩具测量 V2 的额外参数成本（每 attention block 约 `hidden * hidden` 额外）并打印它。

## 使用它

截至 2026 年 4 月，DIFF V2 尚未在每个生产推理服务器中出货，但 vLLM 和 SGLang 的集成正在进行中。同时该模式出现在：

- Microsoft 内部长上下文生产模型。
- 多个针对 256k 以上上下文的开源模型训练运行中的研究复现。
- 将 DIFF attention 与滑动窗口 attention 在交替层上结合的混合架构。

2026 年何时使用它：

- 从头训练针对 64k 以上有效上下文的新模型。从一开始就添加差分注意力；稍后重新训练很昂贵。
- 微调长上下文模型，其中 lost-in-the-middle 失败主导你的评估。Q 投影上的 LoRA 可以近似 DIFF 结构。

何时不使用：

- 你正在服务具有稳定长上下文性能的预训练 dense 模型。现有权重上的重新训练成本很少回本。
- 你的上下文始终在 16k 以下。噪声基底可忽略。

## 交付

本课生成 `outputs/skill-diff-attention-integrator.md`。给定模型架构、目标上下文长度、幻觉画像和训练预算，它产出将差分注意力添加到新预训练运行或 LoRA 微调的集成计划。

## 练习

1. 运行 `code/main.py`。验证差分注意力报告的信噪比高于合成查询上的标准 softmax attention。改变噪声幅度并显示标准 attention 变得不可用的交叉点。

2. 计算从基线到 DIFF V1 和从基线到 DIFF V2 的 7B 级模型（hidden=4096, heads=32, d_head=128, 32 层）的参数数量差。显示哪些组件获得参数，哪些保持不变。

3. 阅读 DIFF V1 论文的第 3 节（arXiv:2410.05258）和 DIFF V2 Hugging Face 博客的第 2 节。用两句话解释为什么 V1 per-head RMSNorm 是必要的，以及为什么 V2 可以在不导致训练发散的情况下移除它。

4. 实现消融：用 `lambda = 0`（纯第一个 softmax）和 `lambda = 1`（完全减法）计算差分注意力。在合成查询上，测量信噪比如何随扫描变化。识别最大化信噪比的 `lambda`。

5. 将玩具扩展到 GQA + DIFF V2。选择 8 个 KV head 和 32 个 Q head。显示 KV 缓存大小与具有相同 (8, 32) 配置的基线 GQA 模型匹配。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| 差分注意力 | "两个 softmax 互相减去" | 将 Q、K 分成两半，计算两个 softmax 图，将第二个（按 lambda 缩放）从第一个减去，然后乘以 V |
| 噪声基底 | "Softmax 的非零尾部" | Softmax 在每个无关 token 上放置的 O(1/N) 权重，在长上下文中合计为 O(1) |
| lambda | "减法缩放" | 每 head 可学习标量，参数化为 `exp(lq1.lk1) - exp(lq2.lk2) + lambda_init`；可以为负 |
| DIFF V1 | "ICLR 2025 版本" | 原始差分 Transformer；halve head 维度以保持参数数量，需要自定义内核，解码更慢 |
| DIFF V2 | "2026 年 1 月修复" | 加倍 Q head 保持 KV head；匹配基线解码速度并与 FlashAttention 工作 |
| Per-head RMSNorm | "V1 稳定器" | V1 在差值后应用的额外 norm；V2 移除它以防止晚期训练失稳 |
| 信噪比 | "多少注意力被浪费" | 真实信号位置上的权重与无关位置平均权重的比率 |
| Lost in the middle | "长上下文失败模式" | 检索精度在长上下文中间文档处下降的经验现象 —— DIFF attention 减少此现象 |
| 算术强度 | "每加载字节的 FLOPs" | V2 通过每 KV 加载加倍查询在解码时增加的比率；对内存受限解码很重要 |

## 延伸阅读

- [Ye et al. — Differential Transformer (arXiv:2410.05258, ICLR 2025)](https://arxiv.org/abs/2410.05258) —— 原始论文，含噪声抵消理论和长上下文消融
- [Microsoft unilm — Differential Transformer V2 (Hugging Face blog, January 2026)](https://huggingface.co/blog/microsoft/diff-attn-v2) —— 生产栈重写，匹配基线解码，兼容 FlashAttention
- [Understanding Differential Transformer Unchains Pretrained Self-Attentions (arXiv:2505.16333)](https://arxiv.org/abs/2505.16333) —— 理论分析为什么减法恢复预训练 attention 结构
- [Shared DIFF Transformer (arXiv:2501.17900)](https://arxiv.org/html/2501.17900) —— 参数共享变体
- [Vaswani et al. — Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762) —— DIFF 减去的基线 Transformer
- [Liu et al. — Lost in the Middle (arXiv:2307.03172)](https://arxiv.org/abs/2307.03172) —— DIFF attention 针对的长上下文基准
