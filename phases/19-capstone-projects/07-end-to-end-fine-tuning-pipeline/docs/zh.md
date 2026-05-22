# 综合项目 07 — 端到端微调管道（数据到 SFT 到 DPO 到服务部署）

> 一个在你自己的数据上训练的 8B 模型，用你自己的偏好进行 DPO 对齐，量化，推测解码，并以可测量的 $/1M token 提供服务。2026 年的开源技术栈是 Axolotl v0.8、TRL 0.15、用于迭代的 Unsloth、用于量化的 GPTQ/AWQ/GGUF、用于服务部署的带有 EAGLE-3 的 vLLM 0.7。本综合项目是端到端可重现地运行整个管道——YAML 输入，服务端点输出——并在 2026 年模型开放框架下发布模型卡片。

**类型：** 综合项目
**语言：** Python（管道）、YAML（配置）、Bash（脚本）
**前置条件：** 第 2 阶段（ML）、第 3 阶段（DL）、第 7 阶段（Transformer）、第 10 阶段（从零构建 LLM）、第 11 阶段（LLM 工程）、第 17 阶段（基础设施）、第 18 阶段（安全）
**涉及阶段：** P2 · P3 · P7 · P10 · P11 · P17 · P18
**时间：** 35 小时

## 问题描述

2026 年每个严肃的 AI 团队都保留着一个微调管道。不是因为他们交付前沿基础模型，而是因为下游适配——领域 SFT、针对标注偏好的 DPO、用于推测解码的蒸馏草稿、使用 EAGLE-3 的服务部署——是可测量收益所在。Axolotl v0.8 处理多 GPU SFT 配置。TRL 0.15 处理 DPO 和 GRPO。Unsloth 让你快速进行单 GPU 迭代。带有 EAGLE-3 的 vLLM 0.7 在无质量损失的情况下将解码吞吐量提升 2-3 倍。工具可以工作；工艺在于 YAML、数据卫生和评估纪律。

你将通过一个 8B 基座模型（Llama 3.3、Qwen3 或 Gemma 3），在特定任务数据上依次进行 SFT 然后 DPO，量化以提供服务，并针对 lm-evaluation-harness、RewardBench-2、MT-Bench-v2 和 MMLU-Pro 测量收益。你将在 2026 年模型开放框架下生成模型卡片。关键在于可重现性——一个命令重新运行整个端到端管道。

## 核心概念

管道有五个阶段。**数据**：去重（MinHash / Datatrove）、质量过滤器（Nemotron-CC 风格分类器）、PII 清理、针对公共基准污染的训练/验证分割卫生检查。**SFT**：Axolotl YAML、8xH100 上的 ZeRO-3、余弦调度、打包序列、2-3 个 epoch。**DPO 或 GRPO**：TRL 配置、1 个 epoch、人工标注或模型评判的偏好对、beta 调优。**量化**：GPTQ + AWQ + GGUF 以灵活部署。**服务部署**：带有 EAGLE-3 推测头的 vLLM 0.7（或带有 SpecForge 的 SGLang）、K8s 部署、基于队列等待的 HPA。

消融研究是可交付成果：在三个特定任务基准上比较仅 SFT vs SFT+DPO vs SFT+GRPO。服务指标：批次 1 / 8 / 32 时的 tokens/s、EAGLE-3 接受率、$/1M tokens。安全评估：Llama Guard 4 通过率。模型卡片：偏见评估、可重现性种子、数据许可。

## 架构

```
原始数据（HF 数据集 + 内部）
    |
    v
Datatrove 去重 + Nemotron-CC 质量过滤器 + PII 清理
    |
    v
分割卫生（MMLU-Pro 污染检查）
    |
    v
Axolotl SFT 配置（YAML）  ---> 8xH100，ZeRO-3
    |
    v
TRL DPO / GRPO 配置       ---> 4xH100，1 个 epoch
    |
    v
GPTQ + AWQ + GGUF 量化
    |
    v
vLLM 0.7 + EAGLE-3 推测解码
    |
    v
K8s 部署，基于队列等待的 HPA
    |
    v
lm-eval-harness + RewardBench-2 + MT-Bench-v2 + MMLU-Pro
    |
    v
模型卡片（2026 MOF）+ 安全评估（Llama Guard 4）
```

## 技术栈

- 数据：Datatrove 用于去重、Nemotron-CC 分类器用于质量、Presidio 用于 PII
- 基座：Llama 3.3 8B、Qwen3 14B 或 Gemma 3 12B
- SFT：带有 ZeRO-3、Flash Attention 3、打包序列的 Axolotl v0.8
- 偏好调优：用于 DPO 或 GRPO 的 TRL 0.15；Unsloth 用于单 GPU 迭代
- 量化：GPTQ（Marlin）、AWQ、通过 llama.cpp 的 GGUF
- 服务部署：带有 EAGLE-3 推测解码的 vLLM 0.7（或带有 SpecForge 的 SGLang 0.4）
- 评估：lm-evaluation-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro
- 安全评估：Llama Guard 4、ShieldGemma-2
- 基础设施：Kubernetes + NVIDIA 设备插件、基于队列等待指标的 HPA
- 可观测性：用于训练的 W&B、用于推理的 Langfuse

## 构建步骤

1. **数据管道。** 对原始语料库运行 Datatrove 去重。应用 Nemotron-CC 风格的质量分类器。Presidio 清理 PII。用显式种子写入训练/验证分割。

