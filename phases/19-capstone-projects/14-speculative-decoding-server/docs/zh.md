# 综合项目 14 — 推测解码推理服务器

> EAGLE-3 在 vLLM 0.7 中在实际流量下实现了 2.5-3 倍的吞吐量。P-EAGLE（AWS 2026）进一步推进了并行推测。SGLang 的 SpecForge 大规模训练了草稿头。Red Hat 的 Speculators 中心发布了常见开放模型的对齐草稿。TensorRT-LLM 在 NVIDIA 上使推测解码成为一等公民。2026 年的生产服务部署技术栈是带有 EAGLE 系列草稿的 vLLM 或 SGLang、FP8 或 INT4 量化，以及基于队列等待的 HPA。本综合项目是以完整的尾部延迟报告，以 2.5 倍以上的基线吞吐量服务两个开放模型。

**类型：** 综合项目
**语言：** Python（服务部署）、C++ / CUDA（内核检查）、YAML（配置）
**前置条件：** 第 3 阶段（深度学习）、第 7 阶段（Transformer）、第 10 阶段（从零构建 LLM）、第 17 阶段（基础设施）
**涉及阶段：** P3 · P7 · P10 · P17
**时间：** 30 小时

## 问题描述

推测解码在 2026 年成为了一种商品。EAGLE-3 草稿头在目标模型的隐藏状态上训练，并提前预测 N 个 token；目标模型一次性验证。60-80% 的接受率转化为 2-3 倍的端到端吞吐量。vLLM 0.7 原生集成了这一点。SGLang + SpecForge 为你提供了训练管道。Red Hat 的 Speculators 发布了 Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B 的对齐草稿。

工艺在于服务部署运维，而非模型。接受率随流量分布（ShareGPT vs 代码 vs 领域数据）而漂移。拒绝时的尾部延迟比无推测更差——你必须报告多个批次大小下的 p99，而不仅仅是稳态 tokens/秒。与 Anthropic / OpenAI API 相比的每 1M token 成本是可信度杠杆。

## 核心概念

推测解码有两层。**草稿** 模型（EAGLE-3 头、n-gram 或较小的目标对齐模型）每步提出 k 个候选 token。**目标** 模型一次性验证所有 k 个；任何前缀接受都会替换贪心路径。接受率取决于草稿-目标对齐和输入分布。

EAGLE-3 在大多数流量上击败 n-gram 草稿。P-EAGLE 运行并行推测以获得更深的草稿树。权衡是：拒绝时的 P99 延迟更高，因为验证传递更大。服务部署配置必须报告按批次大小分桶的延迟，以体现这一点。

部署是 Kubernetes。vLLM 0.7 每个 GPU 运行一个副本或张量并行分片。HPA 基于队列等待自动扩展，而非 CPU。FP8（Marlin）和 INT4（AWQ）量化使 GPU 内存保持在 H100 / H200 封装内。端到端报告是吞吐量、接受率、批次 1/8/32 下的 p50/p99，以及 $/1M tokens。

## 架构

```
请求入口
    |
    v
vLLM 服务器（0.7）或 SGLang（0.4）
    |
    +-- 草稿：EAGLE-3 头 | P-EAGLE 并行 | n-gram 后备
    +-- 目标：Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     量化 FP8-Marlin 或 INT4-AWQ
    |
    v
验证传递：批量 k 个草稿 token 通过目标
    |
    v（接受前缀；为被拒绝的后缀重新采样）
    v
token 流返回客户端
    |
    v
Prometheus 指标：吞吐量、接受率、队列等待、延迟 p50/p99
    |
    v
基于队列等待指标的 HPA
```

## 技术栈

- 服务部署：vLLM 0.7 或 SGLang 0.4
- 推测方法：EAGLE-3 草稿头、P-EAGLE 并行推测、n-gram 后备
- 草稿训练：SpecForge（SGLang）或 Red Hat Speculators
- 目标模型：Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B
- 量化：FP8（Marlin）、INT4 AWQ
- 部署：Kubernetes + NVIDIA 设备插件；基于队列等待指标的 HPA
- 评估：ShareGPT、MT-Bench-v2、GSM8K、HumanEval，用于领域传播接受度测量
- 参考：TensorRT-LLM 推测解码，用于供应商基线

## 构建步骤

1. **目标模型准备。** 选择 Llama 3.3 70B。通过 Marlin 量化为 FP8。在 1xH100（或 2x 张量并行）上用 vLLM 0.7 部署。

