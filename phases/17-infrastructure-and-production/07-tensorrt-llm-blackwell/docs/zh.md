# 07 · 在 Blackwell 上用 FP8 与 NVFP4 运行 TensorRT-LLM

> TensorRT-LLM 仅支持 NVIDIA，但它在 Blackwell 上一骑绝尘。在搭配 Dynamo 编排的 GB200 NVL72 上，SemiAnalysis InferenceX 在 2026 年 Q1-Q2 测得一个 120B 模型的成本为每百万 token 0.012 美元，而 H100 + vLLM 的成本为 0.09 美元/M——经济性差距高达 7 倍。整套技术栈由三种浮点精度叠加而成：FP8 对「KV 缓存（KV cache）」和「注意力（attention）」核函数仍然至关重要，因为它具备这两者所需的动态范围；NVFP4（4 比特微缩放）负责权重和激活值；「多 token 预测（multi-token prediction，MTP）」与「prefill/decode 分离（disaggregated prefill/decode）」又在此之上再叠加 2-3 倍。Day-0 模型支持可直接加载 FP4 权重，无需训练后转换。对 2026 年的工程团队来说有个隐忧：TRT-LLM 是一个封闭的 NVIDIA 技术栈，因此采用它就是用可移植性换吞吐量。在决定之前，请先针对你自己的模型与硬件组合算清这笔账。

**类型：** 学习
**语言：** Python（标准库，玩具级 FP8/NVFP4 显存与成本计算器）
**前置：** 阶段 17 · 04（vLLM 服务内部机制）、阶段 10 · 13（量化）
**时长：** 约 75 分钟

## 学习目标

- 解释为什么即便权重已采用 NVFP4，FP8 对 KV 缓存和注意力仍然至关重要。
- 计算一个前沿模型在 BF16、FP8 和 NVFP4 下的「显存（HBM）」占用，并推理出节省来自何处。
- 说出 TRT-LLM 所利用的 Blackwell 专属特性（day-0 FP4、MTP、分离式服务、all-to-all 原语）。
- 判断在何种情况下，TRT-LLM 的 NVIDIA 锁定值得用来换取相对 Hopper 上 vLLM 的 7 倍成本差距。

## 问题所在

2026 年推理经济性的前沿命题是「每美元能买到多少 token」。答案取决于四个相互叠加的选择：硬件代际（Hopper H100/H200 与 Blackwell B200/GB200）、精度（BF16 → FP8 → NVFP4）、服务引擎（vLLM 与 SGLang 与 TRT-LLM），以及编排方式（普通 vs 分离式 vs Dynamo）。

在 Hopper 上用 vLLM，一个 120B 的「混合专家（MoE）」模型成本约为每百万 token 0.09 美元。在 Blackwell 上用 TRT-LLM + Dynamo，同一个模型成本约为 0.012 美元——便宜 7 倍。这一差距中的一部分来自硬件（Blackwell 单卡 LLM 吞吐量是 Hopper 的 11-15 倍）。另一部分来自技术栈：FP4 权重、MTP 草稿、prefill/decode 分离，以及用于 MoE 专家通信的 NVLink 5 all-to-all。

你无法在 NVIDIA 技术栈之外复现这一点。这就是取舍——用可移植性换经济性。理解每一项技术栈选择各自贡献了差距中的多少份额，正是本课的要点。

## 核心概念

### 为什么 FP8 仍是 KV 缓存的底线

2026 年的一个常见误区：以为 NVFP4 可以处处适用。并非如此。KV 缓存需要 FP8（8 比特浮点），因为它存储的是横跨宽广动态范围的注意力键（key）和值（value）。把 KV 量化到 FP4 会造成灾难性的精度损失——分布的尾部被截断，注意力分数随之崩塌。FP8 的指数位赋予了 KV 缓存所需的范围。

NVFP4（2025-2026）适用于权重和激活值。微缩放：每一块权重都有自己的缩放因子，因此小块可以在不损失逐张量缩放精度的前提下覆盖不同的动态范围。对激活值而言，FP4 之所以撑得住，是因为层内激活值的取值范围本就很小。

典型的 Blackwell 配置：

- 权重：NVFP4（4 比特微缩放）。
- 激活值：NVFP4。
- KV 缓存：FP8。
- 注意力累加器：FP32（保证 softmax 稳定性）。

### TRT-LLM 使用的 Blackwell 专属原语

- **Day-0 FP4 权重**：模型提供方直接发布 FP4 权重；TRT-LLM 无需训练后转换即可加载。FP4 不再需要 AWQ / GPTQ 步骤。
- **多 token 预测（MTP）**：与 EAGLE（阶段 17 · 05）思路相同，但已集成进 TRT-LLM 的构建中。
- **分离式服务**：prefill 和 decode 运行在各自独立的 GPU 资源池上，KV 缓存通过 NVLink 或 InfiniBand 传输。与 Dynamo（阶段 17 · 20）思路相同。
- **all-to-all 通信原语**：相比 Hopper，NVLink 5 将 MoE 专家通信延迟降低了 3 倍。TRT-LLM 的 MoE 核函数针对此做了调优。
- **NVFP4 + MXFP8 微缩放**：在 Blackwell Tensor Core 上对缩放因子处理做了硬件加速。

### 你应该记住的数字

