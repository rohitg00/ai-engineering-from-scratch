# 24 · 面向 LLM 生产环境的混沌工程

> 在 2026 年，面向 LLM 的混沌工程（Chaos Engineering）已成为一门独立学科。在生产环境运行实验前的前置条件：明确定义的 SLI/SLO、追踪+指标+日志三位一体的可观测性、自动化回滚、运行手册（runbook）、值班（on-call）。其架构包含四个平面：控制平面（实验调度器）、目标平面（服务、基础设施、数据存储）、安全平面（防护 + 中止 + 流量过滤）、可观测平面（指标 + 追踪 + 日志），以及反馈环（回灌到 SLO 调整）。护栏（guardrail）是强制要求的：燃尽率（burn-rate）告警会在每日错误预算燃尽超过预期 2 倍时暂停实验；抑制窗口 + trace-ID 关联用于去重告警噪声。节奏：每周小规模金丝雀（canary）+ SLO 复盘；每月演练日（game day）+ 复盘报告（postmortem）；每季度跨团队韧性审计 + 依赖映射。LLM 专属实验：内存过载、网络故障、供应商宕机、畸形提示词、KV 缓存驱逐风暴。工具链：Harness Chaos Engineering（LLM 推导的实验建议、爆炸半径降级、MCP 工具集成）、LitmusChaos（CNCF）、Chaos Mesh（CNCF，Kubernetes 原生）。

**类型：** 学习
**语言：** Python（标准库，玩具级混沌实验运行器）
**前置：** 第 17 阶段 · 23（面向 AI 的 SRE）、第 17 阶段 · 13（可观测性）
**时长：** 约 60 分钟

## 学习目标

- 说出混沌工程的五项前置条件（SLI/SLO、可观测性、回滚、运行手册、值班），并解释为什么跳过任何一项都会破坏整套实践。
- 画出四个平面（控制、目标、安全、可观测）以及回灌到 SLO 的反馈环。
- 列举五种 LLM 专属实验（内存过载、网络故障、供应商宕机、畸形提示词、KV 驱逐风暴）。
- 在给定技术栈的前提下，从 Harness、LitmusChaos、Chaos Mesh 中挑选一款工具。

## 问题所在

传统技术栈中的混沌测试已经相当成熟。但 LLM 技术栈引入了新的故障模式。一个带有「投毒字符」的 4K-token 提示词会让分词器（tokenizer）卡死 12 秒。上游供应商返回 429；你的网关重试；你的服务在重试放大的并发压力下发生 OOM（内存溢出）。突发负载下的 KV 缓存驱逐风暴会引发重新预填充（re-prefill）级联，进而打满算力。

这些问题在单元测试里都不会暴露。混沌工程正是让你抢在用户之前发现它们的手段。

## 核心概念

### 前置条件

在生产环境运行混沌实验之前，务必具备：

1. **SLI/SLO** —— 已定义的服务等级指标（service-level indicator）与目标（objective）。
2. **可观测性** —— 追踪、指标、日志，并接入仪表盘。
3. **自动化回滚** —— 第 17 阶段 · 20 的策略标志（policy-flag）回滚。
4. **运行手册** —— 结构化文档，见第 17 阶段 · 23。
5. **值班** —— 有人能够响应。

缺少任何一项，混沌实验都会演变成真实事故。

### 四个平面 + 反馈

**控制平面（control plane）** —— 实验调度器（Litmus 工作流、Chaos Mesh 调度、Harness UI）。

**目标平面（target plane）** —— 服务、Pod、节点、负载均衡器、数据存储。

**安全平面（safety plane）** —— 紧急熔断开关（kill switch）、抑制窗口、爆炸半径（blast radius）上限、错误预算闸门。

**可观测平面（observability plane）** —— 常规指标 + trace-ID 关联，用以区分混沌引发的故障与自然发生的故障。

**反馈环（feedback loop）** —— 实验发现回灌到 SLO 调整、运行手册更新、代码修复。

### 护栏是强制要求

- **燃尽率告警**：若每日错误预算燃尽超过预期的 2 倍，则暂停实验。
- **抑制窗口**：实验期间，对爆炸半径内的非实验告警进行静默。
- **trace-ID 关联**：所有实验引发的错误都携带标签，便于值班人员去重。

### 五种 LLM 专属实验

1. **内存过载** —— 通过高并发发送长上下文请求，强制触发 KV 缓存抢占（preemption）风暴。观察：服务是优雅卸载（shed）还是直接崩溃？

