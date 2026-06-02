# 案例研究与 2026 年技术现状

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 三个生产级参考案例，值得端到端研读，每个都展示了多 agent 工程的不同切面。**Anthropic 的 Research 系统**（orchestrator-worker 模式，15x token 消耗，相比单 agent Opus 4 提升 +90.2%，rainbow 部署）是 supervisor 范式的标准案例。**MetaGPT / ChatDev**（用 SOP 编码角色专精来做软件工程；ChatDev 的 "communicative dehallucination"（沟通式祛幻觉）；MacNet 通过 DAG（有向无环图）扩展到 >1000 个 agent，arXiv:2406.07155）是角色分解的标准案例。**OpenClaw / Moltbook**（最初由 Peter Steinberger 于 2025 年 11 月以 Clawdbot 之名发布；两次更名；到 2026 年 3 月斩获 247k GitHub stars；本地 ReAct 循环 agent；Moltbook 是仅供 agent 入驻的社交网络，上线数日内即拥有约 230 万 agent 账号，于 2026-03-10 被 Meta 收购）展示了人口级规模下会发生什么：涌现的经济活动、prompt 注入风险、国家级监管（中国于 2026 年 3 月在政府电脑上限制 OpenClaw）。**2026 年 4 月框架格局：** LangGraph 与 CrewAI 引领生产应用；AG2 是社区版的 AutoGen 续作；Microsoft AutoGen 已进入维护模式（合并入 Microsoft Agent Framework，2026 年 2 月发布 RC）；OpenAI Agents SDK 是 Swarm 的生产继任者；Google ADK（2025 年 4 月）是原生支持 A2A 的入场者。所有主流框架现在都内置 MCP 支持；多数也支持 A2A。本课端到端阅读这几个案例，提炼共通模式，让你能为下一个生产系统挑选合适的参考。

**Type:** Learn (capstone)
**Languages:** —
**Prerequisites:** all of Phase 16 (Lessons 01-24)
**Time:** ~90 minutes

## 问题（Problem）

多 agent 工程是一门年轻的学科。生产级的参考案例为数不多，且每个覆盖的领域不同。逐个阅读有用；把它们当作一组对照阅读则更有用。本课把三个 2026 年的标准案例当作端到端阅读清单，钉死共通模式，并梳理框架格局，让你能凭知识而非营销话术做框架选择。

## 概念（Concept）

### Anthropic Research 系统

生产级的 supervisor-worker 案例。Claude Opus 4 负责规划与综合；Claude Sonnet 4 subagent 并行做研究。已发布的工程文章：https://www.anthropic.com/engineering/multi-agent-research-system 。

关键的实测结果：

- 在内部研究 eval 上，相比单 agent Opus 4 提升 **+90.2%**。
- BrowseComp 上 **80% 的方差**仅由 **token 用量**就能解释——多 agent 之所以胜出，很大程度是因为每个 subagent 都能拿到一个全新的 context window（上下文窗口）。
- 每个查询消耗的 token 是单 agent 的 **15 倍**。
- 由于 agent 是长时间运行且有状态的，需要 **rainbow deployment（彩虹部署）**。

被沉淀为定式的设计经验：

1. **按查询复杂度匹配投入。** 简单 → 1 个 agent，3-10 次工具调用。中等 → 3 个 agent。复杂研究 → 10+ 个 subagent。
2. **先广后窄。** Subagent 做宽搜；lead 做综合；后续 subagent 做定向深挖。
3. **Rainbow 部署。** 让旧版本的运行时一直活着，直到上面在跑的 agent 都跑完。
4. **Verification（验证）不是可选项。** 在没有显式 verifier（验证器）角色时，系统被观察到会出现 hallucination（幻觉）。

这是 supervisor-worker 拓扑（Phase 16 · 05）在生产规模下的参考案例。

### MetaGPT / ChatDev

生产级的 SOP-角色分解案例。涵盖 arXiv:2308.00352（MetaGPT）与 arXiv:2307.07924（ChatDev）。

MetaGPT 把软件工程的 SOP 编码成角色 prompt：Product Manager、Architect、Project Manager、Engineer、QA Engineer。论文的核心表述是：`Code = SOP(Team)`。每个角色都有一份窄而专精的 prompt；角色间的 handoff（交接）携带结构化产物（PRD 文档、架构文档、代码）。

ChatDev 的贡献是 **communicative dehallucination（沟通式祛幻觉）**。Agent 在回答之前会先问清细节——比如设计师 agent 在画 UI 草图前，会先问程序员打算用什么语言，而不是凭空猜。论文报告这种做法能在多 agent 流水线中显著降低幻觉。

MacNet（arXiv:2406.07155）把 ChatDev 扩展到 **>1000 个 agent，靠的是 DAG**。DAG 的每个节点是一种角色专精；边编码 handoff 契约。能做到这个规模，是因为路由是显式且可离线计算的。

设计经验：

