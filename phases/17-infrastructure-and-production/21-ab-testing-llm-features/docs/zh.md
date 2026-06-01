# 21 · 对 LLM 功能做 A/B 测试 —— GrowthBook、Statsig 与「凭感觉」难题

> 传统 A/B 测试并非为非确定性的 LLM 设计。关键区别在于：评估（evals）回答「模型能不能完成这项工作？」，而 A/B 测试回答「用户在不在乎？」二者缺一不可；靠「感觉测试（vibe checks）」就上线的时代已经结束。2026 年值得测试的方向：提示工程（prompt engineering，措辞）、模型选型（GPT-4 vs GPT-3.5 vs 开源模型；准确率 vs 成本 vs 延迟）、生成参数（temperature、top-p）。真实案例：某聊天机器人的奖励模型（reward model）变体带来了对话长度 +70%、留存 +30%；Nextdoor 的 AI 邮件主题行实验在优化奖励函数后带来 +1% 的 CTR；Khan Academy 的 Khanmigo 则在「延迟 vs 数学准确率」这一维度上反复迭代。平台格局一分为二：**Statsig**（2025 年 9 月被 OpenAI 以 11 亿美元收购）—— 序贯检验（sequential testing）、CUPED、一体化方案。**GrowthBook** —— 开源、原生对接数据仓库（warehouse-native）、贝叶斯 + 频率派 + 序贯三种引擎、CUPED、SRM 检查、Benjamini-Hochberg + Bonferroni 校正。你的选择取决于是否偏好仓库 SQL，以及「被 OpenAI 收购」这件事对你的组织是否重要。

**类型：** 学习
**语言：** Python（标准库，玩具级序贯检验模拟器）
**前置：** 阶段 17 · 13（可观测性）、阶段 17 · 20（渐进式部署）
**时长：** 约 60 分钟

## 学习目标

- 区分评估（「模型能不能完成这项工作」）与 A/B 测试（「用户在不在乎」）。
- 列举三个可测试的维度（提示词、模型、参数），并为每个维度选定指标。
- 解释 CUPED、序贯检验，以及 Benjamini-Hochberg 多重比较校正。
- 根据仓库 SQL 取向和对企业收购的态度，在 Statsig 与 GrowthBook 之间做出选择。

## 问题所在

你手工调了一版系统提示词。感觉更好了。于是你上线了。转化率的变化只是噪声。你怪罪到指标头上。又或者你换了一个新模型，转化率却纹丝不动 —— 到底是模型退化了，还是变化太小以至于检测不出来？你不知道，因为你没做 A/B 就上线了。

评估回答的是：模型能否在一个带标注的数据集上完成某项任务。它们回答不了用户是否更偏好这一输出。只有受控的线上实验才能回答这个问题，而且前提是实验有足够的统计功效（power）、能控制非确定性、并对多重比较做了校正。

## 核心概念

### 评估 vs A/B 测试

**评估（evals）** —— 离线、带标注的数据集、由评判者（评分量表、LLM-as-judge 或人工）打分。回答：「在这个固定分布上，输出是否正确 / 有用 / 安全？」

**A/B 测试** —— 线上、真实用户、随机分流。回答：「新变体是否真的撬动了那个重要的用户级指标？」

二者都必需。评估在功能暴露给用户之前捕捉回归；A/B 在之后确认产品影响。

### 测试什么

1. **提示工程** —— 措辞、系统提示词结构、示例。指标：任务成功率、用户留存、单请求成本。
2. **模型选型** —— GPT-4 vs GPT-3.5-Turbo vs Llama 开源模型。指标：准确率（任务）+ 单请求成本 + 延迟 P99。多目标权衡。
3. **生成参数** —— temperature、top-p、max_tokens。指标：与任务相关（输出多样性 vs 确定性）。

### CUPED —— 方差削减

全称 Controlled-experiments Using Pre-Experiment Data（利用实验前数据的受控实验）。在比较实验期数据之前，先把实验前期的方差回归剔除。典型的方差削减幅度为 30%-70%。有效样本量（effective sample size）相当于免费提升。

实现情况：Statsig 与 GrowthBook 均已实现。

### 序贯检验

经典 A/B 测试假设样本量固定。序贯检验（「边看边决策」）在反复查看数据的情形下控制假阳性率。始终有效的序贯流程（mSPRT、Howard 的置信序列 confidence sequences）允许你在出现明确赢家时提前停止。

### 多重比较校正

以 95% 置信度同时跑 20 个 A/B 测试，光凭运气就会产生一个假阳性。Bonferroni 校正收紧每个测试的 α；Benjamini-Hochberg 则控制假发现率（false-discovery rate）。GrowthBook 两者都实现了。

### SRM —— 样本比例失配

