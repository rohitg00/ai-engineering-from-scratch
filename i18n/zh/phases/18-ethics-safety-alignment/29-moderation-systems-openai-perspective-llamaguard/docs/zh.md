# 审核系统 — OpenAI、Perspective、Llama Guard

> 生产级审核系统将第 12-16 课中定义的安全策略落地实施。OpenAI Moderation API：`omni-moderation-latest`（2024）基于 GPT-4o，可在一次调用中对文本和图像进行分类；在多语言测试集上比前一版本提升 42%；响应 schema 返回 13 个类别布尔值——骚扰、骚扰/威胁、仇恨、仇恨/威胁、非法、非法/暴力、自残、自残/意图、自残/方法、性相关、性相关/未成年人、暴力、暴力/血腥；对大多数开发者免费。分层模式：输入审核（生成前）、输出审核（生成后）、自定义审核（领域规则）。异步并行调用可隐藏延迟；被标记时返回占位响应。Llama Guard 3/4（第 16 课）：14 个 MLCommons 危害类别、Code Interpreter 滥用、8 种语言（v3）、多图像（v4）。Perspective API（Google Jigsaw）：早于 LLM-as-moderator 浪潮的毒性评分系统；主要提供单维度毒性评分，并有严重毒性/侮辱/亵渎等变体；是内容审核研究的基线。弃用情况：Azure Content Moderator 于 2024 年 2 月弃用，2027 年 2 月退役，由 Azure AI Content Safety 取代。

**Type:** Build
**Languages:** Python（标准库，三层审核框架）
**Prerequisites:** 阶段 18 · 16（Llama Guard / Garak / PyRIT）
**Time:** 约 60 分钟

## 学习目标

- 描述 OpenAI Moderation API 的类别体系，以及它与 Llama Guard 3 的 MLCommons 类别集的差异。
- 描述三层审核模式（输入、输出、自定义），并说出每一层的一个失效模式。
- 描述 Perspective API 作为 LLM 时代之前基线的定位，以及它为何仍在研究中被使用。
- 说明 Azure 的弃用时间线。

## 问题背景

第 12-16 课介绍了攻击与防御工具。第 29 课介绍在用户接触产品的表层将防御落地实施的部署级审核系统。三层模式是 2026 年的默认配置。

## 核心概念

### OpenAI Moderation API

`omni-moderation-latest`（2024）。基于 GPT-4o 构建。可在一次调用中对文本和图像进行分类。对大多数开发者免费。

类别（响应 schema 中的 13 个布尔值）：
- harassment、harassment/threatening
- hate、hate/threatening
- self-harm、self-harm/intent、self-harm/instructions
- sexual、sexual/minors
- violence、violence/graphic
- illicit、illicit/violent

多模态支持适用于 `violence`、`self-harm` 和 `sexual`，但不适用于 `sexual/minors`；其余类别仅支持文本。

在 `code/main.py` 的代码框架中，为了教学简洁，我们将 `/threatening`、`/intent`、`/instructions` 和 `/graphic` 子类别归并到其对应的一级父类别。生产代码应使用完整的 13 类别 schema。

在多语言测试集上比上一代审核端点提升 42%。按类别给出分数；由应用自行设定阈值。

### Llama Guard 3/4

已在第 16 课介绍。14 个 MLCommons 危害类别（组织方式不同于 OpenAI 的 13 个响应 schema 布尔值）。支持 8 种语言（v3）。Llama Guard 4（2025 年 4 月）原生支持多模态，12B 参数。

OpenAI 与 Llama Guard 的类别体系有重叠但不一致。OpenAI 将“illicit（非法）”作为一个宽泛类别；Llama Guard 则区分“violent crimes（暴力犯罪）”和“non-violent crimes（非暴力犯罪）”。部署时依据策略体系的匹配程度进行选择。

### Perspective API（Google Jigsaw）

毒性评分系统，早于 LLM-as-moderator 浪潮（2020 年之前）。类别：TOXICITY、SEVERE_TOXICITY、INSULT、PROFANITY、THREAT、IDENTITY_ATTACK。以单维度主评分（TOXICITY）为主，并配有子维度变体。

