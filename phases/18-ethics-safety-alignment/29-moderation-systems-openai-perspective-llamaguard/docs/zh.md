# 审核系统 —— OpenAI、Perspective、Llama Guard

> 生产审核系统将第 12-16 课中定义的安全策略操作化。OpenAI Moderation API：`omni-moderation-latest`（2024）基于 GPT-4o 在一次调用中对文本 + 图像进行分类；在多语言测试集上比先前版本好 42%；响应模式返回 13 个类别布尔值 —— 骚扰、骚扰/威胁、仇恨、仇恨/威胁、非法、非法/暴力、自残、自残/意图、自残/说明、性、性/未成年人、暴力、暴力/图形；对大多数开发者免费。分层模式：输入审核（生成前）、输出审核（生成后）、自定义审核（领域规则）。异步并行调用隐藏延迟；标记时的占位响应。Llama Guard 3/4（第 16 课）：14 个 MLCommons 危害、代码解释器滥用、8 种语言（v3）、多图像（v4）。Perspective API（Google Jigsaw）：毒性评分早于 LLM 作为审核员的浪潮；主要是单维度毒性，带有严重毒性/侮辱/亵渎变体；内容审核研究的基线。弃用：Azure Content Moderator 于 2024 年 2 月弃用，2027 年 2 月停用，由 Azure AI Content Safety 取代。

**类型：** 构建
**语言：** Python（标准库，三层审核工具）
**先决条件：** Phase 18 · 16（Llama Guard / Garak / PyRIT）
**时间：** ~60 分钟

## 学习目标

- 描述 OpenAI Moderation API 的类别分类法以及它与 Llama Guard 3 的 MLCommons 集合有何不同。
- 描述三层审核模式（输入、输出、自定义）并说出每层的一个失败模式。
- 描述 Perspective API 作为前 LLM 时代基线的位置以及为什么它在研究中仍被使用。
- 说明 Azure 弃用时间表。

## 问题

第 12-16 课描述攻击和防御工具。第 29 课涵盖在用户接触产品的表面操作化防御的部署审核系统。三层模式是 2026 年的默认配置。

## 概念

### OpenAI Moderation API

`omni-moderation-latest`（2024）。基于 GPT-4o。在一次调用中对文本 + 图像进行分类。对大多数开发者免费。

类别（响应模式中的 13 个布尔值）：
- 骚扰、骚扰/威胁
- 仇恨、仇恨/威胁
- 自残、自残/意图、自残/说明
- 性、性/未成年人
- 暴力、暴力/图形
- 非法、非法/暴力

多模态支持适用于 `暴力`、`自残` 和 `性` 但不适用于 `性/未成年人`；其余的是仅文本。

对于 `code/main.py` 中的代码工具，我们将 `/威胁`、`/意图`、`/说明` 和 `/图形` 子类别折叠到其顶级父类别中，以简化教学。生产代码应使用完整的 13 类别模式。

在多语言测试集上比先前一代审核端点好 42%。每个类别的分数；应用程序设置阈值。

### Llama Guard 3/4

第 16 课涵盖。14 个 MLCommons 危害类别（与 OpenAI 的 13 个响应模式布尔值组织不同）。支持 8 种语言（v3）。Llama Guard 4（2025 年 4 月）是原生多模态，12B。

OpenAI 和 Llama Guard 分类法重叠但分歧。OpenAI 有"非法"作为广泛类别；Llama Guard 有"暴力犯罪"和"非暴力犯罪"分开。部署根据他们的策略分类法匹配选择。

### Perspective API（Google Jigsaw）

早于 LLM 作为审核员浪潮（2020 年前）的毒性评分系统。类别：TOXICITY、SEVERE_TOXICITY、INSULT、PROFANITY、THREAT、IDENTITY_ATTACK。单维度主要分数（TOXICITY）带有子维度变体。

广泛用作内容审核研究基线，因为 API 稳定、有文档记录，并有多年校准数据。对于现代 LLM 相邻用例，Llama Guard 或 OpenAI Moderation 通常是更好的选择。

