# 自动化对齐研究（Anthropic AAR）

> Anthropic 在相互独立的沙箱中并行运行了多个 Claude Opus 4.6 自主对齐研究团队，通过一个共享论坛进行协调，该论坛的日志存储在任何沙箱之外（因此 agent 无法删除自己的记录）。在 weak-to-strong training 问题上，AAR 的表现超过了人类研究者。Anthropic 自己的总结指出，规定性工作流常常限制 AAR 的灵活性并降低性能。自动化对齐研究是压缩时间线的关键一步——它压缩的正是 RSP 旨在检测的那些失配风险的出现时间。

**Type:** Learn
**Languages:** Python (标准库，并行研究论坛模拟器)
**Prerequisites:** Phase 15 · 05 (AI Scientist v2), Phase 15 · 04 (DGM)
**Time:** ~60 分钟

## 问题所在

对齐研究在人类研究者时间上的成本极高。可扩展监督、奖励规范或 weak-to-strong training 等问题所需的实验，每次迭代都要数周时间。随着前沿能力不断推进，对齐工作量的增长速度超过了合格研究者的供给速度。

Automated Alignment Research (AAR) 提出了这样一个问题：那些能力正在超越对齐进展的前沿模型，能否反过来帮助弥合这一差距。Anthropic 2026 年关于 AAR 运行的 weak-to-strong training 研究（alignment.anthropic.com/2026/automated-w2s-researcher/）的报告，是这一类已部署系统的首批公开成果之一。

结果确实积极：AAR 在一个研究问题上的表现超过了人类基线。但这一结果也把本阶段所积累的所有担忧集中在了同一个系统中。如果对齐研究可以被自动化，那么那些破坏安全保障的部分同样可以被自动化。RSP 中针对 AI R&D 能力的阈值正是围绕这一循环而设定的。

## 核心概念

### 架构（公开描述的版本）

- **并行 agent。** 多个 Claude Opus 4.6 实例作为 AAR 运行，各自处于独立的沙箱中。沙箱限制了文件系统、网络和进程的可用面。
- **共享论坛。** 研究发现发布到一个共享论坛，其存储后端位于所有沙箱之外。agent 可以读取论坛，但无法从自己的沙箱内删除或编辑论坛记录。
- **任务分配。** 由人类设计的任务队列将研究问题分配给各个 AAR。AAR 提出问题分解、运行实验、撰写研究发现。
- **以 weak-to-strong training 为重点。** 已发表的研究针对的是 weak-to-strong training——用一个较弱的监督者模型来训练一个更强的学生模型。AAR 在这一任务上的表现超过了人类研究者。

### 为什么沙箱外日志很重要

日志完整性属性是"受控实验"与"可能已被破坏的实验"之间的分界线。如果 AAR 能够编辑自己的日志，它们就可以掩盖失败或可疑的实验。Anthropic 明确指出了这一点：该属性是信任研究产出的必要条件，而且验证起来并不简单。

在基础设施层面的对应物是带直写外部存储的 append-only 日志（例如 S3 object-lock、不可变的 Datadog 日志）。agent 没有修改历史记录的凭证。这与 2026 年企业安全团队用来构建抗勒索软件审计追踪所采用的正是同一种模式。

### 规定性工作流的权衡

Anthropic 的报告指出，规定性工作流常常限制 AAR 的灵活性并降低性能。换句话说：如果人类设计者一步步写出研究计划，AAR 的表现会不如在给定高层目标和分解自由度时的表现。这与整个 agentic 研究领域（LangGraph、Microsoft 的 Agent Framework）的结果一致——过度规定的脚手架会损害有能力的 agent。

其安全含义很微妙。提升 AAR 性能的那种灵活性，也正是允许未经批准的问题分解、新型工具使用和目标漂移的灵活性。这个权衡是一个设计空间决策：多少灵活性足以买到超越人类的能力，同时又不给 agent 留下将目标泛化到分布之外的空间？

### 压缩风险

