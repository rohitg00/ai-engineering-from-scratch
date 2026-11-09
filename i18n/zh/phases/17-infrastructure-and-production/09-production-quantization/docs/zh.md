# 产量量化  AWQ,GPTQ,GGUF K-量子,FP8,MXFP4/NVFP4

> 量子化格式不是一个普遍的选择. 它是硬件,服务引擎和工作负载的函数. GGUF Q4_K_M或Q5_K_M拥有CPU和边缘,通过 llama.cpp和Ollama提供. 在VLLM中,GPTQ在同一基地需要多个LoRA时获胜. 通过使用 Marlin-AWQ 核,在 7B 类型模型上提供了741 个_tk/s,最好的 Pass@1 在 INT4  作为2026 年的数据中心生产的默认. ,阿达和布莱克威尔的中期保持几乎没有损失,得到广泛支持. NVFP4和MXFP4 (黑微量化) 是积极的,需要每块验证. 两个陷咬人团队:校准数据集必须与部署域匹配,KV缓存与重量量化分开 AWQ课 "我的模型现在是4GB"在生产批量时忘记了10-30GBKV缓存.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy memory and throughput comparison across formats)
**Prerequisites:** Phase 10 · 13 (Quantization foundations), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## 学习目标

- 举个6个生产量化格式和2026年的甜点.
- 选择给定的硬件格式 (CPU vs GPU,Hopper vs Blackwell),引擎 (vLLM,TRT-LLM, llama.cpp),和工作负载 (例行聊天,推理,多LoRA).
- 计算保存的重量内存,并为所选格式留下未触及的KV缓存.
- 命名对域流量量进行量化模型的校准数据集陷.

## 问题

量子化减少了内存和HBM带宽,这正是解码所需的.FP16 70B模型的重量为140GB.量化重量为INT4 (AWQ或GPTQ),模型为35GB 适合一个H100,可容纳KV缓存,这很重要,因为在2k文本的128个同时序列中,KV缓存仅为20-30GB.

量子化不是免费的. 侵略性量子化降低了质量,特别是在推理重任务上. 不同的格式与不同的引擎工作. 不同的硬件支持不同的精度. 2026 格式动物园是真实的,你不能复制别人的选择.

## 概念

### 六种格式

| Format | Bits | Sweet spot | Engines |
|--------|------|-----------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU, edge, laptops | llama.cpp, Ollama |
| GPTQ | 4-8 | Multi-LoRA on vLLM | vLLM, TGI |
| AWQ | 4 | Datacenter GPU production | vLLM (Marlin-AWQ), TGI |
| FP8 | 8 | Hopper/Ada/Blackwell datacenter | vLLM, TRT-LLM, SGLang |
| MXFP4 | 4 | Blackwell multi-user | TRT-LLM |
| NVFP4 | 4 | Blackwell multi-user | TRT-LLM |

### 关键键字:

GGUF是一个文件格式,而不是一个量子化方案.它将K-量子变体 (Q2_K,Q3_K_M,Q4_K_M,Q5_K_M,Q6_K,Q8_0) 捆绑在一个容器中.Q4_K_M和Q5_K_M是生产默认的4BF16质量在4-5位.最好的选择是CPU或边缘服务,因为 llama.cpp是迄今为止最快的CPU推断引擎.

在vLLM中吞吐量处罚:在7B上~93tok/s 格式不适用于GPU内核.使用GGUF当部署目标是CPU/edge时.否则.

### 多洛拉在vLLM中

GPTQ是一个后训练量化算法,具有校准度过.马林内核在GPU上实现速度2.6倍,而非马林GPTQ. ~712tc/s在7B上.

唯一的胜利:GPTQ-Int4支持vLLM中的LoRA适配器.如果你正在使用基模型加上10-50个细调变量 (每个变量都是LoRA),GPTQ是你的路径.NVFP4尚未支持LoRA2026年初.

### AWQ 数据中心 GPU 默认

激活意识重量量化. 在量化过程中保护了最突出的重量1%.马林-AWQ核: 10.9x速度与天真. 7B 上的741个通/秒,是 INT4 格式中最好的 Pass@1.

选择AWQ为新的GPU服务,除非你需要多LoRA (GPTQ) 或积极的Blackwell FP4 (NVFP4).

### 可靠的中部

八位浮点.几乎没有损失.广泛支持. 霍珀电压芯以原生方式加速FP8. 黑继承.FP8是安全的2026默认,当质量不可谈判时 (理性,医学,代码代码). 存储量是INT4的一半,但质量风险要低得多.

