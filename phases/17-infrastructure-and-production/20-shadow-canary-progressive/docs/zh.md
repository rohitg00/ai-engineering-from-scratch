# LLM 的影子流量、金丝雀发布与渐进式部署（Shadow Traffic, Canary Rollout, and Progressive Deployment for LLMs）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> LLM 上线把软件部署里最难的几块凑齐了：没有单元测试、失败模式弥散、信号滞后。标准顺序是：(1) shadow 模式（影子模式）——把生产请求复制一份打到候选模型，记录日志、对比输出，对用户零影响；能抓到明显的分布问题，但不是质量保证；(2) canary rollout（金丝雀发布）——按 10% → 25% → 50% → 75% → 100% 渐进切流，每一步都设关卡；跟踪 latency（延迟）分位数、单次请求成本、错误 / 拒答率、输出长度分布、用户反馈率；(3) 等稳定性确认后再做 A/B 测试，用于差异显著的备选方案对比。非确定性是抹不掉的——同一输入跨多次运行最多可能出现 15% 的准确率波动，这是 GPU 浮点非结合性叠加 batch 大小波动的结果。成本是变量，不是常数——一个准确率高 20% 的模型每次调用可能贵 3 倍。回滚速度决定一切：如果回滚需要重新部署，那就太慢了。Policy（策略）放在 config / flag 里；模型放在 registry（注册表）里、按 digest（摘要）pin（钉死）；回滚 = 翻 policy + 把阈值改回 + 几秒内 pin 回旧模型。

**Type:** Learn
**Languages:** Python（标准库，玩具级 canary 渐进模拟器）
**Prerequisites:** Phase 17 · 13（Observability，可观测性）、Phase 17 · 21（A/B Testing）
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 区分 shadow 模式（零影响对比）、canary（线上流量渐进切换）、A/B（稳定性确认后的对比）。
- 列举 LLM 专属的五项 canary 指标（latency、单次请求成本、错误 / 拒答、输出长度分布、用户反馈）。
- 解释 LLM 非确定性（最高 15%）如何改变发布过程中「稳定」的含义。
- 设计一条以秒计（policy 翻一下）而不是以小时计（重新部署）的回滚路径。

## 问题（The Problem）

你上线一个新模型。离线 evaluation（评估）显示准确率涨 3%。你在生产环境把开关打开。24 小时内：成本飙 40%、用户点踩涨 8%、三张客户工单反馈「答得很奇怪」。你回滚。重新部署用了 3 小时。周末没了。

这每一段都是可避免的。Shadow 模式本可以在任何用户看到之前就抓到 40% 的成本飙升。Canary 本可以在点踩抬头时停在 10%。Policy flag（策略开关）回滚本可以 30 秒搞定。这套纪律就是用来填「离线评估看起来不错」和「真实用户开心」之间那道沟的。

## 概念（The Concept）

### Shadow 模式（Shadow mode）

候选模型收到与生产同样的请求；输出只记录日志，不返回给用户。对用户零影响。记录：

- 输出内容（与生产对 diff）。
- token 数（成本差值）。
- latency。
- 拒答和错误。

能抓到：成本爆炸、长度回退、明显的拒答变化、硬错误。**抓不到**：用户能感知到的质量差。Shadow 是冒烟测试，不是质量测试。

### Canary 发布（Canary rollout）

带关卡的渐进切流。典型节奏：1% → 10% → 25% → 50% → 75% → 100%。每一步都对 5 项指标设关卡：

1. **Latency 分位数** —— P50、P95、P99。触发：canary 的 P99 > 1.5× 基线。
2. **单次请求成本** —— 折算成 $。触发：高于基线 20% 以上。
3. **错误 / 拒答率** —— 5xx 加上显式拒答。触发：2× 基线。
4. **输出长度分布** —— 均值 + P99。触发：分布发生漂移。
5. **用户反馈率** —— 点踩 / 工单数。触发：1.5× 基线。

### 非确定性是新的方差（Non-determinism is the new variance）

同样的输入产出不同的输出。原因：

- GPU 浮点非结合性（浮点 reduction 顺序随 batch 变化）。
- batch 大小波动（同一 prompt 在 128 的 batch 里 vs 在 16 的 batch 里）。
- 采样（temperature > 0）。

实测：在同一 eval 集上，跨多次运行最多 15% 的准确率波动。发布过程中的「稳定」意味着指标处在预期方差范围内，而不是与基线一模一样。把关卡设在噪声地板之上。

### 成本是变量（Cost is a variable）

