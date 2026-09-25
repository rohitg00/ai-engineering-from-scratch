# Capstone 14 — 投机解码（Speculative-Decoding）推理服务器

> 投机解码——由廉价的草稿模型提出 token，目标模型一次前向验证——如今已是可用于生产的优化手段，而非研究技巧。vLLM 0.7 中的 EAGLE-3 在真实流量下可带来 2.5-3 倍的吞吐提升。P-EAGLE（AWS 2026）将并行投机进一步推进。SGLang 的 SpecForge 在大规模上训练草稿头。Red Hat 的 Speculators hub 为常见开源模型发布了已对齐的草稿模型。TensorRT-LLM 使投机解码在 NVIDIA 上成为一等公民。2026 年的生产推理栈是 vLLM 或 SGLang，搭配 EAGLE 系列草稿模型、FP8 或 INT4 量化，以及基于排队等待时间的 HPA。本 Capstone 的目标是以 2.5 倍以上的基线吞吐服务两个开源模型，并输出完整的尾延迟报告。

**Type:** Capstone
**Languages:** Python（服务端）、C++ / CUDA（内核检视）、YAML（配置）
**Prerequisites:** Phase 3（深度学习）、Phase 7（transformers）、Phase 10（从零构建 LLM）、Phase 17（基础设施）
**Phases exercised:** P3 · P7 · P10 · P17
**Time:** 30 小时

## 问题

投机解码在 2026 年已成为通用技术。EAGLE-3 草稿头基于目标模型的隐藏状态进行训练，可提前预测 N 个 token；目标模型通过单次前向完成验证。60-80% 的接受率可转化为 2-3 倍的端到端吞吐。vLLM 0.7 原生集成了这一能力。SGLang + SpecForge 提供了训练管线。Red Hat 的 Speculators 为 Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B 发布了已对齐的草稿模型。

难点在于服务运维，而非模型本身。接受率会随流量分布（ShareGPT vs 代码 vs 领域数据）而漂移。存在拒绝情况下的尾延迟比不使用投机时更差——你必须报告多个 batch 规模下的 p99，而不仅仅是稳态 tokens/sec。与 Anthropic / OpenAI API 相比的每 1M token 成本才是说服力所在。

## 概念

投机解码分为两层。**草稿**模型（EAGLE-3 head、ngram，或更小的目标对齐模型）每步提出 k 个候选 token。**目标**模型一次前向验证全部 k 个 token；任何被接受的前缀都会替代贪心路径。接受率取决于草稿与目标的对齐程度以及输入分布。

EAGLE-3 在大多数流量上优于 ngram 草稿。P-EAGLE 运行并行投机以构建更深的草稿树。代价在于：拒绝时的 P99 延迟更高，因为验证前向更大。服务配置必须按 batch 大小分桶报告延迟，以暴露这一问题。

部署使用 Kubernetes。vLLM 0.7 每个 GPU 或张量并行分片运行一个副本。HPA 基于排队等待时间而非 CPU 进行自动扩缩。FP8（Marlin）和 INT4（AWQ）量化将显存占用保持在 H100 / H200 的范围内。端到端报告包括吞吐、接受率、batch 1/8/32 下的 p50/p99，以及 $/1M token。

## 架构

```
request ingress
    |
    v
vLLM server (0.7) or SGLang (0.4)
    |
    +-- draft: EAGLE-3 heads | P-EAGLE parallel | ngram fallback
    +-- target: Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     quantized FP8-Marlin or INT4-AWQ
    |
    v
verify pass: batch k draft tokens through target
    |
    v (accept prefix; resample for rejected suffix)
    v
token stream back to client
    |
    v
Prometheus metrics: throughput, acceptance rate, queue wait, latency p50/p99
    |
    v
HPA on queue-wait metric
```

## 技术栈

- 服务端：vLLM 0.7 或 SGLang 0.4
- 投机方法：EAGLE-3 草稿头、P-EAGLE 并行投机、ngram 兜底
- 草稿训练：SpecForge（SGLang）或 Red Hat Speculators
- 目标模型：Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B
- 量化：FP8（Marlin）、INT4 AWQ
- 部署：Kubernetes + NVIDIA device plugin；基于排队等待指标的 HPA
- 评测：ShareGPT、MT-Bench-v2、GSM8K、HumanEval，用于跨领域接受率测量
- 参考：TensorRT-LLM 投机解码，作为厂商基线

```figure
cf-spec-decode
```

## 动手构建

1. **目标模型准备。** 选择 Llama 3.3 70B。通过 Marlin 量化为 FP8。部署到 vLLM 0.7 下，使用 1xH100（或 2x 张量并行）。

