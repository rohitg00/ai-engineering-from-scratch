# 红队工具——Garak、Llama Guard、PyRIT

> 三个生产工具构建了 2026 年红队技术栈。Llama Guard (Meta) —— 在 14 个 MLCommons 危害类别上微调的 Llama-3.1-8B 分类器；2025 年的 Llama Guard 4 是从 Llama 4 Scout 剪枝的原生多模态分类器。Garak (NVIDIA) —— 开源 LLM 漏洞扫描器，具有针对幻觉、数据泄漏、提示注入、毒性和越狱的静态、动态和自适应探针。PyRIT (Microsoft) —— 多轮红队活动，具有 Crescendo、TAP 和用于深度利用的自定义转换器链。Llama Guard 3 记录在 Meta 的"Llama 3 Herd of Models" (arXiv:2407.21783) 中；Llama Guard 3-1B-INT4 在 arXiv:2411.17713 中；Garak 的探针架构在 github.com/NVIDIA/garak。这些工具是 2026 年红队研究（课程 12-15）与部署（课程 17+）之间的生产接口。

**类型：** 构建
**语言：** Python（标准库，工具架构模拟器和 Llama Guard 风格分类器模拟）
**先决条件：** 阶段 18 · 12-15（越狱和 IPI）
**时间：** 约 75 分钟

## 学习目标

- 描述 Llama Guard 3/4 在安全栈中的位置：输入分类器、输出分类器或两者。
- 说出 14 个 MLCommons 危害类别并说明一个不明显的（代码解释器滥用）。
- 描述 Garak 的探针架构：探针、检测器、工具。
- 描述 PyRIT 的多轮活动结构以及它如何与 Garak 探针组合。

## 问题

课程 12-15 介绍了攻击面。生产部署需要可重复、可扩展的评估。三个工具主导 2026 年：Llama Guard（防御分类器）、Garak（扫描器）、PyRIT（活动编排器）。每个针对红队生命周期的不同层。

## 概念

### Llama Guard (Meta)

Llama Guard 3 是 Llama-3.1-8B 模型，针对 MLCommons AILuminate 14 个类别的输

入/输出分类进行微调：
- 暴力犯罪、非暴力犯罪、性相关、CSAM、诽谤
- 专业建议、隐私、IP、 indiscriminate 武器、仇恨
- 自杀/自残、性内容、选举、代码解释器滥用

支持 8 种语言。用法：放置在 LLM 之前（输入审核）、之后（输出审核）或两者。两种用法生成不同的训练分布——Llama Guard 3 作为处理两者的单一模型发布。

Llama Guard 3-1B-INT4 (arXiv:2411.17713, 440MB, 移动 CPU 上约 30 个令牌/秒) 是量化边缘变体。

Llama Guard 4 (2025 年 4 月) 是 12B，原生多模态，从 Llama 4 Scout 剪枝。它用可以摄取文本 + 图像的单一分类器替换了 8B 文本和 11B 视觉前身。

### Garak (NVIDIA)

开源漏洞扫描器。架构：
- **探针。** 针对幻觉、数据泄漏、提示注入、毒性、越狱的攻击生成器。静态（固定提示）、动态（生成的提示）、自适应（响应目标输出）。
- **检测器。** 针对预期失败模式对输出评分——有毒、泄漏、越狱。
- **工具。** 管理探针-检测器对，运行活动，生成报告。

TrustyAI 将 Garak 与 Llama-Stack 防护盾（Prompt-Guard-86M 输入分类器、Llama-Guard-3-8B 输出分类器）集成，用于端到端受保护目标评估。基于层级的评分 (TBSA) 替换二进制通过/失败——模型可以在相同探针上层级 3 通过而层级 5 失败。

### PyRIT (Microsoft)

Python 风险识别工具包。多轮红队活动。围绕以下构建：
- **转换器。** 转换种子提示——释义、编码、翻译、角色扮演。
- **编排器。** 运行活动：Crescendo（升级）、TAP（分支）、RedTeaming（自定义循环）。
- **评分。** LLM 作为判断或分类器作为判断。

PyRIT 是 Garak 的较重表亲。Garak 运行数千个单轮探针；PyRIT 运行旨在打破特定失败模式的深度多轮活动。

### 技术栈

在模型两侧放置 Llama Guard。夜间运行 Garak 进行回归。发布前运行 PyRIT 活动。这是 2026 年大多数生产部署的默认配置。

### 评估陷阱

- **判断器身份。** 所有三个工具都可以使用 LLM 判断器；判断器校准驱动报告的 ASR（课程 12）。与工具一起指定判断器。
- **探针过时。** Garak 探针随着模型针对它们被打补丁而老化。自适应探针（PAIR 形状）比静态探针老化更慢。
- **Llama Guard 在良性内容上的 FPR。** 早期 Llama Guard 版本过度标记政治和 LGBTQ+ 内容；Llama Guard 3/4 校准有所改进，但未按部署校准。

### 这在阶段 18 中的适合位置

课程 12-15 是攻击家族。课程 16 是生产工具。课程 17 (WMDP) 是双用途能力的评估。课程 18 是将这些工具包装在策略结构中的前沿安全框架。

## 使用它

`code/main.py` 构建一个玩具 Llama Guard 风格分类器（14 个类别上的关键词 + 语义特征）、一个玩具 Garak 工具（探针-检测器循环）和一个 PyRIT 风格的多轮转换器链。你可以针对模拟目标运行三个工具并观察不同的覆盖签名。

## 实现它

本课程生成 `outputs/skill-red-team-stack.md`。给定部署描述，它命名三个工具中哪个是适当的，每个中配置什么，以及运行什么回归节奏。

## 练习

1. 运行 `code/main.py`。比较 Llama-Guard 风格分类器在单轮与多轮攻击上的检测率。

2. 实现一个新的 Garak 探针：base64 编码的有害请求。测量 Llama-Guard 风格分类器对其的检测。

3. 用"翻译成法语，然后释义"转换器扩展 PyRIT 风格转换器链。重新测量攻击成功率。

4. 阅读 Llama Guard 3 的危害类别列表。识别两个在合法开发者内容上现实地产生高假阳性率的类别。

5. 比较 Garak 和 PyRIT 的设计原则。论证每种在哪种部署中是正确的工具。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| Llama Guard | "分类器" | 具有 14 个危害类别的微调 Llama-3.1-8B/4-12B 安全分类器 |
| Garak | "扫描器" | NVIDIA 开源漏洞扫描器；探针、检测器、工具 |
| PyRIT | "活动工具" | Microsoft 多轮红队编排器；转换器、编排器、评分 |
| Prompt-Guard | "小分类器" | Meta 的 86M 提示注入分类器，与 Llama Guard 配对 |
| TBSA | "基于层级的评分" | Garak 的基于层级的通过/失败替换二进制结果 |
| 转换器链 | "释义 + 编码 + .." | PyRIT 用于构建多步攻击的组合原语 |
| MLCommons 危害类别 | "14 个分类法" | Llama Guard 针对的行业标准分类法 |

## 进一步阅读

- [Meta —— Llama Guard 3 (在 Llama 3 Herd 论文中, arXiv:2407.21783)](https://arxiv.org/abs/2407.21783) — 8B 分类器
- [Meta —— Llama Guard 3-1B-INT4 (arXiv:2411.17713)](https://arxiv.org/abs/2411.17713) — 量化移动分类器
- [NVIDIA Garak —— GitHub](https://github.com/NVIDIA/garak) — 扫描器仓库和文档
- [Microsoft PyRIT —— GitHub](https://github.com/Azure/PyRIT) — 活动工具包