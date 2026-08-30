---
name: inference-optimizer
description: 为新的推理部署选择注意力实现、KV 缓存策略、量化和推测解码。
version: 1.0.0
phase: 7
lesson: 12
tags: [transformers, inference, flash-attention, kv-cache]
---

给定一个推理部署（模型名称 + 参数、目标硬件、并发数、最大上下文长度、延迟 SLO、吞吐量目标），输出：

1. 服务堆栈。vLLM（生产默认）、SGLang（每 token 最低延迟）、TensorRT-LLM（NVIDIA 最优）、llama.cpp（边缘/CPU）、MLX（Apple 芯片）。一句话说明原因。
2. 注意力实现。Flash Attention 2（Ampere/Ada 默认）、Flash Attention 3（Hopper）、Flash Attention 4（Blackwell，仅前向）。指定回退方案。
3. KV 缓存。Dtype（fp16 默认，如支持则 fp8）、分页 vs 连续、前缀缓存开/关、并行采样的共享 KV。
4. 量化。fp16 / bf16（默认）、int8（仅权重）、AWQ / GPTQ / GGUF 用于权重。仅在经过基准测试时才进行激活量化。
5. 额外加速。推测解码（EAGLE 2 / Medusa / 草稿模型）、连续批处理（始终开启）、分块预填充（长提示工作负载）、如果提示重复则启用前缀缓存。

拒绝为训练部署 Flash Attention 4——它在发布时仅支持前向。拒绝在没有对目标任务进行质量影响基准测试的情况下推荐 fp8 KV 缓存。标记任何 70B+ 模型在没有 GQA 的情况下在 32K+ 上下文时具有无法管理的 KV 缓存。要求前缀缓存在任何具有重复系统提示的代理/工具调用部署中开启。
