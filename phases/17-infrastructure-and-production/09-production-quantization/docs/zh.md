# 生产环境量化——AWQ、GPTQ、GGUF K-quants、FP8、MXFP4/NVFP4

> 量化格式并非通用选择——它是硬件、推理引擎和工作负载的函数。GGUF Q4_K_M 或 Q5_K_M 统治了 CPU 和边缘设备，通过 llama.cpp 和 Ollama 交付。GPTQ 在 vLLM 内部胜出，当你需要在同一基座上使用多 LoRA 时。AWQ 搭配 Marlin-AWQ 内核在 7B 级模型上可达到约 741 tok/s，并在 INT4 下拥有最佳的 Pass@1——这是 2026 年数据中心生产的默认选择。FP8 是 Hopper、Ada 和 Blackwell 上的中坚力量——接近无损且广泛支持。NVFP4 和 MXFP4（Blackwell 微缩放）较为激进，需要逐块验证。两个陷阱常常绊倒团队：校准数据集必须匹配部署领域，而 KV 缓存与权重量化是分开的——AWQ 的教训是"我的模型现在只有 4 GB"，却忘了在生产批次大小下还有 10-30 GB 的 KV 缓存。

**类型：** 学习
**语言：** Python（标准库，跨格式的简单内存和吞吐量对比）
**前置要求：** 阶段 10 · 13（量化基础），阶段 17 · 04（vLLM 推理内部机制）
**时间：** 约 75 分钟

## 学习目标

- 列举六种生产量化格式及其在 2026 年的最佳应用场景。
- 根据硬件（CPU vs GPU，Hopper vs Blackwell）、引擎（vLLM、TRT-LLM、llama.cpp）和工作负载（常规对话、推理、多 LoRA）选择合适的格式。
- 计算所选格式节省的权重内存以及未触及的 KV 缓存大小。
- 指出导致量化模型在领域流量上性能下降的校准数据集陷阱。

## 问题

量化减少了内存和 HBM 带宽，而这正是解码阶段所需要的。FP16 的 70B 模型权重为 140 GB。将权重量化到 INT4（AWQ 或 GPTQ）后，模型为 35 GB——可以放入一块 H100 并留出 KV 缓存空间，这很重要，因为在 128 个并发序列、2k 上下文的情况下，仅 KV 缓存就占 20-30 GB。

但量化并非免费的午餐。激进的量化会降低质量，尤其是在推理密集型任务上。不同的格式适用于不同的引擎。不同的硬件原生支持不同的精度。2026 年的格式动物园是真实存在的，你不能照搬别人的选择——你必须根据自己的技术栈来做决定。

## 概念

### 六种格式

| 格式 | 比特数 | 最佳场景 | 引擎 |
|--------|------|-----------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU、边缘设备、笔记本电脑 | llama.cpp、Ollama |
| GPTQ | 4-8 | vLLM 上的多 LoRA | vLLM、TGI |
| AWQ | 4 | 数据中心 GPU 生产环境 | vLLM（Marlin-AWQ）、TGI |
| FP8 | 8 | Hopper/Ada/Blackwell 数据中心 | vLLM、TRT-LLM、SGLang |
| MXFP4 | 4 | Blackwell 多用户 | TRT-LLM |
| NVFP4 | 4 | Blackwell 多用户 | TRT-LLM |

### GGUF——CPU/边缘设备的默认选择

GGUF 是一种文件格式，而非量化方案本身——它将 K-quant 变体（Q2_K、Q3_K_M、Q4_K_M、Q5_K_M、Q6_K、Q8_0）打包在一个容器中。Q4_K_M 和 Q5_K_M 是生产环境中的默认选择——在 4-5 比特下接近 BF16 的质量。CPU 或边缘推理的最佳选择，因为 llama.cpp 是目前最快的 CPU 推理引擎。

在 vLLM 中的吞吐量损失：7B 模型约 93 tok/s——该格式并非为 GPU 内核优化。当部署目标是 CPU/边缘设备时使用 GGUF。否则不用。

### GPTQ——vLLM 中的多 LoRA

GPTQ 是一种带有校准步骤的训练后量化算法。Marlin 内核使其在 GPU 上快速运行（比非 Marlin GPTQ 快 2.6 倍）。7B 模型约 712 tok/s。

独特的优势：GPTQ-Int4 在 vLLM 中支持 LoRA 适配器。如果你要提供一个基座模型加上 10-50 个微调变体（每个作为 LoRA），GPTQ 就是你的选择。截至 2026 年初，NVFP4 尚不支持 LoRA。

### AWQ——数据中心 GPU 的默认选择

激活感知权重量化（Activation-aware Weight Quantization）。在量化过程中保护约 1% 的最显著权重。Marlin-AWQ 内核：比朴素实现快 10.9 倍。7B 模型约 741 tok/s，在 INT4 格式中拥有最佳 Pass@1。

对于新的 GPU 推理服务，选择 AWQ，除非你需要多 LoRA（GPTQ）或激进的 Blackwell FP4（NVFP4）。

### FP8——可靠的中坚力量

8 位浮点数。接近无损。广泛支持。Hopper Tensor Cores 原生加速 FP8。Blackwell 继承支持。当质量不可妥协时（推理、医疗、代码生成），FP8 是 2026 年安全的选择。内存节省只有 INT4 的一半，但质量风险远低于 INT4。

