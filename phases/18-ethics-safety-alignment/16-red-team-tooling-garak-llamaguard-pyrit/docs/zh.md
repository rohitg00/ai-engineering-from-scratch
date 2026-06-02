# Red-Team 工具链 —— Garak、Llama Guard、PyRIT

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 三款生产级工具勾勒了 2026 年的红队（red-team）技术栈。Llama Guard（Meta）—— 一个基于 Llama-3.1-8B、在 14 个 MLCommons 危害类别上微调（fine-tune）的分类器；2025 年发布的 Llama Guard 4 是 12B 的原生多模态分类器，从 Llama 4 Scout 剪枝（pruning）而来。Garak（NVIDIA）—— 开源的 LLM 漏洞扫描器，提供针对 hallucination（幻觉）、数据泄露、prompt injection、毒性内容、越狱（jailbreak）的静态、动态与自适应 probe（探针）。PyRIT（Microsoft）—— 多轮红队活动编排，内置 Crescendo、TAP 与可定制的 converter 链路，用于深度利用。Llama Guard 3 见 Meta 的 "Llama 3 Herd of Models"（arXiv:2407.21783）；Llama Guard 3-1B-INT4 见 arXiv:2411.17713；Garak 的 probe 架构见 github.com/NVIDIA/garak。这三款工具是 2026 年红队研究（Lesson 12-15）与部署（Lesson 17+）之间的生产接口。

**Type:** Build
**Languages:** Python（stdlib，工具架构模拟器与 Llama Guard 风格的分类器 mock）
**Prerequisites:** Phase 18 · 12-15（jailbreak 与 IPI）
**Time:** ~75 分钟

## 学习目标（Learning Objectives）

- 说出 Llama Guard 3/4 在安全栈里的位置：输入分类器、输出分类器，还是两者都做。
- 列出 14 个 MLCommons 危害类别，并指出一个不那么直观的（Code Interpreter Abuse，代码解释器滥用）。
- 描述 Garak 的 probe 架构：probes、detectors、harnesses。
- 描述 PyRIT 的多轮活动结构，以及它如何与 Garak 的 probe 组合使用。

## 问题（The Problem）

Lesson 12-15 摆出了攻击面。生产部署需要可重复、可扩展的评估。2026 年三款工具占据主导：Llama Guard（防御分类器）、Garak（扫描器）、PyRIT（活动编排器）。它们各自瞄准红队生命周期的不同一层。

## 概念（The Concept）

### Llama Guard（Meta）

Llama Guard 3 是一个基于 Llama-3.1-8B 微调的模型，用于在 MLCommons AILuminate 14 个类别上做输入/输出分类：
- 暴力犯罪、非暴力犯罪、性相关、CSAM（儿童性虐待材料）、诽谤
- 专业建议、隐私、知识产权（IP）、无差别武器、仇恨
- 自杀/自残、性内容、选举、code-interpreter 滥用

支持 8 种语言。用法：放在 LLM 之前（输入审核）、之后（输出审核），或两侧都放。两种用法对应不同的训练分布 —— Llama Guard 3 以单一模型同时承担两端。

Llama Guard 3-1B-INT4（arXiv:2411.17713，440MB，移动端 CPU 上约 30 tokens/s）是量化（quantization）后的端侧版本。

Llama Guard 4（2025 年 4 月）是 12B 的原生多模态模型，从 Llama 4 Scout 剪枝得到。它用一个同时吞下文本 + 图像的分类器，替代了原先的 8B 文本版与 11B 视觉版前辈。

### Garak（NVIDIA）

开源漏洞扫描器。架构如下：
- **Probes（探针）。** 针对 hallucination、数据泄露、prompt injection、毒性、越狱的攻击生成器。分为静态（固定 prompt）、动态（生成 prompt）、自适应（根据目标输出做反应）。
- **Detectors（检测器）。** 把输出对照预期的失败模式打分 —— 是否有毒、是否泄露、是否被越狱。
- **Harnesses（运行框架）。** 管理 probe-detector 配对，跑活动、出报告。

TrustyAI 把 Garak 与 Llama-Stack 的护盾（Prompt-Guard-86M 输入分类器、Llama-Guard-3-8B 输出分类器）整合在一起，做端到端的「带护盾目标」评估。分级评分（TBSA, Tier-Based Scoring Approach）取代了二元的通过/不通过 —— 同一个 probe，模型可能在 severity tier 3 通过，在 tier 5 失败。

### PyRIT（Microsoft）

