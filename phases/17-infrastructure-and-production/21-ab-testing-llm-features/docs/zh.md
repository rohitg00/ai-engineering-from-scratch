# LLM 功能的 A/B 测试 —— GrowthBook、Statsig 与"感觉"问题

> 传统的 A/B 测试并非为非确定性的 LLM 而设计。关键区别在于：评估（evals）回答"模型能完成任务吗？"，A/B 测试回答"用户在意吗？"两者缺一不可；仅凭"感觉"上线已成为过去。2026 年需要测试的内容：提示工程（措辞）、模型选择（GPT-4 vs GPT-3.5 vs 开源；准确率 vs 成本 vs 延迟）、生成参数（temperature、top-p）。真实案例：某聊天机器人奖励模型变体带来对话时长 +70%、留存率 +30%；Nextdoor AI 主题行实验在奖励函数优化后带来 CTR +1%；Khan Academy 的 Khanmigo 在延迟与数学准确率之间反复迭代。平台格局：**Statsig**（2025 年 9 月被 OpenAI 以 11 亿美元收购）—— 序贯测试、CUPED、一体化。**GrowthBook** —— 开源、数仓原生、贝叶斯 + 频率派 + 序贯引擎、CUPED、SRM 检查、Benjamini-Hochberg + Bonferroni 校正。根据你对数仓 SQL 的偏好以及"被 OpenAI 收购"是否对你的组织有影响来做选择。

**类型：** 学习
**语言：** Python（标准库，简易序贯测试模拟器）
**前置知识：** 第 17 阶段 · 13（可观测性）、第 17 阶段 · 20（渐进式部署）
**时间：** ~60 分钟

## 学习目标

- 区分评估（"模型能完成任务"）与 A/B 测试（"用户是否在意"）。
- 列举三个可测试维度（提示、模型、参数）并为每个选择合适的指标。
- 解释 CUPED、序贯测试以及 Benjamini-Hochberg 多重比较校正。
- 根据数仓 SQL 立场与企业收购态度选择 Statsig 或 GrowthBook。

## 问题背景

你手工调优了一个系统提示。感觉更好了。你直接上线。转化率在噪声中波动。你怪指标。或者你上线了一个新模型，转化率没有变化 —— 是模型退化了，还是变化太小无法检测？你不知道，因为你没有 A/B 测试就上线了。

评估回答模型在标注集上能否完成任务。它们不回答用户是否更喜欢输出。只有受控的在线实验能回答这个问题，而且只有当实验具备足够的统计功效、控制了非确定性并校正了多重比较时才行。

## 核心概念

### 评估 vs A/B 测试

**评估（Evals）** —— 离线、标注集、评判者（评分标准或 LLM-as-judge 或人工）。回答："输出在这个固定分布上是否正确 / 有帮助 / 安全？"

**A/B 测试** —— 在线、真实用户、随机化。回答："新变体是否推动了关键的用户级指标？"

两者缺一不可。评估在暴露前发现退化；A/B 在上线后确认产品影响。

### 测试什么

1. **提示工程** —— 措辞、系统提示结构、示例。指标：任务成功率、用户留存、单次请求成本。
2. **模型选择** —— GPT-4 vs GPT-3.5-Turbo vs Llama 开源。指标：准确率（任务）+ 单次请求成本 + 延迟 P99。多目标优化。
3. **生成参数** —— temperature、top-p、max_tokens。指标：任务特定（输出多样性 vs 确定性）。

### CUPED —— 方差缩减

Controlled-experiments Using Pre-Experiment Data（使用实验前数据的对照实验）。在比较后周期之前，先回归掉前周期的方差。典型方差缩减：30–70%。有效样本量免费提升。

实现：Statsig 和 GrowthBook 均内置。

### 序贯测试

经典 A/B 假设固定样本量。序贯测试（"偷看并决定"）在反复查看下控制假阳性率。始终有效的序贯方法（mSPRT、Howard 置信序列）允许你在明显胜出时提前停止。

### 多重比较校正

以 95% 置信度运行 20 个 A/B 测试，会随机产生一个假阳性。Bonferroni 校正收紧每测试的 α；Benjamini-Hochberg 控制错误发现率（FDR）。GrowthBook 两者均实现。

### SRM —— 样本比例不匹配

