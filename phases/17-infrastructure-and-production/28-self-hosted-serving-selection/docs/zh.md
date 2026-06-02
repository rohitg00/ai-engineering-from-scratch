# 自托管推理引擎选型 — llama.cpp、Ollama、TGI、vLLM、SGLang

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年，自托管 inference（推理）由四大引擎主导。选哪个，要看硬件、规模和生态。**llama.cpp** 在 CPU 上最快——模型支持最广，对量化和线程有完全控制。**Ollama** 是开发笔记本上的一键安装方案，比 llama.cpp 慢 15-30%（Go + CGo + HTTP 序列化导致），在类生产负载下吞吐差距可达 3 倍。**TGI 在 2025 年 12 月 11 日进入维护模式**——只修 bug、不再加新功能，原始吞吐比 vLLM 慢约 10%，但历史上在可观测性和 HF 生态集成上一直是头部。维护状态意味着长期押注它有风险——新项目更安全的默认选择是 SGLang 或 vLLM。**vLLM** 是通用生产默认——v0.15.1（2026 年 2 月）加入了 PyTorch 2.10、RTX Blackwell SM120、H200 优化。**SGLang** 是 agentic（智能体）多轮对话 / 前缀重度场景的专家——生产环境部署超过 40 万张 GPU（xAI、LinkedIn、Cursor、Oracle、GCP、Azure、AWS）。硬件约束：纯 CPU → 只能 llama.cpp。AMD / 非 NVIDIA → 只能 vLLM（TRT-LLM 锁死 NVIDIA）。2026 年的流水线模式：dev = Ollama，staging = llama.cpp，prod = vLLM 或 SGLang。全程使用同一份 GGUF / HF 权重。

**Type:** Learn
**Languages:** Python（stdlib，引擎决策树 walker）
**Prerequisites:** Phase 17 中所有覆盖引擎的课程（04、06、07、09、18）
**Time:** ~45 分钟

## 学习目标（Learning Objectives）

- 在给定硬件（CPU / AMD / NVIDIA Hopper / Blackwell）、规模（1 用户 / 100 / 10,000）和工作负载（通用聊天 / agent / 长上下文）的前提下，选出一个引擎。
- 说出 2026 年 TGI 维护模式状态（2025 年 12 月 11 日），以及它为什么会让新项目偏向 vLLM 或 SGLang。
- 描述 dev/staging/prod 流水线如何在全程使用同一份 GGUF 或 HF 权重。
- 解释为什么"纯 CPU"必然选 llama.cpp，"AMD"必然排除 TRT-LLM。

## 问题（The Problem）

你的团队启动了一个新的自托管 LLM 项目。一个工程师说用 Ollama，另一个说用 vLLM，第三个说"TGI 不是开箱即用吗？"三个人都在自己的语境里是对的，但没有一个在所有语境里都对。

2026 年，选择树很关键：硬件优先，规模其次，工作负载第三。还有一个 2025 年的具体事件——TGI 在 12 月 11 日进入维护模式——改变了新项目的默认选择。

## 概念（The Concept）

### 五大引擎（The five engines）

| 引擎 | 最适合 | 备注 |
|--------|----------|-------|
| **llama.cpp** | CPU / 边缘 / 最少依赖 / 模型支持最广 | CPU 上最快，控制最完整 |
| **Ollama** | 开发笔记本、单用户、一键安装 | 比 llama.cpp 慢 15-30%；生产吞吐差 3 倍 |
| **TGI** | HF 生态、受监管行业 | **2025 年 12 月 11 日起维护模式** |
| **vLLM** | 通用生产、100+ 用户 | 广泛的生产默认；v0.15.1 2026 年 2 月 |
| **SGLang** | agentic 多轮对话、前缀重度负载 | 生产环境 40 万+ GPU |

### 硬件优先决策（Hardware-first decision）

**纯 CPU** → llama.cpp。Ollama 也能跑但更慢。其他引擎在 CPU 上没有竞争力。

**AMD GPU** → vLLM（AMD ROCm 支持）。SGLang 也行。TRT-LLM 锁死 NVIDIA，出局。

**NVIDIA Hopper（H100 / H200）** → vLLM 或 SGLang 或 TRT-LLM。三者都是顶级。

**NVIDIA Blackwell（B200 / GB200）** → TRT-LLM 是吞吐冠军（Phase 17 · 07）。vLLM 和 SGLang 紧随其后。

**Apple Silicon（M 系列）** → llama.cpp（Metal）。Ollama 在外面包了一层。

### 规模其次决策（Scale-second decision）

