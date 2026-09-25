# OpenAI Preparedness Framework 与 DeepMind Frontier Safety Framework

> OpenAI Preparedness Framework v2（2025 年 4 月）引入了 Research Categories —— Long-range Autonomy、Sandbagging、Autonomous Replication and Adaptation、Undermining Safeguards —— 与 Tracked Categories 相区分。Tracked Categories 会触发 Capabilities Reports 以及 Safeguards Reports，由 Safety Advisory Group 审查。DeepMind 的 FSF v3（2025 年 9 月，2026 年 4 月 17 日新增 Tracked Capability Levels）将自主性并入 ML R&D 和 Cyber 领域（ML R&D autonomy level 1 = 以与"人类 + AI 工具"相比具有竞争力的成本完全自动化 AI R&D 流水线）。FSF v3 明确通过针对工具性推理滥用的自动化监控来应对欺骗性对齐。值得诚实指出的：PF v2 中的 Research Categories（包括 Long-range Autonomy）并不会自动触发缓解措施；政策用语是“潜在的（potential）”。DeepMind 自己也承认，如果工具性推理能力增强，自动化监控“长期来看将不再足够”。

**Type:** Learn
**Languages:** Python（标准库，三框架决策表差异工具）
**Prerequisites:** Phase 15 · 19（Anthropic RSP）
**Time:** 约 45 分钟

## 问题所在

第 19 课仔细阅读了 Anthropic 的扩展政策。本课通过阅读 OpenAI 和 DeepMind 的政策来补全全貌。这三份文档是应对同一问题的同类产物——前沿实验室应在何时暂停或对模型设限——它们在一小组类别上趋同，又在若干重要的具体位置上分歧。

趋同之处：三份文档都将长程自主性标记为值得追踪的能力类别。三份文档都承认欺骗性行为（alignment faking、sandbagging）是一类特定风险。三份文档都设有内部审查机构。分歧之处：OpenAI 将类别分为"Tracked"（强制缓解）和"Research"（无自动触发）。DeepMind 将自主性并入两个领域，而非单独命名。各家实验室使用 Tracked 与 Research、Critical 与 Moderate、或 Tier-1 与 Tier-2 等命名；但一项能力落在哪个桶里所导致的操作后果，在各实验室之间是不同的。

把它们放在一起阅读是有价值的练习。同一项能力在 Anthropic 可能属于“强制缓解”，在 OpenAI 属于“监控但不触发”，在 DeepMind 属于“在特定领域内追踪”。政策姿态很重要。

## 核心概念

### OpenAI Preparedness Framework v2（2025 年 4 月）

结构：

- **Tracked Categories**：触发 Capabilities Reports（模型能做什么）以及 Safeguards Reports（已部署哪些缓解措施）。部署前由 Safety Advisory Group 审查。
- **Research Categories**：实验室正在追踪但尚未承诺具体缓解措施的模型能力。包括 Long-range Autonomy、Sandbagging、Autonomous Replication and Adaptation、Undermining Safeguards。

v2 中的关键表述：Research Categories 不会自动触发缓解措施。政策用语是“潜在的”缓解措施。这是需要关注的具体差异：一个类别位于 Tracked 还是 Research，是“设限”与“仅观察”之间的关键分界。

### DeepMind Frontier Safety Framework v3（2025 年 9 月；Tracked Capability Levels 于 2026 年 4 月 17 日新增）

结构：

- **Critical Capability Levels（CCLs）**：横跨五个领域的能力阈值：Cyber、Bio、ML R&D、CBRN、Autonomy（并入 ML R&D 与 Cyber）。
- **Tracked Capability Levels**：2026 年 4 月新增的更细粒度。具体例子：ML R&D autonomy level 1 = 以与"人类 + AI 工具"相比具有竞争力的成本完全自动化 AI R&D 流水线。
- **欺骗性对齐监控**：明确承诺对工具性推理滥用进行自动化监控。

对自主性的框定方式与 OpenAI 不同。DeepMind 没有将"Autonomy"保留为顶层领域；而是将其并入自主性可能造成危害的领域（ML R&D 与 Cyber）。其论点是：脱离领域的自主性是没有风险的能力；反驳的论点是：跨领域的自主性是一种框架应当点名的元风险。

### 三者趋同之处

- 内部 Safety Advisory Group（分别名为 Anthropic SAG、OpenAI SAG、DeepMind 内部委员会）。对高能力模型进行部署前审查。
- 明确提及欺骗性对齐 / alignment faking 作为一类风险。
- 以声明的节奏持续产出文档（Anthropic：Frontier Safety Roadmap、Risk Report；OpenAI：Capabilities 和 Safeguards Reports；DeepMind：FSF 更新周期）。
- 承认仅依赖监控的防御存在上限。DeepMind 明确表示：“自动化监控长期来看将不再足够。”

