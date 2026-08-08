# 生产量化 —— AWQ、GPTQ、GGUF K-quants、FP8、MXFP4/NVFP4

> 量化格式不是通用选择 —— 它是硬件、服务引擎和工作负载的函数。GGUF Q4_K_M或Q5_K_M通过llama.cpp和Ollama拥有CPU和边缘。当需要在相同基础上进行多LoRA时，GPTQ在vLLM内部获胜。带有Marlin-AWQ内核的AWQ在7B类模型上提供约741 tok/s，具有INT4最佳Pass@1 —— 2026年数据中心生产默认。FP8在Hopper、Ada和Blackwell上保持中间立场 —— 近乎无损且广泛支持。NVFP4和MXFP4（Blackwell微缩放）是激进的，需要逐块验证。两个陷阱会咬伤团队：校准数据集必须匹配部署领域，KV缓存与权重量化分开 —— AWQ教训"我的模型现在是4 GB"忘记了生产批次大小下10-30 GB的KV缓存。

**类型：** 学习
**语言：** Python（标准库，跨格式的玩具内存和吞吐量比较）
**前置知识：** 第10阶段 · 13（量化基础），第17阶段 · 04（vLLM服务内部）
**时间：** 约75分钟

## 学习目标

- 命名2026年六种生产量化格式及其最佳点。
- 给定硬件（CPU vs GPU、Hopper vs Blackwell）、引擎（vLLM、TRT-LLM、llama.cpp）和工作负载（常规聊天、推理、多LoRA），选择格式。
- 计算所选格式的权重内存节省和未触及的KV缓存。
- 命名在领域流量上降级量化模型的校准数据集陷阱。

## 问题

量化减少内存和HBM带宽，这正是解码需要的。FP16 70B模型是140 GB权重。将权重量化到INT4（AWQ或GPTQ），模型是35 GB —— 适合一个H100，有KV缓存空间，这很重要，因为在128个并发序列、2k上下文下，仅KV缓存就是20-30 GB。

但量化不是免费的。激进量化降低质量，尤其在推理重任务上。不同格式与不同引擎配合工作。不同硬件原生支持不同精度。2026年格式动物园是真实的，你不能复制别人的选择 —— 你必须基于你的栈选择。

## 概念

### 六种格式

| 格式 | 位 | 最佳点 | 引擎 |
|------|-----|--------|------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU、边缘、笔记本 | llama.cpp、Ollama |
| GPTQ | 4-8 | vLLM上的多LoRA | vLLM、TGI |
| AWQ | 4 | 数据中心GPU生产 | vLLM（Marlin-AWQ）、TGI |
| FP8 | 8 | Hopper/Ada/Blackwell数据中心 | vLLM、TRT-LLM、SGLang |
| MXFP4 | 4 | Blackwell多用户 | TRT-LLM |
| NVFP4 | 4 | Blackwell多用户 | TRT-LLM |

### GGUF —— CPU/边缘默认

GGUF是文件格式，不是量化方案本身 —— 它在一个容器中捆绑K-quant变体（Q2_K、Q3_K_M、Q4_K_M、Q5_K_M、Q6_K、Q8_0）。Q4_K_M和Q5_K_M是生产默认 —— 4-5位接近BF16质量。CPU或边缘服务的最佳选择，因为llama.cpp是迄今为止最快的CPU推理引擎。

vLLM中的吞吐量惩罚：7B上约93 tok/s —— 该格式未针对GPU内核优化。当部署目标是CPU/边缘时使用GGUF。否则不使用。

### GPTQ —— vLLM中的多LoRA

GPTQ是具有校准过程的后训练量化算法。Marlin内核使其在GPU上快速（比非Marlin GPTQ快2.6倍）。7B上约712 tok/s。

独特胜利：GPTQ-Int4支持vLLM中的LoRA适配器。如果你正在服务基础模型加10-50个微调变体（每个作为LoRA），GPTQ是你的路径。截至2026年初，NVFP4尚不支持LoRA。

### AWQ —— 数据中心GPU默认

激活感知权重量化。在量化期间保护约1%最显著权重。Marlin-AWQ内核：比朴素快10.9倍。7B上约741 tok/s，INT4格式中最佳Pass@1。

除非你需要多LoRA（GPTQ）或激进Blackwell FP4（NVFP4），否则为新的GPU服务选择AWQ。

### FP8 —— 可靠的中间地带

8位浮点。近乎无损。广泛支持。Hopper Tensor Core原生加速FP8。Blackwell继承。FP8是2026年质量不可协商时（推理、医疗、代码生成）的安全默认。内存节省是INT4的一半，但质量风险远低于INT4。

