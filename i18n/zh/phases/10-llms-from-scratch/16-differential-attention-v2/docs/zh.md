# 差异性注意力 (V2)

> 软max注意力在每一个不匹配的代币上分散了少量的概率. 超过100万个代币,这些噪音加起来,淹没了信号. 差异变压器 (Ye et al., ICLR 2025) 通过计算注意力为两个软max的差异来解决这一问题,减去共享噪音地面. DIFF V2 (微软,2026年1月) 是生产堆重写:与基线变压器相匹配的解码延迟,没有自定义内核,兼容FlashAttention. 这一课程是V1到V2端到端,用一个工作玩具实现的区别操作你可以运行在Stdlib Python.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 7 · 02 (self-attention), Phase 7 · 15 (attention variants), Phase 10 · 14 (architecture walkthrough)
**Time:** ~60 minutes

## 学习目标

- 具体说明为什么软max注意力具有噪音地面,以及为什么随着环境长度而增长.
- 推导差异注意力公式,并解释为什么减去在保持信号时取消共享噪音组件.
- 走向V1到V2的差异:什么变得更快,什么变得更简单,什么变得更稳定,以及为什么每个变化是生产预训练所必需的.
- 在纯Python中从零开始实现差异注意力,并对合成信号加噪声查询进行噪音取消特性经验验证.

## 问题

标准软max注意力具有数学特性,它会变成规模上的操作头痛.`q`关注重量是`softmax(qK^T / sqrt(d))`软max 永远无法产生精确的零:每一个不匹配的代币都获得了一些正质量.那个残余质量是噪音,它随着背景长度而扩展.在128k代币时,即使每个不匹配的代币只有0.0001%的可能性,其中127,999代币总共贡献了总量的13%.模型必须学习绕着环境增长的噪音地面路线.

经验上,这表现为注意力头部干扰:长文本RAG中的幻觉引用,在100k标记检索任务中失败中失败,在32k以上的针基准上微妙的精度降低. 差异变压器论文 (arXiv:2410.05258,ICLR 2025) 测量了差距:DIFF变压器的困惑程度较低,长文本精度更高,幻觉比相同尺寸的基线更少.

由于DIFF V1存在三个问题, 它的值缓存必须每次解码步骤加载两次,它需要自定义的CUDA内核,它破坏了FlashAttention兼容性,并且其每头RMSNorm在70B以上规模上破坏了长期训练的稳定性. 微软的云科技博客 (DIFF V2), 这一课程将两个版本都运行,构建区别运算符,并在玩具查询中进行噪音取消.

## 概念

### 软max的噪音地板

为了查询`q`关键`K = [k_1, ..., k_N]`注意力重量为:

```math
w_i = \frac{\exp(q \cdot k_i / \sqrt{d})}{\sum_j \exp(q \cdot k_j / \sqrt{d})}
```

没有.`w_i`如果`k_i`完全无关`q`总结`q . k_i`不是0 它随着变异而波动在零左右`||q||^2 / d`软max正常化后,每一个不相关的代币仍然贡献.`O(1/N)`无关代币的总贡献为`O((N-1)/N) = O(1)`不是小量.

模型想要的是硬顶k:匹配的代币的重量很高,其他地方的重量几乎是零.

### 差异性概念

