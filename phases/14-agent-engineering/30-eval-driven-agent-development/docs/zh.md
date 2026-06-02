# 评估驱动的 Agent 开发（Eval-Driven Agent Development）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Anthropic 的指导原则：「从简单的 prompt 开始，用全面的 evaluation（评估）来优化它们，只在确有需要时才加上多步 agentic 系统。」评估不是最后一步。它是驱动 Phase 14 里每一个其他选择的外层循环。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** All of Phase 14.
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 说出三个评估层级——静态基准（static benchmarks）、自定义离线评估（custom offline）、线上生产评估（online production）——以及各自的用途。
- 解释 evaluator-optimizer 紧耦合循环。
- 描述 2026 年的最佳实践：评估和代码放在一起，在 CI 中跑，作为 PR 的合并门槛。
- 把 Phase 14 的每一节课与它生成的评估用例对应起来。

## 问题（The Problem）

Agent 能通过演示。但它们会以演示无法预测的方式在生产环境中失败。基准回答的是「这个模型是否广泛具备能力？」而不是「这个 agent 是否在为我的产品交付正确的补丁？」答案是：在三个层级上做评估，持续运行，把每一个 guardrail（护栏）和学到的规则都映射到一个评估用例。

## 概念（The Concept）

### 三个评估层级（Three evaluation layers）

1. **静态基准（Static benchmarks）** —— 代码用 SWE-bench Verified（第 19 课），浏览 / 桌面用 WebArena / OSWorld（第 20 课），通用能力用 GAIA（第 19 课），tool use 用 BFCL V4（第 06 课）。用于跨模型比较和回归门槛。污染问题真实存在：SWE-bench+ 发现了 32.67% 的解题泄露。始终报告 Verified / +-audited 分数。

2. **自定义离线评估（Custom offline evals）** —— 贴合你产品的形态：
   - LLM-as-judge（Langfuse、Phoenix、Opik —— 第 24 课）。
   - 基于执行（运行补丁，检查测试是否通过）。
   - 基于轨迹（把动作序列与黄金标准比较；OSWorld-Human 显示顶级 agent 的步数是黄金标准的 1.4–2.7 倍）。

3. **线上评估（Online evals）** —— 生产环境：
   - 会话回放（Langfuse）。
   - guardrail 触发的告警（第 16、21 课）。
   - 每步的 cost / latency（延迟）追踪（第 23 课的 OTel span）。

### Evaluator-optimizer（Anthropic）

紧耦合循环：

1. Proposer 生成输出。
2. Evaluator（评估器）做裁决。
3. 不断 refine，直到 evaluator 通过。

这是 Self-Refine（第 05 课）的泛化形式。任何你在意的 agent 流程都可以套上 evaluator-optimizer，以提升可靠性。

### 2026 最佳实践

- 评估和代码放在一起。
- 每个 PR 都在 CI 里跑。
- 用评估分数作为合并门槛（例如「相对 main 分支的回归 ≤ 5%」）。
- 每一个 guardrail 都映射到一个评估用例。
- 每一条学到的规则（Reflexion、pro-workflow 的 learn-rule）都映射到一个失败用例。

### 串起整个 Phase 14（Tying Phase 14 together）

Phase 14 的每一节课都会生成评估用例：

| 课次 | 它生成的评估用例 |
|--------|------------------------|
| 01 Agent Loop | 预算耗尽、无限循环保护 |
| 02 ReWOO | 工具失败时 planner 能正确 replan |
| 03 Reflexion | 学到的反思能在重试时生效 |
| 05 Self-Refine/CRITIC | judge 通过 refine 后的输出 |
| 06 Tool Use | 参数强制转换可用；未知工具被拒绝 |
| 07-10 Memory | 检索引用与来源匹配；过期事实失效 |
| 12 Workflow Patterns | 每个模式都产出正确输出 |
| 13 LangGraph | Resume 能精确复现状态 |
| 14 AutoGen Actors | DLQ 捕获崩溃的 handler |
| 16 OpenAI Agents SDK | guardrail 在正确的输入上触发 |
| 17 Claude Agent SDK | subagent 的结果返回给 orchestrator |
| 19-20 Benchmarks | SWE-bench Verified 分数、WebArena 成功率、OSWorld 效率 |
| 21 Computer Use | 单步安全检查能拦住注入的 DOM |
| 23 OTel | span 输出必填属性 |
| 26 Failure Modes | detector 能给已知失败打标 |
| 27 Prompt Injection | PVE 拒绝被污染的检索结果 |
| 28 Orchestration | supervisor 路由到正确的 specialist |
| 29 Runtime Shapes | DLQ 处理 N% 失败 |

