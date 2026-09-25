# 红队工具链 — Garak、Llama Guard、PyRIT

> 三款生产级工具构成了 2026 年的红队技术栈。Llama Guard(Meta)— 一个基于 14 个 MLCommons 危害类别微调的 Llama-3.1-8B 分类器;2025 年的 Llama Guard 4 是一个从 Llama 4 Scout 剪枝而来的 12B 原生多模态分类器。Garak(NVIDIA)— 开源 LLM 漏洞扫描器,针对幻觉、数据泄露、提示注入、毒性和越狱提供静态、动态和自适应探针。PyRIT(Microsoft)— 结合 Crescendo、TAP 及自定义转换器链进行多轮红队活动,实现深度利用。Llama Guard 3 记录于 Meta 的 "Llama 3 Herd of Models"(arXiv:2407.21783);Llama Guard 3-1B-INT4 见 arXiv:2411.17713;Garak 的探针架构见 github.com/NVIDIA/garak。这些工具是 2026 年红队研究(第 12-15 课)与部署(第 17 课及之后)之间的生产接口。

**Type:** Build
**Languages:** Python(stdlib、工具架构模拟器和 Llama Guard 风格分类器模拟)
**Prerequisites:** Phase 18 · 12-15(越狱与 IPI)
**Time:** 约 75 分钟

## 学习目标

- 描述 Llama Guard 3/4 在安全栈中的定位:输入分类器、输出分类器,或两者兼有。
- 说出 14 个 MLCommons 危害类别,并举出一个不明显的类别(Code Interpreter Abuse)。
- 描述 Garak 的探针架构:probes、detectors、harnesses。
- 描述 PyRIT 的多轮活动结构,以及它如何与 Garak 探针组合。

## 问题所在

第 12-15 课展示了攻击面。生产部署需要可重复、可扩展的评估。三款工具主导 2026 年:Llama Guard(防御分类器)、Garak(扫描器)、PyRIT(活动编排器)。三者各自针对红队生命周期的不同层面。

## 核心概念

### Llama Guard(Meta)

Llama Guard 3 是一个针对 MLCommons AILuminate 14 个类别做输入/输出分类的微调 Llama-3.1-8B 模型:
- 暴力犯罪、非暴力犯罪、性相关、CSAM、诽谤
- 专业建议、隐私、知识产权、大规模杀伤性武器、仇恨
- 自杀/自残、性内容、选举、代码解释器滥用

支持 8 种语言。用法:置于 LLM 之前(输入审核)、之后(输出审核),或两者兼用。两种用法对应不同的训练分布 — Llama Guard 3 以单一模型同时处理两者。

Llama Guard 3-1B-INT4(arXiv:2411.17713,440MB,移动 CPU 上约 30 tokens/s)是量化边缘变体。

Llama Guard 4(2025 年 4 月)为 12B,原生多模态,从 Llama 4 Scout 剪枝而来。它用一个可接收文本 + 图像的分类器取代了之前的 8B 文本与 11B 视觉版本。

### Garak(NVIDIA)

开源漏洞扫描器。架构:
- **Probes(探针)。** 针对幻觉、数据泄露、提示注入、毒性、越狱的攻击生成器。静态(固定提示)、动态(生成式提示)、自适应(根据目标输出响应)。
- **Detectors(检测器)。** 按预期失败模式对输出评分 — 有毒、泄露、越狱。
- **Harnesses(测试框架)。** 管理探针-检测器配对、运行活动、生成报告。

TrustyAI 将 Garak 与 Llama-Stack shields(Prompt-Guard-86M 输入分类器、Llama-Guard-3-8B 输出分类器)集成,实现端到端的受保护目标评估。基于分层的评分(TBSA)取代二元通过/失败 — 同一探针下,模型可以在严重性层级 3 通过,而在层级 5 失败。

### PyRIT(Microsoft)

