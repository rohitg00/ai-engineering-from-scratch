# LLM 生产环境的混沌工程

> 在 2026 年，面向 LLM 的混沌工程已自成一派。在生产环境运行实验前的先决条件：定义好的 SLI/SLO、trace+指标+日志可观测性、自动回滚、runbook、on-call。架构包含四个平面：控制平面（实验调度器）、目标平面（服务、基础设施、数据存储）、安全平面（防护 + 中止 + 流量过滤器）、可观测性平面（指标 + trace + 日志），以及反馈环（回灌至 SLO 调整）。防护措施是强制性的：当每日错误预算消耗超过预期的 2 倍时，燃耗率告警会暂停实验；抑制窗口 + trace-ID 关联可对告警噪声去重。节奏：每周小型金丝雀实验 + SLO 评审；每月演练日 + 复盘；每季度跨团队韧性审计 + 依赖关系梳理。LLM 特有的实验：内存过载、网络故障、提供商宕机、畸形 prompt、KV 缓存逐出风暴。工具：Harness Chaos Engineering（基于 LLM 的实验推荐、爆炸半径缩减、MCP 工具集成）；LitmusChaos（CNCF）；Chaos Mesh（CNCF，Kubernetes 原生）。

**Type:** Learn
**Languages:** Python（标准库，玩具级混沌实验运行器）
**Prerequisites:** Phase 17 · 23（AI 的 SRE）、Phase 17 · 13（可观测性）
**Time:** 约 60 分钟

## 学习目标

- 说出混沌工程的五个先决条件（SLI/SLO、可观测性、回滚、runbook、on-call），并解释为什么缺了任何一个都会破坏这套实践。
- 绘制四个平面（控制、目标、安全、可观测性）以及回灌到 SLO 的反馈环。
- 列举五个 LLM 特有的实验（内存过载、网络故障、提供商宕机、畸形 prompt、KV 逐出风暴）。
- 根据技术栈在 Harness、LitmusChaos、Chaos Mesh 中选型。

## 问题

传统技术栈中的混沌测试已经很成熟。LLM 技术栈引入了新的故障模式。一个含毒字符的 4K-token prompt 会让分词器卡住 12 秒。上游提供商返回 429；你的网关重试；你的服务因重试放大的并发量而 OOM。突发负载下的 KV 缓存逐出风暴会引发重复预填充（re-prefill）级联，使算力饱和。

这些问题都不会出现在单元测试中。混沌工程就是让你抢在用户之前发现它们的方法。

## 概念

### 先决条件

在没有以下条件时不要在生产环境运行混沌实验：

1. **SLI/SLO** — 定义好的服务级指标与目标。
2. **可观测性** — trace、指标、日志，并接入仪表盘。
3. **自动回滚** — Phase 17 · 20 的策略标志回滚。
4. **Runbook** — 结构化的，见 Phase 17 · 23。
5. **On-call** — 有人负责响应。

缺了任何一项，混沌就会变成真实事故。

### 四个平面 + 反馈

**控制平面** — 实验调度器（Litmus workflow、Chaos Mesh schedule、Harness UI）。

**目标平面** — 服务、pod、节点、负载均衡器、数据存储。

**安全平面** — 终止开关、抑制窗口、爆炸半径限制、错误预算门禁。

**可观测性平面** — 常规指标 + trace-ID 关联，以区分混沌引发和自然发生的故障。

**反馈环** — 实验发现回灌到 SLO 调整、runbook 更新和代码修复。

### 防护措施是强制性的

- **燃耗率告警**：当每日错误预算消耗超过预期的 2 倍时暂停实验。
- **抑制窗口**：实验期间在爆炸半径内屏蔽非实验告警。
- **Trace-ID 关联**：所有由实验引发的错误都带上标签，便于 on-call 去重。

### 五个 LLM 特有的实验

1. **内存过载** — 通过高并发发送长上下文请求，强制制造 KV 缓存抢占风暴。观察：服务是优雅降级还是崩溃？

2. **网络故障** — 切断推理网关与提供商之间的连接。观察：回退机制是否在 SLA 内生效？（Phase 17 · 19）

