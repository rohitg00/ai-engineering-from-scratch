# 24 · 智能体可观测性：Langfuse、Phoenix、Opik

> 2026 年，三大开源智能体可观测性（agent observability）平台占据主导地位。Langfuse（MIT 许可）—— 每月 600 万+ 次安装，集追踪（tracing）、提示词管理（prompt management）、评估（evals）与会话回放（session replay）于一体。Arize Phoenix（Elastic 2.0 许可）—— 深度的智能体专属评估、RAG 相关性、OpenInference 自动埋点（auto-instrumentation）。Comet Opik（Apache 2.0 许可）—— 自动化提示词优化、护栏（guardrails）、LLM 裁判式幻觉检测。

**类型：** 学习
**语言：** Python（标准库）
**前置：** 阶段 14 · 23（OTel GenAI）
**时长：** 约 45 分钟

## 学习目标

- 说出三大顶级开源智能体可观测性平台及其各自的许可证。
- 区分各平台最擅长的领域：Langfuse（提示词管理 + 会话）、Phoenix（RAG + 自动埋点）、Opik（优化 + 护栏）。
- 解释为何到 2026 年有 89% 的组织报告已部署智能体可观测性。
- 用标准库实现一条从追踪到仪表盘（trace-to-dashboard）的管线，并配以 LLM 裁判式评估。

## 问题所在

OTel GenAI（第 23 课）为你提供了模式（schema）。你仍然需要一个平台来摄取 span、运行评估、存储提示词版本并暴露回归（regression）问题。这三个竞争者各自侧重生命周期的不同环节。

## 核心概念

### Langfuse（MIT）

- 每月 600 万+ 次 SDK 安装，GitHub 星标 1.9 万+。
- 功能：追踪、带版本管理与 playground 的提示词管理、评估（LLM 充当裁判、用户反馈、自定义）、会话回放。
- 2025 年 6 月：原先的商业模块（LLM 充当裁判、标注队列、提示词实验、Playground）以 MIT 许可开源。
- 最擅长：端到端可观测性，配合紧密的提示词管理闭环。

### Arize Phoenix（Elastic License 2.0）

- 更深入的智能体专属评估：追踪聚类（trace clustering）、异常检测、面向 RAG 的检索相关性。
- 原生 OpenInference 自动埋点。
- 与托管版 Arize AX 搭配用于生产环境。
- 不提供提示词版本管理 —— 定位为与更广泛平台并用的漂移（drift）/行为回归工具。
- 最擅长：RAG 相关性、行为漂移、异常检测。

### Comet Opik（Apache 2.0）

- 通过 A/B 实验实现自动化提示词优化。
- 护栏（PII 脱敏、话题约束）。
- LLM 裁判式幻觉检测。
- 来自 Comet 自身测量的基准：Opik 记录日志 + 评估耗时 23.44 秒，而 Langfuse 为 327.15 秒（约 14 倍差距）—— 厂商提供的基准只能作方向性参考。
- 最擅长：优化闭环、自动化实验、护栏执行。

### 行业数据

据 Maxim（2026 年实地分析）：89% 的组织已部署智能体可观测性；质量问题是生产环境的首要障碍（32% 的受访者将其列为障碍）。

### 如何选型

| 需求 | 选择 |
|------|------|
| 集提示词管理于一体的一站式方案 | Langfuse |
| 深度 RAG 评估 + 漂移检测 | Phoenix |
| 自动化优化 + 护栏 | Opik |
| 开放许可，不接受 ELv2 | Langfuse（MIT）或 Opik（Apache 2.0） |
| Datadog / New Relic 集成 | 任意 —— 它们都导出 OTel |

### 该模式容易出错的地方

- **没有评估策略。** 只有追踪而没有评估，不过是昂贵的日志记录。
- **自研 LLM 裁判却缺乏事实依据（grounding）。** CRITIC 模式（第 05 课）在此适用 —— 裁判需要外部工具来做事实核验。
- **提示词版本未与追踪关联。** 当生产环境出现回归时，你无法二分定位（bisect）到导致问题的那个提示词。

## 动手构建

`code/main.py` 用标准库实现了一个追踪收集器 + LLM 裁判式评估器：

- 摄取 GenAI 形态的 span。
- 按会话分组，标记失败的运行（护栏触发、低置信度评估）。
- 一个脚本化的 LLM 裁判，按评分细则（rubric）为智能体响应打分。
- 一份类仪表盘的摘要：失败率、主要失败原因、评估分数分布。

运行它：

```
python3 code/main.py
```

输出：逐会话的评估分数与失败分类，与 Langfuse/Phoenix/Opik 所呈现的内容相对应。

## 实际使用

- **Langfuse** 自托管或云端；通过 OTel 或其 SDK 接入。
- **Arize Phoenix** 自托管；自动埋点 OpenInference。
- **Comet Opik** 自托管或云端；自动化优化闭环。
- **Datadog LLM Observability** 适合已在使用 Datadog、运维与机器学习混合的团队。

## 交付落地

`outputs/skill-obs-platform-wiring.md` 选定一个平台，并将追踪 + 评估 + 提示词版本接入一个现有智能体。

## 练习

1. 将一周的 OTel 追踪导出到 Langfuse 云端（免费套餐）。哪些会话失败了？为什么？
2. 为你的领域编写一份 LLM 裁判评分细则（事实正确性、语气、范围遵循度）。在 50 条追踪上测试。
3. 对比 Langfuse 的提示词版本管理与 Phoenix 的追踪聚类。哪个能更快告诉你出了什么问题？
4. 阅读 Opik 的护栏文档。为你的某次智能体运行接入一个 PII 脱敏护栏。
5. 在你自己的语料上对三者做基准测试。忽略厂商公布的数字，自己测量。

## 关键术语

| 术语 | 人们的说法 | 它实际的含义 |
|------|----------------|------------------------|
| Tracing（追踪） | “span 收集器” | 摄取 OTel / SDK span；按会话建立索引 |
| Prompt management（提示词管理） | “提示词 CMS” | 与追踪关联的带版本提示词 |
| LLM-as-judge（LLM 充当裁判） | “自动化评估” | 用一个独立的 LLM 按评分细则给智能体输出打分 |
| Session replay（会话回放） | “追踪回放” | 逐步重演过往运行以便调试 |
| RAG relevancy（RAG 相关性） | “检索质量” | 检索到的上下文是否与查询匹配 |
| Trace clustering（追踪聚类） | “行为分组” | 将相似运行聚类以检测漂移 |
| Guardrail enforcement（护栏执行） | “日志时刻的策略” | 对已记录内容做 PII/毒性/范围检查 |

## 延伸阅读

- [Langfuse 文档](https://langfuse.com/) —— 追踪、评估、提示词管理
- [Arize Phoenix 文档](https://docs.arize.com/phoenix) —— 自动埋点、漂移
- [Comet Opik](https://www.comet.com/site/products/opik/) —— 优化 + 护栏
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 三者共同消费的模式
