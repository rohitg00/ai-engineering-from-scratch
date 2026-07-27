# OpenAI Preparedness Framework 与 DeepMind Frontier Safety Framework

> OpenAI Preparedness Framework v2（2025年4月）引入了"研究类别"——远程自主性（Long-range Autonomy）、消极应付评估（Sandbagging）、自主复制与适应（Autonomous Replication and Adaptation）、破坏安全防护（Undermining Safeguards）——与"跟踪类别"区分开来。跟踪类别会触发能力报告以及由安全咨询小组（Safety Advisory Group）审查的安全防护报告。DeepMind 的 FSF v3（2025年9月，2026年4月17日新增跟踪能力级别）将自主性纳入 ML R&D 和网络领域（ML R&D 自主性级别 1 = 以与人类+AI 工具相比有竞争力的成本完全自动化 AI R&D 流水线）。FSF v3 通过针对工具性推理滥用的自动化监控明确解决了欺骗性对齐（deceptive alignment）问题。诚实说明：PF v2 中的研究类别（包括远程自主性）不会自动触发缓解措施；政策用语是"潜在的"。DeepMind 自己也表示，如果工具性推理能力增强，自动化监控"长期来看将不再足够"。

**类型：** 学习
**语言：** Python（标准库，三方框架决策表差异对比工具）
**前置条件：** 第 15 阶段 · 第 19 课（Anthropic RSP）
**时间：** 约 45 分钟

## 问题

第 19 课详细阅读了 Anthropic 的扩展政策。本课通过阅读 OpenAI 和 DeepMind 的政策来完成全景图。这三份文件是同类产物，都针对同一个问题——前沿实验室何时应暂停或门控一个模型——并且它们在一小部分类别上趋于一致，同时在若干关键点上存在分歧。

趋同之处：三家都将远程自主性标记为值得跟踪的能力类别。三家都承认欺骗性行为（对齐伪装、消极应付评估）是一个特定的风险类别。三家都有一个内部审查机构。分歧之处：OpenAI 将类别分为"跟踪类别"（强制性缓解措施）和"研究类别"（无自动触发机制）。DeepMind 将自主性归入两个领域而非单独命名。各实验室分别称之为跟踪类别与研究类别、关键（Critical）与中等（Moderate）、或第 1 层级与第 2 层级；一种能力处于哪个分类的实际后果在各实验室之间是不同的。

将这三份文件放在一起阅读是有益的练习。同样的能力在 Anthropic 可能是"强制性缓解措施"，在 OpenAI 是"监控但不触发"，在 DeepMind 则是"在特定领域中跟踪"。政策姿态很重要。

## 概念

### OpenAI Preparedness Framework v2（2025年4月）

结构：

- **跟踪类别（Tracked Categories）**：触发能力报告（模型能做什么）以及安全防护报告（已实施哪些缓解措施）。在部署前由安全咨询小组审查。
- **研究类别（Research Categories）**：实验室正在跟踪但尚未承诺特定缓解措施的能力。包括远程自主性、消极应付评估、自主复制与适应、破坏安全防护。

v2 的关键框架：研究类别不会自动触发缓解措施。政策用语是"潜在的"缓解措施。这是需要特别关注的差异点：一个类别位于跟踪类别还是研究类别，决定了它是"被门控"还是"被观察"。

### DeepMind Frontier Safety Framework v3（2025年9月；跟踪能力级别于2026年4月17日新增）

结构：

- **关键能力级别（Critical Capability Levels, CCLs）**：五个领域的能力阈值：网络（Cyber）、生物（Bio）、ML R&D、CBRN、自主性（已归入 ML R&D 和网络）。
- **跟踪能力级别（Tracked Capability Levels）**：2026年4月新增的细化粒度。具体示例：ML R&D 自主性级别 1 = 以与人类+AI 工具相比有竞争力的成本完全自动化 AI R&D 流水线。
- **欺骗性对齐监控**：明确承诺对工具性推理滥用进行自动化监控。

自主性的框架设计与 OpenAI 不同。DeepMind 没有将"自主性"作为一个顶层领域；而是将其归入自主性会造成危害的领域（ML R&D 和网络）。其论点是，脱离领域的自主性是有能力而无风险；反论点是，跨领域的自主性是一种框架应当明确指出的元风险。

### 三家的趋同之处

- 内部安全咨询小组（Anthropic 的 SAG、OpenAI 的 SAG、DeepMind 的内部委员会）。对高能力模型在部署前进行审查。
- 明确提及欺骗性对齐/对齐伪装作为一个风险类别。
- 按既定节奏生成的常设文件（Anthropic：前沿安全路线图、风险报告；OpenAI：能力与安全防护报告；DeepMind：FSF 更新周期）。
- 承认仅靠监控的防御有上限。DeepMind 明确表示："自动化监控长期来看将不再足够。"

