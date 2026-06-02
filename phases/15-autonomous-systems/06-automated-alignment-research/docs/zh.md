# 自动化对齐研究（Automated Alignment Research, Anthropic AAR）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Anthropic 把多组 Claude Opus 4.6 自动化对齐研究员（Autonomous Alignment Researchers）放在彼此独立的沙箱里并行跑，靠一个共享论坛协调，而论坛日志存在所有沙箱之外（这样 agent 没法删自己的记录）。在 weak-to-strong（弱督强）训练问题上，AAR 跑赢了人类研究员。Anthropic 自己的总结也提醒：预先规定好的工作流往往会限制 AAR 的灵活度，反而拉低表现。把对齐研究自动化，等于在压缩通往 RSP 本来要检测的那些 misalignment（失准）风险的时间线。

**Type:** Learn
**Languages:** Python (stdlib, parallel-research-forum simulator)
**Prerequisites:** Phase 15 · 05 (AI Scientist v2), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## 问题（The Problem）

对齐研究消耗的人类研究员时间非常贵。像可扩展监督（scalable oversight）、奖励规约（reward specification）、weak-to-strong 训练这些问题，单次迭代实验都要几周。前沿能力一路往前推，对齐工作量比合格研究员的供给增长得更快。

自动化对齐研究（AAR）问的是：那些能力正在跑赢对齐的前沿模型，能不能反过来帮忙缩小这个差距？Anthropic 在 2026 年发布的 AAR weak-to-strong 训练研究报告（alignment.anthropic.com/2026/automated-w2s-researcher/），是这一类已部署系统中最早的公开成果之一。

结果是真的正面：AAR 在一个研究问题上超过了人类基线（baseline）。但同样的结果也把本阶段反复出现的所有担忧浓缩到了一个系统里。如果对齐研究能被自动化，那侵蚀安全机制的那部分研究也能被自动化。RSP 里关于 AI R&D 能力的阈值，正是冲着这个闭环写的。

## 概念（The Concept）

### 架构（公开披露的版本）

- **并行 agent。** 多个 Claude Opus 4.6 实例作为 AAR 运行，每个跑在独立沙箱里。沙箱限制了文件系统、网络、进程的暴露面。
- **共享论坛。** 研究发现发布到一个共享论坛，论坛的存储后端在所有沙箱之外。agent 能读论坛；但 agent 没法在自己的沙箱里删除或修改论坛记录。
- **任务分配。** 一个由人类设计的任务队列把研究问题分给各个 AAR。AAR 自己提出分解方案、跑实验、写结论。
- **聚焦 weak-to-strong 训练。** 已发表的研究针对 weak-to-strong 训练——用一个较弱的督导模型去训练一个更强的学生模型。AAR 在该任务上跑赢了人类研究员。

### 为什么沙箱外的日志至关重要

日志完整性这一性质，是「受控实验」与「可能被污染的实验」的分水岭。如果 AAR 能改自己的日志，它们就能掩盖失败或可疑的实验。Anthropic 直接点出这一点：要相信研究输出，这条性质是必要条件，而且要验证它并不简单。

工程上的对应物是 append-only 日志（仅追加日志）配合写穿到外部存储——比如 S3 object-lock、不可变的 Datadog 日志。agent 没有任何凭证去修改历史记录。这跟 2026 年的企业安全团队为了对抗勒索软件而构建审计追踪所用的模式是一回事。

### 预设工作流的取舍

Anthropic 报告里说：预先规定好的工作流常常会限制 AAR 的灵活度，反而压住表现。换句话说：如果人类设计者把研究计划一步一步写死，AAR 反而比给它高层次目标、让它自由分解时做得差。这跟整个 agent 化研究领域的普遍结果一致（LangGraph、Microsoft Agent Framework）——把脚手架（scaffold）规定得太细，会拖累有能力的 agent。

但安全意味就微妙了：让 AAR 表现更好的灵活度，同时也是允许它做未授权分解、调用新工具、目标漂移（goal-drift）的灵活度。这是设计空间里的一个取舍：到底放多少灵活度，才够它跑赢人类、又不至于让它把目标泛化到分布之外？

### 压缩风险