**1 用户 / 本地开发** → Ollama。一条命令，几秒出首 token。

**10-100 用户 / 小团队** → vLLM 单 GPU。

**100-10k 用户 / 生产** → vLLM production-stack（Phase 17 · 18）或 SGLang。

**10k+ 用户 / 企业级** → vLLM production-stack + disaggregated（Phase 17 · 17）+ LMCache（Phase 17 · 18）。

### 工作负载第三决策（Workload-third decision）

**通用聊天 / Q&A** → vLLM 在广义默认场景胜出。

**agentic 多轮（工具、规划、记忆）** → SGLang 的 RadixAttention（Phase 17 · 06）占优。

**前缀重度复用的 RAG** → SGLang。

**代码生成** → vLLM 够用；SGLang 在 cache 上略好。

**长上下文（128K+）** → vLLM + chunked prefill；SGLang + tiered KV。

### TGI 维护陷阱（The TGI maintenance trap）

Hugging Face TGI 在 2025 年 12 月 11 日进入维护模式——往后只修 bug。历史上：顶级可观测性、HF 生态集成最佳（model card、安全工具），原始吞吐略落后 vLLM。

2026 年的新项目：默认远离 TGI。现存的 TGI 部署可以继续，但最终应该迁移。SGLang 和 vLLM 是更安全的默认。

### 流水线模式（The pipeline pattern）

Dev（Ollama）→ staging（llama.cpp）→ prod（vLLM）。全程使用同一份 GGUF 或 HF 权重。工程师在笔记本上快速迭代；staging 镜像生产的量化；prod 是真正的服务目标。

### Ollama 注意事项（Ollama caveat）

Ollama 在 dev 阶段很棒。但在共享生产环境不行：Go 的 HTTP 序列化带来开销，并发管理比 vLLM 简单粗糙，OpenTelemetry 支持滞后。在它擅长的地方用它——单用户、单命令——共享场景切换到 vLLM。

### 自托管 vs 托管是另一个决策（Self-hosted vs managed is a separate decision）

Phase 17 · 01（托管 hyperscaler）、· 02（inference 平台）覆盖了托管方案。本课假设你已经决定要自托管。自托管的理由：数据驻留、定制 fine-tune（微调）、规模化下的总拥有成本、托管商上没有的领域模型。

### 你应该记住的数字（Numbers you should remember）

- TGI 维护模式：2025 年 12 月 11 日。
- vLLM v0.15.1：2026 年 2 月；PyTorch 2.10；Blackwell SM120 支持。
- SGLang 生产足迹：40 万+ GPU。
- Ollama 相对 llama.cpp 的吞吐差距：慢 15-30%；生产负载下慢 3 倍。

## 用起来（Use It）

`code/main.py` 是一个决策树 walker：给定硬件 + 规模 + 工作负载，选出引擎并解释原因。

## 上线部署（Ship It）

本课产出 `outputs/skill-engine-picker.md`。给定约束条件，选出引擎并写出迁移计划。

## 练习（Exercises）

1. 用你自己的硬件 / 规模 / 工作负载跑 `code/main.py`。输出与你的直觉吻合吗？
2. 你的基础设施是 12 张 H100 + 8 张 MI300X AMD。选什么引擎？为什么 TRT-LLM 不在桌上？
3. 一个团队想在 2026 年用 TGI，理由是"我们熟"。论证迁移的必要性。
4. 从 Ollama 开发到 vLLM 生产：量化、配置、可观测性各发生了什么变化？
5. RAG 产品，P99 前缀长度 8K，跨租户高复用。选一个引擎，并配合 Phase 17 · 11 + 18 搭配出技术栈。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|----------------|------------------------|
| llama.cpp | "那个 CPU 的" | 模型支持最广，CPU 上最快 |
| Ollama | "那个笔记本的" | 一键安装，开发级吞吐 |
| TGI | "HF 出的那个 serving" | 自 2025 年 12 月起维护模式 |
| vLLM | "默认那个" | 2026 年的广泛生产基线 |
| SGLang | "agentic 那个" | 前缀重度，RadixAttention |
| TRT-LLM | "锁 NVIDIA 那个" | Blackwell 吞吐冠军，仅 NVIDIA |
| GGUF | "llama.cpp 格式" | 打包多种 K-quant 变体 |
| Production-stack | "vLLM 的 K8s" | Phase 17 · 18 参考部署 |
| Pipeline pattern | "dev→stage→prod" | 同一份权重上 Ollama → llama.cpp → vLLM |

## 延伸阅读（Further Reading）

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference) — release notes。
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases)
