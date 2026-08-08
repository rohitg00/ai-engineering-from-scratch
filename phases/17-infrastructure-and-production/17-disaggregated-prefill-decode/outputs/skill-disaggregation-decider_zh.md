---
name: disaggregation-decider
description: 决定是否为给定工作负载和集群采用分离式 prefill/decode（Dynamo 或 llm-d）。量化 prefill:decode 比率、KV 传输成本和预期节省。
version: 1.0.0
phase: 17
lesson: 17
tags: [disaggregated-serving, dynamo, llm-d, nixl, kv-transfer, prefill-decode]
---

给定工作负载配置文件（提示/输出长度分布、模型、并发）、集群拓扑（GPU、fabric、RDMA 可用性）和当前服务成本，生成分离决策。

生成：

1. 分离？是/否，带编号理由。基线：提示 > 512 且输出 > 200。Fabric：RDMA 可用有帮助；仅 TCP 将盈亏平衡推得更长。
2. 栈选择。NVIDIA Dynamo（vLLM/SGLang/TRT-LLM 之上的托管编排器）或 llm-d（Kubernetes 原生服务）。匹配运营上下文。
3. Prefill:decode 比率。使用 Dynamo Planner Profiler 读数，或从工作负载形态计算（prefill TFLOPS 与 decode bytes/sec）。示例：RAG 密集型 2 prefill : 1 decode；输出密集型 1:2。
4. KV 传输计划。命名传输（NIXL over InfiniBand / RDMA / TCP 回退）。计算提示 P99 的每次请求传输税。
5. 路由器集成。缓存感知路由器（Phase 17 · 11）必须在前面——没有前缀匹配的分离会失去缓存收益。
6. 预期节省。与共存基线计算；引用已发布案例（相同 SLA 下 30-40%）。

硬性拒绝：
- 分离短提示工作负载（<512 token）。拒绝——传输税占主导。
- 没有缓存感知路由器就部署。拒绝——盲路由否定 KV 局部性。
- 忽略拓扑（机架打包）。拒绝——跨机架跳点的 KV 传输成本高于同一机架上的 RDMA。

拒绝规则：
- 如果集群有 < 4 GPU，拒绝——池多样性不足以让分离获得回报。
- 如果没有 RDMA/InfiniBand 且没有计划，注意 TCP 将盈亏平衡提高到提示 >2K；重新评估。
- 如果团队无法操作具有每角色扩展的两个 GPU 池，拒绝 llm-d 并要求 Dynamo 作为托管替代方案。

输出：一页决策，包含分离 Y/N、栈选择、比率、传输、路由器、预期节省。以要验证的单一指标结束：KV 传输 P99 延迟；根据超过计划指定阈值进行门控。
