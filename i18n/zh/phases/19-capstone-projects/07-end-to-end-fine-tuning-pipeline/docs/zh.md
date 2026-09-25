# 毕业项目 07 — 端到端微调流水线(数据 → SFT → DPO → 部署)

> 一个 8B 模型在你自己的数据上训练,根据你自己的偏好进行 DPO 对齐,量化,推测解码,并以可衡量的 $/1M tokens 成本提供服务。2026 年的开源技术栈是 Axolotl v0.8、TRL 0.15、用于快速迭代的 Unsloth、用于量化的 GPTQ/AWQ/GGUF,以及带 EAGLE-3 的 vLLM 0.7 部署。本项目的目标是可复现地运行整个流水线——输入 YAML,输出已部署的端点——并按照 2026 Model Openness Framework 发布一份模型卡。

**Type:** 毕业项目
**Languages:** Python (pipeline)、YAML (configs)、Bash (scripts)
**Prerequisites:** 阶段 2(ML)、阶段 3(DL)、阶段 7(transformers)、阶段 10(LLMs from scratch)、阶段 11(LLM engineering)、阶段 17(基础设施)、阶段 18(安全)
**Phases exercised:** P2 · P3 · P7 · P10 · P11 · P17 · P18
**Time:** 35 小时

## 问题

2026 年,每一个严肃的 AI 团队都随时备有一条微调流水线。不是因为他们要发布前沿基础模型,而是因为下游适配——领域 SFT、基于标注偏好的 DPO、用于推测解码的蒸馏草稿模型、基于 EAGLE-3 的部署——才是可衡量收益的所在。Axolotl v0.8 处理多 GPU SFT 配置。TRL 0.15 处理 DPO 和 GRPO。Unsloth 让你实现快速的单 GPU 迭代。带 EAGLE-3 的 vLLM 0.7 在不损失质量的前提下将解码吞吐量提高 2-3 倍。工具链已经成熟;真正的功夫体现在 YAML 配置、数据卫生和评估纪律上。

你将让一个 8B 基础模型(Llama 3.3、Qwen3 或 Gemma 3)经历 SFT,再在任务特定数据上进行 DPO,然后量化以供部署,并使用 lm-evaluation-harness、RewardBench-2、MT-Bench-v2 和 MMLU-Pro 衡量收益。你将制作一份符合 2026 Model Openness Framework 的模型卡。核心要点是可复现性——一条命令即可端到端重新运行整个流水线。

## 概念

流水线分为五个阶段。**数据**:去重(MinHash / Datatrove)、质量过滤(Nemotron-CC 风格的分类器)、PII 清洗,以及针对公开基准污染的切分卫生检查。**SFT**:使用 Axolotl YAML,在 8xH100 上运行 ZeRO-3,采用余弦调度、序列打包,训练 2-3 个 epoch。**DPO 或 GRPO**:TRL 配置,1 个 epoch,偏好对可以由人工标注或模型判断,调整 beta。**量化**:GPTQ + AWQ + GGUF,以实现部署灵活性。**部署**:带 EAGLE-3 推测头的 vLLM 0.7(或带 SpecForge 的 SGLang),K8s 部署,基于队列等待时间的 HPA。

消融实验是核心交付成果:在三个特定任务的基准上,对比 SFT-only 与 SFT+DPO 以及 SFT+GRPO。部署指标:batch 1 / 8 / 32 下的 tokens/s、EAGLE-3 接受率、$/1M tokens。安全评估:Llama Guard 4 通过率。模型卡:偏见评估、可复现种子、数据许可。

## 架构

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

## 技术栈

- 数据:Datatrove 用于去重,Nemotron-CC 分类器用于质量,Presidio 用于 PII
- 基础模型:Llama 3.3 8B、Qwen3 14B 或 Gemma 3 12B
- SFT:带 ZeRO-3 的 Axolotl v0.8、Flash Attention 3、序列打包
- 偏好调优:TRL 0.15 用于 DPO 或 GRPO;Unsloth 用于单 GPU 迭代
- 量化:GPTQ (Marlin)、AWQ、通过 llama.cpp 生成 GGUF
- 部署:带 EAGLE-3 推测解码的 vLLM 0.7(或 SGLang 0.4 + SpecForge)
- 评估:lm-evaluation-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro
- 安全评估:Llama Guard 4、ShieldGemma-2
- 基础设施:Kubernetes + NVIDIA device plugin,基于队列等待时间指标的 HPA
- 可观测性:W&B 用于训练,Langfuse 用于推理

```figure
ce-finetune-stages
```

## 实现步骤

1. **数据流水线。** 在原始语料库上运行 Datatrove 去重。应用 Nemotron-CC 风格的质量分类器。使用 Presidio 清洗 PII。使用显式种子编写 train/val 切分。

