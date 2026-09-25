# LLM 功能的 A/B 测试 — GrowthBook、Statsig 与“凭感觉”问题

> 传统 A/B 测试并非为非确定性 LLM 而设计。关键区别：evals 回答“模型能否胜任这项工作？”A/B 测试回答“用户是否在意？”两者都不可或缺；凭直觉检查就上线早已行不通。2026 年该测什么：提示词工程（措辞）、模型选择（GPT-4 vs GPT-3.5 vs 开源模型；准确率 vs 成本 vs 延迟）、生成参数（temperature、top-p）。真实案例：某聊天机器人 reward model 变体带来 +70% 的对话时长提升和 +30% 的留存提升；Nextdoor 的 AI 邮件主题行实验在优化 reward 函数后带来 +1% 的 CTR 提升；Khan Academy 的 Khanmigo 在延迟与数学准确率之间反复权衡取舍。平台选择：**Statsig**（2025 年 9 月被 OpenAI 以 11 亿美元收购）——序贯测试、CUPED、一体化。**GrowthBook**——开源、数仓原生、支持 Bayesian + Frequentist + Sequential 引擎、CUPED、SRM 检查、Benjamini-Hochberg + Bonferroni 校正。选择依据取决于你对数仓 SQL 的偏好，以及“被 OpenAI 收购”对你的组织是否重要。

**Type:** 学习
**Languages:** Python（标准库、简易序贯测试模拟器）
**Prerequisites:** Phase 17 · 13（可观测性）、Phase 17 · 20（渐进式部署）
**Time:** 约 60 分钟

## 学习目标

- 区分 evals（“模型能否胜任这项工作”）与 A/B 测试（“用户是否在意”）。
- 列举三个可测试的维度（提示词、模型、参数），并为每个维度选择合适的指标。
- 解释 CUPED、序贯测试，以及 Benjamini-Hochberg 多重比较校正。
- 根据数仓 SQL 立场和公司对收购的态度，在 Statsig 与 GrowthBook 之间做出选择。

## 问题所在

你手工调优了一个系统提示词。感觉更好了。你上线了。转化率的变化只是噪声。你归咎于指标。或者你上线了一个新模型，而转化率没有变化——是模型退化了，还是变化太小检测不出来？你不知道，因为你在没有 A/B 测试的情况下就上线了。

Evals 回答模型在带标注数据集上能否完成某项任务。它们无法回答用户是否更喜欢输出结果。只有受控的在线实验才能回答这个问题，而且前提是实验具有足够的统计功效、能控制非确定性、并对多重比较进行校正。

## 核心概念

### Evals 与 A/B 测试

**Evals** — 离线、带标注的数据集、评判者（评分规则、LLM-as-judge 或人工）。回答：“在这个固定分布上，输出是否正确/有帮助/安全？”

**A/B 测试** — 在线、真实用户、随机化。回答：“新变体是否提升了真正重要的用户级指标？”

两者都必需。Evals 在暴露之前捕获回归；A/B 在之后确认产品影响。

### 测试什么

1. **提示词工程** — 措辞、系统提示词结构、示例。指标：任务成功率、用户留存、单次请求成本。
2. **模型选择** — GPT-4 vs GPT-3.5-Turbo vs Llama-OSS。指标：准确率（任务）+ 单次请求成本 + 延迟 P99。多目标。
3. **生成参数** — temperature、top-p、max_tokens。指标：取决于具体任务（输出多样性 vs 确定性）。

### CUPED — 方差缩减

Controlled-experiments Using Pre-Experiment Data（利用实验前数据的受控实验）。在比较实验后数据之前，先回归掉实验前时段的方差。典型方差缩减：30-70%。有效样本量免费提升。

实现方式：Statsig 和 GrowthBook 均已实现。

### 序贯测试

经典 A/B 测试假设固定的样本量。序贯测试（“边看边决策”）在反复查看数据的情况下控制假阳性率。始终有效的序贯方法（mSPRT、Howard 的置信序列）让你可以在出现明显赢家时提前停止。

### 多重比较校正

以 95% 置信度运行 20 次 A/B 测试，会偶然产生一个假阳性。Bonferroni 校正收紧每次检验的 α；Benjamini-Hochberg 控制错误发现率。GrowthBook 两者均已实现。

### SRM — 样本比例不匹配

