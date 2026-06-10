# 28 · 自建推理引擎选型——llama.cpp、Ollama、TGI、vLLM、SGLang

> 2026 年自建推理领域由四个引擎统治。根据硬件、规模与生态做选择。**llama.cpp** 在 CPU 上最快——模型兼容性最广,量化和线程控制力最强。**Ollama** 是开发者笔记本的一条命令安装方案,比 llama.cpp 慢约 15–30%（Go + CGo + HTTP 序列化开销）,在类生产负载下吞吐量有 3 倍差距。**TGI 于 2025 年 12 月 11 日进入维护模式**——仅修复 Bug,裸吞吐约比 vLLM 慢 ~10%,但在历史上拥有顶级的可观测性和 HF 生态集成。维护模式使其成为长期的存续风险——SGLang 或 vLLM 是更安全的新项目默认选项。**vLLM** 是通用生产环境基准——v0.15.1（2026 年 2 月）新增 PyTorch 2.10、RTX Blackwell SM120、H200 优化。**SGLang** 擅长智能体型多轮 / 前缀密集型负载——400,000+ GPU 运行于生产环境（xAI、LinkedIn、Cursor、Oracle、GCP、Azure、AWS）。硬件约束：仅 CPU → 只能选 llama.cpp。AMD / 非 NVIDIA → 仅 vLLM（TRT-LLM 锁定 NVIDIA）。2026 年流水线模式：dev = Ollama,staging = llama.cpp,生产 = vLLM 或 SGLang。从头到尾使用相同的 GGUF 或 HF 权重。

**类型：** 学习
**语言：** Python
**前置：** Phase 17 中所有涉及引擎的课（04、06、07、09、18）
**时长：** 约 45 分钟

## 学习目标

- 在给定硬件（CPU / AMD / NVIDIA Hopper / Blackwell）、规模（1 用户 / 100 / 10,000）和工作负载（通用聊天 / 智能体 / 长上下文）的前提下选择引擎。
- 指出 TGI 在 2026 年处于维护模式（2025 年 12 月 11 日）,并解释它为何使新项目倾向于 vLLM 或 SGLang。
- 描述开发/预发布/生产流水线,从头到尾使用相同的 GGUF 或 HF 权重。
- 解释为什么"仅 CPU"迫使选择 llama.cpp,而"AMD"则排除 TRT-LLM。

## 问题所在

你的团队启动了一个新的自建 LLM 项目。一位工程师说用 Ollama,另一位说用 vLLM,第三位说"TGI 不就直接开箱即用？"三者在不同场景下都是正确答案,但没有任何一个在所有场景下都是正确答案。

在 2026 年,决策树很重要：硬件优先,规模其次,工作负载再次。而一个具体事件——TGI 于 2025 年 12 月 11 日进入维护模式——改变了新项目的默认选项。

## 核心概念

### 五大引擎

| 引擎 | 最佳场景 | 备注 |
|-|-|-|
| **llama.cpp** | CPU / 边缘 / 最少依赖 / 模型兼容性最广 | CPU 上最快,完全掌控 |
| **Ollama** | 开发笔记本,单用户,一条命令安装 | 比 llama.cpp 慢 15–30%;生产 3x 吞吐差距 |
| **TGI** | HF 生态,受监管行业 | **2025 年 12 月 11 日进入维护模式** |
| **vLLM** | 通用生产,100+ 用户 | 广泛的生产基准;2026 年 2 月 v0.15.1 |
| **SGLang** | 智能体型多轮,前缀密集型负载 | 400,000+ GPU 运行于生产环境 |

### 硬件优先决策

**仅 CPU** → llama.cpp。Ollama 也能用但更慢。其它引擎在 CPU 上都不具备竞争力。

**AMD GPU** → vLLM（AMD ROCm 支持）。SGLang 也可。TRT-LLM 锁定 NVIDIA,排除。

**NVIDIA Hopper（H100 / H200）** → vLLM、SGLang、TRT-LLM 三者均为顶级。

**NVIDIA Blackwell（B200 / GB200）** → TRT-LLM 是吞吐量领先者（Phase 17 · 07）。vLLM 与 SGLang 紧随其后。

**Apple Silicon（M 系列）** → llama.cpp（Metal）。Ollama 封装了此能力。

### 规模第二决策

**1 用户 / 本地开发** → Ollama。一条命令,数秒出第一个 Token。

**10–100 用户 / 小团队** → vLLM 单 GPU。

**100–10k 用户 / 生产** → vLLM 生产栈（Phase 17 · 18）或 SGLang。

