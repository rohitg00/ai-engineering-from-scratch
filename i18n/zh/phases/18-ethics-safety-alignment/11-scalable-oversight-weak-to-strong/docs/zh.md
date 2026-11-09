# 扩展性监督和弱到强的普遍化

> 其他类型 (OpenAI超级调整,"弱到强的通用化",2023) 提出了超级调整问题的代理:通过使用较弱模型生产的标签来细节调整强大的模型. 如果强大的模型从不完美的弱监督中得到正确的概括, 可扩展的监督和W2SG是互补的. 扩展式监督 (辩论,回复性奖励模型,任务分解) 增加监督者的有效能力,以便它能够跟上监督下的模型.  W2SG确保强大的模型正确的概括, 辩论帮助 W2SG (arXiv:2501.13124,2025年1月) 结合了它们.

**Type:** Learn
**Languages:** Python (stdlib, W2SG gap simulator), TypeScript
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 18 · 10 (AI Control), Phase 09 (RL foundations)
**Time:** ~60 minutes

## 学习目标

- 定义可扩展的监督和弱到强的概括,并解释它们是如何互补的.
- 描述Burn et al. 2023实验设置:使用GPT-2的标签进行细调GPT-4.
- 解释恢复的绩效差距 (PGR) 指标以及它衡量的情况.
- 说明三个主要可扩展监督机制 (辩论,递归奖励建模,任务分解) 和每个强度.

## 问题

根据"新型模型"的第18阶段,监督者可以评估模型的行为.当模型超人时,监督者是弱点链.

伯恩斯等人将这缩小到一个运行实验性设置:监督强与弱,测量强模型的能力在弱监督中存活了多少. 这不是超级调整的解决方案.

## 概念

### 布尔恩斯等组织

- 弱型:GPT-2类.
- 强大的模型:GPT-4类.
- 目标:任务的GPT-4强.

程序:
1. 让我们得到一个任务的零射击预测.
2. 根据弱标签的数据,细节调整强模型.
3. 测量强度的细调模型的准确性.

基本线:模型的精度较低,强型模型的监督上限在黄金标签上.

差距指标: 绩效差距恢复 (PGR) = (精确调整 - 弱) / (天花板 - 弱).

### 伯恩斯等人经验性发现

在NLP,棋牌拼图和奖励模型任务中,PGR一直是积极的:强大的模型将其扩展到弱的监督者的错误之外.任务特定的PGR从20%到80%左右.强大的模型"理解"预期任务从不完美的标签中,以其预先训练的先驱来补充.

限制 Burns等人注意:
- 弱型模型是对齐的,一个真正超人模型可能是由人类对齐的,但有更大的能力差距.
- 强大的模型的概括可能更多关于任务前期而不是恢复基础真相意图.
- 实际问题是产生强大的模型的潜伏知识;

### 可扩展的监督:三个机制

- **Debate (Irving et al. 2018).**两种例子U争论相反的方面;弱的法官决定.假设:找到一个令人信服的真实答案比找到一个令人信服的错误答案更容易.最近的2024-2025研究 (Khan等人,Michael等人) 显示辩论有时有助,有时没有,是否有助取决于任务结构.
- **Recursive Reward Modeling (Leike et al. 2018).**监督员的有效能力随着模型的增长而增长.
- **Task Decomposition (Christiano, Shlegeris, Amodei 2018).**分解一个艰难的任务成人类可以检查的子任务,反复.

每个机制都假设有关任务结构或中间组件的配合.

### 为什么可扩展监督和W2SG是互补的

监督可以扩展,使监督员的信号质量提高.
监督者可以提供任何不完美的信号.

辩论帮助弱到强的概括 (arXiv:2501.13124) 结合了它们:辩论协议提供了更好的弱标签,强的模型则基于这些标签进行训练.

### 组织戏剧

简莱克离开安тропо基后,OpenAI的超级调整团队于2024年5月解散.议程 (可扩展监督,W2SG,自动调整研究) 在安тропо基和学术实验室继续进行.

### 在这个阶段的第18阶段

课程6-10描述了威胁和防御范式,假设U是不可信的.课程11是攻击范式:让监督员足够强大,以验证U的配合.课程12-16然后转向对抗评估的实际工具.

```figure
scalable-oversight
```

## 用它

`code/main.py`模拟 W2SG 细调在合成任务上. 弱标签器具有70%的准确性,结构错误;强型标签上有95%的天花板. 强型标签上进行细调,测量PGR,并将强度与黄金和弱型标签进行比较.

## 运送它

这一课产生了`outputs/skill-w2sg-pgr.md`鉴于监督设置描述,它确定了监督者弱点,强大的模型,监督质量,并计算 (或要求) PGR.它标记了该索赔是否"弱点可以监督强大"或"弱点+监督机制可以监督强大".

## 运动

1. 跑步`code/main.py`报告PGR为弱_精度 = 0.60,0.70,0.80. 解释PGR曲线的形状.

2. 修改弱标签以结构错误 (例如,在特定输入类中总是错误). PGR 增长,减少或保持相同吗?解释.

3. 阅读Burns等. 2023 第4.3节 (NLP任务). 复制"信心辅助损失"直觉:当强大的模型比弱的标签更自信,谁赢得?

4. 设计一个可扩展的监督协议,将辩论和任务分解结合到一个软件工程任务. 命名每个组件的一个故障模式,并解释组合如何解决或未解决每个组件.

5. 解释"弱到强的概括是超级配合的可行的道路"的说法.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scalable oversight | "making the overseer stronger" | Mechanisms that increase an overseer's ability to evaluate a more-capable model |
| W2SG | "weak supervises strong" | Fine-tuning a strong model on weak labels and measuring the capability recovered |
| PGR | "performance gap recovered" | (fine-tuned - weak) / (ceiling - weak); 1.0 = fully closed, 0 = no help |
| Debate | "two U instances argue" | Scalable oversight mechanism where a weak judge picks between two U defenders |
| RRM | "recursive reward modeling" | U helps train the reward model for U+1; overseer capability tracks U |
| Task decomposition | "sub-tasks the human checks" | Break a hard task into sub-tasks the human can verify, recursively |
| Superalignment | "aligning superhuman AI" | The research agenda concerned with aligning models the human cannot directly evaluate |

## 进一步阅读

- [Burns et al. — Weak-to-Strong Generalization (OpenAI 2023)](https://openai.com/index/weak-to-strong-generalization/) W2SG 文件
- [Irving, Christiano, Amodei — AI safety via debate (arXiv:1805.00899)](https://arxiv.org/abs/1805.00899)辩论机制
- [Leike et al. — Scalable agent alignment via reward modeling (arXiv:1811.07871)](https://arxiv.org/abs/1811.07871)复发性奖励建模
- [Khan et al. — Debating with More Persuasive LLMs Leads to More Truthful Answers (arXiv:2402.06782)](https://arxiv.org/abs/2402.06782) 2024 经验性研究与更强大的辩论者
- [Lang et al. — Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124)](https://arxiv.org/abs/2501.13124) 2025 辩论组合+W2SG
