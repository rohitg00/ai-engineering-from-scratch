# 自托管推理引擎选型——llama.cpp、Ollama、TGI、vLLM、SGLang

> 2026 年，四大引擎主导自托管推理场景。选择依据依次为：硬件、规模、生态。**llama.cpp** 在 CPU 上最快——模型支持最广泛，对量化与线程调度拥有完全控制权。**Ollama** 是开发者笔记本上一条命令即可安装的选择，比 llama.cpp 慢约 15–30%（Go + CGo + HTTP 序列化开销），在生产级负载下吞吐量差距可达 3 倍。**TGI 于 2025 年 12 月 11 日进入维护模式**——仅接受 bug 修复，原始吞吐量比 vLLM 慢约 10%，但历史上拥有顶尖的可观测性与 HuggingFace 生态集成能力。该维护状态使其成为长期押注的高风险选项——新项目更安全的默认选择是 SGLang 或 vLLM。**vLLM** 是通用生产环境的默认引擎——v0.15.1（2026 年 2 月）新增 PyTorch 2.10、RTX Blackwell SM120、H200 优化。**SGLang** 是智能体多轮交互/前缀密集型场景的专家——已在 400,000+ GPU 上投入生产（xAI、LinkedIn、Cursor、Oracle、GCP、Azure、AWS）。硬件约束：仅 CPU → 只能选 llama.cpp。AMD / 非 NVIDIA → 只能选 vLLM（TRT-LLM 被 NVIDIA 锁定）。2026 年流水线模式：开发 = Ollama，预发布 = llama.cpp，生产 = vLLM 或 SGLang。全程使用同一套 GGUF/HF 权重。

**类型：** 学习
**语言：** Python（标准库，引擎决策树遍历）
**前置要求：** 第 17 阶段所有涉及引擎的课程（04、06、07、09、18）
**时间：** 约 45 分钟

## 学习目标

- 根据硬件（CPU / AMD / NVIDIA Hopper / Blackwell）、规模（1 用户 / 100 / 10,000）和工作负载（通用聊天 / 智能体 / 长上下文）选择合适的引擎。
- 说明 2026 年 TGI 处于维护模式（2025 年 12 月 11 日）这一状态，以及它为何使新项目倾向于选择 vLLM 或 SGLang。
- 描述使用同一套 GGUF 或 HF 权重的开发/预发布/生产流水线模式。
- 解释为何"仅 CPU"强制选择 llama.cpp，而"AMD"排除 TRT-LLM。

## 问题

你的团队启动了一个新的自托管 LLM 项目。一位工程师说用 Ollama，另一位说用 vLLM，第三位说"TGI 不是开箱即用吗？"。三种说法在不同的上下文中都是对的。但没有一种适用于所有场景。

在 2026 年，选型的决策树至关重要：硬件优先，规模次之，工作负载第三。而 2025 年的一个特定事件——TGI 于 12 月 11 日进入维护模式——改变了新项目的默认选择。

## 核心概念

### 五大引擎

| 引擎 | 最适合场景 | 说明 |
|--------|----------|-------|
| **llama.cpp** | CPU / 边缘设备 / 最小依赖 / 最广泛模型支持 | CPU 上最快，完全控制权 |
| **Ollama** | 开发者笔记本、单用户、一条命令安装 | 比 llama.cpp 慢 15–30%；生产负载下吞吐量差距 3 倍 |
| **TGI** | HF 生态、受监管行业 | **2025 年 12 月 11 日起进入维护模式** |
| **vLLM** | 通用生产环境、100+ 用户 | 广泛的生产默认选择；v0.15.1 于 2026 年 2 月发布 |
| **SGLang** | 智能体多轮交互、前缀密集型工作负载 | 已在 400,000+ GPU 上投入生产 |

### 硬件优先决策

**仅 CPU** → llama.cpp。Ollama 也可用但更慢。其他引擎在 CPU 上没有竞争力。

**AMD GPU** → vLLM（支持 AMD ROCm）。SGLang 也可用。TRT-LLM 被 NVIDIA 锁定，因此排除。

**NVIDIA Hopper（H100 / H200）** → vLLM 或 SGLang 或 TRT-LLM。三者均为顶级选择。

**NVIDIA Blackwell（B200 / GB200）** → TRT-LLM 是吞吐量领导者（第 17 阶段 · 07）。vLLM 和 SGLang 紧随其后。

**Apple Silicon（M 系列）** → llama.cpp（Metal 后端）。Ollama 是对其的封装。

### 规模次之决策

**1 用户 / 本地开发** → Ollama。一条命令，数秒内输出第一个 token。

