# 内容审核系统 —— OpenAI、Perspective、Llama Guard

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 生产级内容审核系统把第 12-16 课定义的安全策略落地。OpenAI Moderation API：`omni-moderation-latest`（2024）基于 GPT-4o，能在一次调用里同时分类文本与图像；多语言测试集上比上一代提升 42%；响应 schema 返回 13 个类别布尔值 —— harassment、harassment/threatening、hate、hate/threatening、illicit、illicit/violent、self-harm、self-harm/intent、self-harm/instructions、sexual、sexual/minors、violence、violence/graphic；对大多数开发者免费。分层模式：Input moderation（生成前）、Output moderation（生成后）、Custom moderation（领域规则）。异步并行调用可隐藏延迟；命中时返回占位响应。Llama Guard 3/4（第 16 课）：14 个 MLCommons 危害类别、Code Interpreter Abuse、8 种语言（v3）、多图像（v4）。Perspective API（Google Jigsaw）：早于 LLM-as-moderator 浪潮的毒性评分系统；主打单维度 toxicity，配 severe-toxicity / insult / profanity 等变体；是内容审核研究的基线。弃用提示：Azure Content Moderator 已于 2024 年 2 月弃用，2027 年 2 月退役，由 Azure AI Content Safety 取代。

**Type:** Build
**Languages:** Python（标准库，三层 moderation harness）
**Prerequisites:** Phase 18 · 16（Llama Guard / Garak / PyRIT）
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 描述 OpenAI Moderation API 的类别体系，并说明它与 Llama Guard 3 所采用的 MLCommons 类别集有何不同。
- 描述三层 moderation 模式（input、output、custom），并各举一种失败情形。
- 说明 Perspective API 作为 LLM 时代之前基线的位置，以及它为何仍在研究中被使用。
- 给出 Azure 的弃用时间线。

## 问题（Problem）

第 12-16 课介绍了攻击与防御工具。第 29 课讲的是把这些防御真正落到用户与产品接触面上的、已部署的内容审核系统。三层模式是 2026 年的默认配置。

## 概念（Concept）

### OpenAI Moderation API

`omni-moderation-latest`（2024）。基于 GPT-4o，可在一次调用里分类文本和图像。对大多数开发者免费。

类别（响应 schema 中的 13 个布尔值）：
- harassment、harassment/threatening
- hate、hate/threatening
- self-harm、self-harm/intent、self-harm/instructions
- sexual、sexual/minors
- violence、violence/graphic
- illicit、illicit/violent

多模态支持仅适用于 `violence`、`self-harm` 和 `sexual`，不包括 `sexual/minors`；其余类别仅支持文本。

在 `code/main.py` 的代码 harness 里，为了教学简洁，我们把 `/threatening`、`/intent`、`/instructions`、`/graphic` 这些子类别合并到对应的顶层父类别。生产代码应使用完整的 13 类别 schema。

在多语言测试集上比上一代审核接口提升 42%。每个类别都有单独得分；具体阈值由应用方设定。

### Llama Guard 3/4

详见第 16 课。14 个 MLCommons 危害类别（组织方式与 OpenAI 13 个响应 schema 布尔值不同）。支持 8 种语言（v3）。Llama Guard 4（2025 年 4 月）原生多模态，12B。

OpenAI 与 Llama Guard 的分类法既有重叠也有差异。OpenAI 用一个宽泛的 "illicit" 类别；Llama Guard 把它拆成 "violent crimes" 和 "non-violent crimes"。具体部署根据自身策略分类法的契合度来选。

### Perspective API（Google Jigsaw）

早于 LLM-as-moderator 浪潮（2020 年前）的毒性评分系统。类别：TOXICITY、SEVERE_TOXICITY、INSULT、PROFANITY、THREAT、IDENTITY_ATTACK。主打单维度评分（TOXICITY），并附带子维度变体。

它被广泛用作内容审核研究的基线，因为接口稳定、文档齐全，并且积累了多年的校准数据。但对现代 LLM 相关的用例，Llama Guard 或 OpenAI Moderation 通常是更合适的选择。

### 三层模式（the three-layer pattern）

