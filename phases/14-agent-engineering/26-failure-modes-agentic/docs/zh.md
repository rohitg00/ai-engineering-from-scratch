# 失败模式：agent 为什么会坏掉（Failure Modes: Why Agents Break）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> MASFT（Berkeley，2025）把多 agent 系统的失败归纳成 3 大类共 14 种模式。Microsoft 的 Taxonomy 记录了既有 AI 失败如何在 agent 场景下被放大。来自工业界的现场数据汇聚到五种反复出现的模式：hallucinated actions（幻觉动作）、scope creep（范围蔓延）、cascading errors（级联错误）、context loss（上下文丢失）、tool misuse（工具误用）。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 05 (Self-Refine and CRITIC), Phase 14 · 24 (Observability)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 说出 MASFT 的三大失败类别，并在每类中至少说出四种具体模式。
- 解释为什么 agent 化会放大既有的 AI 失败模式（bias、hallucination）。
- 描述工业界反复出现的五种模式以及对应的缓解手段。
- 用 stdlib 实现一个检测器，给 agent 的 trace 打上失败模式标签。

## 问题（Problem）

团队上线的 agent 在 90% 的 trace 上都能跑通。剩下 10% 的失败并不是随机噪声——它们落在少数几个反复出现的类别里。一旦你能给它们命名，就能监控它们、修复它们。

## 概念（Concept）

### MASFT（Berkeley, arXiv:2503.13657）

Multi-Agent System Failure Taxonomy（多 agent 系统失败分类法）。14 种失败模式聚成 3 大类。标注者间的 Cohen's Kappa 为 0.88——类别之间是可以可靠区分开的。

核心论点：失败是多 agent 系统在设计上的根本缺陷，而不是 LLM 的局限——别指望换个更强的底座模型就能修。

### Microsoft Taxonomy of Failure Mode in Agentic AI Systems

- 既有 AI 失败（bias、hallucination、数据泄漏）会在 agent 场景下被放大。
- 自主性带来新的失败：规模化的非预期动作、tool 误用、任务漂移（mission drift）。
- 这份白皮书就是 agent 类产品的风险登记册（risk register）。

### Characterizing Faults in Agentic AI（arXiv:2603.06847）

- 失败来自编排（orchestration）、内部状态演化（internal state evolution）和与环境的交互（environment interaction）。
- 不只是「代码烂」或「模型输出烂」那么简单。

### LLM Agent Hallucinations Survey（arXiv:2509.18970）

两种主要表现形式：

1. **Instruction-following Deviation（指令遵循偏离）**——agent 不照 system prompt 办事。
2. **Long-range Contextual Misuse（长程上下文误用）**——agent 忘掉或错用了前面回合里的上下文。

子意图错误（Sub-intention errors）：Omission（漏步骤）、Redundancy（步骤重复）、Disorder（步骤乱序）。

### 工业界反复出现的五种模式

Arize、Galileo、NimbleBrain 在 2024–2026 年的现场分析共同指向：

1. **Hallucinated actions（幻觉动作）。** agent 调用了根本不存在的 tool，或者把参数编出来。
2. **Scope creep（范围蔓延）。** agent 把任务做超了用户的请求范围（多开了几个 PR，多发了几封邮件）。
3. **Cascading errors（级联错误）。** 一次错误调用触发下游一连串后果。一个虚构的 SKU 幻觉触发了四次 API 调用——演变成跨系统事故。
4. **Context loss（上下文丢失）。** 长链路（long-horizon）任务把前面回合里的约束忘了。
5. **Tool misuse（工具误用）。** 用对了 tool 但参数错了，或者干脆调错了 tool。

级联（cascading）是真正的杀手。agent 区分不了「我失败了」和「这任务做不成」，碰到 400 错误时往往会幻觉出一个成功消息把循环关掉。

### 缓解：每一步都设闸门（gates at every step）

在推理链的每一步都做自动校验闸门，对照环境状态核对事实落地（factual grounding）。具体做法：

- 每步都过一次安全分类器（见 Lesson 21）。
- tool 调用的参数校验（见 Lesson 06）。
- 把检索到的内容和已知事实交叉核对（见 Lesson 05，CRITIC）。
- 通过重新探测状态来检测「成功幻觉」（文件真的被创建了吗？）。

### 失败监控容易翻车的地方

- **只标 crash。** 大多数 agent 失败产出的输出看起来是合法的。必须做内容层面的检查。
- **没有 baseline（基线）。** 漂移检测需要一个 last-known-good（最近一次正常状态）；没有它你就没法说「情况在变糟」。
- **告警过多。** 每个失败都告警一次。要做聚类和限频。

## 动手实现（Build It）

`code/main.py` 用 stdlib 实现了一个失败模式 tagger：

- 一份覆盖五种模式的合成 trace 数据集。
- 每种模式一个检测函数（基于 tool 调用、输出、重复动作的特征模式）。
- 一个 tagger，给每条 trace 打标签并汇报模式分布。

跑起来：

```
python3 code/main.py
```

输出：每条 trace 的标签 + 整体分布，是 Phoenix 的 trace 聚类能力的一个廉价复刻。

## 用起来（Use It）

- 生产环境的漂移聚类用 **Phoenix**（见 Lesson 24）。
- 会话回放 + 标注用 **Langfuse**。
- 你的可观测性平台检测不到的、领域专属的特征，自己写 **Custom**。

## 上线部署（Ship It）

`outputs/skill-failure-detector.md` 会针对你的领域生成失败模式检测器，并接入 trace 存储。

## 练习（Exercises）

1. 加一个「成功幻觉」检测器：agent 返回成功，但目标状态没变。
2. 给你做过的某个产品打 100 条真实 trace。哪种模式占主导？修它的成本是多少？
3. 实现一个「级联半径（cascade radius）」指标：给定第 N 步的一次失败，它影响了多少个下游步骤？
4. 读完 MASFT 的 14 种失败模式。挑出三种适用于你产品的，写出对应检测器。
5. 把一个检测器接进 CI 任务：当某种模式被标注的 trace ≥ 5% 时让构建失败。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MASFT | "Multi-agent failure taxonomy" | Berkeley 的 14 模式分类 |
| Cascading error | "Ripple failure" | 一次早期错误穿透 N 步传播下去 |
| Context loss | "Forgot the constraint" | 长链路回合丢掉了早期回合的事实 |
| Tool misuse | "Wrong tool / wrong args" | 调用本身合法，但用错了 |
| Success hallucination | "Faked completion" | agent 在 400 上谎报成功；状态没变 |
| Scope creep | "Overreach" | agent 干了比要求更多的事 |
| Instruction-following deviation | "Disobedience" | 无视 system prompt 或用户约束 |
| Sub-intention errors | "Plan bugs" | 计划执行中的 Omission / Redundancy / Disorder |

## 延伸阅读（Further Reading）

- [Cemri et al., MASFT (arXiv:2503.13657)](https://arxiv.org/abs/2503.13657) —— 14 种失败模式，3 大类
- [Microsoft, Taxonomy of Failure Mode in Agentic AI Systems](https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Taxonomy-of-Failure-Mode-in-Agentic-AI-Systems-Whitepaper.pdf) —— 风险登记册
- [Arize Phoenix](https://docs.arize.com/phoenix) —— 实战中的漂移聚类
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— 何时用更简单的范式来彻底回避这些模式