- HGX B200 通过 TRT-LLM 在 GPT-OSS-120B 上达到 0.02 美元/M token。
- GB200 NVL72 通过 Dynamo（编排 TRT-LLM）达到 0.012 美元/M token。
- H100 + vLLM 在可比工作负载上约为 0.09 美元/M token。
- TRT-LLM 三个月更新带来 2.8 倍吞吐量提升（2026）。
- Blackwell 单卡 LLM 吞吐量是 Hopper 的 11-15 倍。
- MLPerf Inference v6.0（2026 年 4 月）：Blackwell 在每一项提交的任务中都占据主导。

### FP4 在质量上的实际代价

NVFP4 很激进。在推理密集型工作负载上（思维链、数学、长上下文代码生成），FP4 权重会出现明显的质量退化。逐块校准能缓解但无法消除。发布推理模型的团队往往采用 FP8 权重 + FP4 激活值作为折中方案，或者干脆全程使用 H200 配 FP8。

法则：在决定采用 NVFP4 权重之前，务必在你自己的评测集上验证任务质量。

### 为什么这是一个 NVIDIA 锁定的决策

TRT-LLM 由 C++ + CUDA + 闭源核函数构成。模型需要针对特定的 GPU SKU 编译。不支持 AMD、不支持 Intel、不支持 ARM。如果你的基础设施战略是多厂商的，那么 TRT-LLM 对于由 TRT-LLM 提供服务的那一层而言是个不可行的选择——但你仍然可以在混合硬件上用 vLLM 提供服务。如果你只用 NVIDIA，那么 7 倍的差距足以为这份锁定买单。

### 2026 年的实操配方

对于年度推理账单超过 1 亿美元的场景，跑在 Hopper + vLLM 上意味着白白浪费了 7-10 倍的空间。把成本占主导的工作负载迁移到 Blackwell + TRT-LLM + Dynamo。把实验层保留在 H100 + vLLM 上，以保证模型迭代速度。在投产前对每一个经 NVFP4 转换的模型验证质量。

### 分离带来的额外收益

TRT-LLM 的分离式服务（独立的 prefill 与 decode 资源池）在阶段 17 · 20 中有深入讲解。在 Blackwell 上，乘数会层层叠加：FP4 权重 × MTP 加速 × 分离式部署 × 缓存感知路由。7 倍这个数字假定的是这一整套完整技术栈。

## 动手用

`code/main.py` 会针对一个模型在三套技术栈下计算其显存占用、解码吞吐量（内存受限区间）以及 $/M-token：H100 + BF16 + vLLM、H100 + FP8 + vLLM、B200 + NVFP4/FP8 + TRT-LLM。运行它，看看复利式的叠加效果，以及每一项改变对差距各自贡献了多少份额。

## 交付实践

本课产出 `outputs/skill-trtllm-blackwell-advisor.md`。给定一个工作负载、模型规模和年度 token 用量，它会判断 Blackwell + TRT-LLM 技术栈是否值得承受 NVIDIA 锁定。

## 练习

1. 运行 `code/main.py`。对于一个有 30% 活跃参数的 120B MoE 模型，计算其在 H100 BF16、H100 FP8 和 B200 NVFP4/FP8 上受内存带宽限制的解码吞吐量。最大的跃升来自哪里？
2. 某客户在 H100 + vLLM 上每年花费 200 万美元。鉴于 7 倍的经济性差距，他们需要购买多少块 Blackwell GPU 才能在 12 个月内摊平迁移到 TRT-LLM 的成本（盈亏平衡点）？
3. 在 NVFP4 权重转换后，你观察到 MATH 上的准确率下降了 3 个百分点。说出两条恢复路径：一条以质量优先（保留 FP8 权重），一条以成本优先（用领域内数据校准）。
4. 阅读 MLPerf v6.0 推理结果。哪项任务的 Blackwell 相对 Hopper 的差距最小，为什么？
5. 计算一个 405B 模型在 NVFP4 权重 + FP8 KV 缓存、128k 上下文下所需的显存。它能装进单个 GB200 NVL72 节点吗？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| FP8 | “八比特浮点” | 8 比特浮点；因动态范围需求而用于 KV 缓存和注意力 |
| NVFP4 | “四比特微缩” | NVIDIA 的 4 比特微缩放浮点格式；用于 Blackwell 上的权重和激活值 |
| MXFP8 | “MX 八” | 微缩放 FP8 变体；在 Blackwell Tensor Core 上硬件加速 |
| Day-0 FP4 | “发布 FP4 权重” | 模型提供方直接发布已是 FP4 的权重；无需训练后转换步骤 |
| MTP | “多 token 预测” | TRT-LLM 集成的投机解码草稿（阶段 17 · 05） |
| Disaggregated serving | “拆分 prefill/decode” | prefill 与 decode 运行在独立的 GPU 资源池上；KV 通过 NVLink/IB 传输 |
| All-to-all | “MoE 专家通信” | 将 token 路由到专家 GPU 的通信模式；NVLink 5 降低 3 倍 |
| InferenceX | “SemiAnalysis 推理基准” | 2026 年业界认可的每 token 成本基准 |

## 延伸阅读

- [NVIDIA — Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) — 2026 年 4 月 MLPerf 结果。
- [NVIDIA — MoE Inference on Blackwell](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/) — NVLink 5 all-to-all 与 MoE 核函数。
- [TensorRT-LLM Overview](https://nvidia.github.io/TensorRT-LLM/overview.html) — 官方引擎文档。
- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) — 位于 TRT-LLM 之上的分离式编排。
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) — 发布 Blackwell 数据的基准套件。
