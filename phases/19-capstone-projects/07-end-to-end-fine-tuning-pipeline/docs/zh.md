# 顶点项目 07 —— 端到端微调管道（数据到 SFT 到 DPO 到服务）

> 一个在你自己数据上训练的 8B 模型，在你自己偏好上 DPO 对齐，量化，投机解码，并以可测量的 $/1M token 提供服务。2026 年的开源栈是 Axolotl v0.8、TRL 0.15、Unsloth 用于迭代、GPTQ/AWQ/GGUF 用于量化、vLLM 0.7 带 EAGLE-3 用于服务。顶点项目是端到端可复现地运行整个管道——YAML 输入，服务端点输出——并在 2026 年模型开放框架下发布模型卡片。

**类型：** 顶点项目
**语言：** Python（管道）、YAML（配置）、Bash（脚本）
**先决条件：** Phase 2（ML）、Phase 3（DL）、Phase 7（transformers）、Phase 10（从头开始 LLM）、Phase 11（LLM 工程）、Phase 17（基础设施）、Phase 18（安全）
**涉及阶段：** P2 · P3 · P7 · P10 · P11 · P17 · P18
**时间：** 35 小时

## 问题

2026 年，每个严肃的 AI 团队都随时保持微调管道。不是因为他们发布前沿基础模型，而是因为下游适应——领域 SFT、针对标记偏好的 DPO、用于投机解码的蒸馏草稿、用 EAGLE-3 服务——是可测量胜利所在的地方。Axolotl v0.8 处理多 GPU SFT 配置。TRL 0.15 处理 DPO 和 GRPO。Unsloth 让你快速单 GPU 迭代。vLLM 0.7 带 EAGLE-3 将解码吞吐量提升 2-3 倍，没有质量损失。工具有效；技艺在于 YAML、数据卫生和评估纪律。

你将运行一个 8B 基础模型（Llama 3.3、Qwen3 或 Gemma 3），通过 SFT 然后 DPO 处理任务特定数据，量化用于服务，并在 lm-evaluation-harness、RewardBench-2、MT-Bench-v2 和 MMLU-Pro 上测量增益。你将在 2026 年模型开放框架下生成模型卡片。重点是可复现性——一个命令端到端重新运行整个管道。

## 概念

管道有五个阶段。**数据**：去重（MinHash / Datatrove）、质量过滤（Nemotron-CC 风格分类器）、PII 清洗、针对公共基准污染的拆分卫生检查。**SFT**：Axolotl YAML、8xH100 上的 ZeRO-3、余弦调度、打包序列、2-3 轮次。**DPO 或 GRPO**：TRL 配置、1 轮次、偏好对（人工标记或模型评判）、beta 调优。**量化**：GPTQ + AWQ + GGUF 用于部署灵活性。**服务**：vLLM 0.7 带 EAGLE-3 投机头（或 SGLang 带 SpecForge），K8s 部署，队列等待上的 HPA。

消融是可交付成果：仅 SFT vs SFT+DPO vs SFT+GRPO 在三个任务特定基准上。服务指标：批处理 1/8/32 的 token/s、EAGLE-3 接受率、$/1M token。安全评估：Llama Guard 4 通过率。模型卡片：偏见评估、可复现性种子、数据许可。

## 架构

```
原始数据（HF 数据集 + 内部）
    |
    v
Datatrove 去重 + Nemotron-CC 质量过滤 + PII 清洗
    |
    v
拆分卫生（MMLU-Pro 污染检查）
    |
    v
Axolotl SFT 配置（YAML）  ---> 8xH100，ZeRO-3
    |
    v
TRL DPO / GRPO 配置       ---> 4xH100，1 轮次
    |
    v
GPTQ + AWQ + GGUF 量化
    |
    v
vLLM 0.7 + EAGLE-3 投机解码
    |
    v
K8s 部署，队列等待上的 HPA
    |
    v
lm-eval-harness + RewardBench-2 + MT-Bench-v2 + MMLU-Pro
    |
    v
模型卡片（2026 MOF）+ 安全评估（Llama Guard 4）
```

## 技术栈

- 数据：Datatrove 用于去重，Nemotron-CC 分类器用于质量，Presidio 用于 PII
- 基础：Llama 3.3 8B、Qwen3 14B 或 Gemma 3 12B
- SFT：Axolotl v0.8，带 ZeRO-3、Flash Attention 3、打包序列
- 偏好调优：TRL 0.15 用于 DPO 或 GRPO；Unsloth 用于单 GPU 迭代
- 量化：GPTQ（Marlin）、AWQ、通过 llama.cpp 的 GGUF
- 服务：vLLM 0.7，带 EAGLE-3 投机解码（或 SGLang 0.4 + SpecForge）
- 评估：lm-evaluation-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro
- 安全评估：Llama Guard 4、ShieldGemma-2
- 基础设施：Kubernetes + NVIDIA 设备插件，队列等待指标上的 HPA
- 可观察性：训练用 W&B，推理用 Langfuse

## 构建它

1. **数据管道。** 在原始语料库上运行 Datatrove 去重。应用 Nemotron-CC 风格质量分类器。Presidio 清洗 PII。用显式种子写入训练/验证拆分。

