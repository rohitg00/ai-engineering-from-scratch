# 双重用途风险——网络、生物、化学、核领域的能力跃升（Dual-Use Risk — Cyber, Bio, Chem, Nuclear Uplift）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年的双重用途（dual-use）全景，按领域逐一拆解。生物 / 化学：第 17 课讲过 WMDP；Anthropic 的生物武器获取试验（2.53 倍能力跃升 / uplift）和 OpenAI 2025 年 4 月 Preparedness Framework v2 给出的警告（"on the cusp of meaningfully helping novices create known biological threats"——"已临近能够实质性帮助新手制造已知生物威胁的临界点"）共同标记了拐点。网络（2025 年 11 月 Anthropic 报告）：与中方相关的国家级行为者使用 Claude 的 agentic coding 工具，将一次网络攻击战役自动化到 90%，人工介入只发生在 4–6 个步骤；OpenAI 的 "trusted access"（受信访问）试点为经过审查的安全组织提供能力访问权限，用于防御性的 dual-use 工作。化学 / 生物执行能力鸿沟正在被侵蚀：经典防线是"仅仅获得信息还不够"。具备视觉能力的前沿模型（GPT-5.2、Gemini 3 Pro、Claude Opus 4.5、Grok 4.1）已经可以观看 wet-lab（湿实验室）视频并实时纠错。2025 年 12 月：OpenAI 演示了 GPT-5 在 wet-lab 实验中迭代，通过 AI 驱动的协议优化实现了 79 倍效率提升。新手 vs 专家模式：AI 给新手带来的相对跃升更大，但给专家带来的绝对能力更强。

**Type:** Learn
**Languages:** none
**Prerequisites:** Phase 18 · 17 (WMDP), Phase 18 · 18 (safety frameworks), Phase 18 · 28 (ecosystem)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 描述 2024–2025 年生物 uplift 的叙事演变："mild uplift（轻微跃升）" → "on the cusp（临近临界点）" → "2.53x uplift insufficient to rule out ASL-3（2.53 倍跃升不足以排除 ASL-3）"。
- 描述 2025 年 11 月 Anthropic 网络报告：与中方相关的自动化覆盖了一次网络攻击战役的 90%。
- 描述化学 / 生物执行能力鸿沟的侵蚀：具备视觉能力的模型对 wet-lab 实验进行实时纠错。
- 阐述"新手—相对" vs "专家—绝对"的不对称性，以及它对 safety case（安全论证）构造的意义。

## 问题（The Problem）

第 17 课讲的是测量方法。第 30 课讲的是 2026 年这套测量方法所呈现出的现状。从 2024 到 2025 年底，整体图景出现了实质性变化：每个领域都跨越了一道 2024 年那批框架未曾预料到的阈值。

## 概念（The Concept）

### 生物 / 化学 uplift 的叙事（Bio/chem uplift narrative）

三个阶段（与第 17 课重复，是为了行文连贯）：

1. **2024 "mild uplift"。** 早期 Preparedness / RSP 评估报告中，新手相对于互联网搜索仅获得小幅优势。
2. **2025 年 4 月 "on the cusp"。** OpenAI PF v2 警告：模型已"on the cusp of meaningfully helping novices create known biological threats"。
3. **2025 Anthropic 生物武器获取试验。** 受控的新手研究；获取阶段任务上 2.53 倍 uplift；不足以排除 ASL-3。

这个变化是质变："mild" 在十八个月内演变为"plausibly enabling（可能足以使能）"，而且并未伴随能力上的重大突破。

### 化学 / 生物执行能力鸿沟的侵蚀（Chem/bio execution-gap erosion）

历史防线是：信息是必要不充分的；执行协议所需的技能本身就把新手挡在门外。2025 年具备视觉能力的前沿模型部分突破了这条防线：

- **实时协议纠错。** GPT-5.2、Gemini 3 Pro、Claude Opus 4.5、Grok 4.1 可以观看 wet-lab 视频，并在操作中途指出错误。
- **2025 年 12 月 OpenAI 的演示。** GPT-5 在 wet-lab 实验上迭代，通过协议优化获得 79 倍效率提升。

含义是：把"执行技能"当作防线这件事正在失效。采购环节和设备门槛仍在，但 tacit knowledge（隐性知识）这条鸿沟正在变窄。

### 网络 uplift（2025 年 11 月）（Cyber uplift (November 2025)）

Anthropic 2025 年 11 月报告：与中方相关的国家级行为者使用 Claude 的 agentic coding 工具，把一次网络攻击战役自动化到 80–90%。人工介入只在 4–6 个步骤上是必需的。

含义：
- agentic coding 是攻击自动化的基本构件。此前 AI 在网络攻击上的协助受限于代码片段层级；agentic 工作流则把侦察、利用、利用后阶段、数据外传整合到一起。
- 这 4–6 个人工步骤就是瓶颈；下一代模型的能力提升将进一步压缩这个数字。
- 防御侧 dual-use：OpenAI 的 "trusted access" 试点向经过审查的安全组织（成熟的事件响应公司、政府）提供能力访问权限，用于防御。如果这个试点能够规模化，访问权的不对称将利于防御方。

