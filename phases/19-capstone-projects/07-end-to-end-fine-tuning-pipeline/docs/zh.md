# 顶点项目 07 — 端到端微调流水线（从数据到 SFT 到 DPO 到服务部署）

> 用你自己的数据训练一个 8B 模型，用你自己的偏好进行 DPO 对齐，量化、推测解码并以可度量的每百万 token 成本提供服务。2026 年的开源技术栈包括 Axolotl v0.8、TRL 0.15、Unsloth（用于快速迭代）、GPTQ/AWQ/GGUF（用于量化）、vLLM 0.7 + EAGLE-3（用于服务）。本顶点项目的目标是使整个流水线可复现——YAML 配置输入，服务端点输出——并按照 2026 年模型开放框架发布模型卡片。

**类型：** 顶点项目
**语言：** Python（流水线）、YAML（配置）、Bash（脚本）
**前置要求：** 阶段 2（机器学习）、阶段 3（深度学习）、阶段 7（Transformers）、阶段 10（从头实现 LLM）、阶段 11（LLM 工程）、阶段 17（基础设施）、阶段 18（安全）
**涉及阶段：** P2 · P3 · P7 · P10 · P11 · P17 · P18
**时间：** 35 小时

## 问题

2026 年的每一支严肃 AI 团队都会维护一条微调流水线。不是因为他们要交付一个前沿基础模型，而是因为下游适配——领域 SFT、基于标注偏好的 DPO、用于推测解码的精简草稿、使用 EAGLE-3 提供服务——才是可度量收益所在。Axolotl v0.8 处理多 GPU SFT 配置。TRL 0.15 处理 DPO 和 GRPO。Unsloth 实现快速单 GPU 迭代。vLLM 0.7 配合 EAGLE-3 将解码吞吐量提升 2-3 倍而不损失质量。工具已经就绪；真正的技艺在于 YAML 配置、数据卫生和评估纪律。

你将使用一个 8B 基础模型（Llama 3.3、Qwen3 或 Gemma 3）在任务特定数据上依次执行 SFT 和 DPO，为服务部署进行量化，并通过 lm-evaluation-harness、RewardBench-2、MT-Bench-v2 和 MMLU-Pro 度量收益。你将按照 2026 年模型开放框架生成模型卡片。关键在于可复现性——一条命令就能端到端地重新运行整个流水线。

## 概念

流水线包含五个阶段。**数据**：去重（MinHash / Datatrove）、质量过滤（Nemotron-CC 风格分类器）、PII 擦除、针对公开基准污染的分割卫生检查。**SFT**：Axolotl YAML 配置，ZeRO-3 在 8×H100 上运行，余弦调度，序列打包，2-3 个 epoch。**DPO 或 GRPO**：TRL 配置，1 个 epoch，偏好对由人工标注或模型评判，beta 调优。**量化**：GPTQ + AWQ + GGUF 以实现部署灵活性。**服务部署**：vLLM 0.7 配合 EAGLE-3 推测头（或 SGLang 配合 SpecForge），K8s 部署，基于队列等待时间的 HPA。

消融对比是最终交付物：在三个任务特定基准上比较 SFT-only vs SFT+DPO vs SFT+GRPO。服务指标：批大小 1/8/32 下的 token/s、EAGLE-3 接受率、每百万 token 成本。安全评估：Llama Guard 4 通过率。模型卡片：偏差评估、可复现性种子、数据许可。

## 架构

```
原始数据（HF datasets + 内部数据）
    │
    ▼
Datatrove 去重 + Nemotron-CC 质量过滤 + PII 擦除
    │
    ▼
分割卫生（MMLU-Pro 污染检查）
    │
    ▼
Axolotl SFT 配置（YAML）  ───▶  8×H100, ZeRO-3
    │
    ▼
TRL DPO / GRPO 配置       ───▶  4×H100, 1 epoch
    │
    ▼
GPTQ + AWQ + GGUF 量化
    │
    ▼
vLLM 0.7 + EAGLE-3 推测解码
    │
    ▼
K8s 部署，基于队列等待时间的 HPA
    │
    ▼
lm-eval-harness + RewardBench-2 + MT-Bench-v2 + MMLU-Pro
    │
    ▼
模型卡片（2026 MOF）+ 安全评估（Llama Guard 4）
```

## 技术栈

- 数据：Datatrove（去重）、Nemotron-CC 分类器（质量）、Presidio（PII）
- 基础模型：Llama 3.3 8B、Qwen3 14B 或 Gemma 3 12B
- SFT：Axolotl v0.8，配合 ZeRO-3、Flash Attention 3、序列打包
- 偏好调优：TRL 0.15 用于 DPO 或 GRPO；Unsloth 用于单 GPU 迭代
- 量化：GPTQ（Marlin）、AWQ、GGUF（通过 llama.cpp）
- 服务部署：vLLM 0.7 配合 EAGLE-3 推测解码（或 SGLang 0.4 + SpecForge）
- 评估：lm-evaluation-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro
- 安全评估：Llama Guard 4、ShieldGemma-2
- 基础设施：Kubernetes + NVIDIA 设备插件，基于队列等待时间指标的 HPA
- 可观测性：W&B（训练）、Langfuse（推理）

## 构建步骤

1. **数据流水线。** 对原始语料运行 Datatrove 去重。应用 Nemotron-CC 风格质量分类器。Presidio 擦除 PII。使用显式种子写入训练/验证分割。

