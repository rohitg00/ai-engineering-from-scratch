# 面向硬件的推理编译 — Blackwell 上的 FP8 与 NVFP4

> 面向硬件的推理编译以牺牲可移植性换取吞吐量，而 TensorRT-LLM——仅支持 NVIDIA、针对 Blackwell 调优——是这笔交换获得回报的最典型例子。在配备 Dynamo 编排的 GB200 NVL72 上，SemiAnalysis InferenceX 测得 $0.012 per million tokens on a 120B model in Q1-Q2 2026, against $0.09/M（H100 + vLLM）——7 倍的经济差距。该技术栈是三种浮点格式的叠加：FP8 对 KV cache 和 attention kernel 仍然至关重要，因为它具备所需的动态范围；NVFP4（4 位微缩放）处理权重和激活；多 token 预测（MTP）与分离式 prefill/decode 再叠加 2-3 倍的收益。Day-0 模型支持直接加载 FP4 权重，无需训练后转换。对 2026 年的工程团队而言，关键在于：TRT-LLM 是开源的，但仅限 NVIDIA——深度绑定 CUDA 和 Blackwell——因此采用它是以可移植性换吞吐量。在投入之前，请针对你的模型与硬件组合算清这笔账。

**Type:** Learn
**Languages:** Python（标准库，简易 FP8/NVFP4 内存与成本计算器）
**Prerequisites:** Phase 17 · 04（Serving Engine Internals），Phase 10 · 13（Quantization）
**Time:** 约 75 分钟

## 学习目标

- 解释为什么即使权重采用 NVFP4，FP8 对 KV cache 和 attention 仍然至关重要。
- 计算一个前沿模型在 BF16、FP8 和 NVFP4 下的 HBM 占用，并推理节省来自何处。
- 说出 TRT-LLM 利用的 Blackwell 特有特性（day-0 FP4、MTP、分离式 serving、all-to-all 通信原语）。
- 判断 TRT-LLM 的 NVIDIA 绑定何时值得以 7 倍成本差距换取，相比 Hopper 上的 vLLM。

## 问题所在

2026 年推理经济性的前沿问题是“每美元能产出多少 token”。答案取决于四个叠加的选择：硬件代际（Hopper H100/H200 vs Blackwell B200/GB200）、精度（BF16 → FP8 → NVFP4）、serving 引擎（vLLM vs SGLang vs TRT-LLM），以及编排（普通 vs 分离式 vs Dynamo）。

在 Hopper 上用 vLLM，一个 120B MoE 运行成本约为 ~$0.09 per million tokens. On Blackwell with TRT-LLM + Dynamo, the same model runs at ~$0.012——便宜 7 倍。这部分差距一部分来自硬件（Blackwell 的单 GPU LLM 吞吐量是 Hopper 的 11-15 倍），一部分来自技术栈：FP4 权重、MTP 草稿、分离式 prefill/decode，以及用于 MoE 专家通信的 NVLink 5 all-to-all。

在 NVIDIA 技术栈之外你无法复制这一切。这就是权衡——以可移植性换经济性。本课的重点是理解哪些技术栈选择贡献了差距中的哪一部分。

## 概念

### 为什么 FP8 仍是 KV cache 的下限

2026 年的一个常见错误：以为 NVFP4 可以应用于所有地方。并非如此。KV cache 需要 FP8（8 位浮点数），因为它存储的 attention 键和值跨越很宽的动态范围。将 KV 量化到 FP4 会导致灾难性的精度损失——分布的尾部衰减，attention 分数崩溃。FP8 的指数位为 KV cache 提供了所需的范围。

NVFP4（2025-2026）适用于权重和激活。微缩放（microscaling）：每个权重块有自己的缩放因子，因此小块可以跨越不同的动态范围而不受每张量缩放的损失。对于激活，FP4 能撑得住，因为激活在每一层内的范围较小。

典型的 Blackwell 配置：

- 权重：NVFP4（4 位微缩放）。
- 激活：NVFP4。
- KV cache：FP8。
- Attention 累加器：FP32（保证 softmax 稳定性）。

### TRT-LLM 使用的 Blackwell 特有原语

- **Day-0 FP4 权重**：模型提供商直接发布 FP4 权重；TRT-LLM 无需训练后转换即可加载。FP4 无需 AWQ / GPTQ 步骤。
- **多 token 预测（MTP）**：与 EAGLE（Phase 17 · 05）思路相同，但集成在 TRT-LLM 构建中。
- **分离式 serving**：prefill 和 decode 在独立的 GPU 池上进行，KV cache 通过 NVLink 或 InfiniBand 传输。与 Dynamo（Phase 17 · 20）思路相同。
- **All-to-all 通信原语**：NVLink 5 将 MoE 专家通信延迟相比 Hopper 降低了 3 倍。TRT-LLM 的 MoE kernel 针对此进行了调优。
- **NVFP4 + MXFP8 微缩放**：在 Blackwell Tensor Cores 上硬件加速的缩放因子处理。

### 你应该记住的数字

