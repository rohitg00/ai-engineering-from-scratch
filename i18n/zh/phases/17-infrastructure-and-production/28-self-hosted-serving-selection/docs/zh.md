# 自托管服务引擎选型 — 将推理引擎匹配到硬件与规模

> 引擎选型是硬件、规模和生态的函数，而不是看排行榜。2026 年主导自托管推理的四个引擎是：llama.cpp、Ollama、vLLM、SGLang，TGI 处于维护模式落后其后。**llama.cpp** 在 CPU 上最快 — 模型支持最广，可完全控制量化与线程。**Ollama** 是开发笔记本上的一键安装方案，比 llama.cpp 慢约 15-30%（Go + CGo + HTTP 序列化），在生产级负载下吞吐量差距达 3 倍。**TGI 于 2025 年 12 月 11 日进入维护模式** — 只修复 bug，原始吞吐量比 vLLM 慢约 10%，但历来拥有顶尖的可观测性和 HF 生态集成。这种维护状态使其成为有风险的长期选择 — 对新项目而言，SGLang 或 vLLM 是更安全的默认选项。**vLLM** 是通用生产环境默认选择 — v0.15.1（2026 年 2 月）增加了 PyTorch 2.10、RTX Blackwell SM120、H200 优化。**SGLang** 是 agentic 多轮 / 前缀密集型场景的专家 — 生产环境中拥有 400,000+ GPU（xAI、LinkedIn、Cursor、Oracle、GCP、Azure、AWS）。硬件约束：CPU 优先 → llama.cpp。AMD / 非 NVIDIA → vLLM 是支持最完善的路径（TRT-LLM 被锁定在 NVIDIA）。2026 年的流水线模式：开发 = Ollama，预发布 = llama.cpp，生产 = vLLM 或 SGLang。各引擎使用不同的权重格式 — llama.cpp 系列用 GGUF，GPU 引擎用 HF safetensors — 因此阶段之间可能需要一次格式转换。

**Type:** Learn
**Languages:** Python（标准库、引擎决策树遍历器）
**Prerequisites:** Phase 17 中所有关于引擎的课程（04、06、07、09、18）
**Time:** 约 45 分钟

## 学习目标

- 在给定硬件（CPU / AMD / NVIDIA Hopper / Blackwell）、规模（1 用户 / 100 / 10,000）和工作负载（通用聊天 / 智能体 / 长上下文）的情况下选择引擎。
- 说出 2026 年 TGI 维护模式状态（2025 年 12 月 11 日）及其为何促使新项目偏向 vLLM 或 SGLang。
- 描述开发/预发布/生产流水线，包括 GGUF 到 safetensors 的格式转换位于哪些阶段之间。
- 解释为什么“CPU 优先”指向 llama.cpp，以及为什么“AMD”排除 TRT-LLM。

## 问题

你的团队启动一个新的自托管 LLM 项目。一位工程师说用 Ollama，另一位说用 vLLM，第三位说“TGI 不是开箱即用吗？”三种说法在各自场景下都对，但没有任何一种在所有场景下都适用。

在 2026 年，选择树很重要：硬件第一，规模第二，工作负载第三。而 2025 年的一个特定事件 — TGI 于 12 月 11 日进入维护模式 — 改变了新项目的默认选择。

## 概念

### 五个引擎

| 引擎 | 最适合 | 说明 |
|--------|----------|-------|
| **llama.cpp** | CPU / 边缘设备 / 最小依赖 / 最广的模型支持 | CPU 上最快，完全可控 |
| **Ollama** | 开发笔记本、单用户、一键安装 | 比 llama.cpp 慢 15-30%；生产吞吐量差距 3 倍 |
| **TGI** | HF 生态、受监管行业 | **2025 年 12 月 11 日进入维护模式** |
| **vLLM** | 通用生产环境、100+ 用户 | 广泛的生产默认选择；v0.15.1 2026 年 2 月 |
| **SGLang** | Agentic 多轮、前缀密集型工作负载 | 生产环境中 400,000+ GPU |

### 硬件优先决策

**CPU 优先** → llama.cpp。Ollama 也可用但更慢。其他引擎在 CPU 上均无竞争力。

**AMD GPU** → vLLM 是支持最完善的路径（AMD ROCm 支持）。SGLang 也可用。TRT-LLM 被锁定在 NVIDIA，因此排除。

**NVIDIA Hopper（H100 / H200）** → vLLM、SGLang 或 TRT-LLM。三者均为顶级。

**NVIDIA Blackwell（B200 / GB200）** → TRT-LLM 是吞吐量领先者（Phase 17 · 07）。vLLM 和 SGLang 紧随其后。

**Apple Silicon（M 系列）** → llama.cpp（Metal）。Ollama 是对它的封装。

