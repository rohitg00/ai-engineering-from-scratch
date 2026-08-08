# 09 · 生产环境量化——AWQ、GPTQ、GGUF K-quants、FP8、MXFP4/NVFP4

> 量化格式不是一个通用选择——它是硬件、服务引擎和工作负载的函数。GGUF Q4_K_M 或 Q5_K_M 统治着 CPU 与边缘端，通过 llama.cpp 和 Ollama 交付。当你需要在同一基座上跑多 LoRA（multi-LoRA）时，GPTQ 在 vLLM 内部胜出。搭配 Marlin-AWQ 内核的 AWQ 在 7B 级别模型上交付约 741 tok/s，并在 INT4 下取得最佳 Pass@1——这是 2026 年数据中心生产环境的默认选择。FP8 在 Hopper、Ada 和 Blackwell 上保持中间地带——近乎无损且支持广泛。NVFP4 和 MXFP4（Blackwell 微缩放，microscaling）较为激进，需要逐块（per-block）验证。两个陷阱会咬住团队：校准数据集（calibration dataset）必须匹配部署领域；而 KV 缓存（KV cache）与权重量化是分开的——AWQ 那一课「我的模型现在只有 4 GB 了」忘记了在生产批量大小下还有 10-30 GB 的 KV 缓存。

**类型：** 学习
**语言：** Python（标准库，跨格式的玩具级内存与吞吐量对比）
**前置：** 阶段 10 · 13（量化基础）、阶段 17 · 04（vLLM 服务内部机制）
**时长：** 约 75 分钟

## 学习目标

- 说出 2026 年六种生产量化格式及它们各自的最佳适用场景（sweet spot）。
- 在给定硬件（CPU vs GPU、Hopper vs Blackwell）、引擎（vLLM、TRT-LLM、llama.cpp）和工作负载（日常聊天、推理、多 LoRA）的情况下，挑选一种格式。
- 计算某一选定格式所节省的权重内存，以及未被触及的 KV 缓存。
- 说出会在领域流量上劣化量化模型的「校准数据集陷阱」。

## 问题

量化降低了内存与 HBM 带宽占用，而这正是解码（decode）所需要的。一个 FP16 的 70B 模型有 140 GB 权重。把权重量化到 INT4（AWQ 或 GPTQ），模型就变成 35 GB——能装进一块 H100 并为 KV 缓存留出空间，这一点很关键，因为在 128 路并发、2k 上下文时，单是 KV 缓存就有 20-30 GB。

但量化并非免费。激进的量化会劣化质量，尤其是在重推理任务上。不同格式与不同引擎配合。不同硬件原生支持不同精度。2026 年的「格式动物园」是真实存在的，你不能照抄别人的选择——你必须基于自己的技术栈来挑选。

## 概念

### 六种格式

| 格式 | 位宽 | 最佳适用场景 | 引擎 |
|--------|------|-----------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU、边缘端、笔记本 | llama.cpp, Ollama |
| GPTQ | 4-8 | vLLM 上的多 LoRA | vLLM, TGI |
| AWQ | 4 | 数据中心 GPU 生产 | vLLM (Marlin-AWQ), TGI |
| FP8 | 8 | Hopper/Ada/Blackwell 数据中心 | vLLM, TRT-LLM, SGLang |
| MXFP4 | 4 | Blackwell 多用户 | TRT-LLM |
| NVFP4 | 4 | Blackwell 多用户 | TRT-LLM |

### GGUF——CPU/边缘端的默认选择

GGUF 本身严格说是一种文件格式，而非量化方案——它把多种 K-quant 变体（Q2_K、Q3_K_M、Q4_K_M、Q5_K_M、Q6_K、Q8_0）打包进一个容器。Q4_K_M 和 Q5_K_M 是生产默认值——在 4-5 位下接近 BF16 的质量。对 CPU 或边缘端服务来说是最佳选择，因为 llama.cpp 远远是最快的 CPU 推理引擎。

在 vLLM 中的吞吐量惩罚：7B 上约 93 tok/s——该格式并未为 GPU 内核做优化。当部署目标是 CPU/边缘端时使用 GGUF，其余情况不用。

### GPTQ——vLLM 中的多 LoRA

GPTQ 是一种带校准过程（calibration pass）的训练后量化（post-training quantization）算法。Marlin 内核让它在 GPU 上很快（相比非 Marlin 的 GPTQ 有 2.6 倍加速）。7B 上约 712 tok/s。

它独有的优势：GPTQ-Int4 在 vLLM 中支持 LoRA 适配器。如果你要服务一个基座模型加上 10-50 个微调变体（每个作为一个 LoRA），GPTQ 就是你的路径。截至 2026 年初，NVFP4 尚不支持 LoRA。

### AWQ——数据中心 GPU 的默认选择

激活感知权重量化（Activation-aware Weight Quantization）。在量化过程中保护约 1% 最显著（most-salient）的权重。Marlin-AWQ 内核：相比朴素实现有 10.9 倍加速。7B 上约 741 tok/s，在 INT4 格式中拥有最佳 Pass@1。

为新的 GPU 服务挑选 AWQ，除非你需要多 LoRA（GPTQ）或激进的 Blackwell FP4（NVFP4）。

### FP8——可靠的中间地带

