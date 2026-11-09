# 按照指令作为调整信号

> 后来的每一个对RLHF的批评都反对这一管道. 在你研究优化压力如何扭曲代理之前,你必须看到代理. 根据该指令,该指令将对应对对对进行监督细节调整,以对优先级排名训练的奖励模型,以及对SFT政策的 KL罚款的奖励模型进行PPO. 优先使用1.3BInstructGPT而不是175BGPT-3. 这一结果是每一个边境实验室在2026年仍然运送一个RLHF形状的训练后管道的原因.

**Type:** Learn
**Languages:** Python (stdlib, toy three-stage pipeline), TypeScript
**Prerequisites:** Phase 10 · 06 (SFT), Phase 10 · 07 (RLHF), Phase 10 · 08 (DPO)
**Time:** ~45 minutes

## 学习目标

- 说明InstructGPT管道的三个阶段以及每个阶段所使用的损失.
- 解释为什么一个1.3B指令调整的模型在人类偏好评估上超过原始175BGPT-3.
- 说明第三阶段的KL罚款是什么保护的,以及为什么删除它会导致寻找模式行为.
- 描述对调整税和对其使用的PPO-ptx减轻法 Ouyang等人.

## 问题

预训练语言模型完成文本.它们不回答问题.请GPT-3"写一个反转列表的Python函数"并经常得到另一个提示,因为大多数训练分布是继续使用更多的网页文本的网页文本.模型正在做其工作工作是错误的.

根据研究人员的说法,在研究中,研究人员的研究结果是非常重要的,因为研究人员的研究结果是非常重要的. 实验室使用的代理方法是人类的偏好. 两个完成将会给一个评分者;评分者选择更好的; 奖励模型学习评分者. 然后一个RL循环将政策转移到结果的奖励模型高分. 这就是整个InstructGPT论文在三个句子中. 剩下的论文是工程.

## 概念

### 阶段1:监督的细调 (SFT)

收集即时响应对,响应是一个有善意的人会写的. Ouyang等人使用标签器和OpenAI API的13k提示.通过标准的跨缩损失,对此数据进行细节调整.

现在,模型现在回答问题,而不是继续问题. 它没有给你什么:任何信号,即评级者喜欢多个答案是可行的.

### 第二阶段:奖励模式 (RM)

对于每一个提示,从SFT模型中样本K完成.一个标签符排名它们.训练一个奖励模型,该模型将任何提示响应对进行分数,以便,对于`y_w`现在,我觉得我更喜欢`y_l`其他:

```math
L_{\text{RM}} = -\log \sigma\big(r(x, y_w) - r(x, y_l)\big)
```

这就是布拉德利-特里对偏好损失.RM通常从SFT模型开始,LM头被 Skalar头取代.

奖励模型很小:6B足够用于175BInstructGPT.它们也很脆弱.

### 阶段3:PPO与KL罚款

定义目标:

```math
J(\pi) = \mathbb{E}_{x \sim D,\, y \sim \pi(\cdot \mid x)} \big[ r(x, y) \big] - \beta \, \mathrm{KL}\big(\pi(\cdot \mid x) \,\|\, \pi_{\text{SFT}}(\cdot \mid x)\big)
```

通过PPO最大化.KL术语保持.`pi`没有它,优化器会找到对立的例子 弦在RM下得分高,因为RM从来没有看到它们,而不是因为人类实际上更喜欢它们.

基因系数`beta`太低:奖励黑客.太高:没有改善.

### 调整税

欧阳等人称之为"配合税",并用PPO-ptx来解决这一问题:将预训练梯度混合到RL目标中,使模型不会忘记如何完成下游任务,它从未获得奖励.

```math
J_{\text{ptx}}(\pi) = J(\pi) + \gamma \, \mathbb{E}_{x \sim D_{\text{pretrain}}} \big[ \log \pi(x) \big]
```

博是个标准的平台,而人类,深思维和Meta都使用了一些变体.

### 结果

标签师对175B基 GPT-3大约70%的时间更喜欢1.3B 导向GPT (SFT + RM + PPO-ptx).在生产流量中隐藏测试提示时,差距扩大.

