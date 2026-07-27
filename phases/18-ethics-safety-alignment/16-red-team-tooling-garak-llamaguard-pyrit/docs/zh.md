# 红队工具 — Garak、Llama Guard、PyRIT

> 三款生产级工具构成了 2026 年的红队技术栈。Llama Guard（Meta）——基于 Llama-3.1-8B 微调的分类器，覆盖 14 个 MLCommons 危害类别；2025 年的 Llama Guard 4 是一款 12B 原生多模态分类器，由 Llama 4 Scout 剪枝而来。Garak（NVIDIA）——开源 LLM 漏洞扫描器，配备静态、动态和自适应探针，用于检测幻觉、数据泄露、提示注入、毒性及越狱攻击。PyRIT（Microsoft）——多轮红队攻击平台，支持 Crescendo、TAP 以及自定义转换器链，用于深度利用测试。Llama Guard 3 记录在 Meta 的论文《Llama 3 Herd of Models》（arXiv:2407.21783）中；Llama Guard 3-1B-INT4 记录在 arXiv:2411.17713 中；Garak 的探针架构见 github.com/NVIDIA/garak。这些工具构成了 2026 年红队研究（第 12-15 课）与部署（第 17 课及之后）之间的生产级接口。

**类型：** 构建  
**语言：** Python（标准库，工具架构模拟器及 Llama Guard 风格分类器模拟）  
**前置条件：** 阶段 18 · 第 12-15 课（越狱攻击与 IPI）  
**时长：** 约 75 分钟  

## 学习目标

- 描述 Llama Guard 3/4 在安全栈中的位置：输入分类器、输出分类器，或两者兼有。
- 列举 14 个 MLCommons 危害类别，并指出其中一个非显而易见的类别（代码解释器滥用）。
- 描述 Garak 的探针架构：探针（Probes）、检测器（Detectors）、控制器（Harnesses）。
- 描述 PyRIT 的多轮攻击平台结构及其如何与 Garak 探针组合使用。

## 问题

第 12-15 课展示了攻击面。生产环境部署需要可重复、可扩展的评估。2026 年有三种工具占据主导地位：Llama Guard（防御分类器）、Garak（扫描器）、PyRIT（攻击编排器）。每种工具针对红队生命周期的不同层面。

## 概念

### Llama Guard（Meta）

Llama Guard 3 是一个基于 Llama-3.1-8B 微调的模型，用于对 MLCommons AILuminate 14 个类别进行输入/输出分类：
- 暴力犯罪、非暴力犯罪、性相关、儿童性虐待材料（CSAM）、诽谤
- 专业建议、隐私、知识产权、无差别武器、仇恨言论
- 自杀/自残、色情内容、选举、代码解释器滥用

支持 8 种语言。使用方式：置于 LLM 之前（输入审核）、之后（输出审核），或两者兼用。两种用途会产生不同的训练分布——Llama Guard 3 以单一模型同时处理这两种场景。

Llama Guard 3-1B-INT4（arXiv:2411.17713，440MB，在移动 CPU 上约 30 tokens/s）是量化后的边缘端变体。

Llama Guard 4（2025 年 4 月）为 12B 参数，原生多模态，由 Llama 4 Scout 剪枝而来。它用一个同时处理文本和图像的分类器取代了之前的 8B 文本和 11B 视觉分类器。

### Garak（NVIDIA）

开源漏洞扫描器。架构：
- **探针（Probes）。** 用于生成幻觉、数据泄露、提示注入、毒性、越狱等攻击。静态（固定提示）、动态（生成提示）、自适应（根据目标输出响应调整）。
- **检测器（Detectors）。** 根据预期的故障模式（毒性、泄露、越狱等）对输出进行评分。
- **控制器（Harnesses）。** 管理探针-检测器对，运行攻击任务，生成报告。

TrustyAI 将 Garak 与 Llama-Stack 防护层（Prompt-Guard-86M 输入分类器、Llama-Guard-3-8B 输出分类器）集成，实现端到端的带防护目标评估。基于严重等级的打分（TBSA）取代了二元通过/失败——在同一探针上，模型可能在第 3 级严重程度上通过，而在第 5 级严重程度上失败。

### PyRIT（Microsoft）

