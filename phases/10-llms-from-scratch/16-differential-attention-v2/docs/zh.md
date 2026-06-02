# 差分注意力（Differential Attention V2）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Softmax attention（注意力）会在每一个不匹配的 token 上撒下一点点概率。把 100k 个 token 累加起来，这股噪声足以淹没信号。Differential Transformer（Ye et al., ICLR 2025）的解法是把 attention 算成两个 softmax 之差，把共享的噪声底噪减掉。DIFF V2（Microsoft，2026 年 1 月）则是它的生产栈重写版：decode 延迟（latency）追平基线 Transformer，无需自定义 kernel，FlashAttention 兼容。本课从 V1 到 V2 端到端讲一遍，并给出一个用 stdlib Python 就能跑通的差分操作 toy 实现。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 7 · 02 (self-attention), Phase 7 · 15 (attention variants), Phase 10 · 14 (architecture walkthrough)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 精确说明为什么 softmax attention 存在噪声底噪，以及为什么它会随 context 长度增长。
- 推导差分 attention 的公式，并解释这一减法为何能消掉两支共享的噪声分量、同时保留信号。
- 走一遍 V1 到 V2 的 diff：什么变快了、什么变简单了、什么变稳定了，以及为什么每一处改动对生产级预训练（pretraining）都是必须的。
- 用纯 Python 从零实现差分 attention，并在一个合成的「信号 + 噪声」query 上经验性地验证噪声消除的特性。

## 问题（The Problem）

标准 softmax attention 有一条数学性质，规模一上来就成了运维噩梦。对于 query `q`，attention 权重是 `softmax(qK^T / sqrt(d))`。Softmax 永远不会输出严格的 0——每一个不匹配的 token 都会拿到一点正质量。这股残余质量就是噪声，并且它会随 context 长度放大。在 128k token 时，哪怕每个不匹配的 token 只拿到 0.001% 的概率，127,999 个加在一起也贡献了大约 12% 的总和。模型必须学会绕开一条会随 context 增长的噪声底噪。

经验上，这表现为 attention head 之间的相互干扰：长 context RAG 里出现凭空捏造的引用、100k token 检索任务里的 lost-in-the-middle 失败、以及 32k 之后 needle-in-haystack 基准上的细微准确率下降。Differential Transformer 论文（arXiv:2410.05258, ICLR 2025）量化了这条 gap：DIFF Transformer 在同等参数规模下，相比基线模型有更低 perplexity、更高长 context 准确率、更少 hallucination（幻觉）。

DIFF V1 有三个问题，把它挡在了前沿预训练流水线之外。它的 value cache 每个 decode step 要被加载两次；它需要自定义 CUDA kernel，破坏了 FlashAttention 兼容性；它的 per-head RMSNorm 在 70B+ 规模下会让长跑训练失稳。DIFF V2（Microsoft unilm 博客，2026 年 1 月 20 日）把这三个都修了。本课会把两个版本都走一遍，搭出差分算子，并在一个 toy query 上做噪声消除的基准（benchmark）。

## 概念（The Concept）

### Softmax 的噪声底噪（The noise floor of softmax）

对于 query `q` 和 keys `K = [k_1, ..., k_N]`，attention 权重是：

```
w_i = exp(q . k_i / sqrt(d)) / sum_j exp(q . k_j / sqrt(d))
```

任何一个 `w_i` 都不会是 0。如果 `k_i` 跟 `q` 完全不相关，分数 `q . k_i` 也不会是 0——它会在 0 附近以方差 `||q||^2 / d` 波动。经过 softmax 归一化后，每个不相关的 token 仍会向加权和贡献 `O(1/N)`。所有不相关 token 加起来贡献 `O((N-1)/N) = O(1)`——这可不是个小量。

模型真正想要的是类似硬 top-k 的东西：只在匹配 token 上放高权重，其他地方接近 0。Softmax 太平滑了，做不到这一点。

