# 生产级量化 — AWQ、GPTQ、GGUF K-quants、FP8、MXFP4/NVFP4

> 量化格式不是一种放之四海而皆准的选择——它取决于硬件、推理引擎和工作负载。GGUF Q4_K_M 或 Q5_K_M 统治 CPU 和边缘设备，通过 llama.cpp 和 Ollama 提供。当你在 vLLM 中需要同一个基座上的多 LoRA 时，GPTQ 是胜者。AWQ 搭配 Marlin-AWQ 内核在 7B 级模型上可达到约 741 tok/s，并在 INT4 格式下拥有最佳的 Pass@1——这是 2026 年数据中心生产环境的默认选择。FP8 在 Hopper、Ada 和 Blackwell 上仍是折中之选——几乎无损且支持广泛。NVFP4 和 MXFP4（Blackwell 微缩放）较为激进，需要逐模型进行分块验证。有两个坑会困扰团队：校准数据集必须匹配部署领域，且 KV 缓存与权重量化是相互独立的——AWQ 教训“我的模型现在只有 4 GB”忽略了在生产批量规模下 10-30 GB 的 KV 缓存。

**Type:** Learn
**Languages:** Python (stdlib, toy memory and throughput comparison across formats)
**Prerequisites:** Phase 10 · 13 (Quantization foundations), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## 学习目标

- 说出六种生产级量化格式及其在 2026 年的最佳适用场景。
- 根据硬件（CPU vs GPU、Hopper vs Blackwell）、引擎（vLLM、TRT-LLM、llama.cpp）和工作负载（常规聊天、推理、多 LoRA）选择一种格式。
- 计算所选格式节省的权重显存，以及未被触及的 KV 缓存大小。
- 说出会导致量化模型在领域流量上性能退化的校准数据集陷阱。

## 问题

量化可以减少内存和 HBM 带宽占用，而这正是 decode 阶段所需要的。一个 FP16 的 70B 模型权重达 140 GB。将权重量化为 INT4（AWQ 或 GPTQ）后，模型只有 35 GB——可以装进一块 H100 并留出 KV 缓存的空间，这一点很重要，因为在 128 个并发序列、2k 上下文的情况下，仅 KV 缓存就需要 20-30 GB。

但量化不是免费的。激进量化会降低质量，尤其是在推理密集型任务上。不同格式支持不同的引擎。不同硬件原生支持的精度也不同。2026 年的格式生态是真实存在的，你无法照搬别人的选择——你必须基于自己的技术栈来决定。

## 核心概念

### 六种格式

| 格式 | 位数 | 最佳适用场景 | 引擎 |
|--------|------|-----------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU、边缘设备、笔记本 | llama.cpp、Ollama |
| GPTQ | 4-8 | vLLM 上的多 LoRA | vLLM、TGI |
| AWQ | 4 | 数据中心 GPU 生产环境 | vLLM (Marlin-AWQ)、TGI |
| FP8 | 8 | Hopper/Ada/Blackwell 数据中心 | vLLM、TRT-LLM、SGLang |
| MXFP4 | 4 | Blackwell 多用户场景 | TRT-LLM |
| NVFP4 | 4 | Blackwell 多用户场景 | TRT-LLM |

### GGUF — CPU/边缘设备的默认选择

GGUF 是一种文件格式，本身并非量化方案——它将多种 K-quant 变体（Q2_K、Q3_K_M、Q4_K_M、Q5_K_M、Q6_K、Q8_0）打包在一个容器中。Q4_K_M 和 Q5_K_M 是生产默认选择——在 4-5 比特下达到接近 BF16 的质量。对于 CPU 或边缘部署来说是最佳选择，因为 llama.cpp 是目前最快的 CPU 推理引擎。

在 vLLM 中的吞吐量损失：7B 上约 93 tok/s——该格式并未针对 GPU 内核优化。当部署目标是 CPU/边缘时使用 GGUF，否则不用。

### GPTQ — vLLM 中的多 LoRA

GPTQ 是一种带有校准过程的训练后量化算法。Marlin 内核使其在 GPU 上运行迅速（相比非 Marlin 的 GPTQ 有 2.6 倍加速）。7B 上约 712 tok/s。

独特优势：GPTQ-Int4 在 vLLM 中支持 LoRA 适配器。如果你需要部署一个基座模型加上 10-50 个微调变体（每个作为 LoRA），GPTQ 就是你的选择。截至 2026 年初，NVFP4 尚不支持 LoRA。

### AWQ — 数据中心 GPU 的默认选择

Activation-aware Weight Quantization（激活感知权重量化）。在量化过程中保护约 1% 最显著的权重。Marlin-AWQ 内核：相比朴素实现有 10.9 倍加速。7B 上约 741 tok/s，在 INT4 格式中 Pass@1 最佳。

对于新的 GPU 部署选择 AWQ，除非你需要多 LoRA（GPTQ）或激进的 Blackwell FP4（NVFP4）。

### FP8 — 可靠的折中方案

8 位浮点数。几乎无损。支持广泛。Hopper Tensor Cores 原生加速 FP8。Blackwell 继承了这一能力。FP8 是 2026 年在质量不可妥协时（推理、医疗、代码生成）的安全默认选择。内存节省是 INT4 的一半，但质量风险要低得多。