**10k+ 用户 / 企业级** → vLLM 生产栈 + 分离式架构（Phase 17 · 17）+ LMCache（Phase 17 · 18）。

### 工作负载第三决策

**通用聊天 / 问答** → vLLM 在总体默认上胜出。

**智能体型多轮（工具使用、规划、记忆）** → SGLang 的 RadixAttention（Phase 17 · 06）领先。

**RAG 且前缀复用率很高** → SGLang。

**代码生成** → vLLM 足够好;SGLang 在缓存上略优。

**长上下文（128K+）** → vLLM + 分块预填充;SGLang + 分层 KV。

### TGI 维护模式陷阱

Hugging Face TGI 于 2025 年 12 月 11 日进入维护模式——后续仅修复 Bug。历史成绩：顶级可观测性,最佳的 HF 生态集成（模型卡片、安全工具）,裸吞吐略落后于 vLLM。

对于 2026 年的新项目：谨慎远离 TGI。已有 TGI 部署可以继续,但应最终计划迁移。SGLang 和 vLLM 是更安全的新项目默认选项。

### 流水线模式

开发（Ollama）→ 预发布（llama.cpp）→ 生产（vLLM）。从头到尾使用相同的 GGUF 或 HF 权重。工程师在笔记本上快速迭代;预发布环境镜像生产环境的量化;生产环境是最终的推理目标。

### Ollama 注意事项

Ollama 在开发中非常出色。但它不适合共享的生产环境：Go HTTP 序列化引入开销,并发管理比 vLLM 简单许多,OpenTelemetry 支持落后。把 Ollama 用在该用的地方——单用户,单命令——并在共享环境中切换到 vLLM。

### 自建 vs 托管是独立的决策

Phase 17 · 01（托管超大规模平台）、· 02（推理平台）覆盖托管方案。本课假定你已决定自建。自建的理由：数据驻留、自定义微调、规模下的总拥有成本、领域中不存在于托管平台的模型。

### 你应该记住的数字

- TGI 维护模式：2025 年 12 月 11 日。
- vLLM v0.15.1：2026 年 2 月;PyTorch 2.10;Blackwell SM120 支持。
- SGLang 生产规模：400,000+ GPU。
- Ollama 与 llama.cpp 的吞吐差距：慢 15–30%;生产压力下差 3×。

## 实际运用

`code/main.py` 是一次决策树演练：给定硬件 + 规模 + 工作负载,选出引擎并解释原因。

## 交付成果

本课产出 `outputs/skill-engine-picker.md`。给定约束,选出引擎并撰写迁移计划。

## 练习

1. 以你的硬件/规模/工作负载运行 `code/main.py`。输出与你的直觉一致吗？
2. 你的基础设施是 12 × H100 以及 8 × MI300X AMD。该选哪个引擎？为什么 TRT-LLM 被排除？
3. 一支团队想在 2026 年继续使用 TGI,因为"这是他们熟悉的"。阐述迁移的理由。
4. 从 Ollama 开发切换到 vLLM 生产：量化、配置、可观测性方面有哪些变化？
5. 一个 RAG 产品,P99 前缀长度 8K,且跨租户复用率极高。选出引擎,并与 Phase 17 · 11 + 18 做堆叠。

## 关键术语

| 术语 | 人们常这么说 | 实际含义 |
|-|-|-|
| llama.cpp | 「CPU 那个」 | 模型兼容性最广,CPU 上最快 |
| Ollama | 「笔记本那个」 | 一条命令安装,开发级吞吐量 |
| TGI | 「HF 的推理服务」 | 自 2025 年 12 月起维护模式 |
| vLLM | 「默认选项」 | 2026 年通用生产基准 |
| SGLang | 「面向智能体那个」 | 前缀密集,RadixAttention |
| TRT-LLM | 「锁定 NVIDIA」 | NVIDIA 上的 Blackwell 吞吐领先者 |
| GGUF | 「llama.cpp 格式」 | 绑定 K-quant 变体 |
| 生产栈 | 「vLLM on K8s」 | Phase 17 · 18 的参考部署 |
| 流水线模式 | 「开发→预发布→生产」 | 同一组权重,Ollama → llama.cpp → vLLM |

## 延伸阅读

- [AI Made Tools——vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph——llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai——LLM 推理引擎综合对比](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI——2026 年 10 款最佳 vLLM 替代品](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI 维护公告](https://github.com/huggingface/text-generation-inference)
- [vLLM v0.15.1 发布说明](https://github.com/vllm-project/vllm/releases)
