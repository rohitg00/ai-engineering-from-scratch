# 顶点项目 14 — 投机解码推理服务器

> vLLM 0.7 中的 EAGLE-3 在实际流量上实现了 2.5-3 倍的吞吐量。AWS 2026 年的 P-EAGLE 将并行投机推理推向了更高层次。SGLang 的 SpecForge 在规模化上训练了草稿头。红帽的 Speculators 中心发布了面向常见开源模型的对齐草稿。TensorRT-LLM 使投机解码在 NVIDIA 上成为一等公民。2026 年的生产推理服务栈是 vLLM 或 SGLang 搭配 EAGLE 系列草稿、FP8 或 INT4 量化，以及基于队列等待时间的 HPA。本顶点项目的目标是服务于两个开源模型，实现 2.5 倍以上的基准吞吐量，并提交完整的尾部延迟报告。

**类型：** 顶点项目
**语言：** Python（服务）、C++ / CUDA（内核检查）、YAML（配置）
**前置知识：** 阶段 3（深度学习）、阶段 7（Transformer）、阶段 10（从头实现 LLM）、阶段 17（基础设施）
**涉及阶段：** P3 · P7 · P10 · P17
**时间：** 30 小时

## 问题

投机解码在 2026 年已成为一项成熟技术。EAGLE-3 草稿头针对目标模型的隐状态进行训练，并提前预测 N 个 token；目标模型在一次前向传播中完成验证。60-80% 的接受率可转化为 2-3 倍的端到端吞吐量。vLLM 0.7 原生集成了这一功能。SGLang + SpecForge 提供了训练流程。红帽的 Speculators 发布了针对 Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B 的对齐草稿。

真正的技巧在于服务运维，而非模型本身。接受率会随流量分布（ShareGPT 与代码数据与领域数据）而变化。拒绝情况下的尾部延迟比没有投机时更差——你必须报告多个批次大小下的 p99 延迟，而不仅仅是稳态的 tokens/秒。每 100 万 token 的成本与 Anthropic / OpenAI API 的比较才是可信度的关键。

## 概念

投机解码包含两层：一个**草稿**模型（EAGLE-3 头、n-gram 或更小的目标对齐模型）每步提出 k 个候选 token；**目标**模型在一次前向传播中验证所有 k 个 token；任何被接受的前缀都会替代贪心路径。接受率取决于草稿与目标的对齐程度以及输入分布。

EAGLE-3 在大多数流量上优于 n-gram 草稿。P-EAGLE 运行并行投机推理以实现更深的草稿树。权衡点在于：拒绝情况下的 P99 延迟更高，因为验证前向传播的规模更大。服务配置必须报告按批次大小分组的延迟以暴露这一问题。

部署采用 Kubernetes。vLLM 0.7 在每个 GPU 或张量并行分片上运行一个副本。HPA 基于队列等待时间而非 CPU 进行自动扩展。FP8（Marlin）和 INT4（AWQ）量化使 GPU 内存保持在 H100 / H200 的容量范围内。端到端报告包括吞吐量、接受率、批次 1/8/32 下的 p50/p99 延迟，以及每 100 万 token 的成本。

## 架构

```
请求入口
    |
    v
vLLM 服务器 (0.7) 或 SGLang (0.4)
    |
    +-- 草稿: EAGLE-3 头 | P-EAGLE 并行 | n-gram 后备
    +-- 目标: Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     量化 FP8-Marlin 或 INT4-AWQ
    |
    v
验证前向传播: 将 k 个草稿 token 批量送入目标模型
    |
    v (接受前缀；对拒绝的后缀重新采样)
    v
token 流返回客户端
    |
    v
Prometheus 指标: 吞吐量、接受率、队列等待时间、延迟 p50/p99
    |
    v
基于队列等待时间指标的 HPA
```

## 技术栈

- 服务框架：vLLM 0.7 或 SGLang 0.4
- 投机方法：EAGLE-3 草稿头、P-EAGLE 并行投机、n-gram 后备
- 草稿训练：SpecForge（SGLang）或 Red Hat Speculators
- 目标模型：Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B
- 量化：FP8（Marlin）、INT4 AWQ
- 部署：Kubernetes + NVIDIA 设备插件；基于队列等待时间指标的 HPA
- 评估：ShareGPT、MT-Bench-v2、GSM8K、HumanEval（用于跨领域接受率测量）
- 参考：TensorRT-LLM 投机解码（作为供应商基线）

## 构建步骤

1. **目标模型准备。** 选择 Llama 3.3 70B。通过 Marlin 量化为 FP8。在 1×H100（或 2 路张量并行）上使用 vLLM 0.7 部署。

