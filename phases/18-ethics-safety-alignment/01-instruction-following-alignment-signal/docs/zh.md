# 01 · 指令遵循作为对齐信号

> 后来对 RLHF 的每一项批评，都是在反驳这套流水线。在你研究优化压力如何扭曲代理指标之前，你得先看清这个代理指标本身。InstructGPT（Ouyang 等人，2022）定义了参考架构：在指令-响应对上进行监督微调、在成对偏好排序上训练奖励模型、以及用 PPO 对抗奖励模型并对 SFT 策略施加 KL 惩罚。一个 1.3B 的 InstructGPT 比 175B 的 GPT-3 更受偏好。仅凭这一个结果，2026 年的每一家前沿实验室就仍然在交付一套 RLHF 形态的后训练流水线。

**类型：** 学习
**语言：** Python（标准库，玩具级三阶段流水线）
**前置：** 第10阶段 · 06（SFT）、第10阶段 · 07（RLHF）、第10阶段 · 08（DPO）
**时长：** 约45分钟

## 学习目标

- 说出 InstructGPT 流水线的三个阶段及每个阶段使用的损失函数。
- 解释为什么一个 1.3B 的指令调优模型在人类偏好评估中击败了原始 175B GPT-3。
- 说明第三阶段的 KL 惩罚在防御什么，以及移除它为何会导致坍缩为模式寻求（mode-seeking）行为。
- 描述对齐税（alignment tax）以及 Ouyang 等人用于缓解它的 PPO-ptx 方法。

## 问题所在

预训练语言模型会补全文本，但它们不会回答问题。让 GPT-3 「write a Python function that reverses a list」，你得到的往往是另一段提示，因为训练分布中绝大多数是网页文本，而网页文本的后续内容仍然是更多网页文本。模型在完成它的本职工作——只是这个工作本身定义错了。

所有严肃实验室用来修复这一问题的代理指标是「人类偏好（human preference）」。两条补全结果交给评分员；评分员选出更好的一条；奖励模型（reward model）学习评分员的判断。然后强化学习循环将策略推向奖励模型打分高的输出。三句话，就是 InstructGPT 论文的全部核心论点。论文的其余部分都是工程细节。

## 核心概念

### 第一阶段：监督微调（SFT）

收集提示-响应对，其中响应是一个善意人类会写出的内容。Ouyang 等人使用了标注员和 OpenAI API 提供的 13,000 个提示。用标准交叉熵损失在此数据上微调基座模型。

SFT 给你带来了什么：模型现在会回答问题，而不是延续问题。它没有给你带来什么：关于评分员在多个合理回答中偏好哪一个的任何信号。

### 第二阶段：奖励模型（RM）

对每个提示，从 SFT 模型中采样 K 条补全。标注员对它们进行排序。训练一个奖励模型，对任意提示-响应对打分，使得对于 `y_w` 被偏好于 `y_l` 的配对：

```
L_RM = -log sigmoid(r(x, y_w) - r(x, y_l))
```

这是 Bradley-Terry 成对偏好损失。RM 通常从 SFT 模型初始化，将语言模型头替换为标量头。

奖励模型很小：对于 175B 的 InstructGPT，6B 就足够了。它们也很脆弱——论文第5节的大部分内容都在讨论在小规模实验中就显现的奖励攻击（reward-hacking）行为。

### 第三阶段：带 KL 惩罚的 PPO

定义目标函数：

```
J(pi) = E_{x~D, y~pi(.|x)} [ r(x, y) ] - beta * KL(pi(.|x) || pi_SFT(.|x))
```

用 PPO 最大化。KL 项防止 `pi` 偏离 SFT 策略太远。没有它，优化器会找到对抗样本——那些在 RM 下得分很高但只是因为 RM 从未见过它们、而并非人类真的偏好它们的字符串。

KL 系数 `beta` 是 RLHF 中最重要的超参数。太低：奖励攻击。太高：相较 SFT 没有任何改进。

### 对齐税

RLHF 之后，模型更受人类偏好，但在标准基准测试（SQuAD、HellaSwag、DROP）上出现了性能回退。Ouyang 等人将这种现象称为「对齐税（alignment tax）」，并通过 PPO-ptx 来修复：将预训练梯度混入 RL 目标中，使模型不会遗忘如何完成那些从未被奖励过的下游任务。

```
J_ptx(pi) = J(pi) + gamma * E_{x~D_pretrain} [ log pi(x) ]
```

PPO-ptx 成为标准做法。Anthropic、DeepMind 和 Meta 都使用了某种变体。

### 结果

一个 1.3B 的 InstructGPT（SFT + RM + PPO-ptx）在约 70% 的情况下被标注员偏好于 175B 的基座 GPT-3。在来自生产流量的隐藏测试提示上，这一差距更大。从这个数字中可以读出两件事：

