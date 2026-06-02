# Capstone 14 — 投机解码推理服务器（Speculative-Decoding Inference Server）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> EAGLE-3 在 vLLM 0.7 中真实流量下能跑出 2.5-3 倍吞吐。P-EAGLE（AWS 2026）把并行投机推得更远。SGLang 的 SpecForge 把 draft head 训练做到了规模化。Red Hat 的 Speculators hub 发布了适配主流开源模型的对齐 draft。TensorRT-LLM 把投机解码做成了 NVIDIA 上的一等公民。2026 年的生产级 serving stack 就是 vLLM 或 SGLang + EAGLE 系列 draft + FP8 或 INT4 量化 + 基于 queue-wait 的 HPA。本 capstone 的目标是把两个开源模型 serve 到 2.5 倍以上 baseline 吞吐，并附完整的 tail-latency（尾延迟）报告。

**Type:** Capstone
**Languages:** Python (serving), C++ / CUDA (kernel inspection), YAML (configs)
**Prerequisites:** Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 17 (infrastructure)
**Phases exercised:** P3 · P7 · P10 · P17
**Time:** 30 hours

## 问题（Problem）

到 2026 年，投机解码（speculative decoding）已经成了通用件。EAGLE-3 的 draft head 在 target 模型的 hidden state 上训练，向前预测 N 个 token；target 模型只用一次 pass 完成校验。60-80% 的接受率（acceptance rate）翻译成端到端 2-3 倍的吞吐。vLLM 0.7 原生集成了这套机制。SGLang + SpecForge 给了你训练流水线。Red Hat 的 Speculators 还为 Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B 发布了对齐 draft。

工艺都在 serving 运维里，而不在模型本身。接受率会随流量分布漂移（ShareGPT vs 代码 vs 领域数据）。在拒绝（rejection）情况下的 tail latency 比不开投机还差——你必须报告多个 batch size 下的 p99，而不只是稳态的 tokens/sec。每 1M token 的成本对比 Anthropic / OpenAI API，是说服力杠杆。

## 概念（Concept）

投机解码分两层。一个 **draft** 模型（EAGLE-3 head、ngram 或更小的 target-aligned 模型）每步提议 k 个候选 token；**target** 模型一次 pass 校验全部 k 个；任何被接受的前缀替换 greedy 路径。接受率取决于 draft 与 target 的对齐度，以及输入分布。

EAGLE-3 在大多数流量上胜过 ngram draft。P-EAGLE 用并行投机扩展更深的 draft 树。代价是：拒绝时的 P99 latency 更高，因为 verify pass 更大。serving 配置必须按 batch size 分桶报告 latency，才能把这个问题暴露出来。

部署用 Kubernetes。vLLM 0.7 每个 GPU 跑一个 replica，或者跑一个 tensor-parallel 分片。HPA 基于 queue-wait（而不是 CPU）做自动扩缩。FP8（Marlin）和 INT4（AWQ）量化把 GPU 显存压在 H100 / H200 的预算内。最终端到端报告：吞吐、接受率、batch 1/8/32 下的 p50/p99，以及 $/1M token。

## 架构（Architecture）

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

## 技术栈（Stack）

- Serving: vLLM 0.7 或 SGLang 0.4
- 投机方法：EAGLE-3 draft head、P-EAGLE 并行投机、ngram fallback
- Draft 训练：SpecForge（SGLang）或 Red Hat Speculators
- Target 模型：Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B
- 量化：FP8（Marlin）、INT4 AWQ
- 部署：Kubernetes + NVIDIA device plugin；HPA 基于 queue-wait 指标
- 评估：ShareGPT、MT-Bench-v2、GSM8K、HumanEval，用于跨领域分布的接受率测量
- 参照：TensorRT-LLM 投机解码作为厂商基线

## 动手实现（Build It）

1. **Target 模型准备。** 选 Llama 3.3 70B。用 Marlin 量化到 FP8。在 1xH100（或 2x tensor-parallel）上用 vLLM 0.7 部署。

2. **Draft 来源。** 从 Red Hat Speculators 拉一个对齐的 EAGLE-3 draft head（或者用 SpecForge 自己训）。加载到 vLLM 的 speculative-decoding 配置里。

