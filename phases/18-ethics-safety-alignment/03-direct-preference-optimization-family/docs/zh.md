# Direct Preference Optimization 家族

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Rafailov 等人（2023）证明 RLHF 的最优解可以用偏好数据写成闭式（closed form），于是你可以跳过显式的 reward model，直接对策略做优化。这一洞见催生出一整个家族——IPO、KTO、SimPO、ORPO、BPO——每一个都修补了 DPO 的某种失效模式。到了 2026 年，前沿的后训练（post-training）跑批里，直接对齐算法（direct alignment algorithms, DAA）出货量已经超过 PPO。但第 2 课提到的过度优化曲线仍然成立：DAA 没有逃出 Goodhart 定律的手心，它们只是把它咬人的位置挪了个地方。

**Type:** Learn
**Languages:** Python (stdlib, six-variant preference-loss comparator)
**Prerequisites:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking), Phase 10 · 08 (DPO basics)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 从带 KL 的 RLHF 最优解推导出 DPO 的闭式表达。
- 说出 IPO、KTO、SimPO、ORPO、BPO 各自修补了 DPO 的哪一种失效模式。
- 区分「隐式奖励差（implicit reward gap）」和「偏好强度（preference strength）」，并解释 IPO 的恒等映射为什么重要。
- 解释 Rafailov 等人（NeurIPS 2024）为什么能证明 DAA 即使没有显式 RM 也仍然会过度优化。

## 问题（Problem）

RLHF 的目标函数（第 1 课）：

```
max_pi E_{x,y~pi} [ r(x, y) ] - beta * KL(pi || pi_ref)
```

有一个已知的最优解：

```
pi*(y|x) = (1/Z(x)) * pi_ref(y|x) * exp(r(x, y) / beta)
```

所以奖励就被最优策略与参考策略的比值隐式定义了：

```
r(x, y) = beta * log(pi*(y|x) / pi_ref(y|x)) + beta * log Z(x)
```

把它代回 Bradley-Terry 偏好似然中，配分函数 `Z(x)` 因为只依赖 `x` 而被消掉。剩下的是一个只关于策略参数的损失——不再需要 reward model。这就是 DPO。

唯一的小麻烦：这套推导假设最优解可达、偏好数据在分布内、参考策略是真正的众数锚点。这些假设没有一个是严格成立的。家族里每个成员，都在修补一条被违反的假设。

## 概念（Concept）

### DPO（Rafailov 等人，2023）

```
L_DPO = -log sigmoid(
  beta * log(pi(y_w | x) / pi_ref(y_w | x))
  - beta * log(pi(y_l | x) / pi_ref(y_l | x))
)
```

会出问题的地方：

- 隐式奖励差 `beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)` 是无界的。一个微小的偏好就可能产生任意大的差。
- 损失把 chosen（被选）和 rejected（被拒）的 log-prob 往相反方向推。只要 rejected 掉得更快，它甚至可以把 chosen 的绝对 log-prob 也压下去。这就是 Degraded Chosen Response（chosen 回复退化）现象。
- 分布外的偏好（罕见对 vs 罕见对）会产生任意的隐式奖励。

### IPO（Azar 等人，2024）

Identity Preference Optimization 把 log-sigmoid 换成对偏好概率的恒等映射。损失变成一个有界目标上的平方误差：

```
L_IPO = (log(pi(y_w | x) / pi_ref(y_w | x)) - log(pi(y_l | x) / pi_ref(y_l | x)) - 1/(2 beta))^2
```

间隔（margin）被 `1/(2 beta)` 限住。偏好强度和隐式奖励差成正比。不会爆。

### KTO（Ethayarajh 等人，2024）

Kahneman-Tversky Optimization 直接抛掉成对结构。给定一条带标签的输出和一个二元的「desirable / undesirable」（合意 / 不合意）信号，把它映射到一个前景理论（prospect theory）的效用函数：

```
v(x, y) = sigma(beta * log(pi(y|x) / pi_ref(y|x)) - z_ref)
```

收益和损失走不同权重（loss aversion，损失厌恶）。好处：你可以用非配对数据，而这种数据要多得多。

### SimPO（Meng 等人，2024）

Simple Preference Optimization 让训练信号和生成对齐。完全去掉参考策略，并把对数似然按长度归一化：

```
L_SimPO = -log sigmoid(
  (beta / |y_w|) * log pi(y_w | x)
  - (beta / |y_l|) * log pi(y_l | x)
  - gamma
)
```

加一个间隔 `gamma` 来稳定。长度归一化消除了利用 DPO 长度偏差失效模式的动机（更长的 `y_w` 在构造上就会带来更大的 log-prob 差）。

### ORPO（Hong 等人，2024）

Odds-Ratio Preference Optimization 在标准 SFT 的负对数似然之上加了一项偏好项：

```
L_ORPO = L_NLL(y_w) + lambda * L_OR
L_OR = -log sigmoid(log(odds(y_w) / odds(y_l)))
```

不需要参考策略——SFT 项就是正则化项。从基础模型一路单阶段训练到对齐模型，没有独立的 SFT checkpoint。

### BPO（ICLR 2026 投稿，OpenReview id=b97EwMUWu7）

明确指出了 Degraded Chosen Responses 问题：DPO 保留了排序 `y_w > y_l`，但 `y_w` 的绝对 log-prob 可能下降。BPO 加了一行修正，惩罚 chosen 回复上的下移动作。在 Llama-3.1-8B-Instruct 的数学推理任务上，比 DPO 高出 +10.1% 的准确率。