如果你的评估套件对每一项都有用例，那你就覆盖了整个 Phase 14。

### 评估驱动开发会在哪些地方失效（Where eval-driven development fails）

- **没有 baseline。** 没有 last-known-good 的评估读不出意义。把 baseline 存起来。
- **没有接地的 LLM-judge。** judge 也会 hallucinate（幻觉）。CRITIC 模式（第 05 课）—— 让 judge 借助外部工具来接地。
- **对评估过拟合。** 为评估而优化会偏离生产价值。轮换用例。
- **不稳定的评估。** 非确定性的用例会引发误报。固定 seed，快照状态。

## 动手实现（Build It）

`code/main.py` 是一个仅用标准库的评估测试架（harness）：

- 带分类的用例注册表（benchmark、custom、online）。
- 一个被测的脚本式 agent。
- Evaluator-optimizer 循环：propose、judge、refine，直到通过或达到最大轮数。
- CI 门槛：聚合通过率 + 相对 baseline 的回归。

运行它：

```
python3 code/main.py
```

输出：每个用例的 pass / fail、回归标记、CI 门槛 verdict（裁决）。

## 用起来（Use It）

- 把评估用例写在和 agent 代码同一个 repo 里。
- 通过 CI 在每个 PR 上跑它们。
- 出现回归就让构建失败。
- 跟踪通过率随时间的变化。
- 把每一次生产失败都对应回一条新的用例。

## 上线部署（Ship It）

`outputs/skill-eval-suite.md` 为某个 agent 产品搭建一个带 CI 门槛和回归追踪的三层评估套件。

## 练习（Exercises）

1. 拿你的一次生产失败。写一个能复现它的评估用例。你的 agent 现在能通过吗？
2. 为你的领域构建一个三维度的 LLM-judge 评分量规（事实、语气、范围）。给 50 个会话打分。
3. 把评估套件接进 CI。回归 ≥ 5% 时让构建失败。
4. 加一个轨迹效率指标：agent 用了多少步，相对黄金轨迹是多少？
5. 把 Phase 14 的每一节课映射到你套件里的一个评估用例。有缺漏吗？那就是要补上的缺口。

## 关键术语（Key Terms）

| 术语 | 大家会怎么说 | 它实际指的是什么 |
|------|----------------|------------------------|
| Static benchmark | 「现成的 eval」 | SWE-bench、GAIA、AgentBench、WebArena、OSWorld |
| Custom offline eval | 「领域 eval」 | 在你产品形态上做的 LLM-as-judge / 执行 / 轨迹评估 |
| Online eval | 「生产 eval」 | 会话回放、guardrail 告警、cost / latency 追踪 |
| Evaluator-optimizer | 「propose-judge-refine」 | 迭代直到 judge 通过 |
| CI gate | 「合并阻塞器」 | 评估出现回归时让构建失败 |
| Baseline | 「last-known-good」 | 用来检测回归的参考分数 |
| Trajectory efficiency | 「相对黄金标准的步数」 | agent 步数除以人类专家的最少步数 |

## 延伸阅读（Further Reading）

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) ——「从简单开始，用 eval 优化」
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) —— 经过审核的基准
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) —— tool-use 基准
- [Langfuse docs](https://langfuse.com/) —— eval 与会话回放的工程实践