### MXFP4 / NVFP4——Blackwell 激进方案

微缩放 FP4（Microscaling FP4）。每个权重块都有自己的缩放因子。激进但在 Blackwell Tensor Cores 上具有硬件加速。相比于 FP8，每个 token 的字节数减半——这是阶段 17 · 07 中的经济优势。

注意事项：
- 尚不支持 LoRA（2026 年初）。
- 在推理密集型工作负载上质量下降明显。
- 需要根据你的评估集对每个模型进行验证。

### 校准陷阱

AWQ 和 GPTQ 需要一个校准数据集——通常是 C4 或 WikiText。对于领域模型（代码、医疗、法律），使用通用网络文本进行校准会让算法在保护哪些权重方面做出错误决策。HumanEval 上的 Pass@1 可能会下降几个百分点。

解决方案：使用领域内数据进行校准。几百个领域样本通常就足够了。在发布前在评估集上进行测试。

### KV 缓存陷阱

AWQ 将权重压缩到 4 比特。KV 缓存是独立的，保持 FP16/FP8 精度。对于使用 AWQ 的 70B 模型：

- 权重：约 35 GB（从 140 GB INT4 压缩而来）。
- KV 缓存（128 并发 × 2k 上下文）：约 20 GB。
- 激活值：约 5 GB。
- 总计：约 60 GB——可以放入 H100 80GB。

天真地认为"我把模型量化到了 4 GB"却忽略了其他的 30-50 GB。要整体规划 HBM 预算。

另外，KV 缓存量化（FP8 KV 或 INT8 KV）是一个不同的选择，有其自身的权衡——它直接影响注意力计算的精度，并非免费的优化。

### AWQ INT4 对推理任务有风险

思维链、数学、长上下文代码生成——这些任务在激进量化下会明显受损。AWQ INT4 在 MATH 上损失约 3-5 个百分点。对于推理密集型工作负载，使用 FP8 或 BF16；接受相应的内存成本。

### 2026 选择指南

- CPU/边缘推理：GGUF Q4_K_M。搞定。
- GPU 推理、常规对话、无 LoRA：AWQ。
- GPU 推理、多 LoRA：GPTQ 搭配 Marlin。
- 推理工作负载：FP8。
- Blackwell 数据中心、已验证质量：NVFP4 + FP8 KV。
- 不确定时：对每种候选格式运行 1000 样本评估。

```figure
gpu-memory-breakdown
```

## 使用它

`code/main.py` 计算六种格式在不同模型规模下的内存占用（权重 + KV + 激活值）和相对吞吐量。展示 KV 缓存何时占主导地位，权重压缩何时有效，以及 FP8 何时是安全选择。

## 交付它

本课产出 `outputs/skill-quantization-picker.md`。根据硬件、模型大小、工作负载类型和质量容忍度，选择一种格式并生成校准/验证计划。

## 练习

1. 运行 `code/main.py`。对于一个 70B 模型，128 并发，2k 上下文，计算每种格式的总 HBM 需求。哪种格式可以放入一块 H100 80GB？
2. 你有一个 7B 代码模型。选择一种格式并说明理由。如果你对质量容忍度的判断有误，恢复路径是什么？
3. 计算为医疗领域模型校准 AWQ 所需的校准数据集大小。为什么更多的数据不一定更好？
4. 阅读 Marlin-AWQ 内核论文或发布说明。用三句话解释为什么 AWQ 在 7B 上达到 741 tok/s，而原始 GPTQ 约 712 tok/s。
5. 在什么情况下，将 AWQ 权重与 FP8 KV 缓存组合使用比将 KV 保持在 BF16 更有意义？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| GGUF | "llama.cpp 格式" | 打包 K-quant 变体的文件格式；CPU/边缘设备默认 |
| Q4_K_M | "Q4 K M" | 4 比特 K-quant 中等；生产环境 GGUF 默认 |
| GPTQ | "G-P-T-Q" | 带有校准的训练后 INT4 量化；vLLM 中支持 LoRA |
| AWQ | "A-W-Q" | 激活感知 INT4 量化；Marlin 内核；INT4 下最佳 Pass@1 |
| Marlin 内核 | "快速 INT4 内核" | 面向 Hopper 的 INT4 自定义 CUDA 内核；10 倍加速 |
| FP8 | "8 位浮点" | Hopper/Ada/Blackwell 上的安全精度默认 |
| MXFP4 / NVFP4 | "微缩放 4 位" | Blackwell 4 位 FP，带逐块缩放因子 |
| 校准数据集 | "校准数据" | 用于选择量化参数的输入文本；必须与领域匹配 |
| KV 缓存量化 | "KV INT8" | 与权重量化分开的选择；影响注意力精度 |

## 延伸阅读

- [VRLA Tech — LLM Quantization 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) — 对比基准测试。
- [Jarvis Labs — vLLM Quantization Complete Guide](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) — 各格式的吞吐量数据。
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) — 按格式逐一选择指南。
- [vLLM 文档 — Quantization](https://docs.vllm.ai/en/latest/features/quantization/index.html) — 支持的格式和标志。
- [AWQ 论文 (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) — 原始 AWQ 公式。
- [GPTQ 论文 (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323) — 原始 GPTQ 公式。
