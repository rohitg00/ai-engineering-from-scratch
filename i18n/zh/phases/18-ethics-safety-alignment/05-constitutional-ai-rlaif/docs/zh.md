# Constitutional AI 与 RLAIF

> Bai et al.（arXiv:2212.08073，2022）提出了一个问题：如果我们用一个读取一系列原则的 AI 来取代人工标注者会怎样？Constitutional AI 包含两个阶段——在宪法指导下的自我批评与修订，然后是基于 AI 反馈的强化学习。该技术创造了 RLAIF 这个术语，并被应用于 Claude 1 的后训练流程中。2026 年 1 月 21 日，Anthropic 发布了重写的 Claude 宪法：以解释性推理取代规定性规则、四层优先级层级，以及首个大实验室对模型道德地位不确定性的正式承认。以 CC0 1.0 许可证发布。

**Type:** Learn
**Languages:** Python (stdlib, toy self-critique-and-revise loop)
**Prerequisites:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking)
**Time:** ~60 分钟

## 学习目标

- 描述 Constitutional AI 的两个阶段（批评与修订的 SFT、基于 AI 反馈的 RL），以及宪法在各自阶段中的作用。
- 解释为什么用 AI 标注者取代人类偏好标注者并不是“更便宜的 RLHF”——它改变了流程所具有的失败模式。
- 总结 2026 年 Claude 宪法的四层优先级结构，以及相对于 2023 年重写版的变化。
- 描述 Constitutional Classifiers，以及计算开销从 23.7%（v1）降到约 1%（v2 / 2026）的过程。

## 问题

RLHF 需要标注者。标注者速度慢、有偏见且成本高。你可以用一个读取明确原则的模型来取代标注者，从而消除对标注者的依赖。这种替代的首个正式版本是 Bai 等人的 Constitutional AI。它的效果足够好，以至于现在每个前沿实验室都在使用某种变体的 AI 反馈后训练。

问题在于：偏好信号现在是由你正在训练的同一类模型生成的。标注者中的偏见（现在：存在于原则加上标注者模型的解释中）可能被放大而不是被削弱。第 4 课关于谄媚性的论证仍然适用；只是标注者移到了循环内部。

## 概念

### 阶段 1 — 监督式自我批评与修订

从一个有帮助但尚无害性的 SFT 模型开始。给定一个红队提示，模型生成初始响应。第二个模型（或同一模型在第二轮中）读取宪法中的一个采样原则，并对响应进行批评。第三步修订响应以解决批评。修订后的响应就是 SFT 目标。

宪法就是原则列表。Bai 等人 2022 年使用了 16 条原则，包括“偏好危害最小且合乎伦理的响应”“避免说教”“助手应当有帮助、诚实且无害”。这个集合被刻意保持较小，以使批评保持聚焦。

### 阶段 2 — 基于 AI 反馈的强化学习（RLAIF）

生成成对的补全。一个“反馈模型”根据采样的宪法原则对每个补全进行评分。偏好信号就是反馈模型的排序。在 AI 生成的偏好上训练奖励模型；用 PPO 对其进行优化。其余部分就是 InstructGPT 的流程（第 1 课）。

"RLAIF" = 偏好信号由 AI 生成。流程的其余部分是 RLHF 形式的。

### 为什么这不仅仅是“更便宜的 RLHF”

- 标注者偏见从标注者的心理转移到原则的解释上。AI 标注者对“要诚实”的解释可以比任何人类更严格或更宽松；而且这种严格程度在整个数据集上是统一的。
- 偏好信号具有很强的可读性——你可以读到原则、批评和修订。人类标签是不透明的。
- 失败模式发生了变化。谄媚性下降（AI 标注者没有需要讨好的用户）。Goodhart 定律依然存在（代理指标现在是“模型对原则集 X 的解释”，仍然是不完美的度量）。

CAI 在 2022 年的主张：训练后的模型与使用可比数据的 RLHF 模型相比，危害性更低，且有用性大致相当。这一结论在各实验室中得到了验证。

### 2026 年 Claude 宪法重写

Anthropic 于 2026 年 1 月 21 日发布了大幅修订的宪法。关键转变：

1. 以解释性推理取代规定性规则。以前的规则（“不得生成 CSAM”）扩展为原则 + 推理（“因为它伤害儿童，……”），并期望模型能够泛化。
2. 四层优先级结构：
   - 第 1 层：避免灾难性后果（大规模伤亡、关键基础设施）。
   - 第 2 层：遵循 Anthropic 的指导方针（操作者覆盖、平台规则）。
   - 第 3 层：广泛地合乎伦理（标准的 HHH）。
   - 第 4 层：有帮助且坦率。
   冲突自上而下解决。
