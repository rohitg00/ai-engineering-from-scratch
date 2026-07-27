# 审核系统 — OpenAI、Perspective、Llama Guard

> 生产级审核系统将第12-16课中定义的安全策略付诸实践。OpenAI审核API：`omni-moderation-latest`（2024年）基于GPT-4o构建，可在一次调用中分类文本+图片；在多语言测试集上比之前版本提升42%；响应模式返回13个类别布尔值——骚扰、骚扰/威胁、仇恨、仇恨/威胁、非法、非法/暴力、自残、自残/意图、自残/指令、色情、色情/未成年人、暴力、暴力/血腥；对大多数开发者免费。分层模式：输入审核（生成前）、输出审核（生成后）、自定义审核（领域规则）。异步并行调用隐藏延迟；标记时返回占位响应。Llama Guard 3/4（第16课）：14个MLCommons危害类别、代码解释器滥用、8种语言（v3）、多图片（v4）。Perspective API（Google Jigsaw）：毒性评分，早于LLM-as-moderator浪潮；主要是单一维度的毒性评分，含严重毒性/侮辱/脏话变体；是内容审核研究的基线。弃用：Azure Content Moderator于2024年2月弃用，2027年2月退役，由Azure AI Content Safety取代。

**类型：** 构建
**语言：** Python（标准库，三层审核框架）
**前置条件：** 阶段18 · 16（Llama Guard / Garak / PyRIT）
**时长：** 约60分钟

## 学习目标

- 描述OpenAI审核API的类别分类法及其与Llama Guard 3的MLCommons集合的区别。
- 描述三层审核模式（输入、输出、自定义）并指出每种模式的一种失败模式。
- 描述Perspective API作为LLM时代之前基线的地位及其为何仍在研究中使用。
- 说明Azure的弃用时间线。

## 问题

第12-16课描述了攻击和防御工具。第29课涵盖部署的审核系统，这些系统在用户接触产品的界面上将防御措施付诸实践。三层模式是2026年的默认配置。

## 概念

### OpenAI审核API

`omni-moderation-latest`（2024年）。基于GPT-4o构建。可在一次调用中分类文本+图片。对大多数开发者免费。

类别（响应模式中的13个布尔值）：
- 骚扰（harassment）、骚扰/威胁（harassment/threatening）
- 仇恨（hate）、仇恨/威胁（hate/threatening）
- 自残（self-harm）、自残/意图（self-harm/intent）、自残/指令（self-harm/instructions）
- 色情（sexual）、色情/未成年人（sexual/minors）
- 暴力（violence）、暴力/血腥（violence/graphic）
- 非法（illicit）、非法/暴力（illicit/violent）

多模态支持适用于`violence`、`self-harm`和`sexual`，但不适用于`sexual/minors`；其余类别仅支持文本。

对于`code/main.py`中的代码框架，为了教学简洁，我们将`/threatening`、`/intent`、`/instructions`和`/graphic`等子类别折叠到其顶层父类别中。生产代码应使用完整的13类别模式。

在多语言测试集上比上一代审核端点提升42%。按类别评分；应用程序自行设置阈值。

### Llama Guard 3/4

在第16课中已介绍。14个MLCommons危害类别（组织方式与OpenAI的13个响应模式布尔值不同）。支持8种语言（v3）。Llama Guard 4（2025年4月）原生支持多模态，12B参数。

OpenAI和Llama Guard的分类法有重叠但也有差异。OpenAI将"非法"（illicit）作为一个宽泛类别；Llama Guard将"暴力犯罪"和"非暴力犯罪"分开。部署时根据其策略-分类法的匹配度进行选择。

### Perspective API（Google Jigsaw）

毒性评分系统，早于LLM-as-moderator浪潮（2020年之前）。类别：TOXICITY、SEVERE_TOXICITY、INSULT、PROFANITY、THREAT、IDENTITY_ATTACK。单一维度的主要评分（TOXICITY）带有子维度变体。

因其API稳定、文档完善且拥有多年的校准数据，被广泛用作内容审核研究的基线。对于现代的LLM相关用例，Llama Guard或OpenAI审核通常更适合。

