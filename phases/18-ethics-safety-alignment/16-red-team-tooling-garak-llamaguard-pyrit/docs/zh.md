# 红队工具 —— Garak、Llama Guard、PyRIT

> 三个生产工具构成了 2026 年红队技术栈。Llama Guard（Meta）—— 基于 14 个 MLCommons 危害类别微调的 Llama-3.1-8B 分类器；2025 年的 Llama Guard 4 是从 Llama 4 Scout 剪枝而来的 12B 原生多模态分类器。Garak（NVIDIA）—— 开源 LLM 漏洞扫描器，具有针对幻觉、数据泄露、提示注入、毒性和越狱的静态、动态和自适应探针。PyRIT（Microsoft）—— 多轮红队活动，使用 Crescendo、TAP 和自定义转换器链进行深度利用。Llama Guard 3 记录在 Meta 的 "Llama 3 Herd of Models"（arXiv:2407.21783）中；Llama Guard 3-1B-INT4 在 arXiv:2411.17713 中；Garak 的探针架构在 github.com/NVIDIA/garak 中。这些工具是 2026 年红队研究（第 12-15 课）与部署（第 17+ 课）之间的生产接口。

**类型：** 构建
**语言：** Python（标准库，工具架构模拟器和 Llama Guard 风格分类器模拟）
**先决条件：** Phase 18 · 12-15（越狱和 IPI）
**时间：** ~75 分钟

## 学习目标

- 描述 Llama Guard 3/4 在安全栈中的位置：输入分类器、输出分类器，或两者兼有。
- 说出 14 个 MLCommons 危害类别，并说明一个非显而易见的类别（代码解释器滥用）。
- 描述 Garak 的探针架构：探针、检测器、工具。
- 描述 PyRIT 的多轮活动结构，以及它如何与 Garak 探针组合。

## 问题

第 12-15 课呈现了攻击面。生产部署需要可重复、可扩展的评估。三个工具主导 2026 年：Llama Guard（防御分类器）、Garak（扫描器）、PyRIT（活动编排器）。每个针对红队生命周期的不同层。

## 概念

### Llama Guard（Meta）

Llama Guard 3 是一个针对 MLCommons AILuminate 14 个类别进行输入/输出分类微调的 Llama-3.1-8B 模型：
- 暴力犯罪、非暴力犯罪、性相关、CSAM、诽谤
- 专业建议、隐私、知识产权、无差别武器、仇恨
- 自杀/自残、性内容、选举、代码解释器滥用

支持 8 种语言。用法：放在 LLM 之前（输入审核）、LLM 之后（输出审核），或两者兼有。这两种用途产生不同的训练分布 —— Llama Guard 3 作为处理两者的单一模型发布。

Llama Guard 3-1B-INT4（arXiv:2411.17713，440MB，移动 CPU 上约 30 token/s）是量化边缘变体。

Llama Guard 4（2025 年 4 月）是 12B，原生多模态，从 Llama 4 Scout 剪枝而来。它用一个摄取文本 + 图像的分类器取代了 8B 文本和 11B 视觉前身。

### Garak（NVIDIA）

开源漏洞扫描器。架构：
- **探针。** 针对幻觉、数据泄露、提示注入、毒性、越狱的攻击生成器。静态（固定提示）、动态（生成提示）、自适应（响应目标输出）。
- **检测器。** 根据预期失效模式对输出进行评分 —— 有毒、泄露、越狱。
- **工具。** 管理探针-检测器对，运行活动，生成报告。

TrustyAI 将 Garak 与 Llama-Stack 防护（Prompt-Guard-86M 输入分类器、Llama-Guard-3-8B 输出分类器）集成，用于端到端受保护目标评估。基于层级的评分（TBSA）取代二元通过/失败 —— 模型可以在同一探针的严重性层级 3 通过，在严重性层级 5 失败。

### PyRIT（Microsoft）