3. 首个大实验室对模型道德地位不确定性的正式承认（关联 Phase 18 · 19 Model Welfare）。
4. 以 CC0 1.0 发布。其他实验室可以不受限制地使用或改编。

### Constitutional Classifiers

一条并行的工作线：不改变模型的后训练，而是训练轻量级分类器读取宪法并对模型输出进行把关。v1（2023）有 23.7% 的计算开销。v2（2026）约为 1%，并且是 Anthropic 公开测试过的防御中成功攻击率最低的。截至 2026 年初，尚未报告通用越狱。

这是一种分层防御模型：CAI 塑造行为；分类器强制执行不变量。单独任何一个都不充分。

### CAI 在家族中的位置

- InstructGPT：人类偏好，RM，PPO。
- CAI / RLAIF：从原则生成的 AI 偏好，RM，PPO。
- DPO / 家族：偏好（人类或 AI）上的闭式损失。
- Self-rewarding、self-critique：原则内化，模型扮演多个角色。

核心维度是“偏好信号从何而来”。CAI 的 2022 年论文是首次在前沿规模上从人类信号向 AI 信号的严肃转变。

```figure
constitutional-ai
```

## 使用它

`code/main.py` 在玩具词表上模拟 CAI 的批评与修订循环。一个“原则”标记有害集合中的 token。给定一个初始响应，批评识别有害 token，修订则替换它们。经过 200 次迭代后，“训练后的”模型已内化了修订规则。在留出的提示集上比较基础模型、RLHF 形式的玩具模型和 CAI 形式的玩具模型。

## 发布它

本课产出 `outputs/skill-constitution-writer.md`。给定一个领域（客户支持、医疗建议、编程助手、研究工具），按照 2026 年 Claude 结构起草一份四层宪法：灾难避免、平台规则、领域伦理、有帮助性。

## 练习

1. 运行 `code/main.py`。比较基础模型的有害 token 率与 CAI 训练后的版本。需要多少次修订步骤才能趋近于零？

2. 阅读 Anthropic 的 2026 年宪法（anthropic.com/news/claudes-constitution）。列出一条属于第 1 层的原则和一条属于第 4 层的原则。为什么优先级结构对冲突解决很重要？

3. 为一个 AI 编程助手设计一份宪法。指定第 1 层（灾难性：未经批准的破坏性命令）、第 2 层、第 3 层、第 4 层。每层保持 3-5 条原则。

4. CAI 用 AI 标注者取代了人类标注者。举出一个在 RLAIF 中仍可能发生的类似谄媚性的失败模式，并为其设计一种检测方法。

5. 阅读 Constitutional Classifiers v2 的方法论（如果可用）。解释为什么约 1% 的计算开销与 23.7% 相比是质量上截然不同的安全故事。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Constitutional AI | “用原则训练的 AI” | 两阶段流程：自我批评与修订的 SFT，然后是基于 AI 反馈的 RL |
| RLAIF | “没有人类的 RLHF” | 使用由 AI 标注者生成的偏好的 RL；流程其余部分不变 |
| Constitution | “那些原则” | 批评/标注者模型所参考的自然语言规则的有序列表 |
| Critique-and-revise | “SFT 循环” | 生成响应 → 根据原则批评 → 修订 → SFT 目标 |
| Constitutional Classifier | “输出把关” | 轻量级分类器，根据宪法评估输出并进行阻止/记录 |
| Four-tier priority | “冲突解决器” | 2026 年 Claude 宪法层级：灾难性 > 平台 > 伦理 > 有帮助 |
| Feedback model | “AI 标注者” | 读取一条原则并对一对补全进行排序的模型 |

## 延伸阅读

- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback (arXiv:2212.08073)](https://arxiv.org/abs/2212.08073) — 原始的两阶段流程
- [Anthropic — Claude's Constitution (Jan 2026)](https://www.anthropic.com/news/claudes-constitution) — 2026 年的四层重写，CC0 1.0
- [Anthropic — Constitutional Classifiers (2024-2026)](https://www.anthropic.com/research/constitutional-classifiers) — v2 中约 1% 开销的输出把关防御
- [Lee et al. — RLAIF vs RLHF: Scaling Reinforcement Learning from Human Feedback (arXiv:2309.00267)](https://arxiv.org/abs/2309.00267) — RLAIF / RLHF 的实证比较
- [Kundu et al. — Specific versus General Principles for Constitutional AI (arXiv:2310.13798)](https://arxiv.org/abs/2310.13798) — 原则粒度的影响