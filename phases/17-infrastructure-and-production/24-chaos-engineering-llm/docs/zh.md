# LLM 生产环境的混沌工程

> 2026 年，LLM 的混沌工程已成为一门独立的学科。在生产环境运行实验前需具备：已定义的 SLI/SLO、trace+metric+log 可观测性、自动回滚、运维手册、值班制度。架构包含四个平面：控制（实验调度器）、目标（服务、基础设施、数据存储）、安全（护栏 + 中止 + 流量过滤）、可观测性（指标 + 链路 + 日志）、反馈（进入 SLO 调整）。护栏是强制性的：如果每日错误预算消耗 > 2 倍预期，燃尽率告警会暂停实验；抑制窗口 + trace-ID 关联用于消除告警噪音。节奏：每周小型金丝雀 + SLO 审查；每月游戏日 + 事后复盘；每季度跨团队弹性审计 + 依赖映射。LLM 专用实验：内存过载、网络故障、提供商中断、畸形 prompt、KV 缓存驱逐风暴。工具：Harness Chaos Engineering（LLM 驱动的推荐、爆炸半径缩小、MCP 工具集成）；LitmusChaos（CNCF）；Chaos Mesh（CNCF Kubernetes 原生）。

**类型：** 学习
**语言：** Python（标准库，简易混沌实验运行器）
**前置知识：** 第 17 阶段 · 23（AI 时代的 SRE）、第 17 阶段 · 13（可观测性）
**时间：** ~60 分钟

## 学习目标

- 说出混沌工程的五个前置条件（SLI/SLO、可观测性、回滚、运维手册、值班），并解释跳过任何一个都会破坏实践。
- 绘制四个平面（控制、目标、安全、可观测性）及反馈回路的 SLO 调整。
- 列举五项 LLM 专用实验（内存过载、网络故障、提供商中断、畸形 prompt、KV 驱逐风暴）。
- 根据技术栈选择工具 —— Harness、LitmusChaos、Chaos Mesh。

## 问题背景

传统技术栈的混沌测试已较为成熟。LLM 技术栈增加了新的故障模式。一个包含毒字符的 4K token prompt 会让分词器卡住 12 秒。上游提供商返回 429；你的网关重试；你的服务因重试放大的并发而 OOM。突发负载下的 KV 缓存驱逐风暴导致重新预填充级联，算力饱和。

这些都不会出现在单元测试中。混沌工程是在用户发现之前发现它们的方法。

## 核心概念

### 前置条件

不要在生产环境运行混沌实验，除非你具备：

1. **SLI/SLO** —— 已定义的服务水平指标和目标。
2. **可观测性** —— trace、metric、log，接入仪表盘。
3. **自动回滚** —— 第 17 阶段 · 20 的策略开关回滚。
4. **运维手册** —— 结构化的，第 17 阶段 · 23。
5. **值班** —— 有人响应。

缺少任何一项，混沌都会变成真实的事故。

### 四个平面 + 反馈

**控制平面** —— 实验调度器（Litmus 工作流、Chaos Mesh 调度、Harness UI）。

**目标平面** —— 服务、Pod、节点、负载均衡器、数据存储。

**安全平面** —— 紧急停止开关、抑制窗口、爆炸半径限制、错误预算关卡。

**可观测性平面** —— 常规指标 + trace-ID 关联，以区分混沌引发与自然故障。

**反馈回路** —— 发现反馈到 SLO 调整、运维手册更新、代码修复。

### 护栏是强制性的

- **燃尽率告警**：如果每日错误预算消耗超过预期的 2 倍，暂停实验。
- **抑制窗口**：实验期间在爆炸半径内静默非实验告警。
- **Trace-ID 关联**：所有实验引发的错误都携带标签，值班人员可以去重。

### 五项 LLM 专用实验

1. **内存过载** —— 通过高并发发送长上下文请求，强制触发 KV 缓存抢占风暴。观察：服务是优雅降级还是崩溃？

2. **网络故障** —— 切断推理网关与提供商之间的连通性。观察：故障转移是否在 SLA 内触发？（第 17 阶段 · 19）

3. **提供商中断模拟** —— OpenAI 100% 返回 429。观察：路由是否故障转移到 Anthropic？（第 17 阶段 · 16、19）

