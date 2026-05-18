# LLM 的 Shadow Traffic、Canary 发布与渐进式部署

> LLM 的上线部署结合了软件发布中最困难的部分：没有单元测试、故障模式分散、信号延迟。标准流程是 (1) shadow 模式 —— 将生产请求复制给候选模型，记录日志并与生产版本对比，对用户零影响；能发现明显的分布性问题，但不能保证质量；(2) canary 发布 —— 逐步切流 10% → 25% → 50% → 75% → 100%，每步设置门槛；跟踪延迟分位数、单次请求成本、错误/拒答率、输出长度分布、用户反馈率；(3) 在稳定性确认后，对明显不同的替代方案进行 A/B 测试。非确定性是不可消除的 —— 由于 GPU 浮点运算的非结合性以及批次大小差异，相同输入在不同运行间可能出现高达 15% 的准确率波动。成本是变量而非常量 —— 一个提升 20% 的模型，单次调用成本可能高出 3 倍。回滚速度是决定性的：如果回滚需要重新部署，那就太慢了。策略放在配置/开关中；模型放在带固定摘要的注册表中；回滚 = 切换策略 + 恢复阈值 + 秒级固定旧模型。

**类型：** 学习
**语言：** Python（标准库，简易 canary 进度模拟器）
**前置知识：** 第 17 阶段 · 13（可观测性）、第 17 阶段 · 21（A/B 测试）
**时间：** ~60 分钟

## 学习目标

- 区分 shadow 模式（零影响对比）、canary（真实流量渐进式）与 A/B（稳定性确认后对比）。
- 列举五项 LLM 特有的 canary 指标（延迟、单次请求成本、错误/拒答、输出长度分布、用户反馈）。
- 解释为何 LLM 的非确定性（高达 15%）改变了发布中"稳定"的含义。
- 设计一条秒级回滚路径（策略切换），而非小时级（重新部署）。

## 问题背景

你发布了一个新模型。离线评估显示准确率提升 3%。你在生产环境直接全量上线。24 小时内，成本上涨 40%，用户点踩率上升 8%，三个客户工单报告"答案很奇怪"。你回滚。重新部署耗时 3 小时。你的周末毁了。

每一步本可避免。Shadow 模式本可在任何用户受影响前发现 40% 的成本飙升。Canary 本可在 10% 流量时因点踩率上升而停止。策略开关回滚本可在 30 秒内完成。这套流程填补了"离线评估看起来不错"与"真实用户满意"之间的鸿沟。

## 核心概念

### Shadow 模式

候选模型接收与生产相同的请求；输出被记录，但不返回给用户。对用户零影响。记录：

- 输出内容（与生产版本做 diff）。
- Token 数量（成本差异）。
- 延迟。
- 拒答与错误。

能发现：成本爆炸、长度退化、明显的拒答变化、硬性错误。不能发现：用户能感知到的质量差异。Shadow 是冒烟测试，不是质量测试。

### Canary 发布

渐进式流量切换并设门槛。典型进度：1% → 10% → 25% → 50% → 75% → 100%。每步检查 5 项指标：

1. **延迟分位数** —— P50、P95、P99。越界：canary P99 > 1.5x 基线。
2. **单次请求成本** —— 混合美元。越界：>20% 高于基线。
3. **错误 / 拒答率** —— 5xx 加上显式拒答。越界：2x 基线。
4. **输出长度分布** —— 均值 + P99。越界：分布偏移。
5. **用户反馈率** —— 点踩 / 工单提交。越界：1.5x 基线。

### 非确定性就是新的方差

相同输入产生不同输出。原因：

- GPU 浮点非结合性（浮点归约顺序随批次变化）。
- 批次大小差异（相同 prompt 在 128 批次 vs 16 批次中）。
- 采样（temperature > 0）。

实测：相同评估集运行间准确率波动可达 15%。发布中的"稳定"意味着指标在预期方差范围内，而非与基线完全一致。将门槛设在噪声 floor 之上。

### 成本是变量

一个提升 20% 的模型，单次调用成本可能高出 3 倍。单次请求成本是五个门槛之一。发布一个"更好"但破坏单位经济模型的模型，属于回滚场景。

