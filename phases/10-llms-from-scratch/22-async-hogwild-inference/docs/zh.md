# 异步与 Hogwild! 推理（Async and Hogwild! Inference）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 投机解码（speculative decoding，第 10 阶段 · 15 课）在单条序列内部并行化 token。多 agent 框架在多条完整序列之间并行，但需要显式协调（投票、子任务拆分）。Hogwild! 推理（Rodionov 等，arXiv:2504.06261）走的是另一条路：让同一个 LLM 的 N 个实例并行运行，共享同一份 KV cache。每个 worker 可以即时看到其他所有 worker 生成的 token。现代推理模型——QwQ、DeepSeek-R1——能够通过这份共享 cache 自我协调，无需任何 fine-tune。这套方法尚处实验阶段，但它开辟了一个全新的推理并行轴，与投机解码（spec decode）正交。本课用 stdlib Python 实现一个双 worker 的 Hogwild! 模拟器，并解释为什么共享 cache 协作能从模型已有的推理能力中自然涌现。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** 第 10 阶段 · 12 课（推理优化）、第 10 阶段 · 15 课（投机解码）
**Time:** ~60 分钟

## 学习目标（Learning Objectives）

- 描述三种常见的并行 LLM 拓扑（投票、子任务、Hogwild!），并指出每种各自针对的问题。
- 陈述 Hogwild! 的核心设定：多个 worker、一份共享 KV cache、通过 self-prompting 涌现的协调。
- 给出 Hogwild! 的 wall-time 加速比公式，自变量为 worker 数 `N`、任务级并行度 `p`、协调开销 `c`。
- 在玩具问题上实现一个双 worker 的 Hogwild! 模拟器，观察任务划分是如何涌现的。

## 问题（The Problem）

现代 LLM 通过产出长链推理来求解难题——5000 个 token 的逐步推理是常态，深度数学题甚至会到几万 token。在 70B 模型上以 35 tokens/sec 的解码速度算，5 万 token 就是 24 分钟。这种交互体验谈不上「交互」。

投机解码（第 10 阶段 · 15 课）通过在单条序列内并行化能拿到 3-5 倍加速。再往后，autoregressive 解码的顺序依赖就是硬天花板：每个新 token 都依赖于此前所有 token。

显而易见的问题是：能不能跨序列并行？让同一个模型的多个副本同时跑同一个问题，让它们协作、分工？

先前的工作有：投票集成（voting ensembles，跑 N 个模型，取多数答案）、tree-of-thought（分支推理路径再合并）、多 agent 框架（给每个 agent 分配子任务，再用一个协调者）。它们各自在特定任务领域有用。但它们也都引入了显式的协调机制——投票规则、分支与剪枝逻辑、agent 间消息协议。

Hogwild! 推理走的是另一条路。N 个 worker 共享同一份 KV cache。每个 worker 可以立即看到其他所有 worker 生成的 token，就像那是它自己的上下文。这些 worker——不需要任何训练或 fine-tune——会自己想出怎么分工。现代推理模型（QwQ、DeepSeek-R1、Claude 系列推理模式）能读取共享 cache，然后说出诸如「我看到 worker 2 已经处理了基础情况，那我去做归纳步骤」这样的话。

加速比依赖具体工作负载，截至 2026 年 4 月仍属实验阶段。但这个想法值得了解，因为它打开了推理并行的新一轴。

## 概念（The Concept）

### 设定（The setup）

启动 N 个 worker 进程，每个都跑同一份 LLM。不再为每个 worker 维护各自的 KV cache，而是统一维护一份共享 cache。当 worker `i` 生成 token `t_j` 时，这个 token 会被写入共享 cache 的下一个位置。当 worker `k` 进入下一步时，它读取 cache 当前的状态（其中已经包含全部 N 个 worker 至今生成的所有 token）。

每一步时间，worker 之间会争抢写入 token。没有所谓的「每 worker 位置索引」——cache 就是一条不断生长的序列。顺序由写入到达时间决定。

