# 差分注意力(V2)

> softmax 注意力会向每个不匹配的 token 分散少量概率。在 10 万 token 的规模下,这些噪声会累积并淹没信号。Differential Transformer(Ye et al., ICLR 2025)通过将注意力计算为两个 softmax 的差值来解决这一问题,从而减去共享的噪声底。DIFF V2(微软,2026 年 1 月)是面向生产栈的重写:解码延迟与基线 Transformer 持平,无需自定义 kernel,兼容 FlashAttention。本课程从 V1 到 V2 进行端到端讲解,并提供一个可运行的差值运算玩具实现,你可以用标准库 Python 直接运行。

**Type:** Build
**Languages:** Python(stdlib)
**Prerequisites:** Phase 7 · 02(自注意力),Phase 7 · 15(注意力变体),Phase 10 · 14(架构走读)
**Time:** ~60 分钟

## 学习目标

- 准确说明为什么 softmax 注意力存在噪声底,以及为什么它随上下文长度增长。
- 推导差分注意力公式,并解释为什么相减能抵消共享的噪声成分,同时保留信号。
- 走读 V1 到 V2 的差异:哪些变快了、哪些变简单了、哪些变稳定了,以及为什么每项改动对生产级预训练都是必要的。
- 在纯 Python 中从零实现差分注意力,并在一个合成的“信号+噪声”查询上实证验证其噪声抵消特性。

## 问题

标准的 softmax 注意力有一个数学性质,在大规模场景下会转化为运维上的麻烦。对于一个查询 `q`,注意力权重为 `softmax(qK^T / sqrt(d))`。softmax 永远不会产生精确的零——每个不匹配的 token 都会获得一些正概率质量。这部分残余质量就是噪声,且随上下文长度增长而扩大。在 128k token 时,即使每个不匹配的 token 只获得 0.001% 的概率,127,999 个 token 合计也贡献了约 12% 的总概率。模型必须学会绕过一个随上下文增长的噪声底进行路由。

在经验上,这表现为注意力头之间的干扰:长上下文 RAG 中的幻觉引用、10 万 token 检索任务中的 lost-in-the-middle 失败,以及在超过 32k 的 needle-in-haystack 基准上的轻微精度下降。Differential Transformer 论文(arXiv:2410.05258,ICLR 2025)测量了这一差距:DIFF Transformer 相比同等规模的基线,取得了更低的困惑度、更高的长上下文精度和更少的幻觉。

DIFF V1 存在三个问题,使其无法进入前沿预训练流水线:它的 value 缓存在每个解码步骤必须加载两次;它需要破坏 FlashAttention 兼容性的自定义 CUDA kernel;其逐头的 RMSNorm 在 70B 以上规模的长时间训练中不稳定。DIFF V2(微软 unilm 博客,2026 年 1 月 20 日)修复了这三个问题。本课程讲解两个版本,构建差值算子,并在一个玩具查询上对噪声抵消进行基准测试。

## 概念

### softmax 的噪声底

对于查询 `q` 和键 `K = [k_1, ..., k_N]`,注意力权重为:

```
w_i = exp(q . k_i / sqrt(d)) / sum_j exp(q . k_j / sqrt(d))
```

没有任何 `w_i` 会是零。如果 `k_i` 与 `q` 完全无关,分数 `q . k_i` 也不是 0——它围绕零波动,方差为 `||q||^2 / d`。经过 softmax 归一化后,每个无关 token 仍会向加权和贡献 `O(1/N)`。所有无关 token 的总贡献为 `O((N-1)/N) = O(1)`——这不是一个小量。

模型真正想要的是类似硬性 top-k 的东西:在匹配的 token 上有高权重,在其他地方权重接近零。softmax 太过平滑,无法直接做到这一点。

### 差分思想

将每个头的 Q 和 K 投影各分成两份:Q = (Q_1, Q_2) 和 K = (K_1, K_2)。计算两个注意力图:

```
A_1 = softmax(Q_1 K_1^T / sqrt(d))
A_2 = softmax(Q_2 K_2^T / sqrt(d))
```

输出:

```
DiffAttn = (A_1 - lambda * A_2) V
```

相减会抵消两个注意力图共享的任何噪声分布。如果两个注意力图在 12.7 万个无关 token 上的权重都大致均匀(在随机初始化时确实如此),它们就会相互抵消。而信号——集中在少数真正相关 token 上的峰值权重——只有当它以相同幅度出现在两个注意力图中时才会被抵消,而模型一旦训练,这种情况就不会发生。

`lambda` 是一个逐头的可学习标量,参数化为 `lambda = exp(lambda_q1 dot lambda_k1) - exp(lambda_q2 dot lambda_k2) + lambda_init`。它可以为负。`lambda_init` 默认为一个小的正数,例如 0.8。

### 为什么这类似于有头的噪声消除

