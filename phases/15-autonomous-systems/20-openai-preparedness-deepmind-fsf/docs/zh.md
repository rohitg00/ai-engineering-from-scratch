# 20 · OpenAI 准备度框架与 DeepMind 前沿安全框架

> OpenAI 准备度框架（Preparedness Framework）v2（2025 年 4 月）引入了「研究类别（Research Categories）」——长程自主性（Long-range Autonomy）、刻意藏拙（Sandbagging）、自主复制与适应（Autonomous Replication and Adaptation）、破坏防护措施（Undermining Safeguards）——它们与「追踪类别（Tracked Categories）」相区别。追踪类别会触发「能力报告（Capabilities Reports）」与「防护措施报告（Safeguards Reports）」，并交由「安全咨询小组（Safety Advisory Group）」审查。DeepMind 的 FSF v3（2025 年 9 月，并在 2026 年 4 月 17 日新增了「追踪能力等级（Tracked Capability Levels）」）将自主性并入「机器学习研发（ML R&D）」与「网络安全（Cyber）」两个领域（ML R&D 自主性 1 级 = 以相对于人类 + AI 工具具有竞争力的成本，完全自动化 AI 研发流程）。FSF v3 明确通过对工具性推理（instrumental-reasoning）滥用的自动化监控来应对欺骗性对齐（deceptive alignment）。一个诚实的提醒：PF v2 中的研究类别（包括长程自主性）并不会自动触发缓解措施；政策用语是「潜在（potential）」。DeepMind 自己也承认，如果工具性推理增强，自动化监控「长期来看将不再足够」。

**类型：** 学习
**语言：** Python（标准库，三框架决策表 diff 工具）
**前置：** 阶段 15 · 19（Anthropic RSP）
**时长：** 约 45 分钟

## 问题所在

第 19 课细读了 Anthropic 的扩展策略。本课通过细读 OpenAI 和 DeepMind 的策略来补全全貌。这三份文档是处理同一个问题的同源产物——一家前沿实验室在什么时候应当暂停或对模型设卡——它们在一小组类别上趋同，又在若干关键的具体之处分歧。

趋同之处：三者都把长程自主性标注为一类值得追踪的能力。三者都承认欺骗性行为（对齐伪装（alignment faking）、刻意藏拙）是一类特定风险。三者都有一个内部审查机构。分歧之处：OpenAI 将类别拆分为「追踪（Tracked）」（强制缓解）与「研究（Research）」（不自动触发）。DeepMind 把自主性并入两个领域，而不是单独命名。各实验室称之为「追踪 vs 研究」、或「关键 vs 中等」、或「一级 vs 二级」；某一能力落入哪个桶，其运营后果在各实验室之间是不同的。

把它们放在一起读才是有用的练习。同一项能力，在 Anthropic 可能是「强制缓解」，在 OpenAI 是「受监控但不触发」，在 DeepMind 则是「在特定领域内被追踪」。政策姿态很重要。

## 概念

### OpenAI 准备度框架 v2（2025 年 4 月）

结构：

- **追踪类别（Tracked Categories）**：触发「能力报告（Capabilities Reports）」（模型能做什么）以及「防护措施报告（Safeguards Reports）」（已部署哪些缓解措施）。在部署前由「安全咨询小组（Safety Advisory Group）」审查。
- **研究类别（Research Categories）**：实验室正在追踪、但尚未承诺具体缓解措施的模型能力。包括长程自主性、刻意藏拙、自主复制与适应、破坏防护措施。

v2 中的关键定调：研究类别不会自动触发缓解措施。政策用语是「潜在（potential）」缓解措施。这正是需要留意的具体差异：一个类别落在追踪还是研究，是「设卡」与「观察」之间的枢纽。

### DeepMind 前沿安全框架 v3（2025 年 9 月；追踪能力等级于 2026 年 4 月 17 日新增）

结构：

- **关键能力等级（Critical Capability Levels，CCLs）**：横跨五个领域的能力阈值：网络安全（Cyber）、生物（Bio）、机器学习研发（ML R&D）、化生放核（CBRN）、自主性（Autonomy，并入 ML R&D 与 Cyber）。
- **追踪能力等级（Tracked Capability Levels）**：2026 年 4 月新增的更细粒度划分。具体示例：ML R&D 自主性 1 级 = 以相对于人类 + AI 工具具有竞争力的成本，完全自动化 AI 研发流程。
- **欺骗性对齐监控**：明确承诺对工具性推理滥用进行自动化监控。

其自主性的定调与 OpenAI 不同。DeepMind 不把「自主性」保留为一个顶级领域；它被并入了自主性会造成危害的那些领域（ML R&D 与 Cyber）。其论点是：脱离领域的自主性是有能力而无风险；而反论点是：跨领域的自主性本身是一种元风险（meta-risk），框架应当为其命名。

### 三者趋同之处