3. **基线（baseline）数据。** 投机之前：batch 1/8/32 的 tokens/s、p50/p99 latency、GPU 利用率。发布出来。

4. **启用 EAGLE-3。** 翻配置；同一套 benchmark 重跑。报告加速比、接受率、p99 tail-latency 增量。

5. **P-EAGLE。** 启用并行投机；测量更深 draft 树相对串行 EAGLE-3 的效果。报告 P-EAGLE 何时帮上忙、何时反而拖后腿的拐点。

6. **领域流量。** 同一服务上分别跑 ShareGPT、HumanEval 和领域专用流量。按分布测量接受率。识别 draft 何时漂移。

7. **第二个 target 模型。** 同一流水线在 Qwen3-Coder-30B MoE 上跑。draft 更棘手（MoE 路由噪声）。报告结果。

8. **K8s HPA。** 在 K8s 下部署，HPA 跟踪 `queue_wait_ms`。演示负载翻三倍时的 scale-out。

9. **成本对比。** 在同一份 eval 上，计算每 1M token 成本相对 Anthropic Claude Sonnet 4.7 和 OpenAI GPT-5.4 的差距。发布。

## 用起来（Use It）

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 active
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   first-token 42ms, full-response 980ms (620 tokens)
[cost]      $0.34 per 1M output tokens at sustained throughput
```

## 上线部署（Ship It）

`outputs/skill-inference-server.md` 描述了交付物。一个被测量过的、带投机解码的 serving stack，一份完整 benchmark 报告，加 K8s 部署。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Measured speedup vs baseline | 两个模型在质量对齐前提下吞吐 2.5 倍以上 |
| 20 | Acceptance rate on realistic traffic | 按分布给出接受率报告 |
| 20 | P99 tail-latency discipline | batch 1/8/32 在开 / 不开投机两种情况下的 p99 |
| 20 | Ops | K8s 部署、HPA 基于 queue-wait、rollout 平滑 |
| 15 | Write-up and methodology | 清楚解释改了什么、为什么改 |
| **100** | | |

## 练习（Exercises）

1. 测量当 draft 比 target 落后一个版本时（例如 Llama 3.3 -> 3.4 漂移）的接受率退化，搭一个监控告警。

2. 实现 ngram-fallback：当 EAGLE-3 接受率掉到阈值以下时切到 ngram draft。报告可靠性提升。

3. 跑一组受控的 MoE 实验：同样的 Qwen3-Coder-30B，对比注入路由噪声 vs 不注入。测量 draft 接受率的敏感度。

4. 扩展到 H200（141 GB）。报告每 replica 的模型尺寸 headroom（余量）增益，以及能否 serve 未量化的 Llama 3.3 70B。

5. 在同一套 H100 硬件上 benchmark TensorRT-LLM 投机解码。报告它在哪些场景胜过 vLLM。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Draft model | "Speculator" | 小模型，提议 N 个 token 给 target 校验 |
| EAGLE-3 | "2026 draft architecture" | 在 target hidden state 上训练的 draft head；约 75% 接受率 |
| P-EAGLE | "Parallel speculation" | draft 分支组成的树，在 target 一次 pass 中校验 |
| Acceptance rate | "Hit rate" | 提议的 token 中无需重采样、被接受的比例 |
| Quantization | "FP8 / INT4" | 用更低精度权重，把更大的模型塞进 GPU 显存 |
| Queue wait | "HPA metric" | 请求在待处理队列里、推理开始前等待的时间 |
| Speculators hub | "Aligned drafts" | Red Hat Neural Magic 维护的、为常见开源模型对齐的 EAGLE draft hub |

## 延伸阅读（Further Reading）

- [vLLM EAGLE and P-EAGLE documentation](https://docs.vllm.ai) — 参照实现的 serving stack
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) — 并行投机解码论文 + 集成
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — draft head 训练流水线
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) — 对齐 draft hub
- [TensorRT-LLM speculative decoding](https://nvidia.github.io/TensorRT-LLM/) — 厂商替代方案
- [Fireworks.ai serving architecture](https://fireworks.ai/blog) — 商用参考
- [EAGLE-3 paper (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) — 方法论文
- [vLLM repository](https://github.com/vllm-project/vllm) — 代码与 benchmark
