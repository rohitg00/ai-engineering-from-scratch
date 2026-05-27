# Agent 可观测性：Langfuse、Phoenix、Opik

> 2026年三大开源 Agent 可观测性平台主导市场。Langfuse（MIT 许可）—— 月安装量 600 万+，追踪 + 提示管理 + 评估 + 会话回放。Arize Phoenix（Elastic 2.0 许可）—— 深度 Agent 专用评估、RAG 相关性、OpenInference 自动埋点。Comet Opik（Apache 2.0 许可）—— 自动化提示优化、护栏、LLM-judge 幻觉检测。

**类型：** 学习
**语言：** Python（标准库）
**先决条件：** 阶段 14 · 23（OTel GenAI）
**时间：** ~45 分钟

## 学习目标

- 说出三大开源 Agent 可观测性平台及其许可协议。
- 区分每个平台的强项：Langfuse（提示管理 + 会话）、Phoenix（RAG + 自动埋点）、Opik（优化 + 护栏）。
- 解释为何 89% 的组织在 2026 年报告已部署 Agent 可观测性。
- 实现标准库追踪到仪表板的流水线，含 LLM-judge 评估。

## 问题

OTel GenAI（第 23 课）提供了模式（schema）。你仍然需要能够摄取 span、运行评估、存储提示版本、并暴露回归问题的平台。三个竞争平台各自强调生命周期的不同部分。

## 概念

### Langfuse（MIT 许可）

- 月 SDK 安装量 600 万+，GitHub 星标 1.9 万+。
- 功能：追踪、带版本控制的提示管理 + 沙盒、评估（LLM 作为裁判、用户反馈、自定义）、会话回放。
- 2025 年 6 月：此前商业模块（LLM-as-a-judge、标注队列、提示实验、Playground）以 MIT 许可开源。
- 最强项：端到端可观测性，与紧密的提示管理循环结合。

### Arize Phoenix（Elastic License 2.0）

- 更深的 Agent 专用评估：追踪聚类、异常检测、RAG 检索相关性。
- 原生 OpenInference 自动埋点。
- 与托管服务 Arize AX 配对用于生产环境。
- 无提示版本控制 —— 定位为更广泛的平台之外的漂移/行为回归工具。
- 最强项：RAG 相关性、行为漂移、异常检测。

### Comet Opik（Apache 2.0 许可）

- 通过 A/B 实验实现自动化提示优化。
- 护栏（PII 编辑、主题约束）。
- LLM-judge 幻觉检测。
- Comet 自家测量基准：Opik 记录和评估耗时 23.44 秒，Langfuse 为 327.15 秒（约 14 倍差距）—— 供应商基准数据仅供参考。
- 最强项：优化循环、自动化实验、护栏执行。

### 行业数据

根据 Maxim（2026 年实地分析）：89% 的组织已部署 Agent 可观测性；质量问题是首要生产障碍（32% 的受访者提及）。

### 如何选择

| 需求 | 选择 |
|------|------|
| 一体化，含提示管理 | Langfuse |
| 深度 RAG 评估 + 漂移检测 | Phoenix |
| 自动化优化 + 护栏 | Opik |
| 开放许可，无 ELv2 | Langfuse（MIT）或 Opik（Apache 2.0）|
| Datadog / New Relic 集成 | 任意 —— 三者均导出 OTel |

### 这种模式的问题所在

- **无评估策略。** 没有评估的追踪只是昂贵的日志记录。
- **无依据的自行开发 LLM-judge。** CRITIC 模式（第 05 课）适用 —— 裁判需要外部工具进行事实验证。
- **提示版本未与追踪关联。** 当生产环境回归时，你无法二分查找导致问题的提示。

## 构建

`code/main.py` 实现了一个标准库追踪收集器 + LLM-judge 评估器：

- 摄取 GenAI 形态的 span。
- 按会话分组，标记失败运行（护栏触发、低置信度评估）。
- 一个脚本化的 LLM-judge，根据评分标准对 Agent 响应打分。
- 类仪表板摘要：失败率、主要失败原因、评估分数分布。

运行：

```
python3 code/main.py
```

输出：按会话的评估分数和失败分类，与 Langfuse/Phoenix/Opik 所展示的匹配。

## 使用

- **Langfuse** 自托管或云服务；通过 OTel 或其 SDK 连接。
- **Arize Phoenix** 自托管；自动埋点 OpenInference。
- **Comet Opik** 自托管或云服务；自动化优化循环。
- **Datadog LLM Observability** 适用于已运行 Datadog 的混合运维+ML 团队。

## 部署

`outputs/skill-obs-platform-wiring.md` 选择一个平台，将追踪 + 评估 + 提示版本接入现有 Agent。

## 练习

1. 将一周的 OTel 追踪导出到 Langfuse 云（免费层）。哪些会话失败了？为什么？
2. 为你的领域编写 LLM-judge 评分标准（事实正确性、语气、范围遵守）。在 50 条追踪上测试。
3. 比较 Langfuse 提示版本控制与 Phoenix 的追踪聚类。哪个能更快告诉你什么出了问题？
4. 阅读 Opik 的护栏文档。将 PII 编辑护栏接入你的一个 Agent 运行。
5. 在你的语料库上基准测试三者。忽略供应商发布的数据；自己测量。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| Tracing（追踪） | "Spans 收集器" | 摄取 OTel / SDK span；按会话索引 |
| Prompt management（提示管理） | "提示 CMS" | 与追踪关联的版本化提示 |
| LLM-as-judge（LLM 作为裁判） | "自动化评估" | 独立 LLM 根据评分标准对 Agent 输出打分 |
| Session replay（会话回放） | "追踪回放" | 逐步查看过往运行以调试 |
| RAG relevancy（RAG 相关性） | "检索质量" | 检索的上下文是否与查询匹配 |
| Trace clustering（追踪聚类） | "行为分组" | 聚类相似运行以检测漂移 |
| Guardrail enforcement（护栏执行） | "记录时策略" | 对记录内容进行的 PII/毒性/范围检查 |

## 延伸阅读

- [Langfuse 文档](https://langfuse.com/) — 追踪、评估、提示管理
- [Arize Phoenix 文档](https://docs.arize.com/phoenix) — 自动埋点、漂移
- [Comet Opik](https://www.comet.com/site/products/opik/) — 优化 + 护栏
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 三者共同使用的模式