### 规模第二决策

**1 用户 / 本地开发** → Ollama。一条命令，首 token 秒级返回。

**10-100 用户 / 小型团队** → vLLM 单 GPU。

**100-10k 用户 / 生产环境** → vLLM production-stack（Phase 17 · 18）或 SGLang。

**10k+ 用户 / 企业级** → vLLM production-stack + 分离式部署（Phase 17 · 17）+ LMCache（Phase 17 · 18）。

### 工作负载第三决策

**通用聊天 / 问答** → vLLM 是广泛的默认赢家。

**Agentic 多轮（工具、规划、记忆）** → SGLang 的 RadixAttention（Phase 17 · 06）占优。

**前缀高度复用的 RAG** → SGLang。

**代码生成** → vLLM 即可；SGLang 在缓存方面略优。

**长上下文（128K+）** → vLLM + 分块预填充；SGLang + 分层 KV。

### TGI 维护陷阱

Hugging Face TGI 于 2025 年 12 月 11 日进入维护模式 — 此后仅修复 bug。历史上：顶尖的可观测性、一流的 HF 生态集成（模型卡、安全工具），原始吞吐量略落后于 vLLM。

对于 2026 年的新项目：默认避开 TGI。已有的 TGI 部署可以继续，但最终应迁移。SGLang 和 vLLM 是更安全的默认选择。

### 流水线模式

开发（Ollama）→ 预发布（llama.cpp）→ 生产（vLLM）。各引擎使用不同的权重格式 — llama.cpp 系列用 GGUF，GPU 引擎用 HF safetensors — 因此阶段之间可能需要一次格式转换。工程师在笔记本上快速迭代；预发布环境镜像生产的量化配置；生产环境是实际服务目标。

### Ollama 注意事项

Ollama 非常适合开发。但不适合共享生产环境：Go HTTP 序列化带来开销，并发管理比 vLLM 简单，OpenTelemetry 支持滞后。在 Ollama 擅长的场景使用它 — 单用户、一条命令 — 共享场景则切换到 vLLM。

### 自托管 vs 托管是另一个独立决策

Phase 17 · 01（托管超大规模云）和 · 02（推理平台）介绍托管方案。本课假设你已经决定自托管。自托管的理由：数据驻留、自定义微调、规模化下的总拥有成本、托管平台上没有的领域模型。

### 应该记住的数字

- TGI 维护模式：2025 年 12 月 11 日。
- vLLM v0.15.1：2026 年 2 月；PyTorch 2.10；Blackwell SM120 支持。
- SGLang 生产足迹：400,000+ GPU。
- Ollama 相对 llama.cpp 的吞吐量差距：慢 15-30%；生产负载下差距 3 倍。

```figure
data-parallel
```

## 动手实践

`code/main.py` 是一个决策树遍历器：给定硬件 + 规模 + 工作负载，选出引擎并解释原因。

## 交付

本课产出 `outputs/skill-engine-picker.md`。给定约束条件，选出引擎并撰写迁移计划。

## 练习

1. 用你的硬件 / 规模 / 工作负载运行 `code/main.py`。输出是否符合你的直觉？
2. 你的基础设施是 12 块 H100 和 8 块 MI300X AMD。选什么引擎？为什么 TRT-LLM 不可行？
3. 一个团队想在 2026 年使用 TGI，理由是“我们熟悉它”。请论证迁移的理由。
4. 从 Ollama 开发环境到 vLLM 生产环境：量化、配置和可观测性方面有哪些变化？
5. 一个 RAG 产品，P99 前缀长度 8K 且租户间高度复用。选择一个引擎并结合 Phase 17 · 11 + 18 搭建技术栈。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| llama.cpp | “CPU 那个” | 模型支持最广，CPU 上最快 |
| Ollama | “笔记本那个” | 一键安装，开发级吞吐量 |
| TGI | “HF 的服务” | 自 2025 年 12 月起进入维护模式 |
| vLLM | “默认那个” | 2026 年广泛的生产基线 |
| SGLang | “agentic 那个” | 前缀密集型，RadixAttention |
| TRT-LLM | “NVIDIA 专属” | Blackwell 吞吐量领先者，仅限 NVIDIA |
| GGUF | “llama.cpp 格式” | 打包的 K-quant 变体 |
| Production-stack | “vLLM K8s” | Phase 17 · 18 参考部署 |
| 流水线模式 | “dev→stage→prod” | Ollama → llama.cpp → vLLM；各引擎权重格式不同 |

## 延伸阅读

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI 维护模式公告](https://github.com/huggingface/text-generation-inference) — 发布说明。
- [vLLM v0.15.1 发布说明](https://github.com/vllm-project/vllm/releases)