2. **污染检查。** 对于每个验证拆分，针对 MMLU-Pro、MT-Bench-v2、RewardBench-2 测试集计算 MinHash。拒绝任何重叠。

3. **Axolotl SFT。** YAML，带 ZeRO-3、FA3、序列打包。8xH100 上 2-3 轮次。记录到 W&B。

4. **TRL DPO / GRPO。** 取 SFT 检查点，在偏好对（或数学/代码上可验证奖励的 GRPO）上运行一 epoch DPO。扫描 beta。

5. **量化。** 生成三种量化：GPTQ-INT4-Marlin、AWQ-INT4、GGUF-Q4_K_M 用于 llama.cpp。记录大小和标称吞吐量。

6. **带投机解码的服务。** vLLM 0.7 配置，带通过 Red Hat Speculators 训练的 EAGLE-3 草稿头。测量批处理 1/8/32 的接受率和尾部延迟。报告 $/1M token 与相同评估上的 Anthropic / OpenAI 对比。

7. **评估矩阵。** 在基础、仅 SFT、SFT+DPO、SFT+GRPO 上运行 lm-eval-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro。生成表格。

8. **安全评估。** 开发集上的 Llama Guard 4 通过率。ShieldGemma-2 输出过滤器。

9. **模型卡片。** MOF 2026 模板：数据、训练、评估、安全、许可、可复现性部分，带 YAML 和提交 SHA。

## 使用它

```
$ ./pipeline.sh config/llama3.3-8b-domainX.yaml
[data]    300k 去重，12k 过滤，280k 接受（种子=7）
[SFT]     3 轮次，8xH100，6 小时 12 分钟，验证损失 1.42 -> 1.03
[DPO]     1 轮次，beta=0.08，4xH100，1 小时 40 分钟
[quant]   GPTQ-INT4 4.6 GB，AWQ-INT4 4.8 GB，GGUF-Q4_K_M 5.1 GB
[serve]   vLLM 0.7，EAGLE-3 接受率 0.74，p99 126 毫秒 @ bs=8
[eval]    MMLU-Pro +3.2，MT-Bench-v2 +0.41，RewardBench-2 +0.08
[card]    在 2026 MOF 下生成 model-card.md
```

## 交付它

`outputs/skill-finetuning-pipeline.md` 描述可交付成果。一个命令运行数据到 SFT 到 DPO 到量化到服务到评估，并发出模型卡片 + 服务端点。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 与基础模型的评估差异 | 目标任务上的测量增益（MMLU-Pro、MT-Bench-v2、任务特定） |
| 20 | 管道可复现性 | 一个命令用相同种子端到端重新运行 |
| 20 | 数据卫生 | 去重率、PII 清洗覆盖率、污染检查通过 |
| 20 | 服务效率 | bs=1/8/32 的 token/s、EAGLE-3 接受率、$/1M token |
| 15 | 模型卡片 + 安全评估 | 2026 MOF 完整性 + Llama Guard 4 通过率 |
| **100** | | |

## 练习

1. 在同一任务特定基准上运行仅 SFT vs SFT+DPO vs SFT+GRPO。报告哪种偏好方法获胜以及赢多少。

2. 将 Llama 3.3 8B 换成 Qwen3 14B。测量匹配质量下的 $/1M token。

3. 在领域数据与通用 ShareGPT 上测量 EAGLE-3 接受率。报告差异及其对延迟预算的含义。

4. 注入 1% 污染（将 MMLU-Pro 答案泄露到训练数据中）并重新运行评估。观察 MMLU-Pro 准确性不现实地跳跃。构建捕获此问题的污染检查 CI 门。

5. 添加 LoRA SFT 作为全微调的替代。测量 10 倍更低内存下的质量差距。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| Axolotl | "SFT 训练器" | 用于 SFT、DPO 和蒸馏的统一 YAML 驱动训练器 |
| TRL | "偏好调优器" | Hugging Face 的 LLM DPO、GRPO、PPO 库 |
| GRPO | "组相对策略优化" | DeepSeek R1 的带可验证奖励的 RL 配方 |
| EAGLE-3 | "投机解码草稿" | 预测 N 个 token 的草稿头；vLLM 用目标模型验证 |
| MOF | "模型开放框架" | 2026 年标准，用于根据数据、代码、许可对模型发布进行评分 |
| 污染检查 | "拆分卫生" | 基于 MinHash 的测试集泄露到训练中的检测 |
| 接受率 | "EAGLE / MTP 指标" | 目标模型接受的草稿 token 比例 |

## 延伸阅读

- [Axolotl 文档](https://axolotl-ai-cloud.github.io/axolotl/) —— 参考 SFT / DPO 训练器
- [TRL 文档](https://huggingface.co/docs/trl) —— DPO 和 GRPO 参考实现
- [Unsloth](https://github.com/unslothai/unsloth) —— 单 GPU 迭代参考
- [DeepSeek R1 论文 (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) —— GRPO 方法论
- [vLLM + EAGLE-3 文档](https://docs.vllm.ai) —— 参考服务栈
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) —— 替代投机解码训练器
- [Model Openness Framework 2026](https://isocpp.org/) —— 开放发布评分标准
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) —— 经典评估运行器