### 普遍结论：DAA 仍然会过度优化

Rafailov 等人「Scaling Laws for Reward Model Overoptimization in Direct Alignment Algorithms」（NeurIPS 2024）在多套数据集、多个 KL 预算下用 DPO、IPO、SLiC 训练策略。Gold-reward 对 KL 的曲线，呈现出和 Gao 等人那篇论文一样的「先涨后崩」形状。隐式奖励在训练中会查询分布外样本；KL 正则化稳不住这件事。

DAA 没有逃出 Goodhart。它们只是把咬人的位置从「reward model 被过度优化」挪到了「参考策略比值被过度优化」。通用解药——更好的数据、ensemble、early stopping（早停）——对两边都管用。

### 怎么挑（2026 版）

- 如果你有大量配对偏好数据：DPO 配保守的 beta，遇到长度偏差明显时切 SimPO。
- 如果你只有非配对的二元反馈：KTO。
- 如果你想要从基础模型出发的单阶段流水线：ORPO。
- 如果你在 DPO 的训练日志里看到 chosen log-prob 退化：BPO。
- 如果偏好强度差异很大、DPO 已经饱和：IPO。

每家实验室都会把这五个全跑一遍，按任务挑赢家。没有任何理由让数学推理和安全任务最优解一样。

## 用起来（Use It）

`code/main.py` 在一个玩具偏好数据集上对比六种损失（DPO、IPO、KTO、SimPO、ORPO、BPO），其中各对的真实偏好强度有差异。每种损失都用一个小型 softmax 策略在同一份 500 对样本上做优化。绘制每种方法的最终胜率、chosen log-prob 漂移以及隐式奖励的离散度。

## 上线部署（Ship It）

本课产出 `outputs/skill-preference-loss-selector.md`。给定数据集统计信息（配对 vs 非配对、偏好强度均匀 vs 不均匀、长度分布）和目标（单阶段 vs SFT-后接偏好），推荐一种偏好损失，并报告它能防住的失效模式。

## 练习（Exercises）

1. 跑 `code/main.py`。报告 DPO 和 BPO 最终的 chosen log-prob 下降量。BPO 应当保留更高的 chosen 绝对概率——验证一下。

2. 改造偏好数据，让所有对的偏好强度相等。六种方法里哪种最稳？哪种会退化？解释 IPO 在这种场景下的优势。

3. 让 rejected 回复的平均长度是 chosen 的 2 倍。在不改其他任何东西的前提下，用数值方式展示 DPO 的长度利用问题，以及 SimPO 是怎么修的。

4. Rafailov 等人（NeurIPS 2024）声称 DAA 会过度优化。复现一个单点版本：画出 chosen-minus-rejected 的 KL 散度，观察在 beta 较大时 DPO 的过度优化现象。

5. 读 BPO 论文摘要（OpenReview b97EwMUWu7）。写下 BPO 在 DPO 之上加的那一行修正。对照 `code/main.py` 里的实现确认。

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 它真正的意思 |
|------|-----------------|------------------------|
| DPO | 「不要 reward model 的 RLHF」 | 从 RLHF 闭式最优解推出的损失；只动策略参数 |
| Implicit reward（隐式奖励） | 「就是那个 log 比值」 | `beta * log(pi(y\|x) / pi_ref(y\|x))`——DPO 隐式定义出的奖励 |
| IPO | 「有界版 DPO」 | 把 log-sigmoid 换成恒等；隐式奖励差被 `1/(2 beta)` 限住 |
| KTO | 「非配对版 DPO」 | 单标签上的前景理论效用函数，带损失厌恶 |
| SimPO | 「无参考版 DPO」 | 长度归一化 log-likelihood + 间隔；不需要参考策略 |
| ORPO | 「单阶段版 DPO」 | NLL + odds-ratio 偏好项；从基础模型一遍过 |
| BPO | 「保 chosen 版 DPO」 | DPO 之上加一项惩罚，禁止 chosen 回复绝对 log-prob 下降 |
| Degraded Chosen | 「chosen 也跌了」 | 只要 rejected 跌得更快，DPO 就会把 chosen log-prob 一并压下去 |
| DAA | 「direct alignment algorithm，直接对齐算法」 | 任何跳过显式 RM 的偏好损失方法 |

## 延伸阅读（Further Reading）

- [Rafailov et al. — Direct Preference Optimization (NeurIPS 2023, arXiv:2305.18290)](https://arxiv.org/abs/2305.18290)
- [Azar et al. — A General Theoretical Paradigm to Understand Learning from Human Preferences (AISTATS 2024, arXiv:2310.12036)](https://arxiv.org/abs/2310.12036) — IPO
- [Ethayarajh et al. — KTO: Model Alignment as Prospect Theoretic Optimization (arXiv:2402.01306)](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen — SimPO (NeurIPS 2024, arXiv:2405.14734)](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne — ORPO (EMNLP 2024, arXiv:2403.07691)](https://arxiv.org/abs/2403.07691)
- [BPO — Behavior Preservation Optimization (ICLR 2026 OpenReview b97EwMUWu7)](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov et al. — Scaling Laws for RM Overoptimization in DAAs (NeurIPS 2024, arXiv:2406.02900)](https://arxiv.org/abs/2406.02900)