想象两个录制同一人声的带噪声麦克风。两者都拾取到说话者以及相关的背景噪声。将其中一个从另一个中减去,共享的噪声就被消除了。人声得以保留,因为两路信号在相位或幅度上存在足够差异,从而避免完全抵消。逐头的 `lambda` 学到的正是这种平衡。

### V1 对比 V2:差异

V1 将参数量保持在基线 Transformer 的水平。为了给每个头得到两个查询,它将头维度减半。这损失了头的表达能力,更痛苦的是,将每个头的 value 缓存减半。解码必须在每一步加载 value 缓存两次(每个 softmax 分支一次)。结果是:尽管参数量持平,解码却比基线更慢。

V2 将查询头数量翻倍,同时保持 KV 头数量不变(从上投影借用参数)。头维度与基线保持一致。相减之后,多出的维度被投影回基线 Transformer 的 O_W 投影维度。三件事同时发生:

1. 解码速度与基线持平(KV 缓存只加载一次)。
2. FlashAttention 无需改动即可运行(没有自定义 kernel)。
3. 解码时的算术强度上升(每从 HBM 加载一个字节获得的计算量更多)。

V2 还移除了 V1 用来稳定相减操作的逐头 RMSNorm。在 70B 级预训练规模下,该 RMSNorm 会使训练后期不稳定。V2 用一个更简单的初始化方案替代它,无需额外模块即可保持训练稳定。

### 何时使用它

| 工作负载 | 收益 |
|----------|---------|
| 长上下文 RAG(64k+) | 更干净的注意力图,更少的幻觉引用 |
| Needle-in-haystack 基准 | 在 32k 以上有显著精度提升 |
| 多文档问答 | 更少的跨文档干扰 |
| 8k 代码补全 | 收益微小,不值得改动架构 |
| 短对话(< 4k) | 与基线基本无法区分 |

其价值随上下文长度增长而增加。在 4k token 时,噪声底足够小,标准注意力完全够用。在 128k 时,它已经在损害你的效果。

### 与其他 2026 年配置项的叠加

| 特性 | 与 DIFF V2 兼容? |
|---------|------------------------|
| GQA | 是(V2 增加的是 Q 头,而非 KV 头) |
| MLA(DeepSeek) | 原理上可行,尚无公开发表的组合论文 |
| MoE | 是(注意力与 MLP 块相互独立) |
| RoPE | 是(无改动) |
| YaRN / 长上下文扩展 | 是(正是 DIFF 最有帮助的场景) |
| FlashAttention | V2 中是(V1 中不是) |
| 投机解码 | 是(注意力的改动对投机解码循环不可见) |

```figure
differential-attention
```

## 动手构建

`code/main.py` 用纯 Python 实现了差分注意力。一个具有已知“信号+噪声”结构的玩具查询让你能直接测量噪声抵消比率。

### 第 1 步:标准 softmax 注意力

标准库矩阵运算:列表的列表、手动 matmul、带数值稳定性减最大值处理的 softmax。

```python
def softmax(row):
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]
```

### 第 2 步:将 Q、K 分成两半

V1 风格:将头维度减半。V2 风格:保持头维度并将头数量翻倍。出于教学清晰性,玩具实现采用 V1——数学完全相同,只是簿记方式不同。

### 第 3 步:两个 softmax 分支 + 相减

```python
A1 = [softmax([dot(q1, k) / scale for k in K1]) for q1 in Q1]
A2 = [softmax([dot(q2, k) / scale for k in K2]) for q2 in Q2]
diff_weights = [[a1 - lam * a2 for a1, a2 in zip(r1, r2)] for r1, r2 in zip(A1, A2)]
out = [[sum(w * v[j] for w, v in zip(row, V)) for j in range(d_v)] for row in diff_weights]
```

注意:输出权重可能为负。这没有问题——value 缓存仍然可以处理带符号的贡献。后续的 V 投影会吸收符号。

### 第 4 步:噪声抵消测量

构建一个长度为 1024 的合成序列。将信号 token 放在已知位置,其余填充噪声。计算 (a) 标准 softmax 注意力在信号位置上的权重,以及 (b) 差分注意力在信号位置上的权重。分别测量两者的信噪比。DIFF 注意力能可靠地产生更高的信噪比,提升 3 到 10 倍,具体取决于两个分支被训练得有多大差异。

### 第 5 步:V1 与 V2 的参数核算

给定一个配置(hidden=4096, heads=32, d_head=128),打印:

- 基线 Transformer:Q、K、V 各为 `hidden * hidden`,MLP 为 4 * hidden。
- DIFF V1:Q、K 各为 `hidden * hidden`,V 为 `hidden * hidden`(不变),内部头维度减半。新增逐头 `lambda` 参数(O(heads * d_head))。
- DIFF V2:Q 为 `2 * hidden * hidden`,K 为 `hidden * hidden`,V 为 `hidden * hidden`。多出的维度在 O_W 之前被投影回去。新增相同的 `lambda` 参数。

玩具实现会测量 V2 的额外参数成本(每个注意力块约 `hidden * hidden`)并打印出来。

## 使用它

