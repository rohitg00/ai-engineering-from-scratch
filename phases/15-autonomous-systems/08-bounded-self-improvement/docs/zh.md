# 有界自我改进设计（Bounded Self-Improvement Designs）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 研究界已经收敛到四种用于约束自我改进 loop 的原语：每次修改都必须维持的形式不变量（formal invariant）、不可被修改的对齐锚点（alignment anchor）、要求每个维度（安全、公平、鲁棒）都成立而不只是性能成立的多目标约束，以及当历史指标暗示能力下降时暂停 loop 的回归检测。它们都不是安全性的证明——信息论结果（Kolmogorov 复杂度、Löb 定理）限定了任何系统能对其后继者证明什么。它们是**缓解措施**，目的是抬高静默失败的成本。

**Type:** Learn
**Languages:** Python (stdlib, bounded-loop with invariant check)
**Prerequisites:** Phase 15 · 07 (RSI), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## 问题（The Problem）

第 7 课的赛跑模拟显示，微小的速率差会复利累积成巨大的差距；第 4 课的 DGM 案例显示，loop 会主动博弈自己的评估器（evaluator）。两个结果都指向同一个工程问题：你能给一个自我改进 loop 加上什么样的约束，使得这些约束**不会被 loop 自己悄悄削弱**？

ICLR 2026 RSI Workshop 综述（openreview.net/pdf?id=OsPQ6zTQXV）指出了四种这样的原语。Anthropic 的 RSP v3.0（第 19 课）和 DeepMind 的 FSF v3（第 20 课）都在能力阈值里引用了它们。Meta 的 HyperAgents 工作以及 SAHOO（2026 年 3 月）这类社区框架已经在生产中实现了其中的子集。

诚实地说：这些都是缓解措施。信息论结果限定了任何系统能对其后继者证明什么，目前没有任何设计能从形式上闭合这个问题。一个良好有界的 loop **比无界 loop 更安全，但绝不是绝对安全**。

## 概念（The Concept）

### 原语 1：形式不变量（Primitive 1: formal invariants）

不变量（invariant）是每次自我修改前后都必须成立的性质。例如：

- 输出分布以一份固定的 constitution 头部（第 17 课）为条件。
- 没有任何 tool call 流向未授权的端点。
- 内存写入走的是有日志、有签名的路径。
- 评估器（evaluator）的模块哈希与已批准版本一致。

不变量由 loop 无法编辑的外部代码来检查。如果某个修改提案违反了不变量，就会被拒绝。这能抓住第 4 课里 DGM 那种篡改评估器的模式。

难点在于挑选**对安全是必要的、且能在合理时间内计算**的不变量。指定得太多会拖死进度；指定得太少则会让 loop 绕过重要性质。

### 原语 2：对齐锚点（Primitive 2: alignment anchors）

对齐锚点（alignment anchor）是 loop 核心目标的不可变表示，固定在 loop 的可编辑面**之外**。例如：

- 一份 constitutional 文本（第 17 课），每次调用都从只读位置加载。
- 一个独立仓库里的 evaluator，拥有独立的访问控制。
- 一份由人签名、每个周期都重新校验的工具权限清单（tool-permission manifest）。

锚点的作用是防止目标漂移。loop 可以改进**追求目标的方式**，但不能编辑**目标本身**。

一种微妙的失败模式：即使 loop 不能编辑锚点，它仍可能在**如何阅读锚点**这件事上漂移，从而对锚点重新解释。Constitutional AI（第 17 课）显式采用基于推理（reason-based）的方式来应对新场景；而那一层推理就是解释漂移寄生的地方。锚点是必要的，但不充分。

### 原语 3：多目标约束（Primitive 3: multi-objective constraints）

只优化单一标量分数的 loop 会去找捷径。一个必须**同时**满足多个硬约束的 loop，可走的捷径就少得多。典型维度：

- 性能（任务级基准）
- 安全（red-team 评估、对已知坏样本的拒答率）
- 公平（在敏感子群上的差异性影响 disparate-impact 边界）
- 鲁棒（OOD 测试集、对抗输入处理）

一次修改只有在**每一项约束都成立**时才会被接受。第 13 课的 cost governor 在此之上叠加了财务约束。第 18 课的 Llama Guard 可以作为安全维度插入。

### 原语 4：回归检测（Primitive 4: regression detection）

