# 在 Blackwell 上用 FP8 与 NVFP4 跑 TensorRT-LLM

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> TensorRT-LLM 只支持 NVIDIA，但在 Blackwell 上它赢麻了。在 GB200 NVL72 + Dynamo 编排下，SemiAnalysis InferenceX 在 2026 年 Q1–Q2 实测一个 120B 模型每百万 token 仅需 $0.012，而 H100 + vLLM 是 $0.09/M——经济差距 7 倍。整个栈是三种浮点制式叠出来的：FP8 仍然是 KV cache 与 attention（注意力）kernel 的关键，因为它们需要 FP8 提供的动态范围；NVFP4（4-bit microscaling）负责 weight（权重）和 activation（激活）；多 token 预测（multi-token prediction，MTP）和 prefill/decode 解耦（disaggregated）再叠 2–3 倍。Day-0 模型支持可以直接加载 FP4 权重，不需要训练后转换。对 2026 年的工程团队来说，代价是：TRT-LLM 是 NVIDIA 的封闭栈，用它意味着拿可移植性换吞吐。落地前先在你自家的模型与硬件组合上把账算清楚。

**Type:** Learn
**Languages:** Python（标准库，玩具级 FP8/NVFP4 显存与成本计算器）
**Prerequisites:** Phase 17 · 04（vLLM Serving Internals）、Phase 10 · 13（Quantization）
**Time:** ~75 分钟

## 学习目标（Learning Objectives）

- 解释为什么即便权重已经是 NVFP4，FP8 对 KV cache 和 attention 仍然不可或缺。
- 计算一个前沿模型在 BF16、FP8、NVFP4 下的 HBM 占用，并说清节省来自哪里。
- 说出 TRT-LLM 在 Blackwell 上利用的几项专属特性（day-0 FP4、MTP、disaggregated serving、all-to-all 原语）。
- 判断什么时候 TRT-LLM 的 NVIDIA 锁定是值得的——也就是相对 Hopper 上 vLLM 的 7 倍成本差是否划算。

## 问题（The Problem）

2026 年推理经济学的最前沿就是「每美元能跑多少 token」。答案取决于四层叠加的选择：硬件代际（Hopper H100/H200 vs Blackwell B200/GB200）、精度（BF16 → FP8 → NVFP4）、推理引擎（vLLM vs SGLang vs TRT-LLM）、编排方式（普通 vs 解耦 vs Dynamo）。

在 Hopper + vLLM 上，一个 120B 的 MoE 跑出来约 $0.09 每百万 token。在 Blackwell + TRT-LLM + Dynamo 上，同模型约 $0.012——便宜 7 倍。这个差距里有一部分来自硬件（Blackwell 的单卡 LLM 吞吐是 Hopper 的 11–15 倍），另一部分来自栈本身：FP4 权重、MTP 草稿、prefill/decode 解耦，以及 NVLink 5 上 MoE 专家通信用的 all-to-all。

这套东西离开 NVIDIA 的栈就复刻不了。这就是取舍——可移植性换经济性。本课的重点是搞清楚每一项栈选择各自贡献了多少差距。

## 概念（The Concept）

### 为什么 FP8 仍然是 KV cache 的下限

2026 年常见的一个误区：以为 NVFP4 哪儿都能用。不是的。KV cache 必须是 FP8（8-bit 浮点），因为它存储的是 attention 的 key 和 value，这些值跨度的动态范围很大。把 KV 量化成 FP4 会造成灾难性的精度损失——分布的尾部直接掉光，attention 分数全塌。FP8 的指数位给 KV cache 提供了它需要的动态范围。

NVFP4（2025–2026）适用于权重和激活。微缩（microscaling）的思路是：每一小块权重各自有一个 scale factor，这样不同小块可以覆盖不同的动态范围，避免 per-tensor 缩放带来的损失。激活上 FP4 也站得住，因为同一层内激活值的范围本来就小。

Blackwell 上典型的配置：

- 权重：NVFP4（4-bit microscaling）。
- 激活：NVFP4。
- KV cache：FP8。
- Attention 累加器：FP32（保 softmax 数值稳定）。

### TRT-LLM 用到的 Blackwell 专属原语

- **Day-0 FP4 权重**：模型提供方直接发布 FP4 权重；TRT-LLM 加载时不需要训练后转换。FP4 不再需要 AWQ / GPTQ 这一步。
- **多 token 预测（MTP）**：和 EAGLE（Phase 17 · 05）思路一致，但已经集成进了 TRT-LLM 的 build 流程。
- **Disaggregated serving（解耦推理）**：prefill 和 decode 跑在不同的 GPU 池里，KV cache 通过 NVLink 或 InfiniBand 传输。和 Dynamo（Phase 17 · 20）是同一个思路。
- **All-to-all 通信原语**：NVLink 5 把 MoE 专家通信延迟相对 Hopper 砍了 3 倍。TRT-LLM 的 MoE kernel 是针对它专门调优过的。
- **NVFP4 + MXFP8 microscaling**：Blackwell Tensor Core 上有硬件加速的 scale factor 处理。

### 你应该背下来的几个数字