### 三层模式

1. **输入审核。** 在生成之前对用户提示进行分类。如果被标记则拒绝。延迟：一次分类器调用。
2. **输出审核。** 在交付之前对模型输出进行分类。如果被标记则替换为拒绝响应。延迟：生成后一次分类器调用。
3. **自定义审核。** 特定领域的规则（正则表达式、白名单、业务策略）。在输入或输出阶段运行。

三层按设计顺序执行：输入审核必须在生成前完成，输出审核在生成后运行。并行性应用于同一层内——在同一文本上同时运行多个分类器（例如，OpenAI审核 + Llama Guard + Perspective）可以隐藏每个分类器的延迟。作为可选优化，可以在输入审核完成且令牌-1流式传输延迟时显示占位响应（"请稍候，正在检查……"）。标记行为可配置：拒绝、净化、升级至人工审核。

### 失败模式

- **仅输入。** 无法捕获输出幻觉（第12-14课的编码攻击可绕过输入分类器）。
- **仅输出。** 允许任何输入到达模型；增加成本；向攻击者暴露内部推理。
- **仅自定义。** 跨类别不够稳健；正则表达式脆弱。

分层是默认方案。双重保险。

### Azure弃用

Azure Content Moderator：于2024年2月弃用，2027年2月退役。由Azure AI Content Safety取代，后者基于LLM并与Azure OpenAI集成。迁移是Azure部署在2024-2027年间的现场级别项目。

### 在阶段18中的位置

第16课在红队测试的背景下介绍审核工具。第29课涵盖部署的审核。第30课以当前双重用途能力证据作为收尾。

## 使用它

`code/main.py`构建了一个三层审核框架：输入审核器（关键词+类别评分）、输出审核器（对输出使用相同的分类器）、自定义审核器（领域规则）。您可以运行输入并观察哪一层捕获了什么。

## 交付它

本课程产出一个`outputs/skill-moderation-stack.md`文件。针对给定的部署，它推荐一个审核栈配置：在输入层使用哪个分类器、在输出层使用哪个分类器、哪些自定义规则，以及用于边缘情况的评判器。

## 练习

1. 运行`code/main.py`。将一个良性、边界性和有害的输入通过所有三层运行。报告每层触发了哪个输入。

2. 使用类似Perspective API的毒性评分方式扩展框架，针对特定类别。比较其阈值行为与类别评分。

3. 阅读OpenAI审核API文档和Llama Guard 3的类别列表。将每个OpenAI类别映射到最接近的Llama Guard类别。找出三个无法清晰映射的类别。

4. 为代码助手部署（例如GitHub Copilot）设计一个审核栈。找出最相关和最不相关的类别，并提出自定义规则。

5. Azure Content Moderator将于2027年2月退役。规划迁移到Azure AI Content Safety的方案。确定迁移中风险最高的元素。

## 关键术语

| 术语 | 人们所说的 | 实际含义 |
|------|-----------|---------|
| OpenAI审核（OpenAI Moderation） | "omni-moderation-latest" | 基于GPT-4o的13类别（文本）分类器，支持部分多模态 |
| Perspective API | "Google Jigsaw毒性评分" | LLM时代之前的毒性评分基线 |
| Llama Guard | "MLCommons 14类别" | Meta的危害分类器（v3：8B文本，8种语言；v4：12B多模态） |
| 输入审核（Input moderation） | "生成前过滤器" | 在模型调用前对用户提示进行分类 |
| 输出审核（Output moderation） | "生成后过滤器" | 在交付前对模型输出进行分类 |
| 自定义审核（Custom moderation） | "领域规则" | 部署特定的规则（正则表达式、白名单、策略） |
| 分层审核（Layered moderation） | "所有三层" | 标准生产部署模式 |

## 扩展阅读

- [OpenAI审核API文档](https://platform.openai.com/docs/api-reference/moderations) — omni-moderation端点
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) — Llama Guard仓库
- [Google Jigsaw Perspective API](https://perspectiveapi.com/) — 毒性评分
- [Azure AI Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) — Azure替代方案
