# CAIS、CAISI 与社会级风险（CAIS, CAISI, and Societal-Scale Risk）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Center for AI Safety（CAIS，AI 安全中心；位于旧金山，2022 年由 Hendrycks 与 Zhang 创立）发布了「四风险」框架——恶意使用、AI 竞赛、组织性风险、流氓 AI——以及 2023 年 5 月那份由数百位教授和公司负责人共同签署的关于灭绝风险的声明。CAIS 在 2026 年的产出包括：用于前沿模型评估的 AI Dashboard、（与 Scale AI 合作的）Remote Labor Index、Superintelligence Strategy Paper、AI Frontiers newsletter。另外有一个不同的实体：NIST Center for AI Standards and Innovation（CAISI，AI 标准与创新中心）——面向美国政府，运行自愿协议（voluntary agreements）和非保密的能力评估，聚焦网络、生物、化学武器风险。CAIS 把组织性风险列为四大顶层风险之一：安全文化、严格审计、多层防御和信息安全是基础，但常常被部署速度挤压而遭到牺牲。California SB-53 一旦签署，将是美国第一部州级灾难性风险监管法案。

**Type:** Learn
**Languages:** Python (stdlib, four-risk inventory and mitigation matcher)
**Prerequisites:** Phase 15 · 19 (RSP), Phase 15 · 20 (PF + FSF)
**Time:** ~45 minutes

## 问题（Problem）

第 19、20 课讲的是实验室内部的扩展策略（scaling policy）。第 21 课讲的是独立的能力评估。本课讲第三个视角：那些塑造公众讨论与监管基线、应对灾难级 AI 风险的民间社会与政府组织。

要分清两个不同的实体。CAIS 是一家非营利研究机构，发布关于 AI 风险的思考框架，并协调公开声明。CAISI 则是美国政府内部、隶属 NIST 的一个中心，与各实验室签订自愿协议，并执行非保密的能力评估。两者名字读起来像，使命却毫不重叠。一个从业者应当对两者都有所了解。

实操层面的内容：CAIS 的「四风险」框架是文献中被引用最广的社会级风险分类法。安全文化和组织性风险是这四类之一，也是从业者最能直接掌控的一类。California SB-53 一旦签署，将成为美国第一部州级灾难性风险监管法案；该法案的措辞值得关注，因为在美国科技政策史上，州级监管常常会引出后续的联邦行动。

## 概念（Concept）

### CAIS — Center for AI Safety

- 创立时间：2022 年，旧金山，由 Dan Hendrycks 等人发起（这里的「Zhang」指的是早期合作者，并非现任联合创始人；当前领导层请参见 CAIS 官网）。
- 性质：501(c)(3) 非营利组织。
- 2023 年的标志性产出：关于灭绝风险的声明，由数百位研究者和 CEO 联署。声明称：「与流行病、核战争等其他社会级风险一样，缓解 AI 带来的灭绝风险应当成为全球优先事项。」
- 2026 年产出：用于前沿模型评估的 AI Dashboard、与 Scale AI 合作的 Remote Labor Index、Superintelligence Strategy Paper、AI Frontiers newsletter。

### 四风险框架（The four-risk framework）

CAIS 的框架把灾难级 AI 风险归为四类顶层类别：

1. **恶意使用（Malicious use）**：恶意行为者用 AI 造成伤害（生物武器合成、虚假信息、网络攻击）。
2. **AI 竞赛（AI races）**：实验室、公司或国家之间的竞争压力，把部署节奏推过了安全的临界点。
3. **组织性风险（Organizational risks）**：实验室内部动力学（安全文化失灵、审计不足、安全资源不足）导致一次糟糕的部署。
4. **流氓 AI（Rogue AIs）**：一个能力足够强的 AI 追求与人类福祉相冲突的目标。

这并非唯一的分类法，但它是被引用最多的。各类别并非互斥——一个流氓 AI，若是由一家在竞赛中以速度换审计的组织造出，那它同时属于这四类。

### 组织性风险落在哪里（Where organizational risk lives）

四类之中，组织性风险对从业者最具可操作性。一家实验室的安全文化、审计严格度、防御分层和信息安全，决定了它的模型上线时第 10–18 课讲的那些控制是真的到位，还是仅仅是没人核验过的清单条目。

具体的组织性风险抓手：

- **安全文化（Safety culture）**：团队成员是否敢在不付出职业代价的前提下上报担忧？CAIS 的调查发现这是其他几个抓手的强预测因子。
- **严格审计（Rigorous audits）**：包括外部和内部审计。仅靠内部审计会得到过于乐观的报告。
- **多层防御（Multi-layered defenses）**：没有任何单一层是充分的（这是贯穿 Phase 15 的主线）。
- **信息安全（Information security）**：模型权重外泄、评估数据外泄、绕过监控的技术外泄。第 19 课提到的 RAND SL-4 是一个具体的标准。