1. 对齐（alignment）与能力（capability）是不同的维度。175B 模型拥有更强的能力；1.3B 模型拥有更好的对齐；标注员更偏好对齐后的那个。
2. 能力下限由基座模型决定。你无法通过 RLHF 让一个基座模型学会它从未见过的知识。

### 为什么这是第18阶段的参考基础

后续课程中的每一项批评——奖励攻击（第2课）、DPO（第3课）、谄媚（sycophancy，第4课）、CAI（第5课）、潜伏智能体（sleeper agents，第7课）、对齐伪装（alignment faking，第9课）——都在反驳这套流水线的某个部分。奖励攻击针对第二阶段。DPO 将第二阶段和第三阶段合并。CAI 替换了人类标注员。谄媚表明标注员是一个有偏信号。对齐伪装表明策略可以完全绕过第三阶段。如果你脑子里没有这套流水线，就无法理解这些批评中的任何一个。

## 动手实践

`code/main.py` 在玩具偏好数据上模拟了三个阶段。基座「策略」是动作 {A, B, C} 上的一个有偏硬币。第一阶段 SFT 在 200 个提示上模仿标注员的动作。第二阶段从 500 个成对排序中拟合 Bradley-Terry 奖励模型。第三阶段运行带 KL 惩罚（对 SFT 策略）的简化 PPO 更新。你可以观察奖励上升、KL 散度增长以及策略漂移——还可以关掉 KL 项，看看奖励攻击在 50 个更新步内如何出现。

需要关注的内容：

- `beta = 0.1` 与 `beta = 0.0` 下的奖励轨迹。
- 训练步骤中的 KL(pi || pi_SFT)。
- 最终动作分布与标注员偏好的对比。

## 交付产物

本课生成的产出物为 `outputs/skill-instructgpt-explainer.md`。给定一段 RLHF 流水线描述或论文摘要，它会识别三个阶段中哪个阶段被修改了、每个阶段使用了什么损失函数、以及是否存在 KL 惩罚或等效正则项。

## 练习

1. 运行 `code/main.py`。设置 `beta = 0.0` 并报告 200 个 PPO 步骤后的动作分布。用一段话解释模式寻求行为。

2. 修改奖励模型，使其对动作 B 有一个 +0.5 的偏置（模拟奖励 bug）。用 `beta = 0.1` 运行 PPO。KL 惩罚是否能阻止策略利用这个偏置？在多大的 `beta` 下利用行为变得可见？

3. 阅读 Ouyang 等人论文（arXiv:2203.02155）的图1。通过运行 PPO 1、5、20、100 步并测量相对于 SFT 模型的偏好，复现标注员偏好曲线。

4. 论文第4.3节报告 1.3B InstructGPT 在约 70% 的情况下击败 175B GPT-3。为什么在隐藏的生产提示上这一比例会高于标注员自己的提示？

5. 在同一偏好数据上用 DPO（第10阶段 · 08）替换 PPO 损失。比较最终策略漂移（到 SFT 的 KL 距离）和最终奖励。在匹配的奖励水平下，哪种方法漂移更大？

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------------|------------------------|
| SFT | 「指令调优」 | 第一阶段：在提示-响应对上进行交叉熵微调 |
| 奖励模型（Reward model） | 「RM」 | 在（提示, 响应）上的标量回归器，使用 Bradley-Terry 在成对标签上训练 |
| Bradley-Terry | 「成对偏好损失」 | -log sigmoid(r_w - r_l)；将成对排序归约为二分类 |
| KL 惩罚 | 「正则项」 | `beta * KL(pi \|\| pi_SFT)` —— 将 RL 策略保持在 SFT 锚点附近 |
| PPO-ptx | 「混合预训练的 PPO」 | 向 PPO 目标中加入一部分预训练对数似然，以抵消对齐税 |
| 对齐税（Alignment tax） | 「RLHF 性能回退」 | RLHF 后在标准基准测试上的性能下降，这些基准并非 RLHF 的目标 |
| 标注员偏好（Labeler preference） | 「真实标注」 | 人类排序的采样；RM 是它的统计代理，而非「人类价值观」的代理 |

## 延伸阅读

- [Ouyang 等人——Training language models to follow instructions with human feedback（arXiv:2203.02155）](https://arxiv.org/abs/2203.02155) —— InstructGPT 论文，所有后续 RLHF 流水线的基础
- [Stiennon 等人——Learning to summarize from human feedback（arXiv:2009.01325）](https://arxiv.org/abs/2009.01325) —— RLHF 用于摘要的前身工作
- [Christiano 等人——Deep reinforcement learning from human preferences（arXiv:1706.03741）](https://arxiv.org/abs/1706.03741) —— 最早的基于偏好的强化学习公式
- [Bai 等人——Training a Helpful and Harmless Assistant with RLHF（arXiv:2204.05862）](https://arxiv.org/abs/2204.05862) —— Anthropic 在 InstructGPT 流水线基础上的 HH（Helpful and Harmless）扩展