分开两个头的Q和K投影:$Q = (Q_1, Q_2)$其他$K = (K_1, K_2)$计算两个注意力地图:

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d})
\end{aligned}
```

输出:

```math
\mathop{\mathrm{DiffAttn}} = (A_1 - \lambda \cdot A_2) V
```

减值取消了两个地图共享的任何噪音分布.如果两个地图在127k不相关的代币上重量大约均 (随机初始化后),则这些都会取消.信号在少数实际相关的代币上最大重量只会取消如果它在两个地图上出现相同的 magnitud,这将不会一旦模型列车.

`lambda`标记为:`lambda = exp(lambda_q1 dot lambda_k1) - exp(lambda_q2 dot lambda_k2) + lambda_init`它们可能是负面的.`lambda_init`默认的数字是小的正数,比如0.8.

### 为什么这匹配的头声取消

想象一下两个杂的麦克风录制相同的声音. 两者都接收扬声器加上相关背景噪音. 减去一个和另一个,共享的噪音下降. 声音存活下来,因为两个信号相或幅度相差足以防止完全取消.`lambda`能学到这种平衡.

###  V1 vs V2:差异

V1 保持参数数量与基线变压器等.为了获得每头两个查询,它将头寸减半.这使得头部表达性成本和更痛苦的损失减半了每头的值缓存.解码必须每步两次加载值缓存 (每软max分支一次).结果:除码速度比基线慢,尽管参数数数量相匹配.

V2 翻倍查询头数量,保持KV头数相同 (借鉴从上线投影的参数).头寸与基线保持相同.减去后,额外的维度被投影回下来以匹配基线变压器的 $O_W$现在,我们可以看到一个新的投影.

1. 解码速度与基线匹配 (KV缓存一次加载).
2. FlashAttention运行不变 (没有自定义内核).
3. 在解码时的算术强度增加 (从HBM中加载的每字节的计算量增加).

V2还删除了V1用来稳定减法的每头RMSNorm.在70B类预训练尺度上,RMSNorm破坏了晚训练的稳定性.V2将其取代为更简单的初始化方案,使训练保持稳定,而无需额外模块.

### 什么时候要达到它

| Workload | Benefit |
|----------|---------|
| Long-context RAG (64k+) | Cleaner attention maps, fewer hallucinated citations |
| Needle-in-haystack benchmarks | Substantial accuracy lift past 32k |
| Multi-document QA | Less cross-document interference |
| Code completion at 8k | Marginal, not worth the architecture change |
| Short chat (< 4k) | Essentially indistinguishable from baseline |

随着背景长度的增长,在4k代币时,噪音的地面足够小,以使标准注意力正常.在128k时,它会伤害你.

### 如何与其他2026个子相匹配

| Feature | Compatible with DIFF V2? |
|---------|------------------------|
| GQA | Yes (V2 increases Q heads, not KV heads) |
| MLA (DeepSeek) | Yes in principle, no published paper combining them |
| MoE | Yes (attention is independent of MLP block) |
| RoPE | Yes (unchanged) |
| YaRN / long-context scaling | Yes (exactly where DIFF helps most) |
| FlashAttention | Yes in V2 (was no in V1) |
| Speculative decoding | Yes (attention change is invisible to the spec-decode loop) |

```figure
differential-attention
```

## 建立它

`code/main.py`玩具查询,具有已知信号加噪结构,可以直接测量噪音取消比率.

### 步骤1:标准软max注意力

分数矩阵操作:列表列表,手动分,软max,数值稳定减小最大.

```python
def softmax(row):
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]
```

### 步骤2:将Q,K分为两半

玩具实施使用V1为教学清晰度 数学相同,只有会计不同.

### 步骤3:两个软max分支 +减小

```python
A1 = [softmax([dot(q1, k) / scale for k in K1]) for q1 in Q1]
A2 = [softmax([dot(q2, k) / scale for k in K2]) for q2 in Q2]
diff_weights = [[a1 - lam * a2 for a1, a2 in zip(r1, r2)] for r1, r2 in zip(A1, A2)]
out = [[sum(w * v[j] for w, v in zip(row, V)) for j in range(d_v)] for row in diff_weights]
```

注:输出权重可能是负的. 没关系. 值缓存仍然处理签署的贡献. 随后的V投影吸收标志.

### 步骤4:噪音取消测量

构建一个长度1024的合成序列. 放信号标志在已知位置, 填充其余的噪音. 计算 (a) 信号位置的标准软max注意力重量和 (b) 差异注意力重量. 测量每个信号与噪音的比例. 根据两支分支的不同程度,DIFF注意力可靠地产生了3x-10x的信号与噪音比率.

### 步骤 5: V1 vs V2参数会计

根据配置 (隐藏=4096,头=32,d_head=128),打印:

- 基线变压器:每个尺寸的Q,K,V `hidden * hidden`隐藏在4*的MLP.
- 标准 V1:每尺寸的Q,K `hidden * hidden` V 尺寸`hidden * hidden`头部的薄度在内面减半.`lambda`参数$(O(\text{heads} \cdot d_{\text{head}}))$现在,我们要去.
- 型号:`2 * hidden * hidden`尺寸K`hidden * hidden` V 尺寸`hidden * hidden`超薄的投影之前$O_W$增加了相同的`lambda`参数

玩具测量了V2的额外参数成本 (大约`hidden * hidden`按一下,每个注意区块的额外数量)

## 用它

截至2026年4月,DIFF V2尚未在每个生产推断服务器中出货,但vLLM和SGLang正在进行集成.

- 微软内部长文本生产模型.
- 针对256k以上的环境的几个开放模型培训中进行了研究复制.
- 混合架构,将DIFF注意力与在替代层上的滑动窗口注意力结合在一起.

在2026年,你将实现这一点:

- 培训一个新的模型从零开始,针对64k+有效的环境.从一开始就增加差异性注意力;后来重新培训是昂贵的.
- 调整一个长文本模型,其中中途失败占据了你的评估.

当你不愿意:

- 您正在使用一个预先训练的密集型号,具有稳定的长文本性能.
- 你的背景总是低于16K. 噪音的地面是微不足道的.

## 运送它

这一课产生了`outputs/skill-diff-attention-integrator.md`鉴于模型架构,目标背景长度,幻觉形象和培训预算,它产生了一个集成计划,以增加对新预训练运行或LoRA细节调节的差异性注意力.

## 运动

1. 跑步`code/main.py`检查对差异注意力报告的信号-噪音比合成查询标准软max注意力高. 变化噪音幅度,显示标准注意力变得无法使用的交叉点.

2. 计算从基线到DIFF V1和从基线到DIFF V2的参数数 delta为7B类模型 (隐藏=4096,头=32,d_head=128,32层).显示哪些组件获得参数,哪些保持相同.

3. 在DIFF V1论文的第3节 (arXiv:2410.05258) 和DIFF V2 Hugging Face博客的第2节中,用两句话解释为什么每头V1是必要的,以及为什么V2可以在不导致训练分歧的情况下删除它.

4. 执行一个减法:计算与 `lambda = 0`(纯的第一软max) 和`lambda = 1`测量信号到噪音在扫描中如何变化. 确定`lambda`通过这种方式,我们可以最大限度地实现信号到噪音.

5. 扩展玩具到GQA+DIFF V2. 选择8个KV头和32个Q头. 显示KV缓存尺寸与相同 (8,32) 配置的基线GQA模型相匹配.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Differential attention | "Two softmaxes minus each other" | Split Q, K into two halves, compute two softmax maps, subtract the second (scaled by $\lambda$) from the first, then multiply by V |
| Noise floor | "The non-zero tail of softmax" | The $O(1/N)$ weight softmax puts on every unrelated token, which sums to $O(1)$ across long contexts |
| lambda | "The subtraction scale" | Per-head learnable scalar parameterized as `exp(lq1.lk1) - exp(lq2.lk2) + lambda_init`; can be negative |
| DIFF V1 | "The ICLR 2025 version" | Original Differential Transformer; halves head dim to preserve parameter count, needs custom kernel, slower decode |
| DIFF V2 | "The January 2026 fix" | Doubles Q heads keeping KV heads; matches baseline decode speed and works with FlashAttention |
| Per-head RMSNorm | "The V1 stabilizer" | Extra norm V1 applied after the difference; V2 removed it to prevent late-training instability |
| Signal-to-noise ratio | "How much attention is wasted" | Ratio of weight on the true signal position to average weight on unrelated positions |
| Lost in the middle | "Long-context failure mode" | Empirical phenomenon where retrieval accuracy dips for documents in the middle of a long context — DIFF attention reduces this |
| Arithmetic intensity | "FLOPs per byte loaded" | Ratio V2 increased at decode by doubling queries per KV load; important for memory-bound decode |

## 进一步阅读

- [Ye et al. — Differential Transformer (arXiv:2410.05258, ICLR 2025)](https://arxiv.org/abs/2410.05258)原始论文,含噪音取消理论和长文本的废除
- [Microsoft unilm — Differential Transformer V2 (Hugging Face blog, January 2026)](https://huggingface.co/blog/microsoft/diff-attn-v2)生产堆重写,匹配的基线解码,兼容FlashAttention
- [Understanding Differential Transformer Unchains Pretrained Self-Attentions (arXiv:2505.16333)](https://arxiv.org/abs/2505.16333)理论分析减法恢复预训练的注意力结构的原因
- [Shared DIFF Transformer (arXiv:2501.17900)](https://arxiv.org/html/2501.17900) 分享参数的变体
- [Vaswani et al. — Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762)基线变压器 DIFF从
- [Liu et al. — Lost in the Middle (arXiv:2307.03172)](https://arxiv.org/abs/2307.03172)长文本基准指标