Python Risk Identification Toolkit。专做多轮红队活动。围绕三个概念构建：
- **Converters（转换器）。** 对种子 prompt 做变换 —— paraphrase（改写）、编码、翻译、角色扮演。
- **Orchestrators（编排器）。** 跑活动：Crescendo（升级式）、TAP（分支式）、RedTeaming（自定义循环）。
- **Scoring（评分）。** 用 LLM-as-judge 或 classifier-as-judge。

PyRIT 是 Garak 的重量级表亲。Garak 跑成千上万次单轮 probe；PyRIT 跑深度多轮活动，专门拆解特定的失败模式。

### 整套技术栈

把 Llama Guard 放在模型两侧。每晚跑一遍 Garak 做回归。发布前用 PyRIT 跑活动。这是 2026 年大多数生产部署的默认配置。

### 评估的坑

- **Judge 身份。** 三款工具都可以用 LLM judge；judge 的校准会左右报告里的 ASR（Lesson 12）。给出工具的同时也要点明 judge。
- **Probe 老化。** 模型针对 Garak 的 probe 打补丁后，probe 就会过时。自适应 probe（PAIR 形态）比静态 probe 老化得慢。
- **Llama Guard 在良性内容上的 FPR（误报率）。** 早期 Llama Guard 版本会过度标记政治与 LGBTQ+ 内容；Llama Guard 3/4 的校准有所改善，但并未针对各部署单独校准。

### 在 Phase 18 中的位置

Lesson 12-15 是攻击家族。Lesson 16 是生产工具链。Lesson 17（WMDP）是双用途能力的评估。Lesson 18 是前沿安全框架，把这些工具包进政策结构里。

## 用起来（Use It）

`code/main.py` 搭建了一个玩具版的 Llama Guard 风格分类器（在 14 个类别上叠加关键词 + 语义特征）、一个玩具版的 Garak harness（probe-detector 循环），以及一个 PyRIT 风格的多轮 converter 链。你可以让这三件工具去打一个 mock target，观察不同的覆盖特征。

## 上线部署（Ship It）

本课产出 `outputs/skill-red-team-stack.md`。给定一份部署描述，它会指出三款工具中哪几款合适，每款里要配置什么，以及该按什么节奏跑回归。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。比较 Llama-Guard 风格分类器在单轮 vs 多轮攻击下的检出率。

2. 实现一个新的 Garak probe：一个 base64 编码的恶意请求。测一下它被 Llama-Guard 风格分类器检出的情况。

3. 给 PyRIT 风格的 converter 链加一个 "translate to French, then paraphrase" 的 converter。重新测攻击成功率。

4. 读 Llama Guard 3 的危害类别列表。指出两个类别，其训练数据会让正常的开发者内容现实地产生高误报率。

5. 比较 Garak 与 PyRIT 的设计原则。各举一个部署场景，论证为何它是合适的工具。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Llama Guard | "the classifier"（那个分类器） | 在 14 个危害类别上微调的 Llama-3.1-8B/4-12B 安全分类器 |
| Garak | "the scanner"（那个扫描器） | NVIDIA 开源漏洞扫描器；包含 probes、detectors、harnesses |
| PyRIT | "the campaign tool"（那个活动工具） | Microsoft 多轮红队编排器；含 converters、orchestrators、scoring |
| Prompt-Guard | "the small classifier"（那个小分类器） | Meta 的 86M prompt-injection 分类器，与 Llama Guard 搭配使用 |
| TBSA | "tier-based scoring"（分级评分） | Garak 的分级评分，取代二元的通过/不通过 |
| Converter chain | "paraphrase + encode + ..."（改写 + 编码 + ……） | PyRIT 用来构建多步攻击的组合原语 |
| MLCommons hazard categories | "the 14 taxonomies"（那 14 个分类） | Llama Guard 对标的行业标准分类法 |

## 延伸阅读（Further Reading）

- [Meta — Llama Guard 3（收录于 Llama 3 Herd 论文，arXiv:2407.21783）](https://arxiv.org/abs/2407.21783) —— 8B 分类器
- [Meta — Llama Guard 3-1B-INT4（arXiv:2411.17713）](https://arxiv.org/abs/2411.17713) —— 量化的移动端分类器
- [NVIDIA Garak — GitHub](https://github.com/NVIDIA/garak) —— 扫描器仓库与文档
- [Microsoft PyRIT — GitHub](https://github.com/Azure/PyRIT) —— 活动工具包
