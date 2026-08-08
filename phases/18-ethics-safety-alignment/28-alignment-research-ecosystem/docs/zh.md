# 对齐研究生态系统 —— MATS、Redwood、Apollo、METR

> 五个组织定义了 2026 年非实验室对齐研究层。MATS（ML Alignment & Theory Scholars）：自 2021 年底以来 527+ 名研究员，180+ 篇论文，10K+ 引用，h-index 47；2024 年夏季队列作为 501(c)(3) 合并，约 90 名学者和 40 名导师；80% 的 2025 年前校友从事安全/安保工作，200+ 人在 Anthropic、DeepMind、OpenAI、UK AISI、RAND、Redwood、METR、Apollo。Redwood Research：由 Buck Shlegeris 创立的应用对齐实验室；引入 AI 控制（第 10 课）；与 UK AISI 合作进行控制安全案例。Apollo Research：前沿实验室的部署前密谋评估；撰写上下文内密谋（第 8 课）和 Towards Safety Cases for AI Scheming。METR（Model Evaluation and Threat Research）：基于任务的能力评估，自主任务时间范围研究；"Common Elements of Frontier AI Safety Policies" 比较实验室框架。Eleos AI Research：模型福利部署前评估（第 19 课）；进行 Claude Opus 4 福利评估。

**类型：** 学习
**语言：** 无
**先决条件：** Phase 18 · 01-27（Phase 18 前面课程）
**时间：** ~45 分钟

## 学习目标

- 识别非实验室对齐研究生态系统的五个组织及其核心产出。
- 描述 MATS 的规模（学者、论文、h-index）及其作为人才管道的角色。
- 描述 Redwood 的 AI 控制议程及其与 UK AISI 的合作伙伴关系。
- 描述 METR 的基于任务的评估方法论。

## 问题

前沿实验室（第 18 课）内部产生安全评估并发布选定结果。实验室外部的生态系统是评估被验证、新失效模式首次被发现、人才被培训的地方。了解生态系统有助于解释哪些研究发现被谁信任。

## 概念

### MATS（ML Alignment & Theory Scholars）

2021 年底开始。研究指导计划；学者与高级研究员在特定对齐问题上花费 10-12 周。

规模（2026）：
- 自成立以来 527+ 名研究员。
- 发表 180+ 篇论文。
- 10K+ 引用。
- h-index 47。
- 2024 年夏季：90 名学者 + 40 名导师；作为 501(c)(3) 合并。

职业成果：约 80% 的 2025 年前校友从事安全/安保工作。200+ 人在 Anthropic、DeepMind、OpenAI、UK AISI、RAND、Redwood、METR、Apollo。

### Redwood Research

应用对齐实验室。由 Buck Shlegeris 创立。引入 AI 控制议程（第 10 课）。与 UK AISI 合作进行控制安全案例。为 DeepMind 和 Anthropic 的评估设计提供建议。

经典论文：Greenblatt、Shlegeris 等人，"AI Control"（arXiv:2312.06942，ICML 2024）；对齐伪装（Greenblatt、Denison、Wright 等人，arXiv:2412.14093，与 Anthropic 联合）。

风格：特定威胁模型、最坏情况对抗者、可以压力测试的具体协议。

### Apollo Research

前沿实验室的部署前密谋评估。撰写上下文内密谋（第 8 课，arXiv:2412.04984）。2025 年 OpenAI 反密谋训练合作的合作伙伴。制作 Towards Safety Cases for AI Scheming（2024）。

风格：欺骗可能出现的智能体设置评估；三支柱分解（未对齐、目标导向、情境意识）。

### METR（Model Evaluation and Threat Research）

基于任务的能力评估。自主任务完成时间范围研究。"Common Elements of Frontier AI Safety Policies"（metr.org/common-elements，2025）比较实验室框架。

与 Apollo 共同撰写 AI 密谋安全案例草图。

风格：长程任务评估、经验能力测量、框架综合。

### Eleos AI Research

模型福利部署前评估。进行 Claude Opus 4 福利评估，记录在系统卡片第 5.3 节。为第 19 课的福利相关声明提供外部方法论检查。

### 流程

MATS 培训研究员。毕业生去 Anthropic、DeepMind、OpenAI（实验室安全团队）或 Redwood、Apollo、METR、Eleos（外部评估）。外部评估员与实验室和 UK AISI / CAISI 合作。出版物反馈生态系统回到 MATS 供下一队列使用。

### 为什么这一层重要

单一来源评估不可靠：实验室评估自己的模型存在结构性利益冲突。外部评估员可以提出和验证实验室可能低报的失效模式。2024 年 Sleeper Agents 论文（第 7 课）是 Anthropic + Redwood；对齐伪装是 Anthropic + Redwood；上下文内密谋是 Apollo；反密谋是 Apollo + OpenAI。多组织结构是质量控制。

### 这在 Phase 18 中的位置

第 7-11 课引用 Redwood 和 Apollo 的工作；第 18 课引用 METR 的框架比较；第 19 课引用 Eleos。第 28 课是 Phase 其余部分依赖的生态系统的明确组织地图。

## 使用它

没有代码。阅读 METR 的 "Common Elements of Frontier AI Safety Policies" 作为外部综合如何为实验室内部政策工作增加价值的示例。

## 交付它

本课产生 `outputs/skill-ecosystem-map.md`。给定对齐声明或评估，它识别组织、出版场所和方法论风格，并与已知对应组织交叉检查。

## 练习

1. 从第 7-15 课中选择一篇论文，识别涉及的组织。将作者与 MATS 校友和当前生态系统隶属关系交叉检查。

2. 阅读 METR 的 "Common Elements of Frontier AI Safety Policies"。识别他们强调的三个跨实验室趋同和两个最大分歧。

3. MATS 职业成果约 80% 安全/安保。论证这种选择压力是适应性的（培训领域）还是有偏见的（过滤掉异端立场）。

4. Redwood 和 Apollo 都做控制/密谋工作，但风格不同。选择一个失效模式，描述每个会如何调查它。

5. Eleos AI 是唯一纯模型福利组织。设计一个专注于不同福利相邻问题（认知自由、机器人具身等）的假设第二组织，并阐明其方法论。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| MATS | "指导计划" | ML Alignment & Theory Scholars；自 2021 年以来 527+ 名研究员 |
| Redwood Research | "控制实验室" | 应用对齐；AI Control 作者；UK AISI 合作伙伴 |
| Apollo Research | "密谋评估" | 前沿实验室的部署前密谋评估 |
| METR | "任务范围评估" | 基于任务的能力评估；框架综合 |
| Eleos AI | "福利实验室" | 模型福利部署前评估 |
| 人才管道 | "MATS -> 实验室" | MATS 毕业生流向 Anthropic、DM、OpenAI、Redwood、Apollo、METR |
| 外部评估 | "非实验室检查" | 不是由模型生产者进行的评估；增加可信度 |

## 延伸阅读

- [MATS (ML Alignment & Theory Scholars)](https://www.matsprogram.org/) — 指导计划
- [Redwood Research](https://www.redwoodresearch.org/) — AI Control 论文
- [Apollo Research](https://www.apolloresearch.ai/) — 密谋评估
- [METR — Common Elements of Frontier AI Safety Policies](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — 框架比较
- [Eleos AI Research](https://www.eleosai.org/research) — 模型福利方法论