Python 风险识别工具包。多轮红队活动。围绕以下构建：
- **转换器。** 转换种子提示 —— 改写、编码、翻译、角色扮演。
- **编排器。** 运行活动：Crescendo（升级）、TAP（分支）、RedTeaming（自定义循环）。
- **评分。** LLM 作为评判者或分类器作为评判者。

PyRIT 是 Garak 的更重版本。Garak 运行数千个单轮探针；PyRIT 运行旨在打破特定失效模式的深度多轮活动。

### 技术栈

在模型两侧放置 Llama Guard。每晚运行 Garak 进行回归测试。在发布前运行 PyRIT 进行活动。这是 2026 年大多数生产部署的默认配置。

### 评估陷阱

- **评判者身份。** 三个工具都可以使用 LLM 评判者；评判者校准驱动报告的 ASR（第 12 课）。指定工具时要同时指定评判者。
- **探针过时。** Garak 探针随着模型针对它们进行修补而老化。自适应探针（PAIR 形状）比静态探针老化更慢。
- **Llama Guard 对良性内容的误报率。** 早期 Llama Guard 版本过度标记政治和 LGBTQ+ 内容；Llama Guard 3/4 校准已改进，但未按部署进行校准。

### 这在 Phase 18 中的位置

第 12-15 课是攻击家族。第 16 课是生产工具。第 17 课（WMDP）是双重用途能力的评估。第 18 课是将这些工具包装在策略结构中的前沿安全框架。

## 使用它

`code/main.py` 构建一个模拟 Llama Guard 风格分类器（14 个类别的关键词 + 语义特征）、一个模拟 Garak 工具（探针-检测器循环）和一个 PyRIT 风格多轮转换器链。你可以针对模拟目标运行三个工具，并观察不同的覆盖特征。

## 交付它

本课产生 `outputs/skill-red-team-stack.md`。给定部署描述，它命名三个工具中哪些适用，每个工具中配置什么，以及运行什么回归节奏。

## 练习

1. 运行 `code/main.py`。比较 Llama Guard 风格分类器对单轮与多轮攻击的检测率。

2. 实现一个新的 Garak 探针：base64 编码的有害请求。测量 Llama Guard 风格分类器对其的检测。

3. 用"翻译成法语，然后改写"转换器扩展 PyRIT 风格转换器链。重新测量攻击成功率。

4. 阅读 Llama Guard 3 的危害类别列表。识别两个训练数据会在合法开发者内容上产生高误报率的类别。

5. 比较 Garak 和 PyRIT 的设计原则。论证每种工具适合的部署场景。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| Llama Guard | "分类器" | 基于 14 个危害类别微调的 Llama-3.1-8B/4-12B 安全分类器 |
| Garak | "扫描器" | NVIDIA 开源漏洞扫描器；探针、检测器、工具 |
| PyRIT | "活动工具" | Microsoft 多轮红队编排器；转换器、编排器、评分 |
| Prompt-Guard | "小型分类器" | Meta 的 86M 提示注入分类器，与 Llama Guard 配对 |
| TBSA | "基于层级的评分" | Garak 的基于层级通过/失败，取代二元结果 |
| 转换器链 | "改写 + 编码 + ..." | PyRIT 组合原语，用于构建多步攻击 |
| MLCommons 危害类别 | "14 个分类法" | Llama Guard 针对的行业标准分类法 |

## 延伸阅读

- [Meta — Llama Guard 3（在 Llama 3 Herd 论文中，arXiv:2407.21783）](https://arxiv.org/abs/2407.21783) — 8B 分类器
- [Meta — Llama Guard 3-1B-INT4（arXiv:2411.17713）](https://arxiv.org/abs/2411.17713) — 量化移动分类器
- [NVIDIA Garak — GitHub](https://github.com/NVIDIA/garak) — 扫描器仓库和文档
- [Microsoft PyRIT — GitHub](https://github.com/Azure/PyRIT) — 活动工具包