- HGX B200 通过 TRT-LLM 在 GPT-OSS-120B 上达到 $0.02/M tokens。
- GB200 NVL72 通过 Dynamo（编排 TRT-LLM）达到 $0.012/M tokens。
- H100 + vLLM 在可比工作负载下 ≈ $0.09/M tokens。
- 三个月的 TRT-LLM 更新（2026 年）带来 2.8 倍吞吐量提升。
- 单 GPU LLM 吞吐量，Blackwell 对 Hopper 为 11-15 倍。
- MLPerf Inference v6.0（2026 年 4 月）：Blackwell 在所有提交任务中占主导。

### FP4 在质量上的真实代价

NVFP4 相当激进。在推理密集型工作负载（思维链、数学、长上下文代码生成）上，FP4 权重会出现可见的性能退化。分块校准可以缓解但无法消除。发布推理模型的团队通常采用 FP8 权重 + FP4 激活作为折中，或者全程使用 H200 + FP8。

规则：在采用 NVFP4 权重之前，务必在你的评测集上验证任务质量。

### 为什么这是一个 NVIDIA 绑定决策

TRT-LLM 是 C++ + CUDA + 闭源 kernel。模型需要针对特定 GPU SKU 编译。不支持 AMD、Intel、ARM。如果你的基础设施策略是多供应商的，那么对 TRT-LLM 服务的层级而言，TRT-LLM 不可行——你仍可以在混合硬件上用 vLLM 提供服务。如果你只用 NVIDIA，7 倍的差距足以弥补这种绑定。

### 2026 年实用方案

对于每年 $100M+ 的推理账单，继续使用 Hopper + vLLM 会留下 7-10 倍的节省空间。将成本占主导的工作负载迁移到 Blackwell + TRT-LLM + Dynamo。实验层级保留在 H100 + vLLM 上，以保证模型迭代速度。在生产环境使用前，对每个 NVFP4 转换后的模型验证质量。

### 分离式的额外收益

TRT-LLM 的分离式 serving（独立的 prefill 和 decode 池）在 Phase 17 · 20 中有详细讲解。在 Blackwell 上，这些倍数会叠加：FP4 权重 × MTP 加速 × 分离式部署 × 缓存感知路由。7 倍这个数字假设了完整的技术栈。

```figure
pipeline-parallel
```

## 动手实践

`code/main.py` 计算一个模型在三种技术栈下的 HBM 占用、decode 吞吐量（内存受限区间）和 $/M-tokens：H100 + BF16 + vLLM、H100 + FP8 + vLLM、B200 + NVFP4/FP8 + TRT-LLM。运行它以观察叠加效应，以及每项改变对差距的贡献份额。

## 上线交付

本课产出 `outputs/skill-trtllm-blackwell-advisor.md`。给定工作负载、模型大小和年度 token 量，它会判断 Blackwell + TRT-LLM 技术栈是否值得接受 NVIDIA 绑定。

## 练习

1. 运行 `code/main.py`。对于一个具有 30% 激活参数的 120B MoE，计算 H100 BF16、H100 FP8 和 B200 NVFP4/FP8 上的内存带宽受限 decode 吞吐量。最大的跃升来自哪里？
2. 一位客户每年在 H100 + vLLM 上花费 $2M。在 7 倍经济差距下，需要购买多少块 Blackwell GPU 才能在 12 个月内摊销迁移到 TRT-LLM 的成本？
3. 你发现 NVFP4 权重转换后在 MATH 上精度下降 3 个点。说出两条恢复路径：一条质量优先（保留 FP8 权重），一条成本优先（用领域内数据校准）。
4. 阅读 MLPerf v6.0 推理结果。哪个任务的 Blackwell 对 Hopper 差距最小，为什么？
5. 计算一个 405B 模型在 NVFP4 权重 + FP8 KV cache、128k 上下文下所需的 HBM。它能装进单个 GB200 NVL72 节点吗？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| FP8 | “八位浮点” | 8 位浮点数；因动态范围而用于 KV cache 和 attention |
| NVFP4 | “四位微缩放” | NVIDIA 的 4 位微缩放浮点格式；用于 Blackwell 上的权重和激活 |
| MXFP8 | “MX 八位” | 微缩放 FP8 变体；在 Blackwell Tensor Cores 上硬件加速 |
| Day-0 FP4 | “直接发布 FP4 权重” | 模型提供商直接以 FP4 发布权重；无需训练后转换步骤 |
| MTP | “多 token 预测” | TRT-LLM 集成的投机解码草稿（Phase 17 · 05） |
| 分离式 serving | “分离 prefill/decode” | Prefill 和 decode 在独立 GPU 池上运行；KV 通过 NVLink/IB 传输 |
| All-to-all | “MoE 专家通信” | 将 token 路由到专家 GPU 的通信模式；NVLink 5 削减 3 倍 |
| InferenceX | “SemiAnalysis 推理基准” | 2026 年业界公认的每 token 成本基准 |

## 延伸阅读

- [NVIDIA — Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) — 2026 年 4 月 MLPerf 结果。
- [NVIDIA — MoE Inference on Blackwell](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/) — NVLink 5 all-to-all 与 MoE kernel。
- [TensorRT-LLM Overview](https://nvidia.github.io/TensorRT-LLM/overview.html) — 官方引擎文档。
- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) — TRT-LLM 之上的分离式编排。
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) — 发布 Blackwell 数据的基准测试套件。