**10–100 用户 / 小团队** → vLLM 单 GPU。

**100–10k 用户 / 生产环境** → vLLM 生产栈（第 17 阶段 · 18）或 SGLang。

**10k+ 用户 / 企业级** → vLLM 生产栈 + 分离式部署（第 17 阶段 · 17）+ LMCache（第 17 阶段 · 18）。

### 工作负载第三决策

**通用聊天 / Q&A** → vLLM 凭借广泛的默认能力胜出。

**智能体多轮交互（工具、规划、记忆）** → SGLang 的 RadixAttention（第 17 阶段 · 06）占据主导。

**高前缀复用的 RAG** → SGLang。

**代码生成** → vLLM 表现良好；SGLang 在缓存方面略优。

**长上下文（128K+）** → vLLM + 分块预填充（chunked prefill）；SGLang + 分层 KV（tiered KV）。

### TGI 维护陷阱

Hugging Face TGI 于 2025 年 12 月 11 日进入维护模式——此后仅接受 bug 修复。历史评价：顶尖的可观测性，最佳的 HF 生态集成能力（模型卡片、安全工具），原始吞吐量略低于 vLLM。

对 2026 年的新项目：默认避开 TGI。现有的 TGI 部署可以继续运行，但最终应进行迁移。SGLang 和 vLLM 是更安全的默认选择。

### 流水线模式

开发（Ollama）→ 预发布（llama.cpp）→ 生产（vLLM）。全程使用同一套 GGUF 或 HF 权重。工程师在笔记本上快速迭代；预发布环境镜像生产量化方案；生产环境是最终推理服务目标。

### Ollama 注意事项

Ollama 非常适合开发环境。但它不适合共享生产环境：Go HTTP 序列化带来额外开销，并发管理比 vLLM 简单，OpenTelemetry 支持滞后。在它擅长的场景使用 Ollama——单用户、一条命令——并在共享环境中切换到 vLLM。

### 自托管与托管是独立的决策

第 17 阶段 · 01（托管超大规模云服务商）、· 02（推理平台）涵盖了托管方案。本课假设你已经决定自托管。自托管的理由包括：数据驻留要求、自定义微调、大规模下的总体拥有成本、托管平台未提供的领域模型。

### 你应该记住的数字

- TGI 维护模式：2025 年 12 月 11 日。
- vLLM v0.15.1：2026 年 2 月；支持 PyTorch 2.10、Blackwell SM120。
- SGLang 生产部署规模：400,000+ GPU。
- Ollama 与 llama.cpp 的吞吐量差距：慢 15–30%；生产负载下差距达 3 倍。

```figure
data-parallel
```

## 使用它

`code/main.py` 是一个决策树遍历器：给定硬件 + 规模 + 工作负载，选择一个引擎并解释原因。

## 交付

本课程产出 `outputs/skill-engine-picker.md`。根据给定的约束条件，选择一个引擎并编写迁移计划。

## 练习

1. 用你的硬件/规模/工作负载运行 `code/main.py`。输出结果是否符合你的直觉？
2. 你的基础设施有 12 块 H100 和 8 块 MI300X AMD。选什么引擎？为什么 TRT-LLM 被排除？
3. 一个团队希望在 2026 年继续使用 TGI，理由是"这是我们熟悉的工具"。请论证迁移的理由。
4. 从 Ollama 开发环境到 vLLM 生产环境：量化、配置和可观测性方面会发生哪些变化？
5. 一个 RAG 产品，P99 前缀长度为 8K，且跨租户复用率高。选择引擎并与第 17 阶段 · 11 + 18 组合部署。

## 关键术语

| 术语 | 人们通常说 | 实际含义 |
|------|----------------|------------------------|
| llama.cpp | "那个 CPU 上的" | 最广泛的模型支持，CPU 上最快 |
| Ollama | "那个笔记本上的" | 一条命令安装，开发级吞吐量 |
| TGI | "HF 的推理服务" | 自 2025 年 12 月起进入维护模式 |
| vLLM | "默认选择" | 2026 年广泛的生产环境基线 |
| SGLang | "那个智能体专用的" | 前缀密集型，RadixAttention |
| TRT-LLM | "NVIDIA 锁定" | Blackwell 吞吐量领先者，仅限 NVIDIA |
| GGUF | "llama.cpp 格式" | 打包的 K-quant 变体 |
| 生产栈 | "vLLM 在 K8s 上" | 第 17 阶段 · 18 参考部署 |
| 流水线模式 | "开发→预发布→生产" | 同一套权重上的 Ollama → llama.cpp → vLLM |

## 延伸阅读

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference) — 发布说明。
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases)
