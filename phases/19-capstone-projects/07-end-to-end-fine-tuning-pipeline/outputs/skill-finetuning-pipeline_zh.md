---
name: finetuning-pipeline
description: 运行可复现的数据到SFT到DPO到服务的微调管道，包含消融、量化和2026 Model Openness Framework模型卡。
version: 1.0.0
phase: 19
lesson: 07
tags: [capstone, fine-tuning, axolotl, trl, dpo, grpo, vllm, eagle-3, mof]
---

给定基础模型（Llama 3.3 8B、Qwen3 14B或Gemma 3 12B）和任务特定数据集，构建一个单命令管道，产生服务端点和可复现模型卡。

构建计划：

1. 数据阶段：Datatrove去重、Nemotron-CC风格质量过滤、Presidio PII清理、种子化训练/验证拆分。
2. 污染检查：针对MMLU-Pro、MT-Bench-v2、RewardBench-2的MinHashLSH。重叠则拒绝。
3. SFT：Axolotl v0.8，ZeRO-3、Flash Attention 3、打包序列、在8xH100上训练2-3轮。
4. 偏好调优：TRL 0.15 DPO（或带可验证奖励的GRPO）1轮，beta扫描。
5. 量化：GPTQ-INT4-Marlin + AWQ-INT4 + GGUF-Q4_K_M。
6. 服务：vLLM 0.7，EAGLE-3推测解码（通过Red Hat Speculators或SGLang SpecForge的draft heads）。K8s部署，基于队列等待的HPA。
7. 评估：lm-evaluation-harness、RewardBench-2、MT-Bench-v2、MMLU-Pro，跨基础/SFT-only/SFT+DPO/SFT+GRPO。
8. 安全性：Llama Guard 4通过率、ShieldGemma-2输出过滤。
9. 2026 Model Openness Framework下的模型卡，包含数据、训练、评估、安全性、可复现性章节。

评估标准：

| 权重 | 标准 | 测量 |
|:-:|---|---|
| 25 | 与基础的评估增量 | MMLU-Pro、MT-Bench-v2、任务特定基准上的测量增益 |
| 20 | 管道可复现性 | 单命令重跑，相同种子产生匹配哈希 |
| 20 | 数据卫生 | 去重率、PII清理覆盖率、污染检查通过 |
| 20 | 服务效率 | batch 1/8/32的token/s、EAGLE-3接受率、$/1M token |
| 15 | 模型卡 + 安全评估 | 2026 MOF完整性 + Llama Guard 4通过率 |

硬性拒绝：
- 跳过MinHash污染检查的管道。将MMLU-Pro泄露到训练中是经典的评估作弊失败模式。
- 没有附加种子或YAML的训练运行。可复现性是硬性要求。
- 没有EAGLE-3或等效推测解码配置的服务。基线token/s不是2026年的标准。
- 缺少安全评估。每次微调都附带Llama Guard 4通过率。

拒绝规则：
- 拒绝发布声称基准分数但未附加lm-eval-harness提交SHA的模型卡。
- 拒绝在许可证禁止衍生模型的数据上微调。MOF评分数据许可。
- 拒绝在未在评估矩阵上测量质量损失的情况下发布量化模型。

输出：包含管道编排器、Llama 3.3 8B + 一个替代基础的YAML、SFT和DPO W&B运行日志、量化产物、服务端点、三基准评估矩阵、安全评估、2026 MOF模型卡的仓库，以及一份关于捕获和修复的三大数据卫生问题的撰写。