1. **结构比规模更重要。** 一个紧凑的 5 角色 SOP 团队，胜过一个 50 个 agent 的散兵游勇。
2. **Handoff 契约要落到字面上。** 角色之间传递的产物要遵循 schema。
3. **Communicative dehallucination** 是一种廉价但承重的模式。
4. **DAG 比 chat 更能扩。** 当流程是可知的，就把它编码下来。

这是角色专精（Phase 16 · 08）和结构化拓扑（Phase 16 · 15）的参考案例。

### OpenClaw / Moltbook 生态

生产级的人口规模案例。时间线：

- **2025 年 11 月：** Clawdbot（Peter Steinberger 的本地 ReAct 循环编码 agent）上线。
- **2025 年 12 月 – 2026 年 3 月：** 两次更名（Clawdbot → OpenClaw → 继续以 OpenClaw 名义发展）。
- **2026 年 2 月：** Moltbook 在同一套底座上启动，是一个仅 agent 入驻的社交网络；数日内拥有约 230 万 agent 账号。
- **2026 年 3 月（2026-03-10）：** Meta 收购 Moltbook。
- **2026 年 3 月：** 中国限制 OpenClaw 在政府电脑上的使用。
- **2026 年 3 月：** OpenClaw 突破 247k GitHub stars。

当你把数百万个 agent 放到一个共享底座上时，多 agent 看起来就是这样：

- **涌现的经济活动。** Agent 之间用 token 支付互相买卖、互相服务。
- **人口规模下的 prompt 注入风险。** 一条放在病毒式传播的 agent 资料里的恶意 prompt，可以在数小时内传染到成千上万次 agent-to-agent 的交互。
- **国家级的监管反应。** 上线数周内，监管就抵达了这个生态。

这个案例的设计经验一半是技术，一半是治理：

1. **人口规模的多 agent 是一种新形态。** 单系统的最佳实践（验证、角色清晰）依然适用，但已经不够。
2. **Prompt 注入是新的 XSS。** 默认把 agent 资料和跨 agent 消息当作不可信输入处理。
3. **监管比设计周期更快。** 提前规划。
4. **开源 + 病毒式规模会复利。** 4 个月内 247k stars 是非常少见的；要为部署期的爆发流量设计。

