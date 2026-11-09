# 硬件专业化输入组合 FP8和NVFP4在Blackwell上

> 专业化硬件推理编译交易可移植性,而TensorRT-LLM  仅为NVIDIA调整,为黑 是交易的最清楚的例子.在GB200 NVL72上,SemiAnalysis InferenceX测量了$0.012 per million tokens on a 120B model in Q1-Q2 2026, against $率为0.09/M,H100+vLLM7倍的经济差距. 堆组合了两个浮点格式,使用两个服务技术:FP8对于KV缓存和注意内核保持至关重要,因为它具有所需的动态范围;NVFP4 (4位微量化) 处理权重和激活;多代币预测 (MTP) 和分类预填/解码增加了另外2-3倍. 支持日-0模型直接加载FP4重量,而不会进行训练后转换. 2026年工程团队的目标:TRT-LLM是开源,但NVIDIA专用, CUDA和Blackwell专业,因此通过它交易了可移植性. 在做出承诺之前,你用模型和硬件进行计算.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy FP8/NVFP4 memory and cost calculator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 10 · 13 (Quantization)
**Time:** ~75 minutes

## 学习目标

- 解释为什么FP8在NVFP4中重量时仍然对KV缓存和注意力至关重要.
- 在BF16,FP8和NVFP4中计算边界模型的HBM足迹,并解释节省的来源.
- 命名黑特征TRT-LLM利用 (日-0 FP4,MTP,分类分类,全至全原始).
- 决定什么时候TRT-LLM的NVIDIA锁值7倍的成本差距与Hopper的vLLM.

## 问题

2026年推断经济学的边界是"每美元多少代币".答案取决于四个堆叠选择:硬件生成 (Hopper H100/H200 vs Blackwell B200/GB200),精度 (BF16 → FP8 → NVFP4),服务引擎 (vLLM vs SGLang vs TRT-LLM),和配乐 (平面 vs 分类对阵 Dynamo).

在Hopper上,一个120B的MoE在 ~$0.09 per million tokens. On Blackwell with TRT-LLM + Dynamo, the same model runs at ~$部分缺口是硬件 (Blackwell为每GPU LLM输出量11-15x对Hopper).部分是堆:FP4重量,MTP草案,分类的预填/解码,以及MoE专家通信的NVLink5.

对于经济学来说,这是交易的可移植性.理解哪些选择给出哪些缺口的份额是这门课程的重点.

## 概念

### 为什么FP8仍然是KV缓存的地板

2026年常见的错误:假设NVFP4适用于各处.它不适用于.KV缓存需要FP8 (8位浮点) 因为它存储了跨越广泛动态范围的注意力键和值.将KV量化为FP4导致灾难性的精度损失.

NVFP4 (2025-2026) 适用于重量和激活.微量化:每个重量块都有自己的尺度因子,因此小块可以跨越不同的动态范围,而不会损失每ensor尺度.对于激活,FP4 保持,因为激活在层内是小范围的.

典型的黑尔配置:

- 权重:NVFP4 (4位微量化).
- 激活:NVFP4.
- 预测量:FP8.
- 注意积累器:FP32 (软max稳定).

### 黑特异性原始物使用TRT-LLM

- **Day-0 FP4 weights**车型供应商直接运送FP4重量;TRT-LLM负载没有训练后转换.
- **Multi-token prediction (MTP)**果:与EAGLE (阶段17 · 05) 的想法相同,但与TRT-LLM构建相结合.
- **Disaggregated serving**通过 NVLink或InfiniBand传输KV缓存.与Dynamo (阶段17 · 20) 的相同想法.
- **All-to-all communication primitives** NVLink 5 降低了MoE专家通信延迟3x对Hopper.
- **NVFP4 + MXFP8 microscaling**硬件加速处理黑电芯的尺度因素.

### 你应该记住的数字

- 通过TRT-LLM,GPT-OSS-120B的HGX B200代币价为0.02/M美元.
- 通过Dynamo (配套TRT-LLM) 通过0.012/M美元的GB200 NVL72代币.
- 对于可比较的工作负载,H100+vLLM ≈ $0.099/M代币.
- 在TRT-LLM更新 (2026) 的三个月内,产量增长2.8倍.
- 博公司的每次博总额是11-15倍,
- 黑主导于每一个提交的任务.

