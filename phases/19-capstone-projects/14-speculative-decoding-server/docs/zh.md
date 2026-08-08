# 14 · 推测解码推理服务器

> EAGLE-3 在 vLLM 0.7 中实现了真实流量下 2.5-3 倍的吞吐量提升。P-EAGLE（AWS 2026）将并行推测推向更高水平。SGLang 的 SpecForge 实现了大规模草稿头训练。Red Hat 的 Speculators 中心为常见开源模型发布了对齐草稿。TensorRT-LLM 将推测解码设为一级特性。2026 年的生产推理栈是 vLLM 或 SGLang + EAGLE 系列草稿 + FP8 或 INT4 量化 + 基于队列等待的 HPA。本课程目标是部署两个开源模型，达到基线 2.5 倍以上的吞吐量，并出具完整的尾部延迟报告。

**类型：** 综合实战
**语言：** Python（推理服务）、C++ / CUDA（算子审查）、YAML（配置）
**前置：** 阶段 3（深度学习）、阶段 7（Transformer）、阶段 10（从零实现 LLM）、阶段 17（基础设施与生产）
**涉及阶段：** P3 · P7 · P10 · P17
**时长：** 30 小时

## 问题陈述

推测解码在 2026 年已成为标准配置。EAGLE-3 草稿头基于目标模型隐藏状态训练，可预测 N 个后续 token；目标模型在一次前向传播中完成验证。60-80% 的接受率转化为端到端 2-3 倍的吞吐量提升。vLLM 0.7 原生集成了这一能力。SGLang + SpecForge 提供完整训练流水线。Red Hat 的 Speculators 发布了面向 Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B 的对齐草稿。

核心难点在于推理运维，而非模型本身。接受率会随流量分布漂移（ShareGPT vs 代码 vs 领域数据）。拒绝情况下的尾部延迟比不启用推测时更差——必须在多个 batch size 下报告 p99 延迟，而不是仅看稳态 tokens/s。对比 Anthropic / OpenAI API 的每百万 token 成本才是构建可信度的关键。

## 概念原理

推测解码包含两个层面。**草稿**模型（EAGLE-3 草稿头、ngram 或较小的目标对齐模型）在每个步骤中提出 k 个候选 token。**目标**模型在一次前向传播中验证所有 k 个 token；任何被接受的 token 前缀都会替代贪婪路径。接受率取决于草稿与目标模型的对齐程度以及输入分布。

EAGLE-3 在大多数流量上优于 ngram 草稿。P-EAGLE 通过并行推测实现更深的草稿树。权衡之处在于：拒绝时 P99 延迟更高，因为验证阶段的输入更大。推理服务配置必须按 batch size 分桶报告延迟，以呈现这一影响。

部署在 Kubernetes 上。vLLM 0.7 每个 GPU 或张量并行分片运行一个副本。HPA 基于队列等待而非 CPU 进行自动扩缩。FP8（Marlin）和 INT4（AWQ）量化将 GPU 内存控制在 H100 / H200 范围内。最终报告需包含吞吐量、接受率、batch 1/8/32 下的 p50/p99、以及每百万 token 的成本（$）。

## 架构

```
请求入口
    |
    v
vLLM 服务器 (0.7) 或 SGLang (0.4)
    |
    +-- 草稿：EAGLE-3 草稿头 | P-EAGLE 并行推测 | ngram 回退
    +-- 目标：Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     量化方式：FP8-Marlin 或 INT4-AWQ
    |
    v
验证阶段：将 k 个草稿 token 批量通过目标模型
    |
    v （接受前缀；对拒绝的后缀重新采样）
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

- 推理服务：vLLM 0.7 或 SGLang 0.4
- 推测方法：EAGLE-3 草稿头、P-EAGLE 并行推测、ngram 回退
- 草稿训练：SpecForge（SGLang）或 Red Hat Speculators
- 目标模型：Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B
- 量化：FP8（Marlin）、INT4 AWQ
- 部署：Kubernetes + NVIDIA device plugin；基于队列等待指标的 HPA
- 评测：ShareGPT、MT-Bench-v2、GSM8K、HumanEval，用于按领域分布的接受率测量
- 参考基线：TensorRT-LLM 推测解码作为厂商基线

## 动手构建

1. **目标模型准备。** 选择 Llama 3.3 70B。通过 Marlin 量化为 FP8。在 vLLM 0.7 上部署，使用 1 张 H100（或 2 张做张量并行）。

2. **草稿来源。** 从 Red Hat Speculators 拉取对齐的 EAGLE-3 草稿头（或通过 SpecForge 自行训练）。加载到 vLLM 的推测解码配置中。

3. **基线数据。** 在启用推测之前：测量 batch 1/8/32 下的 tokens/s、p50/p99 延迟和 GPU 利用率。公开发布。

4. **启用 EAGLE-3。** 切换配置；重新运行同一基准测试。报告加速比、接受率和 p99 尾部延迟变化。

5. **P-EAGLE。** 启用并行推测；测量更深草稿树与串行 EAGLE-3 的对比。报告 P-EAGLE 产生正向收益与反向损失的拐点。

6. **分领域流量。** 将 ShareGPT、HumanEval 以及特定领域流量通过同一服务器运行。测量各分布的接受率。识别草稿漂移的时机。

7. **第二个目标模型。** 对 Qwen3-Coder-30B MoE 运行相同的流水线。草稿训练难度更高（MoE 路由噪声）。出具报告。

8. **K8s HPA。** 在 K8s 下部署，HPA 跟踪 `queue_wait_ms`。演示负载增加三倍时的自动扩缩。

9. **成本对比。** 针对 Anthropic Claude Sonnet 4.7 和 OpenAI GPT-5.4，在相同评测上计算每百万 token 成本（$）。公开发布。

## 使用示例

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 已激活
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   首 token 42ms, 完整响应 980ms (620 tokens)
[cost]      在持续吞吐量下，每百万输出 token $0.34
```

