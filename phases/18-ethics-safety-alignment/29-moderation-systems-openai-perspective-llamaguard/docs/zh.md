# 29 · 审核系统——OpenAI、Perspective、Llama Guard

> 生产环境的审核系统（Moderation Systems）将第 12 至 16 课中定义的安全策略落地执行。OpenAI 审核 API（OpenAI Moderation API）：`omni-moderation-latest`（2024）基于 GPT-4o，一次调用即可对文本和图像进行分类；多语言测试集上的表现比上一版本提升 42%；响应模式返回 13 个分类布尔值——harassment、harassment/threatening、hate、hate/threatening、illicit、illicit/violent、self-harm、self-harm/intent、self-harm/instructions、sexual、sexual/minors、violence、violence/graphic；对大多数开发者免费。分层模式（layered patterns）：输入审核（Input moderation，生成前）、输出审核（Output moderation，生成后）、自定义审核（Custom moderation，领域规则）。异步并行调用可隐藏延迟；被标记时显示占位响应。Llama Guard 3/4（第 16 课）：14 个 MLCommons 风险类别、代码解释器滥用（Code Interpreter Abuse）、8 种语言（v3）、多图像（v4）。Perspective API（Google Jigsaw）：毒性评分系统，诞生于 LLM 作为审核工具这股浪潮之前；主要为单维度的毒性评分，并衍生出 severe-toxicity、insult、profanity 等变体；是内容审核研究的基线。弃用信息：Azure Content Moderator 于 2024 年 2 月弃用，2027 年 2 月退役，由 Azure AI Content Safety 取代。

**类型：** 构建
**语言：** Python（标准库，三层审核框架）
**前置：** 第 18 阶段 · 第 16 课（Llama Guard / Garak / PyRIT）
**时长：** 约 60 分钟

## 学习目标

- 描述 OpenAI 审核 API 的分类体系（category taxonomy），以及它与 Llama Guard 3 的 MLCommons 分类集有何不同。
- 描述三层审核模式（输入、输出、自定义），并指出每一层的一种失效模式（failure mode）。
- 描述 Perspective API 作为前 LLM 时代基线的定位，以及它为什么在研究中仍被使用。
- 陈述 Azure 的弃用时间线。

## 问题

第 12 至 16 课描述了攻击与防御工具。第 29 课则涵盖已部署的审核系统——它们在用户接触产品的最外层将防御手段落地执行。三层模式是 2026 年的标配配置。

## 概念

### OpenAI 审核 API

`omni-moderation-latest`（2024）。基于 GPT-4o。一次调用即可对文本和图像进行分类。对大多数开发者免费。

分类（响应模式中 13 个布尔值）：
- harassment、harassment/threatening
- hate、hate/threatening
- self-harm、self-harm/intent、self-harm/instructions
- sexual、sexual/minors
- violence、violence/graphic
- illicit、illicit/violent

多模态支持适用于 `violence`、`self-harm` 和 `sexual`，但不包括 `sexual/minors`；其余类别仅支持文本。

在 `code/main.py` 的代码框架中，我们将 `/threatening`、`/intent`、`/instructions` 和 `/graphic` 这些子类别折叠到各自的顶层父类别中，以便教学的简洁性。生产代码应使用完整的 13 分类模式。

多语言测试集上的表现比上一代审核端点提升 42%。按类别评分；应用自行设置阈值。

### Llama Guard 3/4

第 16 课已覆盖。14 个 MLCommons 风险类别（组织方式与 OpenAI 的 13 个响应布尔值不同）。支持 8 种语言（v3）。Llama Guard 4（2025 年 4 月）原生多模态，12B。

OpenAI 和 Llama Guard 的分类体系有重叠但存在分歧。OpenAI 将"illicit"作为一个宽泛类别；Llama Guard 则分别设有"violent crimes"和"non-violent crimes"。部署方根据自身策略与分类体系的匹配程度来选择。

### Perspective API（Google Jigsaw）

毒性评分系统，诞生于 LLM 作为审核工具这股浪潮之前（2020 年以前）。类别：TOXICITY、SEVERE_TOXICITY、INSULT、PROFANITY、THREAT、IDENTITY_ATTACK。以单一维度（TOXICITY）为主评分，辅以各子维度变体。

