# 顶点项目 14 —— 投机解码推理服务器

> vLLM 0.7 中的 EAGLE-3 在实际流量上提供 2.5-3 倍吞吐量。P-EAGLE（AWS 2026）进一步推动了并行投机。SGLang 的 SpecForge 大规模训练了草稿头。Red Hat 的 Speculators 中心为常见开放模型发布了对齐的草稿。TensorRT-LLM 在 NVIDIA 上使投机解码成为一等公民。2026 年的生产服务栈是 vLLM 或 SGLang，带 EAGLE 家族草稿、FP8 或 INT4 量化，以及队列等待上的 HPA。这个顶点项目是以 2.5 倍以上基线吞吐量服务两个开放模型，并附带完整的尾部延迟报告。

**类型：** 顶点项目
**语言：** Python（服务）、C++ / CUDA（内核检查）、YAML（配置）
**先决条件：** Phase 3（深度学习）、Phase 7（transformers）、Phase 10（从头开始 LLM）、Phase 17（基础设施）
**涉及阶段：** P3 · P7 · P10 · P17
**时间：** 30 小时

## 问题

投机解码在 2026 年成为商品。EAGLE-3 草稿头在目标模型的隐藏状态上训练，并预测 N 个 token；目标模型在单次通过中验证。60-80% 的接受率转化为 2-3 倍端到端吞吐量。vLLM 0.7 原生集成此功能。SGLang + SpecForge 提供训练管道。Red Hat 的 Speculators 为 Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B 发布对齐的草稿。

技艺在于服务操作，而非模型。接受率随流量分布漂移（ShareGPT vs 代码 vs 领域数据）。拒绝下的尾部延迟比没有投机时更差——你必须在多个批处理大小下报告 p99，而不仅仅是稳态 token/s。每 1M token 成本与 Anthropic / OpenAI API 对比是可信度杠杆。

## 概念

投机解码有两层。**草稿**模型（EAGLE-3 头、ngram 或更小的目标对齐模型）每步提出 k 个候选 token。**目标**模型在单次通过中验证所有 k 个；任何接受的前缀替换贪婪路径。接受率取决于草稿-目标对齐和输入分布。

EAGLE-3 在大多数流量上击败 ngram 草稿。P-EAGLE 运行并行投机以进行更深的草稿树。权衡：拒绝上的 P99 延迟更高，因为验证通过更大。服务配置必须报告按批处理大小分桶的延迟以揭示这一点。

部署采用 Kubernetes。vLLM 0.7 每个 GPU 或张量并行分片运行一个副本。HPA 在队列等待而非 CPU 上自动扩展。FP8（Marlin）和 INT4（AWQ）量化将 GPU 内存保持在 H100 / H200 范围内。端到端报告是吞吐量、接受率、批处理 1/8/32 的 p50/p99，以及 $/1M token。

## 架构

```
请求入口
    |
    v
vLLM 服务器（0.7）或 SGLang（0.4）
    |
    +-- 草稿：EAGLE-3 头 | P-EAGLE 并行 | ngram 后备
    +-- 目标：Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     量化 FP8-Marlin 或 INT4-AWQ
    |
    v
验证通过：将 k 个草稿 token 批处理通过目标
    |
    v（接受前缀；为拒绝的后缀重新采样）
    v
token 流返回客户端
    |
    v
Prometheus 指标：吞吐量、接受率、队列等待、延迟 p50/p99
    |
    v
队列等待指标上的 HPA
```

## 技术栈

- 服务：vLLM 0.7 或 SGLang 0.4
- 投机方法：EAGLE-3 草稿头、P-EAGLE 并行投机、ngram 后备
- 草稿训练：SpecForge（SGLang）或 Red Hat Speculators
- 目标模型：Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B
- 量化：FP8（Marlin）、INT4 AWQ
- 部署：Kubernetes + NVIDIA 设备插件；队列等待指标上的 HPA
- 评估：ShareGPT、MT-Bench-v2、GSM8K、HumanEval，用于领域分布接受测量
- 参考：TensorRT-LLM 投机解码，用于供应商基线

## 构建它

1. **目标模型准备。** 选择 Llama 3.3 70B。通过 Marlin 量化为 FP8。在 1xH100（或 2x 张量并行）上的 vLLM 0.7 下部署。