1. 配列与能力不同.175B模型具有更多的能力;1.3B模型具有更多的配列;标签商更喜欢配列的模型.
2. 基本模型是设定的能力水平. 你不能让一个基本模型知道它从来没有看到的事实.

### 为什么这是18期的参考点

后期课程中的每一个批评 奖励黑客 (课2) DPO (课3) , (课4) ,CAI (课5) 睡觉代理 (课7) ,排列假冒 (课9) 反对这一管道的一部分. 奖励黑客攻击第二阶段. 局的情况发生了第二和第三阶段. 标签标签器取代了人类标签器. 缩显示标签是偏见的信号. 调整假装显示,政策可以完全绕过第三阶段. 没有你头脑中的管道,你不能跟随这些批评.

```figure
al-instruct-pipeline
```

## 用它

`code/main.py`模拟玩具偏好数据的三个阶段. 基本"政策"是对行动的偏见. 阶段1SFT在200个提示时模仿标签操作. 阶段2符合500个对等排名的布拉德利-特里奖励模型. 阶段3将简化PPO更新,并对SFT政策实施KL处罚. 你可以看到奖励升,KL差异增长,政策漂移,你可以关闭KL术语,

什么要看:

- 奖励轨迹`beta = 0.1`其他`beta = 0.0`现在,我们要去.
- $\mathrm{KL}(\pi \Vert \pi_{\text{SFT}})$对于训练阶段.
- 与标签优先级相比,最终行动分布.

## 运送它

这一课产生了`outputs/skill-instructgpt-explainer.md`根据RLHF管道描述或纸质摘要,它确定了三个阶段中哪个正在修改,每阶段使用的损失,以及是否存在 KL罚款或相等的调节剂.

## 运动

1. 跑步`code/main.py`设置`beta = 0.0`报告200个PPO步骤后的行动分布.在一段说明寻找模式的行为.

2. 修改奖励模型以为B行动 (模拟奖励错误) 提供 +0.5 偏差.`beta = 0.1`,这项罚款是否阻止政策利用偏见?`beta`剥削是不是显而易见的?

3. 阅读Ouyang等 (arXiv:2203.02155) 图 1.通过运行PPO 1, 5, 20, 100步,并与SFT模型测量偏好来复制标签偏好曲线.

4. 报纸4.3节报告说,1.3B的InstructGPT超过175B的GPT-3大约70%的时间.为什么隐藏的生产提示比标签家自己的提示要高?

5. 根据相同的偏好数据,替换PPO损失为DPO (阶段10 · 08). 进行最终政策漂移 (KL到SFT) 和最终奖励的比较.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| SFT | "instruction tuning" | Stage 1: cross-entropy fine-tune on prompt-response pairs |
| Reward model | "the RM" | Scalar regressor over (prompt, response) trained with Bradley-Terry on pairwise labels |
| Bradley-Terry | "pairwise preference loss" | $-\log \sigma(r_w - r_l)$; reduces pairwise ranking to binary classification |
| KL penalty | "the regularizer" | `beta * KL(pi \|\| pi_SFT)` — keeps the RL policy near the SFT anchor |
| PPO-ptx | "PPO with pretraining mix" | Adds a fraction of pre-training log-likelihood to the PPO objective to offset the alignment tax |
| Alignment tax | "the RLHF regression" | Post-RLHF drop on standard benchmarks that RLHF did not target |
| Labeler preference | "the ground truth" | Sample of human rankings; the RM is a statistical proxy for this, not for "human values" |

## 进一步阅读

- [Ouyang et al. — Training language models to follow instructions with human feedback (arXiv:2203.02155)](https://arxiv.org/abs/2203.02155) 根据每一个随后的RLHF管道的基础,
- [Stiennon et al. — Learning to summarize from human feedback (arXiv:2009.01325)](https://arxiv.org/abs/2009.01325)前任的RLHF对总结
- [Christiano et al. — Deep reinforcement learning from human preferences (arXiv:1706.03741)](https://arxiv.org/abs/1706.03741)原始基于优先级的RL配方
- [Bai et al. — Training a Helpful and Harmless Assistant with RLHF (arXiv:2204.05862)](https://arxiv.org/abs/2204.05862)安特罗皮克对InstructGPT管道的HH延伸
