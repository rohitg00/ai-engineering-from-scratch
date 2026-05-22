# 对齐研究生态系统 — MATS、Redwood、Apollo、METR

> 五个组织定义了 2026 年非实验室对齐研究层。MATS（ML Alignment & Theory Scholars）：自 2021 年末起 527+ 研究人员，180+ 论文，10K+ 引用，h-index 47；2024 年夏季队列注册为 501(c)(3)，约 90 名学者和 40 名导师；2025 年前 80% 校友从事安全/安保工作，200+ 人在 Anthropic、DeepMind、OpenAI、英国 AISI、RAND、Redwood、METR、Apollo。Redwood Research：应用对齐实验室，由 Buck Shlegeris 创立；引入了 AI 控制（第 10 课）；与英国 AISI 合作开展控制安全案例。Apollo Research：为前沿实验室提供部署前谋划（scheming）评估；撰写了上下文谋划（In-Context Scheming，第 8 课）和《迈向 AI 谋划安全案例》（Towards Safety Cases for AI Scheming）。METR（模型评估与威胁研究）：基于任务的能力评估，自主任务时间跨度研究；"前沿 AI 安全政策共同要素"比较各实验室框架。Eleos AI Research：模型福利部署前评估（第 19 课）；进行了 Claude Opus 4 福利评估。

**类型：** 学习（Learn）
**语言：** 无
**前置要求：** 第 18 阶段 · 01-27（第 18 阶段先前课程）
**时间：** 约 45 分钟

## 学习目标

- 识别非实验室对齐研究生态系统的五个组织及其核心产出。
- 描述 MATS 的规模（学者、论文、h-index）及其作为人才管道的角色。
- 描述 Redwood 的 AI 控制议程及其与英国 AISI 的合作伙伴关系。
- 描述 METR 的基于任务的评估方法论。

## 问题背景

前沿实验室（第 18 课）在内部进行安全评估并发布选定的结果。实验室外的生态系统是评估得到验证、新失败模式首先被发现以及人才培养的地方。了解生态系统有助于解释哪些研究发现被谁信任。

## 核心概念

### MATS（ML Alignment & Theory Scholars）

始于 2021 年末。研究导师计划；学者与高级研究人员就特定对齐问题工作 10-12 周。

规模（2026）：
- 自创立以来 527+ 研究人员。
- 发表 180+ 论文。
- 10K+ 引用。
- h-index 47。
- 2024 年夏季：90 名学者 + 40 名导师；注册为 501(c)(3)。

职业成果：约 80% 2025 年前的校友从事安全/安保工作。200+ 人在 Anthropic、DeepMind、OpenAI、英国 AISI、RAND、Redwood、METR、Apollo。

### Redwood Research

应用对齐实验室。由 Buck Shlegeris 创立。引入了 AI 控制议程（第 10 课）。与英国 AISI 合作开展控制安全案例。为 DeepMind 和 Anthropic 提供评估设计建议。

规范论文：Greenblatt, Shlegeris 等人，"AI Control"（arXiv:2312.06942，ICML 2024）；对齐伪装（Alignment Faking）（Greenblatt, Denison, Wright 等人，arXiv:2412.14093，与 Anthropic 联合发表）。

风格：特定威胁模型、最坏情况对抗者、可进行压力测试的具体协议。

### Apollo Research

为前沿实验室提供部署前谋划（scheming）评估。撰写了上下文谋划（In-Context Scheming，第 8 课，arXiv:2412.04984）。2025 年 OpenAI 反谋划训练合作的合作伙伴。撰写《迈向 AI 谋划安全案例》（2024）。

风格：欺骗可能出现的 Agent 设置评估；三支柱分解（未对齐、目标导向性、情境感知）。

### METR（模型评估与威胁研究）

基于任务的能力评估。自主任务完成时间跨度研究。"前沿 AI 安全政策共同要素"（metr.org/common-elements，2025）比较各实验室框架。

