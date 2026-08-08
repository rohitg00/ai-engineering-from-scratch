# 07 · 端到端微调流水线（从数据到 SFT、DPO 到服务部署）

> 一个 8B 模型，基于你自己的数据训练，按你自己的偏好进行 DPO 对齐，量化后以推测解码方式提供服务，并给出可量化的每百万 token 成本。2026 年的开放技术栈是：Axolotl v0.8、TRL 0.15、用于快速迭代的 Unsloth、用于量化的 GPTQ/AWQ/GGUF，以及用于服务部署的 vLLM 0.7 + EAGLE-3。本巅峰项目的目标是以可复现的方式跑通整条流水线——输入 YAML 配置，输出已部署的服务端点——并按照 2026 年模型开放性框架（Model Openness Framework）发布一张模型卡片。

**类型：** 巅峰项目
**语言：** Python（流水线）、YAML（配置）、Bash（脚本）
**前置：** 阶段 2（ML）、阶段 3（DL）、阶段 7（transformers）、阶段 10（从零实现 LLM）、阶段 11（LLM 工程）、阶段 17（基础设施）、阶段 18（安全）
**涉及阶段：** P2 · P3 · P7 · P10 · P11 · P17 · P18
**时长：** 35 小时

## 问题

2026 年，每个认真做事的 AI 团队都会维护一条随时可用的微调流水线。不是因为他们在训前沿基础模型，而是因为下游适配——领域监督微调（SFT）、基于标注偏好的直接偏好优化（DPO）、用于推测解码的蒸馏草稿模型、以及用 EAGLE-3 进行服务部署——才是可量化的收益所在。Axolotl v0.8 负责多 GPU 的 SFT 配置，TRL 0.15 负责 DPO 和 GRPO，Unsloth 让你在单 GPU 上快速迭代，vLLM 0.7 结合 EAGLE-3 可将解码吞吐量提升 2-3 倍而不损失质量。工具链本身是成熟的；真正的技艺在于写好 YAML、做好数据卫生以及制定评估规范。

你将基于一个 8B 基础模型（Llama 3.3、Qwen3 或 Gemma 3），在特定任务数据上依次执行 SFT 和 DPO，然后量化为服务部署做准备，并通过 lm-evaluation-harness、RewardBench-2、MT-Bench-v2 和 MMLU-Pro 评估收益。你需要按照 2026 年模型开放性框架产出一张模型卡片。核心要义是可复现性——一条命令即可端到端复跑整条流水线。

## 概念

流水线包含五个阶段。**数据**：去重（MinHash / Datatrove）、质量过滤（Nemotron-CC 风格的分类器）、个人身份信息（PII）清洗、针对公开基准数据集的划分卫生（split-hygiene）检查以防止污染。**SFT**：Axolotl YAML 配置、8xH100 上的 ZeRO-3、余弦学习率调度、序列打包（packed sequences）、2-3 个 epoch。**DPO 或 GRPO**：TRL 配置、1 个 epoch、偏好对（人工标注或模型评判）、beta 调参。**量化**：GPTQ + AWQ + GGUF 以覆盖不同部署场景。**服务部署**：vLLM 0.7 + EAGLE-3 推测解码草稿头（或 SGLang + SpecForge）、K8s 部署、基于队列等待时间的水平自动扩缩（HPA）。

消融实验是最终的交付产物：在三个特定任务基准上对比 SFT-仅训练 vs SFT+DPO vs SFT+GRPO。服务指标：batch size 为 1 / 8 / 32 下的 tokens/s、EAGLE-3 接受率、每百万 token 成本。安全评估：Llama Guard 4 通过率。模型卡片：偏差评估、可复现的随机种子、数据许可。

## 架构

```
原始数据（HF 数据集 + 内部数据）
    |
    v
Datatrove 去重 + Nemotron-CC 质量过滤 + PII 清洗
    |
    v
划分卫生检查（MMLU-Pro 污染检查）
    |
    v
Axolotl SFT 配置（YAML）  ---> 8xH100, ZeRO-3
    |
    v
TRL DPO / GRPO 配置       ---> 4xH100, 1 epoch
    |
    v
GPTQ + AWQ + GGUF 量化
    |
    v
vLLM 0.7 + EAGLE-3 推测解码
    |
    v
K8s 部署，基于队列等待时间的 HPA
    |
    v
lm-eval-harness + RewardBench-2 + MT-Bench-v2 + MMLU-Pro
    |
    v
模型卡片（2026 MOF）+ 安全评估（Llama Guard 4）
```

## 技术栈

- 数据：Datatrove 做去重，Nemotron-CC 分类器做质量判断，Presidio 做 PII 清洗
- 基础模型：Llama 3.3 8B、Qwen3 14B 或 Gemma 3 12B
- SFT：Axolotl v0.8 + ZeRO-3 + Flash Attention 3 + 序列打包
- 偏好微调：TRL 0.15 做 DPO 或 GRPO；Unsloth 做单 GPU 快速迭代
- 量化：GPTQ（Marlin）、AWQ、GGUF（通过 llama.cpp）
- 服务部署：vLLM 0.7 + EAGLE-3 推测解码（或 SGLang 0.4 + SpecForge）
- 评估：lm-evaluation-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro
- 安全评估：Llama Guard 4、ShieldGemma-2
- 基础设施：Kubernetes + NVIDIA device plugin、基于队列等待时间指标的 HPA
- 可观测性：训练用 W&B，推理用 Langfuse

## 动手搭建

1. **数据流水线。** 对原始语料运行 Datatrove 去重。应用 Nemotron-CC 风格的质量分类器。Presidio 清洗 PII。使用显式随机种子生成训练集和验证集划分。

