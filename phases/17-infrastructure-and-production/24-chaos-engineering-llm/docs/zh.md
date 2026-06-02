# LLM 生产环境的混沌工程（Chaos Engineering for LLM Production）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年，针对 LLM 的混沌工程已经成为一门独立学科。在生产环境跑实验之前，前置条件包括：定义好的 SLI/SLO、trace + metric + log 三件套可观测性、自动化回滚、runbook、on-call 值班。架构包含四个平面：控制平面（实验调度器）、目标平面（服务、基础设施、数据存储）、安全平面（守卫 + 中止 + 流量过滤）、可观测性平面（metrics + traces + logs），外加一个反馈回路（汇入 SLO 调整）。guardrail（护栏）是强制的：burn-rate 告警在每日错误预算燃烧速率超过预期 2 倍时暂停实验；抑制窗口 + trace-ID 关联用于去重告警噪声。节奏：每周小规模 canary + SLO 复盘；每月一次 game day + 事后复盘；每季度跨团队韧性审计 + 依赖关系梳理。LLM 特有实验：内存过载、网络故障、provider 宕机、畸形 prompt、KV cache 驱逐风暴。工具链：Harness Chaos Engineering（基于 LLM 的推荐、爆炸半径下调、MCP tool 集成）；LitmusChaos（CNCF 毕业项目）；Chaos Mesh（CNCF Kubernetes 原生）。

**Type:** Learn
**Languages:** Python (stdlib, toy chaos experiment runner)
**Prerequisites:** Phase 17 · 23 (SRE for AI), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 说出混沌工程的五个前置条件（SLI/SLO、可观测性、回滚、runbook、on-call），并解释为什么少一个都会让这套方法失效。
- 画出四个平面（control、target、safety、observability）以及汇入 SLO 的反馈回路。
- 列举五个 LLM 特有实验（内存过载、网络故障、provider 宕机、畸形 prompt、KV 驱逐风暴）。
- 在 Harness、LitmusChaos、Chaos Mesh 中，根据自家技术栈挑一个。

## 问题（The Problem）

传统技术栈的混沌测试已经很成熟。LLM 栈带来了新的故障模式。一个 4K-token 的 prompt 里夹了一个毒字符，能让 tokenizer 卡 12 秒。上游 provider 返回 429；你的网关重试；你的服务在重试放大的并发下 OOM。突发流量下的 KV cache 驱逐风暴会引发 re-prefill 级联，把算力打满。

这些故障在单元测试里都看不到。混沌工程，就是让你赶在用户之前发现它们。

## 概念（The Concept）

### 前置条件（Prerequisites）

不要在没有以下条件的情况下在生产跑混沌：

1. **SLI/SLO** —— 已定义的服务级别指标和目标。
2. **可观测性（Observability）** —— traces、metrics、logs 接入仪表盘。
3. **自动化回滚（Automated rollback）** —— 见 Phase 17 · 20 的策略 flag 回滚。
4. **Runbook** —— 结构化的，见 Phase 17 · 23。
5. **On-call** —— 有人响应。

少任何一项，混沌就会变成真实事故。

### 四个平面 + 反馈（Four planes + feedback）

**控制平面（Control plane）** —— 实验调度器（Litmus workflow、Chaos Mesh schedule、Harness UI）。

**目标平面（Target plane）** —— 服务、pod、节点、负载均衡、数据存储。

**安全平面（Safety plane）** —— kill switch（紧急开关）、抑制窗口、爆炸半径限制、错误预算门禁。

**可观测性平面（Observability plane）** —— 常规 metrics + trace-ID 关联，用于区分混沌实验引发的故障和自然故障。

**反馈回路（Feedback loop）** —— 实验发现回流到 SLO 调整、runbook 更新、代码修复。

### Guardrail 是强制的（Guardrails are mandatory）

- **Burn-rate 告警**：每日错误预算燃烧速率超过预期 2 倍时暂停实验。
- **抑制窗口（Suppression windows）**：实验期间，对爆炸半径内的非实验告警静默。
- **Trace-ID 关联**：所有实验诱发的错误都带一个 tag，让 on-call 能去重。

### 五个 LLM 特有实验（Five LLM-specific experiments）

1. **内存过载（Memory overload）** —— 通过高并发发送长上下文请求，强行触发 KV cache 抢占风暴。观察：服务能优雅卸流，还是直接崩？

2. **网络故障（Network failure）** —— 切断推理网关与 provider 之间的连接。观察：fallback 是否在 SLA 内启动？（Phase 17 · 19）

