# 28 · 对齐研究生态系统——MATS、Redwood、Apollo、METR

> 五家组织定义了 2026 年的非实验室对齐研究层。MATS（ML Alignment & Theory Scholars，机器学习对齐与理论学者计划）：自 2021 年底以来 527+ 名研究者，180+ 篇论文，10K+ 引用，h 指数 47；2024 年夏季 cohort 注册为 501(c)(3)，约 90 名学者和 40 名导师；80% 的 2025 年前校友从事安全/安保工作，其中 200+ 人在 Anthropic、DeepMind、OpenAI、UK AISI、RAND、Redwood、METR、Apollo 任职。Redwood Research：由 Buck Shlegeris 创立的应用对齐实验室；提出了 AI 控制（AI Control，第 10 课）；与 UK AISI 合作进行控制安全案例研究。Apollo Research：为前沿实验室提供部署前密谋评估；撰写了《上下文内密谋》（In-Context Scheming，第 8 课）和《迈向 AI 密谋的安全案例》（Towards Safety Cases for AI Scheming）。METR（Model Evaluation and Threat Research，模型评估与威胁研究）：基于任务的能力评估，自主任务时间跨度研究；其《前沿 AI 安全政策的共同要素》（Common Elements of Frontier AI Safety Policies）比较了各实验室框架。Eleos AI Research：模型福祉（model-welfare）部署前评估（第 19 课）；实施了 Claude Opus 4 福祉评估。

**类型：** 学习
**语言：** 无
**前置：** 第 18 阶段 · 01-27（第 18 阶段前置课程）
**时长：** 约 45 分钟

## 学习目标

- 识别非实验室对齐研究生态系统中的五家组织及其核心产出。
- 描述 MATS 的规模（学者数量、论文数量、h 指数）及其作为人才输送渠道的角色。
- 描述 Redwood 的 AI 控制议程及其与 UK AISI 的合作。
- 描述 METR 的基于任务评估方法论。

## 问题

前沿实验室（第 18 课）在内部进行安全评估并发布选定结果。实验室之外的生态系统则是评估被验证、新失败模式首次被发现以及人才被培养的地方。理解这个生态系统有助于解读哪些研究发现被谁所信任。

## 概念

### MATS（ML Alignment & Theory Scholars，机器学习对齐与理论学者计划）

始于 2021 年底。研究导师计划；学者与一位资深研究者一起花 10-12 周攻克特定的对齐问题。

规模（2026）：
- 自成立以来 527+ 名研究者。
- 已发表 180+ 篇论文。
- 10K+ 引用。
- h 指数 47。
- 2024 年夏季：90 名学者 + 40 名导师；注册为 501(c)(3) 非营利组织。

职业成果：约 80% 的 2025 年前校友从事安全/安保工作。200+ 人在 Anthropic、DeepMind、OpenAI、UK AISI、RAND、Redwood、METR、Apollo 任职。

### Redwood Research

应用对齐实验室。由 Buck Shlegeris 创立。提出了 AI 控制议程（第 10 课）。与 UK AISI 合作进行控制安全案例研究。为 DeepMind 和 Anthropic 提供评估设计咨询。

经典论文：Greenblatt, Shlegeris 等，《AI 控制》（AI Control，arXiv:2312.06942，ICML 2024）；《对齐伪装》（Alignment Faking，Greenblatt, Denison, Wright 等，arXiv:2412.14093，与 Anthropic 联合发表）。

风格：具体的威胁模型，最坏情况对手，可进行压力测试的切实协议。

### Apollo Research

为前沿实验室提供部署前密谋评估。撰写了《上下文内密谋》（第 8 课，arXiv:2412.04984）。参与 2025 年 OpenAI 反密谋训练合作。产出《迈向 AI 密谋的安全案例》（2024）。

风格：在智能体设定中评估欺骗行为的涌现；三元分解（失调（misalignment）、目标导向性（goal-directedness）、情境感知（situational awareness））。

### METR（Model Evaluation and Threat Research，模型评估与威胁研究）