### 实际QP4质量成本

NVFP4是积极的.在推理重的工作负载 (思想链,数学,长文本的代码代码),FP4重量显著降低.每块校准减轻,但不消除.团队运输推理模型通常使用FP8重量 +FP4激活作为妥协,或坚持H200与FP8在整个.

规则:在承诺 NVFP4 权重之前,总是验证您的评估设置中的任务质量.

### 为什么这是NVIDIA锁定决定

如果您的基础战略是多供应商,TRT-LLM是 TRT-LLM 服务的层次的非启动器.您仍然可以从vLLM上服务于混合硬件.如果您仅使用NVIDIA,则7x差距支付锁.

### 2026 实用食谱

对于每年100万美元以上的推断账单,运行Hopper + vLLM将在表上留下7-10倍.将成本主导的工作负载迁移到Blackwell + TRT-LLM + Dynamo.为模型代速度,保持H100 + vLLM的实验级别.在生产前验证每个NVFP4转换模型的质量.

### 分类奖励

在Blockwell上,乘数堆积:FP4重量 × MTP加速 × 分类配置 ×缓存知路线. 7x数量假设这个完整堆积.

```figure
pipeline-parallel
```

## 用它

`code/main.py`计算HBM足迹,解码吞吐量 (内存绑定模式) 和$/M代币为模型跨三个堆:H100 + BF16 + vLLM,H100 + FP8 + vLLM,B200 + NVFP4/FP8 + TRT-LLM.运行它以查看合并效果和每个变化所贡献的差距.

## 运送它

这一课产生了`outputs/skill-trtllm-blackwell-advisor.md`鉴于工作量,模型规模和年次代币量,它决定了黑+TRT-LLM堆是否值得NVIDIA锁.

## 运动

1. 跑步`code/main.py`在一个有30%活跃参数的120B MoE上,计算H100 BF16,H100 FP8和B200 NVFP4/FP8的内存带宽限制解码吞吐量.
2. 顾客每年花费2亿美元用于H100+vLLM. 考虑到经济差距7倍,他们需要购买多少黑GPU才能在12个月内抵偿 TRT-LLM迁移?
3. 在 NVFP4 重量转换后,您会看到精度在 MATH 上下降3点. 举个恢复路径:一个质量第一 (保持FP8 重量),一个成本第一 (与域内数据校准).
4. 读一读MLPerf v6.0推断结果. 哪个任务有最小的黑超 Hopper差距,为什么?
5. 在NVFP4重量下计算405B模型所需的HBM + 128k背景下FP8KV缓存.它是否适合单个GB200NVL72节点?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| FP8 | "eight-bit float" | 8-bit floating point; used for KV cache and attention due to dynamic range |
| NVFP4 | "four-bit micro" | NVIDIA's 4-bit microscaling FP format; weights and activations on Blackwell |
| MXFP8 | "MX eight" | Microscaling FP8 variant; hardware-accelerated on Blackwell Tensor Cores |
| Day-0 FP4 | "ship FP4 weights" | Model providers release weights already in FP4; no post-train conversion step |
| MTP | "multi-token prediction" | TRT-LLM's integrated speculative-decoding draft (Phase 17 · 05) |
| Disaggregated serving | "split prefill/decode" | Prefill and decode on separate GPU pools; KV transferred over NVLink/IB |
| All-to-all | "MoE expert comm" | Communication pattern routing tokens to expert GPUs; NVLink 5 cuts 3x |
| InferenceX | "SemiAnalysis inference bench" | The 2026 industry-accepted cost-per-token benchmark |

## 进一步阅读

- [NVIDIA — Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) 2026年4月MLPerf结果.
- [NVIDIA — MoE Inference on Blackwell](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/) NVLink 5 全面和MoE核.
- [TensorRT-LLM Overview](https://nvidia.github.io/TensorRT-LLM/overview.html)官方发动机文件.
- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)在TRT-LLM以上的分类配乐.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/)发布黑数字的基准数据集.
