# TensorRT-LLM 在 Blackwell 上使用 FP8 和 NVFP4

> TensorRT-LLM 仅限 NVIDIA，但在 Blackwell 上胜出。在配备 Dynamo 编排的 GB200 NVL72 上，SemiAnalysis InferenceX 在 2026 年 Q1-Q2 测量 120B 模型的每百万 token 0.012 美元，而 H100 + vLLM 为 0.09 美元/百万 token——7 倍的经济差距。该栈是三个浮点机制的复合：FP8 对于 KV 缓存和注意力内核保持关键，因为它具有它们需要的动态范围；NVFP4（4 位微缩放）处理权重和激活；多 token 预测（MTP）和分离式 prefill/decode 在顶部再增加 2-3 倍。第 0 天模型支持直接加载 FP4 权重，无需训练后转换。2026 年工程团队的陷阱：TRT-LLM 是一个封闭的 NVIDIA 栈，因此采用它需要用可移植性换取吞吐量。在提交之前运行你的模型混合和硬件的数学计算。

**类型：** 学习
**语言：** Python（标准库，简单的 FP8/NVFP4 内存和成本计算器）
**先修要求：** 阶段 17 · 04（vLLM 服务内部原理）、阶段 10 · 13（量化）
**时间：** 约 75 分钟

## 学习目标

- 解释为什么即使权重在 NVFP4 中，FP8 对于 KV 缓存和注意力仍然保持关键。
- 计算 BF16、FP8 和 NVFP4 下前沿模型的内存占用，并推理节省来自何处。
- 说出 TRT-LLM 利用的 Blackwell 特定功能（第 0 天 FP4、MTP、分离式服务、all-to-all 原语）。
- 决定何时 TRT-LLM 的 NVIDIA 锁定值得与 Hopper 上的 vLLM 产生 7 倍的成本差距。

## 问题

2026 年推理经济学的前沿是"每美元多少 token"。答案取决于四个叠加的选择：硬件代（Hopper H100/H200 vs Blackwell B200/GB200）、精度（BF16 → FP8 → NVFP4）、服务引擎（vLLM vs SGLang vs TRT-LLM）和编排（普通 vs 分离式 vs Dynamo）。

在带有 vLLM 的 Hopper 上，120B MoE 以约 0.09 美元/百万 token 运行。在带有 TRT-LLM + Dynamo 的 Blackwell 上，相同模型以约 0.012 美元运行——便宜 7 倍。部分差距是硬件（Blackwell 每 GPU LLM 吞吐量比 Hopper 高 11-15 倍）。部分是栈：FP4 权重、MTP draft、分离式 prefill/decode 和用于 MoE 专家通信的 NVLink 5 all-to-all。

你无法在 NVIDIA 的栈之外复制这一点。这就是权衡——可移植性换经济学。了解哪些栈选择给出差距的哪些份额是本课的重点。

## 概念

### 为什么 FP8 仍然是 KV 缓存的基础

2026 年的一个常见错误：假设 NVFP4 适用于任何地方。事实并非如此。KV 缓存需要 FP8（8 位浮点），因为它存储跨越宽动态范围的注意力键和值。将 KV 量化为 FP4 会导致灾难性的精度损失——分布的尾部下降，注意力分数崩溃。FP8 的指数位给 KV 缓存提供了它需要的范围。

NVFP4（2025-2026）适用于权重和激活。微缩放：每个权重块有自己的比例因子，因此小块可以跨越不同的动态范围，而没有每张量比例损失。对于激活，FP4 成立，因为激活在层内是小范围的。

典型的 Blackwell 配置：

- 权重：NVFP4（4 位微缩放）。
- 激活：NVFP4。
- KV 缓存：FP8。
- 注意力累加器：FP32（softmax 稳定性）。

### TRT-LLM 使用的 Blackwell 特定原语

- **第 0 天 FP4 权重**：模型提供商直接提供 FP4 权重；TRT-LLM 加载无需训练后转换。FP4 无需 AWQ / GPTQ 步骤。
- **多 token 预测（MTP）**：与 EAGLE 相同的想法（阶段 17 · 05），但集成到 TRT-LLM 构建中。
- **分离式服务**：在单独的 GPU 池上进行 prefill 和 decode，KV 缓存通过 NVLink 或 InfiniBand 传输。与 Dynamo 相同的想法（阶段 17 · 20）。
- **All-to-all 通信原语**：NVLink 5 将 MoE 专家通信延迟比 Hopper 削减 3 倍。TRT-LLM 的 MoE 内核为此调整。
- **NVFP4 + MXFP8 微缩放**：Blackwell Tensor Cores 上的硬件加速比例因子处理。

### 你应该记住的数字

- 通过 TRT-LLM 在 HGX B200 上 GPT-OSS-120B 为 0.02 美元/百万 token。
- 通过 Dynamo（或编排 TRT-LLM）在 GB200 NVL72 上为 0.012 美元/百万 token。
- 在可比工作负载上 H100 + vLLM ≈ 0.09 美元/百万 token。
- TRT-LLM 更新的 2.8 倍吞吐量增益（2026 年）。
- 每 GPU LLM 吞吐量 11-15 倍，Blackwell vs Hopper。
- MLPerf Inference v6.0（2026 年 4 月）：Blackwell 主导每个提交的任务。