3. **提供商宕机模拟** — 让 OpenAI 100% 返回 429。观察：路由是否故障转移到 Anthropic？（Phase 17 · 16、19）

4. **畸形 prompt** — 注入能让分词器卡住的载荷（如深度嵌套的 unicode、超大 UTF-8 码点）。观察：单个请求是否会锁死一个 worker？

5. **KV 逐出风暴** — 通过打满 vLLM 块预算来强制逐出。观察：LMCache 能否恢复，还是服务降级？

### 节奏

- **每周** — 在 staging 中进行小型金丝雀实验，也可在 prod 中占 5%。
- **每月** — 针对特定场景的演练日；跨团队参与；复盘。
- **每季度** — 跨团队韧性审计；更新依赖关系图。

### 工具

- **Harness Chaos Engineering** — 商业产品；AI 推荐实验；爆炸半径缩减；MCP 工具集成。
- **LitmusChaos** — CNCF 毕业项目；基于 Kubernetes workflow。
- **Chaos Mesh** — CNCF sandbox 项目；Kubernetes 原生 CRD 风格。
- **Gremlin** — 商业产品；支持范围广。
- **AWS FIS** / **Azure Chaos Studio** — 托管云服务。

### 从小处着手

第一个实验：在稳定流量下 kill 掉一个 decode 副本的 pod。观察重新路由和恢复。如果成功且看起来安全，再进阶到网络混沌。

第一个 LLM 特有的实验：注入一个提供商的 429，持续 5 分钟。观察回退行为。大多数团队会发现他们的回退机制从未被完整测试过。

### 你应该记住的数字

- 四个平面：控制、目标、安全、可观测性。
- 燃耗率暂停阈值：每日预算消耗超过预期的 2 倍。
- 节奏：每周金丝雀、每月演练日、每季度审计。
- 五个 LLM 实验：内存、网络、提供商、畸形 prompt、KV 风暴。

```figure
i4-chaos-guard
```

## 使用它

`code/main.py` 模拟三个带安全平面门禁的混沌实验。报告哪些实验会触发燃耗率中止。

## 交付它

本课产出 `outputs/skill-chaos-plan.md`。根据技术栈和成熟度，选出前三个实验及所用工具。

## 练习

1. 运行 `code/main.py`。哪个实验触发了燃耗率门禁，为什么？
2. 为基于 vLLM 的 RAG 服务设计前五个混沌实验。包含成功标准。
3. 你的燃耗率告警暂停了一个实验。你如何判断根因是混沌还是自然故障？
4. 论证混沌实验应该跑在生产环境还是只在 staging。什么时候生产环境才是正确答案？
5. 列举三种通用网络混沌无法复现的 LLM 特有故障模式。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| SLI / SLO | “服务目标” | 指标 + 目标；必备先决条件 |
| 爆炸半径 | “范围” | 实验影响到的服务 / 用户集合 |
| 燃耗率告警 | “预算门禁” | 当错误预算消耗速率 > 预期的 2 倍时触发 |
| 演练日 | “每月演练” | 计划好的跨团队混沌演习 |
| LitmusChaos | “CNCF workflow” | CNCF 毕业的 Kubernetes 混沌工具 |
| Chaos Mesh | “CNCF CRD” | CNCF sandbox 的 Kubernetes 原生混沌工具 |
| Harness CE | “商业 AI 辅助” | 带 AI 推荐的 Harness 混沌工程 |
| 畸形 prompt | “分词器炸弹” | 会卡住分词过程的输入 |
| KV 逐出风暴 | “抢占级联” | 大规模逐出引发的重复预填充 |

## 延伸阅读

- [DevSecOps School — Chaos Engineering 2026 Guide](https://devsecopsschool.com/blog/chaos-engineering/)
- [Ankush Sharma — Observability for LLMs (book)](https://www.amazon.com/Observability-Large-Language-Models-Engineering-ebook/dp/B0DJSR65TR)
- [LitmusChaos (CNCF)](https://litmuschaos.io/)
- [Chaos Mesh (CNCF)](https://chaos-mesh.org/)
- [Harness Chaos Engineering](https://www.harness.io/products/chaos-engineering)
- [AWS FIS](https://aws.amazon.com/fis/)