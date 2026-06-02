# 指令跟随作为对齐信号（Instruction-Following as Alignment Signal）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 后续每一篇对 RLHF 的批判，反对的都是这条流水线。要研究优化压力如何扭曲一个代理（proxy）信号，你得先看到这个代理长什么样。InstructGPT（Ouyang et al., 2022）确立了参考架构：在指令-回复对上做 supervised fine-tuning、用成对偏好排序训练一个 reward model、再以 PPO 针对 reward model 进行优化并对 SFT 策略施加 KL 惩罚。1.3B 的 InstructGPT 击败了 175B 的 GPT-3。就是这一个结果，让 2026 年的每一家前沿实验室仍然在出货 RLHF 形态的 post-training 流水线。

**Type:** Learn
**Languages:** Python (stdlib, toy three-stage pipeline)
**Prerequisites:** Phase 10 · 06 (SFT), Phase 10 · 07 (RLHF), Phase 10 · 08 (DPO)
**Time:** ~45 minutes

## 学习目标（Learning Objectives）

- 说出 InstructGPT 流水线的三个阶段，以及每个阶段使用的损失。
- 解释为什么一个 1.3B 的指令微调模型在人类偏好评估上能击败原始的 175B GPT-3。
- 说明第三阶段中的 KL 惩罚到底在防什么；如果把它去掉，为什么策略会塌缩到 mode-seeking（追逐众数）的行为。
- 描述 alignment tax（对齐税），以及 Ouyang et al. 用 PPO-ptx 做出的缓解。

## 问题（Problem）

预训练（pretraining）后的语言模型只会续写文本，它不会回答问题。你让 GPT-3 「写一个反转列表的 Python 函数」，它经常吐回另一段 prompt——因为训练分布里的绝大多数都是网页文本，网页文本接的是更多网页文本。模型在尽职完成它的工作，只是这份工作不对。

每家正经实验室用来纠正这件事的代理（proxy）都是人类偏好。两条续写交给标注员；标注员挑出更好的那条；reward model 学会模仿这位标注员。然后用一个 RL 循环，把策略推向 reward model 打分高的输出。三句话讲完整篇 InstructGPT 的核心论点，剩下的都是工程实现。

## 概念（Concept）

### 阶段 1：supervised fine-tuning (SFT)

收集 prompt-回复对，回复是一位心怀善意的人类会写的样子。Ouyang et al. 用了来自标注员和 OpenAI API 的 13k 条 prompt。用标准的交叉熵损失对基础模型做 fine-tune。

SFT 给你的：模型现在会回答问题，而不是续写问题。SFT 不给你的：当多个回复都说得通时，关于标注员更喜欢哪一条的任何信号。

### 阶段 2：reward model (RM)

对每个 prompt，从 SFT 模型采样 K 条续写。让标注员对它们排序。训练一个 reward model，对任意 prompt-回复对打分，使得对于 `y_w` 优于 `y_l` 的对：

```
L_RM = -log sigmoid(r(x, y_w) - r(x, y_l))
```

这就是 Bradley-Terry 成对偏好损失。RM 通常从 SFT 模型初始化，把 LM head 换成一个 scalar head。

Reward model 体量都不大：6B 已经够 175B 的 InstructGPT 用了。它们也很脆弱——论文第 5 节大半篇幅都在讲小规模就能浮现出来的 reward-hacking（奖励黑客）行为。

### 阶段 3：带 KL 惩罚的 PPO

定义目标：

```
J(pi) = E_{x~D, y~pi(.|x)} [ r(x, y) ] - beta * KL(pi(.|x) || pi_SFT(.|x))
```

用 PPO 最大化它。KL 项让 `pi` 不至于偏离 SFT 策略太远。没有它，优化器会找到对抗性样本——RM 给高分只是因为它从没见过这些字符串，并不是人类真的更喜欢它们。

KL 系数 `beta` 是 RLHF 里最重要的那一个超参数。太低：reward hacking。太高：相比 SFT 没有任何提升。

### Alignment tax（对齐税）

经过 RLHF 之后，模型在人类偏好上更受青睐，但在标准基准（SQuAD、HellaSwag、DROP）上反而退步。Ouyang et al. 把这种现象叫做 alignment tax，并用 PPO-ptx 来修复它：把预训练的梯度混进 RL 目标，让模型不至于忘掉那些它没被奖励过、却还得会的下游任务。

```
J_ptx(pi) = J(pi) + gamma * E_{x~D_pretrain} [ log pi(x) ]
```

PPO-ptx 后来成了标准做法。Anthropic、DeepMind、Meta 都在用它的某种变体。

### 结果

一个 1.3B 的 InstructGPT（SFT + RM + PPO-ptx）在标注员眼里大约 70% 的时间都比 175B 基础版 GPT-3 更受偏好。在来自生产流量的隐藏测试 prompt 上，这个差距还会进一步拉大。从这个数字里能读出两件事：

