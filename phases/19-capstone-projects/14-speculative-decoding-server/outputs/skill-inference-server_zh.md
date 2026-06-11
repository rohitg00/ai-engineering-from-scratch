---
name: inference-server
description: 交付推测解码推理服务器，具备EAGLE-3或P-EAGLE草稿、K8s自动扩展和完整的吞吐量/延迟/成本报告。
version: 1.0.0
phase: 19
lesson: 14
tags: [capstone, inference, vllm, sglang, eagle-3, p-eagle, speculative-decoding, quantization, hpa]
---

给定两个开放目标模型（Llama 3.3 70B和Qwen3-Coder-30B MoE或GPT-OSS-120B），交付具备推测解码、量化和Kubernetes自动扩展的生产服务栈。发布测量的加速和尾部延迟数字。

构建计划：

1. 在vLLM 0.7（或SGLang 0.4）下用FP8 Marlin量化部署目标模型。
2. 从Red Hat Speculators加载对齐的EAGLE-3草稿（或通过SpecForge训练一个）。
3. 基线数字：无推测时batch 1/8/32的token/s和p50/p99延迟。
4. 启用EAGLE-3。重跑相同基准。报告加速、接受率、p99尾部延迟增量。
5. 启用P-EAGLE并行推测；报告更深树帮助与伤害的拐点。
6. 跨分布运行基准：ShareGPT、HumanEval、领域数据。发布接受率漂移。
7. 在第二个目标模型（MoE）上重复；识别草稿接受中的路由噪声敏感性。
8. 在Kubernetes上部署，HPA跟踪`queue_wait_ms`。展示负载三倍时横向扩展。
9. 在匹配评估上与Anthropic Claude Sonnet 4.7和OpenAI GPT-5.4比较$/1M token。

评估标准：

| 权重 | 标准 | 测量 |
|:-:|---|---|
| 25 | 与基线的测量加速 | 两个模型上匹配质量的2.5x+吞吐量 |
| 20 | 真实流量上的接受率 | 每分布接受率报告 |
| 20 | P99尾部延迟纪律 | batch 1/8/32有和没有推测时的p99 |
| 20 | 运维 | K8s部署、基于队列等待的HPA、平滑推出、先排空升级 |
| 15 | 撰写和方法论 | 指标的清晰推导、匹配基线 |

硬性拒绝：
- 没有尾部延迟的稳态吞吐量报告。
- 基于CPU而非队列等待的HPA。在GPU饱和下会抖动。
- 忽略草稿-目标版本对齐。漂移的草稿成本高于无推测。
- 省略托管API提示缓存折扣的成本比较。

拒绝规则：
- 拒绝在没有推出排空的情况下服务。在请求飞行中就地升级是取消资格的。
- 拒绝跨分布聚合报告接受率。每分布是强制性的。
- 拒绝在没有匹配非推测数字的情况下声称bs=32时推测解码获胜。

输出：包含vLLM / SGLang配置、EAGLE-3草稿下载脚本、K8s部署清单、基于队列等待的HPA配置、ShareGPT / HumanEval / 领域数据的基准harness、$/1M token比较表，以及一份命名推测解码引入的三个尾部延迟回归及修复每个的缓解措施（batch门控、ngram回退、量化调整）的撰写的仓库。
