# 16 · 红队工具链 —— Garak、Llama Guard、PyRIT

> 三款生产工具共同构成了 2026 年的红队（red-team）技术栈。Llama Guard（Meta）—— 一个基于 Llama-3.1-8B 的分类器，针对 14 个 MLCommons 危害类别进行了微调；2025 年发布的 Llama Guard 4 是一个 12B 原生多模态分类器，从 Llama 4 Scout 剪枝而来。Garak（NVIDIA）—— 开源大语言模型（LLM）漏洞扫描器，提供静态、动态与自适应探针（probe），覆盖幻觉、数据泄露、提示注入、毒性内容与越狱攻击。PyRIT（Microsoft）—— 多轮红队演练框架，内置 Crescendo、TAP 以及自定义转换器链（converter chain），用于深度攻击测试。Llama Guard 3 的详细文档见 Meta 的 "Llama 3 Herd of Models"（arXiv:2407.21783）；Llama Guard 3-1B-INT4 见 arXiv:2411.17713；Garak 的探针架构见 github.com/NVIDIA/garak。这些工具是 2026 年连接红队研究（第 12-15 课）与部署（第 17 课及以后）的生产接口。

**类型：** 构建
**语言：** Python（标准库、工具架构模拟器与 Llama Guard 式分类器 mock）
**前置：** 第 18 阶段 · 第 12-15 课（越狱攻击与上下文模式注入）
**时长：** 约 75 分钟

## 学习目标

- 描述 Llama Guard 3/4 在安全栈中的定位：输入分类器、输出分类器，或两者兼备。
- 列出 14 个 MLCommons 危害类别，并指出一个容易忽略的类别（代码解释器滥用，Code Interpreter Abuse）。
- 描述 Garak 的探针架构：探针（probe）、检测器（detector）、调度器（harness）。
- 描述 PyRIT 的多轮演练结构及其与 Garak 探针的组合方式。

## 问题

第 12-15 课展示了攻击面。生产部署需要可重复、可扩展的评估。2026 年有三款工具占据主导地位：Llama Guard（防御分类器）、Garak（扫描器）、PyRIT（演练编排器）。它们各自针对红队生命周期的不同层面。

## 核心概念

### Llama Guard（Meta）

Llama Guard 3 是一个基于 Llama-3.1-8B 的模型，针对 MLCommons AILuminate 的 14 个危害类别进行了输入/输出分类微调：
- 暴力犯罪、非暴力犯罪、涉性类别、儿童性虐待材料（CSAM）、诽谤
- 专业建议、隐私、知识产权、无差别武器、仇恨
- 自杀/自残、色情内容、选举、代码解释器滥用

支持 8 种语言。用法：将其置于 LLM 之前（输入审核）、LLM 之后（输出审核），或同时用于两端。两种用途会产生不同的训练分布 —— Llama Guard 3 以单一模型同时处理两者。

Llama Guard 3-1B-INT4（arXiv:2411.17713，440MB，移动端 CPU 约 30 tokens/s）是量化后的边缘部署变体。

Llama Guard 4（2025 年 4 月）为 12B 参数，原生多模态，从 Llama 4 Scout 剪枝而来。它以单个同时处理文本与图像的分类器，取代了此前的 8B 文本分类器和 11B 视觉分类器。

### Garak（NVIDIA）

开源漏洞扫描器。架构如下：
- **探针（Probe）。** 攻击生成器，覆盖幻觉、数据泄露、提示注入、毒性内容、越狱攻击。分为静态探针（固定提示词）、动态探针（生成式提示词）和自适应探针（根据目标输出动态调整）。
- **检测器（Detector）。** 对输出按预期失败模式进行评分 —— 是否有毒、是否泄露、是否已被越狱。
- **调度器（Harness）。** 管理探针-检测器配对，运行扫描任务，生成报告。

TrustyAI 将 Garak 与 Llama-Stack 护盾（Prompt-Guard-86M 输入分类器、Llama-Guard-3-8B 输出分类器）集成，用于端到端的受护目标评估。分级评分（TBSA，Tier-Based Scoring）取代了二元的通过/不通过 —— 一个模型可能在严重性第 3 级通过但第 5 级失败，源于同一探针。

### PyRIT（Microsoft）

