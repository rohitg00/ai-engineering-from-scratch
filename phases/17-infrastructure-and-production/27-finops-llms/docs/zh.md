# LLM 的 FinOps —— 单位经济学与多租户归因

> 传统 FinOps 在 LLM 支出上失效。成本是 token 交易，而非资源运行时间。标签无法映射 —— API 调用是交易，不是资产。工程决策（prompt 设计、上下文窗口、输出长度）就是财务决策。2026 年的 playbook 有三个必须在第一天就埋点的归因维度：按用户（`user_id`）用于席位定价和扩展，按任务（`task_id` + `route`）用于产品功能成本和优先级排序，按租户（`tenant_id`）用于单位经济学和续约。四个 token 层 —— prompt、工具、记忆、响应 —— 混在一个桶里会隐藏支出。多租户产品的执行阶梯：按租户限速（预期峰值的 2–3 倍，明确返回 429 + retry-after）；每日支出上限（合同上限的 1.5–3 倍；触发限速收紧 + 告警）；支出 z-score > 4 时触发 kill switch（自动暂停 + 呼叫值班）。归因模式：标签聚合、遥测关联（trace-ID → 计费；最高精度）、采样外推、基于模型的分配、事件溯源、实时流式。单位指标：每次已解决查询的成本、每次生成工件的成本 —— 而非 $/M token。事后打标签永远会遗漏；在请求创建时就埋点。

**类型：** 学习
**语言：** Python（标准库，带 kill switch 的简易成本归因模拟器）
**前置知识：** 第 17 阶段 · 13（可观测性）、第 17 阶段 · 14（缓存）
**时间：** ~60 分钟

## 学习目标

- 解释为何传统 FinOps（标签 + 层级）在 LLM 支出上失效，并说出三个新的归因维度。
- 列举四个 token 层（prompt、工具、记忆、响应）以及为何单桶计费会隐藏成本。
- 为多租户产品设计执行阶梯（限速 → 支出上限 → kill switch）。
- 选择单位指标（每次已解决查询/工件的成本）而非 $/M token。

## 问题背景

你的账单显示 $40,000。你不知道：
- 哪个租户花的。
- 哪个产品功能驱动的。
- 是否有单个用户滥用。
- 是 prompt 膨胀、工具调用还是记忆放大导致的。

云资源（EC2、S3）的标签聚合有效，因为标签会传播到行项目。LLM API 调用不会自动打标签 —— 你必须在调用点打上用户/任务/租户标签并全程携带。事后归因永远会遗漏边界情况。

## 核心概念

### 三个归因维度

**按用户**（`user_id`）：谁在花多少钱。驱动席位定价、扩展对话、识别高价值用户。

**按任务**（`task_id` + `route`）：哪个产品功能花多少钱。驱动功能优先级排序、砍掉昂贵功能的决策。

**按租户**（`tenant_id`）：哪个客户盈利。驱动单位经济学、续约定价、层级阈值。

第一天就在调用点埋点所有三个维度。事后埋点总是更差。

### 四个 token 层

| 层级 | 示例 | 典型占总成本比例 |
|------|------|----------------|
| Prompt | 系统 + 用户输入 | 40–60% |
| 工具 | 反馈的工具调用结果 | 20–40%（智能体工作负载） |
| 记忆 | 先前对话 / 检索文档 | 10–30% |
| 响应 | 模型输出 | 10–30% |

将四层混在一起会让优化盲目。在归因 schema 中拆分它们。

### 执行阶梯

1. **按租户限速**。预期峰值的 2–3 倍。返回 429 并带 `Retry-After`。租户感受到摩擦；没有意外账单。

2. **按租户每日支出上限**。合同上限的 1.5–3 倍。触发：收紧限速 + 告警客户成功团队。

3. **支出 z-score > 4 时触发 kill switch**（相对于租户基线）。自动暂停租户；呼叫值班；升级给运维 + CS。

### 归因模式

- **标签聚合**：打上元数据头；后续聚合。简单；粗略。
- **遥测关联**：通过 trace ID 将链路追踪与计费关联。最高精度。成熟团队的做法。
- **采样 + 外推**：采样 5–10%，乘以倍数。对粗略支出成本有效；遗漏尾部。
- **基于模型的分配**：回归推断成本驱动因素。用于无标签的遗留数据。
- **事件溯源**：成本作为流中的事件（Kafka / Kinesis）。实时。
- **实时流式**：仪表盘亚秒级更新。

