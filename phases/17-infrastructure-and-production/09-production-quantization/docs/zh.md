# 生产量化 — AWQ、GPTQ、GGUF K-quants、FP8、MXFP4/NVFP4

> 量化格式不是通用选择——它是硬件、服务引擎和工作负载的函数。GGUF Q4_K_M 或 Q5_K_M 拥有 CPU 和边缘，通过 llama.cpp 和 Ollama 交付。当你需要在同一基础上进行多 LoRA 时，GPTQ 在 vLLM 内部胜出。带有 Marlin-AWQ 内核的 AWQ 在 INT4 上以最佳 Pass@1 提供约 741 tok/s——2026 年数据中心生产的默认设置。FP8 在 Hopper、Ada 和 Blackwell 上保持中间立场——接近无损且广泛支持。NVFP4 和 MXFP4（Blackwell 微缩放）是激进的，需要每块验证。两个陷阱困扰团队：校准数据集必须匹配部署域，KV 缓存与权重量化分离——AWQ 教训"我的模型现在是 4 GB"忘记了生产批次大小下 10-30 GB 的 KV 缓存。

**类型：** 学习
**语言：** Python（标准库，跨格式的简单内存和吞吐量比较）
**先修要求：** 阶段 10 · 13（量化基础）、阶段 17 · 04（vLLM 服务内部原理）
**时间：** 约 75 分钟

## 学习目标

- 说出六种生产量化格式及其在 2026 年的优势点。
- 给定硬件（CPU vs GPU、Hopper vs Blackwell）、引擎（vLLM、TRT-LLM、llama.cpp）和工作负载（日常聊天、推理、多 LoRA），选择一种格式。
- 计算所选格式的权重内存节省和未触动的 KV 缓存。
- 说出在校准数据集下降低量化模型在域流量上性能的陷阱。

## 问题

量化减少内存和 HBM 带宽，这正是解码所需要的。FP16 70B 模型是 140 GB 的权重。将权重量化为 INT4（AWQ 或 GPTQ）后，模型为 35 GB——适合一个 H100，并有空间存放 KV 缓存，这很重要，因为在 128 个并发序列和 2k 上下文下，仅 KV 缓存就有 20-30 GB。

但量化不是免费的。激进量化降低质量，特别是在重推理任务上。不同格式适用于不同引擎。不同硬件原生支持不同精度。2026 年的格式动物园是真实的，你不能复制别人的选择——你必须根据堆栈选择。

## 概念

### 六种格式

| 格式 | 位数 | 优势点 | 引擎 |
|--------|------|-----------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU、边缘、笔记本电脑 | llama.cpp、Ollama |
| GPTQ | 4-8 | vLLM 上的多 LoRA | vLLM、TGI |
| AWQ | 4 | 数据中心 GPU 生产 | vLLM (Marlin-AWQ)、TGI |
| FP8 | 8 | Hopper/Ada/Blackwell 数据中心 | vLLM、TRT-LLM、SGLang |
| MXFP4 | 4 | Blackwell 多用户 | TRT-LLM |
| NVFP4 | 4 | Blackwell 多用户 | TRT-LLM |

### GGUF——CPU/边缘默认

GGUF 是一种文件格式，而不是严格的量化方案——它在一个容器中捆绑 K-quant 变体（Q2_K、Q3_K_M、Q4_K_M、Q5_K_M、Q6_K、Q8_0）。Q4_K_M 和 Q5_K_M 是生产默认值——在 4-5 位时接近 BF16 质量。CPU 或边缘服务的最佳选择，因为 llama.cpp 是迄今为止最快的 CPU 推理引擎。

vLLM 中的吞吐量损失：在 7B 上约 93 tok/s——该格式未针对 GPU 内核优化。当部署目标是 CPU/边缘时，使用 GGUF。否则不使用。

### GPTQ——vLLM 中的多 LoRA

GPTQ 是一种带有校准过程的训练后量化算法。Marlin 内核使其在 GPU 上快速（比非 Marlin GPTQ 快 2.6 倍）。在 7B 上约 712 tok/s。

独特的优势：GPTQ-Int4 在 vLLM 中支持 LoRA 适配器。如果你正在服务一个基础模型加上 10-50 个微调变体（每个作为 LoRA），GPTQ 是你的路径。截至 2026 年初，NVFP4 尚不支持 LoRA。

### AWQ——数据中心 GPU 默认

激活感知权重量化。在量化期间保护约 1% 的最显著权重。Marlin-AWQ 内核：比朴素快 10.9 倍。在 7B 上约 741 tok/s，在 INT4 格式中最佳 Pass@1。

除非你需要多 LoRA（GPTQ）或激进 Blackwell FP4（NVFP4），否则为新 GPU 服务选择 AWQ。

### FP8——可靠的中间立场

8 位浮点。接近无损。广泛支持。Hopper Tensor Cores 原生加速 FP8。Blackwell 继承。当质量不可协商（推理、医疗、代码生成）时，FP8 是安全的 2026 年默认设置。内存节省是 INT4 的一半，但质量风险要低得多。