3. **Provider 宕机模拟（Provider outage simulation）** —— OpenAI 100% 返回 429。观察：路由是否切换到 Anthropic？（Phase 17 · 16、19）

4. **畸形 prompt（Malformed prompt）** —— 注入会让 tokenizer 卡顿的 payload（如深度嵌套的 unicode、超大 UTF-8 码点）。观察：单个请求会不会把一个 worker 卡死？

5. **KV 驱逐风暴（KV eviction storm）** —— 把 vLLM 的 block 预算打满，强制触发驱逐。观察：LMCache 能恢复，还是服务降级？

### 节奏（Cadence）

- **每周** —— staging 环境的小型 canary 实验，最多 5% 生产流量。
- **每月** —— 针对某个具体场景安排 game day；跨团队参加；事后复盘。
- **每季度** —— 跨团队韧性审计；更新依赖关系图。

### 工具链（Tooling）

- **Harness Chaos Engineering** —— 商业产品；AI 推断的实验推荐；爆炸半径下调；MCP tool 集成。
- **LitmusChaos** —— CNCF 毕业；基于 Kubernetes workflow。
- **Chaos Mesh** —— CNCF 沙箱；Kubernetes 原生 CRD 风格。
- **Gremlin** —— 商业产品；支持面广。
- **AWS FIS** / **Azure Chaos Studio** —— 云厂商托管服务。

### 从小处起步（Starting small）

第一个实验：在稳定流量下 pod-kill 掉一个 decode 副本。观察重新路由和恢复。如果跑通且看起来安全，再升级到网络混沌。

第一个 LLM 特有实验：注入一个 provider 429，持续 5 分钟。观察 fallback。大多数团队会发现自己的 fallback 根本没经过完整测试。

### 该记住的数字（Numbers you should remember）

- 四个平面：control、target、safety、observability。
- Burn-rate 暂停阈值：每日预算燃烧速率的 2 倍。
- 节奏：每周 canary、每月 game day、每季度审计。
- 五个 LLM 实验：内存、网络、provider、畸形 prompt、KV 风暴。

## 用起来（Use It）

`code/main.py` 模拟三个混沌实验，并带上安全平面的门禁。报告哪些实验会触发 burn-rate 中止。

## 上线部署（Ship It）

本课产出 `outputs/skill-chaos-plan.md`。给定技术栈与成熟度，挑出前三个实验和工具。

## 练习（Exercises）

1. 跑一下 `code/main.py`。哪个实验触发了 burn-rate 门禁？为什么？
2. 为一个基于 vLLM 的 RAG 服务设计前五个混沌实验。包含成功判据。
3. 你的 burn-rate 告警暂停了实验。怎么判定根因 —— 是混沌还是自然故障？
4. 论证一下：混沌应该在生产跑还是只在 staging 跑？什么场景下生产是正确答案？
5. 列出三个 LLM 特有的故障模式，是通用网络混沌复现不了的。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SLI / SLO | “服务目标” | 指标 + 目标；前置必备 |
| Blast radius（爆炸半径） | “范围” | 实验影响到的服务 / 用户集合 |
| Burn-rate alert | “预算门禁” | 错误预算燃烧速率 > 预期 2 倍时触发 |
| Game day | “每月演练” | 跨团队定期混沌演练 |
| LitmusChaos | “CNCF workflow” | CNCF 毕业的 Kubernetes 混沌工具 |
| Chaos Mesh | “CNCF CRD” | CNCF 沙箱的 Kubernetes 原生混沌 |
| Harness CE | “商业 AI 辅助” | 带 AI 推荐的 Harness 混沌产品 |
| Malformed prompt | “tokenizer 炸弹” | 让 tokenization 卡住的输入 |
| KV eviction storm | “抢占级联” | 大规模驱逐触发的 re-prefill |

## 延伸阅读（Further Reading）

- [DevSecOps School — Chaos Engineering 2026 Guide](https://devsecopsschool.com/blog/chaos-engineering/)
- [Ankush Sharma — Observability for LLMs (book)](https://www.amazon.com/Observability-Large-Language-Models-Engineering-ebook/dp/B0DJSR65TR)
- [LitmusChaos (CNCF)](https://litmuschaos.io/)
- [Chaos Mesh (CNCF)](https://chaos-mesh.org/)
- [Harness Chaos Engineering](https://www.harness.io/products/chaos-engineering)
- [AWS FIS](https://aws.amazon.com/fis/)
