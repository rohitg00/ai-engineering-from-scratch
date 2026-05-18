# 指令遵循作为对齐信号

> 之后对 RLHF 的每一项批判都是针对这条管线的。在研究优化压力如何扭曲代理目标之前，你必须先看到这个代理目标本身。InstructGPT（Ouyang 等人，2022）定义了参考架构：在指令-响应对上进行监督微调，在成对偏好排序上训练奖励模型，以及针对奖励模型使用 PPO 优化并附加对 SFT 策略的 KL 惩罚。一个 1.3B 的 InstructGPT 在人类偏好评估中胜过了 175B 的 GPT-3。这一单一结果就是 2026 年每个前沿实验室仍在交付 RLHF 形态后训练管线的原因。

**类型：** 学习
**语言：** Python（标准库，简易三阶段管线模拟器）
**前置知识：** 第 10 阶段 · 06（SFT）、第 10 阶段 · 07（RLHF）、第 10 阶段 · 08（DPO）
**时间：** ~45 分钟

## 学习目标

- 说出 InstructGPT 管线的三个阶段及每个阶段使用的损失函数。
- 解释为何一个 1.3B 的指令微调模型能在人类偏好评估中击败原始的 175B GPT-3。
- 说明第三阶段 KL 惩罚的保护对象，以及为何移除它会导致模式坍塌行为。
- 描述对齐税以及 Ouyang 等人用于缓解它的 PPO-ptx 方法。

## 问题背景

预训练语言模型补全文本。它们不回答问题。问 GPT-3 "写一个反转列表的 Python 函数"，你经常得到另一个 prompt，因为训练分布中大部分是网页文本，模型会继续生成更多网页文本。模型在做它的工作 —— 只是这个工作不对。

每个严肃实验室用来修复这个问题的代理目标是人类偏好。两个补全交给标注员；标注员挑选更好的一个；奖励模型学习标注员。然后 RL 循环将策略推向奖励模型打分高的输出。这就是 InstructGPT 论点的三句话总结。论文的其余部分是工程细节。

## 核心概念

### 第一阶段：监督微调（SFT）

收集 prompt-response 对，其中 response 是善意人类会写的内容。Ouyang 等人使用了来自标注员和 OpenAI API 的 13k 个 prompt。用标准交叉熵损失在这个数据上微调基础模型。

SFT 给你什么：模型现在回答问题而不是继续文本。SFT 不能给你什么：当多个回答都合理时，标注员更喜欢哪个回答的信号。

### 第二阶段：奖励模型（RM）

对每个 prompt，从 SFT 模型采样 K 个补全。标注员对它们排序。训练一个奖励模型，对任何 prompt-response 对打分，使得对于 `y_w` 优于 `y_l` 的成对样本：

```
L_RM = -log sigmoid(r(x, y_w) - r(x, y_l))
```

这是 Bradley-Terry 成对偏好损失。RM 通常从 SFT 模型初始化，将 LM 头替换为标量头。

奖励模型很小：6B 就足以支持 175B 的 InstructGPT。它们也很脆弱 —— 论文第 5 节大部分内容都是关于小规模出现的奖励黑客行为。

### 第三阶段：带 KL 惩罚的 PPO

定义目标：

```
J(pi) = E_{x~D, y~pi(.|x)} [ r(x, y) ] - beta * KL(pi(.|x) || pi_SFT(.|x))
```

用 PPO 最大化。KL 项防止 `pi` 偏离 SFT 策略太远。没有它，优化器会找到对抗样本 —— 在 RM 下得分高的字符串，不是因为人类真的更喜欢它们，而是因为 RM 从未见过它们。

KL 系数 `beta` 是 RLHF 中最重要的超参数。太低：奖励黑客。太高：相比 SFT 没有改进。

### 对齐税

RLHF 后，模型更受人类欢迎，但在标准基准测试（SQuAD、HellaSwag、DROP）上退步。Ouyang 等人称之为对齐税，并用 PPO-ptx 修复：将预训练梯度混入 RL 目标，使模型不会忘记那些从未因 RLHF 获得奖励的下游任务。

```
J_ptx(pi) = J(pi) + gamma * E_{x~D_pretrain} [ log pi(x) ]
```

PPO-ptx 成为标准。Anthropic、DeepMind 和 Meta 都使用某种变体。

### 结果

1.3B 的 InstructGPT（SFT + RM + PPO-ptx）在标注员偏好中约 70% 的时间胜过 175B 的基础 GPT-3。在来自生产流量的隐藏测试 prompt 上差距更大。从这个数字可以读出两件事：