### 差分思想（The differential idea）

把每个 head 的 Q、K 投影各劈成两份：Q = (Q_1, Q_2)，K = (K_1, K_2)。计算两张 attention 图：

```
A_1 = softmax(Q_1 K_1^T / sqrt(d))
A_2 = softmax(Q_2 K_2^T / sqrt(d))
```

输出：

```
DiffAttn = (A_1 - lambda * A_2) V
```

这一减法会把两张图共享的噪声分布消掉。如果两张图在 127k 个不相关 token 上的权重都大致是均匀的（在随机初始化时确实如此），它们就会相互抵消。而信号——集中在少数真正相关 token 上的尖峰权重——只有在两张图里以相同幅度出现时才会被消掉，模型一旦训练起来就不会出现这种情况。

`lambda` 是每个 head 一个的可学习标量，参数化为 `lambda = exp(lambda_q1 dot lambda_k1) - exp(lambda_q2 dot lambda_k2) + lambda_init`。它可以为负。`lambda_init` 默认是一个小正数，比如 0.8。

### 为什么这等同于差分降噪（Why this matches headed noise-canceling）

想象两个有噪声的麦克风录同一个声音。两边都会拾到说话人加上相关联的背景噪声。一边减去另一边，共享噪声就掉了。人声之所以能保留，是因为两路信号在相位或幅度上差得足够多，不会被完全抵消。每个 head 的 `lambda` 学到的就是这种平衡。

### V1 vs V2：diff（V1 vs V2: the diff）

V1 把参数量保持得跟基线 Transformer 一致。为了让每个 head 有两个 query，它把 head 维度砍半。这既牺牲了 head 的表达能力，更痛苦的是——也把每 head 的 value cache 砍半了。Decode 时 value cache 每步要被加载两次（每个 softmax 分支一次）。结果就是：参数量虽然对齐了基线，decode 反而更慢。

V2 把 query head 数翻倍，KV head 数保持不变（参数从 up-projection 那里挪过来）。Head 维度跟基线一样。做完减法后，多出来的维度被投回去以匹配基线 Transformer 的 O_W 投影。三件事同时发生：

1. Decode 速度追平基线（KV cache 只加载一次）。
2. FlashAttention 不改一行就能跑（不需要自定义 kernel）。
3. Decode 时的算术强度（arithmetic intensity）变高（每从 HBM 加载一字节就有更多算力）。

V2 还移除了 V1 里用来稳定减法的 per-head RMSNorm。在 70B 级预训练规模下，那个 RMSNorm 会让训练后期失稳。V2 把它换成一套更简单的初始化方案，无需额外模块就能保证训练稳定。

### 什么时候该用它（When to reach for it）

| 场景 | 收益 |
|----------|---------|
| 长 context RAG（64k+） | attention 图更干净、凭空捏造的引用更少 |
| Needle-in-haystack 基准 | 32k 之后准确率显著提升 |
| 多文档 QA | 跨文档干扰更小 |
| 8k 长度的代码补全 | 边际收益，不值得改架构 |
| 短对话（< 4k） | 与基线基本无差别 |

收益随 context 长度增长。4k token 时噪声底噪小到可以忽略，标准 attention 就够用。128k 时它就在拖你后腿了。

### 它跟 2026 年其他旋钮怎么叠（How it stacks with other 2026 knobs）

| 特性 | 是否与 DIFF V2 兼容？ |
|---------|------------------------|
| GQA | 兼容（V2 增加 Q head，不动 KV head） |
| MLA（DeepSeek） | 原则上兼容，目前没有把两者结合的公开论文 |
| MoE | 兼容（attention 与 MLP 块独立） |
| RoPE | 兼容（不变动） |
| YaRN / 长 context 扩展 | 兼容（DIFF 帮助最大的正是这种场景） |
| FlashAttention | V2 兼容（V1 不兼容） |
| 推测解码（Speculative decoding） | 兼容（attention 改动对 spec-decode 循环不可见） |

