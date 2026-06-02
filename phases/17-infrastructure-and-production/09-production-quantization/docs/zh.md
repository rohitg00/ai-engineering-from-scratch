# 生产环境量化 —— AWQ、GPTQ、GGUF K-quants、FP8、MXFP4/NVFP4

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 量化格式不是一锤子买卖——它是硬件、推理引擎和工作负载共同决定的函数。GGUF Q4_K_M 或 Q5_K_M 在 CPU 与边缘端通过 llama.cpp 与 Ollama 一统江湖。当你需要在同一基座上挂多个 LoRA 时，GPTQ 在 vLLM 里独占鳌头。AWQ 配合 Marlin-AWQ kernel，在 7B 级模型上跑出约 741 tok/s，并在 INT4 格式里取得最优 Pass@1——这是 2026 年数据中心生产环境的默认选择。FP8 在 Hopper、Ada、Blackwell 上稳坐中庸位置——近乎无损且广泛支持。NVFP4 和 MXFP4（Blackwell 微缩放）激进得多，需要逐 block 验证。两个坑常年咬人：calibration（校准）数据集必须匹配部署领域；KV cache 与权重量化是两回事——AWQ 那条「我的模型现在只有 4 GB」的口号忘了在生产 batch size 下还有 10–30 GB 的 KV cache。

**Type:** Learn
**Languages:** Python（stdlib，跨格式做内存与吞吐对比的玩具实现）
**Prerequisites:** Phase 10 · 13（量化基础）, Phase 17 · 04（vLLM Serving Internals）
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 说出 2026 年六种生产级量化格式以及它们各自的 sweet spot。
- 给定硬件（CPU vs GPU、Hopper vs Blackwell）、引擎（vLLM、TRT-LLM、llama.cpp）和工作负载（日常聊天、推理、多 LoRA），挑出对应格式。
- 计算所选格式下节省的权重显存，以及未被触及的 KV cache。
- 说出会在领域流量上拖垮量化模型的「校准数据集陷阱」。

## 问题（The Problem）

量化降低显存与 HBM 带宽，这正是 decode 所急需的。一个 FP16 的 70B 模型权重就是 140 GB。把权重量化到 INT4（AWQ 或 GPTQ），模型缩到 35 GB——一张 H100 装得下，还能给 KV cache 留出空间；这很关键，因为 128 路并发、2k 上下文时，光 KV cache 就要 20–30 GB。

但量化不是免费的。激进的量化会损失质量，尤其在重推理任务上。不同格式适配不同引擎。不同硬件原生支持不同精度。2026 年的格式动物园是真真切切存在的，你不能照搬别人家的选择——必须基于自己的技术栈来挑。

## 概念（The Concept）

### 六种格式（The six formats）

| 格式 | 比特数 | Sweet spot | 引擎 |
|--------|------|-----------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU、边缘端、笔记本 | llama.cpp、Ollama |
| GPTQ | 4-8 | vLLM 上的多 LoRA | vLLM、TGI |
| AWQ | 4 | 数据中心 GPU 生产 | vLLM（Marlin-AWQ）、TGI |
| FP8 | 8 | Hopper/Ada/Blackwell 数据中心 | vLLM、TRT-LLM、SGLang |
| MXFP4 | 4 | Blackwell 多用户 | TRT-LLM |
| NVFP4 | 4 | Blackwell 多用户 | TRT-LLM |

### GGUF —— CPU/边缘端默认（GGUF — the CPU/edge default）

GGUF 严格来说是一种文件格式，本身并不是某个量化方案——它把 K-quant 各个变体（Q2_K、Q3_K_M、Q4_K_M、Q5_K_M、Q6_K、Q8_0）打包到一个容器里。Q4_K_M 与 Q5_K_M 是生产默认值——4–5 比特即可逼近 BF16 的质量。CPU 或边缘端推理首选 GGUF，因为 llama.cpp 是迄今为止最快的 CPU 推理引擎，没有之一。

在 vLLM 里的吞吐代价：7B 上约 93 tok/s——这种格式根本没有为 GPU kernel 优化。只有当部署目标是 CPU/边缘端时才用 GGUF，其他场景别用。

### GPTQ —— vLLM 上的多 LoRA（GPTQ — multi-LoRA in vLLM）

GPTQ 是带校准过程的训练后量化算法。Marlin kernel 让它在 GPU 上跑得飞快（相比非 Marlin 的 GPTQ 提速 2.6 倍）。7B 上约 712 tok/s。

它独有的杀手锏：vLLM 里的 GPTQ-Int4 支持 LoRA 适配器。如果你要服务一个基座模型外加 10–50 个微调变体（每个都是一个 LoRA），那 GPTQ 就是你的路子。截至 2026 年初，NVFP4 还不支持 LoRA。

### AWQ —— 数据中心 GPU 默认（AWQ — the datacenter GPU default）

Activation-aware Weight Quantization（激活感知权重量化）。在量化时保护那约 1% 最显著的权重。Marlin-AWQ kernel：相对朴素实现提速 10.9 倍。7B 上约 741 tok/s，在所有 INT4 格式里取得最佳 Pass@1。

新建 GPU serving 选 AWQ，除非你需要多 LoRA（用 GPTQ）或者 Blackwell 上的激进 FP4（用 NVFP4）。

### FP8 —— 可靠的中庸之选（FP8 — the reliable middle）

8 比特浮点。近乎无损。广泛支持。Hopper Tensor Core 原生加速 FP8，Blackwell 继承之。当质量不容妥协（推理、医疗、代码生成）时，FP8 就是 2026 年的安全默认。显存节省只有 INT4 的一半，但质量风险也低得多。

