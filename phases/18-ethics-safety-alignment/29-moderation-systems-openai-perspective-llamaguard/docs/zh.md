# 审核系统 — OpenAI、Perspective、Llama Guard

> 生产审核系统将第 12-16 课定义的安全策略操作化。OpenAI 审核 API：`omni-moderation-latest`（2024 年）基于 GPT-4o，在一次调用中对文本 + 图像进行分类；在多语言测试集上比前一版本好 42%；响应模式返回 13 个类别布尔值 — 骚扰、骚扰/威胁性、仇恨、仇恨/威胁性、非法、非法/暴力、自残、自残/意图、自残/说明、性、性/未成年人、暴力、暴力/图形；对大多数开发者免费。分层模式：输入审核（生成前）、输出审核（生成后）、自定义审核（领域规则）。异步并行调用隐藏延迟；标记时返回占位响应。Llama Guard 3/4（第 16 课）：14 个 MLCommons 危害、代码解释器滥用、8 种语言（v3）、多图像（v4）。Perspective API（Google Jigsaw）：早于 LLM 作为审核器浪潮的毒性评分；主要是一维毒性，带有严重毒性/侮辱/亵渎变体；内容审核研究的基线。弃用：Azure 内容审核器 2024 年 2 月弃用，2027 年 2 月退役，由 Azure AI 内容安全取代。

**类型：** 构建（Build）
**语言：** Python（标准库，三层审核框架/harness）
**前置要求：** 第 18 阶段 · 16（Llama Guard / Garak / PyRIT）
**时间：** 约 60 分钟

## 学习目标

- 描述 OpenAI 审核 API 的类别分类法，以及它与 Llama Guard 3 的 MLCommons 集合有何不同。
- 描述三层审核模式（输入、输出、自定义）并说出每种的一个失败模式。
- 描述 Perspective API 作为 LLM 前时代基线的定位，以及为什么它在研究中仍被使用。
- 陈述 Azure 弃用时间表。

## 问题背景

第 12-16 课描述了攻击和防御工具。第 29 课涵盖了在生产系统中操作化防御的已部署审核系统，位于用户接触产品的表面。三层模式是 2026 年的默认配置。

## 核心概念

### OpenAI 审核 API

`omni-moderation-latest`（2024 年）。基于 GPT-4o。在一次调用中对文本 + 图像进行分类。对大多数开发者免费。

类别（响应模式中的 13 个布尔值）：
- 骚扰（harassment）、骚扰/威胁性（harassment/threatening）
- 仇恨（hate）、仇恨/威胁性（hate/threatening）
- 自残（self-harm）、自残/意图（self-harm/intent）、自残/说明（self-harm/instructions）
- 性（sexual）、性/未成年人（sexual/minors）
- 暴力（violence）、暴力/图形（violence/graphic）
- 非法（illicit）、非法/暴力（illicit/violent）

多模态支持适用于 `violence`、`self-harm` 和 `sexual`，但不适用于 `sexual/minors`；其余仅限文本。

对于 `code/main.py` 中的代码框架，为了教学简化，我们将 `/threatening`、`/intent`、`/instructions` 和 `/graphic` 子类别折叠到其顶级父类别中。生产代码应使用完整的 13 类别模式。

在多语言测试集上比前一代审核端点好 42%。按类别评分；应用程序设置阈值。

### Llama Guard 3/4

在第 16 课中介绍。14 个 MLCommons 危害类别（组织方式与 OpenAI 的 13 个响应模式布尔值不同）。支持 8 种语言（v3）。Llama Guard 4（2025 年 4 月）原生多模态，12B。

OpenAI 和 Llama Guard 的分类法有重叠但也有分歧。OpenAI 将"非法"作为一个广泛类别；Llama Guard 分别设有"暴力犯罪"和"非暴力犯罪"。部署根据其与政策分类法的匹配度进行选择。

### Perspective API（Google Jigsaw）

早在 LLM 作为审核器浪潮之前（2020 年前）的毒性评分系统。类别：TOXICITY、SEVERE_TOXICITY、INSULT、PROFANITY、THREAT、IDENTITY_ATTACK。主要分数（TOXICITY）带子维度变体的一维评分。

