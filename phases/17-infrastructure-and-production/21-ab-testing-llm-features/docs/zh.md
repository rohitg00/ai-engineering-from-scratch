# 给 LLM 功能做 A/B 测试 —— GrowthBook、Statsig 与「凭感觉」难题（A/B Testing LLM Features — GrowthBook, Statsig, and the Vibes Problem）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 传统 A/B 测试不是为非确定性的 LLM 设计的。一个关键区分：eval（评估）回答的是「模型能不能干这活？」，A/B 测试回答的是「用户在不在乎？」。两者都不可少；靠「凭感觉（vibe check）」上线的时代结束了。2026 年要测什么：prompt engineering（措辞）、模型选型（GPT-4 vs GPT-3.5 vs OSS；准确率 vs 成本 vs 延迟）、生成参数（temperature、top-p）。真实案例：某 chatbot 的 reward model 变体带来对话长度 +70%、留存 +30%；Nextdoor 的 AI 邮件主题行实验在 reward function 调优后带来 +1% CTR；Khan Academy 的 Khanmigo 在「延迟 vs 数学准确率」这条轴上反复迭代。平台分野：**Statsig**（2025 年 9 月被 OpenAI 以 11 亿美元收购）—— 提供 sequential testing、CUPED，一站式打包。**GrowthBook** —— 开源、warehouse-native（仓库原生），Bayesian + Frequentist + Sequential 三套引擎、CUPED、SRM 校验、Benjamini-Hochberg + Bonferroni 校正。选型取决于你是否偏好 warehouse-SQL，以及「被 OpenAI 收购」对你们组织是不是个加分项。

**Type:** Learn
**Languages:** Python（标准库，玩具级 sequential 测试模拟器）
**Prerequisites:** Phase 17 · 13（Observability，可观测性）、Phase 17 · 20（Progressive Deployment，渐进式部署）
**Time:** ~60 分钟

## 学习目标（Learning Objectives）

- 区分 eval（「模型能不能干这活」）和 A/B 测试（「用户在不在乎」）。
- 列出三条可测的轴（prompt、模型、参数），并为每条挑选合适的指标。
- 解释 CUPED、sequential testing 和 Benjamini-Hochberg 多重比较校正。
- 根据 warehouse-SQL 偏好和对企业收购的态度，在 Statsig 与 GrowthBook 之间做选择。

## 问题（The Problem）

你手工调好了一段 system prompt，感觉更好用了，于是上线。结果转化率的变化淹没在噪声里。你怪指标没选对。又或者你换了个新模型，转化率一动不动 —— 是模型退化了，还是改动太小测不出来？你不知道，因为你没做 A/B 就上线了。

Eval 回答的是模型能不能在一个有标签的集合上完成任务，它回答不了用户是否更喜欢这种输出。只有受控的线上实验才能回答这个问题，而且实验得有足够的统计功效（power）、控制好非确定性、并对多重比较做出校正。

## 概念（The Concept）

### Eval 与 A/B 测试的区别（Evals vs A/B tests）

**Eval** —— 离线、有标签的集合、由评判者打分（rubric、LLM-as-judge 或人工）。回答：「在这个固定分布上，输出是否正确 / 有用 / 安全？」

**A/B 测试** —— 线上、真实用户、随机分流。回答：「新版本是否撬动了我们关心的用户级指标？」

两者缺一不可。Eval 在曝光前抓回归；A/B 在曝光后确认产品影响。

### 测什么（What to test）

1. **Prompt engineering** —— 措辞、system prompt 结构、示例。指标：任务成功率、用户留存、单请求成本。
2. **模型选型（Model selection）** —— GPT-4 vs GPT-3.5-Turbo vs Llama-OSS。指标：准确率（任务）+ 单请求成本 + 延迟 P99。多目标。
3. **生成参数（Generation parameters）** —— temperature、top-p、max_tokens。指标因任务而异（输出多样性 vs 确定性）。

### CUPED —— 方差缩减（CUPED — variance reduction）

Controlled-experiments Using Pre-Experiment Data（用实验前数据做控制的实验）。在比较实验后期数据之前，先把实验前期方差回归掉。典型方差缩减幅度：30–70%。等于免费拿到了更大的有效样本量。

实现：Statsig 和 GrowthBook 都内置。

### Sequential testing（序贯检验）

经典 A/B 假设样本量是固定的。Sequential 检验（「peek-and-decide」边看边定）能在反复偷看的情况下控制假阳率。Always-valid 序贯过程（mSPRT、Howard 的 confidence sequences）允许你在出现明显赢家时提前止盈。

### 多重比较校正（Multiple-comparison corrections）

按 95% 置信度同时跑 20 个 A/B 测试，光靠运气也会冒出一个假阳性。Bonferroni 校正按测试数收紧 α；Benjamini-Hochberg 控制 false-discovery rate（错误发现率）。GrowthBook 两种都实现了。