## 动手实现（Build It）

`code/main.py` 用纯 Python 实现差分 attention。一个带已知「信号 + 噪声」结构的 toy query 让你能直接量到噪声消除比。

### Step 1：标准 softmax attention（standard softmax attention）

stdlib 矩阵运算：列表套列表、手写 matmul、softmax 用「减最大值」做数值稳定。

```python
def softmax(row):
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]
```

### Step 2：把 Q、K 劈成两半（split Q, K into two halves）

V1 风格：把 head 维度砍半。V2 风格：保留 head 维度，把 head 数翻倍。Toy 实现用 V1 是为了讲解清晰——数学完全一样，只是记账方式不同。

### Step 3：两支 softmax + 减法（two softmax branches + subtraction）

```python
A1 = [softmax([dot(q1, k) / scale for k in K1]) for q1 in Q1]
A2 = [softmax([dot(q2, k) / scale for k in K2]) for q2 in Q2]
diff_weights = [[a1 - lam * a2 for a1, a2 in zip(r1, r2)] for r1, r2 in zip(A1, A2)]
out = [[sum(w * v[j] for w, v in zip(row, V)) for j in range(d_v)] for row in diff_weights]
```

注意：输出权重可以是负的。这没问题——value cache 仍然能处理带符号的贡献，后续的 V 投影会吸收符号。

### Step 4：噪声消除测量（noise cancellation measurement）

构造一条长度为 1024 的合成序列。把信号 token 放到一个已知位置，其余位置填噪声。计算 (a) 标准 softmax attention 在信号位置上的权重和 (b) 差分 attention 的权重。分别量化两者的信噪比。DIFF attention 通常能稳定拿到 3x–10x 更高的信噪比，具体倍数取决于两支分支被训练得有多不同。

### Step 5：V1 vs V2 参数账（V1 vs V2 parameter accounting）

给定一个配置（hidden=4096, heads=32, d_head=128），打印：

- 基线 Transformer：Q、K、V 各为 `hidden * hidden`，MLP 为 `4 * hidden`。
- DIFF V1：Q、K 各为 `hidden * hidden`，V 为 `hidden * hidden`（不变），head 维度内部砍半。新增 per-head `lambda` 参数（`O(heads * d_head)`）。
- DIFF V2：Q 为 `2 * hidden * hidden`，K 为 `hidden * hidden`，V 为 `hidden * hidden`。多出的维度在 O_W 之前投回。新增同样的 `lambda` 参数。

Toy 会量化 V2 的额外参数开销（每个 attention 块大约多一份 `hidden * hidden`）并打印出来。

## 用起来（Use It）

截至 2026 年 4 月，DIFF V2 还没在每一个生产级推理服务里上线，但 vLLM 和 SGLang 的集成正在进行。与此同时，这个模式已经出现在：

- Microsoft 内部的长 context 生产模型。
- 多个目标 256k+ context 的开放模型训练复现。
- 把 DIFF attention 与滑动窗口 attention 在层间交替的混合架构。

2026 年你什么时候会拿出它：

- 从零训练一个目标 64k+ 有效 context 的新模型。一开始就加上差分 attention；事后重训成本很高。
- 微调（fine-tune）一个长 context 模型，且你的评估里 lost-in-the-middle 失败占主导。在 Q 投影上加 LoRA 可以近似 DIFF 结构。

什么时候不会：

- 你正在服务一个长 context 性能稳定的预训练 dense 模型。重训成本基本不会在已有权重上回本。
- 你的 context 永远小于 16k。噪声底噪可以忽略不计。

## 上线部署（Ship It）

本课产出 `outputs/skill-diff-attention-integrator.md`。给定一个模型架构、目标 context 长度、hallucination 画像和训练预算，它会产出一份把差分 attention 加进新预训练任务或 LoRA 微调的集成方案。

## 练习（Exercises）

