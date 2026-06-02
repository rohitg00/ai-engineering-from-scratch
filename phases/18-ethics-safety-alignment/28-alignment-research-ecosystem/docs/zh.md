# Alignment 研究生态 —— MATS、Redwood、Apollo、METR

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 五个组织定义了 2026 年非实验室 alignment（对齐）研究层。MATS（ML Alignment & Theory Scholars，机器学习对齐与理论学者）：自 2021 年末以来已有 527+ 名研究者、180+ 篇论文、10K+ 引用、h-index 47；2024 年夏季 cohort（队列）以 501(c)(3) 形式注册成立，约 90 名 scholar 与 40 名导师；2025 年前的校友中 80% 从事 safety/security 工作，200+ 进入 Anthropic、DeepMind、OpenAI、UK AISI、RAND、Redwood、METR、Apollo。Redwood Research：由 Buck Shlegeris 创立的应用 alignment 实验室；提出 AI Control（第 10 课）；与 UK AISI 合作研究 control safety case（控制安全论证）。Apollo Research：为前沿实验室做部署前 scheming（图谋）评估；撰写《In-Context Scheming》（第 8 课）与《Towards Safety Cases for AI Scheming》。METR（Model Evaluation and Threat Research，模型评估与威胁研究）：基于任务的能力评估、自主任务时间跨度（time-horizon）研究；《Common Elements of Frontier AI Safety Policies》对比各实验室框架。Eleos AI Research：模型 welfare（福祉）部署前评估（第 19 课）；执行了 Claude Opus 4 的 welfare 评估。

**Type:** Learn
**Languages:** none
**Prerequisites:** Phase 18 · 01-27（前置 Phase 18 课程）
**Time:** ~45 minutes

## 学习目标（Learning Objectives）

- 识别非实验室 alignment 研究生态的五个组织及其核心产出。
- 描述 MATS 的规模（scholar 数、论文数、h-index）以及它作为人才管道的角色。
- 描述 Redwood 的 AI Control 议程及其与 UK AISI 的合作。
- 描述 METR 基于任务的评估方法。

## 问题（The Problem）

前沿实验室（第 18 课）在内部做安全评估，并选择性地公开部分结果。实验室之外的生态才是评估被验证、新型失败模式被首次发现、人才被培养的地方。理解这个生态有助于判断哪些研究结论被谁信任。

## 概念（The Concept）

### MATS（ML Alignment & Theory Scholars）

始于 2021 年末。研究 mentorship（导师制）项目；scholar 与一位资深研究者花 10–12 周专攻一个具体的 alignment 问题。

规模（2026）：
- 自创立以来 527+ 研究者。
- 已发表 180+ 论文。
- 10K+ 引用。
- h-index 47。
- 2024 年夏：90 名 scholar + 40 名导师；注册为 501(c)(3)。

职业去向：2025 年前的校友约 80% 在做 safety/security。200+ 进入 Anthropic、DeepMind、OpenAI、UK AISI、RAND、Redwood、METR、Apollo。

### Redwood Research

应用 alignment 实验室。由 Buck Shlegeris 创立。提出 AI Control 议程（第 10 课）。与 UK AISI 合作研究 control safety case。为 DeepMind 与 Anthropic 的评估设计提供咨询。

代表论文：Greenblatt、Shlegeris 等，《AI Control》（arXiv:2312.06942，ICML 2024）；《Alignment Faking》（Greenblatt、Denison、Wright 等，arXiv:2412.14093，与 Anthropic 联合发表）。

风格：明确的威胁模型、最坏情况的对手、可压力测试的具体协议。

### Apollo Research

为前沿实验室做部署前 scheming 评估。撰写《In-Context Scheming》（第 8 课，arXiv:2412.04984）。2025 年与 OpenAI 在反 scheming 训练上合作。产出《Towards Safety Cases for AI Scheming》（2024）。

风格：在 agentic（具备 agent 能力的）场景里评估，欺骗行为可能在其中浮现；用三支柱拆解（misalignment 失对齐、goal-directedness 目标导向性、situational awareness 情境感知）。

### METR（Model Evaluation and Threat Research）