一个准确率高 20% 的模型，单次调用可能贵 3 倍。单次请求成本是五道关卡之一。上线一个「更好」却把单位经济学搞崩的模型，属于回滚案例。

### 回滚是杀手锏（Rollback is the weapon）

- Policy flag（feature flag 系统）：在 config 里改百分比；以秒计。
- 模型 pin（registry digest）：被 pin 的模型不会自动升级。
- 回滚 = 翻 flag + 把 pin 的 digest 设回旧版本。以秒计，不是以小时计。

如果你的技术栈必须重新部署才能回滚，先把这一点修了再开始切流。

### 工具（Tooling）

**Argo Rollouts** / **Flagger** —— Kubernetes 的渐进式发布控制器。与 Istio / Linkerd 的加权路由集成。

**Istio 加权路由** —— service-mesh 层面的流量切分。

**KServe / Seldon Core** —— 自带 canary 原语的模型服务框架。

**Feature flags** —— LaunchDarkly、Flagsmith、Unleash。Policy 层翻开关，不重新部署。

### 指标节奏（Metrics cadence）

Canary 关卡每 5-15 分钟检查一次，具体取决于流量量级。1% 流量、10 req/min 的话，每个窗口给你 50-150 个数据点——对 latency 够用，但对用户反馈太吵。10% 流量数据点是其约 10 倍。每一步切流应该停留得足够久，攒够样本。

### A/B 这一步可选（The A/B step is optional）

如果新模型差异显著（行为不同、成本曲线不同、口吻不同），canary 通过后在 50% 这一步做 A/B。如果只是个改进版，canary 关卡都过了就直接拉到 100%。

### 你应该记住的数字（Numbers you should remember）

- Canary 渐进节奏：1% → 10% → 25% → 50% → 75% → 100%。
- 非确定性上限：相同输入跨多次运行最高 15% 方差。
- 五项 canary 指标：latency、成本、错误 / 拒答、输出长度、用户反馈。
- 成本关卡：高于基线 20% 以上即触发。
- 回滚：以秒计，不是以小时计。

## 用起来（Use It）

`code/main.py` 模拟一次注入了回归（regression）的 canary 发布。报告 rollout 在哪个阶段停下来、是哪道关卡触发的。

## 上线部署（Ship It）

本课产出 `outputs/skill-rollout-runbook.md`。给定候选模型、基线、风险容忍度，设计一份 shadow → canary → 100% 的方案。

## 练习（Exercises）

1. 跑 `code/main.py`。注入 25% 的成本回归。canary 在哪个阶段停下？
2. 你的新模型离线准确率涨 3%，但单次请求成本 +18%。要上吗？取决于 policy——把两条路径都写出来。
3. 设计一条端到端不超过 60 秒的回滚路径。列出所需的基础设施。
4. 你的 eval 上非确定性是 ±7%。把 canary 关卡设到不会误报。你用什么倍数？
5. Shadow 模式在 canary 之前就抓到了 40% 的成本飙升。写出会在 shadow 阶段触发的告警规则。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际是什么 |
|------|----------------|------------|
| Shadow 模式 | "复制一份给新模型" | 对用户零影响地把请求送给候选模型用于打日志 |
| Canary | "渐进切流" | 带关卡的、向用户暴露的渐进发布 |
| Gates | "发布检查项" | 阻断渐进推进的指标阈值 |
| 非确定性 | "LLM 方差" | 抹不掉的跨运行差异 |
| Policy flag | "翻 flag 回滚" | config 层级的回滚，秒级而非小时级 |
| Model pin | "registry digest" | 对某一模型版本的不可变引用 |
| Argo Rollouts | "K8s 渐进式" | Kubernetes 原生的 canary / 回滚控制器 |
| KServe | "K8s 推理" | 自带 canary 原语的模型服务框架 |
| Istio weighted | "mesh 切流" | service-mesh 层的流量切分器 |

## 延伸阅读（Further Reading）

- [TianPan — Releasing AI Features Without Breaking Production](https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing)
- [MarkTechPost — Safely Deploying ML Models](https://www.marktechpost.com/2026/03/21/safely-deploying-ml-models-to-production-four-controlled-strategies-a-b-canary-interleaved-shadow-testing/)
- [APXML — Advanced LLM Deployment Patterns](https://apxml.com/courses/mlops-for-large-models-llmops/chapter-4-llm-deployment-serving-optimization/advanced-llm-deployment-patterns)
- [Argo Rollouts docs](https://argo-rollouts.readthedocs.io/)
- [Flagger docs](https://docs.flagger.app/)
