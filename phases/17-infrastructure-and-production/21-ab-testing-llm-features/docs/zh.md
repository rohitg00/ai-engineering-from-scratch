# A/B 测试 LLM 功能 — GrowthBook、Statsig 和 Vibes 问题

> 传统的 A/B 测试不是为非确定性 LLM 构建的。关键区别：评估回答"模型能完成工作吗？" A/B 测试回答"用户关心吗？" 两者都需要；仅凭 vibe 检查就发布是有问题的。2026 年要测试的内容：提示工程（措辞）、模型选择（GPT-4 vs GPT-3.5 vs OSS；准确性 vs 成本 vs 延迟）、生成参数（temperature、top-p）。真实案例：聊天机器人奖励模型变体提供 +70% 对话长度和 +30% 保留率；Nextdoor AI 主题行实验在奖励函数优化后提供 +1% CTR；Khan Academy Khanmigo 在延迟-vs-数学准确性轴上迭代。平台拆分：**Statsig**（2025 年 9 月被 OpenAI 以 11 亿美元收购）——序列测试、CUPED、一体化。**GrowthBook**——开源、仓库原生、Bayesian + Frequentist + 序列引擎、CUPED、SRM 检查、Benjamini-Hochberg + Bonferroni 校正。你根据仓库 SQL 偏好以及"被 OpenAI 收购"是否对你的组织重要来选择。

**类型：** 学习
**语言：** Python（标准库、简单的序列测试模拟器）
**先修要求：** 阶段 17 · 13（可观测性）、阶段 17 · 20（渐进式部署）
**时间：** 约 60 分钟

## 学习目标：

- 区分评估（"模型能完成工作吗？"）与 A/B 测试（"用户关心吗？"）。
- 列举三个可测试轴（提示、模型、参数）并为每个选择指标。
- 解释 CUPED、序列测试和 Benjamini-Hochberg 多重比较校正。
- 根据仓库 SQL 立场和公司收购立场选择 Statsig 或 GrowthBook。

## 问题：

你手工调整了系统提示。感觉更好。你发布了它。转换在噪声中变化。你责怪指标。或者你发布了一个新模型，但转换没有移动——模型是降级了还是变化太小而无法检测？你不知道，因为你没有进行 A/B 测试。

每一部分都是可避免的。影子模式会在任何用户看到之前捕获 40% 的成本激增。金丝雀会在点踩移动时停在 10%。策略延迟回滚需要 30 秒。纪律填补了"离线评估看起来不错"和"真实用户满意"之间的空白。

## 概念：

### 评估 vs A/B 测试：

**评估**——离线、标记集、评判（rubric 或 LLM-as-judge 或人工）。回答："在这个固定分布上输出是否正确 / 有帮助 / 安全？"

**A/B 测试**——在线、真实用户、随机化。回答："新变体是否移动了重要的用户级指标？"

两者都需要。评估在暴露之前捕获回归；A/B 在确认后确认产品影响。

### 要测试什么：

1. **提示工程**——措辞、系统提示结构、示例。指标：任务成功率、用户保留率、每次请求成本。
2. **模型选择**——GPT-4 vs GPT-3.5-Turbo vs Llama-OSS。指标：准确性（任务）+ 每次请求成本 + 延迟 P99。多目标。
3. **生成参数**——temperature、top-p、max_tokens。指标：任务特定（输出多样性 vs 确定性）。

### CUPED——方差减少：

使用实验前数据进行受控实验。在比较后时期之前回归出前时期方差。典型方差减少：30-70%。有效样本大小免费增加。

实现：Statsig 和 GrowthBook 都实现。

### 序列测试：

经典 A/B 假设固定样本大小。序列测试（"peek-and-decide"）在重复查看下控制假阳性率。始终有效的序列过程（mSPRT、Howard 的置信序列）让你在早期明确的赢家上提前停止。

### 多重比较校正：

以 95% 置信度运行 20 个 A/B 测试会因机会产生一个假阳性。Bonferroni 校正收紧每个测试的 α；Benjamini-Hochberg 控制错误发现率。GrowthBook 实现两者。

### SRM——样本比率不匹配：

分配哈希将用户随机化到变体中。如果 50/50 分割提供 47/53，则说明某些东西被破坏——SRM 检查标记它。两个平台都实现。

