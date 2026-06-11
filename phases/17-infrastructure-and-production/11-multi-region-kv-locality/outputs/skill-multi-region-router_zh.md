---
name: multi-region-router
description: 设计多区域 LLM 路由计划，包含 KV 缓存局部性、驻留边界、DR 清单和季度故障转移演练。
version: 1.0.0
phase: 17
lesson: 11
tags: [multi-region, kv-cache, routing, dr, bedrock-cri, vllm-router, llm-d, gorgo]
---

给定范围内的区域、驻留边界、预期前缀缓存多样性和 TTFT SLA，生成多区域路由和 DR 计划。

生成：

1. 路由器选择。选择缓存感知路由器（vLLM Router、llm-d router）并描述 KV 事件通道。声明前缀哈希算法（例如，512-token 滚动）和决胜规则（最小队列深度）。
2. 路由策略。Regional-first 或全局（GORGO 风格）最小化 prefill + RTT？根据提示长度分布证明——长提示（>8K token）受益于跨区域路由；短提示不受益。
3. 驻留分区。在任何优化之前：哪些请求因法律原因（GDPR、HIPAA）绑定到哪些区域。即使 TTFT 改善，也禁止跨驻留路由。
4. 商业 CRI 层。建议是否启用 Bedrock Cross-Region Inference 或 GKE Multi-Cluster Gateway 作为可用性层。明确声明此层 NOT 是 TTFT 优化。
5. DR 清单。最少三个文件（HF repo + 引擎配置 + 部署清单）。验证 tokenizer、量化配置、RoPE、聊天模板、LoRA 适配器是否包含。声明存储（S3 跨区域复制、多区域 GCS）。
6. 故障转移演练。季度节奏。谁运行它，测量什么（RTO、RPO、缓存预热时间）。目标：与真实 2024 JPMorgan 演练匹配的 30 分钟 RTO。

硬性拒绝：
- 为路由优化忽略驻留。拒绝——GDPR 违规胜过 TTFT 收益。
- 声称 Bedrock CRI“解决”跨区域路由。拒绝——CRI 是可用性，不是 TTFT。
- 仅备份权重。拒绝——命名 32% DR 失败统计并要求三文件清单。

拒绝规则：
- 如果范围内只有一个区域，拒绝该计划——单区域有不同的故障模式（Phase 17 · 03 涵盖它）。
- 如果驻留和 TTFT SLA 不兼容（例如，EU 驻留强制在 8K 提示上每次请求冷前缀 prefill，且 P99 TTFT < 100 ms），拒绝承诺 SLA 并升级产品需求。

输出：一页计划，命名路由器、路由策略、驻留分区、CRI 层态势、DR 清单、季度演练负责人。以要警报的单一指标结束：跨区域前缀缓存命中率低于计划指定阈值。
