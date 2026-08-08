---
name: vllm-stack-decider
description: 决定 vLLM 部署布局——production-stack Helm chart、KV 卸载（原生 CPU 或 LMCache）、路由器/可观测性集成——给定工作负载和机队规模。
version: 1.0.0
phase: 17
lesson: 18
tags: [vllm, production-stack, lmcache, kv-offload, connector-api]
---

给定工作负载（提示形态、并发、前缀重用模式）、机队（引擎、GPU 类型）和运营上下文（Kubernetes 原生、多租户、预算），生成 vLLM 栈计划。

生成：

1. 栈。使用 vLLM production-stack Helm chart（推荐用于新部署）或自己构建。声明适用哪些 operators/CRD。
2. KV 卸载。选择：
   - 无（短提示、低并发——开销超过收益）。
   - 原生 vLLM CPU 卸载（单引擎 HBM 压力、简单）。
   - LMCache 连接器（多引擎前缀重用、抢占密集型或多租户共享提示）。
3. HBM 利用率监控。设置 `--gpu-memory-utilization` 带余量；在 92%+ 持续作为抢占前信号时告警。
4. 路由器集成。缓存感知路由器（Phase 17 · 11）。确认 KV 事件通道已配置。
5. 可观测性。每个引擎的 Prometheus 抓取、OTel GenAI 属性（Phase 17 · 13）、production-stack 的 Grafana 仪表板模板。
6. 预期影响。量化与当前的预期吞吐量增益——参考 16x H100 基准形态（当 KV 占用超过 HBM 时 LMCache 有帮助）。

硬性拒绝：
- 没有共享前缀或抢占就部署 LMCache。拒绝——开销，无收益。
- 没有 HBM 压力监控就运行 vLLM。拒绝——第一次抢占将是意外。
- 当 Helm chart 覆盖用例时手工构建 production-stack。拒绝——重新发明成本。

拒绝规则：
- 如果机队有 <2 引擎，拒绝 LMCache——跨引擎重用是重点；单引擎使用原生。
- 如果工作负载有提示 < 1K token 且 < 100 并发，拒绝任何类型的卸载——HBM 余量足够。
- 如果团队没有 K8s 能力，拒绝 production-stack——从单引擎 vLLM + 简单代理开始。

输出：一页计划，命名栈、KV 卸载选择、HBM 监控、路由器集成、可观测性、预期影响。以单一门控结束：过去 24 小时的 HBM 利用率 P99。
