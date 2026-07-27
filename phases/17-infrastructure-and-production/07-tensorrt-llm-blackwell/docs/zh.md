# Blackwell 上的 TensorRT-LLM：FP8 与 NVFP4

> TensorRT-LLM 是 NVIDIA 专属技术，但在 Blackwell 上表现卓越。在采用 Dynamo 编排的 GB200 NVL72 上，SemiAnalysis InferenceX 测得 120B 模型在 2026 年 Q1-Q2 的每百万 token 成本为 $0.012，而 H100 + vLLM 为 $0.09/M——相差 7 倍经济差距。该技术栈由三种浮点格式叠加而成：FP8 因具备 KV 缓存和注意力所需的大动态范围而保持关键地位；NVFP4（4 位微缩放）负责权重和激活值；多 token 预测（MTP）与分离式预填充/解码再带来 2-3 倍提升。第零天模型支持直接加载 FP4 权重，无需训练后转换。对 2026 年的工程团队而言，挑战在于：TRT-LLM 是封闭的 NVIDIA 技术栈，采用它意味着用可移植性换取吞吐量。在投入之前，请根据自身模型和硬件组合做好计算。

**类型：** 学习
**语言：** Python（标准库，玩具级 FP8/NVFP4 内存与成本计算器）
**前置知识：** 阶段 17·04（vLLM 服务内部原理），阶段 10·13（量化）
**时间：** 约 75 分钟

## 学习目标

- 解释为何即使权重使用 NVFP4，FP8 对于 KV 缓存和注意力仍然保持关键地位。
- 计算前沿模型在 BF16、FP8 和 NVFP4 下的 HBM 占用，并推理节省空间来自何处。
- 列举 TRT-LLM 利用的 Blackwell 专有特性（第零天 FP4、MTP、分离式服务、all-to-all 原语）。
- 判断何时 TRT-LLM 的 NVIDIA 锁定值得其在 Hopper 上相对于 vLLM 的 7 倍成本差距。

## 问题

2026 年推理经济的前沿问题是"每美元能获得多少 token"。答案取决于四个叠加选择：硬件代际（Hopper H100/H200 vs Blackwell B200/GB200）、精度（BF16 → FP8 → NVFP4）、服务引擎（vLLM vs SGLang vs TRT-LLM）和编排方式（普通 vs 分离式 vs Dynamo）。

在 Hopper 上使用 vLLM，120B MoE 模型运行成本约为 $0.09/百万 token。在 Blackwell 上使用 TRT-LLM + Dynamo，同样模型运行成本约为 $0.012——便宜 7 倍。部分差距来自硬件（Blackwell 每 GPU LLM 吞吐量是 Hopper 的 11-15 倍），部分来自技术栈：FP4 权重、MTP 草稿模型、分离式预填充/解码以及用于 MoE 专家通信的 NVLink 5 all-to-all。

在 NVIDIA 技术栈之外无法复现这一效果。这就是取舍——用可移植性换取经济效益。理解哪些技术栈选择贡献了多少比例的差距，正是本课的核心。

## 概念

### 为什么 FP8 仍是 KV 缓存的下限

2026 年一个常见错误：认为 NVFP4 适用于所有场景。事实并非如此。KV 缓存需要 FP8（8 位浮点数），因为它存储的注意力键和值跨越很宽的动态范围。将 KV 量化到 FP4 会导致灾难性的精度损失——分布尾部丢失，注意力分数崩溃。FP8 的指数位为 KV 缓存提供了所需的动态范围。

NVFP4（2025-2026）适用于权重和激活值。微缩放机制：每个权重块拥有自己的缩放因子，使小块可以在不损失每张量缩放精度的情况下跨越不同的动态范围。对于激活值而言，FP4 可以胜任，因为激活值在层内范围较小。

典型的 Blackwell 配置：

- 权重：NVFP4（4 位微缩放）
- 激活值：NVFP4
- KV 缓存：FP8
- 注意力累加器：FP32（softmax 稳定性）

### TRT-LLM 使用的 Blackwell 专有原语

- **第零天 FP4 权重**：模型提供商直接发布 FP4 权重；TRT-LLM 加载时无需训练后转换。FP4 不需要 AWQ/GPTQ 步骤。
- **多 token 预测（MTP）**：与 EAGLE（阶段 17·05）思路相同，但集成在 TRT-LLM 构建中。
- **分离式服务**：在独立的 GPU 池上进行预填充和解码，KV 缓存通过 NVLink 或 InfiniBand 传输。与 Dynamo（阶段 17·20）思路相同。
- **All-to-all 通信原语**：NVLink 5 将 MoE 专家通信延迟降低至 Hopper 的 1/3。TRT-LLM 的 MoE 内核针对此进行了优化。
- **NVFP4 + MXFP8 微缩放**：Blackwell Tensor Core 上硬件加速的缩放因子处理。

### 需要记住的数据

- HGX B200 上使用 TRT-LLM 运行 GPT-OSS-120B 约为 $0.02/M token。
- GB200 NVL72 上通过 Dynamo（编排 TRT-LLM）约为 $0.012/M token。
- H100 + vLLM 在类似负载下约为 $0.09/M token。
- TRT-LLM 更新在三个月内带来 2.8 倍吞吐量提升（2026 年）。
- Blackwell 每 GPU LLM 吞吐量是 Hopper 的 11-15 倍。
- MLPerf 推理 v6.0（2026 年 4 月）：Blackwell 在所有提交任务中占据主导地位。