因其 API 稳定、文档完善且拥有多年的校准数据，被广泛用作内容审核研究的基线。对于现代 LLM 相关场景，Llama Guard 或 OpenAI 审核通常是更合适的选择。

### 三层模式

1. **输入审核。** 在生成前对用户提示进行分类。若被标记则拒绝。延迟：一次分类器调用。
2. **输出审核。** 在交付前对模型输出进行分类。若被标记则替换为拒绝响应。延迟：生成后的一次分类器调用。
3. **自定义审核。** 领域特定规则（正则、允许列表、业务策略）。在输入或输出端运行。

三层设计上是顺序执行的：输入审核必须在生成前完成，输出审核在生成后运行。并行性体现在层内——对同一段文本同时运行多个分类器（如 OpenAI 审核 + Llama Guard + Perspective）可以掩盖单个分类器的延迟。作为一种可选的优化，可以在输入审核完成且 token-1 流式输出推迟期间显示占位响应（"请稍候，正在检查……"）。标记行为可配置：拒绝、净化、升级至人工审核。

### 失效模式

- **仅输入。** 无法捕获输出幻觉（第 12 至 14 课的编码攻击可绕过输入分类器）。
- **仅输出。** 允许任意输入到达模型；增加成本；将内部推理暴露给攻击者。
- **仅自定义。** 跨类别不够鲁棒；正则表达式脆弱易碎。

分层是默认做法。双重保险（belt-and-suspenders）。

### Azure 弃用

Azure Content Moderator：2024 年 2 月弃用，2027 年 2 月退役。由 Azure AI Content Safety 取代，后者基于 LLM 并与 Azure OpenAI 集成。此次迁移是 Azure 部署方在 2024 至 2027 年间的一项现场级项目。

### 在第 18 阶段中的位置

第 16 课涵盖红队场景下的审核工具。第 29 课涵盖已部署的审核。第 30 课以当前的双重用途能力证据收尾。

## 使用

`code/main.py` 构建了一个三层审核框架：输入审核器（关键词 + 分类评分）、输出审核器（对输出使用相同分类器）、自定义审核器（领域规则）。你可以输入内容并观察哪一层拦截了什么。

## 交付

本课产出 `outputs/skill-moderation-stack.md`。给定一个部署场景，它推荐审核栈配置：输入端使用哪个分类器、输出端使用哪个分类器、哪些自定义规则，以及边缘情况使用什么评判器。

## 练习

1. 运行 `code/main.py`。分别输入良性、边界性和有害内容通过全部三层。报告每种情况触发了哪一层。

2. 扩展框架，添加类似 Perspective API 风格的特定类别毒性评分。比较其阈值行为与分类评分的行为。

3. 阅读 OpenAI 审核 API 文档和 Llama Guard 3 分类列表。将每个 OpenAI 分类映射到最接近的 Llama Guard 分类。找出三个无法清晰映射的分类。

4. 为代码助手部署（如 GitHub Copilot）设计一个审核栈。识别最相关和最不相关的分类，并提出自定义规则。

5. Azure Content Moderator 将于 2027 年 2 月退役。规划向 Azure AI Content Safety 的迁移。识别迁移中风险最高的要素。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| OpenAI 审核 | "omni-moderation-latest" | 基于 GPT-4o 的 13 分类（文本）分类器，具有部分多模态支持 |
| Perspective API | "Google Jigsaw 毒性评分" | 前 LLM 时代的毒性评分基线 |
| Llama Guard | "MLCommons 14 分类" | Meta 的风险分类器（v3：8B 文本，8 种语言；v4：12B 多模态） |
| 输入审核 | "生成前过滤" | 在模型调用前对用户提示进行分类 |
| 输出审核 | "生成后过滤" | 在交付前对模型输出进行分类 |
| 自定义审核 | "领域规则" | 部署特定的规则（正则、允许列表、策略） |
| 分层审核 | "三层全上" | 标准的生产部署模式 |

## 延伸阅读

- [OpenAI 审核 API 文档](https://platform.openai.com/docs/api-reference/moderations) — omni-moderation 端点
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) — Llama Guard 仓库
- [Google Jigsaw Perspective API](https://perspectiveapi.com/) — 毒性评分
- [Azure AI Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) — Azure 替代方案