Python Risk Identification Toolkit。多轮红队活动。围绕以下构建:
- **Converters(转换器)。** 变换种子提示 — 改写、编码、翻译、角色扮演。
- **Orchestrators(编排器)。** 运行活动:Crescendo(逐步升级)、TAP(分支)、RedTeaming(自定义循环)。
- **Scoring(评分)。** LLM-as-judge 或 classifier-as-judge。

PyRIT 是 Garak 的重量级表亲。Garak 运行数千个单轮探针;PyRIT 运行旨在突破特定失败模式的深度多轮活动。

### 技术栈

在模型两侧都部署 Llama Guard。每晚运行 Garak 做回归。发布前运行 PyRIT 活动。这是 2026 年大多数生产部署的默认配置。

### 评估陷阱

- **裁判身份。** 三款工具都可使用 LLM 裁判;裁判校准决定报告的 ASR(第 12 课)。应在指定工具的同时指定裁判。
- **探针老化。** 随着模型针对探针打补丁,Garak 探针会逐渐失效。自适应探针(PAIR 形式)比静态探针老化更慢。
- **Llama Guard 在良性内容上的 FPR。** 早期 Llama Guard 版本过度标记政治和 LGBTQ+ 内容;Llama Guard 3/4 的校准有所改善,但并未针对各部署逐一校准。

### 在 Phase 18 中的位置

第 12-15 课是攻击族。第 16 课是生产工具链。第 17 课(WMDP)是针对双用途能力的评估。第 18 课是将这些工具包裹进策略结构的前沿安全框架。

```figure
al-guard-stack
```

## 使用它

`code/main.py` 构建一个玩具级 Llama Guard 风格分类器(基于 14 个类别的关键词 + 语义特征)、一个玩具级 Garak 测试框架(探针-检测器循环),以及一个 PyRIT 风格的多轮转换器链。你可以让三款工具对抗一个模拟目标,并观察不同的覆盖特征。

## 交付它

本课产出 `outputs/skill-red-team-stack.md`。给定一个部署描述,它会指出三款工具中哪些适用、各自需要配置什么,以及应采用何种回归节奏。

## 练习

1. 运行 `code/main.py`。比较 Llama Guard 风格分类器在单轮攻击与多轮攻击上的检测率。

2. 实现一个新的 Garak 探针:一个 base64 编码的有害请求。测量 Llama Guard 风格分类器对它的检测效果。

3. 为 PyRIT 风格转换器链添加一个"先翻译成法语,再改写"的转换器。重新测量攻击成功率。

4. 阅读 Llama Guard 3 的危害类别列表。找出两个其训练数据在合法开发者内容上现实地会产生高假阳性率的类别。

5. 比较 Garak 与 PyRIT 的设计原则。针对一个部署场景论证各自是正确的工具选择。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| Llama Guard | "那个分类器" | 基于 14 个危害类别微调的 Llama-3.1-8B/4-12B 安全分类器 |
| Garak | "那个扫描器" | NVIDIA 开源漏洞扫描器;probes、detectors、harnesses |
| PyRIT | "那个活动工具" | Microsoft 多轮红队编排器;转换器、编排器、评分 |
| Prompt-Guard | "那个小分类器" | Meta 的 86M 提示注入分类器,与 Llama Guard 配对 |
| TBSA | "分层评分" | Garak 的分层通过/失败机制,取代二元结果 |
| 转换器链 | "改写 + 编码 + ..." | PyRIT 用于构建多步攻击的组合原语 |
| MLCommons 危害类别 | "那 14 个分类体系" | Llama Guard 所针对的行业标准分类体系 |

## 延伸阅读

- [Meta — Llama Guard 3(收录于 Llama 3 Herd 论文,arXiv:2407.21783)](https://arxiv.org/abs/2407.21783) — 8B 分类器
- [Meta — Llama Guard 3-1B-INT4(arXiv:2411.17713)](https://arxiv.org/abs/2411.17713) — 量化移动端分类器
- [NVIDIA Garak — GitHub](https://github.com/NVIDIA/garak) — 扫描器仓库与文档
- [Microsoft PyRIT — GitHub](https://github.com/Azure/PyRIT) — 活动工具包