- HGX B200 通过 TRT-LLM 跑 GPT-OSS-120B：$0.02/M token。
- GB200 NVL72 通过 Dynamo（编排 TRT-LLM）：$0.012/M token。
- H100 + vLLM 在可比工作负载上：约 $0.09/M token。
- TRT-LLM 三个月内的版本更新带来 2.8 倍吞吐提升（2026 年）。
- Blackwell 相对 Hopper：单卡 LLM 吞吐 11–15 倍。
- MLPerf Inference v6.0（2026 年 4 月）：Blackwell 在每一项提交任务上都领先。

### FP4 在质量上到底要付出什么

NVFP4 是激进的。在偏推理（reasoning）的工作负载上——CoT、数学、长上下文 code-gen——FP4 权重的退化肉眼可见。Per-block 校准能缓解但消不掉。出 reasoning 模型的团队常用的折中是 FP8 权重 + FP4 激活，或者干脆留在 H200 上全程跑 FP8。

铁律：上 NVFP4 权重之前，永远先在你自己的 eval 集上验证任务质量。

### 为什么这是个 NVIDIA 锁定的决策

TRT-LLM 是 C++ + CUDA + 闭源 kernel。模型必须针对特定 GPU SKU 编译。不支持 AMD、不支持 Intel、不支持 ARM。如果你的基础设施策略是多供应商，那 TRT-LLM 在它服务的那一层就直接出局——你仍然可以用 vLLM 在混合硬件上服务。如果你只跑 NVIDIA，那 7 倍差距完全填得上锁定的代价。

### 2026 年的实操配方

如果年度推理账单超过 $1 亿美元，跑在 Hopper + vLLM 上等于丢了 7–10 倍。把成本占主导的工作负载迁到 Blackwell + TRT-LLM + Dynamo。试验层留在 H100 + vLLM，方便快速迭代模型。每个转完 NVFP4 的模型上线前都要验证质量。

### 解耦带来的额外加成

TRT-LLM 的 disaggregated serving（prefill 和 decode 池分离）在 Phase 17 · 20 里有详细展开。在 Blackwell 上倍数会叠加：FP4 权重 × MTP 加速 × 解耦放置 × 缓存感知路由。所谓 7 倍数字，是把整个栈完整堆起来才算出来的。

## 用起来（Use It）

`code/main.py` 会针对一个模型在三种栈下分别计算 HBM 占用、decode 吞吐（memory-bound 区间）以及 $/M-token：H100 + BF16 + vLLM、H100 + FP8 + vLLM、B200 + NVFP4/FP8 + TRT-LLM。跑一遍就能看清楚叠加效应，以及每一项变化各自吃掉了多少差距。

## 上线部署（Ship It）

本课的产物是 `outputs/skill-trtllm-blackwell-advisor.md`。给定一个工作负载、模型规模和年度 token 用量，它会判断 Blackwell + TRT-LLM 这套栈是否值得为之承担 NVIDIA 锁定。

## 练习（Exercises）

1. 跑 `code/main.py`。对一个 30% 激活参数比例的 120B MoE，计算它在 H100 BF16、H100 FP8 和 B200 NVFP4/FP8 上的显存带宽受限的 decode 吞吐。最大的跃迁来自哪一步？
2. 一位客户每年在 H100 + vLLM 上花 $200 万。给定 7 倍的经济差距，他们至少要买多少张 Blackwell GPU 才能在 12 个月内摊平迁到 TRT-LLM 的成本？
3. NVFP4 权重转换之后，你在 MATH 上看到精度掉了 3 个点。说出两条恢复路径：一条质量优先（保留 FP8 权重），一条成本优先（用领域内数据做校准）。
4. 读一遍 MLPerf v6.0 的推理结果。哪个任务上 Blackwell 相对 Hopper 的领先幅度最小？为什么？
5. 计算一个 405B 模型在 NVFP4 权重 + FP8 KV cache、128k 上下文下需要多少 HBM。它能塞进一个 GB200 NVL72 节点里吗？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 它实际意思 |
|------|----------------|------------------------|
| FP8 | 「八位浮点」 | 8-bit 浮点；因为动态范围合适，用于 KV cache 与 attention |
| NVFP4 | 「四位微缩」 | NVIDIA 的 4-bit microscaling 浮点格式；Blackwell 上用作权重和激活 |
| MXFP8 | 「MX 八位」 | Microscaling FP8 变体；在 Blackwell Tensor Core 上硬件加速 |
| Day-0 FP4 | 「直接发 FP4 权重」 | 模型方直接发布 FP4 权重；不需要训练后转换 |
| MTP | 「多 token 预测」 | TRT-LLM 集成的投机解码（speculative decoding）草稿（Phase 17 · 05） |
| Disaggregated serving | 「prefill/decode 拆开」 | prefill 和 decode 放在不同 GPU 池；KV 通过 NVLink/IB 传输 |
| All-to-all | 「MoE 专家通信」 | 把 token 路由到专家 GPU 的通信模式；NVLink 5 砍 3 倍延迟 |
| InferenceX | 「SemiAnalysis 推理基准」 | 2026 年业界采纳的每 token 成本基准（benchmark） |

## 延伸阅读（Further Reading）

- [NVIDIA — Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) — 2026 年 4 月 MLPerf 结果。
- [NVIDIA — MoE Inference on Blackwell](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/) — NVLink 5 all-to-all 与 MoE kernel。
- [TensorRT-LLM Overview](https://nvidia.github.io/TensorRT-LLM/overview.html) — 官方引擎文档。
- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) — TRT-LLM 之上的解耦编排。
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) — 公布 Blackwell 数字的基准套件。