Python 风险识别工具包（Python Risk Identification Toolkit）。多轮红队演练框架。核心组成：
- **转换器（Converter）。** 对种子提示词进行变换 —— 转述、编码、翻译、角色扮演。
- **编排器（Orchestrator）。** 驱动演练流程：Crescendo（逐步升级）、TAP（分支探索）、RedTeaming（自定义循环）。
- **评分（Scoring）。** LLM 作为裁判或分类器作为裁判。

PyRIT 是 Garak 的"重型表亲"。Garak 运行数千次单轮探针扫描；PyRIT 则运行针对特定失败模式的深度多轮演练。

### 技术栈

将 Llama Guard 部署在模型两侧。用 Garak 进行夜间回归扫描。用 PyRIT 进行发布前演练。这是 2026 年大多数生产部署的默认配置。

### 评估陷阱

- **裁判身份。** 三款工具均可使用 LLM 裁判；裁判的校准会直接影响报告的 ASR（攻击成功率，Attack Success Rate，第 12 课）。使用工具时必须同时明确裁判。
- **探针老化。** 随着模型对现有探针打补丁修复，Garak 探针会逐渐失效。自适应探针（PAIR 式）的老化速度慢于静态探针。
- **Llama Guard 在良性内容上的误报率（FPR）。** 早期 Llama Guard 版本对政治和 LGBTQ+ 内容过度标记；Llama Guard 3/4 的校准有所改善，但未做按部署场景的定制校准。

### 在第 18 阶段中的位置

第 12-15 课介绍攻击家族。第 16 课介绍生产工具链。第 17 课（WMDP）介绍双重用途能力评估。第 18 课介绍将这些工具纳入策略框架的前沿安全框架。

## 动手实践

`code/main.py` 构建了一个玩具级 Llama Guard 式分类器（基于关键词 + 语义特征的 14 类分类）、一个玩具级 Garak 调度器（探针-检测器循环）和一个 PyRIT 式多轮转换器链。你可以针对一个模拟目标运行这三款工具，观察不同的覆盖特征。

## 交付产出

本课产出 `outputs/skill-red-team-stack.md`。给定一个部署描述，该文件会指出三款工具中哪些适用、各自需要配置什么，以及按什么频率运行回归扫描。

## 练习

1. 运行 `code/main.py`。比较 Llama Guard 式分类器在单轮攻击与多轮攻击上的检测率。

2. 实现一个新的 Garak 探针：一个 base64 编码的有害请求。测量 Llama Guard 式分类器对其的检测效果。

3. 扩展 PyRIT 式转换器链，添加一个"先翻译为法语，再转述"的转换器。重新测量攻击成功率。

4. 阅读 Llama Guard 3 的危害类别列表。找出两个类别，其训练数据在合法的开发者内容上可能产生较高的误报率。

5. 比较 Garak 与 PyRIT 的设计理念。论证各自适用的部署场景。

## 关键术语

| 术语 | 常见说法 | 实际含义 |
|------|---------|---------|
| Llama Guard | "那个分类器" | 基于 Llama-3.1-8B / Llama 4-12B 微调的安全分类器，覆盖 14 个危害类别 |
| Garak | "那个扫描器" | NVIDIA 开源漏洞扫描器；由探针、检测器、调度器组成 |
| PyRIT | "那个演练工具" | Microsoft 多轮红队编排器；由转换器、编排器、评分组成 |
| Prompt-Guard | "那个小分类器" | Meta 的 86M 参数提示注入分类器，与 Llama Guard 配套使用 |
| TBSA | "分级评分" | Garak 的分级通过/不通过评分机制，取代二元判定 |
| Converter chain | "转述 + 编码 + ..." | PyRIT 的组合原语，用于构建多步攻击 |
| MLCommons hazard categories | "那 14 个分类标准" | Llama Guard 所依据的行业标准分类体系 |

## 延伸阅读

- [Meta — Llama Guard 3（Llama 3 Herd 论文，arXiv:2407.21783）](https://arxiv.org/abs/2407.21783) —— 8B 分类器
- [Meta — Llama Guard 3-1B-INT4（arXiv:2411.17713）](https://arxiv.org/abs/2411.17713) —— 量化移动端分类器
- [NVIDIA Garak — GitHub](https://github.com/NVIDIA/garak) —— 扫描器仓库与文档
- [Microsoft PyRIT — GitHub](https://github.com/Azure/PyRIT) —— 演练工具包
