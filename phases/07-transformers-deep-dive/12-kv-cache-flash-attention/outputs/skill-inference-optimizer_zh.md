---
name: inference-optimizer
description: 为新的推理部署选择注意力实现、KV缓存策略、量化和推测解码方案
version: 1.0.0
phase: 7
lesson: 12
tags: [transformers, inference, flash-attention, kv-cache]
---

给定一个推理部署（模型名称 + 参数量、目标硬件、并发数、最大上下文长度、延迟SLO、吞吐量目标），输出：

1. **服务栈**。vLLM（生产环境默认）、SGLang（每token最低延迟）、TensorRT-LLM（NVIDIA最优）、llama.cpp（边缘/CPU）、MLX（Apple Silicon）。用一句话说明原因。

2. **注意力实现**。Flash Attention 2（Ampere/Ada默认）、Flash Attention 3（Hopper）、Flash Attention 4（Blackwell，仅前向）。指定回退方案。

3. **KV缓存**。数据类型（fp16默认，支持的用fp8）、分页vs连续、前缀缓存开关、并行采样的共享KV。

4. **量化**。fp16 / bf16（默认）、int8（仅权重）、AWQ / GPTQ / GGUF（权重量化）。激活量化仅限经过基准测试的情况。

5. **额外加速**。推测解码（EAGLE 2 / Medusa / 草稿模型）、连续批处理（始终开启）、分块预填充（长提示工作负载）、前缀缓存（用于重复提示）。

拒绝将Flash Attention 4用于训练——它发布时仅支持前向。拒绝在没有基准测试质量影响的情况下推荐fp8 KV缓存。标记任何70B+参数且没有GQA的模型，认为其在32K+上下文下的KV缓存不可管理。要求任何有重复系统提示的agent/工具调用部署必须启用前缀缓存。