2. **污染检查。** 对每个验证划分，计算其与 MMLU-Pro、MT-Bench-v2、RewardBench-2 测试集的 MinHash 相似度。拒绝任何重叠。

3. **Axolotl SFT。** YAML 配置 ZeRO-3、FA3、序列打包。8xH100 上训练 2-3 个 epoch。日志记录到 W&B。

4. **TRL DPO / GRPO。** 取 SFT 的 checkpoint，在偏好对上训练一个 epoch 的 DPO（或在数学/代码任务上用可验证奖励做 GRPO）。对 beta 参数做扫描（sweep）。

5. **量化。** 产出三种量化格式：GPTQ-INT4-Marlin、AWQ-INT4、GGUF-Q4_K_M（供 llama.cpp 使用）。记录模型大小和标称吞吐量。

6. **推测解码服务部署。** vLLM 0.7 配置 EAGLE-3 草稿头（通过 Red Hat Speculators 训练）。测量 batch size 1 / 8 / 32 下的接受率和尾延迟（tail latency）。在同一评估上报告每百万 token 成本，并与 Anthropic / OpenAI 对比。

7. **评估矩阵。** 在基础模型、SFT-仅、SFT+DPO、SFT+GRPO 上分别运行 lm-eval-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro。产出对比表格。

8. **安全评估。** 开发集上的 Llama Guard 4 通过率。ShieldGemma-2 输出过滤器。

9. **模型卡片。** MOF 2026 模板：数据、训练、评估、安全、许可证、可复现章节（含 YAML 和 commit SHA）。

## 实际使用

```
$ ./pipeline.sh config/llama3.3-8b-domainX.yaml
[data]    300k 去重后, 12k 被过滤, 280k 通过 (seed=7)
[SFT]     3 epochs, 8xH100, 6h12m, val loss 1.42 -> 1.03
[DPO]     1 epoch, beta=0.08, 4xH100, 1h40m
[quant]   GPTQ-INT4 4.6 GB, AWQ-INT4 4.8 GB, GGUF-Q4_K_M 5.1 GB
[serve]   vLLM 0.7, EAGLE-3 接受率 0.74, p99 126ms @ bs=8
[eval]    MMLU-Pro +3.2, MT-Bench-v2 +0.41, RewardBench-2 +0.08
[card]    model-card.md 已按 2026 MOF 生成
```

## 交付标准

`outputs/skill-finetuning-pipeline.md` 描述了最终交付物。一条命令即可跑完从数据处理到 SFT 到 DPO 到量化到服务部署到评估的全流程，并产出模型卡片与可用服务端点。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 相对于基础模型的评估提升 | 在目标任务上（MMLU-Pro、MT-Bench-v2、任务特定指标）的可量化增益 |
| 20 | 流水线可复现性 | 使用相同随机种子，一条命令即可端到端复跑 |
| 20 | 数据卫生 | 去重率、PII 清洗覆盖率、污染检查通过 |
| 20 | 服务效率 | bs=1/8/32 下的 tokens/s、EAGLE-3 接受率、每百万 token 成本 |
| 15 | 模型卡片 + 安全评估 | 2026 MOF 完整度 + Llama Guard 4 通过率 |
| **100** | | |

## 练习

1. 在同一任务特定基准上对比 SFT-仅 vs SFT+DPO vs SFT+GRPO。报告哪种偏好训练方法胜出及差距。

2. 将 Llama 3.3 8B 替换为 Qwen3 14B。在同等质量水平下测量每百万 token 成本。

3. 在领域数据与通用 ShareGPT 数据上分别测量 EAGLE-3 接受率。报告差值及其对延迟预算的影响。

4. 注入 1% 的污染数据（将 MMLU-Pro 答案泄露到训练数据中）并重新评估。观察 MMLU-Pro 精度出现不合理的跳升。构建一个能捕获此问题的污染检查 CI 关卡。

5. 添加 LoRA SFT 作为全量微调的替代方案，在内存降低 10 倍的条件下测量质量差距。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|----------|
| Axolotl | "SFT 训练器" | 统一的 YAML 驱动训练器，支持 SFT、DPO 和蒸馏 |
| TRL | "偏好微调器" | Hugging Face 的 LLM DPO、GRPO、PPO 库 |
| GRPO | "组相对策略优化" | DeepSeek R1 使用的基于可验证奖励的强化学习方案 |
| EAGLE-3 | "推测解码草稿" | 预测接下来 N 个 token 的草稿头；vLLM 用目标模型验证 |
| MOF | "模型开放性框架" | 2026 年从数据、代码、许可证维度对模型发布进行评级的开放标准 |
| 污染检查 | "划分卫生" | 基于 MinHash 检测测试集数据是否泄漏到训练集中 |
| 接受率 | "EAGLE / MTP 指标" | 草稿模型预测的 token 中被目标模型接受的比例 |

## 延伸阅读

- [Axolotl 文档](https://axolotl-ai-cloud.github.io/axolotl/) — 参考 SFT / DPO 训练器
- [TRL 文档](https://huggingface.co/docs/trl) — DPO 和 GRPO 参考实现
- [Unsloth](https://github.com/unslothai/unsloth) — 单 GPU 快速迭代参考
- [DeepSeek R1 论文（arXiv:2501.12948）](https://arxiv.org/abs/2501.12948) — GRPO 方法论
- [vLLM + EAGLE-3 文档](https://docs.vllm.ai) — 参考服务栈
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — 替代推测解码训练器
- [模型开放性框架 2026](https://isocpp.org/) — 开放发布的评级标准
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) — 经典评估运行器