### SRM —— 样本比例失配（SRM — sample ratio mismatch）

分流哈希把用户随机打到各个变体上。如果 50/50 的切分跑出 47/53，那就是有东西坏了 —— SRM 校验会标红。两个平台都实现了。

### Statsig 与 GrowthBook 对比（Statsig vs GrowthBook）

**Statsig**：
- 2025 年 9 月被 OpenAI 以 11 亿美元收购。托管式 SaaS。
- 支持 sequential testing、CUPED、held-out populations（保留人群）。
- 一站式：feature flag + 实验 + 可观测性。
- 最适合：团队本来就想要打包产品，且不在意 OpenAI 持股。

**GrowthBook**：
- 开源（MIT）；warehouse-native（直接从 Snowflake/BigQuery/Redshift 读数）。
- 多引擎：Bayesian、Frequentist、Sequential。
- CUPED、SRM、Bonferroni、BH 校正。
- 自托管或托管云。
- 最适合：以仓库 SQL 为主的团队，由数据团队掌握指标层，想要开源方案。

### 非确定性让 power 计算更复杂（Non-determinism complicates power）

同样的 prompt 会产生不同的输出。传统的 power 计算假设观测是 IID（独立同分布）的。在 LLM 的非确定性下，有效样本量低于名义样本量。出于安全考虑，把所需样本量乘上 ~1.3–1.5x。

### 真实案例数据（Real case outcomes）

- Chatbot 的 reward model 变体：对话长度 +70%、留存 +30%。
- Nextdoor 邮件主题行：reward function 调优后 CTR +1%。
- Khan Academy Khanmigo：在延迟 vs 数学准确率上反复权衡。

### 反模式：凭感觉上线（The anti-pattern: shipping on vibes）

每个资深工程师都能说出一个「感觉更好」就上线、根本没做 A/B 的功能。这些功能里大多数都偷偷把产品指标拉低了，团队几个月后才发现。A/B 就是那个逼你认真的机制。

### 必须记住的数字（Numbers you should remember）

- Statsig 被 OpenAI 收购：11 亿美元，2025 年 9 月。
- GrowthBook：MIT 开源；Bayesian + Frequentist + Sequential。
- CUPED 方差缩减：30–70%。
- LLM 非确定性 → 样本量 +30–50% 的安全垫。

## 用起来（Use It）

`code/main.py` 模拟了一个带固定边界和序贯边界的 sequential A/B 测试，演示 sequential 是怎么让你提前停止的。

## 上线部署（Ship It）

本课产出 `outputs/skill-ab-plan.md`：给定功能变更、负载与基线，自动选平台、设闸门、估样本量。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。基线转化率 3%、预期提升 5%，要达到 80% power 需要多少样本量？
2. 为一家受医疗合规约束、要求本地部署的客户在 Statsig 和 GrowthBook 之间做选择。
3. 设计一个 A/B 测试，对比 GPT-4 vs GPT-3.5 在「单工单解决成本」上的表现。主指标、guardrail（护栏）指标、次要指标分别是什么？
4. 你的 canary（金丝雀）通过了，但 A/B 显示转化率 -1.2%。你上不上？写下升级判定标准。
5. 把 CUPED 应用到一个前期方差为后期 60% 的 pre-period 上，计算有效样本量的提升幅度。

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 实际是什么 |
|------|----------------|------------|
| Eval | 「离线测试」 | 在有标签集合上对模型能力的评估 |
| A/B 测试 | 「实验」 | 对真实用户的随机对照比较 |
| CUPED | 「方差缩减」 | 用实验前期回归减小方差 |
| Sequential 测试 | 「能偷看的测试」 | Always-valid 过程，允许提前止盈 |
| 多重比较 | 「家族误差」 | 同时跑很多测试会抬高假阳率 |
| Bonferroni | 「严格校正」 | 把 α 除以测试数 |
| Benjamini-Hochberg | 「BH FDR」 | 错误发现率控制，比 Bonferroni 宽松 |
| SRM | 「分流坏了」 | 样本比例失配；分流 bug |
| Statsig | 「OpenAI 旗下那个」 | 商业一站式，2025 年被收购 |
| GrowthBook | 「那个开源的」 | MIT，warehouse-native 平台 |
| mSPRT | 「序贯似然比检验」 | 经典 sequential 过程 |

## 延伸阅读（Further Reading）

- [GrowthBook — How to A/B Test AI](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/)
- [Statsig — Beyond Prompts: Data-Driven LLM Optimization](https://www.statsig.com/blog/llm-optimization-online-experimentation)
- [Statsig vs GrowthBook comparison](https://www.statsig.com/perspectives/ab-testing-feature-flags-comparison-tools)
- [Deng et al. — CUPED](https://www.exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf)
- [Howard — Confidence Sequences](https://arxiv.org/abs/1810.08240)
