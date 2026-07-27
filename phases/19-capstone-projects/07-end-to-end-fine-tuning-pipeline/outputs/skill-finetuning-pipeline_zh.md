---
name: finetuning-pipeline
description: 运行一个可复现的数据到 SFT 到 DPO 到服务的微调管道，包含消融实验、量化以及 2026 年模型开放框架模型卡。
version: 1.0.0
phase: 19
lesson: 07
tags: [capstone, fine-tuning, axolotl, trl, dpo, grpo, vllm, eagle-3, mof]
---

给定一个基础模型（Llama 3.3 8B、Qwen3 14B 或 Gemma 3 12B）和一个任务特定数据集，构建一个单一命令的管道，生成一个服务端点和可复现的模型卡。

构建计划：

1. 数据阶段：Datatrove 去重、Nemotron-CC 风格质量过滤、Presidio PII 清洗、使用种子的训练/验证集划分。
2. 污染检查：对 MMLU-Pro、MT-Bench-v2、RewardBench-2 使用 MinHashLSH。重叠则拒绝。
3. SFT：Axolotl v0.8，使用 ZeRO-3、Flash Attention 3、打包序列，在 8xH100 上训练 2-3 个 epochs。
4. 偏好调优：TRL 0.15 DPO（或带可验证奖励的 GRPO），1 个 epoch，beta 搜索。
5. 量化：GPTQ-INT4-Marlin + AWQ-INT4 + GGUF-Q4_K_M。
6. 服务：vLLM 0.7，带 EAGLE-3 推测解码（通过 Red Hat Speculators 或 SGLang SpecForge 的草稿模型）。K8s 部署，基于队列等待时间的 HPA。
7. 评估：lm-evaluation-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro，对比基础/SFT-only/SFT+DPO/SFT+GRPO。
8. 安全性：Llama Guard 4 通过率、ShieldGemma-2 输出过滤器。
9. 2026 年模型开放框架下的模型卡，包含数据、训练、评估、安全性、可复现性部分。

评估量规：

| 权重 | 标准 | 衡量方法 |
|:-:|---|---|
| 25 | 与基础模型相比的评估改进 | 在 MMLU-Pro、MT-Bench-v2、任务特定基准上的可测量提升 |
| 20 | 管道可复现性 | 相同种子的单命令重新运行产生匹配的哈希值 |
| 20 | 数据卫生 | 去重率、PII 清洗覆盖率、污染检查通过 |
| 20 | 服务效率 | 批处理大小 1/8/32 时的 tokens/s、EAGLE-3 接受率、$/1M tokens |
| 15 | 模型卡 + 安全评估 | 2026 MOF 完整性 + Llama Guard 4 通过率 |

硬性拒绝：

- 跳过 MinHash 污染检查的管道。将 MMLU-Pro 泄漏到训练中是经典的评估作弊故障模式。
- 没有附加种子或 YAML 的训练运行。可复现性是硬性要求。
- 没有 EAGLE-3 或等效推测解码配置的服务。基线 tokens/s 不是 2026 年的标准。
- 缺少安全评估。每个微调模型都附带 Llama Guard 4 通过率。

拒绝规则：

- 拒绝发布声称基准分数的模型卡，而不附加 lm-eval-harness 提交 SHA。
- 拒绝在数据许可禁止衍生模型的数据上进行微调。MOF 对数据许可进行评级。
- 拒绝发布量化模型而不在评估矩阵上测量质量损失。

输出：一个包含管道协调器、Llama 3.3 8B + 一个替代基础模型的 YAML、SFT 和 DPO 的 W&B 运行日志、量化产物、服务端点、三基准评估矩阵、安全评估、2026 MOF 模型卡，以及一份关于您发现并修复的三大数据卫生问题的报告的仓库。
