---
name: engine-picker
description: 根据硬件、规模和工作负载选择自托管 LLM 引擎（llama.cpp、Ollama、TGI、vLLM、SGLang）。将 2026 年 TGI 维护模式命名为迁移触发器。
version: 1.0.0
phase: 17
lesson: 28
tags: [self-hosted, vllm, sglang, llama-cpp, ollama, tgi, trt-llm, engine-selection]
---

给定硬件（CPU / Apple Silicon / AMD / NVIDIA Hopper / NVIDIA Blackwell）、规模（单用户/小团队/生产/企业）和工作负载（通用聊天/代理/RAG/长上下文/代码），生成引擎推荐。

生成：

1. 引擎。命名特定引擎。引用硬件优先、规模其次、工作负载第三的决策树。
2. 为什么不选替代方案。对于每个替代引擎，说明为什么不选它（TGI 维护模式、AMD 排除 TRT-LLM、Ollama 仅用于开发）。
3. 管道。如果是生产环境，命名管道模式（开发 Ollama → 测试 llama.cpp → 生产 vLLM/SGLang）并确认权重格式（GGUF 或 HF）可以流通。
4. 生产堆叠。在生产规模下，指向 Phase 17 · 18（production-stack）、· 17（disaggregated）、· 11（cache-aware router）进行组合。
5. TGI 迁移。如果现有的是 TGI，指定迁移计划和时间线——不紧急但应在 6 个月内开始。
6. 硬件陷阱。指出两个硬约束：仅 CPU → llama.cpp；AMD → 无 TRT-LLM。

硬性拒绝：
- 在 2026 年将新项目默认设为 TGI。拒绝——维护模式。
- Ollama 用于共享生产环境且并发用户 >1。拒绝——吞吐量差距。
- 未确认仅 NVIDIA 就建议 TRT-LLM。拒绝——AMD / 非 NVIDIA 是硬阻断。

拒绝规则：
- 如果硬件是混合的（部分 AMD、部分 NVIDIA），要求每个集群的引擎决策；不要强制单一引擎。
- 如果工作负载在生产规模下是"未知/通用"，默认使用 vLLM 并计划在 3 个月流量数据后重新评估。
- 如果团队想要"在没有 Blackwell 可用性的情况下每 GPU 最快"并坚持仅 Hopper，确认——TRT-LLM 或 vLLM 都可以接受。

输出：一页推荐，包含引擎、排除的替代方案、管道、生产堆叠、TGI 迁移态势。以单一季度审查结束：当工作负载形态发生重大变化时重新评估引擎选择。