### 回滚是武器

- 策略开关（功能开关系统）：在配置中切换百分比；秒级完成。
- 模型固定（注册表摘要）：固定模型不会自动升级。
- 回滚 = 恢复开关 + 将固定摘要设为上一版本。秒级，而非小时级。

如果你的栈回滚需要重新部署，那么在发布前先解决这个问题。

### 工具

**Argo Rollouts** / **Flagger** —— Kubernetes 渐进式交付控制器。与 Istio/Linkerd 加权路由集成。

**Istio 加权路由** —— 服务网格级流量拆分。

**KServe / Seldon Core** —— 内置 canary 的模型 serving。

**功能开关** —— LaunchDarkly、Flagsmith、Unleash。策略级切换，无需重新部署。

### 指标节奏

Canary 门槛每 5–15 分钟检查一次，取决于流量大小。1% 流量在 10 req/min 下，每窗口产生 50–150 个数据点 —— 对延迟足够，但对用户反馈较嘈杂。10% 流量约为 10 倍。每步应暂停足够长时间以积累足够样本。

### A/B 步骤是可选的

如果新模型明显不同（行为不同、成本曲线不同、语气不同），在 canary 通过后以 50% 流量做 A/B 测试。如果只是改进版本，canary 门槛通过后直接上到 100%。

### 需要记住的数字

- Canary 进度：1% → 10% → 25% → 50% → 75% → 100%。
- 非确定性上限：相同输入运行间方差可达 15%。
- 五项 canary 指标：延迟、成本、错误/拒答、输出长度、用户反馈。
- 成本门槛：>20% 高于基线即为越界。
- 回滚：秒级，而非小时级。

## 使用

`code/main.py` 模拟一次带有注入退化的 canary 发布。报告发布在哪个阶段停止，以及哪个门槛被触发。

## 交付

本课产出 `outputs/skill-rollout-runbook.md`。给定候选模型、基线与风险容忍度，设计 shadow→canary→100% 计划。

## 练习

1. 运行 `code/main.py`。注入 25% 成本退化。Canary 在哪个阶段停止？
2. 你的新模型离线准确率提升 3%，但单次请求成本 +18%。是否发布？取决于策略 —— 写出两条路径。
3. 设计一条端到端 60 秒内的回滚方案。列出所需基础设施。
4. 非确定性在评估中显示 ±7%。设置 canary 门槛以避免误报。使用什么倍数？
5. Shadow 模式在 canary 前发现 40% 成本飙升。写出在 shadow 中触发的告警规则。

## 关键术语

| 术语 | 业界说法 | 实际含义 |
|------|---------|---------|
| Shadow mode | "duplicate to new" | 零影响发送给候选模型以记录日志 |
| Canary | "progressive traffic" | 渐进式用户暴露发布，带门槛检查 |
| Gates | "rollout checks" | 阻止发布的指标阈值 |
| Non-determinism | "LLM variance" | 不可消除的运行间差异 |
| Policy flag | "flag flip rollback" | 配置级回滚，秒级而非小时级 |
| Model pin | "registry digest" | 模型版本的不可变引用 |
| Argo Rollouts | "K8s progressive" | Kubernetes 原生 canary/回滚控制器 |
| KServe | "inference K8s" | 带 canary 原语的模型 serving |
| Istio weighted | "mesh split" | 服务网格流量拆分 |

## 延伸阅读

- [TianPan — Releasing AI Features Without Breaking Production](https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing)
- [MarkTechPost — Safely Deploying ML Models](https://www.marktechpost.com/2026/03/21/safely-deploying-ml-models-to-production-four-controlled-strategies-a-b-canary-interleaved-shadow-testing/)
- [APXML — Advanced LLM Deployment Patterns](https://apxml.com/courses/mlops-for-large-models-llmops/chapter-4-llm-deployment-serving-optimization/advanced-llm-deployment-patterns)
- [Argo Rollouts docs](https://argo-rollouts.readthedocs.io/)
- [Flagger docs](https://docs.flagger.app/)
