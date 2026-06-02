# Capstone 07 — 端到端微调流水线（数据 → SFT → DPO → 服务）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个 8B 模型，在你自己的数据上训练，在你自己的偏好上做 DPO 对齐，量化（quantization）、speculative decoding（投机解码），并以可度量的 $/1M tokens 提供服务。2026 年的开源栈是 Axolotl v0.8、TRL 0.15、用 Unsloth 做迭代、用 GPTQ/AWQ/GGUF 做量化、用带 EAGLE-3 的 vLLM 0.7 做服务。这个 capstone 的目标是把整条流水线（pipeline）跑通且可复现 —— YAML 进、服务端点出 —— 并按 2026 年的 Model Openness Framework 发布一份 model card。

**Type:** Capstone
**Languages:** Python (pipeline), YAML (configs), Bash (scripts)
**Prerequisites:** Phase 2 (ML), Phase 3 (DL), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:** P2 · P3 · P7 · P10 · P11 · P17 · P18
**Time:** 35 hours

## 问题（Problem）

2026 年，每一支认真做 AI 的团队都会在手边备一条 fine-tune（微调）流水线。不是因为他们要发自己的前沿基座模型，而是因为下游适配 —— 领域 SFT、对标注偏好做 DPO、为 speculative decoding 蒸馏 draft 模型、用 EAGLE-3 服务 —— 才是真正能拿到可量化收益的地方。Axolotl v0.8 处理多 GPU 的 SFT 配置；TRL 0.15 处理 DPO 和 GRPO；Unsloth 让你在单 GPU 上快速迭代；带 EAGLE-3 的 vLLM 0.7 把 decode 吞吐拉高 2-3 倍而不损失质量。工具是现成的；真正的手艺活在 YAML 配置、数据卫生和评估纪律里。

你将拿一个 8B 基座（Llama 3.3、Qwen3 或 Gemma 3），先做 SFT，再用任务相关的数据做 DPO，量化后用于服务，并用 lm-evaluation-harness、RewardBench-2、MT-Bench-v2 和 MMLU-Pro 衡量收益。然后按 2026 Model Openness Framework 写一份 model card。重点是可复现 —— 一条命令把整条流水线端到端重跑一遍。

## 概念（Concept）

流水线分五个阶段。**Data**：去重（dedup，用 MinHash / Datatrove）、质量过滤（Nemotron-CC 风格的分类器）、PII（个人信息）清洗、对照公开 benchmark 做 split-hygiene（数据划分卫生）检查防止污染。**SFT**：Axolotl YAML、8xH100 上 ZeRO-3、cosine 调度、packed sequences（序列打包）、跑 2-3 个 epoch。**DPO 或 GRPO**：TRL 配置，1 个 epoch，preference pair 来自人工标注或模型评判，调 beta。**Quantize（量化）**：GPTQ + AWQ + GGUF，部署上更灵活。**Serve（服务）**：带 EAGLE-3 投机头的 vLLM 0.7（或带 SpecForge 的 SGLang）、K8s 部署、按队列等待时间做 HPA 伸缩。

交付物的核心是 ablation（消融实验）：在三个任务相关 benchmark 上对比仅 SFT、SFT+DPO、SFT+GRPO。服务侧指标：batch 1 / 8 / 32 时的 tokens/s、EAGLE-3 接受率（acceptance rate）、$/1M tokens。安全评估：Llama Guard 4 通过率。Model card：偏见评估、可复现的随机种子、数据授权。

## 架构（Architecture）

```
raw data (HF datasets + internal)
    |
    v
Datatrove dedup + Nemotron-CC quality filter + PII scrub
    |
    v
split hygiene (MMLU-Pro contamination check)
    |
    v
Axolotl SFT config (YAML)  ---> 8xH100, ZeRO-3
    |
    v
TRL DPO / GRPO config       ---> 4xH100, 1 epoch
    |
    v
GPTQ + AWQ + GGUF quantize
    |
    v
vLLM 0.7 + EAGLE-3 speculative decoding
    |
    v
K8s deployment, HPA on queue-wait
    |
    v
lm-eval-harness + RewardBench-2 + MT-Bench-v2 + MMLU-Pro
    |
    v
model card (2026 MOF) + safety eval (Llama Guard 4)
```

## 技术栈（Stack）

- 数据：Datatrove 做 dedup、Nemotron-CC 分类器做质量过滤、Presidio 做 PII 清洗
- 基座：Llama 3.3 8B、Qwen3 14B 或 Gemma 3 12B
- SFT：Axolotl v0.8，配 ZeRO-3、Flash Attention 3、packed sequences
- 偏好微调：TRL 0.15 跑 DPO 或 GRPO；Unsloth 做单 GPU 迭代
- 量化：GPTQ（Marlin）、AWQ、通过 llama.cpp 出 GGUF
- 服务：带 EAGLE-3 投机解码的 vLLM 0.7（或 SGLang 0.4 + SpecForge）
- 评估：lm-evaluation-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro
- 安全评估：Llama Guard 4、ShieldGemma-2
- 基础设施：Kubernetes + NVIDIA device plugin，按队列等待指标做 HPA
- 可观测性：训练用 W&B，推理用 Langfuse

## 动手实现（Build It）

1. **数据流水线。** 在原始语料上跑 Datatrove dedup。套用 Nemotron-CC 风格的质量分类器。用 Presidio 清洗 PII。用显式种子写出 train/val 划分。