与 Apollo 共同撰写 AI 谋划安全案例概要。

风格：长期任务评估、实证能力测量、框架综合。

### Eleos AI Research

模型福利部署前评估。进行了系统卡第 5.3 节中记录的 Claude Opus 4 福利评估。为第 19 课的福利相关主张提供外部方法论检查。

### 流程

MATS 培养研究人员。毕业生前往 Anthropic、DeepMind、OpenAI（实验室安全团队）或 Redwood、Apollo、METR、Eleos（外部评估）。外部评估者与实验室以及英国 AISI / CAISI 合作。出版物将生态系统反馈给 MATS 以供下一届学员使用。

### 为什么这一层很重要

单一来源评估是不可靠的：评估自己模型的实验室存在结构性利益冲突。外部评估者可以提出并验证实验室可能报告不足的失败模式。2024 年潜伏 Agent（Sleeper Agents）论文（第 7 课）是 Anthropic + Redwood；对齐伪装（Alignment Faking）是 Anthropic + Redwood；上下文谋划（In-Context Scheming）是 Apollo；反谋划（Anti-Scheming）是 Apollo + OpenAI。多组织结构是质量保障。

### 在本阶段中的位置

第 7-11 课引用了 Redwood 和 Apollo 的工作；第 18 课引用了 METR 的框架比较；第 19 课引用了 Eleos。第 28 课是本阶段其余部分所依赖的生态系统的显式组织地图。

## 实际使用

无代码。阅读 METR 的"前沿 AI 安全政策共同要素"作为外部综合如何为实验室内部政策工作增加价值的示例。

## 交付成果

本课产生 `outputs/skill-ecosystem-map.md`。给定一个对齐主张或评估，它识别组织、发布渠道和方法论风格，并针对已知的对应组织进行交叉检查。

## 练习

1. 从第 7-15 课中选择一篇论文并识别涉及的组织。根据 MATS 校友和当前生态系统 affiliations 交叉检查作者。

2. 阅读 METR 的"前沿 AI 安全政策共同要素"。找出他们强调的三个跨实验室趋同点和两个最大分歧点。

3. MATS 职业成果约 80% 在安全/安保领域。论证这种选择压力是适应性的（培养领域）还是有偏见的（过滤掉异端立场）。

4. Redwood 和 Apollo 都做控制/谋划工作，但风格不同。选择一个失败模式，描述各自会如何研究它。

5. Eleos AI 是唯一纯粹的模型福利组织。设计一个专注于不同福利相关问题（认知自由、机器人具身等）的假想第二个组织，并阐述其方法论。

## 关键术语

| 术语 | 人们的提法 | 实际含义 |
|------|-----------|----------|
| MATS | "导师，计划" | ML 对齐与理论学者；自 2021 年起 527+ 研究人员 |
| Redwood Research | "控制实验室" | 应用对齐；AI 控制作者；英国 AISI 合作伙伴 |
| Apollo Research | "谋划评估" | 为前沿实验室提供部署前谋划评估 |
| METR | "任务跨度评估" | 基于任务的能力评估；框架综合 |
| Eleos AI | "福利实验室" | 模型福利部署前评估 |
| 人才管道（Talent pipeline） | "MATS -> 实验室" | MATS 毕业生流向 Anthropic、DM、OpenAI、Redwood、Apollo、METR |
| 外部评估（External evaluation） | "非实验室检查" | 不由模型生产者完成的评估；增加可信度 |

## 延伸阅读

- [MATS（ML Alignment & Theory Scholars）](https://www.matsprogram.org/) — 导师，计划
- [Redwood Research](https://www.redwoodresearch.org/) — AI 控制论文
- [Apollo Research](https://www.apolloresearch.ai/) — 谋划评估
- [METR — 前沿 AI 安全政策共同要素](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — 框架比较
- [Eleos AI Research](https://www.eleosai.org/research) — 模型福利方法论