### 协调为什么会涌现（Why coordination emerges）

worker 共享一份 prompt。通常类似「你是 N 个共同处理这个问题的实例之一。每个实例都能读取共享内存，看到其他实例写了什么。避免重复劳动」。这份 prompt 加上共享 cache 就够了。推理模型读取 cache，注意到问题的哪些部分已经有人尝试过，并（多数情况下，但不是总会）转向尚未探索的部分。

Hogwild! 论文（Rodionov 等，2025）报告了如下观察：

- worker 会先制定计划，并通过 cache 把计划告知其他 worker。
- worker 会注意到其他 worker 推理中的错误，并指出来。
- 当某个计划失败时，worker 会调整并提出替代方案。
- 当被 prompt 提示「检查是否有冗余」时，worker 能检测到冗余并改换方向。

这一切都不需要 fine-tune。这种涌现行为来自模型已经具备的推理能力。

### 命名（The naming）

论文的名字致敬 Hogwild! SGD（Recht 等，2011），那是一种异步更新的优化器（optimizer）。类比关系是：SGD 的异步 worker 都往一个共享参数向量里写；Hogwild! 推理的 worker 都往一份共享 KV cache 里写。两者都依赖经验上的收敛性，而非同步保证。

### RoPE 让这件事变得可行（RoPE makes this tractable）

Rotary Position Embeddings（RoPE，Su 等，2021）通过对 Q 和 K 向量做旋转来编码位置信息。因为位置是旋转而不是写死的偏移量，一个 token 的位置可以发生位移而无需重新计算它的 KV cache 条目。当 worker `i` 把内容写进共享 cache 的位置 `p` 时，其他读取该位置的 worker 可以直接使用这条 cache——不需要重新旋转。

如果换成学习式位置或者绝对位置的模型，Hogwild! 在每次并发写入时都得做 cache 失效。RoPE 让 cache 保持稳定。

### Wall-time 数学（Wall-time math）

设 `T_serial` 为单个 worker 独立解决问题所需时间。设 `p` 为任务级可并行比例。设 `c` 为每步协调开销（读取扩展后的 cache、决定写什么）。

单 worker 时间：`T_serial`。
N 个 worker 的 Hogwild! 时间，假设协调免费：`T_serial * ((1 - p) + p / N)`。经典的 Amdahl 定律。
计入协调开销：`T_serial * ((1 - p) + p / N) + c * steps_per_worker`。

worker 想要带来净收益，`c` 必须相对于每步解码时间足够小。在产出 5k+ token 的推理模型上，worker 即便花上几百 token 的协调开销也仍能净赚。但在短聊任务上，协调成本占主导，Hogwild! 比串行还慢。

### 具体例子（Concrete example）

推理任务：1 万 token 的链式推理（chain-of-thought）。假设问题有 `p = 0.7` 的可并行内容（不同证明策略、不同情况分析），每个 worker 的协调开销 `c = 200` token。当 `N = 4` 时：

- 串行时间：10000 个解码步。
- Hogwild! 时间：10000 * (0.3 + 0.7 / 4) + 200 * 4 = 10000 * 0.475 + 800 = 5550 个解码步。
- 加速比：10000 / 5550 = 1.8x。

不算特别惊艳。但在更长的推理任务上（5 万 token），协调开销被摊薄，加速比能推到 2.5-3x。Hogwild! 是「一种让你能自然写多线程代码的语言里」的线程级并行在推理侧的等价物。

### 何时该用 Hogwild!（When to reach for Hogwild!）

- 长推理任务（数千 token），且任务可以拆成多个独立子目标并行。
- 经过逐步思考训练的推理模型。非推理模型的自我协调能力差。
- 单节点部署，且 VRAM 足以容纳共享 cache 加上 N 个 worker 进程。cache 是共享的，但每个 worker 还有自己的激活内存。

### 何时不该用（When not to）

