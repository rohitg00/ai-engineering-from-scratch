---
name: open-model-picker
description: 为给定部署目标选择开放的 LLM 系列、量化和推理堆栈。
version: 1.0.0
phase: 10
lesson: 14
tags: [open-models, llama, deepseek, mixtral, qwen, gemma, moe, gqa, mla, quantization]
---

给定部署目标（GPU 类型、每 GPU VRAM、GPU 数量、目标上下文长度、目标 p50/p99 延迟、峰值并发请求）和任务特征（聊天、代码、推理、长上下文检索、工具使用），推荐一个开放模型加 serving 堆栈，并对第 14 课的六个架构旋钮中的每一个给出明确推理。

生成：

1. **模型候选名单**。三个候选，每个包含总参数、活跃参数（考虑 MoE）、架构标志（归一化/激活/位置/注意力/MoE/上下文），以及它进入候选名单的单一原因。
2. **内存预算检查**。对于首选候选：BF16 下的权重内存和选定量化下的权重内存；目标批次大小下目标上下文的 KV cache；激活余量。如果权重 + KV cache + 激活超过可用 VRAM，停止推荐。
3. **量化选择**。GPTQ-4bit、AWQ-4bit、FP8 或 BF16。针对任务的精度敏感性论证（代码/数学/推理任务比聊天或检索受激进量化影响更大）。
4. **推理堆栈**。vLLM、TensorRT-LLM、SGLang 或 llama.cpp。针对以下方面论证：连续批处理需求、投机解码支持、量化格式兼容性，以及单节点 vs 多节点拓扑。
5. **吞吐量合理性检查**。基于 GPU 内存带宽（decode）和 TFLOPs（prefill）的 prefill token/秒 和 decode token/秒 估算。如果 decode 吞吐量低于目标并发用户下限，拒绝推荐。
6. **备选方案**。如果首选候选超过 VRAM 或吞吐量预算，选择第二选择。始终命名一个。

硬拒绝：
- 单张 24GB 消费级 GPU 上超过 30B 的稠密模型，无卸载或激进量化。
- 没有专家并行支持的 serving 堆栈上的 MoE 模型。
- 没有 GQA 或 MLA 的架构上的长上下文（128k+）（KV cache 爆炸）。
- 任何未命名特定模型修订版的推荐（例如，"Llama 3 8B Instruct v3.1"，而非"Llama 3"）。

输出：一页推荐，列出模型、量化、堆栈，每个决策都有编号证据。以"如果...值得重新考虑"段落结尾，命名会翻转选择的特定能力或部署参数。