### MXFP4 / NVFP4 — 激进的 Blackwell 选择

微缩放 FP4。每个权重块都有各自的缩放因子。虽然激进，但在 Blackwell Tensor Cores 上有硬件加速。相比 FP8，每个 token 的字节数减半——这是 Phase 17 · 07 中的经济效益来源。

注意事项：
- 尚不支持 LoRA（2026 年初）。
- 在推理密集型工作负载上可见质量下降。
- 必须在你的评测集上逐模型验证。

### 校准陷阱

AWQ 和 GPTQ 需要一个校准数据集——通常是 C4 或 WikiText。对于领域模型（代码、医疗、法律），在通用网页文本上校准会让算法对应该保护哪些权重做出错误决策。HumanEval 上的 Pass@1 可能下降几个百分点。

解决办法：在领域内数据上校准。数百个领域样本通常就足够了。上线前先在评测集上测试。

### KV 缓存陷阱

AWQ 将权重压缩到 4 比特。KV 缓存是独立的，仍保持 FP16/FP8。对于一个使用 AWQ 的 70B 模型：

- 权重：约 35 GB（INT4，原为 140 GB）。
- KV 缓存（128 并发 × 2k 上下文）：约 20 GB。
- 激活值：约 5 GB。
- 总计：约 60 GB——可装进 H100 80GB。

天真地说“我把模型量化到了 4 GB”忽略了另外 30-50 GB。必须整体规划 HBM 预算。

另外，KV 缓存量化（FP8 KV 或 INT8 KV）是一个独立的选择，有其自身的权衡——它直接影响注意力精度，并非免费的收益。

### AWQ INT4 对推理任务有风险

思维链、数学、长上下文代码生成——这些任务在激进量化下明显受损。AWQ INT4 在 MATH 上损失约 3-5 个百分点。对于推理密集型工作负载，应部署 FP8 或 BF16；接受内存代价。

### 2026 年选择指南

- CPU/边缘部署：GGUF Q4_K_M。就这么定。
- GPU 部署、常规聊天、无 LoRA：AWQ。
- GPU 部署、多 LoRA：GPTQ 搭配 Marlin。
- 推理工作负载：FP8。
- Blackwell 数据中心、质量已验证：NVFP4 + FP8 KV。
- 拿不准：对每个候选格式跑一次 1,000 样本的评测。

```figure
gpu-memory-breakdown
```

## 动手实践

`code/main.py` 针对一系列模型规模，计算六种格式的内存占用（权重 + KV + 激活值）和相对吞吐量。展示 KV 缓存在何处占主导，权重压缩在何处见效，以及 FP8 在何处是安全选择。

## 上线交付

本课产出 `outputs/skill-quantization-picker.md`。根据硬件、模型规模、工作负载类型和质量容忍度，选定一种格式并生成校准/验证计划。

## 练习

1. 运行 `code/main.py`。对于一个 70B 模型、128 并发、2k 上下文，计算每种格式的总 HBM 占用。哪种格式能装进一块 H100 80GB？
2. 你有一个 7B 代码模型。选择一种格式并说明理由。如果你对质量容忍度的判断错了，恢复路径是什么？
3. 计算为一个医疗领域模型校准 AWQ 所需的校准数据集规模。为什么数据并非越多越好？
4. 阅读 Marlin-AWQ 内核论文或发布说明。用三句话解释为什么 AWQ 在 7B 上达到 741 tok/s，而原始 GPTQ 只达到约 712。
5. 什么时候将 AWQ 权重与 FP8 KV 缓存结合是合理的，而不是将 KV 保持在 BF16？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| GGUF | "llama.cpp 格式" | 打包 K-quant 变体的文件格式；CPU/边缘默认选择 |
| Q4_K_M | "Q4 K M" | 4 比特 K-quant 中等版；生产 GGUF 默认选择 |
| GPTQ | "gee pee tee q" | 带校准的训练后 INT4；在 vLLM 中支持 LoRA |
| AWQ | "a w q" | 激活感知 INT4；Marlin 内核；INT4 中最佳 Pass@1 |
| Marlin 内核 | "快速 INT4 内核" | 面向 Hopper 上 INT4 的定制 CUDA 内核；10 倍加速 |
| FP8 | "八位浮点" | Hopper/Ada/Blackwell 上的安全精度默认选择 |
| MXFP4 / NVFP4 | "微缩放四比特" | Blackwell 4 比特 FP，带逐块缩放因子 |
| 校准数据集 | "cal data" | 用于选择量化参数的输入文本；必须匹配领域 |
| KV 缓存量化 | "KV INT8" | 与权重相互独立的选择；影响注意力精度 |

## 延伸阅读

- [VRLA Tech — LLM Quantization 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) — 对比基准测试。
- [Jarvis Labs — vLLM Quantization Complete Guide](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) — 各格式的吞吐量数据。
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) — 逐格式选择指南。
- [vLLM docs — Quantization](https://docs.vllm.ai/en/latest/features/quantization/index.html) — 支持的格式与参数。
- [AWQ paper (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) — AWQ 原始论文。
- [GPTQ paper (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323) — GPTQ 原始论文。