- 短的交互式聊天。协调开销占主导。
- 不可并行的任务（单条线性证明、单次编译）。N=1 就是上限。
- 非推理模型。不会涌现协调。
- 多节点部署。共享 cache 需要极快的跨 worker 同步。节点内可以；跨节点是延迟灾难。

### 实验状态（The experimental status）

截至 2026 年 4 月，Hogwild! 还是一种研究方法，配套有开源的 PyTorch 实现。它尚未进入生产采用。三个拦路虎：

1. 跨并发进程管理共享 KV cache 是非平凡的工程难题。
2. 协调的涌现依赖任务，benchmark 仍在搭建中。
3. 加速比相对投机解码已经能给出的提升来说算适度，两者可以组合，但组合工程又是另一层。

值得了解。值得做实验。还不到押产品的时候。

## 动手实现（Build It）

`code/main.py` 实现了一个玩具版 Hogwild! 模拟器：

- 两个 worker 进程，每个都是一个确定性「LLM」，会按已知概率产出几类 token 中的一种（work-token、observe-token、coordinate-token）。
- 一份共享 cache（其实就是一个 token 列表），两个 worker 都会读写。
- 一个简单的协调逻辑：当某个 worker 看到另一个已经在某类别下产出了足够多的 work-token 时，它会改换类别。

模拟器跑固定步数预算，并报告：

- 总共产出的 work-token 数。
- 总 wall-time（worker 步数）。
- 相对于单 worker 的有效加速比。
- 一份 trace，记录每个 token 是哪个 worker 写的。

### 步骤 1：共享 cache（Step 1: the shared cache）

一个两个 worker 都往里追加的列表。在真实实现里要做简单加锁（Python `threading.Lock`）；这里用一个计数器来模拟。

### 步骤 2：worker 主循环（Step 2: the worker loop）

每个 worker 在每一步：

- 读取当前共享 cache。
- 根据已有内容决定要写什么类别的 token。
- 写入一个 token。

### 步骤 3：协调启发式（Step 3: the coordination heuristic）

如果类别 X 在 cache 中已经有 K 个 token，而当前 worker 本来想写的也是 X，那么它改写类别 Y。这是对推理模型那种「注意到这块已经被覆盖了，那我做点别的」行为的玩具替身。

### 步骤 4：实测加速比（Step 4: measured speedup）

在 N=1 与 N=2 两种配置下、用同样的总步数预算跑模拟器。统计产出的 work-token 数。N=2 应该比 N=1 多产出大约 1.5-1.8 倍的 work-token，因为有协调驱动的任务划分。

### 步骤 5：压力测试协调（Step 5: stress the coordination）

降低协调启发式的灵敏度。再跑一次。观察到没有好的协调时，N=2 会冗余地产出相同 token，加速比掉到 1 以下。这与论文的观察一致：这套招法只有在 worker 具备足够推理能力来自我协调时才奏效。

## 用起来（Use It）

截至 2026 年 4 月，把 Hogwild! 集成进生产仍属研究级。来自 Yandex/HSE/IST 的参考实现基于 PyTorch，目标是单节点多进程，模型为 DeepSeek-R1 与 QwQ。

务实的采用路径：

1. 给你的推理任务工作负载做 profile。测量其中探索性 token（多策略、案例分析、搜索）相对于线性 token 的比例。
2. 如果探索占主导，跑一次双 worker Hogwild! 实验。测 wall-time 改进。
3. 如果改进不足 1.3x，你处在「协调开销占主导」的区间，回退到单 worker。
4. 如果改进超过 1.5x，加到 N=4 再测一次。收益递减一般在 N=4-8 附近出现。

与投机解码组合：每个 Hogwild! worker 内部可独立使用 spec decode。两种加速比（粗略地）相乘，把 3x 的 spec decode 与 1.8x 的 Hogwild! 叠到相对朴素单 worker 解码的有效 5.4x。

## 上线部署（Ship It）

