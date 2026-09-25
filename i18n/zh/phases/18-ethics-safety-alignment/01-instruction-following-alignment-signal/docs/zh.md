# 将指令遵循作为对齐信号

> 后续对 RLHF 的每一项批评都是针对这条流水线提出的。在学习优化压力如何扭曲代理目标之前，你必须先了解这个代理。InstructGPT (Ouyang et al., 2022) 定义了参考架构：在指令-响应对上进行监督微调，在成对偏好排序上训练奖励模型，然后用 PPO 针对奖励模型优化，并对 SFT 策略施加 KL 惩罚。一个 1.3B 的 InstructGPT 在人类偏好评估中优于 175B 的 GPT-3。这一个结果就是 2026 年每家前沿实验室仍在沿用 RLHF 形态的后训练流水线的原因。

**Type:** Learn
**Languages:** Python (标准库，简化三阶段流水线)
**Prerequisites:** Phase 10 · 06 (SFT), Phase 10 · 07 (RLHF), Phase 10 · 08 (DPO)
**Time:** 约 45 分钟

## 学习目标

- 说出 InstructGPT 流水线的三个阶段以及每个阶段使用的损失函数。
- 解释为什么一个 1.3B 的指令微调模型在人类偏好评估中击败了原始的 175B GPT-3。
- 说明第 3 阶段的 KL 惩罚在防止什么，以及为什么去掉它会坍缩为寻求众数(mode-seeking)的行为。
- 描述对齐税(alignment tax)以及 Ouyang 等人用来对抗它的 PPO-ptx 方法。

## 问题所在

预训练语言模型是补全文本的，它们并不回答问题。让 GPT-3 "写一个反转列表的 Python 函数"，你往往会得到另一个提示词，因为训练分布大部分是网络文本，其续写自然是更多的网络文本。模型在完成它的工作——只是这份工作本身错了。

所有严肃实验室用来修复这个问题的代理指标是人类偏好。两个补全交给标注员；标注员选出更好的那个；奖励模型学习标注员。然后用一个 RL 循环将策略向奖励模型打高分的输出方向移动。这就是 InstructGPT 的完整论点，只需三句话。论文的其余部分都是工程实现。

## 概念

### 第 1 阶段：监督微调(SFT)

收集提示-响应对，其中响应是善意的人类会写出的内容。Ouyang 等人使用了来自标注员和 OpenAI API 的 13k 条提示。用标准交叉熵损失在这些数据上微调基础模型。

SFT 给你的是：模型现在会回答问题而不是续写问题。SFT 不给你的是：当多个回答都合理时，关于标注员偏好哪个回答的任何信号。

### 第 2 阶段：奖励模型(RM)

对每个提示，从 SFT 模型采样 K 个补全。由标注员对它们排序。训练一个奖励模型为任意提示-响应对打分，使得对于 `y_w` 优于 `y_l` 的对：

```
L_RM = -log sigmoid(r(x, y_w) - r(x, y_l))
```

这就是 Bradley-Terry 成对偏好损失。RM 通常以 SFT 模型初始化，将语言模型头替换为标量头。

奖励模型很小：对于 175B 的 InstructGPT,6B 就足够了。它们也很脆弱——论文第 5 节主要就是在讲在小规模上就出现的奖励作弊(reward-hacking)行为。

### 第 3 阶段：带 KL 惩罚的 PPO

定义目标函数：

```
J(pi) = E_{x~D, y~pi(.|x)} [ r(x, y) ] - beta * KL(pi(.|x) || pi_SFT(.|x))
```

用 PPO 最大化。KL 项防止 `pi` 偏离 SFT 策略太远。没有它，优化器会找到对抗样本——在 RM 下得高分的字符串，因为 RM 从未见过它们，而不是因为人类真的偏好它们。

KL 系数 `beta` 是最重要的单个 RLHF 超参数。太低：奖励作弊。太高：相对 SFT 没有提升。

### 对齐税

RLHF 之后，模型在人类偏好上更好了，但在标准基准(SQuAD、HellaSwag、DROP)上出现退化。Ouyang 等人称之为对齐税，并用 PPO-ptx 来修复：把预训练梯度混入 RL 目标中，使模型不会忘记那些从未因此获得奖励的下游任务。

```
J_ptx(pi) = J(pi) + gamma * E_{x~D_pretrain} [ log pi(x) ]
```

PPO-ptx 成为标准做法。Anthropic、DeepMind 和 Meta 都使用某种变体。

### 结果

一个 1.3B 的 InstructGPT(SFT + RM + PPO-ptx)在大约 70% 的时间里比 175B 基础 GPT-3 更受标注员偏好。这个差距在生产流量的隐藏测试提示上进一步扩大。从这个数字可以读出两点：