### MXFP4 / NVFP4 —— Blackwell激进方案

微缩放FP4。每块权重有自己的缩放因子。激进但在Blackwell Tensor Core上硬件加速。相比FP8每token字节减半 —— 第17阶段 · 07中的经济胜利。

注意事项：
- 尚无LoRA支持（2026年初）。
- 推理重工作负载上质量下降可见。
- 在每个模型上的评估集上验证。

### 校准陷阱

AWQ和GPTQ需要校准数据集 —— 通常是C4或WikiText。对于领域模型（代码、医疗、法律），在通用网页文本上校准让算法对保护哪些权重做出错误决策。HumanEval上Pass@1可能下降数点。

修复：在域内数据上校准。数百个领域样本通常足够。在发布前在评估集上测试。

### KV缓存陷阱

AWQ将权重缩小到4位。KV缓存是分开的，保持在FP16/FP8。对于AWQ的70B模型：

- 权重：约35 GB（INT4来自140 GB）。
- 128并发 × 2k上下文下的KV缓存：约20 GB。
- 激活：约5 GB。
- 总计：约60 GB —— 适合H100 80GB。

天真地"我将模型量化到4 GB"忘记了其他30-50 GB。整体预算HBM。

另外，KV缓存量化（FP8 KV或INT8 KV）是具有自己权衡的不同选择 —— 它直接影响注意力精度，不是免费的胜利。

### AWQ INT4对推理是危险的

思维链、数学、长上下文代码生成 —— 这些从激进量化中明显受损。AWQ INT4在MATH上损失约3-5点。对于推理重工作负载，发布FP8或BF16；接受内存成本。

### 2026年选择指南

- CPU/边缘服务：GGUF Q4_K_M。完成。
- GPU服务、常规聊天、无LoRA：AWQ。
- GPU服务、多LoRA：带Marlin的GPTQ。
- 推理工作负载：FP8。
- Blackwell数据中心、验证质量：NVFP4 + FP8 KV。
- 模糊：在每个候选格式上运行1,000样本评估。

## 使用它

`code/main.py`计算一系列模型大小上六种格式的内存占用（权重 + KV + 激活）和相对吞吐量。显示KV缓存主导的地方、权重压缩回报的地方，以及FP8是安全选择的地方。

## 交付它

本课程产出`outputs/skill-quantization-picker.md`。给定硬件、模型大小、工作负载类型和质量容差，选择格式并产生校准/验证计划。

## 练习

1. 运行`code/main.py`。对于128并发、2k上下文的70B模型，计算每种格式的总HBM。哪种格式让你适合一个H100 80GB？
2. 你有一个7B编码模型。选择格式并证明。如果你错了关于质量容差，恢复路径是什么？
3. 计算医疗领域模型的AWQ校准所需校准数据集大小。为什么更多数据不总是更好？
4. 阅读Marlin-AWQ内核论文或发布说明。用三句话解释为什么AWQ在7B上达到741 tok/s，而原始GPTQ约712。
5. 何时将AWQ权重与FP8 KV缓存组合 vs 将KV保持在BF16有意义？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| GGUF | "llama.cpp格式" | 捆绑K-quant变体的文件格式；CPU/边缘默认 |
| Q4_K_M | "Q4 K M" | 4位K-quant中等；生产GGUF默认 |
| GPTQ | "gee pee tee q" | 带校准的后训练INT4；支持vLLM中的LoRA |
| AWQ | "a w q" | 激活感知INT4；Marlin内核；INT4最佳Pass@1 |
| Marlin内核 | "快速INT4内核" | Hopper上INT4的定制CUDA内核；10倍加速 |
| FP8 | "八位浮点" | Hopper/Ada/Blackwell上的安全精度默认 |
| MXFP4 / NVFP4 | "微缩放四" | 具有每块缩放因子的Blackwell 4位FP |
| 校准数据集 | "校准数据" | 用于选择量化参数的输入文本；必须匹配领域 |
| KV缓存量化 | "KV INT8" | 与权重分开的选择；影响注意力精度 |

## 延伸阅读

- [VRLA Tech —— 2026年LLM量化](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) —— 比较基准测试。
- [Jarvis Labs —— vLLM量化完整指南](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) —— 按格式吞吐量数字。
- [PremAI —— GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) —— 逐格式选择。
- [vLLM文档 —— 量化](https://docs.vllm.ai/en/latest/features/quantization/index.html) —— 支持的格式和标志。
- [AWQ论文（arXiv:2306.00978）](https://arxiv.org/abs/2306.00978) —— 原始AWQ公式。
- [GPTQ论文（arXiv:2210.17323）](https://arxiv.org/abs/2210.17323) —— 原始GPTQ公式。