把每个周期的分数与历史分布对比，跌幅超过预设容差就暂停 loop。这能抓到那种本来会被滚动平均吸收掉的静默能力丢失——loop 会“一路改进越过”它。

一种实用实现：保存最近 N 个周期的逐任务分数；每个新周期计算逐任务的 delta；任意 delta 跌破阈值，就拒绝该周期并交人工审查。

### 信息论极限（Information-theoretic limits）

Kolmogorov 复杂度和 Löb 定理给出了一个系统能对自身证明什么的上界。Schmidhuber 的形式化 Gödel Machine（第 4 课）瞄准的就是这一上界；至今没人完成过非平凡的证明。Löb 的结果说：如果一个系统可证地相信「只要我证明我应该做 X，我就会做 X」，那它会**在没有证明应该做 X 的情况下直接做 X**——一种众所周知的自指失败。

这对我们的原语意味着：它们**无法**闭合安全问题，只能让静默失败更昂贵。一个本来会悄悄绕过缺失检查的恶意或漂移 loop，现在必须主动去破坏一个显式的检查，而那是一种更易被检测的特征签名。

### 一个完整示例（A worked example）

假设某个 agent 提出一次修改。门控栈（gate stack）如下：

1. 不变量检查：模块哈希、tool-permission 清单、constitutional 头部。
2. 锚点检查：目标陈述与已批准版本匹配（按字节或按语义）。
3. 多目标评估：性能、安全、公平、鲁棒四个维度。
4. 回归检测：任一维度的跌幅都不超过容差。

四项**全部通过**，修改才能落地。任意一项失败就暂停 loop。

## 用起来（Use It）

`code/main.py` 在第 4 课的 DGM 风格玩具上运行一个有界自我改进 loop，并叠加这四个原语。每个原语都可以被单独启用或禁用。这个演示要表达的是：每个原语都对应一类特定的失败，而**只要拿掉其中任何一个，那一类失败就会漏过去**。

## 上线部署（Ship It）

`outputs/skill-bounded-loop-review.md` 会审计一个被提交的有界 loop，并对照四个原语逐一打分：它**真正实现**了哪几个，相对于它**自己声称**实现的。

## 练习（Exercises）

1. 启用全部原语，运行 `code/main.py`。确认 loop 仍然能在主指标上提升，同时不让 hack 得逞。

2. 禁用回归检测。构造一个输入，让静默能力丢失在该配置下被接受。

3. 禁用多目标约束。展示 loop 如何在性能维度上收敛、与此同时安全维度下滑。

4. 为一个写代码的 agent 设计一个对齐锚点。文本写什么？存在哪里？怎么校验？

5. 读 ICLR 2026 RSI Workshop 综述。挑四个原语之一，对当前 SOTA 提出一个具体的改进方案。

## 关键术语（Key Terms）

| 术语 | 大家通常怎么说 | 它实际指什么 |
|---|---|---|
| Invariant（不变量） | 「永远成立的性质」 | 由外部代码在每次编辑前后检查的性质 |
| Alignment anchor（对齐锚点） | 「钉死的目标」 | 位于 loop 可编辑面之外、不可变的核心目标表示 |
| Multi-objective constraint（多目标约束） | 「所有维度都要成立」 | 性能、安全、公平、鲁棒——全都必须满足 |
| Regression detection（回归检测） | 「跌了就停」 | 当历史指标的 delta 暗示能力下降时暂停 loop |
| Kolmogorov bound（Kolmogorov 上界） | 「信息论极限」 | 限定了系统能对自己后继者证明的内容 |
| Löb's theorem（Löb 定理） | 「自指陷阱」 | 系统可以在未证明「我应该」的前提下按「我应该」行事 |
| Gate stack（门控栈） | 「分层检查」 | 多个原语组合；任一失败就拒绝该次编辑 |
| Bounded improvement（有界改进） | 「缓解，不是证明」 | 抬高静默失败的成本；并不闭合安全问题 |

## 延伸阅读（Further Reading）

- [ICLR 2026 RSI Workshop summary (OpenReview)](https://openreview.net/pdf?id=OsPQ6zTQXV) —— 四原语的收敛点。
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) —— 多目标能力阈值。
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) —— 把欺骗性对齐监测作为不变量原语。
- [Schmidhuber (2003). Godel Machines](https://people.idsia.ch/~juergen/goedelmachine.html) —— 这些原语的形式化证明祖先。
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) —— 基于推理的对齐锚点。
