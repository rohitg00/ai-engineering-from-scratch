# Blackwell上的TensorRT-LLM，使用FP8和NVFP4

> TensorRT-LLM仅支持NVIDIA，但在Blackwell上获胜。在配备Dynamo编排的GB200 NVL72上，SemiAnalysis InferenceX在2026年Q1-Q2测量120B模型上每百万token $0.012，而H100 + vLLM上为$0.09/M —— 7倍经济差距。该栈是三个浮点制度的复合：FP8对KV缓存和注意力内核仍然关键，因为它具有它们需要的动态范围；NVFP4（4位微缩放）处理权重和激活；多token预测（MTP）和解耦预填充/解码在顶部再增加2-3倍。Day-0模型支持直接加载FP4权重，无需训练后转换。2026年工程团队的陷阱：TRT-LLM是封闭的NVIDIA栈，因此采用它用可移植性换取吞吐量。在承诺之前，对你的模型和硬件组合进行数学计算。

**类型：** 学习
**语言：** Python（标准库，玩具FP8/NVFP4内存和成本计算器）
**前置知识：** 第17阶段 · 04（vLLM服务内部），第10阶段 · 13（量化）
**时间：** 约75分钟

## 学习目标

- 解释为什么即使权重在NVFP4中，FP8对KV缓存和注意力仍然关键。
- 计算前沿模型在BF16、FP8和NVFP4下的HBM占用，并推理节省来自哪里。
- 命名TRT-LLM利用的Blackwell特定功能（day-0 FP4、MTP、解耦服务、all-to-all原语）。
- 决定何时TRT-LLM的NVIDIA锁定值得相比Hopper上vLLM的7倍成本差距。

## 问题

2026年推理经济学的前沿是"每美元多少token"。答案取决于四个堆叠选择：硬件代际（Hopper H100/H200 vs Blackwell B200/GB200）、精度（BF16 → FP8 → NVFP4）、服务引擎（vLLM vs SGLang vs TRT-LLM）和编排（普通 vs 解耦 vs Dynamo）。

在Hopper上使用vLLM，120B MoE运行在约每百万token $0.09。在Blackwell上使用TRT-LLM + Dynamo，相同模型运行在约$0.012 —— 便宜7倍。部分差距是硬件（Blackwell相比Hopper每GPU LLM吞吐量11-15倍）。部分是栈：FP4权重、MTP草稿、解耦预填充/解码，以及用于MoE专家通信的NVLink 5 all-to-all。

你无法在NVIDIA栈之外复制这个。这就是权衡 —— 可移植性换取经济性。理解哪些栈选择给予哪些份额的差距是本课程的要点。

## 概念

### 为什么FP8仍然是KV缓存的底线

2026年的常见错误：假设NVFP4适用于所有地方。它不是。KV缓存需要FP8（8位浮点），因为它存储跨越宽动态范围的注意力键和值。将KV量化到FP4导致灾难性精度损失 —— 分布尾部掉落，注意力分数崩溃。FP8的指数位给KV缓存它需要的范围。

NVFP4（2025-2026）适用于权重和激活。微缩放：每块权重有自己的缩放因子，因此小块可以跨越不同动态范围而不损失每张量缩放。对于激活，FP4成立，因为激活在层内是小范围的。

典型Blackwell配置：

- 权重：NVFP4（4位微缩放）。
- 激活：NVFP4。
- KV缓存：FP8。
- 注意力累加器：FP32（softmax稳定性）。

### TRT-LLM使用的Blackwell特定原语

- **Day-0 FP4权重**：模型提供商直接发布FP4权重；TRT-LLM无需训练后转换即可加载。FP4无需AWQ / GPTQ步骤。
- **多token预测（MTP）**：与EAGLE相同想法（第17阶段 · 05），但集成到TRT-LLM构建中。
- **解耦服务**：预填充和解码在单独的GPU池上，KV缓存通过NVLink或InfiniBand传输。与Dynamo相同想法（第17阶段 · 20）。
- **All-to-all通信原语**：NVLink 5将MoE专家通信延迟相比Hopper削减3倍。TRT-LLM的MoE内核为此调优。
- **NVFP4 + MXFP8微缩放**：Blackwell Tensor Core上的硬件加速缩放因子处理。

### 你应该记住的数字

- HGX B200通过TRT-LLM在GPT-OSS-120B上每百万token $0.02。
- GB200 NVL72通过Dynamo（编排TRT-LLM）每百万token $0.012。
- H100 + vLLM ≈ 可比工作负载上每百万token $0.09。
- TRT-LLM更新三个月内2.8倍吞吐量增益（2026年）。
- 每GPU LLM吞吐量，Blackwell vs Hopper：11-15倍。
- MLPerf Inference v6.0（2026年4月）：Blackwell主导每个提交任务。