2. **草稿来源。** 从 Red Hat Speculators 拉取对齐的 EAGLE-3 草稿头（或通过 SpecForge 训练一个）。加载到 vLLM 的投机解码配置中。

3. **基线数字。** 投机前：批处理 1/8/32 的 token/s、p50/p99 延迟、GPU 利用率。发布。

4. **启用 EAGLE-3。** 翻转配置；重新运行相同基准。报告加速、接受率、p99 尾部延迟差异。

5. **P-EAGLE。** 启用并行投机；测量更深草稿树 vs 串行 EAGLE-3。报告 P-EAGLE 帮助 vs 伤害的拐点。

6. **领域流量。** 通过同一服务器运行 ShareGPT vs HumanEval vs 领域特定流量。测量每分布的接受率。识别草稿漂移时。

7. **第二个目标模型。** 在 Qwen3-Coder-30B MoE 上运行相同管道。草稿更棘手（MoE 路由噪声）。报告。

8. **K8s HPA。** 在 K8s 下部署，HPA 跟踪 `queue_wait_ms`。演示负载三倍时扩展。

9. **成本比较。** 计算相同评估下 $/1M token 与 Anthropic Claude Sonnet 4.7 和 OpenAI GPT-5.4 的对比。发布。

## 使用它

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[服务]     vLLM 0.7，Llama 3.3 70B FP8，EAGLE-3 激活
[解码]    bs=8，每步接受 token=3.2，接受率=0.76
[延迟]   首个 token 42 毫秒，完整响应 980 毫秒（620 个 token）
[成本]      持续吞吐量下每 1M 输出 token $0.34
```

## 交付它

`outputs/skill-inference-server.md` 描述可交付成果。一个带投机解码的测量服务栈、完整基准报告和 K8s 部署。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 与基线相比的测量加速 | 两个模型上匹配质量的 2.5 倍以上吞吐量 |
| 20 | 实际流量上的接受率 | 每分布接受率报告 |
| 20 | P99 尾部延迟纪律 | 批处理 1/8/32 下带和不带投机的 p99 |
| 20 | 运维 | K8s 部署、队列等待上的 HPA、平滑滚动 |
| 15 | 撰写和方法论 | 清晰解释更改了什么以及为什么 |
| **100** | | |

## 练习

1. 测量草稿比目标落后一个版本时的接受率下降（例如，Llama 3.3 -> 3.4 漂移）。构建监控警报。

2. 实现 ngram 后备：如果 EAGLE-3 接受率低于阈值，切换到 ngram 草稿。报告可靠性改进。

3. 运行受控 MoE 实验：相同 Qwen3-Coder-30B，注入路由噪声 vs 不注入。测量草稿接受敏感度。

4. 扩展到 H200（141 GB）。报告每个副本获得的模型大小余量，以及是否可以服务未量化的 Llama 3.3 70B。

5. 在相同 H100 硬件上基准测试 TensorRT-LLM 投机解码。报告它在哪里胜过 vLLM。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| 草稿模型 | "投机器" | 为目标验证提出 N 个 token 的小模型 |
| EAGLE-3 | "2026 草稿架构" | 在目标隐藏状态上训练的草稿头；约 75% 接受率 |
| P-EAGLE | "并行投机" | 在单次目标通过中验证的草稿分支树 |
| 接受率 | "命中率" | 无需重新采样即接受的草稿 token 比例 |
| 量化 | "FP8 / INT4" | 低精度权重以在 GPU 内存中容纳更多模型 |
| 队列等待 | "HPA 指标" | 请求在推理开始前在等待队列中的时间 |
| Speculators 中心 | "对齐的草稿" | Red Hat Neural Magic 中心，为常见开放模型提供 EAGLE 草稿 |

## 延伸阅读

- [vLLM EAGLE 和 P-EAGLE 文档](https://docs.vllm.ai) —— 参考服务栈
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) —— 并行投机解码论文 + 集成
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) —— 草稿头训练管道
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) —— 对齐草稿中心
- [TensorRT-LLM 投机解码](https://nvidia.github.io/TensorRT-LLM/) —— 供应商替代方案
- [Fireworks.ai 服务架构](https://fireworks.ai/blog) —— 商业参考
- [EAGLE-3 论文 (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) —— 方法论文
- [vLLM 仓库](https://github.com/vllm-project/vllm) —— 代码和基准