作为内容审核研究基线被广泛使用，因为 API 稳定、有文档且有多年的校准数据。对于现代 LLM 相邻用例，Llama Guard 或 OpenAI 审核通常是更合适的选择。

### 三层模式

1. **输入审核。** 在生成前对用户提示进行分类。如果标记则拒绝。延迟：一次分类器调用。
2. **输出审核。** 在交付前对模型输出进行分类。如果标记则用拒绝替代。延迟：生成后一次分类器调用。
3. **自定义审核。** 领域特定规则（正则表达式、允许列表、商业政策）。在输入或输出时运行。

这三层按设计是顺序的：输入审核必须在生成前完成，输出审核在生成后运行。并行性适用于层内 — 对同一文本并发运行多个分类器（例如，OpenAI 审核 + Llama Guard + Perspective）可以隐藏每个分类器的延迟。作为一个可选优化，在输入审核完成且 token-1 流传输被延迟时，可以显示占位响应（"请稍候，正在检查..."）。标记行为是可配置的：拒绝、净化、上报至人工审核。

### 失败模式

- **仅输入。** 无法捕获输出幻觉（第 12-14 课编码攻击绕过输入分类器）。
- **仅输出。** 允许任何输入到达模型；增加成本；向攻击者暴露内部推理。
- **仅自定义。** 在各类别上不稳健；正则表达式是脆弱的。

分层是默认。双保险。

### Azure 弃用

Azure 内容审核器：2024 年 2 月弃用，2027 年 2 月退役。由基于 LLM 并与 Azure OpenAI 集成的 Azure AI 内容安全取代。迁移是 2024-2027 年 Azure 部署的现场级项目。

### 在本阶段中的位置

第 16 课涵盖了红队上下文中的审核工具。第 29 课涵盖已部署的审核。第 30 课以当前双用途能力证据作结。

## 实际使用

`code/main.py` 构建一个三层审核框架（harness）：输入审核器（关键词 + 类别评分）、输出审核器（对同一分类器在输出上运行）、自定义审核器（领域规则）。你可以通过运行输入并观察哪一层捕获了什么。

## 交付成果

本课产生 `outputs/skill-moderation-stack.md`。给定一个部署，它推荐审核堆栈配置：输入时使用哪个分类器，输出时使用哪个，哪些自定义规则，以及边缘情况的评判器。

## 练习

1. 运行 `code/main.py`。将良性、边界和有害输入通过所有三层。报告每层对每种输入触发的情况。

2. 使用特定类别的 Perspective-API 风格毒性评分扩展框架。将其阈值行为与该类别评分进行比较。

3. 阅读 OpenAI 审核 API 文档和 Llama Guard 3 类别列表。将每个 OpenAI 类别映射到最接近的 Llama Guard 类别。找出三个无法清晰映射的类别。

4. 为代码助手部署（例如 GitHub Copilot）设计一个审核堆栈。识别最相关和最不相关的类别，并提出自定义规则。

5. Azure 内容审核器于 2027 年 2 月退役。规划向 Azure AI 内容安全的迁移。找出迁移中风险最高的元素。

## 关键术语

| 术语 | 人们的提法 | 实际含义 |
|------|-----------|----------|
| OpenAI 审核（OpenAI Moderation） | "omni-moderation-latest" | 基于 GPT-4o 的 13 类别（文本）分类器，部分支持多模态 |
| Perspective API | "Google Jigsaw 毒性" | LLM 前时代的毒性评分基线 |
| Llama Guard | "MLCommons 14 类别" | Meta 的危害分类器（v3：8B 文本，8 种语言；v4：12B 多模态） |
| 输入审核（Input moderation） | "生成前过滤器" | 模型调用前对用户提示的分类器 |
| 输出审核（Output moderation） | "生成后过滤器" | 交付前对模型输出的分类器 |
| 自定义审核（Custom moderation） | "领域规则" | 部署特定规则（正则表达式、允许列表、政策） |
| 分层审核（Layered moderation） | "所有三层" | 标准生产部署模式 |

## 延伸阅读

- [OpenAI 审核 API 文档](https://platform.openai.com/docs/api-reference/moderations) — omni-moderation 端点
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) — Llama Guard 代码仓库
- [Google Jigsaw Perspective API](https://perspectiveapi.com/) — 毒性评分
- [Azure AI 内容安全](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) — Azure 替代品