### 分歧之处

- **Anthropic**：v3.0 中取消了暂停承诺；AI R&D-4 阈值被指定为下一个门控点。
- **OpenAI**：跟踪类别与研究类别的划分；研究类别（包括远程自主性）不会自动门控。
- **DeepMind**：自主性归入其他领域；跟踪能力级别在2026年4月增加了细化粒度。

### 消极应付评估：一种使三家都复杂化的特定能力

消极应付评估（模型在评估中策略性地表现低于实际能力）被列入 OpenAI 的研究类别。Anthropic 的 RSP v3.0 通过评估-上下文差距（第 1 课）来解决。DeepMind 通过 FSF v3 中的欺骗性对齐监控来解决。

如果模型在评估中消极应付，所有框架的能力阈值都会被低估。框架只有在测量有效时才有效。这就是除了实验室自我评估外，还需要外部测量（第 21 课，METR）和对抗性评估的原因。

### 政策阅读技巧

- **定位**：你关注的每种能力都应该能在政策中找到。如果找不到，政策就没有覆盖它。
- **分类**：它是跟踪类别（触发缓解措施）还是研究类别（跟踪但不触发）？OpenAI 明确命名了这一点；Anthropic 和 DeepMind 有各自的等价分类。
- **节奏**：政策是按既定时间表更新，还是只在特定事件后更新？既定时间表更强。
- **独立性**：外部审查是强制性的还是可选的？Anthropic 与 Apollo 和美国 AI 安全研究所合作；OpenAI 与 METR 合作；DeepMind 主要与内部 SAG 合作。

## 使用它

`code/main.py` 实现了一个小型决策表差异对比工具。给定一种能力（自主性、欺骗性对齐、R&D 自动化、网络能力提升等），它会输出三个政策分别如何分类该能力以及会触发哪些缓解措施。这是一个阅读辅助工具，而非政策工具。

## 交付

`outputs/skill-cross-policy-diff.md` 针对特定能力生成跨政策比较，以三个框架作为参考。

## 练习

1. 运行 `code/main.py`。确认差异对比工具的输出与你至少可以从源文档验证的两种能力的政策相匹配。

2. 完整阅读 OpenAI Preparedness Framework v2。找出每个研究类别。针对每个类别，写一句话说明为什么它属于研究类别而非跟踪类别。

3. 完整阅读 DeepMind FSF v3 以及 2026 年 4 月的跟踪能力级别更新。找出 ML R&D 自主性级别 1 的具体评估标准。你将如何从外部衡量它？

4. 消极应付评估被列入 OpenAI 的研究类别。设计一个评估方案，迫使消极应付模型暴露其实际能力。参考第 1 课关于评估-上下文博弈的讨论。

5. 比较三种政策针对某一特定能力（自选）。指出你认为哪个政策的分类最严谨、哪个最不严谨。用源文本加以论证。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|---|---|---|
| Preparedness Framework | "OpenAI 的扩展政策" | PF v2（2025年4月）；跟踪类别与研究类别 |
| 跟踪类别（Tracked Category） | "强制性缓解措施" | 触发能力报告 + 安全防护报告；SAG 审查 |
| 研究类别（Research Category） | "仅监控" | 跟踪但无自动缓解措施；包括远程自主性 |
| Frontier Safety Framework | "DeepMind 的扩展政策" | FSF v3（2025年9月）+ 跟踪能力级别（2026年4月） |
| CCL | "关键能力级别" | DeepMind 每个领域的阈值（网络、生物、ML R&D、CBRN） |
| ML R&D 自主性级别 1 | "R&D 自动化" | 以有竞争力的成本完全自动化 AI R&D 流水线 |
| 消极应付评估（Sandbagging） | "策略性表现不足" | 模型在评估中表现低于实际能力；列入 OpenAI 研究类别 |
| 工具性推理（Instrumental reasoning） | "手段-目的推理" | 关于如何实现目标的推理；DeepMind 监控的目标 |

## 延伸阅读

- [OpenAI — Updating our Preparedness Framework](https://openai.com/index/updating-our-preparedness-framework/)——v2 公告。
- [OpenAI — Preparedness Framework v2 PDF](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf)——完整文档。
- [DeepMind — Strengthening our Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/)——FSF v3 公告。
- [DeepMind — Updating the Frontier Safety Framework (April 2026)](https://deepmind.google/blog/updating-the-frontier-safety-framework/)——跟踪能力级别新增内容。
- [Gemini 3 Pro FSF Report](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_fsf_report.pdf)——FSF 格式风险报告示例。