截至 2026 年 4 月,DIFF V2 尚未在每个生产推理服务器中上线,但 vLLM 和 SGLang 中的集成工作正在进行。与此同时,该模式已出现在:

- 微软内部的长上下文生产模型中。
- 多个针对 256k 以上上下文的开源模型训练运行的复现研究中。
- 在交替层上将 DIFF 注意力与滑动窗口注意力结合的混合架构中。

在 2026 年,你会在以下情况使用它:

- 从头开始训练一个以 64k 以上有效上下文为目标的新模型。从一开始就加入差分注意力;事后重新训练的成本很高。
- 微调一个长上下文模型,而 lost-in-the-middle 失败在你的评估中占主导。在 Q 投影上加一个 LoRA 可以近似 DIFF 结构。

在以下情况不要使用:

- 你正在服务一个长上下文性能稳定的预训练稠密模型。重新训练的成本很少能在现有权重上收回。
- 你的上下文始终低于 16k。噪声底可以忽略不计。

## 交付它

本课程产出 `outputs/skill-diff-attention-integrator.md`。给定模型架构、目标上下文长度、幻觉特征和训练预算,它会产出一份集成计划,用于将差分注意力加入新的预训练运行或 LoRA 微调中。

## 练习

1. 运行 `code/main.py`。验证差分注意力在合成查询上报告的信噪比高于标准 softmax 注意力。改变噪声幅度,并展示标准注意力变得不可用的交叉点。

2. 对于一个 7B 级模型(hidden=4096, heads=32, d_head=128, 32 层),计算从基线到 DIFF V1 以及从基线到 DIFF V2 的参数量差。展示哪些组件增加了参数,哪些保持不变。

3. 阅读 DIFF V1 论文(arXiv:2410.05258)的第 3 节和 DIFF V2 Hugging Face 博客的第 2 节。用两句话解释为什么 V1 的逐头 RMSNorm 是必要的,以及为什么 V2 可以移除它而不导致训练发散。

4. 实现一个消融实验:使用 `lambda = 0`(纯第一个 softmax)和 `lambda = 1`(完全相减)计算差分注意力。在合成查询上,测量信噪比如何随扫描变化。找出使信噪比最大化的 `lambda`。

5. 将玩具实现扩展为 GQA + DIFF V2。选择 8 个 KV 头和 32 个 Q 头。证明 KV 缓存大小与具有相同 (8, 32) 配置的基线 GQA 模型一致。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 差分注意力 | “两个 softmax 相互相减” | 将 Q、K 各分为两半,计算两个 softmax 图,从第一个中减去第二个(按 lambda 缩放),然后乘以 V |
| 噪声底 | “softmax 的非零尾部” | softmax 分配给每个无关 token 的 O(1/N) 权重,在长上下文中总计为 O(1) |
| lambda | “相减的缩放系数” | 逐头可学习标量,参数化为 `exp(lq1.lk1) - exp(lq2.lk2) + lambda_init`;可以为负 |
| DIFF V1 | “ICLR 2025 版本” | 原始 Differential Transformer;将头维度减半以保持参数量,需要自定义 kernel,解码更慢 |
| DIFF V2 | “2026 年 1 月的修复” | 保持 KV 头不变,将 Q 头翻倍;解码速度与基线持平,并兼容 FlashAttention |
| 逐头 RMSNorm | “V1 的稳定器” | V1 在差值之后应用的额外归一化;V2 移除它以避免训练后期不稳定 |
| 信噪比 | “有多少注意力被浪费了” | 真实信号位置上的权重与无关位置上的平均权重之比 |
| Lost in the middle | “长上下文失败模式” | 一种经验现象:对位于长上下文中部的文档,检索精度会下降——DIFF 注意力能减少这种情况 |
| 算术强度 | “每加载一个字节的 FLOPs” | V2 通过在每次 KV 加载时处理双倍查询,在解码时提升了该比率;对受内存限制的解码非常重要 |

## 延伸阅读

- [Ye et al. — Differential Transformer (arXiv:2410.05258, ICLR 2025)](https://arxiv.org/abs/2410.05258) — 原始论文,包含噪声抵消理论与长上下文消融实验
- [Microsoft unilm — Differential Transformer V2 (Hugging Face 博客,2026 年 1 月)](https://huggingface.co/blog/microsoft/diff-attn-v2) — 面向生产栈的重写,解码速度与基线持平,兼容 FlashAttention
- [Understanding Differential Transformer Unchains Pretrained Self-Attentions (arXiv:2505.16333)](https://arxiv.org/abs/2505.16333) — 关于相减为何能恢复预训练注意力结构的理论分析
- [Shared DIFF Transformer (arXiv:2501.17900)](https://arxiv.org/html/2501.17900) — 参数共享变体
- [Vaswani et al. — Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762) — DIFF 所要减去对象的基线 Transformer
- [Liu et al. — Lost in the Middle (arXiv:2307.03172)](https://arxiv.org/abs/2307.03172) — DIFF 注意力所针对的长上下文基准