2. **草稿来源。** 从 Red Hat Speculators 拉取已对齐的 EAGLE-3 草稿头（或通过 SpecForge 训练一个）。加载到 vLLM 的投机解码配置中。

3. **基线数字。** 在启用投机之前：测量 batch 1/8/32 下的 tokens/s、p50/p99 延迟、GPU 利用率。发布这些数据。

4. **启用 EAGLE-3。** 修改配置；重跑相同的基准测试。报告加速比、接受率、p99 尾延迟变化。

5. **P-EAGLE。** 启用并行投机；对比更深的草稿树与串行 EAGLE-3。报告 P-EAGLE 从有益变为有害的拐点。

6. **领域流量。** 在同一服务器上运行 ShareGPT vs HumanEval vs 领域专属流量。测量每种分布下的接受率。识别草稿何时发生漂移。

7. **第二个目标模型。** 在 Qwen3-Coder-30B MoE 上运行相同管线。草稿更棘手（MoE 路由噪声）。报告结果。

8. **K8s HPA。** 部署到 K8s，HPA 追踪 `queue_wait_ms`。演示负载增加三倍时的扩容。

9. **成本对比。** 在相同评测集上计算与 Anthropic Claude Sonnet 4.7 和 OpenAI GPT-5.4 相比的 $/1M token。发布结果。

## 使用

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 active
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   first-token 42ms, full-response 980ms (620 tokens)
[cost]      $0.34 per 1M output tokens at sustained throughput
```

## 交付

`outputs/skill-inference-server.md` 描述了交付物。一个经过实测的、带有投机解码的服务栈、一份完整的基准测试报告，以及一个 K8s 部署。

| 权重 | 评审标准 | 衡量方式 |
|:-:|---|---|
| 25 | 相对基线的实测加速 | 两个模型在同等质量下达到 2.5 倍以上吞吐 |
| 20 | 真实流量下的接受率 | 按分布划分的接受率报告 |
| 20 | P99 尾延迟纪律 | batch 1/8/32 下启用与不启用投机的 p99 |
| 20 | 运维 | K8s 部署、基于排队等待的 HPA、发布平滑 |
| 15 | 报告与方法论 | 清晰解释改动了什么以及为什么 |
| **100** | | |

## 练习

1. 测量草稿模型比目标模型落后一个版本时的接受率下降（例如 Llama 3.3 -> 3.4 漂移）。构建一个监控告警。

2. 实现 ngram 兜底：当 EAGLE-3 接受率低于阈值时，切换到 ngram 草稿。报告可靠性提升。

3. 运行受控 MoE 实验：同一个 Qwen3-Coder-30B，注入路由噪声 vs 不注入。测量草稿接受率的敏感度。

4. 扩展到 H200（141 GB）。报告每个副本新增的模型容量余量，以及是否可以服务未量化的 Llama 3.3 70B。

5. 在相同 H100 硬件上对 TensorRT-LLM 投机解码进行基准测试。报告它在哪些方面胜过 vLLM。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 草稿模型 | "Speculator" | 为目标模型提出 N 个候选 token 以供验证的小模型 |
| EAGLE-3 | "2026 草稿架构" | 基于目标模型隐藏状态训练的草稿头；接受率约 75% |
| P-EAGLE | "并行投机" | 由草稿分支构成的树，在目标模型一次前向中完成验证 |
| 接受率 | "命中率" | 草拟 token 中无需重新采样即被接受的比例 |
| 量化 | "FP8 / INT4" | 使用更低精度权重，以便在 GPU 显存中容纳更大模型 |
| 排队等待 | "HPA 指标" | 请求在推理开始前于待处理队列中等待的时间 |
| Speculators hub | "已对齐的草稿" | Red Hat Neural Magic 的 hub，收录面向常见开源模型的 EAGLE 草稿 |

## 延伸阅读

- [vLLM EAGLE 与 P-EAGLE 文档](https://docs.vllm.ai) — 参考推理栈
- [P-EAGLE（AWS 2026）](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) — 并行投机解码论文 + 集成方案
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — 草稿头训练管线
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) — 已对齐草稿 hub
- [TensorRT-LLM 投机解码](https://nvidia.github.io/TensorRT-LLM/) — 厂商替代方案
- [Fireworks.ai 服务架构](https://fireworks.ai/blog) — 商业参考
- [EAGLE-3 论文（arXiv:2503.01840）](https://arxiv.org/abs/2503.01840) — 方法论文
- [vLLM 仓库](https://github.com/vllm-project/vllm) — 代码与基准测试