基于任务的能力评估。自主任务完成的时间跨度研究。《Common Elements of Frontier AI Safety Policies》（metr.org/common-elements，2025）对比各实验室框架。

与 Apollo 合作撰写 AI Scheming safety case 草图。

风格：长链路任务评估、实证能力测量、框架综述。

### Eleos AI Research

模型 welfare 部署前评估。执行了 system card 第 5.3 节记录的 Claude Opus 4 welfare 评估。为第 19 课中与 welfare 相关的论断提供外部方法学校验。

### 流向（The flow）

MATS 培养研究者。毕业生流向 Anthropic、DeepMind、OpenAI（实验室安全团队）或 Redwood、Apollo、METR、Eleos（外部评估）。外部评估方与实验室、UK AISI / CAISI 合作。出版物再回流到 MATS，喂给下一届 cohort。

### 这一层为什么重要（Why this layer matters）

单一来源的评估不可靠：实验室评估自家模型存在结构性利益冲突。外部评估方可以提出并验证实验室可能少报的失败模式。2024 年的《Sleeper Agents》（第 7 课）是 Anthropic + Redwood；《Alignment Faking》是 Anthropic + Redwood；《In-Context Scheming》是 Apollo；《Anti-Scheming》是 Apollo + OpenAI。多组织结构本身就是质控机制。

### 在 Phase 18 中的位置（Where this fits in Phase 18）

第 7–11 课引用 Redwood 和 Apollo 的工作；第 18 课引用 METR 的框架对比；第 19 课引用 Eleos。第 28 课是 Phase 余下部分所依赖之生态的显式组织地图。

## 用起来（Use It）

没有代码。读 METR 的《Common Elements of Frontier AI Safety Policies》，作为外部综述如何为实验室内部政策工作增值的一个例子。

## 上线部署（Ship It）

本课产出 `outputs/skill-ecosystem-map.md`。给定一个 alignment 论断或评估，它能识别出对应的组织、发表渠道、方法学风格，并与已知的对位组织交叉核验。

## 练习（Exercises）

1. 从第 7–15 课中挑一篇论文，识别参与的组织。把作者与 MATS 校友及当前生态归属做交叉核对。

2. 读 METR 的《Common Elements of Frontier AI Safety Policies》。指出他们强调的三处跨实验室趋同与两处最大分歧。

3. MATS 的职业去向有 ~80% 在 safety/security。论证这种筛选压力到底是自适应（在训练这个领域）还是偏倚（过滤掉了非主流立场）。

4. Redwood 与 Apollo 都做 control / scheming，但风格不同。挑一个失败模式，描述两家会如何分别调查它。

5. Eleos AI 是唯一纯做模型 welfare 的组织。设计一个假想的第二个组织，聚焦某个不同的 welfare 邻接问题（cognitive liberty 认知自由、robotic embodiment 机器人具身等），并阐述其方法学。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MATS | "the mentorship program" | ML Alignment & Theory Scholars；自 2021 年起 527+ 研究者 |
| Redwood Research | "the control lab" | 应用 alignment；AI Control 作者；UK AISI 合作方 |
| Apollo Research | "the scheming evals" | 为前沿实验室做部署前 scheming 评估 |
| METR | "the task-horizon evals" | 基于任务的能力评估；框架综述 |
| Eleos AI | "the welfare lab" | 模型 welfare 部署前评估 |
| Talent pipeline | "MATS -> labs" | MATS 毕业生流向 Anthropic、DM、OpenAI、Redwood、Apollo、METR |
| External evaluation | "non-lab check" | 不由模型生产者执行的评估；增加可信度 |

## 延伸阅读（Further Reading）

- [MATS (ML Alignment & Theory Scholars)](https://www.matsprogram.org/) —— mentorship 项目
- [Redwood Research](https://www.redwoodresearch.org/) —— AI Control 论文
- [Apollo Research](https://www.apolloresearch.ai/) —— scheming 评估
- [METR — Common Elements of Frontier AI Safety Policies](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) —— 框架对比
- [Eleos AI Research](https://www.eleosai.org/research) —— 模型 welfare 方法学
