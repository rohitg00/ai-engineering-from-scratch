# Mixture of Experts (MoE)

> 密集的70 B Transformer激活每个令牌的每个参数。671 B MoE每个令牌仅激活37 B，并且在每个基准测试中都超过了它。稀疏性是十年来最重要的扩展理念。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 7 · 05期（全Transformer）、7 · 07期（GPT）
** 时间：** ~45分钟

## The Problem

推理时密集Transformer的FLOP等于其参数计数（前向传递时乘以2）。扩展密集模型，每个代币都能支付全额费用。到2024年，前沿已经撞上了计算墙：为了变得有意义的更智能，每个代币需要指数级增加的FLOP。

专家混合打破了这个联系。将每个FFN替换为“E”独立专家+为每个令牌挑选“k”专家的路由器。总参数=' E x FFN_size '。每个令牌的活动参数=' k x FFN_size '。典型的2026年配置：`E=256`，`k=8`。存储用`E`缩放，计算用`k`缩放。

2026年的前沿几乎完全是教育部：DeepSeek-V3（总671 B/活跃37 B）、Mixtral 8 x 22 B、Qwen 2.5-MoE、Llama 4、Kimi K2、gtt-oss。在Armed Analyses的独立排行榜上，排名前10的开源模型均为MoE。

## The Concept

![MoE layer: router selects k of E experts per token](../assets/moe.svg)

### The FFN swap

密集Transformer块：

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

MoE块：

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # pick k of E per token
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

每位专家都是独立的FFN（通常是SwiGLU）。路由器是单个线性层。每个代币都选择自己的“k”专家，并获得他们输出的门控混合。

### The load-balancing problem

如果路由器将90%的令牌通过专家3，那么其他专家就会挨饿。已尝试了三个修复方法：

1. ** 辅助负载平衡损耗 **（开关Transformer、混合）。添加与专家使用差异成比例的罚款。有效，但添加了超参数和第二个梯度信号。
2. ** 专家容量+代币丢弃 **（早期Switch）。每个专家最多处理“C x N/E”令牌;溢出令牌跳过该层。损害质量。
3. ** 辅助无损失平衡 **（DeepSeek-V3）。添加一个习得的每个专家偏见，可以改变路由器的前k选择。偏差在训练损失之外更新。主要目标没有处罚。2024年的大解锁。

DeepSeek-V3的方法：在每个训练步骤之后，对于每位专家，检查其使用情况是否高于或低于目标。通过“±γ”推动偏差。选择使用“分数+偏见”。用于门控的专家概率是未改变的原始“分数”。将路由与表达脱钩。

### Shared experts

DeepSeek-V2/V3还将专家分为 * 共享 * 和 * 路由 *。每个代币都会经过所有共享专家。通过top-k选择路由专家。共享的专家获取共同知识;路由的专家专注于此。V3运行1名共享专家加上256名路由中的前8名。

### Fine-grained experts

经典MoE（GShard，Switch）：每个专家都与一个完整的FFN一样宽。`E`小（8-64），`k`小（1-2）。

现代细粒度MoE（DeepSeek-V3、Qwen-MoE）：每个专家都更窄（1/8 FFN大小）。“E”较大（256+），“k”较大（8+）。总参数相同，但组合扩展得更快。' C（256，8）=每个代币400万亿'可能的“专家”。质量提高，延迟保持平稳。

### The cost profile

每个代币、每个层：

| Config | 活动参数/令牌 | 总参数 |
|--------|-----------------------|--------------|
| Mixtral 8 x 22 B | ~ 39 B | 141B |
| Lama 3 70 B（密集） | 70B | 70B |
| DeepSeek-V3 | 37B | 671B |
| Kimi K2（MoE） | ~ 32 B | 1T |

DeepSeek-V3在几乎所有基准测试上都击败了Llama 3 70 B（密集），同时 ** 每个代币的活动FLOP更少 **。更多参数=更多知识。更活跃的FLOP =每个令牌的计算量更多。MoE让他们失望。

### The catch: memory

无论哪一个专家开火，所有专家都生活在图形处理器上。671 B型号需要约1.3 TB的VRAM来满足fp 16权重。Frontier MoE部署需要专家并行性-跨图形处理专家，跨网络路由令牌。延迟由所有对所有的通信而不是matmul主导。

## Build It

请参阅' code/main.py '。纯stdlib中的紧凑MoE层，具有：

- ' n_experts=8 ' SwiGLU式专家（每人一位线性专家，以供说明）
- top-k=2路由
- 软最大标准化门控权
- 通过每个专家的偏见进行无损失平衡

### Step 1: the router