### CAISI — Center for AI Standards and Innovation

- 隶属于 NIST。
- 与前沿实验室签署自愿协议。
- 发布非保密的能力评估，聚焦网络、生物、化学武器风险。
- 与 CAIS 是不同实体；缩写撞名；通过 URL（nist.gov）来确认你正在读的是哪一家。

CAISI 的角色，是 METR 与实验室私下合作（第 21 课）的「政府对外」对位。CAISI 的报告是非保密的，METR 的报告则常常受 NDA 限制。从业者把两者都读一读，能拼出更完整的图景。

### California SB-53

加州参议院法案（2025–2026 会期）针对前沿模型的灾难性风险。草案中的关键条款：

- 具体的能力阈值，触发后激活州级义务。
- 面向 AI 实验室员工的吹哨人保护条款。
- 面向灾难级故障的事件上报要求。

一旦签署，它将成为美国第一部州级灾难性风险监管法案。无论最终是否签署，该法案的措辞都会影响其他州议会处理同类问题的思路。在加州的从业者应当跟踪法案进展；其他地方的从业者也应当读一读，以了解美国州级监管未来大概率会长成什么样。

### 社会级风险不是单层问题（Societal-scale risk is not a single-layer problem）

Phase 15 的主线——纵深防御（defense in depth）——同样适用于社会层。没有哪一个组织、哪一条法规、哪一个框架能单独把灾难级风险关上门。整个生态只有在以下条件同时成立时才工作：

- 实验室发布扩展策略（第 19、20 课）。
- 外部评估方给出测量结果（第 21 课）。
- 民间社会跟踪并公之于众（CAIS）。
- 政府运行自愿项目和基线监管（CAISI、SB-53）。
- 从业者搭建多层控制（第 10–18 课）。

这就是本阶段最后的整合：之前每一课都是这套堆栈中的一层，整堆的完整性比任何单层的强度都更要紧。

## 用起来（Use It）

`code/main.py` 实现了一个小型风险盘点工具。给定一个拟议中的部署方案，它会按四风险类别给该部署打标签，并返回一份缓解措施清单。它是用来辅助阅读这套框架的，并不能替代人类判断。

## 上线部署（Ship It）

`outputs/skill-societal-risk-review.md` 从社会级风险姿态的角度审查一次部署：它触及四类风险中的哪几类、已有哪些缓解措施、组织性风险敞口有多大。

## 练习（Exercises）

1. 跑一下 `code/main.py`。喂给它三个不同规模的合成部署。确认四风险标签符合你的预期；找出至少一个工具打标过轻或过重的案例。

2. 完整阅读 CAIS 的四风险论文。挑一个风险类别，写两段文字，说明你认为该类别在 2026 年最重要的进展是什么。

3. 阅读 California SB-53 的当前草案。找出一条你认为强化了灾难级风险姿态的条款，再找出一条你认为削弱了它的条款。两者都给出理由。

4. 挑一个你了解的生产级 AI 部署（你自己的或公开的都行）。按组织性风险的子抓手给它打分：安全文化、审计严格度、多层防御、信息安全。哪一项最弱？把它补到合格水平要花多少代价？

5. 草拟一个 2028 年版本的四风险框架，反映多出的一年能力增长与多出的一年部署经验。你会增加什么、删掉什么、重新归类什么？

## 关键术语（Key Terms）

| 术语 | 大家口中怎么说 | 实际是什么 |
|---|---|---|
| CAIS | "Center for AI Safety" | 非营利组织；四风险框架；2023 年灭绝风险声明 |
| CAISI | "US government AI safety" | NIST 旗下中心；自愿协议；非保密评估 |
| Four-risk framework | "CAIS 的分类法" | 恶意使用、AI 竞赛、组织性风险、流氓 AI |
| Malicious use | "Bad actor uses AI" | 生物武器、虚假信息、网络攻击 |
| AI races | "竞争压力" | 实验室／公司／国家把部署推过安全线 |
| Organizational risk | "实验室内部失灵" | 安全文化、审计、防御、信息安全 |
| Rogue AI | "失配的 agent" | 能力强的 AI 追求与人类福祉相冲突的目标 |
| California SB-53 | "州级监管" | 2025–2026 法案；若签署则为美国首部州级灾难性风险监管 |

## 延伸阅读（Further Reading）

- [Center for AI Safety](https://safe.ai/) — 四风险框架的机构所在地。
- [CAIS — AI Risks that Could Lead to Catastrophe](https://safe.ai/ai-risk) — 四风险论文。
- [CAIS — May 2023 statement on extinction risk](https://safe.ai/statement-on-ai-risk) — 简短的联合声明。
- [NIST CAISI](https://www.nist.gov/caisi) — 面向政府的 AI 标准与创新中心。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 把实验室级承诺与社会级框架连接起来。