2. **污染检查。** 针对每一个验证集切分,计算与 MMLU-Pro、MT-Bench-v2、RewardBench-2 测试集的 MinHash 相似度。拒绝任何重叠。

3. **Axolotl SFT。** 包含 ZeRO-3、FA3、序列打包的 YAML。在 8xH100 上训练 2-3 个 epoch。记录到 W&B。

4. **TRL DPO / GRPO。** 获取 SFT 检查点,在偏好对上运行一个 epoch 的 DPO(或在数学/代码任务上使用可验证奖励运行 GRPO)。扫描 beta。

5. **量化。** 生成三个量化模型:GPTQ-INT4-Marlin、AWQ-INT4、用于 llama.cpp 的 GGUF-Q4_K_M。记录大小和标称吞吐量。

6. **使用推测解码进行部署。** 使用通过 Red Hat Speculators 训练的 EAGLE-3 草稿头配置 vLLM 0.7。测量 batch 1 / 8 / 32 下的接受率和尾延迟。在相同的评估集上,将 $/1M tokens 与 Anthropic / OpenAI 进行对比汇报。

7. **评估矩阵。** 在基础模型、SFT-only、SFT+DPO、SFT+GRPO 上运行 lm-eval-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro。生成一个对比表。

8. **安全评估。** 在开发集上运行 Llama Guard 4 通过率测试。添加 ShieldGemma-2 输出过滤器。

9. **模型卡。** MOF 2026 模板:数据、训练、评估、安全、许可,以及包含 YAML 配置和 commit SHAs 的可复现性章节。

## 应用

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

## 成果交付

`outputs/skill-finetuning-pipeline.md` 描述了交付成果。只需一条命令即可执行从数据到 SFT 到 DPO 到量化再到部署再到评估的全流程,并生成一份模型卡及已部署的端点。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 相比基础模型的评估提升 | 在目标任务上的衡量收益(MMLU-Pro、MT-Bench-v2、特定任务) |
| 20 | 流水线可复现性 | 使用相同的种子,一条命令端到端重新运行 |
| 20 | 数据卫生 | 去重率、PII 清洗覆盖率、污染检查通过 |
| 20 | 部署效率 | bs=1/8/32 下的 tokens/s、EAGLE-3 接受率、$/1M tokens |
| 15 | 模型卡 + 安全评估 | 2026 MOF 完整性 + Llama Guard 4 通过率 |
| **100** | | |

## 练习

1. 在相同的特定任务基准上运行 SFT-only、SFT+DPO、SFT+GRPO。汇报哪种偏好调优方法胜出,以及胜出多少。

2. 将 Llama 3.3 8B 换为 Qwen3 14B。在相同质量下衡量 $/1M tokens。

3. 衡量 EAGLE-3 在领域数据与通用 ShareGPT 上的接受率。汇报差异及其对延迟预算的意义。

4. 注入 1% 的污染(将 MMLU-Pro 答案泄露到训练数据中),然后重新运行评估。观察 MMLU-Pro 准确率出现不切实际的暴涨。构建一个能够捕捉此问题的污染检查 CI 门禁。

5. 增加 LoRA SFT 作为全量微调的替代方案。在显存降低 10 倍的情况下衡量质量差距。

## 核心术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Axolotl | "SFT 训练器" | 用于 SFT、DPO 和蒸馏的统一 YAML 驱动训练器 |
| TRL | "偏好调优器" | 用于在 LLM 上进行 DPO、GRPO、PPO 的 Hugging Face 库 |
| GRPO | "组相对策略优化" | DeepSeek R1 使用可验证奖励的 RL 方案 |
| EAGLE-3 | "推测解码草稿" | 可以提前预测 N 个 token 的草稿头;由 vLLM 使用目标模型进行验证 |
| MOF | "Model Openness Framework" | 用于对模型发布的数据、代码、许可进行评级的 2026 标准 |
| 污染检查 | "切分卫生" | 基于 MinHash 的测试集泄露到训练集的检测 |
| 接受率 | "EAGLE / MTP 指标" | 草稿模型生成的 token 中被目标模型接受的比例 |

## 延伸阅读

- [Axolotl 文档](https://axolotl-ai-cloud.github.io/axolotl/) — 参考 SFT / DPO 训练器
- [TRL 文档](https://huggingface.co/docs/trl) — DPO 和 GRPO 参考实现
- [Unsloth](https://github.com/unslothai/unsloth) — 单 GPU 迭代参考
- [DeepSeek R1 论文 (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — GRPO 方法论
- [vLLM + EAGLE-3 文档](https://docs.vllm.ai) — 参考部署技术栈
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — 替代推测解码训练器
- [Model Openness Framework 2026](https://isocpp.org/) — 开源发布评级标准
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) — 规范化评估运行器