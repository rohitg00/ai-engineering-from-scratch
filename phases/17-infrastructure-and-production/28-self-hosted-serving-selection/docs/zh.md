# 自托管 Serving 选择 —— llama.cpp、Ollama、TGI、vLLM、SGLang

> 2026 年，四款引擎主导自托管推理。根据硬件、规模和生态系统选择。**llama.cpp** 是 CPU 上最快的 —— 最广泛的模型支持，完全控制量化和线程。**Ollama** 是开发笔记本上的一键安装，比 llama.cpp 慢约 15–30%（Go + CGo + HTTP 序列化），在生产级负载下吞吐量差距达 3 倍。**TGI 于 2025 年 12 月 11 日进入维护模式** —— 仅修复 bug，原始吞吐量比 vLLM 慢约 10%，但历史上可观测性和 HF 生态系统集成最佳。维护状态使其成为长期高风险选择 —— 新项目更安全的选择是 SGLang 或 vLLM。**vLLM** 是通用生产默认 —— v0.15.1（2026 年 2 月）新增 PyTorch 2.10、RTX Blackwell SM120、H200 优化。**SGLang** 是智能体多轮 / 前缀密集型场景的专家 —— 生产环境部署超过 400,000 块 GPU（xAI、LinkedIn、Cursor、Oracle、GCP、Azure、AWS）。硬件限制：仅 CPU → 只有 llama.cpp。AMD / 非 NVIDIA → 只有 vLLM（TRT-LLM 锁定 NVIDIA）。2026 年流水线模式：开发 = Ollama，staging = llama.cpp，生产 = vLLM 或 SGLang。全程使用相同的 GGUF/HF 权重。

**类型：** 学习
**语言：** Python（标准库，引擎决策树遍历器）
**前置知识：** 第 17 阶段所有涉及引擎的课程（04、06、07、09、18）
**时间：** ~45 分钟

## 学习目标

- 根据硬件（CPU / AMD / NVIDIA Hopper / Blackwell）、规模（1 用户 / 100 / 10,000）和工作负载（通用聊天 / 智能体 / 长上下文）选择引擎。
- 说出 2026 年 TGI 维护模式状态（2025 年 12 月 11 日）以及为何它使新项目偏向 vLLM 或 SGLang。
- 描述使用相同 GGUF 或 HF 权重的开发/staging/生产流水线。
- 解释为何"仅 CPU"强制使用 llama.cpp，以及"AMD"排除 TRT-LLM。

## 问题背景

你的团队启动一个新的自托管 LLM 项目。一位工程师说 Ollama，另一位说 vLLM，第三位说"TGI 不是开箱即用吗？"三种说法在不同情境下都对。没有一种在所有情境下都对。

2026 年的选择树很重要：硬件第一，规模第二，工作负载第三。还有一个具体的 2025 年事件 —— TGI 于 12 月 11 日进入维护模式 —— 改变了新项目的默认选择。

## 核心概念

### 五款引擎

| 引擎 | 最佳场景 | 备注 |
|------|---------|------|
| **llama.cpp** | CPU / 边缘 / 最小依赖 / 最广泛模型支持 | CPU 上最快，完全控制 |
| **Ollama** | 开发笔记本、单用户、一键安装 | 比 llama.cpp 慢 15–30%；生产吞吐量差距 3 倍 |
| **TGI** | HF 生态系统、受监管行业 | **2025 年 12 月 11 日起维护模式** |
| **vLLM** | 通用生产、100+ 用户 | 广泛生产默认；v0.15.1 2026 年 2 月 |
| **SGLang** | 智能体多轮、前缀密集型工作负载 | 生产环境超过 400,000 块 GPU |

### 硬件优先决策

**仅 CPU** → llama.cpp。Ollama 也能用但更慢。其他引擎在 CPU 上没有竞争力。

**AMD GPU** → vLLM（AMD ROCm 支持）。SGLang 也支持。TRT-LLM 锁定 NVIDIA，排除。

**NVIDIA Hopper（H100 / H200）** → vLLM 或 SGLang 或 TRT-LLM。三者都是顶级。

**NVIDIA Blackwell（B200 / GB200）** → TRT-LLM 是吞吐量领导者（第 17 阶段 · 07）。vLLM 和 SGLang 紧随其后。

**Apple Silicon（M 系列）** → llama.cpp（Metal）。Ollama 封装了它。