1. 跑 `code/main.py`。在合成 query 上验证差分 attention 报出的信噪比高于标准 softmax attention。改变噪声幅度，找出标准 attention 开始不可用的临界点。

2. 对一个 7B 级模型（hidden=4096, heads=32, d_head=128, 32 层）计算从基线到 DIFF V1、从基线到 DIFF V2 的参数量增量。指出哪些组件多了参数、哪些保持不变。

3. 读 DIFF V1 论文（arXiv:2410.05258）第 3 节和 DIFF V2 Hugging Face 博客的第 2 节。用两句话说明：为什么 V1 的 per-head RMSNorm 是必要的，以及为什么 V2 拿掉它也不会引发训练发散。

4. 实现一次消融实验（ablation）：分别用 `lambda = 0`（纯第一支 softmax）和 `lambda = 1`（完全减法）计算差分 attention。在合成 query 上扫一遍，量化信噪比的变化，找出令信噪比最大的 `lambda`。

5. 把 toy 扩展成 GQA + DIFF V2。挑 8 个 KV head 和 32 个 Q head。证明 KV cache 大小与同样 (8, 32) 配置的基线 GQA 模型一致。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际是什么 |
|------|----------------|------------------------|
| Differential attention | 「两个 softmax 相减」 | 把 Q、K 劈成两半，算两张 softmax 图，把第二张（按 lambda 缩放）从第一张里减掉，再乘 V |
| Noise floor（噪声底噪） | 「softmax 那条非零的尾巴」 | softmax 在每个不相关 token 上施加的 `O(1/N)` 权重，长 context 下加起来是 `O(1)` |
| lambda | 「减法的尺度」 | 每 head 一个的可学习标量，参数化为 `exp(lq1.lk1) - exp(lq2.lk2) + lambda_init`；可以为负 |
| DIFF V1 | 「ICLR 2025 那版」 | 原始 Differential Transformer；为保持参数量把 head 维度砍半，需要自定义 kernel，decode 更慢 |
| DIFF V2 | 「2026 年 1 月那版修复」 | 翻倍 Q head，KV head 不变；decode 速度追平基线，且能用 FlashAttention |
| Per-head RMSNorm | 「V1 的稳定器」 | V1 在差分之后加的额外 norm；V2 把它移除以避免训练后期失稳 |
| 信噪比（Signal-to-noise ratio） | 「多少 attention 是浪费的」 | 真正信号位置的权重 与 不相关位置平均权重 之比 |
| Lost in the middle | 「长 context 失败模式」 | 经验现象：长 context 中段文档的检索准确率下降——DIFF attention 能减轻这一现象 |
| 算术强度（Arithmetic intensity） | 「每加载一字节做多少 FLOPs」 | V2 在 decode 时通过让每次 KV 加载承担更多 query 把这个比值抬起来；对内存受限的 decode 很关键 |

## 延伸阅读（Further Reading）

- [Ye et al. — Differential Transformer (arXiv:2410.05258, ICLR 2025)](https://arxiv.org/abs/2410.05258) — 原始论文，含噪声消除理论与长 context 消融
- [Microsoft unilm — Differential Transformer V2 (Hugging Face blog, January 2026)](https://huggingface.co/blog/microsoft/diff-attn-v2) — 生产栈重写版，decode 追平基线，FlashAttention 兼容
- [Understanding Differential Transformer Unchains Pretrained Self-Attentions (arXiv:2505.16333)](https://arxiv.org/abs/2505.16333) — 关于「为什么减法能恢复预训练 attention 结构」的理论分析
- [Shared DIFF Transformer (arXiv:2501.17900)](https://arxiv.org/html/2501.17900) — 参数共享变体
- [Vaswani et al. — Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762) — DIFF 减去的那个基线 Transformer
- [Liu et al. — Lost in the Middle (arXiv:2307.03172)](https://arxiv.org/abs/2307.03172) — DIFF attention 瞄准的长 context 基准