Python 风险识别工具包（Python Risk Identification Toolkit）。多轮红队攻击平台。核心组件：
- **转换器（Converters）。** 对种子提示进行变换——改写、编码、翻译、角色扮演。
- **编排器（Orchestrators）。** 运行攻击任务：Crescendo（逐步升级）、TAP（分支探索）、RedTeaming（自定义循环）。
- **评分（Scoring）。** 以 LLM 作为评判者或以分类器作为评判者。

PyRIT 是 Garak 的更重型同类工具。Garak 运行数千次单轮探针；PyRIT 运行旨在攻破特定故障模式的深度多轮攻击任务。

### 技术栈

将 Llama Guard 放置在模型的两侧。每晚运行 Garak 进行回归测试。在发布前运行 PyRIT 进行攻击任务。这是 2026 年大多数生产环境的默认配置。

### 评估陷阱

- **评判者身份。** 三种工具都可以使用 LLM 作为评判者；评判者的校准直接影响报告的 ASR（第 12 课）。在指定工具的同时应明确评判者。
- **探针过时。** 随着模型针对特定探针进行修补，Garak 探针会逐渐失效。自适应探针（PAIR 风格）比静态探针过时速度更慢。
- **Llama Guard 在良性内容上的误报。** 早期版本的 Llama Guard 对政治和 LGBTQ+ 内容过度标记；Llama Guard 3/4 的校准有所改进，但并未针对每个部署场景进行校准。

### 在阶段 18 中的位置

第 12-15 课涵盖攻击家族。第 16 课涵盖生产工具。第 17 课（WMDP）评估双重用途能力。第 18 课是前沿安全框架，将这些工具纳入策略结构之中。

## 使用

`code/main.py` 构建了一个玩具版 Llama Guard 风格分类器（基于关键词+语义特征覆盖 14 个类别）、一个玩具版 Garak 控制器（探针-检测器循环）以及一个 PyRIT 风格的多轮转换器链。你可以针对模拟目标运行这三种工具，并观察它们不同的覆盖特征。

## 交付物

本课程生成 `outputs/skill-red-team-stack.md`。给定一个部署场景描述，它指出三种工具中哪些适用、每种工具需要配置什么，以及应运行什么样的回归节奏。

## 练习

1. 运行 `code/main.py`。比较 Llama Guard 风格分类器在单轮攻击与多轮攻击上的检测率。

2. 实现一个新的 Garak 探针：一个经过 base64 编码的有害请求。通过 Llama Guard 风格分类器测量其检测效果。

3. 扩展 PyRIT 风格的转换器链，增加一个"翻译成法语，然后改写"的转换器。重新测量攻击成功率。

4. 阅读 Llama Guard 3 的危害类别列表。识别两个在合法开发者内容上训练数据可能产生高误报率的类别。

5. 比较 Garak 和 PyRIT 的设计原则。论证在何种部署场景下每种工具是更合适的选择。

## 关键术语

| 术语 | 通俗说法 | 实际含义 |
|------|----------|----------|
| Llama Guard | "那个分类器" | 基于 Llama-3.1-8B/4-12B 微调的安全分类器，覆盖 14 个危害类别 |
| Garak | "那个扫描器" | NVIDIA 开源漏洞扫描器；包含探针、检测器、控制器 |
| PyRIT | "那个攻击工具" | Microsoft 多轮红队编排器；包含转换器、编排器、评分器 |
| Prompt-Guard | "那个小分类器" | Meta 的 86M 参数提示注入分类器，与 Llama Guard 配合使用 |
| TBSA | "基于等级的打分" | Garak 的基于严重等级的通过/失败机制，取代二元结果 |
| 转换器链 | "改写 + 编码 + ..." | PyRIT 的组合原语，用于构建多步攻击 |
| MLCommons 危害类别 | "那 14 种分类体系" | Llama Guard 所针对的行业标准分类体系 |

## 延伸阅读

- [Meta — Llama Guard 3（收录于 Llama 3 Herd 论文，arXiv:2407.21783）](https://arxiv.org/abs/2407.21783) — 8B 分类器
- [Meta — Llama Guard 3-1B-INT4（arXiv:2411.17713）](https://arxiv.org/abs/2411.17713) — 量化移动端分类器
- [NVIDIA Garak — GitHub](https://github.com/NVIDIA/garak) — 扫描器仓库及文档
- [Microsoft PyRIT — GitHub](https://github.com/Azure/PyRIT) — 攻击工具包
