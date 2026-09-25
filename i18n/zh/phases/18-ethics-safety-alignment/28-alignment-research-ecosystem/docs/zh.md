# 对齐研究生态——MATS、Redwood、Apollo、METR

> 五家机构定义了2026年实验室外的对齐研究层。MATS（ML Alignment & Theory Scholars）：自2021年末以来培养了527+名研究人员，发表180+篇论文，获得10K+引用，h指数47；2024年夏季批次以501(c)(3)形式注册成立，拥有约90名学员和40名导师；2025年之前的校友中约80%从事安全/安保工作，其中200+人就职于Anthropic、DeepMind、OpenAI、UK AISI、RAND、Redwood、METR、Apollo。Redwood Research：由Buck Shlegeris创立的应用对齐实验室；提出了AI Control（第10课）；与UK AISI合作开展控制安全案例。Apollo Research：为前沿实验室提供部署前scheming评估；撰写了In-Context Scheming（第8课）和Towards Safety Cases for AI Scheming。METR（Model Evaluation and Threat Research）：基于任务的能力评估、自主任务时间跨度研究；“前沿AI安全政策的共同要素”对各实验室框架进行了比较。Eleos AI Research：模型福利部署前评估（第19课）；开展了Claude Opus 4福利评估。

**Type:** Learn
**Languages:** none
**Prerequisites:** Phase 18 · 01-27（第18课的先行课程）
**Time:** 约45分钟

## 学习目标

- 识别实验室外对齐研究生态的五家机构及其核心产出。
- 描述MATS的规模（学员、论文、h指数）及其作为人才管道的角色。
- 描述Redwood的AI Control议程及其与UK AISI的合作。
- 描述METR基于任务的评估方法。

## 问题

前沿实验室（第18课）在内部进行安全评估并发布选定的结果。实验室外的生态是评估得到验证的地方，是新型失效模式被首次发现的地方，也是人才培养的地方。理解这一生态有助于判断哪些研究发现被谁所信任。

## 概念

### MATS（ML Alignment & Theory Scholars）

创立于2021年末。研究导师制项目；学员跟随一位资深研究人员，在某个特定对齐问题上投入10-12周。

规模（2026年）：
- 自创立以来527+名研究人员。
- 发表180+篇论文。
- 10K+引用。
- h指数47。
- 2024年夏季：90名学员 + 40名导师；以501(c)(3)形式注册成立。

职业去向：2025年之前的校友中约80%从事安全/安保工作。200+人就职于Anthropic、DeepMind、OpenAI、UK AISI、RAND、Redwood、METR、Apollo。

### Redwood Research

应用对齐实验室。由Buck Shlegeris创立。提出了AI Control议程（第10课）。与UK AISI合作开展控制安全案例。为DeepMind和Anthropic提供评估设计方面的建议。

代表性论文：Greenblatt、Shlegeris等，“AI Control”（arXiv:2312.06942，ICML 2024）；Alignment Faking（Greenblatt、Denison、Wright等，arXiv:2412.14093，与Anthropic合作）。

风格：具体的威胁模型、最坏情况的对抗者、可被压力测试的具体协议。

### Apollo Research

为前沿实验室提供部署前scheming评估。撰写了In-Context Scheming（第8课，arXiv:2412.04984）。是2025年OpenAI反scheming训练合作的参与方。产出Towards Safety Cases for AI Scheming（2024）。

风格：在智能体环境中评估欺骗可能涌现的情形；三支柱分解（失对齐、目标导向性、情境感知）。

### METR（Model Evaluation and Threat Research）

基于任务的能力评估。自主任务完成时间跨度研究。“前沿AI安全政策的共同要素”（metr.org/common-elements，2025）对各实验室框架进行了比较。

与Apollo共同撰写AI Scheming安全案例草案。

风格：长时程任务评估、实证能力测量、框架综合。

### Eleos AI Research

模型福利部署前评估。开展了系统卡片5.3节中记录的Claude Opus 4福利评估。为第19课的福利相关主张提供外部方法学校验。

### 流动关系

MATS培养研究人员。毕业生进入Anthropic、DeepMind、OpenAI（实验室安全团队）或Redwood、Apollo、METR、Eleos（外部评估）。外部评估者与实验室以及UK AISI / CAISI合作。论文产出回馈生态，输送给MATS的下一批学员。

### 为什么这一层很重要

单一来源的评估不可靠：实验室评估自己的模型存在结构性利益冲突。外部评估者可以发现并验证实验室可能少报的失效模式。2024年的Sleeper Agents论文（第7课）由Anthropic + Redwood完成；Alignment Faking由Anthropic + Redwood完成；In-Context Scheming由Apollo完成；Anti-Scheming由Apollo + OpenAI完成。多机构结构就是质量控制。

### 它在Phase 18中的位置

第7-11课引用了Redwood和Apollo的工作；第18课引用了METR的框架比较；第19课引用了Eleos。第28课是对本Phase其余课程所依赖的生态的显式组织图谱。

```figure
sae-features
```

## 使用它

无需代码。阅读METR的“前沿AI安全政策的共同要素”，作为外部综合如何为实验室内部政策工作增值的一个示例。

## 交付它

本课产出 `outputs/skill-ecosystem-map.md`。给定一个对齐主张或评估，它识别相关机构、发表渠道和方法学风格，并与已知的对应机构进行交叉核对。

## 练习

1. 从第7-15课中选取一篇论文，识别所涉及的机构。将作者与MATS校友及当前生态所属机构进行交叉核对。

2. 阅读METR的“前沿AI安全政策的共同要素”。识别他们强调的三个跨实验室趋同点和两个最大的分歧点。

3. MATS的职业去向约80%是安全/安保。论证这种选择压力是适应性的（培养该领域）还是偏向性的（过滤掉非主流立场）。

4. Redwood和Apollo都从事控制/scheming工作，但风格不同。选择一种失效模式，描述两者各自会如何研究它。

5. Eleos AI是唯一纯粹专注于模型福利的机构。设计一个假想的第二家机构，专注于另一个与福利相关的问题（认知自由、机器人具身等），并阐述其方法学。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| MATS | “导师制项目” | ML Alignment & Theory Scholars；自2021年以来527+名研究人员 |
| Redwood Research | “控制实验室” | 应用对齐；AI Control作者；UK AISI合作方 |
| Apollo Research | “scheming评估” | 为前沿实验室提供部署前scheming评估 |
| METR | “任务时间跨度评估” | 基于任务的能力评估；框架综合 |
| Eleos AI | “福利实验室” | 模型福利部署前评估 |
| 人才管道 | “MATS -> 实验室” | MATS毕业生流向Anthropic、DM、OpenAI、Redwood、Apollo、METR |
| 外部评估 | “实验室外核查” | 非由模型生产方进行的评估；增加可信度 |

## 延伸阅读

- [MATS (ML Alignment & Theory Scholars)](https://www.matsprogram.org/) — 导师制项目
- [Redwood Research](https://www.redwoodresearch.org/) — AI Control论文
- [Apollo Research](https://www.apolloresearch.ai/) — scheming评估
- [METR — 前沿AI安全政策的共同要素](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — 框架比较
- [Eleos AI Research](https://www.eleosai.org/research) — 模型福利方法学