4. **畸形 prompt** —— 注入分词器卡顿的负载（如深层嵌套的 unicode、巨大的 UTF-8 码点）。观察：单个请求是否会锁住一个 worker？

5. **KV 驱逐风暴** —— 通过饱和 vLLM 块预算强制驱逐。观察：LMCache 能否恢复，还是服务会退化？

### 节奏

- **每周** —— 在 staging 环境进行小型金丝雀实验，可能 5% 生产环境。
- **每月** —— 针对特定场景的预定游戏日；跨团队参与；事后复盘。
- **每季度** —— 跨团队弹性审计；依赖映射更新。

### 工具

- **Harness Chaos Engineering** —— 商业产品；AI 驱动的实验推荐；爆炸半径缩小；MCP 工具集成。
- **LitmusChaos** —— CNCF 毕业项目；基于 Kubernetes 工作流。
- **Chaos Mesh** —— CNCF 沙箱项目；Kubernetes 原生 CRD 风格。
- **Gremlin** —— 商业产品；广泛支持。
- **AWS FIS** / **Azure Chaos Studio** —— 托管云服务。

### 从小开始

第一个实验：在稳定流量下 kill 一个 decode 副本的 Pod。观察重新路由和恢复。如果这看起来安全有效，再升级到网络混沌。

第一个 LLM 专用实验：注入一个提供商 429 持续 5 分钟。观察故障转移。大多数团队会发现他们的故障转移并未经过充分测试。

### 需要记住的数字

- 四个平面：控制、目标、安全、可观测性。
- 燃尽率暂停：预期每日预算消耗的 2 倍。
- 节奏：每周金丝雀、每月游戏日、每季度审计。
- 五项 LLM 实验：内存、网络、提供商、畸形 prompt、KV 风暴。

## 使用

`code/main.py` 模拟三项带有安全平面关卡的混沌实验。报告哪些实验会触发燃尽率中止。

## 交付

本课产出 `outputs/skill-chaos-plan.md`。给定技术栈和成熟度，选择前三个实验和工具。

## 练习

1. 运行 `code/main.py`。哪个实验触发了燃尽率关卡，为什么？
2. 为一个基于 vLLM 的 RAG 服务设计前五个混沌实验。包含成功标准。
3. 你的燃尽率告警暂停了一个实验。如何确定根因 —— 混沌还是自然故障？
4. 辩论混沌是否应该在生产环境还是仅 staging 运行。什么时候生产环境是正确答案？
5. 说出三种通用网络混沌无法复现的 LLM 专用故障模式。

## 关键术语

| 术语 | 业界说法 | 实际含义 |
|------|---------|---------|
| SLI / SLO | "service targets" | 指标 + 目标；必需的前置条件 |
| Blast radius | "scope" | 实验影响的服务 / 用户集合 |
| Burn-rate alert | "budget gate" | 错误预算燃尽率 > 2 倍预期时触发 |
| Game day | "monthly drill" | 预定的跨团队混沌演练 |
| LitmusChaos | "CNCF workflow" | CNCF 毕业项目 Kubernetes 混沌工具 |
| Chaos Mesh | "CNCF CRD" | CNCF 沙箱项目 Kubernetes 原生混沌 |
| Harness CE | "commercial AI-assisted" | Harness 混沌工程，带 AI 推荐 |
| Malformed prompt | "tokenizer bomb" | 导致分词器卡顿的输入 |
| KV eviction storm | "preemption cascade" | 大规模驱逐触发重新预填充 |

## 延伸阅读

- [DevSecOps School — Chaos Engineering 2026 Guide](https://devsecopsschool.com/blog/chaos-engineering/)
- [Ankush Sharma — Observability for LLMs (book)](https://www.amazon.com/Observability-Large-Language-Models-Engineering-ebook/dp/B0DJSR65TR)
- [LitmusChaos (CNCF)](https://litmuschaos.io/)
- [Chaos Mesh (CNCF)](https://chaos-mesh.org/)
- [Harness Chaos Engineering](https://www.harness.io/products/chaos-engineering)
- [AWS FIS](https://aws.amazon.com/fis/)