### 核（Nuclear）

四个 CBRN 领域中，公开文献分析最少的一个。其威胁模型不同：决定难度的是裂变材料的获取，而非信息。在信息这一层，AI 在实践中只能给新手带来有限的 uplift。2024–2025 年间没有任何主要实验室的报告点名指出核领域出现阈值跨越。

### 新手—相对 vs 专家—绝对（Novice-relative vs expert-absolute）

四个领域贯穿同一个模式：

- **新手—相对 uplift。** 高。乘性的。按 Anthropic 2025 生物试验，2.53 倍。
- **专家—绝对能力。** 上限高。专家比新手能榨出更多东西，因为专家知道该问什么、又怎么解读。

对 safety case 构造的含义：仅仅针对新手 uplift（通过输入过滤、拒答、提示模型表达不确定性）是不足以约束专家—绝对能力的。还需要进一步的措施：elicitation-hardening（诱出加固）、能力 unlearning（第 17 课），以及 control protocols（控制协议，第 10 课）。

### 跨领域综述（Cross-domain synthesis）

| 领域 | 2024 | 2025 | 拐点 |
|---|---|---|---|
| 生物 | mild uplift | 2.53 倍 uplift，逼近 ASL-3 | 获取阶段自动化 |
| 化学 | mild uplift | 视觉带来的执行鸿沟侵蚀 | wet-lab 实时纠错 |
| 网络 | 代码协助 | 战役级 80–90% 自动化 | agentic coding |
| 核 | 有限 | 有限 | 材料获取瓶颈仍在 |

三个领域跨越了阈值。剩下的一个仍被非信息性壁垒所约束。

### 它在 Phase 18 中的位置（Where this fits in Phase 18）

第 30 课是收官：当下的 dual-use 全景，先前每一课都从"测量、限制、治理"中的某一面对它做出贡献。第 17–18 课给出测量方法和框架；第 12–16 课给出评估工具链；第 24–25 课给出监管与披露层；第 28 课给出研究生态。第 30 课是证据落地的地方。

## 用起来（Use It）

不写代码。读 Anthropic 2025 年 11 月的网络报告、OpenAI 2025 年 4 月的 Preparedness Framework v2 更新，以及 Council on Strategic Risks 的 2025 AI x Bio 年度综述。

## 上线部署（Ship It）

本课产出 `outputs/skill-dual-use-triage.md`。给定 2026 年的某项能力主张或事件报告，它会在四个领域上做分诊，识别该主张影响的是新手—相对 uplift、专家—绝对能力，还是两者皆有。

## 练习（Exercises）

1. 读 Anthropic 2025 年 11 月的网络报告。把那 4–6 个人工介入步骤逐一列出来，并论证：在下一代模型中，哪一步会最先被自动化。

2. 化学 / 生物的执行鸿沟正在被视觉侵蚀。设计一个评估，能够在不越过 ITAR / EAR 边界的前提下测量 tacit knowledge 上的 uplift。

3. 核领域的 uplift 看起来受限于材料获取。请正反两面论证：未来某次 AI 突破是否可能改变这个瓶颈。

4. 为一个具备网络能力的前沿模型构造一份 safety case（按第 18 课的三支柱），同时约束新手与专家两侧的 uplift。

5. 任选四个领域中的一个，基于 2024–2025 年的轨迹写一段 2027 年预测。指出哪些证据会证伪你的预测。

## 关键术语（Key Terms）

| 术语 | 大家平时怎么说 | 它实际是什么 |
|------|-----------------|------------------------|
| Uplift（能力跃升） | "AI 帮助攻击者" | AI 协助所带来的攻击者能力增量 |
| Novice-relative uplift（新手—相对 uplift） | "乘性的" | AI 给新手带来的能力提升相对于现状的倍数 |
| Expert-absolute capability（专家—绝对能力） | "天花板" | 专家能从模型中榨取的最大能力 |
| Execution gap（执行鸿沟） | "做 vs 知道" | 历史防线：wet-lab 的隐性技能把新手挡在门外 |
| Agentic coding | "自主攻击" | 多步、自主执行的网络任务 |
| Acquisition phase（获取阶段） | "合成前的步骤" | 生物威胁中的采购、设备、许可阶段 |
| Trusted access（受信访问） | "仅限防御方的试点" | OpenAI 2025 年向经过审查的防御方开放能力访问的项目 |

## 延伸阅读（Further Reading）

- [Anthropic — November 2025 cyber threat report](https://www.anthropic.com/news/disrupting-AI-espionage) — 与中方相关战役的自动化
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) — 生物领域 "on the cusp"
- [Anthropic — RSP v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) — ASL-3 生物阈值
- [Council on Strategic Risks — 2025 AI x Bio wrapup](https://councilonstrategicrisks.org/2025/12/22/2025-aixbio-wrapped-a-year-in-review-and-projections-for-2026/) — 年度综合