1. **Input moderation.** 在生成前对用户 prompt 进行分类。命中则拒绝。延迟：一次分类器调用。
2. **Output moderation.** 在交付前对模型输出进行分类。命中则替换为拒答。延迟：生成之后再加一次分类器调用。
3. **Custom moderation.** 领域专用规则（正则、allowlist（白名单）、业务策略）。可以放在 input 或 output 任一侧。

这三层在设计上是顺序串联的：input moderation 必须在生成前完成，output moderation 在生成后再跑。并行只在层内适用 —— 让多个分类器（比如 OpenAI Moderation + Llama Guard + Perspective）对同一段文本并发跑，可以隐藏单个分类器的延迟。作为可选的优化，可以在 input moderation 完成期间先展示一段占位响应（"稍等，检查中……"），并把 token-1 的流式输出推迟到检查结束。命中后的行为可配置：拒答、清洗、或升级到人工审核。

### 失败模式（failure modes）

- **只有 input。** 接不住模型输出端的 hallucination（第 12-14 课讲到的编码绕过攻击会跳过 input 分类器）。
- **只有 output。** 任意输入都能进到模型；成本上升；还会把内部推理过程暴露给攻击者。
- **只有 custom。** 跨类别覆盖不稳；正则非常脆。

分层才是默认方案。Belt-and-suspenders（双保险）。

### Azure 弃用（Azure deprecation）

Azure Content Moderator：2024 年 2 月弃用，2027 年 2 月退役。由 Azure AI Content Safety 取代，后者基于 LLM，并与 Azure OpenAI 集成。对 Azure 部署来说，这个迁移是一个跨越 2024-2027 的字段级工程。

### 在 Phase 18 中的位置（Where this fits in Phase 18）

第 16 课在红队（red-team）语境下介绍审核工具。第 29 课讨论已部署的审核系统。第 30 课会以当前的双重用途能力（dual-use capability）证据收尾。

## 用起来（Use It）

`code/main.py` 构建了一个三层 moderation harness：input moderator（关键词 + 类别得分）、output moderator（同一分类器跑在输出上）、custom moderator（领域规则）。你可以把输入跑一遍，观察每一层各自抓到了什么。

## 上线部署（Ship It）

本课产出 `outputs/skill-moderation-stack.md`。给定一个部署场景，它会推荐一套 moderation 栈配置：input 端用哪个分类器、output 端用哪个、定义哪些 custom 规则、边界情况用什么 judge。

## 练习（Exercises）

1. 运行 `code/main.py`。让一段无害、一段边界、一段有害输入分别穿过三层，并报告每段是被哪一层拦下的。

2. 给 harness 扩展一个针对某个具体类别的 Perspective-API 风格 toxicity 评分。把它的阈值行为与类别得分做对比。

3. 阅读 OpenAI Moderation API 文档和 Llama Guard 3 的类别清单。把每个 OpenAI 类别映射到最接近的 Llama Guard 类别。指出三组无法干净映射的类别。

4. 为一个代码助手部署（比如 GitHub Copilot）设计一套 moderation 栈。指出最相关与最不相关的类别，并提出 custom 规则。

5. Azure Content Moderator 将于 2027 年 2 月退役。规划向 Azure AI Content Safety 的迁移，并指出迁移中风险最高的环节。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际指什么 |
|------|-----------------|------------------------|
| OpenAI Moderation | "omni-moderation-latest" | 基于 GPT-4o 的 13 类（文本）分类器，部分类别支持多模态 |
| Perspective API | "Google Jigsaw toxicity" | LLM 时代之前的毒性评分基线 |
| Llama Guard | "MLCommons 14 类" | Meta 的危害分类器（v3：8B 文本，8 语种；v4：12B 多模态） |
| Input moderation | "生成前过滤" | 在调用模型前对用户 prompt 跑分类器 |
| Output moderation | "生成后过滤" | 在交付前对模型输出跑分类器 |
| Custom moderation | "领域规则" | 部署专用规则（正则、allowlist、策略） |
| Layered moderation | "三层都上" | 标准生产部署模式 |

## 延伸阅读（Further Reading）

- [OpenAI Moderation API docs](https://platform.openai.com/docs/api-reference/moderations) —— omni-moderation 接口
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) —— Llama Guard 仓库
- [Google Jigsaw Perspective API](https://perspectiveapi.com/) —— 毒性评分
- [Azure AI Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) —— Azure 替代品
