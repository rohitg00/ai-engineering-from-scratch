# LLM 的 FinOps —— 单位经济学与多租户成本归属

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 传统 FinOps 在 LLM 支出面前会失灵。这里的成本是 token 交易，而不是资源在线时长。Tag 也对不上号——一次 API 调用是一笔交易，不是一项资产。工程决策（prompt 设计、context window、输出长度）就是财务决策。2026 年的实战手册里，第一天就要埋三个归属维度：按用户（`user_id`）用于席位定价和扩张、按任务（`task_id` + `route`）用于产品面成本和优先级、按租户（`tenant_id`）用于单位经济学和续约。四层 token——prompt、tool、memory、response——一个桶装下就掩盖了支出。多租户产品的执行阶梯：每租户限流（2-3 倍预期峰值，明确返回 429 + retry-after）；每日支出上限（合同上限的 1.5-3 倍；触发收紧限流 + 告警）；当支出 z-score > 4 时拉 kill switch（自动暂停 + 呼叫 on-call）。归属模式：tag-and-aggregate、telemetry-joiner（trace-ID → 账单；精度最高）、采样外推、基于模型的分配、事件溯源、实时流。单位指标：每条已解决查询的成本、每件已生成产物的成本——而不是 $/M tokens。事后补 tag 总会漏，要在请求创建时就埋好。

**Type:** Learn
**Languages:** Python (stdlib, toy cost-attribution simulator with kill switch)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 14 (Caching)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 解释为何传统 FinOps（tag + 分级）在 LLM 支出上行不通，并说出三个新的归属维度。
- 列举四层 token（prompt、tool、memory、response），并说明为什么单桶计费会掩盖成本。
- 为多租户产品设计一套执行阶梯（限流 → 支出上限 → kill switch）。
- 选一个单位指标（每条已解决查询 / 每件产物的成本），而不是 $/M tokens。

## 问题（Problem）

账单写着 $40,000。你不知道：
- 哪个租户花掉的。
- 哪个产品功能催生的。
- 是不是哪个用户在滥用。
- 是 prompt 膨胀、tool 调用，还是 memory 放大才是元凶。

Tag-and-aggregate 在云资源（EC2、S3）上行得通，因为 tag 会顺着传到账单条目里。LLM API 调用不会自动打 tag——你必须在调用点把 user / task / tenant 戳上去并一路带下来。事后追溯归属总会漏掉边缘情况。

## 概念（Concept）

### 三个归属维度（Three attribution dimensions）

**按用户**（`user_id`）：谁花了多少钱。驱动席位定价、扩张谈判，识别重度用户。

**按任务**（`task_id` + `route`）：哪个产品面花了多少。驱动功能优先级，决定要不要砍掉烧钱功能。

**按租户**（`tenant_id`）：哪个客户能赚钱。驱动单位经济学、续约定价、分级阈值。

第一天就在调用点把这三者全埋上。事后补永远更糟。

### 四层 token（Four token layers）

| 层 | 例子 | 占总量典型比例 |
|-------|---------|---------------------|
| Prompt | system + 用户输入 | 40-60% |
| Tool | tool 调用结果回填 | 20-40%（agent 工作负载） |
| Memory | 历史对话 / 检索到的文档 | 10-30% |
| Response | 模型输出 | 10-30% |

把这四层捏到一起，优化就瞎了。在归属 schema 里把它们拆开。

### 执行阶梯（Enforcement ladder）

1. **限流**，按租户。2-3 倍预期峰值。返回 429 带 `Retry-After`。租户感受到摩擦；不会被账单吓到。

2. **每日支出上限**，按租户。合同上限的 1.5-3 倍。触发后：收紧限流 + 通知客户成功团队。

3. **Kill switch**：当支出 z-score 相对租户基线 > 4 时触发。自动暂停租户；呼叫 on-call；上报到 ops + CS。

### 归属模式（Attribution patterns）