2. **污染检查。** 对每个验证集划分，与 MMLU-Pro、MT-Bench-v2、RewardBench-2 测试集做 MinHash 比对。任何重叠都拒收。

3. **Axolotl SFT。** YAML 里配 ZeRO-3、FA3、序列打包。8xH100 上跑 2-3 个 epoch。日志推到 W&B。

4. **TRL DPO / GRPO。** 拿 SFT 的 checkpoint，对 preference pair 跑 1 个 epoch DPO（或在数学/代码这种有可验证奖励的场景跑 GRPO）。扫一下 beta。

5. **量化。** 出三种量化：GPTQ-INT4-Marlin、AWQ-INT4、给 llama.cpp 用的 GGUF-Q4_K_M。记录体积和名义吞吐。

6. **用投机解码做服务。** vLLM 0.7 配 EAGLE-3 draft head（用 Red Hat Speculators 训出来）。测 batch 1 / 8 / 32 下的接受率和尾延迟。在同一份 eval 上报 $/1M tokens，与 Anthropic / OpenAI 对比。

7. **评估矩阵。** 在 base、仅 SFT、SFT+DPO、SFT+GRPO 上跑 lm-eval-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro。出一张表。

8. **安全评估。** 在 dev 集上看 Llama Guard 4 通过率。再叠一层 ShieldGemma-2 输出过滤。

9. **Model card。** 用 MOF 2026 模板：数据、训练、评估、安全、授权，外加可复现章节（含 YAML 和 commit SHA）。

## 用起来（Use It）

```
$ ./pipeline.sh config/llama3.3-8b-domainX.yaml
[data]    300k deduped, 12k filtered, 280k accepted (seed=7)
[SFT]     3 epochs, 8xH100, 6h12m, val loss 1.42 -> 1.03
[DPO]     1 epoch, beta=0.08, 4xH100, 1h40m
[quant]   GPTQ-INT4 4.6 GB, AWQ-INT4 4.8 GB, GGUF-Q4_K_M 5.1 GB
[serve]   vLLM 0.7, EAGLE-3 acceptance 0.74, p99 126ms @ bs=8
[eval]    MMLU-Pro +3.2, MT-Bench-v2 +0.41, RewardBench-2 +0.08
[card]    model-card.md generated under 2026 MOF
```

## 上线部署（Ship It）

`outputs/skill-finetuning-pipeline.md` 描述了交付物。一条命令把数据跑过 SFT、DPO、量化、服务、评估，最后吐出 model card 和已上线的服务端点。

| 权重 | 标准 | 怎么衡量 |
|:-:|---|---|
| 25 | 相对 base 的评估增量 | 在目标任务（MMLU-Pro、MT-Bench-v2、任务相关 benchmark）上的实测增益 |
| 20 | 流水线可复现 | 一条命令端到端重跑、种子完全一致 |
| 20 | 数据卫生 | 去重率、PII 清洗覆盖、污染检查通过 |
| 20 | 服务效率 | bs=1/8/32 下的 tokens/s、EAGLE-3 接受率、$/1M tokens |
| 15 | Model card + 安全评估 | 2026 MOF 完整度 + Llama Guard 4 通过率 |
| **100** | | |

## 练习（Exercises）

1. 在同一份任务相关 benchmark 上对比仅 SFT、SFT+DPO、SFT+GRPO。报告哪种偏好方法胜出，以及差距多大。

2. 把 Llama 3.3 8B 换成 Qwen3 14B。在质量对齐的前提下测 $/1M tokens。

3. 测 EAGLE-3 在领域数据 vs 通用 ShareGPT 上的接受率。报告差距，以及它对延迟预算意味着什么。

4. 故意注入 1% 的污染（把 MMLU-Pro 的答案泄进训练数据）再跑 eval，看 MMLU-Pro 准确率不真实地飙升。基于此构建一个能拦住这种泄漏的污染检查 CI 关卡。

5. 加一条 LoRA SFT 路线作为全量 fine-tune 的替代。在内存降低 10 倍的情况下测质量差距。

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Axolotl | "SFT trainer" | 用 YAML 驱动的统一训练器，覆盖 SFT、DPO 和蒸馏 |
| TRL | "Preference tuner" | Hugging Face 出的库，做 LLM 上的 DPO、GRPO、PPO |
| GRPO | "Group-relative policy optimization" | DeepSeek R1 的 RL 配方，用可验证奖励 |
| EAGLE-3 | "Speculative decoding draft" | 一组提前预测 N 个 token 的 draft head；vLLM 用目标模型做验证 |
| MOF | "Model Openness Framework" | 2026 年用来给模型发布在数据、代码、授权上打分的标准 |
| Contamination check | "Split hygiene" | 基于 MinHash 的检测，找出测试集泄漏到训练集的情况 |
| Acceptance rate | "EAGLE / MTP metric" | 目标模型接受 draft token 的比例 |

## 延伸阅读（Further Reading）

- [Axolotl documentation](https://axolotl-ai-cloud.github.io/axolotl/) — 参考的 SFT / DPO 训练器
- [TRL documentation](https://huggingface.co/docs/trl) — DPO 和 GRPO 的参考实现
- [Unsloth](https://github.com/unslothai/unsloth) — 单 GPU 迭代的参考实现
- [DeepSeek R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — GRPO 方法学
- [vLLM + EAGLE-3 documentation](https://docs.vllm.ai) — 参考的服务栈
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — 另一个投机解码训练器
- [Model Openness Framework 2026](https://isocpp.org/) — 开源发布打分标准
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) — 公认的评估执行器