```python
def route(hidden, W_router, top_k, bias):
    scores = [sum(h * w for h, w in zip(hidden, W_router[e])) for e in range(len(W_router))]
    biased = [s + b for s, b in zip(scores, bias)]
    top_idx = sorted(range(len(biased)), key=lambda i: -biased[i])[:top_k]
    # softmax over ORIGINAL scores of the chosen experts
    chosen = [scores[i] for i in top_idx]
    m = max(chosen)
    exps = [math.exp(c - m) for c in chosen]
    s = sum(exps)
    gates = [e / s for e in exps]
    return top_idx, gates
```

偏差会影响选择，而不是门重。也就是说，DeepSeek-V3技巧偏差可以在不引导模型预测的情况下纠正负载不平衡。

### Step 2: run 100 tokens through the router

跟踪哪些专家解雇的频率。如果没有偏见，使用就会倾斜。通过偏差更新循环（“-γ”代表过度使用的专家，“+γ”代表未充分使用的专家），使用情况在几次迭代后收敛到均匀分布。

### Step 3: param count comparison

打印MoE配置的“密集等效物”。DeepSeek-V3形状：256路由+1共享，8活动，d_型号=7168。总参数计数令人瞠目结舌。活跃数量是密集大羊驼3 70 B的七分之一。

## Use It

HuggingFace加载：

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

2026 生产推断：vLLM原生支持MoE路由。SGLang拥有最快的专家并行路径。两者都自动处理top-k选择和专家并行。

** 何时选择MoE：**
- 您希望每个令牌的推断成本较低，具有前沿质量。
- 您拥有VRAM /专家并行基础设施。
- 您的工作负载繁重（聊天、代码），而不是上下文繁重（长文档）。

** 何时不选择MoE：**
- 边缘部署-您可以为任何活动FLOP支付全部存储费用。
- 延迟关键型单用户服务专家路由增加了系统的负担。
- 小型模型（<7 B）- MoE的质量优势仅出现在计算阈值以上（~ 6 B活跃参数）。

## Ship It

请参阅“输出/skill-moe-configurator.md”。该技能在给定参数预算、训练令牌和部署目标的情况下为新MoE选择E、k和共享专家布局。

## Exercises

1. ** 简单。**运行'代码/main.py '。观看无辅助损失偏见更新如何平衡专家超过50次迭代的使用。
2. ** 中等。**将学习到的路由器替换为基于哈希的路由器（确定性，无学习）。比较质量和平衡。为什么学习的路由器更好？
3. ** 很难。**实现GRPO风格的“滚动匹配路由”（DeepSeek-V3.2技巧）：专家在推理期间触发的日志，在梯度计算期间强制执行相同的路由。衡量对玩具政策梯度设置的影响。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 专家 | “众多FFN中的一个” | 独立的前馈网络;专用于FFN计算的稀疏切片的参数。 |
| 路由器 | “大门” | 一个微小的线性层，针对每个专家对每个代币进行评分;前k选择。 |
| Top-k路由 | “每个代币k名活跃专家” | 每个代币的FFN计算恰好经过k个专家，按门加权。 |
| 辅助损失 | “负荷平衡罚款” | 额外的损失条款惩罚专家的使用。 |
| 辅助性无损失 | “DeepSeek-V3的技巧” | 仅通过对路由器选择的每位专家偏见来平衡;没有额外的梯度。 |
| 共享专家 | “永远在” | 每个代币都经过的额外专家;捕获常识。 |
| 专家并行 | “专家碎片” | 将不同的专家分配到不同的图形处理器;通过网络路由令牌。 |
| 稀疏性 | “活动参数<总参数” | 比例' k x expert_size /（E x expert_size）'; 37/671 '对于DeepSeek-V3，为5.5%。 |

## Further Reading

- [Shazeer等人（2017）。大得惊人的神经网络：稀疏门控混合专家层]（https：//arxiv.org/ab/1701.06538）-想法。
- [Fedus、Zoph、Shazeer（2022）。开关Transformer：具有简单有效的稀疏性扩展到三重参数模型]（https：//arxiv.org/ab/2101.03961）- Switch，经典的MoE。
- [Jiang等人（2024）。Mixtral of Experts]（https：//arxiv.org/ab/2401.04088）- Mixtral 8 x 7 B。
- [DeepSeek-AI（2024）。DeepSeek-V3技术报告]（https：//arxiv.org/abs/2412.19437）- MLA +无泄漏MoE + MTP。
- [Wang等人（2024）。混合专家的无损失负载平衡策略]（https：//arxiv.org/abs/2408.15664）-基于偏差的平衡论文。
- [Dai等人（2024）。DeepSeekMoE：迈向专家混合语言模型的终极专家专业化]（https：//arxiv.org/ab/2401.06066）-本课程路由器使用的细粒度+共享专家拆分。
- [Kim等人（2022）。DeepSpeed-MoE：推进专家混合推理和培训]（https：//arxiv.org/ab/2201.05596）-原始共享专家论文。