2. **网络故障** —— 切断推理网关与供应商之间的连通性。观察：兜底（fallback）是否在 SLA 内生效？（第 17 阶段 · 19）

3. **供应商宕机模拟** —— OpenAI 返回 100% 的 429。观察：路由是否会故障转移（failover）到 Anthropic？（第 17 阶段 · 16、19）

4. **畸形提示词** —— 注入让分词器卡死的载荷（例如深度嵌套的 unicode、超大 UTF-8 码点）。观察：单个请求是否会锁死一个工作进程（worker）？

5. **KV 驱逐风暴** —— 通过打满 vLLM 的块预算（block budget）强制触发驱逐。观察：LMCache 能否恢复，还是服务会发生降级？

### 节奏

- **每周** —— 在预发（staging）环境做小规模金丝雀实验，或许放量到 5% 生产流量。
- **每月** —— 针对某个具体场景的计划性演练日；跨团队参与；产出复盘报告。
- **每季度** —— 跨团队韧性审计；更新依赖映射图。

### 工具链

- **Harness Chaos Engineering** —— 商业产品；AI 推导的实验建议；爆炸半径降级；MCP 工具集成。
- **LitmusChaos** —— CNCF 毕业项目；基于 Kubernetes 工作流。
- **Chaos Mesh** —— CNCF 沙箱项目；Kubernetes 原生 CRD 风格。
- **Gremlin** —— 商业产品；支持范围广。
- **AWS FIS** / **Azure Chaos Studio** —— 托管式云服务。

### 从小处起步

第一个实验：在稳定流量下对一个 decode 副本执行 pod-kill。观察重新路由与恢复。如果这一步可行且看起来安全，再升级到网络混沌。

第一个 LLM 专属实验：注入一次持续 5 分钟的供应商 429。观察兜底。大多数团队会发现，自己的兜底机制其实并未经过充分测试。

### 应当记住的数字

- 四个平面：控制、目标、安全、可观测。
- 燃尽率暂停：每日预算燃尽达到预期的 2 倍。
- 节奏：每周金丝雀、每月演练日、每季度审计。
- 五种 LLM 实验：内存、网络、供应商、畸形提示词、KV 风暴。

## 上手实践

`code/main.py` 模拟了三个带有安全平面闸门的混沌实验，并报告哪些实验会触发燃尽率中止。

## 交付实战

本课会产出 `outputs/skill-chaos-plan.md`。它会根据技术栈和成熟度，挑选前三个实验以及对应的工具链。

## 练习

1. 运行 `code/main.py`。哪个实验触发了燃尽率闸门，为什么？
2. 为一个基于 vLLM 的 RAG 服务设计前五个混沌实验。包含成功判据。
3. 你的燃尽率告警暂停了一个实验。你如何判定根因 —— 是混沌引起的还是自然发生的？
4. 论证混沌应当在生产环境运行还是只在预发环境运行。什么时候生产环境才是正确答案？
5. 说出三种通用网络混沌无法复现的 LLM 专属故障模式。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| SLI / SLO | "服务目标" | 指标 + 目标；必备前置条件 |
| Blast radius（爆炸半径） | "影响范围" | 实验影响到的服务/用户集合 |
| Burn-rate alert（燃尽率告警） | "预算闸门" | 当错误预算燃尽率 > 预期 2 倍时触发 |
| Game day（演练日） | "每月演习" | 计划性的跨团队混沌演练 |
| LitmusChaos | "CNCF 工作流" | 已毕业的 CNCF Kubernetes 混沌工具 |
| Chaos Mesh | "CNCF CRD" | CNCF 沙箱级的 Kubernetes 原生混沌工具 |
| Harness CE | "商业 AI 辅助" | 带 AI 建议的 Harness 混沌工具 |
| Malformed prompt（畸形提示词） | "分词器炸弹" | 让分词卡死的输入 |
| KV eviction storm（KV 驱逐风暴） | "抢占级联" | 大规模驱逐触发重新预填充 |

## 延伸阅读

- [DevSecOps School —— 混沌工程 2026 指南](https://devsecopsschool.com/blog/chaos-engineering/)
- [Ankush Sharma —— 面向 LLM 的可观测性（书籍）](https://www.amazon.com/Observability-Large-Language-Models-Engineering-ebook/dp/B0DJSR65TR)
- [LitmusChaos（CNCF）](https://litmuschaos.io/)
- [Chaos Mesh（CNCF）](https://chaos-mesh.org/)
- [Harness Chaos Engineering](https://www.harness.io/products/chaos-engineering)
- [AWS FIS](https://aws.amazon.com/fis/)