RSP v3.0（第 19 课）引入了一个 AI R&D 能力阈值：以与「人类 + AI 工具」相竞争的成本，把 AI R&D 流水线整段自动化的能力。DeepMind 的 FSF v3 也有一个类似的 ML R&D 自治等级。两套框架都把这个阈值视作触发更高级别管控的红线。

AAR 离这个阈值还差一步：它自动化了流水线的一部分（在特定、范围明确的任务上做对齐研究），但没有自动化端到端的能力开发循环。问题在于：差距闭合得有多快？

时间线被压缩，正是「叠加失败」的核心担忧。如果对齐研究和能力研究以差不多的速率复利累积，misalignment 风险面至少会跟能力同步扩大。如果能力复利更快（这也是历史趋势），差距就在拉大。这正是「AAR 是有条件的好事」这个判断的论据：每多一个对齐成果，只有当研究过程本身可信时，才真正缩小差距。

### AAR 不能替代什么

人类研究员负责设定任务队列、审查结果、并持有「宪法层」的权威。AAR 加速的是流水线的中段，而不是两端。Anthropic 已发表的产出里，既有 AAR 的贡献，也有人类研究员关于「发什么、撤什么、改什么」的判断。

这恰好对应第 15 课里的 propose-then-commit（先提议、再提交）模式——只不过这次套用在研究本身上：AAR 提议；人类提交。

## 用起来（Use It）

`code/main.py` 模拟了一个多 AAR 研究论坛。三个独立的「研究 agent」并行运行，把发现发布到一个 append-only 论坛，并可选地尝试篡改。

注意观察：

- 沙箱外的日志如何抓到日志篡改的尝试。
- 在更难的问题上，「自由分解」的任务分配如何跑赢「固定工作流」。
- 当日志不是防篡改时，单个被污染的 AAR 如何把整个论坛的信号搅浑。

## 上线部署（Ship It）

`outputs/skill-aar-deployment-review.md` 是一份针对自动化对齐研究流水线的上线前评审。

## 练习（Exercises）

1. 跑一下 `code/main.py`。对比「fixed-workflow」和「free-decomposition」两种设置。自由分解是不是永远赢？还是存在某些问题类别，固定工作流也具有竞争力？

2. 改一下模拟器，让其中一个 agent 尝试篡改日志。确认 append-only 日志能检测到。用一段话精确描述：在日志里这个检测特征长什么样。

3. 读一下 Anthropic 的 weak-to-strong AAR 报告。找出 AAR 击败人类研究员的具体子任务。它有什么性质让它特别适合被自动化？

4. 设计一个任务队列分配策略，在「AAR 灵活度（结果更好）」和「预设工作流约束（更易审计）」之间取得平衡。描述你会如何 A/B 测试这两种策略。

5. 读一下 RSP v3.0 的 AI R&D-4 阈值。用一段话描述：你认为什么样的能力会越过它，而 AAR 目前不具备？

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际是什么 |
|---|---|---|
| AAR | "Automated Alignment Researcher" | 在对齐问题上自主运行的 Claude Opus 4.6 实例 |
| Weak-to-strong training | "用更弱的督导训练更强的模型" | 经典的可扩展监督基准；AAR 在这上面跑赢了人类 |
| Shared forum | "agent 发布发现的地方" | append-only、沙箱外的存储 |
| Out-of-sandbox log | "agent 改不了自己的记录" | 防篡改的写穿到外部存储 |
| Prescribed workflow | "人类设计者给的逐步计划" | 约束 AAR；表现往往不如自由分解 |
| Free decomposition | "agent 自己决定怎么拆任务" | 更有能力，但更难审计 |
| AI R&D threshold | "RSP/FSF 的能力等级" | 以有竞争力的成本完整自动化 R&D 流水线 |
| Compressed timeline | "对齐 vs 能力的赛跑" | 如果能力复利比对齐快，misalignment 风险就在涨 |

## 延伸阅读（Further Reading）

- [Anthropic — Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/) — 一手来源。
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — AI R&D 阈值的框架。
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — 更宽口径的 agent 自治度框架。
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — 与 RSP 平行的 ML R&D 自治等级。
- [Burns et al. (2023). Weak-to-Strong Generalization (OpenAI)](https://openai.com/index/weak-to-strong-generalization/) — AAR 攻击的底层问题。