- **Tag-and-aggregate**：盖上元数据 header；之后再聚合。简单；粗糙。
- **Telemetry joiner**：通过 trace ID 把 trace 和账单连起来。精度最高。成熟团队都这么干。
- **采样 + 外推**：抽样 5-10%，再乘上去。粗略支出估算性价比高；漏掉长尾。
- **基于模型的分配**：用回归推断成本驱动因子。适用于无 tag 的旧数据。
- **事件溯源**：把成本作为事件流（Kafka / Kinesis）写出。实时。
- **实时流**：仪表盘亚秒级刷新。

### 每 X 成本才是单位指标（Cost per X is the unit metric）

$/M tokens 是供应商话术。产品指标才是：

- 每条已解决工单的成本。
- 每篇已生成文章的成本。
- 每个成功 agent 任务的成本。
- 每用户会话分钟的成本。

把成本绑到产品成果上。否则优化就没了锚点。

### 成本归属 trace 形态（Cost attribution trace shape）

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

每次调用都要发出。落到数据湖。按各维度聚合。这就是 Phase 17 · 13 可观测性栈承载的位置。

### 复合节省叠加（The compounded-savings stack）

栈：cache + batch + route + gateway。四样齐上：
- Cache L2（Phase 17 · 14）：输入便宜约 10 倍。
- Batch（Phase 17 · 15）：5 折。
- 路由到便宜模型（Phase 17 · 16）：成本砍 60%。
- 网关效率（Phase 17 · 19）：冗余 + 重试。

最优叠加结果：朴素基线的约 5-10%。多数团队只用了 2-3 根杠杆；很少有人四样全叠。

### 该记住的数字（Numbers you should remember）

- 归属维度：按用户、按任务、按租户。
- 四层 token：prompt、tool、memory、response。
- Kill switch：支出 z-score > 4。
- 单位指标：每条已解决查询的成本，而不是 $/M tokens。
- 叠加优化后：可能压到基线的约 5-10%。

## 用起来（Use It）

`code/main.py` 模拟一个多租户 LLM 服务，带三层执行阶梯。注入一个滥用型租户，演示 kill switch 触发的过程。

## 上线部署（Ship It）

本节产出 `outputs/skill-finops-plan.md`。给定产品和规模，设计归属 schema 和执行阶梯。

## 练习（Exercises）

1. 跑 `code/main.py`。kill switch 在 z-score 多少时触发？阈值你怎么定？
2. 设计一个按租户、按任务的成本仪表盘。先做哪 5 个视图？
3. 你最大的租户单位经济学为负。按客户影响排序，提出三种干预方案。
4. 给一个客服产品算每张工单的解决成本：每张工单 300 万 tokens，每天约 800 张工单，按 GPT-5 cached 价。
5. 论一论事后补 tag 究竟可不可行。什么情况下能接受？

## 关键术语（Key Terms）

| 术语 | 嘴上说的 | 实际指什么 |
|------|----------------|------------------------|
| 按用户归属 | "用户级成本" | 每次调用都打上 `user_id` |
| 按任务归属 | "功能成本" | `task_id` + `route` 标识产品面 |
| 按租户归属 | "客户成本" | `tenant_id`；驱动单位经济学 |
| 四层 token | "成本层" | prompt + tool + memory + response |
| 限流 | "429 守门" | 网关上按租户的上限 |
| 每日支出上限 | "每日额度" | 租户级预算 + 告警 |
| Kill switch | "自动暂停" | 支出 z-score > 4 时自动挂起 |
| 每条已解决成本 | "产品单位指标" | 成本绑到产品成果，而不是 token |
| Telemetry joiner | "trace-to-billing" | 精度最高的归属模式 |
| 叠加优化 | "cache+batch+route+gateway" | 复合节省，压到基线约 5-10% |

## 延伸阅读（Further Reading）

- [FinOps Foundation — FinOps for AI Overview](https://www.finops.org/wg/finops-for-ai-overview/)
- [FinOps School — Cost per Unit 2026 Guide](https://finopsschool.com/blog/cost-per-unit/)
- [Digital Applied — LLM Agent Cost Attribution 2026](https://www.digitalapplied.com/blog/llm-agent-cost-attribution-guide-production-2026)
- [PointFive — Managed LLMs in Azure OpenAI](https://www.pointfive.co/blog/finops-for-ai-economics-of-managed-llms-in-azure-open-ai)