### Cost per X 是单位指标

$/M token 是供应商语言。产品指标：

- 每次已解决支持工单的成本。
- 每次生成文章的成本。
- 每次成功智能体任务的成本。
- 每用户会话分钟的成本。

将成本与产品结果挂钩。否则优化没有锚点。

### 成本归因链路形状

```
trace_id: abc123
  user_id: u_42
  tenant_id: t_7
  task_id: task_classify_doc
  route: model_haiku
  layers:
    prompt_tokens: 1800
    tool_tokens: 600
    memory_tokens: 400
    response_tokens: 150
  cost_usd: 0.0135
  cached_input: true
  batch: false
```

每次调用都发出。存储在数据湖中。按维度聚合。第 17 阶段 · 13 的可观测性栈就是存放这些数据的地方。

### 复合节省栈

叠加：缓存 + 批量 + 路由 + 网关。四项全上：
- L2 缓存（第 17 阶段 · 14）：输入成本约 10 倍降低。
- 批量（第 17 阶段 · 15）：5 折。
- 路由到便宜模型（第 17 阶段 · 16）：成本降低 60%。
- 网关效率（第 17 阶段 · 19）：冗余 + 重试。

最佳情况叠加：约 naive 基线的 5–10%。大多数团队启用了 2–3 个杠杆；很少能叠加全部四个。

### 需要记住的数字

- 归因维度：按用户、按任务、按租户。
- 四个 token 层：prompt、工具、记忆、响应。
- Kill switch：支出 z-score > 4。
- 单位指标：每次已解决查询的成本，而非 $/M token。
- 叠加优化：可达到约基线的 5–10%。

## 使用

`code/main.py` 模拟一个带三层执行阶梯的多租户 LLM 服务。注入一个滥用租户并演示 kill switch 触发。

## 交付

本课产出 `outputs/skill-finops-plan.md`。给定产品和规模，设计归因 schema 和执行阶梯。

## 练习

1. 运行 `code/main.py`。Kill switch 在什么 z-score 触发？如何选择阈值？
2. 设计一个按租户、按任务的成本仪表盘。你先构建哪 5 个视图？
3. 你最大的租户单位经济学为负。按客户影响排序提出三个干预措施。
4. 计算一个支持产品的每次已解决工单成本：每张工单 3M token、约 800 张/天、GPT-5 缓存费率。
5. 辩论事后打标签是否可能有效。什么时候可以接受？

## 关键术语

| 术语 | 业界说法 | 实际含义 |
|------|---------|---------|
| Per-user attribution | "user-level cost" | 每次调用打上 `user_id` |
| Per-task attribution | "feature cost" | `task_id` + `route` 标识产品功能 |
| Per-tenant attribution | "customer cost" | `tenant_id`；驱动单位经济学 |
| Four token layers | "cost layers" | prompt + 工具 + 记忆 + 响应 |
| Rate limit | "429 guard" | 网关上按租户执行的上限 |
| Daily spend cap | "daily ceiling" | 租户范围预算带告警 |
| Kill switch | "auto-pause" | 支出 z-score > 4 触发自动暂停 |
| Cost per resolved | "product unit metric" | 成本与产品结果挂钩，而非 token |
| Telemetry joiner | "trace-to-billing" | 最高精度的归因模式 |
| Stacked optimization | "cache+batch+route+gateway" | 复合节省至约基线 5–10% |

## 延伸阅读

- [FinOps Foundation — FinOps for AI Overview](https://www.finops.org/wg/finops-for-ai-overview/)
- [FinOps School — Cost per Unit 2026 Guide](https://finopsschool.com/blog/cost-per-unit/)
- [Digital Applied — LLM Agent Cost Attribution 2026](https://www.digitalapplied.com/blog/llm-agent-cost-attribution-guide-production-2026)
- [PointFive — Managed LLMs in Azure OpenAI](https://www.pointfive.co/blog/finops-for-ai-economics-of-managed-llms-in-azure-open-ai)
