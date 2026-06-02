# OpenAI Preparedness Framework 与 DeepMind Frontier Safety Framework

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> OpenAI Preparedness Framework v2（2025 年 4 月）引入了 Research Categories（研究类）——Long-range Autonomy（长程自主）、Sandbagging（藏拙）、Autonomous Replication and Adaptation（自主复制与适应）、Undermining Safeguards（破坏防护措施）——与 Tracked Categories（跟踪类）相区分。Tracked Categories 会触发 Capabilities Reports（能力报告）外加 Safeguards Reports（防护报告），由 Safety Advisory Group（安全咨询组）审阅。DeepMind 的 FSF v3（2025 年 9 月，并于 2026 年 4 月 17 日新增 Tracked Capability Levels）把 autonomy（自主性）折叠进 ML R&D 与 Cyber 两个 domain（领域）（ML R&D autonomy level 1 = 以与人类 + AI 工具相比有竞争力的成本完全自动化整条 AI R&D 流水线）。FSF v3 明确提出通过自动化监控来应对 deceptive alignment（伪装对齐）下 instrumental reasoning（工具性推理）的滥用。一句老实话：PF v2 的 Research Categories（含 Long-range Autonomy）并不会自动触发缓解措施；政策原文用的是「potential（潜在）」。DeepMind 自己也承认，如果工具性推理变得更强，自动化监控「will not remain sufficient long-term（长期来看将不再够用）」。

**Type:** Learn
**Languages:** Python（标准库，三框架决策表 diff 工具）
**Prerequisites:** Phase 15 · 19 (Anthropic RSP)
**Time:** ~45 minutes

## 问题（The Problem）

第 19 课细读了 Anthropic 的 scaling 政策。本课读 OpenAI 与 DeepMind 的同类文件，把这幅图补完。三份文档是互为表亲的产物，回答同一个问题——前沿实验室什么时候应该暂停或对一个模型加闸——它们在一小撮共同类别上趋同，又在若干关键之处分歧。

趋同之处：三家都把 long-range autonomy 列为值得跟踪的能力类别；三家都把欺骗行为（alignment faking、sandbagging）认作具体的风险类别；三家都设有内部审查机构。分歧之处：OpenAI 把类别拆为「Tracked（强制缓解）」和「Research（无自动触发）」；DeepMind 不单独命名 autonomy，而是把它折叠进两个 domain；各家或叫 Tracked vs Research，或叫 Critical vs Moderate，或叫 Tier-1 vs Tier-2；同一种能力落在哪个桶里，操作后果在不同实验室是不一样的。

把它们放在一起读才是有用的练习。同一种能力，在 Anthropic 可能是「强制缓解」，在 OpenAI 可能是「监控但不触发」，在 DeepMind 可能是「在某个特定 domain 内被跟踪」。政策姿态本身就有意义。

## 概念（The Concept）

### OpenAI Preparedness Framework v2（2025 年 4 月）

结构：

- **Tracked Categories（跟踪类）**：触发 Capabilities Reports（模型能干什么）外加 Safeguards Reports（部署了哪些缓解措施）。部署前由 Safety Advisory Group 审阅。
- **Research Categories（研究类）**：实验室正在跟踪、但尚未承诺具体缓解措施的模型能力。包括 Long-range Autonomy、Sandbagging、Autonomous Replication and Adaptation、Undermining Safeguards。

v2 的关键说法：Research Categories 不会自动触发缓解措施。政策原文用的是「potential（潜在）」缓解。这正是要盯紧的差异点：一个类别落在 Tracked 还是 Research，是「加闸」与「观察」之间的转轴。

### DeepMind Frontier Safety Framework v3（2025 年 9 月；Tracked Capability Levels 于 2026 年 4 月 17 日加入）

结构：

- **Critical Capability Levels（CCLs，关键能力等级）**：跨五个 domain 的能力阈值——Cyber、Bio、ML R&D、CBRN、Autonomy（折叠进 ML R&D 与 Cyber）。
- **Tracked Capability Levels（跟踪能力等级）**：2026 年 4 月新增的更细粒度。具体例子：ML R&D autonomy level 1 = 以与人类 + AI 工具相比有竞争力的成本完全自动化整条 AI R&D 流水线。
- **Deceptive alignment 监控**：明确承诺通过自动化监控来应对工具性推理的滥用。

这里对 autonomy 的定位与 OpenAI 不同。DeepMind 不把「Autonomy」留作顶层 domain，而是把它折叠进 autonomy 真正会造成危害的 domain（ML R&D 与 Cyber）。其论点是：脱离 domain 的 autonomy 是有能力而无风险；反方论点是：跨 domain 的 autonomy 是一种元风险，框架应该单独命名它。

### 三家共同的趋同点