### MXFP4 / NVFP4——Blackwell 激进

微缩放 FP4。每个权重块有自己的比例因子。激进但在 Blackwell Tensor Cores 上硬件加速。与 FP8 相比，每个 token 的字节数减半——阶段 17 · 07 中的经济胜利。

注意事项：
- 尚未支持 LoRA（2026 年初）。
- 在重推理工作负载上可见质量下降。
- 在每个模型的评估集上验证。

### 校准陷阱

AWQ 和 GPTQ 需要校准数据集——通常是 C4 或 WikiText。对于域模型（代码、医疗、法律），在通用网页文本上校准会让算法对要保护哪些权重做出错误决定。HumanEval 上的 Pass@1 可能下降几个点。

修复：在域内数据上校准。数百个域样本通常就足够了。在运输之前在评估集上测试。

### KV 缓存陷阱

AWQ 将权重缩减到 4 位。KV 缓存是独立的，保持在 FP16/FP8。对于带有 AWQ 的 70B 模型：

- 权重：约 35 GB（从 140 GB 到 INT4）。
- 128 并发 × 2k 上下文的 KV 缓存：约 20 GB。
- 激活：约 5 GB。
- 总计：约 60 GB——适合 H100 80GB。

朴素地"我将模型量化为 4 GB"忘记了其他 30-50 GB。整体预算 HBM。

另外，KV 缓存量化（FP8 KV 或 INT8 KV）是一个具有自己权衡的不同选择——它直接影响注意力准确性，而不是免费的胜利。

### AWQ INT4 对推理有害

思维链、数学、带有长上下文的代码生成——这些明显受到激进量化的影响。AWQ INT4 在 MATH 上损失约 3-5 个点。对于重推理工作负载，部署 FP8 或 BF16；接受内存成本。

### 2026 年选择指南

- CPU/边缘服务：GGUF Q4_K_M。完成。
- GPU 服务、日常聊天、无 LoRA：AWQ。
- GPU 服务、多 LoRA：带 Marlin 的 GPTQ。
- 推理工作负载：FP8。
- Blackwell 数据中心、验证质量：NVFP4 + FP8 KV。
- 不明确：在每个候选格式上运行 1,000 样本评估。

## 使用它

`code/main.py` 计算一系列模型大小下六种格式的内存占用（权重 + KV + 激活）和相对吞吐量。显示 KV 缓存在何处占主导，权重压缩在何处有利，以及 FP8 在何处是安全的选择。

## 交付它

本课生成 `outputs/skill-quantization-picker.md`。给定硬件、模型大小、工作负载类型和质量容忍度，选择一种格式并生成校准/验证计划。

## 练习

1. 运行 `code/main.py`。对于具有 2k 上下文的 128 并发的 70B 模型，计算每种格式的总 HBM。哪种格式让你适合一个 H100 80GB？
2. 你有一个 7B 编码模型。选择一种格式并证明。如果你对质量容忍度错误，恢复路径是什么？
3. 计算校准医疗域模型的 AWQ 所需的校准数据集大小。为什么更多数据并不总是更好？
4. 阅读 Marlin-AWQ 内核论文或发行说明。用三句话解释为什么 AWQ 在 7B 上达到 741 tok/s，而原始 GPTQ 达到约 712。
5. 什么时候将 AWQ 权重与 FP8 KV 缓存结合而不是将 KV 保持在 BF16 有意义？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| GGUF | "llama.cpp 格式" | 捆绑 K-quant 变体的文件格式；CPU/边缘默认 |
| Q4_K_M | "Q4 K M" | 4 位 K-quant 中等；生产 GGUF 默认 |
| GPTQ | "gee pee tee q" | 带有校准的训练后 INT4；在 vLLM 中支持 LoRA |
| AWQ | "a w q" | 激活感知 INT4；Marlin 内核；INT4 上最佳 Pass@1 |
| Marlin kernels | "快速 INT4 内核" | Hopper 上 INT4 的自定义 CUDA 内核；10 倍加速 |
| FP8 | "8 位浮点" | Hopper/Ada/Blackwell 上的安全精度默认 |
| MXFP4 / NVFP4 | "微缩放四" | 具有每块比例因子的 Blackwell 4 位 FP |
| Calibration dataset | "校准数据" | 用于选择量化参数的输入文本；必须匹配域 |
| KV cache quantization | "KV INT8" | 与权重不同的选择；影响注意力准确性 |

## 延伸阅读

- [VRLA Tech——LLM 量化 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/)——比较基准测试。
- [Jarvis Labs——vLLM 量化完全指南](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks)——按格式的吞吐量数字。
- [PremAI——GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/)——按格式选择。
- [vLLM 文档——量化](https://docs.vllm.ai/en/latest/features/quantization/index.html)——支持的格式和标志。
- [AWQ 论文 (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978)——原始 AWQ 公式。
- [GPTQ 论文 (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323)——原始 GPTQ 公式。
