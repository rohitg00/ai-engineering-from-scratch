# Agent 可观测性:Langfuse、Phoenix、Opik

> 三大开源 agent 可观测性平台主导 2026 年。Langfuse(MIT)——每月 600 万+ 安装量,tracing + prompt 管理 + 评估 + 会话回放。Arize Phoenix(Elastic 2.0)——深入的 agent 专项评估、RAG 相关性、OpenInference 自动插桩。Comet Opik(Apache 2.0)——自动化 prompt 优化、guardrails、LLM 评审的幻觉检测。

**类型:** 学习
**语言:** Python(stdlib)
**前置要求:** 阶段 14 · 23(OTel GenAI)
**时间:** 约 45 分钟

## 学习目标

- 说出三大顶级开源 agent 可观测性平台及其许可证。
- 区分各自最擅长的领域:Langfuse(prompt 管理 + 会话)、Phoenix(RAG + 自动插桩)、Opik(优化 + guardrails)。
- 解释为什么到 2026 年有 89% 的组织报告已部署 agent 可观测性。
- 实现一条纯 stdlib 的 trace 到仪表盘的流水线,并带 LLM 评审评估。

## 问题所在

OTel GenAI(第 23 课)提供了 schema。你仍需要一个平台来摄取 span、运行评估、存储 prompt 版本并呈现回归。三个竞争者各自侧重生命周期的不同部分。

## 核心概念

### Langfuse(MIT)

- 每月 600 万+ SDK 安装量,19k+ GitHub stars。
- 功能:tracing、带版本管理 + playground 的 prompt 管理、评估(LLM-as-judge、用户反馈、自定义)、会话回放。
- 2025 年 6 月:原商业模块(LLM-as-a-judge、标注队列、prompt 实验、Playground)以 MIT 许可证开源。
- 最适合:端到端可观测性,并紧密衔接 prompt 管理闭环。

### Arize Phoenix(Elastic License 2.0)

- 更深入的 agent 专项评估:trace 聚类、异常检测、RAG 检索相关性。
- 原生 OpenInference 自动插桩。
- 与托管版 Arize AX 配合用于生产环境。
- 无 prompt 版本管理——定位为与更广泛平台并用的漂移/行为回归工具。
- 最适合:RAG 相关性、行为漂移、异常检测。

### Comet Opik(Apache 2.0)

- 通过 A/B 实验实现自动化 prompt 优化。
- Guardrails(PII 脱敏、主题约束)。
- LLM 评审的幻觉检测。
- Comet 自己的测量基准:Opik 记录 + 评估耗时 23.44s,而 Langfuse 为 327.15s(约 14 倍差距)——请将厂商基准视为方向性参考。
- 最适合:优化闭环、自动化实验、guardrail 执行。

### 行业数据

根据 Maxim(2026 年领域分析):89% 的组织已部署 agent 可观测性;质量问题是最主要的生产障碍(32% 的受访者提及)。

### 如何选择

| 需求 | 选择 |
|------|------|
| 一体化并带 prompt 管理 | Langfuse |
| 深入的 RAG 评估 + 漂移 | Phoenix |
| 自动化优化 + guardrails | Opik |
| 开放许可证,不用 ELv2 | Langfuse(MIT)或 Opik(Apache 2.0) |
| Datadog / New Relic 集成 | 任意——它们都支持导出 OTel |

### 这一模式的常见误区

- **没有评估策略。** 没有评估的 tracing 只是最昂贵的日志。
- **自建 LLM 评审却没有事实校验。** 适用 CRITIC 模式(第 05 课)——评审器需要外部工具进行事实核验。
- **Prompt 版本未与 trace 关联。** 当生产环境出现回归时,你无法二分定位到引发问题的 prompt。

```figure
wb-trace-ingest
```

## 动手实现

`code/main.py` 实现了纯 stdlib 的 trace 收集器 + LLM 评审评估器:

- 摄取 GenAI 格式的 span。
- 按会话分组,标记失败的运行(guardrail 触发、低置信度评估)。
- 一个脚本化的 LLM 评审器,按评分标准对 agent 回复打分。
- 类似仪表盘的汇总:失败率、最常见的失败原因、评估分数分布。

运行:

```
python3 code/main.py
```

输出:与 Langfuse/Phoenix/Opik 所展示一致的每会话评估分数和失败归类。

## 实际使用

- **Langfuse** 自托管或云端;通过 OTel 或其 SDK 接入。
- **Arize Phoenix** 自托管;自动插桩 OpenInference。
- **Comet Opik** 自托管或云端;自动化优化闭环。
- **Datadog LLM Observability** 适合已在使用 Datadog 的运维+机器学习混合团队。

## 上线部署

`outputs/skill-obs-platform-wiring.md` 选择一个平台,并将 trace + 评估 + prompt 版本接入现有的 agent。

## 练习

1. 将一周的 OTel trace 导出到 Langfuse 云(免费层)。哪些会话失败了?为什么?
2. 为你的领域编写一个 LLM 评审评分标准(事实正确性、语气、范围遵守)。在 50 条 trace 上测试。
3. 比较 Langfuse 的 prompt 版本管理与 Phoenix 的 trace 聚类。哪个能更快告诉你哪里出了问题?
4. 阅读 Opik 的 guardrail 文档。为你的一次 agent 运行接入一个 PII 脱敏 guardrail。
5. 在你自己的语料上对三者进行基准测试。忽略厂商发布的数字;自己动手测量。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|----------------|------------------------|
| Tracing | "Span 收集" | 摄取 OTel / SDK span;按会话索引 |
| Prompt 管理 | "Prompt CMS" | 与 trace 关联的带版本 prompt |
| LLM-as-judge | "自动化评估" | 由独立 LLM 按评分标准为 agent 输出打分 |
| 会话回放 | "Trace 回放" | 逐步回溯过去的运行以进行调试 |
| RAG 相关性 | "检索质量" | 检索到的上下文是否与查询匹配 |
| Trace 聚类 | "行为分组" | 对相似的运行聚类以检测漂移 |
| Guardrail 执行 | "记录时策略检查" | 对记录内容进行 PII/毒性/范围检查 |

## 延伸阅读

- [Langfuse 文档](https://langfuse.com/) — tracing、评估、prompt 管理
- [Arize Phoenix 文档](https://docs.arize.com/phoenix) — 自动插桩、漂移
- [Comet Opik](https://www.comet.com/site/products/opik/) — 优化 + guardrails
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 三者共同消费的 schema