分配哈希（assignment hash）把用户随机分配到各变体。如果本应 50/50 的分流变成了 47/53，说明出了问题 —— SRM 检查会把它标出来。两个平台都实现了该检查。

### Statsig vs GrowthBook

**Statsig**：
- 被 OpenAI 以 11 亿美元收购（2025 年 9 月）。托管型 SaaS。
- 序贯检验、CUPED、留出（held-out）人群。
- 一体化：功能开关（feature flags）+ 实验 + 可观测性。
- 最佳适配：团队本就想要一个打包好的产品，且不介意 OpenAI 的所有权。

**GrowthBook**：
- 开源（MIT 协议）；原生对接数据仓库（直接从 Snowflake / BigQuery / Redshift 读取）。
- 多种引擎：贝叶斯、频率派、序贯。
- CUPED、SRM、Bonferroni、BH 校正。
- 可自托管或使用托管云。
- 最佳适配：以仓库 SQL 为主的团队、数据团队掌控指标层、希望用开源方案。

### 非确定性让统计功效变得复杂

同一条提示词会产生变化的输出。传统的功效计算假设观测值是独立同分布（IID）的。在 LLM 非确定性下，有效样本量低于名义值。作为安全裕度，把所需样本量乘以约 1.3-1.5 倍。

### 真实案例结果

- 聊天机器人奖励模型变体：对话长度 +70%、留存 +30%。
- Nextdoor 邮件主题行：优化奖励函数后 CTR +1%。
- Khan Academy 的 Khanmigo：在「延迟 vs 数学准确率」上反复迭代权衡。

### 反模式：凭感觉上线

每一位资深工程师都能说出某个仅因「感觉更好」而上线、却没做 A/B 的功能。其中大多数都拉低了产品指标，而团队几个月都没察觉。A/B 是逼你正视事实的强制约束。

### 你应该记住的数字

- Statsig 被 OpenAI 收购：11 亿美元，2025 年 9 月。
- GrowthBook：开源 MIT 协议；贝叶斯 + 频率派 + 序贯。
- CUPED 方差削减：30%-70%。
- LLM 非确定性 → 样本量缓冲 +30%-50%。

## 动手用它

`code/main.py` 模拟了一个带固定边界和序贯边界的序贯 A/B 测试，展示序贯方法如何让你提前停止。

## 交付它

本课产出 `outputs/skill-ab-plan.md`。给定功能变更、工作负载、基线，它会选定平台、关卡（gates）和样本量。

## 练习

1. 运行 `code/main.py`。对于基线 3% 转化率、预期 5% 提升的情形，达到 80% 功效需要多少样本量？
2. 为一个受医疗法规约束的本地部署（on-prem）客户在 Statsig 与 GrowthBook 之间做选择。
3. 设计一个 A/B 测试，用「单张已解决工单的成本」来比较 GPT-4 vs GPT-3.5。主指标、护栏指标（guardrail metric）、次要指标分别是什么？
4. 你的金丝雀（canary）通过了，但 A/B 显示转化率 -1.2%。你会上线吗？写下升级处置（escalation）标准。
5. 把 CUPED 应用到一个实验前期，其方差为实验期的 60%。计算有效样本量的提升幅度。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Eval（评估） | 「离线测试」 | 对模型能力的带标注数据集评估 |
| A/B test（A/B 测试） | 「实验」 | 对用户的线上随机对比 |
| CUPED | 「方差削减」 | 用实验前期回归来削减方差 |
| Sequential test（序贯检验） | 「可偷看的测试」 | 允许提前停止的始终有效流程 |
| Multiple comparison（多重比较） | 「族系误差」 | 跑很多测试会抬高假阳性 |
| Bonferroni | 「严格校正」 | 把 α 除以测试数量 |
| Benjamini-Hochberg | 「BH FDR」 | 控制假发现率，比 Bonferroni 更宽松 |
| SRM | 「分流出错」 | 样本比例失配；分配 bug |
| Statsig | 「OpenAI 旗下」 | 商业化一体方案，2025 年被收购 |
| GrowthBook | 「那个开源的」 | MIT 协议、原生对接数据仓库的平台 |
| mSPRT | 「序贯概率比检验」 | 经典的序贯流程 |

## 延伸阅读

- [GrowthBook —— How to A/B Test AI](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/)
- [Statsig —— Beyond Prompts: Data-Driven LLM Optimization](https://www.statsig.com/blog/llm-optimization-online-experimentation)
- [Statsig vs GrowthBook 对比](https://www.statsig.com/perspectives/ab-testing-feature-flags-comparison-tools)
- [Deng 等人 —— CUPED](https://www.exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf)
- [Howard —— Confidence Sequences](https://arxiv.org/abs/1810.08240)
