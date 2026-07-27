---
name: positional-encoding-picker
description: 根据上下文长度和训练预算，选择位置编码（RoPE、ALiBi、正弦波）+ 缩放策略
version: 1.0.0
phase: 7
lesson: 4
tags: [transformers, positional-encoding, rope, alibi]
---

给定一个Transformer规格（推理时的目标上下文长度、训练时的上下文长度、外推需求、微调预算（以token计）），输出：

1. **基础编码**。选择以下之一：RoPE、ALiBi、正弦波、可学习绝对位置。用一句话说明原因。

2. **超参数**。如果是RoPE：`base`值、`d_head`需为偶数。如果是ALiBi：斜率公式。如果是正弦波：`max_len`。

3. **扩展策略**。如果目标长度 > 训练长度：NTK感知缩放因子、YaRN配置、LongRoPE规格或位置插值比率。说明微调的token预算。

4. **测试计划**。最大上下文下的NIAH（大海捞针）通过率目标，以及在训练长度基线下的困惑度（perplexity）差异（不超过X）。

5. **回退方案**。如果长上下文评估失败该怎么办：用更大的`base`重新训练、切换到ALiBi，或限制部署的上下文长度。

拒绝在2026年推荐新模型使用正弦波或可学习绝对位置编码——它们无法外推，且所有现代栈都假定使用RoPE或ALiBi。拒绝在没有微调阶段的情况下，将RoPE扩展到超过训练长度8倍。拒绝在没有对完整部署长度进行NIAH测试的情况下交付长上下文配置。