### FP4 在实际质量中的成本

NVFP4 是激进的。在推理重工作负载（思维链、数学、带有长上下文的代码生成）上，FP4 权重明显降级。每块校准减轻但不消除。部署推理模型的团队经常使用 FP8 权重 + FP4 激活作为折衷，或在整个过程中坚持使用带有 FP8 的 H200。

规则：在承诺使用 NVFP4 权重之前，始终在你的评估集上验证任务质量。

### 为什么这是 NVIDIA 锁定决策

TRT-LLM 是 C++ + CUDA + 闭源内核。模型需要为特定的 GPU SKU 编译。没有 AMD，没有 Intel，没有 ARM。如果你的基础设施策略是多供应商，TRT-LLM 对于 TRT-LLM 服务的层级来说是一个非 starter——你仍然可以在混合硬件上使用 vLLM 服务。如果你仅使用 NVIDIA，7 倍的差距值得锁定。

### 2026 年实用配方

对于每年 1 亿美元以上的推理账单，在 Hopper + vLLM 上运行会在桌面上留下 7-10 倍。将成本主导的工作负载迁移到 Blackwell + TRT-LLM + Dynamo。将实验层级保留在 H100 + vLLM 上以加快模型迭代速度。在生产之前验证每个 NVFP4 转换模型的质量。

### 分离式奖励

TRT-LLM 的分离式服务（单独的 prefill 和 decode 池）在阶段 17 · 20 中深入介绍。在 Blackwell 上，乘数叠加：FP4 权重 × MTP 加速 × 分离式放置 × 缓存感知路由。7 倍数字假设这个完整栈。

## 使用它

`code/main.py` 计算 HBM 占用、解码吞吐量（内存绑定机制）和跨三个栈的美元/百万 token：H100 + BF16 + vLLM、H100 + FP8 + vLLM、B200 + NVFP4/FP8 + TRT-LLM。运行它以查看复合效应以及每个变化贡献的差距份额。

## 交付它

本课生成 `outputs/skill-trtllm-blackwell-advisor.md`。给定工作负载、模型大小和年度 token 量，它决定是否 Blackwell + TRT-LLM 栈值得 NVIDIA 锁定。

## 练习

1. 运行 `code/main.py`。在具有 30% 活动参数的 120B MoE 上，计算 H100 BF16、H100 FP8 和 B200 NVFP4/FP8 上的内存带宽限制解码吞吐量。最大的跳跃来自哪里？
2. 客户每年在 H100 + vLLM 上花费 200 万美元。考虑到 7 倍的经济差距，他们需要购买多少 Blackwell GPU 才能在 12 个月内摊销向 TRT-LLM 的迁移？
3. 你看到 NVFP4 权重转换后 MATH 的准确性下降 3 个点。说出两条恢复路径：一条质量优先（保持 FP8 权重），一条成本优先（使用域内数据校准）。
4. 阅读 MLPerf v6.0 推理结果。哪个任务的 Blackwell-over-Hopper 差距最小，为什么？
5. 计算在 128k 上下文上 NVFP4 权重 + FP8 KV 缓存的 405B 模型所需的 HBM。它是否适合单个 GB200 NVL72 节点？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| FP8 | "8 位浮点" | 8 位浮点；用于 KV 缓存和注意力，因为动态范围 |
| NVFP4 | "4 位微" | NVIDIA 的 4 位微缩放 FP 格式；Blackwell 上的权重和激活 |
| MXFP8 | "MX 八" | 微缩放 FP8 变体；Blackwell Tensor Cores 上的硬件加速 |
| Day-0 FP4 | "提供 FP4 权重" | 模型提供商以 FP4 发布权重；无训练后转换步骤 |
| MTP | "多 token 预测" | TRT-LLM 的集成 speculative-decoding draft（阶段 17 · 05） |
| Disaggregated serving | "分离 prefill/decode" | 在单独的 GPU 池上进行 prefill 和 decode；KV 通过 NVLink/IB 传输 |
| All-to-all | "MoE 专家通信" | 将 token 路由到专家 GPU 的通信模式；NVLink 5 削减 3 倍 |
| InferenceX | "SemiAnalysis 推理基准" | 2026 年行业接受的每 token 成本基准 |

## 延伸阅读

- [NVIDIA——Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/)——2026 年 4 月 MLPerf 结果。
- [NVIDIA——Blackwell 上的 MoE 推理](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/)——NVLink 5 all-to-all 和 MoE 内核。
- [TensorRT-LLM 概述](https://nvidia.github.io/TensorRT-LLM/overview.html)——官方引擎文档。
- [NVIDIA——Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)——TRT-LLM 之上的分离式编排。
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/)——发布 Blackwell 数字的基准测试套件。