### MXFP4 / NVFP4 —— Blackwell 的激进派（MXFP4 / NVFP4 — Blackwell aggressive）

Microscaling FP4（微缩放 FP4）。每个权重 block 拥有自己的缩放因子。激进，但在 Blackwell Tensor Core 上有硬件加速。每 token 字节数相比 FP8 再砍一半——这正是 Phase 17 · 07 里讲的经济账。

注意事项：

- 截至 2026 年初尚不支持 LoRA。
- 在重推理工作负载上能看到肉眼可见的质量下降。
- 必须按模型在自己的评测集上验证。

### 校准陷阱（The calibration trap）

AWQ 与 GPTQ 都需要 calibration（校准）数据集——通常是 C4 或 WikiText。对于领域模型（代码、医疗、法律），用通用网页文本来校准会让算法在「该保护哪些权重」上做出错误决策。HumanEval 上的 Pass@1 可能掉好几个点。

修复方法：用领域内数据校准。几百个领域样本通常就够。上线前在评测集上测一遍。

### KV cache 陷阱（The KV cache trap）

AWQ 把权重压到 4 比特。KV cache 是另一回事，仍维持在 FP16/FP8。以 AWQ 量化的 70B 模型为例：

- 权重：约 35 GB（从 140 GB 压成 INT4）。
- KV cache（128 并发 × 2k 上下文）：约 20 GB。
- 激活：约 5 GB。
- 合计：约 60 GB——能塞进 H100 80GB。

天真地宣称「我把模型量化到 4 GB」忽略了另外 30–50 GB。HBM 预算要整体来看。

另外，KV cache 量化（FP8 KV 或 INT8 KV）是一个独立的选择，有自己的取舍——它直接影响 attention 准确率，并不是白捡的便宜。

### AWQ INT4 对推理任务有风险（AWQ INT4 is hazardous for reasoning）

CoT、数学、长上下文代码生成——这些任务在激进量化下会肉眼可见地受损。AWQ INT4 在 MATH 上掉约 3–5 个点。重推理工作负载就上 FP8 或 BF16，认下显存代价。

### 2026 选型指南（2026 picking guide）

- CPU/边缘端 serving：GGUF Q4_K_M。完事。
- GPU serving、日常聊天、无 LoRA：AWQ。
- GPU serving、多 LoRA：GPTQ + Marlin。
- 推理类工作负载：FP8。
- Blackwell 数据中心、质量已验证：NVFP4 + FP8 KV。
- 拿不准：在每个候选格式上跑一轮 1,000 样本的 eval。

## 用起来（Use It）

`code/main.py` 在一系列模型尺寸下，计算六种格式的显存占用（权重 + KV + 激活）以及相对吞吐。它能告诉你 KV cache 在哪里占主导、权重压缩在哪里值回票价、以及 FP8 何时是安全选择。

## 上线部署（Ship It）

本课产出 `outputs/skill-quantization-picker.md`。给定硬件、模型尺寸、工作负载类型与质量容忍度，挑出一个格式并生成对应的校准 / 验证计划。

## 练习（Exercises）

1. 跑 `code/main.py`。对 70B 模型、128 并发、2k 上下文，计算每种格式的 HBM 总量。哪种格式能把它塞进单卡 H100 80GB？
2. 你手里有一个 7B 编码模型。挑一个格式并给出理由。如果你对质量容忍度判断错了，挽回路径是什么？
3. 计算给医疗领域模型校准 AWQ 所需的校准数据集规模。为什么数据更多并不总是更好？
4. 阅读 Marlin-AWQ kernel 的论文或 release notes。用三句话解释为什么 AWQ 在 7B 上跑到 741 tok/s，而原始 GPTQ 只有约 712 tok/s。
5. 何时把 AWQ 权重和 FP8 KV cache 搭配使用更合理？相比之下，把 KV 留在 BF16 又是什么场景？

## 关键术语（Key Terms）

| 术语 | 江湖叫法 | 实际含义 |
|------|----------------|------------------------|
| GGUF | 「llama.cpp 格式」 | 打包 K-quant 变体的文件格式；CPU/边缘端默认 |
| Q4_K_M | 「Q4 K M」 | 4 比特 K-quant medium 档；GGUF 生产默认 |
| GPTQ | 「gee pee tee q」 | 带校准的训练后 INT4；vLLM 里支持 LoRA |
| AWQ | 「a w q」 | 激活感知 INT4；Marlin kernel；INT4 中 Pass@1 最佳 |
| Marlin kernels | 「快速 INT4 kernel」 | Hopper 上的定制 INT4 CUDA kernel；提速 10 倍 |
| FP8 | 「8 比特浮点」 | Hopper/Ada/Blackwell 上的安全精度默认 |
| MXFP4 / NVFP4 | 「microscaling 四比特」 | Blackwell 上带逐 block 缩放因子的 4 比特浮点 |
| Calibration dataset | 「cal data」 | 用于挑选量化参数的输入文本；必须匹配领域 |
| KV cache quantization | 「KV INT8」 | 与权重量化相互独立的选择；影响 attention 准确率 |

## 延伸阅读（Further Reading）

- [VRLA Tech — LLM Quantization 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) —— 对比基准测试。
- [Jarvis Labs — vLLM Quantization Complete Guide](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) —— 各格式吞吐数据。
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) —— 逐格式选型。
- [vLLM docs — Quantization](https://docs.vllm.ai/en/latest/features/quantization/index.html) —— 支持的格式与启用 flag。
- [AWQ paper (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) —— AWQ 原始论文。
- [GPTQ paper (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323) —— GPTQ 原始论文。