### 黑攻击性

微量化FP4.每个重量块都有自己的尺度因子.黑尔子芯上具有侵略性但硬件加速性.每代币的字节减半,而FP8 在17期的经济胜利.

洞穴:
- 目前没有LoRA支持 (2026年初).
- 在沉重的工作负载上,质量下降明显.
- 根据模型的评估设置验证.

### 校准陷

AWQ和GPTQ需要一个校准数据集,通常是C4或WikiText.对于域名模型 (代码,医学,法律),在通用网页文本上校准使算法做出错误的决定,关于保护的权重.

解决方案:在域内数据进行校准.通常需要数百个域名样本. 在运输之前,在评估组上测试.

### 卡车预存陷

AWQ将重量缩小到4位.KV缓存是独立的,保持在FP16/FP8.对于AWQ的70B模型:

- 权重: ~ 35 GB (INT4从 140 GB).
- 在 128 个同时 × 2k 语境中的 KV缓存: ~ 20 GB.
- 激活: ~ 5 GB.
- 总量:60GB 适合H10080GB.

简单地说",我把我的模型量化为4GB",忘记了其他30-50GB.

单独,KV缓存量化 (FP8 KV或INT8 KV) 是一个不同的选择,它有自己的权衡.

###  AWQ INT4 对于推理是危险的

思想链,数学,长文本的代码代码这些显然受到攻击性量化的影响.AWQ INT4在 MATH 上损失3-5分.对于推理重的工作负载,请运送FP8或BF16;接受存储成本.

### 2026 选用指南

- 处理器/边缘服务:GGUF Q4_K_M.完成.
-  GPU服务,常规聊天,没有LORA: AWQ.
- 接下来,我们将把它带到一个地方.
- 推理工作量:FP8.
- 黑数据中心,验证质量:NVFP4+FP8KV.
- 模糊:对每个候选人格式进行1000个样本的评估.

```figure
gpu-memory-breakdown
```

## 用它

`code/main.py`计算内存足迹 (权重+KV+激活) 和相对吞吐量在六种格式中,用于一系列模型尺寸.显示KV缓存在哪里占主导地位,重量压缩在哪里,以及FP8是安全选择的地方.

其他[Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?dtype=fp8&users=64)机器显示NVIDIA L4上的FP8 . 重量从15.28GB下降到8.81GB,KV池从24.094增加到142.369个代币,并且64个用户的测量输出从每秒250.85到735.91代币.

## 运送它

这一课产生了`outputs/skill-quantization-picker.md`鉴于硬件,模型尺寸,工作负载类型和质量耐受性,选择格式并制定校准/验证计划.

## 运动

1. 跑步`code/main.py`对于一个70B模型的128同时和2k文本,计算每个格式的总HBM. 哪个格式允许你适合一个H100 80GB?
2. 如果你对质量宽容有错,恢复的路径是什么?
3. 为什么更多数据并不总是更好?
4. 在7B上,AWQ为什么达到741个单/秒,而原始GPTQ为712个单.
5. 什么时候可以将 AWQ 重量与FP8 KV缓存相比,保持KV在BF16?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GGUF | "llama.cpp format" | File format bundling K-quant variants; CPU/edge default |
| Q4_K_M | "Q4 K M" | 4-bit K-quant medium; the production GGUF default |
| GPTQ | "gee pee tee q" | Post-train INT4 with calibration; supports LoRA in vLLM |
| AWQ | "a w q" | Activation-aware INT4; Marlin kernels; best Pass@1 at INT4 |
| Marlin kernels | "fast INT4 kernels" | Custom CUDA kernels for INT4 on Hopper; 10x speedup |
| FP8 | "eight-bit float" | Safe precision default on Hopper/Ada/Blackwell |
| MXFP4 / NVFP4 | "microscaling four" | Blackwell 4-bit FP with per-block scale factors |
| Calibration dataset | "cal data" | Input text used to pick quantization parameters; must match domain |
| KV cache quantization | "KV INT8" | Separate choice from weights; affects attention accuracy |

## 进一步阅读

- [VRLA Tech — LLM Quantization 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/)比较基准.
- [Jarvis Labs — vLLM Quantization Complete Guide](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks)按格式的吞吐量数.
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/)按格式选择.
- [vLLM docs — Quantization](https://docs.vllm.ai/en/latest/features/quantization/index.html)支持的格式和旗.
- [AWQ paper (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) AWQ原始表达式.
- [GPTQ paper (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323)原始GPTQ制剂.
