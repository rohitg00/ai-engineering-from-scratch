# Agent 可观测性：Langfuse、Phoenix、Opik

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年，三个开源 agent 可观测性（observability）平台占据主导地位。Langfuse（MIT）——每月 600 万 + 安装量，提供 tracing + prompt 管理 + 评估 + session replay。Arize Phoenix（Elastic 2.0）——深度的 agent 专属评估、RAG 相关性、OpenInference 自动埋点。Comet Opik（Apache 2.0）——自动化 prompt 优化、guardrail（护栏）、基于 LLM-judge 的 hallucination（幻觉）检测。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 23 (OTel GenAI)
**Time:** ~45 minutes

## 学习目标（Learning Objectives）

- 说出三大开源 agent 可观测性平台的名字及其许可证。
- 区分各自最擅长的方向：Langfuse（prompt 管理 + sessions）、Phoenix（RAG + 自动埋点）、Opik（优化 + guardrail）。
- 解释为什么到 2026 年有 89% 的组织报告自己已经部署了 agent 可观测性。
- 用标准库实现一条「trace → 仪表盘」的 pipeline，附带 LLM-judge 评估。

## 问题（The Problem）

OTel GenAI（第 23 课）给了你 schema。但你仍然需要一个平台来吸收 spans、跑评估、存储 prompt 版本，并把回归暴露出来。三个候选者各自侧重生命周期里的不同环节。

## 概念（The Concept）

### Langfuse（MIT）

- SDK 每月 600 万 + 安装量，GitHub stars 超 1.9 万。
- 功能：tracing、带版本控制 + playground 的 prompt 管理、评估（LLM-as-judge、用户反馈、自定义）、session replay。
- 2025 年 6 月：原本的商业模块（LLM-as-a-judge、标注队列、prompt 实验、Playground）以 MIT 协议开源。
- 最擅长：端到端可观测性 + 紧密的 prompt 管理闭环。

### Arize Phoenix（Elastic License 2.0）

- 更深入的 agent 专属评估：trace 聚类、异常检测、面向 RAG 的检索相关性。
- 原生 OpenInference 自动埋点。
- 与托管的 Arize AX 配套用于生产环境。
- 没有 prompt 版本控制——它的定位是与更全面的平台搭配使用的「漂移 / 行为回归」工具。
- 最擅长：RAG 相关性、行为漂移、异常检测。

### Comet Opik（Apache 2.0）

- 通过 A/B 实验做自动化 prompt 优化。
- Guardrail（PII 脱敏、话题约束）。
- 基于 LLM-judge 的 hallucination 检测。
- 来自 Comet 自己的基准测试：Opik 写日志 + 跑评估只要 23.44 秒，而 Langfuse 是 327.15 秒（约 14 倍差距）——厂商发布的基准只能当作方向性参考。
- 最擅长：优化闭环、自动化实验、guardrail 强制执行。

### 行业数据

来自 Maxim 的 2026 年实地分析：89% 的组织已部署 agent 可观测性；质量问题是头号生产障碍（32% 的受访者把它列为首要问题）。

### 该选哪个

| 需求 | 选 |
|------|------|
| 一站式 + prompt 管理 | Langfuse |
| 深度 RAG 评估 + 漂移 | Phoenix |
| 自动化优化 + guardrail | Opik |
| 开放许可、避开 ELv2 | Langfuse（MIT）或 Opik（Apache 2.0） |
| Datadog / New Relic 集成 | 都行——三个都导出 OTel |

### 这个模式容易在哪儿翻车

- **没有评估策略。** 只 tracing 不评估，那只是昂贵的日志。
- **自己写 LLM-judge 但没接外部依据。** CRITIC 模式（第 05 课）在这里适用——judge 需要外部工具来做事实核验。
- **prompt 版本没有和 trace 绑定。** 生产出现回归时，你无法二分回退到肇事的那个 prompt。

## 动手实现（Build It）

`code/main.py` 用标准库实现了一个 trace 收集器 + LLM-judge 评估器：

- 吸收 GenAI 形态的 spans。
- 按 session 分组，给失败的运行打标（触发 guardrail、低置信度评估）。
- 一个脚本化的 LLM-judge，按 rubric 给 agent 的回答打分。
- 一个仪表盘式的汇总：失败率、Top 失败原因、评估分数分布。

跑起来：

```
python3 code/main.py
```

输出：每个 session 的评估分数和失败分类，效果对标 Langfuse / Phoenix / Opik 会展示的内容。

## 用起来（Use It）

- **Langfuse** 自部署或云端；通过 OTel 或它们的 SDK 接入。
- **Arize Phoenix** 自部署；自动埋点 OpenInference。
- **Comet Opik** 自部署或云端；自动化优化闭环。
- **Datadog LLM Observability** 适合那些已经在用 Datadog、ops + ML 混编的团队。

## 上线部署（Ship It）

`outputs/skill-obs-platform-wiring.md` 选定一个平台，把 traces + evals + prompt 版本接入一个现有的 agent。

## 练习（Exercises）

1. 把一周的 OTel traces 导出到 Langfuse 云端（免费档）。哪些 session 失败了？为什么？
2. 给你自己的领域写一份 LLM-judge rubric（事实正确性、语气、范围遵守度）。在 50 条 trace 上测试它。
3. 对比 Langfuse 的 prompt 版本控制与 Phoenix 的 trace 聚类。哪个能更快告诉你「坏在哪儿」？
4. 读 Opik 的 guardrail 文档。给你的某次 agent 运行接一个 PII 脱敏 guardrail。
5. 在你自己的语料上对三者做基准测试。忽略厂商发布的数字；用你自己的测量结果说话。

## 关键术语（Key Terms）

| 术语 | 大家口中的说法 | 它实际指什么 |
|------|----------------|------------------------|
| Tracing | 「span 收集器」 | 吸收 OTel / SDK spans；按 session 索引 |
| Prompt 管理 | 「Prompt CMS」 | 与 trace 绑定的版本化 prompt |
| LLM-as-judge | 「自动化评估」 | 用另一个 LLM 按 rubric 给 agent 输出打分 |
| Session replay | 「Trace 回放」 | 一步步重走过去的运行用于调试 |
| RAG 相关性 | 「检索质量」 | 检索到的上下文是否匹配查询 |
| Trace 聚类 | 「行为分组」 | 把相似的运行聚到一起做漂移检测 |
| Guardrail 强制执行 | 「写日志时的策略」 | 对落盘内容做 PII / 毒性 / 范围检查 |

## 延伸阅读（Further Reading）

- [Langfuse docs](https://langfuse.com/) — tracing、评估、prompt 管理
- [Arize Phoenix docs](https://docs.arize.com/phoenix) — 自动埋点、漂移
- [Comet Opik](https://www.comet.com/site/products/opik/) — 优化 + guardrail
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 三家共用的 schema
