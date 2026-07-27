---
name: engine-picker
description: 根据硬件、规模和工作负载，选择自托管 LLM 引擎（llama.cpp、Ollama、TGI、vLLM、SGLang）。指明 2026 年 TGI 维护模式作为迁移触发条件。
version: 1.0.0
phase: 17
lesson: 28
tags: [self-hosted, vllm, sglang, llama-cpp, ollama, tgi, trt-llm, engine-selection]
---

给定硬件（CPU / Apple Silicon / AMD / NVIDIA Hopper / NVIDIA Blackwell）、规模（单用户/小团队/生产/企业）和工作负载（通用聊天/代理/RAG/长上下文/代码），生成引擎推荐。

输出：

1. **引擎**。指明确切的引擎。引用硬件优先、规模第二、工作负载第三的决策树。
2. **为何不是替代方案**。对于每个替代引擎，说明为何不是选择（TGI 维护模式、AMD 排除 TRT-LLM、Ollama 仅限开发）。
3. **管道**。如果生产，说明管道模式（开发 Ollama → 预发布 llama.cpp → 生产 vLLM/SGLang）并确认权重格式（GGUF 或 HF）贯穿始终。
4. **生产堆叠**。在生产规模下，指向阶段 17 · 18（生产栈）、· 17（分离式）、· 11（缓存感知路由器）以进行组合。
5. **TGI 迁移**。如果当前使用 TGI，指定迁移方案和时间线——不紧急但应在 6 个月内开始。
6. **硬件陷阱**。指出两个硬约束：仅 CPU → llama.cpp；AMD → 无 TRT-LLM。

**硬性拒绝条件：**
- 2026 年默认新项目使用 TGI。拒绝——维护模式。
- 在 >1 个并发用户的共享生产环境中使用 Ollama。拒绝——吞吐量差距。
- 建议使用 TRT-LLM 而未确认仅 NVIDIA。拒绝——AMD/非 NVIDIA 是硬性障碍。

**拒绝规则：**
- 如果硬件是混合的（部分 AMD、部分 NVIDIA），要求按集群的引擎决策；不要强制单一引擎。
- 如果工作负载在生产规模下是"未知/通用"，默认使用 vLLM 并在 3 个月流量数据后计划重新评估。
- 如果团队想要"每 GPU 最快但没有 Blackwell 可用性"且坚持仅 Hopper，确认——TRT-LLM 或 vLLM 均可接受。

**输出**：一页推荐，包含引擎、被排除的替代方案、管道、生产堆叠、TGI 迁移姿态。最后给出单一季度审查：当工作负载形态发生实质性变化时重新评估引擎选择。