## 交付要求

`outputs/skill-inference-server.md` 描述交付物。包含启用推测解码的可测量推理服务栈、完整的基准测试报告和 K8s 部署。

| 权重 | 评估标准 | 如何测量 |
|:-:|---|---|
| 25 | 相比基线的实测加速比 | 两个模型上吞吐量达到 2.5 倍以上，质量匹配 |
| 20 | 真实流量下的接受率 | 按流量分布出具接受率报告 |
| 20 | P99 尾部延迟控制 | batch 1/8/32 下启用与不启用推测的 p99 |
| 20 | 运维能力 | K8s 部署、基于队列等待的 HPA、平滑滚动更新 |
| 15 | 文档与方法论 | 清晰地解释改动内容及其原因 |
| **100** | | |

## 扩展练习

1. 测量草稿模型比目标模型落后一个版本（如 Llama 3.3 → 3.4 漂移）时的接受率下降幅度。构建监控告警。

2. 实现 ngram 回退：当 EAGLE-3 接受率低于阈值时，切换到 ngram 草稿。报告可靠性改善。

3. 进行受控 MoE 实验：同一 Qwen3-Coder-30B 分别在注入路由噪声和不注入的情况下运行。测量草稿接受率的敏感度。

4. 扩展到 H200（141 GB）。报告单副本可容纳的模型大小余量，以及是否能够部署未量化的 Llama 3.3 70B。

5. 在相同 H100 硬件上对 TensorRT-LLM 推测解码进行基准测试。报告其与 vLLM 相比的优势所在。

## 关键术语

| 术语 | 通俗说法 | 实际含义 |
|------|---------|---------|
| 草稿模型 | "推测器" | 提出 N 个 token 供目标模型验证的小型模型 |
| EAGLE-3 | "2026 草稿架构" | 基于目标隐藏状态训练的草稿头；接受率约 75% |
| P-EAGLE | "并行推测" | 在一次目标前向传播中验证草稿树的多条分支 |
| 接受率 | "命中率" | 无需重新采样即被接受的草稿 token 比例 |
| 量化 | "FP8 / INT4" | 使用更低精度权重以在 GPU 内存中容纳更大模型 |
| 队列等待 | "HPA 指标" | 请求在推理开始前于待处理队列中等待的时间 |
| Speculators 中心 | "对齐草稿" | Red Hat Neural Magic 维护的面向常见开源模型的 EAGLE 草稿中心 |

## 进一步阅读

- [vLLM EAGLE 与 P-EAGLE 文档](https://docs.vllm.ai) — 参考推理服务栈
- [P-EAGLE（AWS 2026）](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) — 并行推测解码论文与集成
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — 草稿头训练流水线
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) — 对齐草稿中心
- [TensorRT-LLM 推测解码](https://nvidia.github.io/TensorRT-LLM/) — 厂商替代方案
- [Fireworks.ai 推理架构](https://fireworks.ai/blog) — 商业参考
- [EAGLE-3 论文（arXiv:2503.01840）](https://arxiv.org/abs/2503.01840) — 方法论文
- [vLLM 仓库](https://github.com/vllm-project/vllm) — 代码与基准测试
