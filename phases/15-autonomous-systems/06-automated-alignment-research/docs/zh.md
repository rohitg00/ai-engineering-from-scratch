# 自动化对齐研究（Anthropic AAR）

> Anthropic 在独立沙箱中运行了并行的 Claude Opus 4.6 自主对齐研究团队，通过共享论坛协调，其日志位于任何沙箱之外（因此 agent 无法删除自己的记录）。在弱到强训练问题上，AAR 表现优于人类研究人员。Anthropic 自己的总结指出，规定的工作流经常限制 AAR 的灵活性并降低性能。自动化对齐研究是压缩步骤，将时间线压缩到 RSP 旨在检测的确切错位风险。

**类型：** 学习
**语言：** Python（标准库，并行研究论坛模拟器）
**前置条件：** 第 15 阶段 · 05（AI Scientist v2），第 15 阶段 · 04（DGM）
**时间：** ~60 分钟

## 问题

对齐研究在人类研究人员时间上是昂贵的。可扩展监督、奖励规范或弱到强训练等问题需要每次迭代数周的实验。随着前沿能力的进步，对齐工作负载的增长超过了合格研究人员的供应。

自动化对齐研究（AAR）问：那些能力超过对齐的相同前沿模型是否能为缩小差距做出贡献。Anthropic 2026 年关于 AAR 运行弱到强训练研究的报告（alignment.anthropic.com/2026/automated-w2s-researcher/）是此类部署系统的首批公开结果之一。

结果确实是积极的：AAR 解决了一个比人类基线更好的研究问题。结果也将本阶段发展的每个担忧集中在一个系统中。如果对齐研究可以自动化，那么损害保障措施的部分也可以。RSP 的 AI R&D 能力阈值就是针对这个循环编写的。

## 概念

### 架构（如公开描述）

- **并行 agent。** 多个 Claude Opus 4.6 实例作为 AAR 运行，每个在独立沙箱中。沙箱限制文件系统、网络和进程表面。
- **共享论坛。** 发现发布到共享论坛，其存储后端位于每个沙箱之外。Agent 可以阅读论坛；agent 无法从自己的沙箱内删除或编辑论坛记录。
- **任务分配。** 人工设计的任务队列将研究问题分配给 AAR。AAR 提出分解、运行实验、撰写发现。
- **弱到强训练重点。** 发表的研究针对弱到强训练——使用较弱的监督者模型训练较强的学生模型。AAR 在此任务上表现优于人类研究人员。

### 为什么沙箱外日志很重要

日志完整性属性是受控实验与可能被破坏实验之间的区别。如果 AAR 可以编辑自己的日志，它们可以掩盖失败或可疑的实验。Anthropic 直接标记了这一点：该属性是信任研究输出的必要条件，且验证非平凡。

基础设施术语中的类比是仅追加日志，写入外部存储（例如 S3 对象锁定、不可变的 Datadog 日志）。Agent 没有修改过去记录的凭证。这与 2026 年企业安全团队用于制作防勒索软件审计跟踪的相同模式。

### 规定工作流的权衡

Anthropic 的报告指出，规定的工作流经常限制 AAR 的灵活性并降低性能。换句话说：如果人类设计者逐步编写研究计划，AAR 的表现比给予高级目标和分解自由时差。这与 agent 研究结果一致（LangGraph、Microsoft 的 Agent Framework）——过度指定的脚手架会损害有能力的 agent。

安全含义是微妙的。改善 AAR 性能的灵活性也是允许未经批准的分解、新颖工具使用和目标漂移的灵活性。权衡是一个设计空间决策：多少灵活性购买了足够的能力来击败人类，而不给 agent 空间来泛化分布外的目标？

### 压缩风险

RSP v3.0（第 19 课）引入了一个 AI R&D 能力阈值：以与人类 + AI 工具竞争的成本完全自动化 AI R&D 管道的能力。DeepMind 的 FSF v3 包括一个类似的 ML R&D 自主级别。两个框架都将此阈值视为加强控件的触发器。

AAR 距离阈值一步：它自动化了管道的一部分（特定、范围明确任务上的对齐研究），但不是端到端的能力开发循环。时间线问题是差距关闭的速度。

压缩的时间线是复合失败的担忧。如果对齐研究和能力研究以相似的速率复合，错位风险表面至少与能力一样快地增长。如果能力复合更快（历史趋势），差距扩大。这就是 AAR 是有限好的论点：每个额外的对齐结果只有在研究过程可信时才减少差距。

### AAR 不替代什么

人类研究人员设置任务队列、审查结果并持有宪法权威。AAR 加速管道的中间部分，不是两端。Anthropic 发表的输出包括 AAR 贡献和人类研究者对发布什么、撤回什么和提炼什么的判断。

这与第 15 课的提出然后提交模式应用于研究本身相匹配：AAR 提出；人类提交。

## 使用

`code/main.py` 模拟一个多 AAR 研究论坛。三个独立的"研究 agent"并行运行，将发现发布到可选篡改尝试的仅追加论坛。

观察：

- 沙箱外日志如何捕捉日志篡改尝试。
- 自由分解的任务分配如何在更难的问题上胜过固定工作流。
- 如果日志不是防篡改的，单个被破坏的 AAR 如何污染论坛的信号。

## 交付

`outputs/skill-aar-deployment-review.md` 是对自动化对齐研究管道的预部署审查。

## 练习

1. 运行 `code/main.py`。比较"固定工作流"与"自由分解"设置。自由分解总是赢，还是有固定工作流有竞争力的问题类别？

2. 修改模拟器使一个 agent 尝试日志篡改。确认仅追加日志检测到它。写一段文字描述检测签名在日志中的确切样子。

3. 阅读 Anthropic 的弱到强 AAR 报告。识别 AAR 击败人类研究人员的具体子任务。什么使其适合自动化？

4. 设计一个平衡 AAR 灵活性（更好结果）与规定工作流约束（更容易审计）的任务队列分配策略。描述你会如何 A/B 测试两者。

5. 阅读 RSP v3.0 的 AI R&D-4 阈值。用一段文字描述你认为什么会跨越它而 AAR 目前不会。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|---|---|---|
| AAR | "Automated Alignment Researcher" | 在自主对齐问题上运行的 Claude Opus 4.6 实例 |
| Weak-to-strong training | "用较弱的监督者训练较强的模型" | AAR 击败人类的经典可扩展监督基准 |
| Shared forum | "Agent 发布发现的地方" | 仅追加、沙箱外存储 |
| Out-of-sandbox log | "Agent 无法编辑自己的记录" | 写入外部存储的防篡改写入 |
| Prescribed workflow | "人类设计者的逐步计划" | 限制 AAR；通常比自由分解降低性能 |
| Free decomposition | "Agent 决定如何分解任务" | 更有能力，更难审计 |
| AI R&D threshold | "RSP/FSF 能力级别" | 以竞争成本完全自动化 R&D 管道 |
| Compressed timeline | "对齐与能力的竞赛" | 如果能力复合比对齐更快，错位风险增长 |

## 延伸阅读

- [Anthropic — Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/) —— 主要来源。
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) —— AI R&D 阈值框架。
- [Anthropic — 测量 AI agent 自主性](https://www.anthropic.com/research/measuring-agent-autonomy) —— 更广泛的 agent 自主性框架。
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) —— 与 RSP 平行的 ML R&D 自主级别。
- [Burns 等 (2023). Weak-to-Strong Generalization (OpenAI)](https://openai.com/index/weak-to-strong-generalization/) —— AAR 攻击的底层问题。