1. 对齐和能力是不同的轴。175B 模型能力更强；1.3B 模型对齐更好；标注员偏爱对齐更好的那个。
2. 能力的下限由基础模型决定。你不可能用 RLHF 把一个基础模型「调」出它从没见过的事实。

### 为什么这是 Phase 18 的参考基点

后面每一篇里的批判——reward hacking（第 2 课）、DPO（第 3 课）、sycophancy（谄媚，第 4 课）、CAI（第 5 课）、sleeper agents（潜伏 agent，第 7 课）、alignment faking（对齐伪装，第 9 课）——反对的都是这条流水线的某一部分。Reward hacking 攻击的是阶段 2。DPO 把阶段 2 和阶段 3 折叠成一步。CAI 把人类标注员替换掉。Sycophancy 揭示标注员本身就是一个有偏的信号。Alignment faking 显示策略可以整个绕过阶段 3。如果脑子里没有这条流水线，你没法跟上后续任何一条批判。

## 用起来（Use It）

`code/main.py` 在玩具偏好数据上模拟这三个阶段。基础「策略」是动作集合 {A, B, C} 上的一枚有偏硬币。阶段 1 SFT 在 200 条 prompt 上模仿标注员的动作。阶段 2 用 500 条成对排序拟合一个 Bradley-Terry reward model。阶段 3 跑一个简化版 PPO 更新，对 SFT 策略施加 KL 惩罚。你可以看到 reward 在爬升、KL 散度在变大、策略在漂移——你也可以把 KL 项关掉，看 reward hacking 在 50 步更新内就冒出来。

可以盯着看的几样东西：

- `beta = 0.1` 与 `beta = 0.0` 下的 reward 轨迹（trajectory）。
- 训练步数下的 KL(pi || pi_SFT)。
- 最终动作分布与标注员偏好的对比。

## 上线部署（Ship It）

本课产出 `outputs/skill-instructgpt-explainer.md`。给定一段 RLHF 流水线描述或一篇论文摘要，它能识别出对三个阶段中的哪一阶段做了改动、每个阶段使用了什么损失，以及是否存在 KL 惩罚或等价的正则化项。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。把 `beta = 0.0`，报告 200 步 PPO 之后的动作分布。用一段话解释 mode-seeking 行为。

2. 修改 reward model，让动作 B 多带一个 +0.5 的偏置（模拟一个 reward bug）。在 `beta = 0.1` 下跑 PPO。KL 惩罚能不能阻止策略利用这个偏置？在 `beta` 取多少的时候，能看到策略明显去钻空子？

3. 阅读 Ouyang et al.（arXiv:2203.02155）Figure 1。复现那条标注员偏好曲线：分别跑 1、5、20、100 步 PPO，测量它相对 SFT 模型的偏好率。

4. 论文 Section 4.3 报告 1.3B InstructGPT 大约 70% 的时候能击败 175B GPT-3。为什么在隐藏的生产 prompt 上这个比率会比在标注员自己提供的 prompt 上更高？

5. 把 PPO 损失换成 DPO（Phase 10 · 08），用同一份偏好数据训。比较最终的策略漂移（相对 SFT 的 KL）和最终 reward。在 reward 持平时，哪种方法漂移得更远？

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| SFT | 「指令调优」 | 阶段 1：在 prompt-回复对上做交叉熵 fine-tune |
| Reward model | 「RM」 | 在 (prompt, response) 上的 scalar 回归器，用 Bradley-Terry 损失在成对标签上训练 |
| Bradley-Terry | 「成对偏好损失」 | -log sigmoid(r_w - r_l)；把成对排序约化为二分类 |
| KL penalty | 「正则化项」 | `beta * KL(pi \|\| pi_SFT)`——让 RL 策略待在 SFT 锚点附近 |
| PPO-ptx | 「带预训练混合的 PPO」 | 在 PPO 目标里加一小份预训练的对数似然，用来抵消 alignment tax |
| Alignment tax | 「RLHF 退步」 | RLHF 之后，在它本来就没瞄准的标准基准上出现的成绩下滑 |
| Labeler preference | 「ground truth」 | 人类排序的样本；RM 是这个样本的统计代理，而不是「人类价值」的代理 |

## 延伸阅读（Further Reading）

- [Ouyang et al. — Training language models to follow instructions with human feedback (arXiv:2203.02155)](https://arxiv.org/abs/2203.02155) — InstructGPT 论文，后来所有 RLHF 流水线的根基
- [Stiennon et al. — Learning to summarize from human feedback (arXiv:2009.01325)](https://arxiv.org/abs/2009.01325) — RLHF 用于摘要的前作
- [Christiano et al. — Deep reinforcement learning from human preferences (arXiv:1706.03741)](https://arxiv.org/abs/1706.03741) — 基于偏好的 RL 最初的形式化表述
- [Bai et al. — Training a Helpful and Harmless Assistant with RLHF (arXiv:2204.05862)](https://arxiv.org/abs/2204.05862) — Anthropic 在 InstructGPT 流水线上的 HH 扩展