1. 对齐与能力是不同的维度。175B 模型能力更强；1.3B 模型对齐更好；标注员偏好对齐好的那个。
2. 能力的下限由基础模型决定。你无法用 RLHF 让基础模型知道它从未见过的事实。

### 为什么这是 Phase 18 的参考点

后续课程中的每一项批评——奖励作弊(第 2 课)、DPO(第 3 课)、谄媚(第 4 课)、CAI(第 5 课)、休眠智能体(第 7 课)、伪装对齐(第 9 课)——都是针对这条流水线的某个部分。奖励作弊攻击第 2 阶段。DPO 将第 2 和第 3 阶段合并。CAI 取代人类标注员。谄媚表明标注员是有偏的信号。伪装对齐表明策略可以完全绕过第 3 阶段。如果不先在头脑中建立这条流水线，你就无法理解这些批评中的任何一个。

```figure
al-instruct-pipeline
```

## 动手实践

`code/main.py` 在简化的偏好数据上模拟这三个阶段。基础"策略"是关于动作 {A, B, C} 的有偏硬币。第 1 阶段 SFT 在 200 个提示上模仿标注员的动作。第 2 阶段从 500 个成对排序拟合 Bradley-Terry 奖励模型。第 3 阶段运行带 KL 惩罚(对 SFT 策略)的简化 PPO 更新。你可以观察奖励攀升、KL 散度增长以及策略漂移——并且可以关掉 KL 项，在 50 步更新之内看到奖励作弊出现。

值得观察的内容：

- `beta = 0.1` 与 `beta = 0.0` 下的奖励轨迹。
- 训练步数上的 KL(pi || pi_SFT)。
- 最终动作分布与标注员偏好的对比。

## 交付成果

本课产出 `outputs/skill-instructgpt-explainer.md`。给定一个 RLHF 流水线的描述或论文摘要，它识别出被修改的是三个阶段中的哪一个、每个阶段使用什么损失，以及是否存在 KL 惩罚或等效的正则化项。

## 练习

1. 运行 `code/main.py`。设 `beta = 0.0`,报告 200 步 PPO 之后的动作分布。用一段话解释寻求众数的行为。

2. 修改奖励模型，使动作 B 有 +0.5 的偏置(模拟奖励 bug)。用 `beta = 0.1` 运行 PPO。KL 惩罚能阻止策略利用这个偏置吗？在多大的 `beta` 下利用行为变得可见？

3. 阅读 Ouyang et al. (arXiv:2203.02155) 图 1。通过分别运行 1、5、20、100 步 PPO 并测量相对于 SFT 模型的偏好，复现标注员偏好曲线。

4. 论文第 4.3 节报告 1.3B 的 InstructGPT 在约 70% 的时间里击败 175B GPT-3。为什么这个比例在隐藏的生产提示上会高于标注员自己的提示？

5. 在相同的偏好数据上用 DPO(Phase 10 · 08)替换 PPO 损失。比较最终策略漂移(对 SFT 的 KL)和最终奖励。在相同奖励水平下，哪种方法漂移更远？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| SFT | “指令微调” | 第 1 阶段：在提示-响应对上的交叉熵微调 |
| 奖励模型 | “RM” | 用 Bradley-Terry 在成对标签上训练的 (prompt, response) 上的标量回归器 |
| Bradley-Terry | “成对偏好损失” | -log sigmoid(r_w - r_l);将成对排序问题归约为二分类 |
| KL 惩罚 | “正则化项” | `beta * KL(pi \|\| pi_SFT)` — 使 RL 策略保持在 SFT 锚点附近 |
| PPO-ptx | “带预训练混合的 PPO” | 在 PPO 目标中加入一部分预训练对数似然，以抵消对齐税 |
| 对齐税 | “RLHF 退化” | RLHF 之后在 RLHF 未针对的标准基准上的性能下降 |
| 标注员偏好 | “真值” | 人类排序的样本；RM 是对它的统计代理，而不是对“人类价值观”的代理 |

## 延伸阅读

- [Ouyang et al. — Training language models to follow instructions with human feedback (arXiv:2203.02155)](https://arxiv.org/abs/2203.02155) — InstructGPT 论文，是后续所有 RLHF 流水线的基础
- [Stiennon et al. — Learning to summarize from human feedback (arXiv:2009.01325)](https://arxiv.org/abs/2009.01325) — 用于摘要的 RLHF 前身
- [Christiano et al. — Deep reinforcement learning from human preferences (arXiv:1706.03741)](https://arxiv.org/abs/1706.03741) — 最早的基于偏好的 RL 形式化
- [Bai et al. — Training a Helpful and Harmless Assistant with RLHF (arXiv:2204.05862)](https://arxiv.org/abs/2204.05862) — Anthropic 对 InstructGPT 流水线的 HH 扩展