### 规模其次决策

**1 用户 / 本地开发** → Ollama。一条命令，首 token 秒级响应。

**10–100 用户 / 小团队** → vLLM 单 GPU。

**100–10k 用户 / 生产** → vLLM production-stack（第 17 阶段 · 18）或 SGLang。

**10k+ 用户 / 企业** → vLLM production-stack + 分离式（第 17 阶段 · 17）+ LMCache（第 17 阶段 · 18）。

### 工作负载第三决策

**通用聊天 / 问答** → vLLM 以广泛默认取胜。

**智能体多轮（工具、规划、记忆）** → SGLang 的 RadixAttention（第 17 阶段 · 06）主导。

**RAG 大量前缀复用** → SGLang。

**代码生成** → vLLM 不错；SGLang 在缓存上略优。

**长上下文（128K+）** → vLLM + 分块预填充；SGLang + 分层 KV。

### TGI 维护陷阱

Hugging Face TGI 于 2025 年 12 月 11 日进入维护模式 —— 此后仅修复 bug。历史上：顶级可观测性、最佳 HF 生态系统集成（模型卡、安全工具）、原始吞吐量略低于 vLLM。

2026 年新项目的默认选择：远离 TGI。现有 TGI 部署可以继续，但应计划迁移。SGLang 和 vLLM 是更安全的选择。

### 流水线模式

开发（Ollama）→ staging（llama.cpp）→ 生产（vLLM）。全程使用相同的 GGUF 或 HF 权重。工程师在笔记本上快速迭代；staging 镜像生产量化；生产是 serving 目标。

### Ollama 注意事项

Ollama 适合开发。不适合共享生产环境：Go HTTP 序列化增加开销，并发管理比 vLLM 简单，OpenTelemetry 支持滞后。在 Ollama 擅长的场景使用 —— 单用户、一条命令 —— 共享环境切换到 vLLM。

### 自托管 vs 托管是另一个决策

第 17 阶段 · 01（托管超大规模厂商）、· 02（推理平台）涵盖托管。本课假设你已决定自托管。自托管原因：数据驻留、自定义微调、规模上的总拥有成本、托管平台没有的领域模型。

### 需要记住的数字

- TGI 维护模式：2025 年 12 月 11 日。
- vLLM v0.15.1：2026 年 2 月；PyTorch 2.10；Blackwell SM120 支持。
- SGLang 生产部署规模：400,000+ GPU。
- Ollama 与 llama.cpp 吞吐量差距：慢 15–30%；生产负载下 3 倍。

## 使用

`code/main.py` 是一个决策树遍历器：给定硬件 + 规模 + 工作负载，选择引擎并解释原因。

## 交付

本课产出 `outputs/skill-engine-picker.md`。给定约束条件，选择引擎并编写迁移计划。

## 练习

1. 用你的硬件 / 规模 / 工作负载运行 `code/main.py`。输出是否符合直觉？
2. 你的基础设施是 12 块 H100 和 8 块 MI300X AMD。选什么引擎？为什么 TRT-LLM 被排除？
3. 一个团队想在 2026 年使用 TGI，因为"我们熟悉它"。论证迁移理由。
4. Ollama 开发到 vLLM 生产：量化、配置和可观测性方面有什么变化？
5. RAG 产品，P99 前缀长度 8K，跨租户高复用。选择引擎并叠加第 17 阶段 · 11 + 18。

## 关键术语

| 术语 | 业界说法 | 实际含义 |
|------|---------|---------|
| llama.cpp | "the CPU one" | 最广泛模型支持，CPU 上最快 |
| Ollama | "the laptop one" | 一键安装，开发级吞吐量 |
| TGI | "HF's serving" | 2025 年 12 月起维护模式 |
| vLLM | "the default" | 2026 年广泛生产基线 |
| SGLang | "the agentic one" | 前缀密集型，RadixAttention |
| TRT-LLM | "NVIDIA-locked" | Blackwell 吞吐量领导者，仅 NVIDIA |
| GGUF | "llama.cpp format" | 打包的 K-quant 变体 |
| Production-stack | "vLLM K8s" | 第 17 阶段 · 18 参考部署 |
| Pipeline pattern | "dev→stage→prod" | 相同权重下 Ollama → llama.cpp → vLLM |

## 延伸阅读

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference) —— 发布说明。
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases)