分配哈希将用户随机分配到各变体。如果 50/50 的分配实际给出 47/53，说明某个环节出了问题——SRM 检查会将其标记出来。两个平台均已实现。

### Statsig vs GrowthBook

**Statsig**:
- 2025 年 9 月被 OpenAI 以 11 亿美元收购。托管式、SaaS。
- 序贯测试、CUPED、保留人群。
- 一体化：feature flags + 实验平台 + 可观测性。
- 最适合：团队本来就想用打包产品，且不在意 OpenAI 所有权。

**GrowthBook**:
- 开源（MIT）；数仓原生（直接从 Snowflake/BigQuery/Redshift 读取）。
- 多引擎：Bayesian、Frequentist、Sequential。
- CUPED、SRM、Bonferroni、BH 校正。
- 可自托管或使用托管云。
- 最适合：数仓 SQL 团队、数据团队掌控指标层、偏好开源。

### 非确定性使功效计算复杂化

相同的提示词会产生不同的输出。传统功效计算假设观测值独立同分布。由于 LLM 的非确定性，有效样本量低于名义样本量。将所需样本量乘以约 1.3-1.5 倍作为安全边际。

### 真实案例结果

- 聊天机器人 reward model 变体：+70% 对话时长，+30% 留存。
- Nextdoor 邮件主题行：优化 reward 函数后 +1% CTR。
- Khan Academy Khanmigo：在延迟与数学准确率之间迭代权衡。

### 反模式：凭感觉上线

每位资深工程师都能举出一个因为“感觉更好”而没有做 A/B 测试就上线的功能。其中大多数都损害了团队数月未曾察觉的产品指标。A/B 测试就是强制性的把关机制。

### 你应该记住的数字

- Statsig 被 OpenAI 收购：11 亿美元，2025 年 9 月。
- GrowthBook：开源 MIT；Bayesian + Frequentist + Sequential。
- CUPED 方差缩减：30-70%。
- LLM 非确定性 → +30-50% 样本量缓冲。

```figure
mx-sequential-test
```

## 实践应用

`code/main.py` 模拟一个分别使用固定边界和序贯边界的序贯 A/B 测试。展示序贯测试如何让你提前停止。

## 上线

本课程生成 `outputs/skill-ab-plan.md`。给定功能变更、工作负载、基线，它会选择平台、门槛和样本量。

## 练习

1. 运行 `code/main.py`。对于基线转化率为 3%、预期提升 5% 的场景，达到 80% 功效需要多大的样本量？
2. 为一个受医疗监管的本地部署客户选择 Statsig 或 GrowthBook。
3. 设计一个 A/B 测试，比较 GPT-4 与 GPT-3.5 的每解决工单成本。主要指标、护栏指标、次要指标各是什么？
4. 你的金丝雀测试通过，但 A/B 显示转化率下降 1.2%。你会上线吗？写出升级判断标准。
5. 将 CUPED 应用于一个方差为实验后时段 60% 的实验前时段。计算有效样本量的提升。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Eval | “离线测试” | 在带标注数据集上评估模型能力 |
| A/B 测试 | “实验” | 在真实用户上进行的随机化对比 |
| CUPED | “方差缩减” | 利用实验前时段回归来降低方差 |
| 序贯测试 | “可以偷看的测试” | 允许提前停止的始终有效方法 |
| 多重比较 | “族错误” | 运行大量测试会放大假阳性 |
| Bonferroni | “严格校正” | 将 α 除以检验次数 |
| Benjamini-Hochberg | “BH FDR” | 控制错误发现率，保守程度更低 |
| SRM | “糟糕的分配” | 样本比例不匹配；分配 bug |
| Statsig | “OpenAI 拥有的” | 商业一体化平台，2025 年被收购 |
| GrowthBook | “那个开源的” | MIT 协议的数仓原生平台 |
| mSPRT | “序贯概率比检验” | 经典序贯方法 |

## 延伸阅读

- [GrowthBook — 如何对 AI 进行 A/B 测试](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/)
- [Statsig — 超越提示词：数据驱动的 LLM 优化](https://www.statsig.com/blog/llm-optimization-online-experimentation)
- [Statsig 与 GrowthBook 对比](https://www.statsig.com/perspectives/ab-testing-feature-flags-comparison-tools)
- [Deng 等人 — CUPED](https://www.exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf)
- [Howard — 置信序列](https://arxiv.org/abs/1810.08240)