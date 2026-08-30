---
name: quantization-picker
description: 根据硬件、引擎、工作负载和质量容差选择 2026 量化格式，并制定校准 + 验证计划。
version: 1.0.0
phase: 17
lesson: 09
tags: [quantization, awq, gptq, gguf, fp8, nvfp4, calibration]
---

给定硬件（CPU / H100 / H200 / B200 / GB200，含数量）、引擎（llama.cpp / vLLM / TRT-LLM / SGLang）、模型（大小 + 任务类型——常规聊天 / 推理 / 代码 / multi-LoRA）和质量容差（可在 HumanEval / MATH / MMLU 上承受 N 分下降），选择量化格式并生成验证计划。

生成：

1. 格式推荐。以下之一：GGUF Q4_K_M、GGUF Q5_K_M、GPTQ-Int4 + Marlin、AWQ-Int4 + Marlin、FP8、NVFP4 + FP8 KV 或堆叠组合。通过决策树证明：CPU → GGUF；推理 → FP8；vLLM 上的 multi-LoRA → GPTQ；常规 GPU 聊天 → AWQ；Blackwell 验证 → NVFP4。
2. 内存预算。报告权重 + KV 缓存（在报告的并发 × 上下文下）+ 激活。确认是否适合目标 GPU，或指出多 GPU 需求。
3. 校准计划。数据集来源（AWQ/GPTQ 的领域匹配；作为最后手段的通用 C4/WikiText）。样本数量（领域 500-2000）。验证集（从校准池中留出 10%）。
4. 验证计划。与任务匹配的评估集：代码用 HumanEval，推理用 MATH/MMLU，聊天用 MT-Bench。基线 BF16 与量化对比。如果下降 ≤ 质量容差则发布。
5. KV 缓存决策。与权重量化分开。推理推荐 FP8 KV；如果注意力精度是边际的，推荐 BF16 KV；仅在验证后推荐 INT8 KV。
6. 回滚路径。在磁盘上保留 BF16/FP8 权重；标记如果生产质量下降则切换回来。

硬性拒绝：
- 未经过评估集验证就在推理密集型工作负载上推荐 NVFP4 权重。
- 在领域模型上使用通用网络数据进行校准。始终使用领域内数据。
- 在 HBM 预算中忘记 KV 缓存。始终逐项列出。
- 未命名内核就声称吞吐量数字（Marlin-AWQ 与 plain AWQ 相差 10 倍）。

拒绝规则：
- 如果工作负载本质上是质量边际的（开放式创意生成、边缘案例推理），拒绝激进的 INT4。保持 FP8 或 BF16。
- 如果引擎是 llama.cpp，拒绝 GGUF 以外的任何格式。格式与引擎匹配是基本要求。
- 如果用户无法运行 1,000 样本评估，拒绝。生产中没有盲目量化。

输出：一页量化选择，列出所选格式、HBM 预算、校准计划、验证计划、KV 缓存决策和回滚路径。以“接下来测量什么”段落结束，根据关键风险命名评估集 delta、峰值并发下的 KV 缓存压力或真实批次大小下的吞吐量之一。