- 内部安全咨询小组（Anthropic 称 SAG，OpenAI 称 SAG，DeepMind 为内部委员会）。对高能力模型在部署前进行审查。
- 明确将欺骗性对齐 / 对齐伪装提及为一类风险。
- 按既定节奏发布的常态化产物（Anthropic：前沿安全路线图（Frontier Safety Roadmap）、风险报告（Risk Report）；OpenAI：能力与防护措施报告；DeepMind：FSF 更新周期）。
- 承认「仅靠监控」的防御存在上限。DeepMind 直言：「自动化监控长期来看将不再足够。」

### 三者分歧之处

- **Anthropic**：v3.0 中移除了暂停承诺；AI R&D-4 阈值是被点名的下一个关卡。
- **OpenAI**：追踪 vs 研究的拆分；研究类别（包括长程自主性）不会自动设卡。
- **DeepMind**：自主性并入其他领域；追踪能力等级在 2026 年 4 月增加了粒度。

### 刻意藏拙：一项让三者都复杂化的特定能力

刻意藏拙（sandbagging，模型在评估中策略性地表现不佳）位于 OpenAI 的研究类别中。Anthropic 的 RSP v3.0 通过「评估—情境鸿沟」（evaluation-context gap，第 1 课）来应对它。DeepMind 在 FSF v3 中通过欺骗性对齐监控来应对它。

如果一个模型在评估中刻意藏拙，那么每个框架的能力阈值都会被低估。框架要奏效，前提是测量奏效。这正是为什么除了实验室自评之外，还必须有外部测量（第 21 课，METR）和对抗性评估。

### 政策研读技能

- 定位（Locate）：你关心的每一项能力，都应当能在政策中找到。如果找不到，政策就没有覆盖它。
- 归类（Classify）：它是追踪（触发缓解）还是研究（被追踪但不触发）？OpenAI 为此命名；Anthropic 与 DeepMind 各有其对应物。
- 节奏（Cadence）：政策是按既定时间表更新，还是仅在特定事件后更新？既定节奏更强。
- 独立性（Independence）：外部审查是强制的还是可选的？Anthropic 与 Apollo 及美国 AI 安全研究所（US AI Safety Institute）合作；OpenAI 与 METR 合作；DeepMind 主要依靠内部 SAG。

## 动手用

`code/main.py` 实现了一个小型的决策表 diff 工具。给定一项能力（自主性、欺骗性对齐、研发自动化、网络能力提升等），它会输出三份政策中每一份如何对该能力进行归类，以及会触发哪些缓解措施。它是一个研读辅助工具，而非政策工具。

## 交付它

`outputs/skill-cross-policy-diff.md` 针对某一项特定能力，以这三个框架为参照，生成一份跨政策对比。

## 练习

1. 运行 `code/main.py`。确认该 diff 工具的输出，与你能对照源文档核实的至少两项能力相符。

2. 完整阅读 OpenAI 准备度框架 v2。找出其中每一个研究类别。对每一个，用一句话说明它为何被归入研究而非追踪。

3. 完整阅读 DeepMind FSF v3，外加 2026 年 4 月的追踪能力等级更新。找出 ML R&D 自主性 1 级的具体评估标准。你会如何从外部测量它？

4. 刻意藏拙位于 OpenAI 的研究类别中。设计一个能迫使一个刻意藏拙的模型暴露其真实能力的评估。参考第 1 课中关于「评估情境作弊（eval-context-gaming）」的讨论。

5. 就某一项特定能力（你自己选）对比这三份政策。指出你认为哪份政策的归类最严谨、哪份最不严谨。用源文本加以论证。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|---|---|---|
| Preparedness Framework（准备度框架） | "OpenAI 的扩展策略" | PF v2（2025 年 4 月）；追踪 vs 研究类别 |
| Tracked Category（追踪类别） | "强制缓解" | 触发能力 + 防护措施报告；SAG 审查 |
| Research Category（研究类别） | "仅受监控" | 被追踪但无自动缓解；包括长程自主性 |
| Frontier Safety Framework（前沿安全框架） | "DeepMind 的扩展策略" | FSF v3（2025 年 9 月）+ 追踪能力等级（2026 年 4 月） |
| CCL | "关键能力等级" | DeepMind 按领域设定的阈值（Cyber、Bio、ML R&D、CBRN） |
| ML R&D autonomy level 1（ML R&D 自主性 1 级） | "研发自动化" | 以具有竞争力的成本完全自动化 AI 研发流程 |
| Sandbagging（刻意藏拙） | "策略性表现不佳" | 模型在评估中表现不佳；位于 OpenAI 研究类别 |
| Instrumental reasoning（工具性推理） | "手段—目的推理" | 关于如何达成目标的推理；DeepMind 监控的对象 |

## 延伸阅读

- [OpenAI — Updating our Preparedness Framework](https://openai.com/index/updating-our-preparedness-framework/) — v2 发布公告。
- [OpenAI — Preparedness Framework v2 PDF](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf) — 完整文档。
- [DeepMind — Strengthening our Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — FSF v3 发布公告。
- [DeepMind — Updating the Frontier Safety Framework (April 2026)](https://deepmind.google/blog/updating-the-frontier-safety-framework/) — 追踪能力等级新增内容。
- [Gemini 3 Pro FSF Report](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_fsf_report.pdf) — FSF 格式风险报告的示例。