### 分歧之处

- **Anthropic**：v3.0 中移除了暂停承诺；AI R&D-4 阈值是被点名的下一道关口。
- **OpenAI**：Tracked 与 Research 之分；Research Categories（包括 Long-range Autonomy）不会自动设限。
- **DeepMind**：自主性并入其他领域；Tracked Capability Levels 于 2026 年 4 月增加了粒度。

### Sandbagging：让三者都变得复杂的一项具体能力

Sandbagging（模型在评估中策略性地表现不佳）位列 OpenAI 的 Research Categories。Anthropic 的 RSP v3.0 通过评估情境差距（第 1 课）来应对它。DeepMind 通过 FSF v3 中的欺骗性对齐监控来应对它。

如果模型在评估中 sandbag，那么所有框架的能力阈值都会被低估。框架只有在测量可靠时才有效。这就是为什么除了实验室自我评估之外，还需要外部测量（第 21 课，METR）和对抗性评估。

### 政策阅读技能

- 定位：你关心的每一项能力都应能在政策中找到。如果找不到，政策就没有覆盖它。
- 分类：它是 Tracked（触发缓解）还是 Research（追踪但不触发）？OpenAI 明确命名了这一点；Anthropic 和 DeepMind 各有对应机制。
- 节奏：政策是按声明的时间表更新，还是仅在特定事件之后更新？声明的节奏更强。
- 独立性：外部审查是强制还是可选？Anthropic 与 Apollo 及 US AI Safety Institute 合作；OpenAI 与 METR 合作；DeepMind 主要依赖内部 SAG。

```figure
a5-tracked-vs-research
```

## 实践使用

`code/main.py` 实现了一个小型决策表差异工具。给定一项能力（自主性、欺骗性对齐、R&D 自动化、网络能力提升等），它会输出三份政策各自如何归类该能力，以及会触发哪些缓解措施。它是一个阅读辅助工具，不是政策工具。

## 交付成果

`outputs/skill-cross-policy-diff.md` 以三份框架为参照，针对一项特定能力生成跨政策比较。

## 练习

1. 运行 `code/main.py`。针对至少两项你可以对照原始文档验证的能力，确认差异工具的输出与政策相符。

2. 完整阅读 OpenAI Preparedness Framework v2。列出每一个 Research Category。针对每一个类别，用一句话说明它为何属于 Research 而非 Tracked。

3. 完整阅读 DeepMind FSF v3，以及 2026 年 4 月的 Tracked Capability Levels 更新。找出 ML R&D autonomy level 1 的具体评估标准。你将如何在外部对其进行测量？

4. Sandbagging 位列 OpenAI 的 Research Categories。设计一个评估，迫使 sandbagging 模型暴露其真实能力。参考第 1 课关于评估情境作弊的讨论。

5. 针对一项特定能力（由你选择）比较三份政策。指出你认为哪个政策的分类最严谨、哪个最不严谨，并用原文论证。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|---|---|---|
| Preparedness Framework | “OpenAI 的扩展政策” | PF v2（2025 年 4 月）；Tracked 与 Research 类别之分 |
| Tracked Category | “强制缓解” | 触发 Capabilities + Safeguards Reports；SAG 审查 |
| Research Category | “仅监控” | 追踪但无自动缓解；包括 Long-range Autonomy |
| Frontier Safety Framework | “DeepMind 的扩展政策” | FSF v3（2025 年 9 月）+ Tracked Capability Levels（2026 年 4 月） |
| CCL | “Critical Capability Level” | DeepMind 各领域阈值（Cyber、Bio、ML R&D、CBRN） |
| ML R&D autonomy level 1 | “R&D 自动化” | 以有竞争力的成本完全自动化 AI R&D 流水线 |
| Sandbagging | “策略性表现不佳” | 模型在评估中表现不佳；位列 OpenAI Research Categories |
| Instrumental reasoning | “手段—目的推理” | 关于如何实现目标的推理；DeepMind 监控的对象 |

## 延伸阅读

- [OpenAI — Updating our Preparedness Framework](https://openai.com/index/updating-our-preparedness-framework/) —— v2 发布公告。
- [OpenAI — Preparedness Framework v2 PDF](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf) —— 完整文档。
- [DeepMind — Strengthening our Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) —— FSF v3 发布公告。
- [DeepMind — Updating the Frontier Safety Framework（2026 年 4 月）](https://deepmind.google/blog/updating-the-frontier-safety-framework/) —— Tracked Capability Levels 新增内容。
- [Gemini 3 Pro FSF Report](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_fsf_report.pdf) —— FSF 格式 Risk Report 的示例。