# Agent 可观察性：Langfuse、Phoenix、Opik

> 三个开源 agent 可观察性平台主导 2026 年。Langfuse（MIT）—— 每月 600 万+ SDK 安装，跟踪 + 提示管理 + 评估 + 会话回放。Arize Phoenix（Elastic 2.0）—— 深度 agent 特定评估，RAG 相关性，OpenInference 自动检测。Comet Opik（Apache 2.0）—— 自动化提示优化，护栏，LLM-judge 幻觉检测。

**类型：** 学习
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 23（OTel GenAI）
**时间：** ~45 分钟

## 学习目标

- 说出三个顶级开源 agent 可观察性平台及其许可证。
- 区分每个平台最强的地方：Langfuse（提示管理 + 会话）、Phoenix（RAG + 自动检测）、Opik（优化 + 护栏）。
- 解释为什么 89% 的组织报告到 2026 年已部署 agent 可观察性。
- 实现一个标准库跟踪到仪表板的管道，包含 LLM-judge 评估。

## 问题

OTel GenAI（第 23 课）给你模式。你仍然需要摄取 span、运行评估、存储提示版本和显示回归的平台。三个竞争者各自强调生命周期的不同部分。

## 概念

### Langfuse（MIT）

- 每月 600 万+ SDK 安装，19k+ GitHub stars。
- 功能：跟踪、带版本控制 + 操场的提示管理、评估（LLM-as-judge、用户反馈、自定义）、会话回放。
- 2025 年 6 月：以前商业模块（LLM-as-a-judge、注释队列、提示实验、Playground）在 MIT 下开源。
- 最强用于：端到端可观察性，紧密的提示管理循环。

### Arize Phoenix（Elastic License 2.0）

- 更深的 agent 特定评估：跟踪聚类、异常检测、RAG 检索相关性。
- 原生 OpenInference 自动检测。
- 与托管 Arize AX 配对用于生产。
- 无提示版本控制 —— 定位为更广泛的平台旁边的漂移/行为回归工具。
- 最强用于：RAG 相关性、行为漂移、异常检测。

### Comet Opik（Apache 2.0）

- 通过 A/B 实验自动化提示优化。
- 护栏（PII 脱敏、主题约束）。
- LLM-judge 幻觉检测。
- Comet 自己的测量基准：Opik 日志 + 评估 23.44s vs Langfuse 327.15s（~14 倍差距）—— 将供应商基准视为方向性。
- 最强用于：优化循环、自动化实验、护栏执行。

### 行业数据

根据 Maxim（2026 年现场分析）：89% 的组织已部署 agent 可观察性；质量问题是顶级生产障碍（32% 的受访者引用）。

### 选择一个

| 需求 | 选择 |
|------|------|
| 带提示管理的一体化 | Langfuse |
| 深度 RAG 评估 + 漂移 | Phoenix |
| 自动化优化 + 护栏 | Opik |
| 开放许可，无 ELv2 | Langfuse（MIT）或 Opik（Apache 2.0） |
| Datadog / New Relic 集成 | 任何 —— 它们都导出 OTel |

### 此模式出错的地方

- **无评估策略。** 没有评估的跟踪只是昂贵的日志。
- **自研 LLM-judge 无依据。** CRITIC 模式（第 05 课）适用 —— judge 需要外部工具进行事实验证。
- **提示版本未绑定到跟踪。** 当生产回归时，你无法二分查找导致它的提示。

## 构建

`code/main.py` 实现标准库跟踪收集器 + LLM-judge 评估器：

- 摄取 GenAI 形状的 span。
- 按会话分组，标记失败的运行（护栏触发、低置信度评估）。
- 根据评分标准对 agent 响应评分的脚本化 LLM-judge。
- 仪表板式摘要：失败率、顶级失败原因、评估分数分布。

运行：

```
python3 code/main.py
```

输出：每会话评估分数和失败分类，匹配 Langfuse/Phoenix/Opik 会显示的内容。

## 使用

- **Langfuse** 自托管或云；通过 OTel 或其 SDK 连接。
- **Arize Phoenix** 自托管；自动检测 OpenInference。
- **Comet Opik** 自托管或云；自动化优化循环。
- **Datadog LLM Observability** 用于已运行 Datadog 的混合运维+ML 团队。

## 交付

`outputs/skill-obs-platform-wiring.md` 选择一个平台并将跟踪 + 评估 + 提示版本接入现有 agent。

## 练习

1. 将一周的 OTel 跟踪导出到 Langfuse 云（免费层）。哪些会话失败？为什么？
2. 为你的领域编写 LLM-judge 评分标准（事实正确性、语气、范围遵守）。在 50 个跟踪上测试。
3. 对比 Langfuse 提示版本控制与 Phoenix 的跟踪聚类。哪个更快告诉你什么坏了？
4. 阅读 Opik 的护栏文档。将 PII 脱敏护栏连接到你的一个 agent 运行。
5. 在你的语料库上基准测试三个。忽略供应商发布的数字；测量你自己的。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Tracing | "Span 收集器" | 摄取 OTel / SDK span；按会话索引 |
| Prompt management | "Prompt CMS" | 绑定到跟踪的版本化提示 |
| LLM-as-judge | "自动化评估" | 单独的 LLM 根据评分标准对 agent 输出评分 |
| Session replay | "跟踪回放" | 逐步执行过去的运行以进行调试 |
| RAG relevancy | "检索质量" | 检索到的上下文是否匹配查询 |
| Trace clustering | "行为分组" | 聚类相似运行以进行漂移检测 |
| Guardrail enforcement | "日志时策略" | 对日志内容的 PII/毒性/范围检查 |

## 延伸阅读

- [Langfuse 文档](https://langfuse.com/) —— 跟踪、评估、提示管理
- [Arize Phoenix 文档](https://docs.arize.com/phoenix) —— 自动检测、漂移
- [Comet Opik](https://www.comet.com/site/products/opik/) —— 优化 + 护栏
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 三个平台都消费的模式