8 位浮点。近乎无损。支持广泛。Hopper 张量核心（Tensor Cores）原生加速 FP8。Blackwell 继承了这一点。当质量不容妥协时（推理、医疗、代码生成），FP8 是 2026 年的安全默认值。其内存节省只有 INT4 的一半，但质量风险要低得多。

### MXFP4 / NVFP4——Blackwell 激进派

微缩放（Microscaling）FP4。每一块权重都有自己的缩放因子（scale factor）。激进，但在 Blackwell 张量核心上有硬件加速。相比 FP8 把每 token 的字节数减半——这是阶段 17 · 07 中的经济优势。

注意事项：

- 尚不支持 LoRA（2026 年初）。
- 在重推理工作负载上可见质量下降。
- 逐模型在你的评测集上验证。

### 校准陷阱

AWQ 和 GPTQ 需要一个校准数据集——通常是 C4 或 WikiText。对于领域模型（代码、医疗、法律），在通用网页文本上做校准会让算法对「保护哪些权重」做出错误决策。HumanEval 上的 Pass@1 可能下降数个百分点。

修复办法：在领域内（in-domain）数据上做校准。几百个领域样本通常就够了。上线前先在评测集上测试。

### KV 缓存陷阱

AWQ 把权重压缩到 4 位。KV 缓存是分开的，仍保持在 FP16/FP8。对一个采用 AWQ 的 70B 模型：

- 权重：约 35 GB（从 140 GB 降到 INT4）。
- 128 路并发 × 2k 上下文下的 KV 缓存：约 20 GB。
- 激活值：约 5 GB。
- 总计：约 60 GB——可装入 H100 80GB。

天真地说「我把模型量化到 4 GB 了」忘记了另外的 30-50 GB。要从整体上规划 HBM 预算。

另外单独地，KV 缓存量化（FP8 KV 或 INT8 KV）是另一个有其自身权衡的选择——它直接影响注意力精度，并非免费的收益。

### AWQ INT4 对推理有风险

带长上下文的思维链（chain-of-thought）、数学、代码生成——这些会明显因激进量化而受损。AWQ INT4 在 MATH 上损失约 3-5 个百分点。对于重推理工作负载，请上线 FP8 或 BF16；接受相应的内存代价。

### 2026 年挑选指南

- CPU/边缘端服务：GGUF Q4_K_M。搞定。
- GPU 服务、日常聊天、无 LoRA：AWQ。
- GPU 服务、多 LoRA：搭配 Marlin 的 GPTQ。
- 推理工作负载：FP8。
- Blackwell 数据中心、质量已验证：NVFP4 + FP8 KV。
- 不确定时：在每个候选格式上跑一次 1,000 样本的评测。

## 上手用它

`code/main.py` 计算内存占用（权重 + KV + 激活值）以及六种格式在一系列模型规模下的相对吞吐量。它展示了 KV 缓存在哪里占主导、权重压缩在哪里划算，以及 FP8 在哪里是安全选择。

## 交付它

本课产出 `outputs/skill-quantization-picker.md`。在给定硬件、模型规模、工作负载类型和质量容忍度的情况下，挑选一种格式并产出一份校准/验证计划。

## 练习

1. 运行 `code/main.py`。对于一个 70B 模型在 128 路并发、2k 上下文下，计算每种格式的总 HBM。哪种格式能让你装进一块 H100 80GB？
2. 你有一个 7B 编码模型。挑选一种格式并给出理由。如果你对质量容忍度判断错了，恢复路径是什么？
3. 计算为一个医疗领域模型校准 AWQ 所需的校准数据集规模。为什么更多数据并不总是更好？
4. 阅读 Marlin-AWQ 内核论文或发布说明。用三句话解释为什么 AWQ 在 7B 上达到 741 tok/s，而原始 GPTQ 只有约 712。
5. 在什么情况下把 AWQ 权重与 FP8 KV 缓存组合在一起是合理的，相对于把 KV 保持在 BF16？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| GGUF | 「llama.cpp 格式」 | 打包 K-quant 变体的文件格式；CPU/边缘端默认 |
| Q4_K_M | 「Q4 K M」 | 4 位 K-quant 中档；生产环境 GGUF 默认 |
| GPTQ | 「gee pee tee q」 | 带校准的训练后 INT4；在 vLLM 中支持 LoRA |
| AWQ | 「a w q」 | 激活感知 INT4；Marlin 内核；INT4 下最佳 Pass@1 |
| Marlin kernels | 「快速 INT4 内核」 | 用于 Hopper 上 INT4 的定制 CUDA 内核；10 倍加速 |
| FP8 | 「八位浮点」 | Hopper/Ada/Blackwell 上的安全精度默认 |
| MXFP4 / NVFP4 | 「microscaling four」 | Blackwell 的 4 位浮点，带逐块缩放因子 |
| Calibration dataset | 「cal data」 | 用于挑选量化参数的输入文本；必须匹配领域 |
| KV cache quantization | 「KV INT8」 | 与权重分开的选择；影响注意力精度 |

## 延伸阅读

- [VRLA Tech — LLM Quantization 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) — 对比基准测试。
- [Jarvis Labs — vLLM Quantization Complete Guide](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) — 各格式的吞吐量数据。
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) — 逐格式挑选。
- [vLLM docs — Quantization](https://docs.vllm.ai/en/latest/features/quantization/index.html) — 支持的格式与标志。
- [AWQ paper (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) — 原始 AWQ 表述。
- [GPTQ paper (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323) — 原始 GPTQ 表述。