分配哈希将用户随机分配到变体。如果 50/50 拆分实际为 47/53，说明有问题 —— SRM 检查会标记。两个平台均实现。

### Statsig vs GrowthBook

**Statsig**：
- 2025 年 9 月被 OpenAI 以 11 亿美元收购。托管 SaaS。
- 序贯测试、CUPED、保留人群。
- 一体化：功能开关 + 实验 + 可观测性。
- 最佳场景：团队想要一体化产品，不介意 OpenAI 所有权。

**GrowthBook**：
- 开源（MIT）；数仓原生（直接从 Snowflake/BigQuery/Redshift 读取）。
- 多引擎：贝叶斯、频率派、序贯。
- CUPED、SRM、Bonferroni、BH 校正。
- 可自托管或托管云。
- 最佳场景：数仓 SQL 团队、数据团队控制指标层、想要开源。

### 非确定性使功效计算复杂化

相同 prompt 产生不同输出。传统的功效计算假设独立同分布（IID）观测。在 LLM 非确定性下，有效样本量低于名义值。将所需样本量乘以约 1.3–1.5 倍作为安全边际。

### 真实案例结果

- 聊天机器人奖励模型变体：对话时长 +70%，留存率 +30%。
- Nextdoor 主题行：奖励函数优化后 CTR +1%。
- Khan Academy Khanmigo：延迟与数学准确率之间的反复权衡。

### 反模式：凭感觉上线

每位资深工程师都能说出一个因为"感觉更好"而没有 A/B 测试就上线的功能。其中大多数在产品指标上出现了退化，团队数月后才注意到。A/B 测试是强制约束。

### 需要记住的数字

- Statsig 被 OpenAI 收购：11 亿美元，2025 年 9 月。
- GrowthBook：开源 MIT；贝叶斯 + 频率派 + 序贯。
- CUPED 方差缩减：30–70%。
- LLM 非确定性 → 样本量缓冲 +30–50%。

## 使用

`code/main.py` 模拟一个带有固定边界和序贯边界的序贯 A/B 测试。展示序贯测试如何让你提前停止。

## 交付

本课产出 `outputs/skill-ab-plan.md`。给定功能变更、工作负载、基线，选择平台、门槛与样本量。

## 练习

1. 运行 `code/main.py`。对于预期 5% 提升、基线转化率 3% 的场景，达到 80% 功效需要多少样本量？
2. 为一家受医疗监管、需要本地部署的客户选择 Statsig 或 GrowthBook。
3. 设计一个 A/B 测试，比较 GPT-4 与 GPT-3.5 在每张已解决工单成本上的表现。主要指标、护栏指标、次要指标分别是什么？
4. 你的 canary 通过了，但 A/B 显示转化率 -1.2%。你上线吗？写出升级标准。
5. 对前周期方差为后周期 60% 的场景应用 CUPED。计算有效样本量的提升倍数。

## 关键术语

| 术语 | 业界说法 | 实际含义 |
|------|---------|---------|
| Eval | "offline test" | 在标注集上评估模型能力 |
| A/B test | "experiment" | 在真实用户上的随机对照实验 |
| CUPED | "variance reduction" | 用前周期回归降低方差 |
| Sequential test | "peek-ok test" | 始终有效的方法，允许提前停止 |
| Multiple comparison | "the family error" | 测试越多，假阳性越膨胀 |
| Bonferroni | "tight correction" | 将 α 除以测试数量 |
| Benjamini-Hochberg | "BH FDR" | 控制错误发现率，不那么保守 |
| SRM | "bad split" | 样本比例不匹配；分配存在 bug |
| Statsig | "OpenAI owned" | 商业一体化平台，2025 年被收购 |
| GrowthBook | "the OSS one" | MIT 数仓原生平台 |
| mSPRT | "sequential probability ratio test" | 经典序贯方法 |

## 延伸阅读

- [GrowthBook — How to A/B Test AI](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/)
- [Statsig — Beyond Prompts: Data-Driven LLM Optimization](https://www.statsig.com/blog/llm-optimization-online-experimentation)
- [Statsig vs GrowthBook comparison](https://www.statsig.com/perspectives/ab-testing-feature-flags-comparison-tools)
- [Deng et al. — CUPED](https://www.exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf)
- [Howard — Confidence Sequences](https://arxiv.org/abs/1810.08240)