由于该 API 稳定、文档完善，并拥有多年校准数据，因此被广泛用作内容审核研究基线。对于现代 LLM 相关的使用场景，Llama Guard 或 OpenAI Moderation 通常是更合适的选择。

### 三层模式

1. **输入审核。** 在生成前对用户提示词进行分类。被标记则拒绝。延迟：一次分类器调用。
2. **输出审核。** 在交付前对模型输出进行分类。被标记则替换为拒绝回复。延迟：生成后的一次分类器调用。
3. **自定义审核。** 领域特定规则（正则表达式、白名单、业务策略）。可在输入或输出端运行。

这三层在设计上是顺序执行的：输入审核必须在生成前完成，输出审核在生成后运行。并行化适用于层内部——在同一文本上并发运行多个分类器（例如 OpenAI Moderation + Llama Guard + Perspective）可隐藏单个分类器的延迟。作为可选优化，在输入审核完成期间可显示占位响应（“请稍候，正在检查……”）并推迟首 token 流式输出。标记后的处理方式可配置：拒绝、净化、升级至人工审核。

### 失效模式

- **仅输入层。** 无法捕获输出中的幻觉（第 12-14 课的编码攻击可绕过输入分类器）。
- **仅输出层。** 任何输入都能到达模型；增加成本；将内部推理暴露给攻击者。
- **仅自定义层。** 跨类别不够稳健；正则表达式脆弱。

分层是默认做法。多重保险。

### Azure 弃用

Azure Content Moderator：2024 年 2 月弃用，2027 年 2 月退役。由 Azure AI Content Safety 取代，后者基于 LLM 并与 Azure OpenAI 集成。对于 Azure 部署而言，迁移是 2024-2027 年间的实操层面项目。

### 在阶段 18 中的位置

第 16 课在红队测试背景下介绍审核工具。第 29 课介绍部署级审核。第 30 课以当前的两用能力证据收尾。

```figure
an-moderation-layers
```

## 动手实践

`code/main.py` 构建了一个三层审核框架：输入审核器（关键词 + 类别分数）、输出审核器（对输出使用相同分类器）、自定义审核器（领域规则）。你可以将输入送入框架，观察哪一层捕获了什么。

## 上线部署

本课产出 `outputs/skill-moderation-stack.md`。给定一个部署方案，它会推荐一套审核栈配置：输入端使用哪个分类器、输出端使用哪个、哪些自定义规则，以及边界情况使用什么裁判模型。

## 练习

1. 运行 `code/main.py`。将一条良性、一条边界、一条有害的输入分别通过所有三层。报告每一项触发的是哪一层。

2. 扩展该框架，为特定类别添加 Perspective API 风格的毒性评分。将其阈值行为与类别分数进行比较。

3. 阅读 OpenAI Moderation API 文档和 Llama Guard 3 类别列表。将每个 OpenAI 类别映射到最接近的 Llama Guard 类别。找出三个无法清晰映射的类别。

4. 为一个代码助手部署（例如 GitHub Copilot）设计审核栈。识别最相关和最不相关的类别，并提出自定义规则。

5. Azure Content Moderator 将于 2027 年 2 月退役。规划迁移到 Azure AI Content Safety 的方案。指出迁移中风险最高的环节。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| OpenAI Moderation | "omni-moderation-latest" | 基于 GPT-4o 的 13 类别（文本）分类器，支持部分多模态 |
| Perspective API | "Google Jigsaw toxicity" | LLM 时代之前的毒性评分基线 |
| Llama Guard | "MLCommons 14-category" | Meta 的危害分类器（v3：8B 文本，8 种语言；v4：12B 多模态） |
| 输入审核 | "pre-generation filter" | 在调用模型前对用户提示词进行分类 |
| 输出审核 | "post-generation filter" | 在交付前对模型输出进行分类 |
| 自定义审核 | "domain rules" | 部署特定的规则（正则表达式、白名单、策略） |
| 分层审核 | "all three layers" | 标准的生产部署模式 |

## 延伸阅读

- [OpenAI Moderation API 文档](https://platform.openai.com/docs/api-reference/moderations) — omni-moderation 端点
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) — Llama Guard 仓库
- [Google Jigsaw Perspective API](https://perspectiveapi.com/) — 毒性评分
- [Azure AI Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) — Azure 的替代方案