1. 对齐是与能力不同的维度。175B 模型能力更强；1.3B 模型对齐更好；标注员更喜欢对齐的模型。
2. 能力下限由基础模型设定。你无法通过 RLHF 让基础模型学会它从未见过的事实。

### 为何这是第 18 阶段的参考点

后续课程中的每项批判 —— 奖励黑客（第 2 课）、DPO（第 3 课）、谄媚（第 4 课）、CAI（第 5 课）、沉睡智能体（第 7 课）、对齐伪装（第 9 课）—— 都针对这条管线的某个部分。奖励黑客攻击第二阶段。DPO 将第二和第三阶段合并。CAI 取代人类标注员。谄媚表明标注员是有偏见的信号。对齐伪装表明策略可以完全绕过第三阶段。如果不先把这条管线记在脑中，你无法理解任何这些批判。

## 使用

`code/main.py` 在玩具偏好数据上模拟三个阶段。基础"策略"是在动作 {A, B, C} 上的有偏硬币。第一阶段 SFT 在 200 个 prompt 上模仿标注员动作。第二阶段从 500 组成对排序中拟合 Bradley-Terry 奖励模型。第三阶段运行简化的 PPO 更新，对 SFT 策略附加 KL 惩罚。你可以观察奖励上升、KL 散度增长和策略漂移 —— 也可以关闭 KL 项，观察奖励黑客在 50 个更新步内出现。

观察要点：

- `beta = 0.1` 与 `beta = 0.0` 下的奖励轨迹。
- 训练步数上的 KL(pi || pi_SFT)。
- 与标注员偏好相比的最终动作分布。

## 交付

本课产出 `outputs/skill-instructgpt-explainer.md`。给定 RLHF 管线描述或论文摘要，识别哪个阶段被修改、每个阶段使用什么损失、以及是否存在 KL 惩罚或等效正则化项。

## 练习

1. 运行 `code/main.py`。设置 `beta = 0.0` 并报告 200 步 PPO 后的动作分布。用一段话解释模式坍塌行为。

2. 修改奖励模型，对动作 B 增加 +0.5 偏置（模拟奖励 bug）。用 `beta = 0.1` 运行 PPO。KL 惩罚是否能阻止策略利用该偏置？在什么 `beta` 下利用变得可见？

3. 阅读 Ouyang 等人（arXiv:2203.02155）的图 1。通过运行 PPO 1、5、20、100 步并测量对 SFT 模型的偏好，复现标注员偏好曲线。

4. 论文第 4.3 节报告 1.3B InstructGPT 约 70% 的时间击败 175B GPT-3。为什么在隐藏生产 prompt 上的比率会比标注员自己的 prompt 更高？

5. 在相同偏好数据上用 DPO（第 10 阶段 · 08）替换 PPO 损失。比较最终策略漂移（对 SFT 的 KL）和最终奖励。哪种方法在匹配奖励下漂移更远？

## 关键术语

| 术语 | 业界说法 | 实际含义 |
|------|---------|---------|
| SFT | "instruction tuning" | 第一阶段：在 prompt-response 对上用交叉熵微调 |
| Reward model | "the RM" | 对 (prompt, response) 的标量回归器，用 Bradley-Terry 在成对标签上训练 |
| Bradley-Terry | "pairwise preference loss" | -log sigmoid(r_w - r_l)；将成对排序降为二分类 |
| KL penalty | "the regularizer" | `beta * KL(pi || pi_SFT)` —— 使 RL 策略靠近 SFT 锚点 |
| PPO-ptx | "PPO with pretraining mix" | 在 PPO 目标中加入预训练对数似然的一小部分，以抵消对齐税 |
| Alignment tax | "the RLHF regression" | RLHF 后在标准基准上的退步，这些基准并非 RLHF 目标 |
| Labeler preference | "the ground truth" | 人类排序样本；RM 是此的统计代理，而非"人类价值观" |

## 延伸阅读

- [Ouyang et al. — Training language models to follow instructions with human feedback (arXiv:2203.02155)](https://arxiv.org/abs/2203.02155) —— InstructGPT 论文，后续每条 RLHF 管线的基础
- [Stiennon et al. — Learning to summarize from human feedback (arXiv:2009.01325)](https://arxiv.org/abs/2009.01325) —— RLHF 用于摘要的前驱
- [Christiano et al. — Deep reinforcement learning from human preferences (arXiv:1706.03741)](https://arxiv.org/abs/1706.03741) —— 基于偏好的 RL 原始形式
- [Bai et al. — Training a Helpful and Harmless Assistant with RLHF (arXiv:2204.05862)](https://arxiv.org/abs/2204.05862) —— Anthropic 对 InstructGPT 管线的 HH 扩展