- 内部 Safety Advisory Group（分别叫 Anthropic SAG、OpenAI SAG、DeepMind 内部委员会）。高能力模型部署前要过审。
- 明确把 deceptive alignment / alignment faking 列为风险类别。
- 按照声明的节奏发布常态化产物（Anthropic：Frontier Safety Roadmap、Risk Report；OpenAI：Capabilities and Safeguards Reports；DeepMind：FSF 更新周期）。
- 承认仅靠监控的防御有上限。DeepMind 说得最直白：「automated monitoring will not remain sufficient long-term（自动化监控长期来看将不再够用）」。

### 三家分歧之处

- **Anthropic**：v3.0 移除了暂停承诺；AI R&D-4 阈值是被点名的下一道闸。
- **OpenAI**：Tracked 与 Research 二分；Research Categories（含 Long-range Autonomy）不自动加闸。
- **DeepMind**：autonomy 折叠进其他 domain；2026 年 4 月新增 Tracked Capability Levels 增加细粒度。

### Sandbagging：让三家框架都打结的一种具体能力

Sandbagging（模型在评估中策略性地表现得不如真实水平）落在 OpenAI 的 Research Categories 里。Anthropic 的 RSP v3.0 通过评估上下文鸿沟（第 1 课）来处理它。DeepMind 在 FSF v3 中通过 deceptive alignment 监控来处理它。

如果模型在评估时藏拙，那么所有框架的能力阈值都会被低估。框架奏效的前提是测量奏效。这就是为什么除了实验室自评之外，还必须有外部测量（第 21 课，METR）和对抗式评估。

### 读政策的技能

- 定位：你关心的每一种能力都应该能在政策里被找到。找不到，就说明政策没覆盖。
- 分类：它是 Tracked（触发缓解）还是 Research（被跟踪但不触发）？OpenAI 给这件事起了名字；Anthropic 和 DeepMind 各有等效说法。
- 节奏：政策是按声明的时间表更新，还是只在某些事件之后才更新？声明节奏更强。
- 独立性：外部审查是强制还是可选？Anthropic 与 Apollo 及 US AI Safety Institute 合作；OpenAI 与 METR 合作；DeepMind 主要靠内部 SAG。

## 用起来（Use It）

`code/main.py` 实现了一个小型的决策表 diff 工具。给定一种能力（autonomy、deceptive alignment、R&D 自动化、cyber 提升等），它会输出三家政策各自如何分类该能力、以及会触发哪些缓解措施。它是一个读政策的辅助工具，不是政策工具本身。

## 上线部署（Ship It）

`outputs/skill-cross-policy-diff.md` 针对某项具体能力产出跨政策对照，把三家框架作为参照。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。挑至少两项你能在原文档里核对的能力，确认 diff 工具的输出与政策一致。

2. 通读 OpenAI Preparedness Framework v2。识别每一个 Research Category。逐项写一句话，解释它为什么落在 Research 而非 Tracked。

3. 通读 DeepMind FSF v3，再加上 2026 年 4 月的 Tracked Capability Levels 更新。找出 ML R&D autonomy level 1 的具体评估标准。换你来从外部测它，你会怎么测？

4. Sandbagging 在 OpenAI 的 Research Categories 里。设计一项评估，迫使一个会藏拙的模型暴露真实能力。参考第 1 课关于评估上下文博弈的讨论。

5. 选一项具体能力，比较三家政策。指出哪家政策的分类你觉得最严谨、哪家最弱。用原文证据做支撑。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|---|---|---|
| Preparedness Framework | 「OpenAI 的 scaling 政策」 | PF v2（2025 年 4 月）；Tracked 与 Research 二分 |
| Tracked Category | 「强制缓解」 | 触发 Capabilities + Safeguards Reports；SAG 审查 |
| Research Category | 「只监控」 | 被跟踪但无自动缓解；含 Long-range Autonomy |
| Frontier Safety Framework | 「DeepMind 的 scaling 政策」 | FSF v3（2025 年 9 月）+ Tracked Capability Levels（2026 年 4 月） |
| CCL | 「Critical Capability Level」 | DeepMind 各 domain 阈值（Cyber、Bio、ML R&D、CBRN） |
| ML R&D autonomy level 1 | 「R&D 自动化」 | 以有竞争力的成本完全自动化 AI R&D 流水线 |
| Sandbagging | 「策略性低表现」 | 模型在评估中藏拙；在 OpenAI Research Categories 中 |
| Instrumental reasoning | 「工具性推理 / 手段-目的推理」 | 关于如何达成目标的推理；DeepMind 监控的对象 |

## 延伸阅读（Further Reading）

- [OpenAI — Updating our Preparedness Framework](https://openai.com/index/updating-our-preparedness-framework/) —— v2 公告。
- [OpenAI — Preparedness Framework v2 PDF](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf) —— 完整文档。
- [DeepMind — Strengthening our Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) —— FSF v3 公告。
- [DeepMind — Updating the Frontier Safety Framework (April 2026)](https://deepmind.google/blog/updating-the-frontier-safety-framework/) —— 新增 Tracked Capability Levels。
- [Gemini 3 Pro FSF Report](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_fsf_report.pdf) —— 一份 FSF 格式的 Risk Report 范例。
