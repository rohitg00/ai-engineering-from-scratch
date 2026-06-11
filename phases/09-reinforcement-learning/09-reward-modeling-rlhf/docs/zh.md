# 奖励建模与 RLHF

> 2022 年：InstructGPT 证明你可以用人类偏好训练语言模型。2023 年：ChatGPT 使其成为主流。2024-2025 年：RLHF 成为每个对齐的 LLM 的标准后训练步骤。核心洞察：不要优化奖励函数——优化一个*学习*的奖励函数，该函数从人类判断中训练。

**类型：** 构建
**语言：** Python
**前置知识：** 第九阶段 · 08（PPO），第十阶段 · 01（Transformer），第十阶段 · 02（预训练）
**时间：** ~90 分钟

## 问题

标准 RL 假设你可以编写一个奖励函数。对于围棋，奖励是 +1/-1。对于机器人，奖励是到达目标。对于语言模型，奖励是什么？"有帮助"？"无害"？"诚实"？这些是不可计算的。

RLHF（来自人类反馈的强化学习）的洞察：不编写奖励函数，而是*学习*它。收集人类对模型输出的偏好（"A 比 B 好"）。训练一个奖励模型来预测这些偏好。然后使用 RL（通常是 PPO）来优化策略，以最大化学习到的奖励。

这是现代 LLM 训练的三阶段流程：
1. **预训练** 在原始文本上（第十阶段 · 02）。
2. **SFT**（监督微调）在高质量指令-响应对上。
3. **RLHF** 在人类偏好数据上。

第三阶段是 RL 的工业应用，其中奖励函数本身是从数据中学习的。

## 概念

![RLHF 三阶段：SFT → 奖励模型训练 → PPO 优化](../assets/rlhf.svg)

### 阶段 1：监督微调（SFT）

在高质量的人类编写指令-响应对上微调预训练的 LLM。这教会模型遵循指令的格式，但不一定是对齐的——它可能仍然是有毒的、有偏见的或有害的。SFT 是 RLHF 的初始化点。

### 阶段 2：奖励模型（RM）训练

收集偏好数据：对于每个提示，生成两个响应（例如，来自 SFT 模型），人类标注者选择更好的一个。训练一个奖励模型 `r_φ(x, y)` 来预测偏好。

**Bradley-Terry 模型。** 如果人类偏好 `y_w` 胜过 `y_l`，损失是：

`L(φ) = -E_{(x, y_w, y_l)} [ log σ(r_φ(x, y_w) - r_φ(x, y_l)) ]`

其中 `σ` 是 sigmoid。这等价于成对分类：奖励模型学习为更优的响应分配更高的分数。

**奖励黑客。** RL 优化器会找到任何方法来最大化 `r_φ`，包括人类不打算的漏洞。例如，如果奖励模型对长响应有偏见，RL 策略会生成无意义的冗长文本。修复：KL 散度惩罚，将 RL 策略保持在 SFT 策略附近。

### 阶段 3：使用 PPO 的 RL

使用 PPO 优化 LLM 策略 `π_θ`，以最大化奖励模型分数，同时通过 KL 惩罚保持接近 SFT 策略 `π_ref`：

`J(θ) = E_{x~D, y~π_θ(·|x)} [ r_φ(x, y) ] - β · KL(π_θ || π_ref)`

- `r_φ(x, y)`：学习到的奖励。
- `β · KL(π_θ || π_ref)`：防止奖励黑客的 KL 惩罚。
- `D`：提示分布。

PPO 在 token 级别运行：每个生成的 token 是一个动作，状态是前缀，奖励仅在序列结束时给出（或每个 token 给出，使用 KL 惩罚作为每个 token 的"奖励"）。

### DPO：直接偏好优化

Rafailov 等人（2023）表明你可以完全跳过显式的奖励模型和 PPO。DPO 直接从偏好数据优化策略：

`L_DPO(θ) = -E_{(x, y_w, y_l)} [ log σ(β · log(π_θ(y_w|x) / π_ref(y_w|x)) - β · log(π_θ(y_l|x) / π_ref(y_l|x))) ]`

DPO 在数学上等价于 RLHF，但更简单——没有单独的奖励模型，没有 PPO，没有价值网络。在 2025-2026 年，DPO 及其变体（IPO、KTO、SimPO）广泛用于 LLM 对齐。

### RLAIF

RLAIF（来自 AI 反馈的 RL）用 AI 生成的偏好替换人类偏好。一个"宪法"或原则指导 AI 评判者。这便宜且可扩展，但引入了 AI 的偏见。

## 构建

### 第一步：奖励模型

```python
class RewardModel:
    def __init__(self, base_model):
        self.backbone = base_model  # 例如，GPT-2
        self.score_head = Linear(base_model.hidden_size, 1)
    
    def forward(self, x, y):
        # x: 提示 token，y: 响应 token
        input_ids = concat(x, y)
        hidden = self.backbone(input_ids)
        # 取最后一个 token 的隐藏状态
        score = self.score_head(hidden[-1])
        return score
```

### 第二步：Bradley-Terry 损失

```python
def bt_loss(rm, x, y_w, y_l):
    r_w = rm(x, y_w)
    r_l = rm(x, y_l)
    loss = -log(sigmoid(r_w - r_l))
    return loss
```

### 第三步：带 KL 惩罚的 PPO