基于任务的能力评估。自主任务完成时间跨度研究。《前沿 AI 安全政策的共同要素》（metr.org/common-elements，2025）比较了各实验室框架。

与 Apollo 合作撰写 AI 密谋安全案例草稿。

风格：长跨度任务评估，经验性能力测量，框架综合。

### Eleos AI Research

模型福祉部署前评估。实施了 Claude Opus 4 福祉评估，记录在系统卡的第 5.3 节。为第 19 课的福祉相关声明提供外部方法论检查。

### 人才流动

MATS 培训研究者。毕业生流向 Anthropic、DeepMind、OpenAI（实验室安全团队）或 Redwood、Apollo、METR、Eleos（外部评估）。外部评估者与实验室以及 UK AISI / CAISI 合作。出版物反馈给生态系统，供 MATS 下一期使用。

### 为什么这一层至关重要

单方面评估不可靠：实验室评估自己的模型存在结构性利益冲突。外部评估者可以指出并验证实验室可能低报的失败模式。2024 年的《休眠智能体》（Sleeper Agents）论文（第 7 课）是 Anthropic + Redwood；《对齐伪装》是 Anthropic + Redwood；《上下文内密谋》是 Apollo；《反密谋》（Anti-Scheming）是 Apollo + OpenAI。多组织结构本身就是质量控制。

### 在第 18 阶段中的定位

第 7-11 课引用了 Redwood 和 Apollo 的工作；第 18 课引用了 METR 的框架比较；第 19 课引用了 Eleos。第 28 课是显式的组织地图，本阶段其余内容都依赖于此。

## 实践

无代码。阅读 METR 的《前沿 AI 安全政策的共同要素》，作为外部综合如何为实验室内部政策工作增加价值的示例。

## 产出

本课产生 `outputs/skill-ecosystem-map.md`。给定一个对齐声明或评估，它识别出组织、发表渠道和方法论风格，并与已知的对等组织进行交叉核对。

## 练习

1. 从第 7-15 课中选一篇论文，识别参与的组织。将作者与 MATS 校友和当前生态系统归属进行交叉核对。

2. 阅读 METR 的《前沿 AI 安全政策的共同要素》。识别他们强调的三个跨实验室趋同点和两个最大分歧点。

3. MATS 的职业成果约 80% 在安全/安保领域。论述这种选择压力是适应性的（培养该领域）还是有偏见的（过滤掉异端立场）。

4. Redwood 和 Apollo 都从事控制/密谋工作，但风格不同。选择一个失败模式，描述每个组织会如何调查它。

5. Eleos AI 是唯一专注于模型福祉的组织。设计一个假设性的第二个组织，专注于不同的福祉相关问题（认知自由、机器人具身等），并阐明其方法论。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|----------|
| MATS | "那个导师计划" | ML Alignment & Theory Scholars；自 2021 年以来 527+ 名研究者 |
| Redwood Research | "那个控制实验室" | 应用对齐；AI Control 作者；UK AISI 合作伙伴 |
| Apollo Research | "那个密谋评估机构" | 为前沿实验室做部署前密谋评估 |
| METR | "那个任务跨度评估机构" | 基于任务的能力评估；框架综合 |
| Eleos AI | "那个福祉实验室" | 模型福祉部署前评估 |
| 人才输送渠道 | "MATS → 实验室" | MATS 毕业生流向 Anthropic、DM、OpenAI、Redwood、Apollo、METR |
| 外部评估 | "非实验室核查" | 不由模型生产者进行的评估；增加可信度 |

## 延伸阅读

- [MATS（ML Alignment & Theory Scholars）](https://www.matsprogram.org/) — 导师计划
- [Redwood Research](https://www.redwoodresearch.org/) — AI 控制论文
- [Apollo Research](https://www.apolloresearch.ai/) — 密谋评估
- [METR — 前沿 AI 安全政策的共同要素](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — 框架比较
- [Eleos AI Research](https://www.eleosai.org/research) — 模型福祉方法论