2. **草稿来源。** 从 Red Hat Speculators 拉取对齐的 EAGLE-3 草稿头（或通过 SpecForge 训练一个）。加载到 vLLM 的投机解码配置中。

3. **基准数据。** 在启用投机之前：记录批次 1/8/32 下的 tokens/s、p50/p99 延迟、GPU 利用率。发布结果。

4. **启用 EAGLE-3。** 切换配置；重新运行相同的基准测试。报告加速比、接受率、p99 尾部延迟变化。

5. **P-EAGLE。** 启用并行投机；测量更深的草稿树与串行 EAGLE-3 的比较。报告 P-EAGLE 在何种拐点处有益或有害。

6. **领域流量。** 在同一服务器上运行 ShareGPT、HumanEval 和特定领域流量。测量每种分布下的接受率。识别草稿何时发生漂移。

7. **第二个目标模型。** 在 Qwen3-Coder-30B MoE 上运行相同的流程。草稿更具挑战性（MoE 路由噪声）。报告结果。

8. **K8s HPA。** 在 K8s 上部署，HPA 跟踪 `queue_wait_ms`。演示当负载翻三倍时的自动扩展。

9. **成本比较。** 在同一评估上计算每 100 万 token 的成本，与 Anthropic Claude Sonnet 4.7 和 OpenAI GPT-5.4 比较。发布结果。

## 使用示例

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 已启用
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   首 token 42ms, 完整响应 980ms (620 tokens)
[cost]      在持续吞吐量下每 100 万输出 token 0.34 美元
```

## 交付标准

`outputs/skill-inference-server.md` 描述了可交付成果：一个经过实测的、带有投机解码的服务栈、一份完整的基准测试报告，以及一个 K8s 部署。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 与基线相比的实测加速 | 在两个模型上，质量匹配的情况下吞吐量提升 2.5 倍以上 |
| 20 | 真实流量下的接受率 | 按分布报告的接受率 |
| 20 | P99 尾部延迟规范 | 批次 1/8/32 下有/无投机时的 p99 延迟 |
| 20 | 运维 | K8s 部署、基于队列等待时间的 HPA、平滑发布 |
| 15 | 文档与方法论 | 清晰解释变化的内容及原因 |
| **100** | | |

## 练习

1. 测量当草稿比目标落后一个版本时（例如 Llama 3.3 → 3.4 漂移）接受率的下降情况。构建一个监控告警。

2. 实现 n-gram 后备机制：如果 EAGLE-3 接受率低于阈值，则切换到 n-gram 草稿。报告可靠性提升。

3. 运行一个有对照的 MoE 实验：对同一个 Qwen3-Coder-30B，注入路由噪声与无噪声对比。测量草稿接受率的敏感性。

4. 扩展到 H200（141 GB）。报告每个副本可容纳的模型大小提升，以及是否可以服务未量化的 Llama 3.3 70B。

5. 在相同的 H100 硬件上对 TensorRT-LLM 投机解码进行基准测试。报告其在哪些方面优于 vLLM。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------|---------|
| 草稿模型 | "推测器" | 提出 N 个 token 供目标模型验证的小模型 |
| EAGLE-3 | "2026 年草稿架构" | 在目标隐状态上训练的草稿头；约 75% 的接受率 |
| P-EAGLE | "并行投机" | 在一个目标前向传播中验证的草稿分支树 |
| 接受率 | "命中率" | 无需重新采样即可被接受的草稿 token 比例 |
| 量化 | "FP8 / INT4" | 降低精度的权重，使更多模型适配 GPU 内存 |
| 队列等待时间 | "HPA 指标" | 请求在推理开始前在待处理队列中等待的时间 |
| Speculators 中心 | "对齐草稿" | Red Hat Neural Magic 发布的面向常见开源模型的 EAGLE 草稿中心 |

## 延伸阅读

- [vLLM EAGLE 和 P-EAGLE 文档](https://docs.vllm.ai) — 参考服务栈
- [P-EAGLE（AWS 2026）](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) — 并行投机解码论文及集成
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — 草稿头训练流程
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) — 对齐草稿中心
- [TensorRT-LLM 投机解码](https://nvidia.github.io/TensorRT-LLM/) — 供应商替代方案
- [Fireworks.ai 服务架构](https://fireworks.ai/blog) — 商业参考
- [EAGLE-3 论文（arXiv:2503.01840）](https://arxiv.org/abs/2503.01840) — 方法论文
- [vLLM 仓库](https://github.com/vllm-project/vllm) — 代码与基准测试