```python
def ppo_rlhf_step(policy, ref_policy, reward_model, prompt, beta, epsilon, lr):
    # 生成响应
    response = policy.generate(prompt)
    
    # 计算奖励
    reward = reward_model(prompt, response)
    
    # 计算 KL 惩罚
    log_pi = policy.log_prob(prompt, response)
    log_pi_ref = ref_policy.log_prob(prompt, response)
    kl_penalty = beta * (log_pi - log_pi_ref)
    
    # 每个 token 的优势（简化版）
    advantages = [reward - kl_penalty[t] for t in range(len(response))]
    
    # PPO 更新（与第 08 课相同，但 token 级别）
    ppo_update(policy, prompt, response, advantages, epsilon, lr)
```

### 第四步：DPO（简化版）

```python
def dpo_loss(policy, ref_policy, x, y_w, y_l, beta):
    log_pi_w = policy.log_prob(x, y_w)
    log_pi_l = policy.log_prob(x, y_l)
    log_pi_ref_w = ref_policy.log_prob(x, y_w)
    log_pi_ref_l = ref_policy.log_prob(x, y_l)
    
    ratio_w = beta * (log_pi_w - log_pi_ref_w)
    ratio_l = beta * (log_pi_l - log_pi_ref_l)
    
    loss = -log(sigmoid(ratio_w - ratio_l))
    return loss
```

## 陷阱

- **奖励黑客。** 这是 RLHF 的#1 问题。始终使用 KL 惩罚，监控分布外行为，并定期用人类评估验证。
- **偏好数据质量。** 垃圾进，垃圾出。标注者需要培训、校准和多样性。一个标注者的偏见会成为模型的偏见。
- **奖励模型泛化。** 奖励模型在训练分布上表现良好，但在分布外提示上可能失败。使用多样化的提示。
- **PPO 不稳定性。** LLM 上的 PPO 可能不稳定。使用较小的学习率、梯度裁剪和早期的早停。
- **DPO 的长度偏见。** DPO 对长响应有固有的偏见（因为概率乘积）。使用长度归一化或 IPO/KTO。
- **可扩展性。** 人类标注昂贵。RLAIF 和合成偏好是扩展的方向。

## 应用

| 系统 | 方法 | 说明 |
|------|------|------|
| InstructGPT / ChatGPT | RLHF (PPO) | 原始的 RLHF 管道。 |
| Claude | RLHF + Constitutional AI | RLAIF 变体，有宪法原则。 |
| Llama 2 | RLHF (PPO) + DPO | 两阶段：PPO 然后 DPO 细化。 |
| Zephyr / Tulu | DPO  only | 跳过 PPO，仅使用 DPO。 |
| DeepSeek | GRPO | 组相对策略优化，无价值模型。 |

## 交付

保存为 `outputs/skill-rlhf-trainer.md`：

```markdown
---
name: rlhf-trainer
description: 为 LLM 对齐生成 RLHF 或 DPO 训练配置，包括奖励建模、PPO 和偏好优化。
version: 1.0.0
phase: 9
lesson: 9
tags: [rl, rlhf, dpo, llm-alignment]
---

给定一个预训练的 LLM 和对齐目标，输出：

1. 方法。RLHF (PPO) 或 DPO / IPO / KTO。
2. 奖励模型。架构（基于 LLM 的）、训练数据大小、Bradley-Terry 损失。
3. PPO 参数。KL 惩罚 β、学习率、批量大小、epoch 数量。
4. DPO 参数。β（温度）、参考模型冻结策略。
5. 数据。偏好对数量、提示多样性、标注者校准。
6. 安全。KL 阈值、奖励黑客检测、人类评估频率。

拒绝没有 KL 惩罚或参考模型的 RLHF。拒绝 β < 0.01 的 DPO（太冷）或 β > 1.0（太热）。标记任何奖励模型在保留集上准确率 < 60% 的设置为不可信。
```

## 练习

1. **简单。** 在一个小型文本分类任务上实现 Bradley-Terry 奖励模型。训练它预测人类对两个摘要的偏好。
2. **中等。** 实现 DPO 训练循环。在偏好数据集上微调一个小型 GPT-2 模型。与 SFT 基线比较。
3. **困难。** 实现完整的 RLHF 管道：SFT → 奖励模型 → PPO。监控奖励黑客：绘制平均响应长度和奖励分数。KL 惩罚是否防止长度爆炸？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| RLHF | "人类反馈的 RL" | 三阶段：SFT → 奖励模型 → PPO。 |
| 奖励模型 | "学习到的评分器" | 预测人类偏好的神经网络。 |
| Bradley-Terry | "成对偏好损失" | `log σ(r_w - r_l)`；将偏好建模为概率。 |
| KL 惩罚 | "不要偏离太远" | `β · KL(π || π_ref)`；防止奖励黑客。 |
| 奖励黑客 | "利用评分器" | RL 找到最大化学习奖励但人类不想要的输出。 |
| DPO | "没有 RL 的 RLHF" | 直接从偏好优化策略；数学上等价，更简单。 |
| RLAIF | "AI 反馈的 RL" | 用 AI 生成的偏好替换人类偏好。 |
| GRPO | "组相对 PPO" | DeepSeek 变体；没有价值模型，使用组基线。 |

## 延伸阅读

- [Ouyang et al. (2022). Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) — InstructGPT / RLHF 论文。
- [Rafailov et al. (2023). Direct Preference Optimization](https://arxiv.org/abs/2305.18290) — DPO 论文。
- [Bai et al. (2022). Constitutional AI](https://arxiv.org/abs/2212.08073) — RLAIF / Constitutional AI。
- [Ziegler et al. (2019). Fine-Tuning Language Models from Human Preferences](https://arxiv.org/abs/1909.08593) — 早期的 RLHF 工作。
- [DeepSeekMath (2024). GRPO](https://arxiv.org/abs/2402.03300) — GRPO 论文。