### 三层模式

1. **输入审核。** 在生成前对用户提示进行分类。如果标记则拒绝。延迟：一次分类器调用。
2. **输出审核。** 在交付前对模型输出进行分类。如果标记则替换为拒绝。延迟：生成后一次分类器调用。
3. **自定义审核。** 领域特定规则（正则表达式、允许列表、业务策略）。在输入或输出时运行。

三层按设计是顺序的：输入审核必须在生成前完成，输出审核在生成后运行。并行性适用于层内——在同一文本上运行多个分类器（例如，OpenAI Moderation + Llama Guard + Perspective）并发隐藏每个分类器的延迟。作为可选优化，可以在输入审核完成和 token-1 流式传输被推迟时显示占位响应（"稍等，正在检查..."）。标记行为可配置：拒绝、清理、升级给人工审核。

### 失败模式

- **仅输入。** 不捕获输出幻觉（第 12-14 课编码攻击绕过输入分类器）。
- **仅输出。** 允许任何输入到达模型；增加成本；向攻击者暴露内部推理。
- **仅自定义。** 跨类别不稳健；正则表达式脆弱。

分层是默认的。双重保险。

### Azure 弃用

Azure Content Moderator：2024 年 2 月弃用，2027 年 2 月停用。由 Azure AI Content Safety 取代，后者基于 LLM 并与 Azure OpenAI 集成。迁移是 2024-2027 年 Azure 部署的字段级项目。

### 这在 Phase 18 中的位置

第 16 课涵盖红队背景下的审核工具。第 29 课涵盖部署审核。第 30 课以当前双重用途能力证据结束。

## 使用它

`code/main.py` 构建一个三层审核工具：输入审核员（关键词 + 类别分数）、输出审核员（输出上的相同分类器）、自定义审核员（领域规则）。你可以运行输入并观察哪层捕获什么。

## 交付它

本课产生 `outputs/skill-moderation-stack.md`。给定部署，它推荐审核堆栈配置：输入时使用哪个分类器、输出时使用哪个、哪些自定义规则以及边缘情况的评判者。

## 练习

1. 运行 `code/main.py`。通过所有三层运行良性、边缘和有害输入。报告每层为每个触发的内容。

2. 用特定类别的 Perspective-API 风格毒性评分扩展工具。将其阈值行为与类别分数进行比较。

3. 阅读 OpenAI Moderation API 文档和 Llama Guard 3 类别列表。将每个 OpenAI 类别映射到最接近的 Llama Guard 类别。识别三个不能干净映射的类别。

4. 为代码助手部署（例如，GitHub Copilot）设计审核堆栈。识别最相关和最不相关的类别，并提出自定义规则。

5. Azure Content Moderator 于 2027 年 2 月停用。计划迁移到 Azure AI Content Safety。识别迁移中风险最高的元素。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| OpenAI Moderation | "omni-moderation-latest" | 基于 GPT-4o 的 13 类别（文本）分类器，部分多模态支持 |
| Perspective API | "Google Jigsaw 毒性" | 前 LLM 时代毒性评分基线 |
| Llama Guard | "MLCommons 14 类别" | Meta 的危害分类器（v3：8B 文本，8 种语言；v4：12B 多模态） |
| 输入审核 | "生成前过滤器" | 模型调用前对用户提示的分类器 |
| 输出审核 | "生成后过滤器" | 交付前对模型输出的分类器 |
| 自定义审核 | "领域规则" | 部署特定规则（正则表达式、允许列表、策略） |
| 分层审核 | "所有三层" | 标准生产部署模式 |

## 延伸阅读

- [OpenAI Moderation API 文档](https://platform.openai.com/docs/api-reference/moderations) — omni-moderation 端点
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) — Llama Guard 仓库
- [Google Jigsaw Perspective API](https://perspectiveapi.com/) — 毒性评分
- [Azure AI Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) — Azure 替代品