详见 [OpenClaw Wikipedia](https://en.wikipedia.org/wiki/OpenClaw) 以及 CNBC / Palo Alto Networks 的生态报道。技术底层方面，Clawdbot / OpenClaw 仓库展示了本地 ReAct 循环；Moltbook 的公开文章则揭示了在其上构建的社交图谱架构。

### 2026 年 4 月框架格局

| 框架 | 状态 | 适合什么 | 备注 |
|---|---|---|---|
| **LangGraph**（LangChain） | 生产领跑 | 结构化图 + checkpointing + human-in-the-loop（人工确认） | 推荐的生产默认选项 |
| **CrewAI** | 生产领跑 | 基于角色的 crew，支持 Sequential / Hierarchical 流程 | 适合做角色分解 |
| **AG2** | 社区维护 | GroupChat + 发言者选择 | AutoGen v0.2 的延续 |
| **Microsoft AutoGen** | 维护模式（2026 年 2 月） | — | 已合并入 Microsoft Agent Framework RC |
| **Microsoft Agent Framework** | RC（2026 年 2 月） | 编排模式 + 企业集成 | 新入场者；值得关注 |
| **OpenAI Agents SDK** | 生产可用 | Swarm 的继任者 | 工具返回式 handoff 模式 |
| **Google ADK** | 生产可用（2025 年 4 月） | A2A 原生 | 集成 Google Cloud |
| **Anthropic Claude Agent SDK** | 生产可用 | 单 agent + Research 扩展 | 见 Research 系统的工程文章 |

所有主流框架现在都内置 **MCP** 支持；多数也支持 **A2A**。协议兼容性已不再是差异化卖点。

### 三个案例共通的模式

1. **Orchestrator + workers**（Anthropic 的显式 supervisor、MetaGPT 的 PM 充当 supervisor、OpenClaw 的单 agent + 网络效应）。
2. **结构化 handoff 契约**（Anthropic 的 subagent 任务描述、MetaGPT 的 PRD / 架构文档、OpenClaw 的 A2A 产物）。
3. **Verification 作为一等角色**（Anthropic 的 verifier、MetaGPT 的 QA Engineer、OpenClaw 网络中的 validator（验证器））。
4. **扩展靠的是拓扑 + 底座，不只是堆 agent**（rainbow 部署、MacNet 的 DAG、人口规模底座）。
5. **成本是实打实且公开披露的**（15x token、MetaGPT 的按角色预算、Moltbook 的按交互定价）。
6. **安全姿态是显式的**（Anthropic 的沙箱、MetaGPT 的角色限制、OpenClaw 把 prompt 注入视为已知攻击面）。

### 为下一个项目挑选参考

- **生产级研究 / 知识任务 → Anthropic Research。** 全新 context 的 subagent 胜出。
- **工程 / 工具链工作流 → MetaGPT / ChatDev。** 角色 + SOP + handoff 契约。
- **网络效应型社交产品 → OpenClaw / Moltbook。** 底座 + 涌现经济。
- **经典企业自动化 → CrewAI 或 LangGraph**（生产领跑者，运行时稳定）。

### 2026 年技术现状小结

2026 年 4 月这个领域的状态：

- **框架在收敛。** MCP + A2A 支持已是入场券。Handoff 语义是剩下的设计抉择。
- **评估在变硬。** SWE-bench Pro、MARBLE、STRATUS 缓解 benchmark。Pro 是当下能抗污染的现实检验。
- **生产失败率是可测量的**（Cemri 2025 MAST；真实 MAS 上 41-86.7%）。这个领域已经走出了「demo 看起来很棒」的时代。
- **成本是核心工程约束。** 每任务 token 成本、每次交互的 wall-clock、rainbow 部署的开销。多 agent 在准确率上胜出，但在成本上吃亏——这个权衡就是商业决策。
- **监管是近期输入，不是背景噪音。** 司法辖区的动作比单个部署周期更快。

## 用起来（Use It）

`outputs/skill-case-study-mapper.md` 是一个 skill，它读入一份提议的多 agent 系统设计，把它映射到最接近的案例研究，把那个案例已经验证过的设计抉择浮现出来。

## 上线部署（Ship It）

2026 年生产多 agent 的入门规则：

- **从案例出发，而不是从零造起。** 在 Anthropic Research / MetaGPT / OpenClaw 中挑最接近的，然后改造。
- **采用 MCP + A2A。** 跨框架的可移植性是有价值的；协议支持是免费的。
- **拿 SWE-bench Pro 或你内部的 Pro 等价物来度量。** Verified 已经被污染了。
- **交「验证税」。** 一个独立 verifier 大约要花掉 20-30% 的 token 预算，换来可度量的正确性提升。
- **对长跑 agent 做 rainbow 部署。** 预期跑数小时的 agent 会成为常态。
- **读 WMAC 2026 和 MAST 的后续工作。** 学科推进得很快。

## 练习（Exercises）

1. 端到端读一遍 Anthropic Research 系统的工程文章。指出三个设计抉择，如果把 Opus 4 换成更小的模型（比如 Haiku 4），它们会怎么变化。
2. 读 MetaGPT 第 3-4 节（arXiv:2308.00352）。把你自己领域里的某个 SOP（不要软件领域的）编码成角色 prompt。这个 SOP 暗含了多少个角色？
3. 读 ChatDev（arXiv:2307.07924）。指出「communicative dehallucination」的机制。在你已有的某个多 agent 系统里实现它。
4. 读 OpenClaw 与 Moltbook 的资料。挑一个在人口规模下涌现、但在 5 个 agent 的系统里不会出现的具体失败模式。你会如何工程上对抗它？
5. 选你当下的多 agent 项目。三个案例里哪一个是最接近的参考？那个案例里有哪些设计抉择你**还没**采用？写下你这个季度要采用的其中一个。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| Anthropic Research | 「supervisor 标杆」 | Claude Opus 4 + Sonnet 4 subagent；15x token；相比单 agent +90.2%。 |
| MetaGPT | 「SOP 即 prompt」 | 软件工程的角色分解；`Code = SOP(Team)`。 |
| ChatDev | 「Agent 即角色」 | 设计师 / 程序员 / reviewer / 测试员；communicative dehallucination。 |
| MacNet | 「用 DAG 把 ChatDev 扩起来」 | arXiv:2406.07155；通过显式 DAG 路由扩展到 1000+ 个 agent。 |
| OpenClaw | 「本地 ReAct 循环 agent」 | Steinberger 的项目；到 2026 年 3 月 247k stars。 |
| Moltbook | 「仅 agent 的社交网络」 | 230 万 agent 账号；2026 年 3 月被 Meta 收购。 |
| Rainbow deploy | 「多版本并发」 | 让旧版本运行时一直活着，给在跑的长跑 agent 用。 |
| Communicative dehallucination | 「先问再答」 | Agent 向同伴询问细节，而不是凭空猜测。 |
| WMAC 2026 | 「那个 AAAI workshop」 | 2026 年 4 月多 agent 协调领域的社区焦点。 |

## 延伸阅读（Further Reading）

- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — supervisor-worker 的生产参考
- [MetaGPT — Meta Programming for Multi-Agent Collaborative Framework](https://arxiv.org/abs/2308.00352) — SOP-角色分解
- [ChatDev — Communicative Agents for Software Development](https://arxiv.org/abs/2307.07924) — communicative dehallucination
- [MacNet — scaling role-based agents to 1000+](https://arxiv.org/abs/2406.07155) — 基于 DAG 的扩展
- [OpenClaw on Wikipedia](https://en.wikipedia.org/wiki/OpenClaw) — 生态概览
- [WMAC 2026](https://multiagents.org/2026/) — AAAI 2026 Bridge Program 多 agent 协调 Workshop
- [LangGraph docs](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — 生产领跑者
- [CrewAI docs](https://docs.crewai.com/en/introduction) — 基于角色的框架