2. **污染检查。** 对于每个验证分割，针对 MMLU-Pro、MT-Bench-v2、RewardBench-2 测试集计算 MinHash。拒绝任何重叠。

3. **Axolotl SFT。** 带有 ZeRO-3、FA3、序列打包的 YAML。在 8xH100 上运行 2-3 个 epoch。记录到 W&B。

4. **TRL DPO / GRPO。** 使用 SFT 检查点，在偏好对上运行一个 epoch 的 DPO（或在数学/代码上使用可验证奖励的 GRPO）。扫描 beta。

5. **量化。** 生成三个量化版本：用于 llama.cpp 的 GPTQ-INT4-Marlin、AWQ-INT4、GGUF-Q4_K_M。记录大小和标称吞吐量。

6. **使用推测解码提供服务。** 带有通过 Red Hat Speculators 训练的 EAGLE-3 草稿头的 vLLM 0.7 配置。在批次 1 / 8 / 32 时测量接受率和尾部延迟。报告在相同评估下与 Anthropic / OpenAI 的 $/1M tokens 对比。

7. **评估矩阵。** 在基座、仅 SFT、SFT+DPO、SFT+GRPO 上运行 lm-eval-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro。生成表格。

8. **安全评估。** 开发集上的 Llama Guard 4 通过率。ShieldGemma-2 输出过滤器。

9. **模型卡片。** MOF 2026 模板：数据、训练、评估、安全、许可证、带有 YAML 和提交 SHA 的可重现性部分。

## 使用示例

```
$ ./pipeline.sh config/llama3.3-8b-domainX.yaml
[data]    30 万去重后，1.2 万过滤，28 万接受（种子=7）
[SFT]     3 个 epoch，8xH100，6 小时 12 分钟，验证损失 1.42 -> 1.03
[DPO]     1 个 epoch，beta=0.08，4xH100，1 小时 40 分钟
[quant]   GPTQ-INT4 4.6 GB，AWQ-INT4 4.8 GB，GGUF-Q4_K_M 5.1 GB
[serve]   vLLM 0.7，EAGLE-3 接受率 0.74，p99 126ms @ bs=8
[eval]    MMLU-Pro +3.2，MT-Bench-v2 +0.41，RewardBench-2 +0.08
[card]    在 2026 MOF 下生成 model-card.md
```

## 交付成果

`outputs/skill-finetuning-pipeline.md` 描述了可交付成果。一个命令运行数据，通过 SFT、通过 DPO、通过量化、通过服务部署、通过评估，并发出模型卡片 + 服务端点。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 与基座的评估差异 | 在目标任务上测量的收益（MMLU-Pro、MT-Bench-v2、特定任务） |
| 20 | 管道可重现性 | 一个命令用相同种子重新运行端到端 |
| 20 | 数据卫生 | 去重率、PII 清理覆盖率、污染检查通过 |
| 20 | 服务效率 | bs=1/8/32 时的 tokens/s、EAGLE-3 接受率、$/1M tokens |
| 15 | 模型卡片 + 安全评估 | 2026 MOF 完整性 + Llama Guard 4 通过率 |
| **100** | | |

## 练习

1. 在同一特定任务基准上运行仅 SFT vs SFT+DPO vs SFT+GRPO。报告哪种偏好方法胜出，以及胜出多少。

2. 将 Llama 3.3 8B 换为 Qwen3 14B。在匹配质量下测量 $/1M tokens。

3. 在领域数据和通用 ShareGPT 上测量 EAGLE-3 接受率。报告差异及其对延迟预算的意义。

4. 注入 1% 的污染（将 MMLU-Pro 答案泄漏到训练数据中）并重新运行评估。观察 MMLU-Pro 准确性不现实地跃升。构建一个捕获此问题的污染检查 CI 门控。

5. 添加 LoRA SFT 作为全量微调的替代方案。在内存降低 10 倍的情况下测量质量差距。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| Axolotl | "SFT 训练器" | 用于 SFT、DPO 和蒸馏的统一 YAML 驱动训练器 |
| TRL | "偏好调优器" | Hugging Face 库，用于 LLM 上的 DPO、GRPO、PPO |
| GRPO | "组相对策略优化" | 带有可验证奖励的 DeepSeek R1 强化学习方案 |
| EAGLE-3 | "推测解码草稿" | 预测 N 个 token 的前瞻的草稿头；vLLM 用目标模型验证 |
| MOF | "模型开放框架" | 2026 年根据数据、代码、许可证对模型发布进行分级的标准 |
| 污染检查 | "分割卫生" | 基于 MinHash 的检测，防止测试集泄漏到训练中 |
| 接受率 | "EAGLE / MTP 指标" | 目标模型接受的草稿 token 比例 |

## 延伸阅读

- [Axolotl 文档](https://axolotl-ai-cloud.github.io/axolotl/) — 参考 SFT / DPO 训练器
- [TRL 文档](https://huggingface.co/docs/trl) — DPO 和 GRPO 参考实现
- [Unsloth](https://github.com/unslothai/unsloth) — 单 GPU 迭代参考
- [DeepSeek R1 论文 (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — GRPO 方法论
- [vLLM + EAGLE-3 文档](https://docs.vllm.ai) — 参考服务部署技术栈
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — 备选推测解码训练器
- [模型开放框架 2026](https://isocpp.org/) — 开放发布分级标准
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) — 规范评估运行器