### Statsig vs GrowthBook：

**Statsig**：
- 被 OpenAI 以 11 亿美元收购（2025 年 9 月）。托管、SaaS。
- 序列测试、CUPED、留出人群。
- 一体化：功能标志 + 实验 + 可观测性。
- 最适合：团队已经想要捆绑产品，不在乎 OpenAI 所有权。

**GrowthBook**：
- 开源（MIT）；仓库原生（直接读取 Snowflake/BigQuery/Redshift）。
- 多引擎：Bayesian、Frequentist、序列。
- CUPED、SRM、Bonferroni、BH 校正。
- 自托管或托管云。
- 最适合：仓库 SQL 商店、数据团队控制指标层、想要 OSS。

### 非确定性使力量复杂化：

相同提示产生变化的输出。原因：
- GPU FP 非结合性（浮点约简顺序因批次而异）。
- 批次大小方差（在 128 的批次 vs 16 的批次中相同的提示）。
- 采样（temperature > 0）。

测量：在相同评估集上，运行到运行的准确率变化高达 15%。发布中的"稳定"意味着指标在预期方差范围内，不是与基线相同。在噪声底线之上设置门控。

### 真实案例结果：

- 聊天机器人奖励模型变体：+70% 对话长度，+30% 保留率。
- Nextdoor 主题行：奖励函数优化后 CTR +1%。
- Khan Academy Khanmigo：延迟-vs-数学准确性权衡迭代。

### 反模式：凭 vibe 发布：

每位高级工程师都可以说出一个功能，因为"感觉更好"而没有 A/B 就发布了。他们中的大多数在几个月内都没有注意到团队回归的产品指标。A/B 是强制函数。

### 你应该记住的数字：

- Statsig 被 OpenAI 收购：11 亿美元，2025 年 9 月。
- GrowthBook：开源 MIT；Bayesian + Frequentist + 序列。
- CUPED 方差减少：30-70%。
- LLM 非确定性 → 样本大小安全边际增加约 1.3-1.5 倍。

## 使用它：

`code/main.py` 模拟带有固定和序列边界的 A/B 测试。显示序列如何让你提前停止。

## 交付它：

本课生成 `outputs/skill-ab-plan.md`。给定功能更改、工作负载、基线，选择平台、门控、样本大小。

## 练习：

1. 运行 `code/main.py`。注入 25% 的成本回归。金丝雀在哪个阶段停止？
2. 你的新模型离线准确率提高 3%，但每次请求的成本 +18%。是否可以发布？取决于策略——写下两条路径。
3. 设计一个端到端耗时不到 60 秒的回滚。列出所需的基础设施。
4. 你的评估中非确定性显示 ±7%。设置金丝雀门控，这样你就不会误报。你使用什么乘数？
5. 影子模式在金丝雀之前捕获 40% 的成本激增。写下影子中触发的警报规则。

## 关键术语：

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| 评估 | "离线测试" | 模型能力的标记集评估 |
| A/B 测试 | "实验" | 用户上的实时随机化比较 |
| CUPED | "方差减少" | 前时期回归以减少方差 |
| 序列测试 | "peek-ok 测试" | 允许提前停止的始终有效过程 |
| 多重比较 | "族错误" | 运行许多测试会膨胀假阳性 |
| Bonferroni | "严格校正" | 按测试数量划分 α |
| Benjamini-Hochberg | "BH FDR" | 错误发现率控制，保守性较低 |
| SRM | "错误分割" | 样本比率不匹配；分配错误 |
| Statsig | "OpenAI 拥有" | 商业一体化，2025 年收购 |
| GrowthBook | "OSS 那个" | MIT 仓库原生平台 |

## 延伸阅读：

- [GrowthBook——如何 A/B 测试 AI](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/)
- [Statsig——超越提示：数据驱动的 LLM 优化](https://www.statsig.com/blog/llm-optimization-online-experimentation)
- [Statsig vs GrowthBook 比较](https://www.statsig.com/perspectives/ab-testing-feature-flags-comparison-tools)
- [Deng et al.——CUPED](https://www.exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf)
- [Howard——置信序列](https://arxiv.org/abs/1810.08240)
