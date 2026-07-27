---
name: inference-server
description: 提供一个推测解码推理服务器，支持 EAGLE-3 或 P-EAGLE 草稿、K8s 自动扩展以及完整的吞吐量/延迟/成本报告。
version: 1.0.0
phase: 19
lesson: 14
tags: [capstone, inference, vllm, sglang, eagle-3, p-eagle, speculative-decoding, quantization, hpa]
---

给定两个开放目标模型（Llama 3.3 70B 和 Qwen3-Coder-30B MoE 或 GPT-OSS-120B），提供一个生产级服务栈，包含推测解码、量化和 Kubernetes 自动扩展。发布测量的加速和尾部延迟数据。

构建计划：

1. 在 vLLM 0.7（或 SGLang 0.4）上部署目标模型，使用 FP8 Marlin 量化。
2. 从 Red Hat Speculators 加载对齐的 EAGLE-3 草稿（或通过 SpecForge 训练一个）。
3. 基线数据：在批处理大小 1/8/32 下，不启用推测时的 tokens/s 和 p50/p99 延迟。
4. 启用 EAGLE-3。重新运行相同基准测试。报告加速比、接受率、p99 尾部延迟差异。
5. 启用 P-EAGLE 并行推测；报告更深层树有帮助和有害的转折点。
6. 跨分布运行基准测试：ShareGPT、HumanEval、领域数据。发布接受率漂移。
7. 在第二个目标模型（MoE）上重复；识别草稿接受中的路由噪声敏感性。
8. 在 Kubernetes 上部署，使用跟踪 `queue_wait_ms` 的 HPA。演示负载翻倍时的水平扩展。
9. 在匹配的评估上，比较 $/1M tokens 与 Anthropic Claude Sonnet 4.7 和 OpenAI GPT-5.4。

评估量规：

| 权重 | 标准 | 衡量方法 |
|:-:|---|---|
| 25 | 与基线相比的测量加速 | 在匹配质量下，两个模型上均达到 2.5x+ 吞吐量 |
| 20 | 实际流量下的接受率 | 按分布的接受率报告 |
| 20 | P99 尾部延迟纪律 | 有无推测下批处理大小 1/8/32 的 p99 |
| 20 | 运维 | K8s 部署、基于队列等待的 HPA、平滑发布、先排空再升级 |
| 15 | 报告和方法论 | 清晰的指标推导、匹配的基线 |

硬性拒绝：

- 报告稳态吞吐量而不报告尾部延迟。
- 基于 CPU 而非队列等待的 HPA。在 GPU 饱和下会震荡。
- 忽略草稿-目标版本对齐。漂移的草稿成本高于无推测。
- 省略托管 API 提示缓存折扣的成本比较。

拒绝规则：

- 拒绝在没有发布排空的情况下服务。在请求进行中原地升级是不可接受的。
- 拒绝报告跨分布聚合的接受率。按分布报告是强制性的。
- 拒绝声称在 bs=32 时推测解码有优势而没有匹配的非推测数据。

输出：一个包含 vLLM / SGLang 配置、EAGLE-3 草稿下载脚本、K8s 部署清单、基于队列等待的 HPA 配置、ShareGPT / HumanEval / 领域数据的基准测试框架、$/1M tokens 比较表，以及一份说明推测解码引入的三种尾部延迟回归及每种修复措施（批处理门控、n-gram 回退、量化调整）的仓库。