2. **草稿来源。** 从 Red Hat Speculators 拉取对齐的 EAGLE-3 草稿头（或通过 SpecForge 训练一个）。加载到 vLLM 的推测解码配置中。

3. **基线数字。** 推测前：批次 1/8/32 下的 tokens/秒、p50/p99 延迟、GPU 利用率。发布。

4. **启用 EAGLE-3。** 翻转配置；重新运行相同的基准测试。报告加速、接受率、p99 尾部延迟增量。

5. **P-EAGLE。** 启用并行推测；测量更深的草稿树 vs 串行 EAGLE-3。报告 P-EAGLE 有帮助 vs 有害的拐点。

6. **领域流量。** 通过同一服务器运行 ShareGPT vs HumanEval vs 特定领域流量。测量每个分布的接受率。识别草稿何时漂移。

7. **第二目标模型。** 在 Qwen3-Coder-30B MoE 上运行相同的管道。草稿更棘手（MoE 路由噪声）。报告。

8. **K8s HPA。** 在基于 `queue_wait_ms` 跟踪的 HPA 下部署 K8s。演示负载增加两倍时的扩展。

9. **成本比较。** 计算在相同评估下与 Anthropic Claude Sonnet 4.7 和 OpenAI GPT-5.4 相比的 $/1M tokens。发布。

## 使用示例

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7，Llama 3.3 70B FP8，EAGLE-3 激活
[decode]    bs=8，accepted_tokens_per_step=3.2，acceptance_rate=0.76
[latency]   首 token 42ms，完整响应 980ms（620 个 token）
[cost]      持续吞吐量下每 1M 输出 token $0.34
```

## 交付成果

`outputs/skill-inference-server.md` 描述了可交付成果。一个带有推测解码的已测量服务部署技术栈、完整的基准测试报告，以及 K8s 部署。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 与基线的已测量加速 | 两个模型上匹配质量下的 2.5 倍+ 吞吐量 |
| 20 | 真实流量上的接受率 | 每分布接受率报告 |
| 20 | P99 尾部延迟纪律 | 有和没有推测情况下批次 1/8/32 下的 p99 |
| 20 | 运维 | K8s 部署、基于队列等待的 HPA、平滑推出 |
| 15 | 撰写和方法论 | 清楚解释什么改变了以及为什么 |
| **100** | | |

## 练习

1. 当草稿落后目标一个版本（例如，Llama 3.3 -> 3.4 漂移）时，测量接受率下降。构建监控警报。

2. 实现 n-gram 后备：如果 EAGLE-3 接受率低于阈值，切换到 n-gram 草稿。报告可靠性改进。

3. 运行受控的 MoE 实验：注入路由噪声的相同 Qwen3-Coder-30B vs 没有。测量草稿接受敏感度。

4. 扩展到 H200（141 GB）。报告每个副本的模型大小净空收益，以及你是否可以为未量化的 Llama 3.3 70B 提供服务部署。

5. 在相同 H100 硬件上对 TensorRT-LLM 推测解码进行基准测试。报告它在哪里胜过 vLLM。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| 草稿模型 | "推测器" | 提出 N 个 token 供目标验证的小模型 |
| EAGLE-3 | "2026 草稿架构" | 在目标隐藏状态上训练的草稿头；~75% 接受率 |
| P-EAGLE | "并行推测" | 在一遍目标验证中验证的草稿分支树 |
| 接受率 | "命中率" | 无需重新采样的已接受草稿 token 比例 |
| 量化 | "FP8 / INT4" | 低精度权重，以便在 GPU 内存中容纳更多模型 |
| 队列等待 | "HPA 指标" | 推理开始之前请求在待处理队列中等待的时间 |
| Speculators 中心 | "对齐草稿" | Red Hat Neural Magic 中心，包含常见开放模型的 EAGLE 草稿 |

## 延伸阅读

- [vLLM EAGLE 和 P-EAGLE 文档](https://docs.vllm.ai) — 参考服务部署技术栈
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) — 并行推测解码论文 + 集成
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — 草稿头训练管道
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) — 对齐草稿中心
- [TensorRT-LLM 推测解码](https://nvidia.github.io/TensorRT-LLM/) — 供应商替代方案
- [Fireworks.ai 服务部署架构](https://fireworks.ai/blog) — 商业参考
- [EAGLE-3 论文 (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) — 方法论文
- [vLLM 代码库](https://github.com/vllm-project/vllm) — 代码和基准测试
