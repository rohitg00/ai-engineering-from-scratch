# 03 · 直接偏好优化家族

> Rafailov 等人（2023）证明 RLHF 的最优解在偏好数据上存在闭式表达，因此你可以跳过显式奖励模型，直接优化策略。这一洞见催生了一个算法家族——IPO、KTO、SimPO、ORPO、BPO——各自修正 DPO 的一项失效模式。到 2026 年，直接对齐算法在新一轮前沿训练中的部署量已超过 PPO。但第 2 课中的过优化曲线依然适用：DAA 无法摆脱古德哈特定律，只是换了一个地方被反噬而已。

**类型：** 学习
**语言：** Python（标准库，六种偏好损失对比器）
**前置：** 阶段 18 · 01（InstructGPT）、阶段 18 · 02（奖励黑客）、阶段 10 · 08（DPO 基础）
**时长：** 约 75 分钟

## 学习目标

- 从 RLHF-KL 最优解出发推导 DPO 的闭式解。
- 说明 IPO、KTO、SimPO、ORPO、BPO 各自修正了 DPO 的哪种失效模式。
- 区分「隐式奖励差距（implicit reward gap）」与「偏好强度（preference strength）」的概念，并解释为何 IPO 的恒等映射很重要。
- 解释为何 Rafailov 等人（NeurIPS 2024）证明直接对齐算法（DAA）在没有显式奖励模型（RM）的情况下仍会过优化。

## 问题

RLHF 的目标函数（第 1 课）：

```
max_pi E_{x,y~pi} [ r(x, y) ] - beta * KL(pi || pi_ref)
```

有已知的最优解：

```
pi*(y|x) = (1/Z(x)) * pi_ref(y|x) * exp(r(x, y) / beta)
```

因此，奖励由最优策略与参考策略（reference policy）之比隐式定义：

```
r(x, y) = beta * log(pi*(y|x) / pi_ref(y|x)) + beta * log Z(x)
```

将其代入 Bradley-Terry 偏好似然中，配分函数（partition function）`Z(x)` 因仅依赖 `x` 而被消去。剩下的就是一个仅含策略参数的损失函数——不需要奖励模型。这就是 DPO（直接偏好优化，Direct Preference Optimization）。

但这里存在一个微妙之处：上述推导假设最优解可达到、偏好数据在分布内、参考策略是真实的模式锚点。这些假设没有一条完全成立。而该家族的每个成员恰好修正了一条不成立的假设。

## 核心概念

### DPO（Rafailov 等人，2023）

```
L_DPO = -log sigmoid(
  beta * log(pi(y_w | x) / pi_ref(y_w | x))
  - beta * log(pi(y_l | x) / pi_ref(y_l | x))
)
```

可能出错的地方：

- 隐式奖励差距 `beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)` 是无界的。即便偏好差异极小，也能产生任意大的差距。
- 损失函数推动已选（chosen）和已拒（rejected）的对数概率朝相反方向移动。只要已拒的下降更快，它就可以同时压低已选的绝对对数概率。这就是「退化已选响应（Degraded Chosen Response）」现象。
- 分布外的偏好（罕见对罕见对）会产生任意的隐式奖励。

### IPO（Azar 等人，2024）

恒等偏好优化（Identity Preference Optimization）将对数-sigmoid 替换为偏好概率上的恒等映射。损失函数变为一个有界目标上的平方误差：

```
L_IPO = (log(pi(y_w | x) / pi_ref(y_w | x)) - log(pi(y_l | x) / pi_ref(y_l | x)) - 1/(2 beta))^2
```

边距（margin）由 `1/(2 beta)` 界定。偏好强度与隐式奖励差距成正比，不会出现爆炸。

### KTO（Ethayarajh 等人，2024）

卡尼曼-特沃斯基优化（Kahneman-Tversky Optimization）完全抛弃了成对结构。给定单个带标签的输出及二值「可取（desirable）」或「不可取（undesirable）」信号，它映射到前景理论（prospect theory）效用：

```
v(x, y) = sigma(beta * log(pi(y|x) / pi_ref(y|x)) - z_ref)
```

收益和损失采用不同权重（损失厌恶，loss aversion）。优势：可以使用非成对数据，这类数据远比成对数据丰富。

### SimPO（Meng 等人，2024）

简单偏好优化（Simple Preference Optimization）使训练信号与生成对齐。移除参考策略，并按长度对对数似然做归一化：

```
L_SimPO = -log sigmoid(
  (beta / |y_w|) * log pi(y_w | x)
  - (beta / |y_l|) * log pi(y_l | x)
  - gamma
)
```

引入边距 `gamma` 以保证稳定性。长度归一化消除了利用 DPO 长度偏差失效模式的动机（更长的 `y_w` 天然地产生更小的对数概率——绝对值更大，即更大的差距）。

### ORPO（Hong 等人，2024）

胜率比偏好优化（Odds-Ratio Preference Optimization）在标准 SFT 负对数似然之上增加了一个偏好项：

```
L_ORPO = L_NLL(y_w) + lambda * L_OR
L_OR = -log sigmoid(log(odds(y_w) / odds(y_l)))
```

不需要参考策略——SFT 项本身就充当正则化器。从基座模型到对齐模型只需单阶段训练，无需单独的 SFT 检查点。

### BPO（ICLR 2026 投稿，OpenReview id=b97EwMUWu7）