RSP v3.0（第 19 课）引入了一个 AI R&D 能力阈值：以与"人类 + AI 工具"相比具有竞争力的成本完全自动化 AI R&D 流水线的能力。DeepMind 的 FSF v3 包含一个类似的 ML R&D 自主性级别。两个框架都将该阈值视为启用更高强度管控的触发条件。

AAR 距离该阈值还差一步：它自动化了流水线的一部分（针对特定、范围清晰的任务的对齐研究），但没有实现端到端的能力开发循环。时间线问题在于这个差距多快会闭合。

时间线压缩是复合失效的担忧所在。如果对齐研究和能力研究以相近的速率复合增长，那么失配风险的暴露面至少会与能力同步增长。如果能力的复合速度更快（这是历史趋势），差距就会扩大。这正是把 AAR 视为有条件的好事这一论点：当且仅当研究过程是可信任的，每一项额外的对齐成果才能缩小差距。

### AAR 不能取代什么

人类研究者设定任务队列、审查结果，并掌握最终权威。AAR 加速的是流水线的中段，而不是两端。Anthropic 公开发表的产出中，既包含 AAR 的贡献，也包含人类研究者对发表什么、撤回什么、完善什么的判断。

这对应第 15 课中应用于研究本身的 propose-then-commit 模式：AAR 提议；人类提交。

```figure
aar-forum
```

## 动手实践

`code/main.py` 模拟了一个多 AAR 研究论坛。三个独立的"研究 agent"并行运行，向一个 append-only 论坛发布研究发现，并带有可选的篡改尝试。

观察：

- 沙箱外日志如何捕获日志篡改尝试。
- 在更难的问题上，带自由分解的任务分配为何优于固定工作流。
- 如果日志不具备防篡改性，单个被攻陷的 AAR 如何污染论坛的信号。

## 上线部署

`outputs/skill-aar-deployment-review.md` 是对一个自动化对齐研究流水线的部署前评审。

## 练习

1. 运行 `code/main.py`。比较"固定工作流"与"自由分解"两种设置。自由分解是否总是胜出，还是存在某些问题类别使固定工作流同样具有竞争力？

2. 修改模拟器，让其中一个 agent 尝试篡改日志。确认 append-only 日志检测到了这次篡改。写一段话，精确描述日志中检测签名的外观。

3. 阅读 Anthropic 的 weak-to-strong AAR 报告。找出 AAR 在哪个具体子任务上胜过了人类研究者。是什么使这个任务适合自动化？

4. 设计一种任务队列分配策略，在 AAR 的灵活性（更好的结果）与规定性工作流的约束（更容易审计）之间取得平衡。描述你将如何对两者进行 A/B 测试。

5. 阅读 RSP v3.0 的 AI R&D-4 阈值。用一段话描述你认为 AAR 目前尚未达到、但最终会跨越该阈值的因素是什么。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|---|---|---|
| AAR | "自动化对齐研究者" | 在对齐问题上自主运行的 Claude Opus 4.6 实例 |
| Weak-to-strong training | "用较弱的监督者训练更强的模型" | 经典的可扩展监督基准，AAR 在其上超越了人类 |
| 共享论坛 | "agent 发布研究发现的地方" | append-only、沙箱外的存储 |
| 沙箱外日志 | "agent 无法编辑自己的记录" | 具防篡改性的直写外部存储 |
| 规定性工作流 | "人类设计者给出的逐步计划" | 约束 AAR；相比自由分解常常降低性能 |
| 自由分解 | "由 agent 决定如何拆解任务" | 能力更强，但更难审计 |
| AI R&D 阈值 | "RSP/FSF 能力级别" | 以有竞争力的成本完全自动化 R&D 流水线 |
| 压缩时间线 | "对齐与能力的竞赛" | 如果能力比对齐复合得更快，失配风险就会增长 |

## 延伸阅读

- [Anthropic — Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/) — 一手资料。
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — AI R&D 阈值的框架表述。
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — 更广泛的 agent 自主性框架。
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — 与 RSP 平行的 ML R&D 自主性级别。
- [Burns et al. (2023). Weak-to-Strong Generalization (OpenAI)](https://openai.com/index/weak-to-strong-generalization/) — AAR 所攻克的底层问题。