# WMDP 与双用途能力评估（WMDP and Dual-Use Capability Evaluation）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Li et al., "The WMDP Benchmark: Measuring and Reducing Malicious Use With Unlearning"（ICML 2024, arXiv:2403.03218）。共 4,157 道选择题，覆盖生物安全（1,520）、网络安全（2,225）和化学（412）三个领域。题目位于"黄区（yellow zone）"——临近性的赋能知识，经过多专家评审与 ITAR/EAR 法律合规过滤。双重用途：既作为双用途能力的代理评估，也作为 unlearning（去学习）基准（配套的 RMU 方法可在保留通用能力的前提下降低 WMDP 分数）。2024-2025 年的领域叙事：2024 年早期 OpenAI/Anthropic 的评估报告称相比互联网搜索仅有"轻微提升（mild uplift）"；到 2025 年 4 月，OpenAI 的 Preparedness Framework v2 表示模型"已经临近实质性帮助新手制造已知生物威胁的临界点"。Anthropic 的生物武器获取试验显示 2.53 倍的能力提升，不足以排除 ASL-3。

**Type:** Learn
**Languages:** Python（stdlib，WMDP 形态的能力提升评估 harness）
**Prerequisites:** Phase 18 · 16（红队工具链），Phase 14（agent 工程）
**Time:** ~60 分钟

## 学习目标（Learning Objectives）

- 描述 WMDP 的三个领域、题量分布以及"黄区"过滤准则。
- 解释 RMU，并说明为什么 WMDP 同时是评估基准和 unlearning 基准。
- 复述 2024-2025 年的能力提升叙事："轻微提升" → "临近临界点" → "不足以排除 ASL-3"。
- 区分新手相对提升（novice-relative uplift）与专家绝对能力（expert-absolute capability）。

## 问题（The Problem）

双用途能力是各实验室前沿安全框架（Lesson 18）下都要面对的测量难题。核心问题是：模型 X 是否实质性提升了一个新手在生物、化学或网络领域造成大规模危害的能力？直接测量（让模型真去产出有害内容）既违法又不道德。代理测量需要一个模型不会拒答的基准（这样才能拿到诚实的能力数字），但其题目本身又不能是有害的发表物。

## 概念（The Concept）

### 黄区（The "yellow zone"）

题目要求具备某有害流程的临近性、赋能性知识，但又不构成直接的合成配方。"已发表通路第 4 步使用什么试剂催化？"——而不是"我怎么制造 [危险化合物]？"。每道题都经过多位领域专家评审；并按 ITAR/EAR 出口管制要求过滤。

总计 4,157 道题：
- 生物安全：1,520
- 网络安全：2,225
- 化学：412

选择题形式。模型作答时不会被要求协助任何事；这样就能在不诱发有害行为的前提下测量能力。

### RMU —— Representation Misdirection for Unlearning

配套的 unlearning 方法。在 LLaMa-2-7B 上应用后，可将 WMDP 分数压到接近随机水平，同时把 MMLU 等通用能力基准的下降控制在几个百分点之内。该方法的发表版是后续所有生物-化学-网络 unlearning 论文的 unlearning baseline。

### 2024-2025 年的能力提升叙事

三个阶段：

1. **2024 年的"轻微提升（mild uplift）"。** OpenAI 与 Anthropic 早期 Preparedness/RSP 评估报告指出，针对生物相邻任务的新手而言，前沿模型相比互联网搜索仅有小幅优势。公开口径：前沿模型确有帮助，但相比 Google 的提升并不显著。

2. **2025 年 4 月"临近临界点（on the cusp）"。** OpenAI 的 Preparedness Framework v2 声明模型"已临近实质性帮助新手制造已知生物威胁的临界点"。这不是能力主张——而是临界点已近的预警。

3. **Anthropic 2025 年的生物武器获取试验。** 受控研究，新手参与者参与，测量获取阶段任务的相对成功率。报告 2.53 倍提升。不足以排除 ASL-3（Lesson 18）—— Anthropic Responsible Scaling Policy 第 3 级阈值已达到或临近。

### 新手相对 vs 专家绝对（Novice-relative vs expert-absolute）

一个关键区分：