提出了退化已选响应问题：DPO 保持了排序 `y_w > y_l`，但 `y_w` 的绝对对数概率可能下降。BPO（行为保留优化，Behavior Preservation Optimization）增加了一行修正，对于将已选响应向下推的方向施加惩罚。在 Llama-3.1-8B-Instruct 上的数学推理准确率比 DPO 提升了 +10.1%。

### 普遍结论：DAA 仍然会过优化

Rafailov 等人「直接对齐算法中奖励模型过优化的缩放定律」（Scaling Laws for Reward Model Overoptimization in Direct Alignment Algorithms，NeurIPS 2024）在多个数据集上以不同的 KL 预算训练了 DPO、IPO、SLiC 策略。其真实奖励-vs-KL 曲线呈现出与 Gao 等人相同的先升后降形状。隐式奖励在训练过程中查询分布外样本；KL 正则化对此无法稳定。

DAA 无法摆脱古德哈特定律（Goodhart's Law）。它们只是把反噬的层面从「奖励模型过优化」转移到了「参考策略比率过优化」。通用的补救措施——更好的数据、集成（ensemble）、早停（early stopping）——对两者都适用。

### 2026 年的选择指南

- 如果你有大量成对偏好数据：使用 DPO 并搭配保守的 beta 值；如果长度偏差明显，用 SimPO。
- 如果你有非成对的二值反馈：使用 KTO。
- 如果你想要从基座模型出发的单阶段流程：使用 ORPO。
- 如果你在 DPO 日志中看到已选对数概率退化：使用 BPO。
- 如果偏好强度差异很大导致 DPO 饱和：使用 IPO。

每个实验室都会在评测集上对全部五种方法跑一轮，然后按任务选最优的那个。数学推理和安全任务的最优解本来就不必相同。

## 使用

`code/main.py` 在一个人造偏好数据集上对比六种损失函数（DPO、IPO、KTO、SimPO、ORPO、BPO），该数据集中每对偏好对的真实偏好强度各不相同。每种损失都在相同的 500 对样本和一个小型 softmax 策略上进行优化。输出各方法的最终胜率、已选对数概率漂移和隐式奖励分布情况。

## 交付

本课产出为 `outputs/skill-preference-loss-selector.md`。给定数据集统计信息（成对 vs 非成对、偏好强度可变 vs 均匀、长度分布）和训练目标（单阶段还是 SFT-后-偏好），推荐一种偏好损失并说明其所防范的失效模式。

## 练习

1. 运行 `code/main.py`。报告 DPO 和 BPO 的最终已选对数概率下降量。BPO 应保留更高的已选绝对概率——请验证。

2. 修改偏好数据，使所有偏好对具有相等的强度。六种方法中哪一种最鲁棒？哪一种会退化？解释 IPO 在此场景下的优势。

3. 将被拒响应的平均长度设为已选响应的 2 倍。在不改动其他内容的前提下，用数值展示 DPO 的长度利用问题以及 SimPO 的修正效果。

4. Rafailov 等人（NeurIPS 2024）声称 DAA 会过优化。复现一个单点版本：绘制已选-减-已拒的 KL 散度，观察 DPO 在大 beta 值下的过优化现象。

5. 阅读 BPO 论文摘要（OpenReview b97EwMUWu7）。写出 BPO 在 DPO 基础上加入的那一行修正。对照 `code/main.py` 中的实现进行确认。

## 关键术语

| 术语 | 常见说法 | 实际含义 |
|------|---------|---------|
| DPO | 「不需要奖励模型的 RLHF」 | 从 RLHF 最优闭式解推导出的损失函数；仅含策略参数 |
| 隐式奖励 | 「对数比率」 | `beta * log(pi(y\|x) / pi_ref(y\|x))`——DPO 隐含的奖励 |
| IPO | 「有界 DPO」 | 将对数-sigmoid 替换为恒等映射；隐式奖励差距由 `1/(2 beta)` 限制 |
| KTO | 「非成对 DPO」 | 基于前景理论效用的单标签评分，含损失厌恶 |
| SimPO | 「无参考 DPO」 | 长度归一化的对数似然 + 边距；无参考策略 |
| ORPO | 「单阶段 DPO」 | 负对数似然 + 胜率比偏好项；从基座模型单轮训练 |
| BPO | 「保留已选 DPO」 | DPO 加上对降低已选响应绝对对数概率的惩罚 |
| 退化已选 | 「已选往下掉」 | DPO 只要已拒掉得更快，就可压低已选的对数概率 |
| DAA | 「直接对齐算法」 | 任何跳过显式奖励模型的偏好损失方法 |

## 扩展阅读

- [Rafailov 等人——直接偏好优化（NeurIPS 2023, arXiv:2305.18290）](https://arxiv.org/abs/2305.18290)
- [Azar 等人——理解人类偏好学习的通用理论范式（AISTATS 2024, arXiv:2310.12036）](https://arxiv.org/abs/2310.12036)——IPO
- [Ethayarajh 等人——KTO：将模型对齐视为前景理论优化（arXiv:2402.01306）](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen——SimPO（NeurIPS 2024, arXiv:2405.14734）](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne——ORPO（EMNLP 2024, arXiv:2403.07691）](https://arxiv.org/abs/2403.07691)
- [BPO——行为保留优化（ICLR 2026 OpenReview b97EwMUWu7）](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov 等人——DAA 中奖励模型过优化的缩放定律（NeurIPS 2024, arXiv:2406.02900）](https://arxiv.org/abs/2406.02900)