2. **污染检查。** 对每个验证分割，计算与 MMLU-Pro、MT-Bench-v2、RewardBench-2 测试集的 MinHash。拒绝任何重叠。

3. **Axolotl SFT。** 配置 YAML，包含 ZeRO-3、FA3、序列打包。在 8×H100 上训练 2-3 个 epoch。记录到 W&B。

4. **TRL DPO / GRPO。** 以 SFT 检查点为起点，在偏好对上运行一个 epoch 的 DPO（或在数学/代码任务上使用带可验证奖励的 GRPO）。调优 beta。

5. **量化。** 生成三种量化版本：GPTQ-INT4-Marlin、AWQ-INT4、GGUF-Q4_K_M（用于 llama.cpp）。记录模型大小和标称吞吐量。

6. **使用推测解码提供服务。** vLLM 0.7 配置，使用通过 Red Hat Speculators 训练的 EAGLE-3 草稿头。在批大小 1/8/32 下测量接受率和尾延迟。报告与 Anthropic / OpenAI 在同一评估上的每百万 token 成本对比。

7. **评估矩阵。** 在基础模型、SFT-only、SFT+DPO、SFT+GRPO 上运行 lm-eval-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro。生成对比表格。

8. **安全评估。** 在开发集上计算 Llama Guard 4 通过率。部署 ShieldGemma-2 输出过滤器。

9. **模型卡片。** MOF 2026 模板：数据、训练、评估、安全、许可、包含 YAML 和提交 SHA 的可复现性部分。

## 使用方式

```
$ ./pipeline.sh config/llama3.3-8b-domainX.yaml
[data]    30 万条去重，1.2 万条过滤，28 万条接受（种子=7）
[SFT]     3 个 epoch，8×H100，6 小时 12 分，验证损失 1.42 → 1.03
[DPO]     1 个 epoch，beta=0.08，4×H100，1 小时 40 分
[quant]   GPTQ-INT4 4.6 GB，AWQ-INT4 4.8 GB，GGUF-Q4_K_M 5.1 GB
[serve]   vLLM 0.7，EAGLE-3 接受率 0.74，p99 126ms @ bs=8
[eval]    MMLU-Pro +3.2，MT-Bench-v2 +0.41，RewardBench-2 +0.08
[card]    model-card.md 已生成（2026 MOF 标准）
```

## 交付标准

`outputs/skill-finetuning-pipeline.md` 描述了交付物。一条命令即可依次运行数据→SFT→DPO→量化→服务→评估，并生成模型卡片和服务端点。

| 权重 | 评审标准 | 衡量方式 |
|:-:|---|---|
| 25 | 相对于基础模型的评估提升 | 在目标任务上的可度量增益（MMLU-Pro、MT-Bench-v2、任务特定指标） |
| 20 | 流水线可复现性 | 一条命令端到端重新运行，具有相同种子 |
| 20 | 数据卫生 | 去重率、PII 擦除覆盖率、污染检查通过 |
| 20 | 服务效率 | 批大小 1/8/32 下的 token/s、EAGLE-3 接受率、每百万 token 成本 |
| 15 | 模型卡片 + 安全评估 | 2026 MOF 完整性 + Llama Guard 4 通过率 |
| **100** | | |

## 练习

1. 在同一任务特定基准上运行 SFT-only vs SFT+DPO vs SFT+GRPO。报告哪种偏好方法胜出以及领先幅度。

2. 将 Llama 3.3 8B 替换为 Qwen3 14B。在相同质量水平下衡量每百万 token 成本。

3. 在领域数据与通用 ShareGPT 数据上测量 EAGLE-3 接受率。报告差异及其对延迟预算的影响。

4. 注入 1% 的污染（将 MMLU-Pro 答案泄露到训练数据中）并重新运行评估。观察 MMLU-Pro 准确率异常飙升。构建一个污染检查 CI 关卡来捕获此类问题。

5. 添加 LoRA SFT 作为全参数微调的替代方案。测量在内存降低 10 倍情况下的质量差距。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------|---------|
| Axolotl | "SFT 训练器" | 统一的 YAML 驱动训练器，支持 SFT、DPO 和蒸馏 |
| TRL | "偏好调优器" | Hugging Face 库，支持 LLM 的 DPO、GRPO、PPO |
| GRPO | "组相对策略优化" | DeepSeek R1 的强化学习方案，使用可验证奖励 |
| EAGLE-3 | "推测解码草稿" | 预测 N 个后续 token 的草稿头；vLLM 用目标模型验证 |
| MOF | "模型开放框架" | 2026 年标准，用于从数据、代码、许可维度对模型发布进行分级 |
| 污染检查 | "分割卫生" | 基于 MinHash 的测试集泄露检测 |
| 接受率 | "EAGLE / MTP 指标" | 目标模型接受的草稿 token 比例 |

## 延伸阅读

- [Axolotl 文档](https://axolotl-ai-cloud.github.io/axolotl/) — 参考 SFT / DPO 训练器
- [TRL 文档](https://huggingface.co/docs/trl) — DPO 和 GRPO 参考实现
- [Unsloth](https://github.com/unslothai/unsloth) — 单 GPU 迭代参考
- [DeepSeek R1 论文 (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — GRPO 方法论
- [vLLM + EAGLE-3 文档](https://docs.vllm.ai) — 参考服务栈
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — 替代推测解码训练器
- [模型开放框架 2026](https://isocpp.org/) — 开源发布分级标准
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) — 标准评估运行器