### FP4 实际带来的质量代价

NVFP4 是激进的量化方案。在推理密集型任务（思维链、数学、长上下文代码生成）上，FP4 权重会带来明显的质量下降。逐块校准可以缓解但无法完全消除。部署推理模型的团队通常采用 FP8 权重 + FP4 激活值作为折中方案，或者坚持使用 H200 全面采用 FP8。

原则：在决定使用 NVFP4 权重之前，务必在评估集上验证任务质量。

### 为什么这是 NVIDIA 锁定的决策

TRT-LLM 是 C++ + CUDA + 闭源内核。模型需要针对特定 GPU SKU 编译。不支持 AMD、Intel 或 ARM。如果你的基础设施策略是多供应商的，TRT-LLM 在其服务层上不可行——你仍然可以在混合硬件上使用 vLLM 提供服务。如果你是纯 NVIDIA 环境，7 倍差距足以支付锁定的代价。

### 2026 年实践方案

对于年推理账单超过 1 亿美元的场景，在 Hopper + vLLM 上运行意味着放弃 7-10 倍的潜力。将成本主导型工作负载迁移到 Blackwell + TRT-LLM + Dynamo。将实验层保留在 H100 + vLLM 上以保证模型迭代速度。每个 NVFP4 转换后的模型在上线前都要验证质量。

### 分离式部署的额外收益

TRT-LLM 的分离式服务（独立的预填充和解码池）在阶段 17·20 中有深入讨论。在 Blackwell 上，乘数效应叠加：FP4 权重 × MTP 加速 × 分离式部署 × 缓存感知路由。7 倍数据前提是完整技术栈。

```figure
pipeline-parallel
```

## 使用它

`code/main.py` 计算三种技术栈下模型的内存占用、解码吞吐量（内存受限场景）和 $/M token：H100 + BF16 + vLLM、H100 + FP8 + vLLM、B200 + NVFP4/FP8 + TRT-LLM。运行脚本以观察叠加效应以及每项改变贡献的差距份额。

## 交付物

本课产出 `outputs/skill-trtllm-blackwell-advisor.md`。根据给定的工作负载、模型大小和年 token 量，判断 Blackwell + TRT-LLM 技术栈是否值得承担 NVIDIA 锁定的代价。

## 练习

1. 运行 `code/main.py`。对于一个 120B MoE 模型（30% 激活参数），计算在 H100 BF16、H100 FP8 和 B200 NVFP4/FP8 上受内存带宽限制的解码吞吐量。最大的跃升来自哪里？
2. 某客户目前在 H100 + vLLM 上每年花费 $200 万。考虑到 7 倍经济差距，他们需要购买多少块 Blackwell GPU 才能在 12 个月内摊薄迁移到 TRT-LLM 的成本？
3. 在 NVFP4 权重转换后，MATH 精度下降了 3 个百分点。请给出两种恢复方案：一种质量优先（保留 FP8 权重），一种成本优先（使用领域内数据校准）。
4. 阅读 MLPerf v6.0 推理结果。哪个任务的 Blackwell 相较 Hopper 提升最小，为什么？
5. 计算一个 405B 模型在 NVFP4 权重 + FP8 KV 缓存、128K 上下文时需要多少 HBM。能否放入单个 GB200 NVL72 节点？

## 关键术语

| 术语 | 通俗说法 | 实际含义 |
|------|---------|---------|
| FP8 | "8 位浮点" | 8 位浮点数；因动态范围需要用于 KV 缓存和注意力 |
| NVFP4 | "4 位微缩" | NVIDIA 的 4 位微缩放 FP 格式；Blackwell 上的权重和激活值 |
| MXFP8 | "MX 八位" | 微缩放 FP8 变体；Blackwell Tensor Core 上硬件加速 |
| 第零天 FP4 | "直接分发 FP4 权重" | 模型提供商以 FP4 格式直接发布权重；无需训练后转换步骤 |
| MTP | "多 token 预测" | TRT-LLM 集成的推测解码草稿模型（阶段 17·05） |
| 分离式服务 | "拆分预填充/解码" | 预填充和解码分别在独立 GPU 池上运行；KV 通过 NVLink/IB 传输 |
| All-to-all | "MoE 专家通信" | 将 token 路由到专家 GPU 的通信模式；NVLink 5 降低 3 倍延迟 |
| InferenceX | "SemiAnalysis 推理基准" | 2026 年业界公认的每 token 成本基准 |

## 延伸阅读

- [NVIDIA — Blackwell Ultra MLPerf 推理 v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) — 2026 年 4 月 MLPerf 结果
- [NVIDIA — Blackwell 上的 MoE 推理](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/) — NVLink 5 all-to-all 与 MoE 内核
- [TensorRT-LLM 概述](https://nvidia.github.io/TensorRT-LLM/overview.html) — 官方引擎文档
- [NVIDIA — Dynamo 介绍](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) — TRT-LLM 之上的分离式编排
- [MLPerf 推理](https://mlcommons.org/benchmarks/inference-datacenter/) — 发布 Blackwell 数据的基准测试套件