- **新手相对提升（Novice-relative uplift）。** 模型对一个非专家的帮助有多大？是乘性的。相对优势之所以高，是因为新手底子薄；即使是中等程度的信息也很有用。
- **专家绝对能力（Expert-absolute capability）。** 模型在最大努力下能产出多少信息？专家能榨出比新手更多的内容。绝对天花板很高。

安全论证（Lesson 18）需要同时覆盖这两面："模型不会给新手足够的提升以执行"加上"专家也无法从模型中提取出尚未公开发表的信息"。

### 测量陷阱（The measurement pitfall）

WMDP 是能力代理，不是部署测量。WMDP 高分的模型在实践中是否会被新手利用，取决于以下几点：
- 提取抗性（elicitation resistance）—— 在不触发安全过滤的前提下要把能力榨出来有多难
- 隐性知识（tacit knowledge）—— 需要湿实验技能而非信息的能力
- 执行壁垒 —— 采购、设备

Anthropic 2025 年的生物武器获取试验在 WMDP 形态的能力之上叠加了一层新手提取测量：它度量的是真实的任务成功率，而非选择题能力。

### 在 Phase 18 中的位置

Lesson 12-16 是针对模型输出的攻击与防御工具链。Lesson 17 是双用途能力层——前沿安全框架（Lesson 18）所要评估的那条测量。Lesson 30 用 2026 年最新的网络/生物/化学/核能力提升证据收尾整条线。

## 用起来（Use It）

`code/main.py` 构建了一个玩具版 WMDP 形态的评估 harness。对一个 mock 模型在按类别分箱的题目上做测试；按领域报告分数。一个简单的 unlearning 干预（把领域相关的表征置零）会拉低分数；你可以衡量它相对通用能力的取舍。

## 上线部署（Ship It）

本节产出 `outputs/skill-wmdp-eval.md`。给定一项双用途能力主张（"我们的模型不会实质性帮助制造生物武器"），它会审计：跑了哪些基准、评估时用了哪条拒答路径（raw completion vs 策略门控）、以及选择题结果是否有新手提取研究作为补充。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。报告玩具 unlearning 步骤前后的逐领域准确率。解释通用能力上的取舍。

2. 给玩具版 WMDP 增加第四个领域（例如放射性）。指定两种位于黄区的示例题型。解释为什么编写此类题目比追加 MMLU 形态的题目更难。

3. 阅读 WMDP 2024 论文第 5 节（RMU 方法学）。勾画一个更简单的 unlearning 思路（例如对领域内容压制 top-k 神经元），并描述其预期的通用能力代价。

4. Anthropic 2025 年的生物武器获取试验报告 2.53 倍提升。指出该数字可能被高估的两种方式（新手样本规模、任务保真度）以及被低估的两种方式（提取上限、模型安全门控）。

5. 阐述：除了通过 WMDP unlearning，ASL-3 安全论证还需要哪些条件。至少列出两项互补的提取（elicitation）研究。

## 关键术语（Key Terms）

| 术语 | 大家通常怎么说 | 实际含义 |
|------|-----------------|------------------------|
| WMDP | "那个双用途基准" | 4,157 道生物/网络/化学黄区选择题 |
| Yellow zone（黄区） | "赋能但不合成" | 临近有害能力但不构成合成配方的赋能性知识 |
| RMU | "unlearning 基线" | Representation Misdirection for Unlearning；降低 WMDP 分数，保留通用能力 |
| Novice-relative uplift（新手相对提升） | "对非专家有多大帮助" | 相对于新手在现状互联网搜索下的乘性优势 |
| Expert-absolute capability（专家绝对能力） | "专家的天花板" | 一个有动机的专家能从模型中榨出的最大信息量 |
| Acquisition-phase task（获取阶段任务） | "合成之前那些步骤" | 采购、设备、许可证——危害路径中最早的环节 |
| ITAR/EAR | "出口管制合规" | 限制某些赋能性知识公开发表的法律框架 |

## 延伸阅读（Further Reading）

- [Li et al. — The WMDP Benchmark (arXiv:2403.03218, ICML 2024)](https://arxiv.org/abs/2403.03218) —— 基准及 RMU 论文
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) —— "on the cusp" 措辞
- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) —— ASL-3 生物阈值与获取试验结果
- [DeepMind — Frontier Safety Framework v3.0 (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) —— 生物提升 CCL