### FP4在质量上的实际成本

NVFP4是激进的。在推理重工作负载（思维链、数学、长上下文代码生成）上，FP4权重明显降级。每块校准缓解但不消除。发布推理模型的团队通常使用FP8权重 + FP4激活作为妥协，或坚持使用FP8贯穿的H200。

规则：在承诺NVFP4权重之前，始终在你的评估集上验证任务质量。

### 为什么这是NVIDIA锁定决策

TRT-LLM是C++ + CUDA + 闭源内核。模型需要为特定GPU SKU编译。没有AMD、没有Intel、没有ARM。如果你的基础设施策略是多供应商，TRT-LLM对TRT-LLM服务层级来说是不可行的 —— 你仍然可以在混合硬件上从vLLM服务。如果你是仅NVIDIA，7倍差距支付锁定费用。

### 2026年实用配方

对于每年1亿美元+的推理账单，在Hopper + vLLM上运行留下7-10倍未开发。将成本主导工作负载迁移到Blackwell + TRT-LLM + Dynamo。在H100 + vLLM上保持实验层级以进行模型迭代速度。在生产前验证每个NVFP4转换模型的质量。

### 解耦奖励

TRT-LLM的解耦服务（单独的预填充和解码池）在第17阶段 · 20中深入覆盖。在Blackwell上，乘数堆叠：FP4权重 × MTP加速 × 解耦放置 × 缓存感知路由。7倍数字假设这个完整栈。

## 使用它

`code/main.py`计算三个栈上模型的HBM占用、解码吞吐量（内存约束状态）和$/M-token：H100 + BF16 + vLLM、H100 + FP8 + vLLM、B200 + NVFP4/FP8 + TRT-LLM。运行它以查看复合效果以及每个变化贡献的差距份额。

## 交付它

本课程产出`outputs/skill-trtllm-blackwell-advisor.md`。给定工作负载、模型大小和年token量，它决定Blackwell + TRT-LLM栈是否值得NVIDIA锁定。

## 练习

1. 运行`code/main.py`。在具有30%活跃参数的120B MoE上，计算H100 BF16、H100 FP8和B200 NVFP4/FP8上的内存带宽限制解码吞吐量。最大跳跃来自哪里？
2. 客户在H100 + vLLM上每年花费200万美元。给定7倍经济差距，他们需要购买多少Blackwell GPU才能在12个月内摊销迁移到TRT-LLM的盈亏平衡？
3. NVFP4权重转换后，你在MATH上看到精度下降3点。命名两条恢复路径：一条质量优先（保持FP8权重），一条成本优先（用域内数据校准）。
4. 阅读MLPerf v6.0推理结果。哪个任务具有最小的Blackwell-over-Hopper差距，为什么？
5. 计算在128k上下文下，NVFP4权重 + FP8 KV缓存的405B模型所需的HBM。它适合单个GB200 NVL72节点吗？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| FP8 | "八位浮点" | 8位浮点；由于动态范围用于KV缓存和注意力 |
| NVFP4 | "四位微" | NVIDIA的4位微缩放FP格式；Blackwell上的权重和激活 |
| MXFP8 | "MX八" | 微缩放FP8变体；Blackwell Tensor Core上硬件加速 |
| Day-0 FP4 | "发布FP4权重" | 模型提供商以FP4发布权重；无训练后转换步骤 |
| MTP | "多token预测" | TRT-LLM的集成投机解码草稿（第17阶段 · 05） |
| 解耦服务 | "拆分预填充/解码" | 预填充和解码在单独GPU池上；KV通过NVLink/IB传输 |
| All-to-all | "MoE专家通信" | 将token路由到专家GPU的通信模式；NVLink 5削减3倍 |
| InferenceX | "SemiAnalysis推理基准" | 2026年行业接受的每token成本基准 |

## 延伸阅读

- [NVIDIA —— Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) —— 2026年4月MLPerf结果。
- [NVIDIA —— Blackwell上的MoE推理](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/) —— NVLink 5 all-to-all和MoE内核。
- [TensorRT-LLM概述](https://nvidia.github.io/TensorRT-LLM/overview.html) —— 官方引擎文档。
- [NVIDIA —— 介绍Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) —— TRT-LLM之上的解耦编排。
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) —— 发布Blackwell数字的基准套件。