本课产出 `outputs/skill-parallel-inference-router.md`。给定一个推理工作负载画像（token 预算、任务并行度画像、模型家族、部署目标），它会在投票、tree-of-thought、多 agent、Hogwild! 与投机解码之间做路由。

## 练习（Exercises）

1. 用默认设置跑 `code/main.py`。确认在相同 wall-time 下，N=2 的 Hogwild! 配置产出的 work-token 比 N=1 baseline 多。

2. 降低协调启发式的强度（设 `coordination_weight=0.1`）。再跑一次。展示加速比崩塌。解释原因：当 worker 无法协调时，它们会重复劳动。

3. 计算一道 5 万 token 的推理任务在 `p=0.8, c=500`、N=4 worker 下的预期 Hogwild! 加速比。再对一项 1k token 的聊天任务在 `p=0.3, c=200`、N=4 下做同样计算。为什么一个赢一个亏？

4. 阅读 Hogwild! 论文第 4 节（初步评估）。指出作者报告的两种失败模式。描述一个更好的协调 prompt 可以如何缓解每种。

5. 在玩具中把 Hogwild! 与投机解码组合起来：每个 worker 内部使用 2-token 的 spec-decode。报告两者相乘后的加速比。当两个 worker 都想去扩展同一段共享 cache 前缀时，会出现什么记账问题？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际意思 |
|------|----------------|------------------------|
| Hogwild! | 「并行 worker，共享 cache」 | 同一个 LLM 的 N 个实例并发运行，共享一份 KV cache；通过 self-prompting 涌现协调 |
| Shared KV cache | 「协调媒介」 | 一份不断生长的单一 KV 缓冲，所有 worker 都可读写；让所有 worker 之间瞬时看到 token |
| Emergent coordination | 「不需要训练」 | 具备推理能力的 LLM 能读取共享 cache 并分工，无需 fine-tune 或显式协议 |
| Coordination overhead (c) | 「花在确认情况的 token」 | 每个 worker 读取扩展后 cache 并决定下一步的成本；必须相对总解码时间足够小 |
| Parallelizable fraction (p) | 「可以并行的部分」 | 任务级并行度：总工作中非本质串行的比例 |
| RoPE enables Hogwild! | 「Rotary 位置具有平移不变性」 | 因为位置是旋转，向共享 cache 写入不需要重算之前的 token |
| Voting ensemble | 「跑 N 个，取多数」 | 最简单的并行推理拓扑；适合分类，对长篇推理意义不大 |
| Tree of thought | 「分支再剪枝」 | 探索多条分支并剪枝的推理策略；显式的协调逻辑 |
| Multi-agent framework | 「分配子任务」 | 每个 agent 拿到一个角色；由协调者编排；协议开销重 |

## 延伸阅读（Further Reading）

- [Rodionov et al. — Hogwild! Inference: Parallel LLM Generation via Concurrent Attention (arXiv:2504.06261)](https://arxiv.org/abs/2504.06261) — Hogwild! 论文，在 QwQ 与 DeepSeek-R1 上的初步评估
- [Recht, Re, Wright, Niu — Hogwild!: A Lock-Free Approach to Parallelizing Stochastic Gradient Descent (arXiv:1106.5730, NeurIPS 2011)](https://arxiv.org/abs/1106.5730) — 原始 Hogwild!，名字来源
- [Su et al. — RoFormer: Enhanced Transformer with Rotary Position Embedding (arXiv:2104.09864)](https://arxiv.org/abs/2104.09864) — RoPE，让共享 cache 推理可行的关键性质
- [Yao et al. — Tree of Thoughts: Deliberate Problem Solving with Large Language Models (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) — tree-of-thought 推理策略，与 Hogwild! 正交
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) — 投机解码，Hogwild! 可与之组合的「序列内」并行
- [Hogwild! 参考 PyTorch 实现](https://github.com/eqimp/hogwild_llm) — 论文实验的唯一权威源
