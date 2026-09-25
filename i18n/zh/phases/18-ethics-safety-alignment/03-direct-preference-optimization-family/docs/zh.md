# 直接偏好优化家族

> Rafailov et al. (2023) 证明了 RLHF 的最优解具有关于偏好数据的闭式形式，因此你可以跳过显式的奖励模型，直接优化策略。这一洞见催生了一个家族——IPO、KTO、SimPO、ORPO、BPO——每个变体都在修复 DPO 的某种失效模式。到 2026 年，直接对齐算法在前沿后训练流程中的使用已超过 PPO。但第 2 课中的过优化曲线依然适用：DAA 并不能摆脱 Goodhart 定律，只是改变了它发作的位置。

**Type:** Learn
**Languages:** Python (标准库，六变体偏好损失比较器)
**Prerequisites:** Phase 18 · 01 (InstructGPT)、Phase 18 · 02 (Reward hacking)、Phase 10 · 08 (DPO 基础)
**Time:** ~75 分钟

## 学习目标

- 从带 KL 约束的 RLHF 最优解推导 DPO 的闭式形式。
- 说明 IPO、KTO、SimPO、ORPO、BPO 各自修复了 DPO 的哪种失效模式。
- 区分“隐式奖励差距”与“偏好强度”，并解释为什么 IPO 的恒等映射很重要。
- 解释为什么 Rafailov et al. (NeurIPS 2024) 证明了 DAA 即使没有显式 RM 仍会过优化。

## 问题

带 KL 约束的 RLHF 目标(第 1 课):

```
max_pi E_{x,y~pi} [ r(x, y) ] - beta * KL(pi || pi_ref)
```

有一个已知的最优解:

```
pi*(y|x) = (1/Z(x)) * pi_ref(y|x) * exp(r(x, y) / beta)
```

因此奖励由最优策略与参考策略之比隐式定义:

```
r(x, y) = beta * log(pi*(y|x) / pi_ref(y|x)) + beta * log Z(x)
```

将此代入 Bradley-Terry 偏好似然，配分函数 `Z(x)` 会被消去，因为它只依赖于 `x`。剩下的就是一个仅关于策略参数的损失——不再需要奖励模型。这就是 DPO。

微妙之处在于：该推导假设最优解是可达的、偏好数据是分布内的、参考策略是真实的众数锚点。这些假设没有一个严格成立。家族中的每个成员都在修复一个不同的被违反的假设。

## 核心概念

### DPO (Rafailov et al., 2023)

```
L_DPO = -log sigmoid(
  beta * log(pi(y_w | x) / pi_ref(y_w | x))
  - beta * log(pi(y_l | x) / pi_ref(y_l | x))
)
```

可能出现的问题：

- 隐式奖励差距 `beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)` 是无界的。一个微小的偏好可能产生任意大的差距。
- 该损失将 chosen 与 rejected 的对数概率朝相反方向推动。只要 rejected 下降得更快，它可以把 chosen 的绝对对数概率推低。这就是“退化 Chosen 回应”(Degraded Chosen Response)现象。
- 分布外的偏好(罕见配对 vs 罕见配对)会产生任意的隐式奖励。

### IPO (Azar et al., 2024)

恒等偏好优化(Identity Preference Optimization)用对偏好概率的恒等映射取代 log-sigmoid。损失变为对有界目标的平方误差：

```
L_IPO = (log(pi(y_w | x) / pi_ref(y_w | x)) - log(pi(y_l | x) / pi_ref(y_l | x)) - 1/(2 beta))^2
```

间隔被 `1/(2 beta)` 所界定。偏好强度与隐式奖励差距成正比。不会爆炸。

### KTO (Ethayarajh et al., 2024)

Kahneman-Tversky 优化完全抛弃成对结构。给定单个带标签的输出和一个二元的“期望/不期望”信号，它将其映射为前景理论的效用：

```
v(x, y) = sigma(beta * log(pi(y|x) / pi_ref(y|x)) - z_ref)
```

收益与损失使用不同的权重(损失厌恶)。好处：你可以使用非成对数据，这类数据要丰富得多。

### SimPO (Meng et al., 2024)

简单偏好优化使训练信号与生成对齐。完全移除参考策略，并按长度归一化对数似然：

```
L_SimPO = -log sigmoid(
  (beta / |y_w|) * log pi(y_w | x)
  - (beta / |y_l|) * log pi(y_l | x)
  - gamma
)
```

并引入间隔 `gamma` 以稳定训练。长度归一化消除了利用 DPO 长度偏差失效模式的动机(按构造，更长的 `y_w` 天然产生更大的对数概率差距)。

### ORPO (Hong et al., 2024)

几率比偏好优化在标准 SFT 负对数似然上加入一个偏好项：

```
L_ORPO = L_NLL(y_w) + lambda * L_OR
L_OR = -log sigmoid(log(odds(y_w) / odds(y_l)))
```

无需参考策略——SFT 项本身就是正则化项。从基座模型到对齐模型单阶段训练。无需单独的 SFT 检查点。

### BPO (ICLR 2026 投稿, OpenReview id=b97EwMUWu7)

指出退化 Chosen 回应问题:DPO 保持了排序 `y_w > y_l`,但 `y_w` 的绝对对数概率可能下降。BPO 加入了一行修正，对 chosen 回应的向下移动施加惩罚。据报道，在 Llama-3.1-8B-Instruct 的数学推理上比 DPO 高 +10.1% 准确率。

### 通用结论:DAA 仍然过优化

Rafailov et al. "Scaling Laws for Reward Model Overoptimization in Direct Alignment Algorithms" (NeurIPS 2024) 使用 DPO、IPO、SLiC 在多个数据集、不同 KL 预算下训练策略。金标准奖励对 KL 的曲线呈现与 Gao et al. 相同的峰值-崩塌形状。隐式奖励在训练期间会查询分布外样本；KL 正则化并不能稳定这一点。

DAA 无法摆脱 Goodhart 定律。它们只是把发作的表面从“奖励模型被过优化”换成了“参考策略比值被过优化”。通用修复手段——更好的数据、集成、早停——对两者都适用。

### 如何选择(2026)

- 如果你有大量成对偏好数据：使用保守 beta 的 DPO;若长度偏差明显则用 SimPO。
- 如果你有非成对的二元反馈：KTO。
- 如果你想要从基座模型出发的单阶段流程：ORPO。
- 如果你在 DPO 日志中看到 chosen 对数概率退化：BPO。
- 如果偏好强度差异很大且 DPO 已饱和：IPO。

每个实验室都在一套基准上跑全部五个方法，并按任务选出赢家。数学推理和安全性上的最优解没有理由相同。

```figure
dpo-margin
```

## 动手使用

`code/main.py` 在一个玩具偏好数据集上比较六种损失(DPO、IPO、KTO、SimPO、ORPO、BPO),其中真实偏好强度因配对而异。每种损失都在同一份 500 对样本上用一个小型 softmax 策略进行优化。绘制每种方法的最终胜率、chosen 对数概率漂移以及隐式奖励散布。

## 交付

本课产出 `outputs/skill-preference-loss-selector.md`。给定数据集统计特征(成对 vs 非成对、偏好强度可变 vs 均匀、长度分布)和目标(单阶段或先 SFT 再偏好优化)，推荐一种偏好损失，并报告它能防范的失效模式。

## 练习

1. 运行 `code/main.py`。报告 DPO 和 BPO 的最终 chosen 对数概率下降量。BPO 应保留更高的 chosen 绝对概率——请验证这一点。

2. 修改偏好数据，使所有配对的强度相等。六种方法中哪种最稳健？哪种退化？解释 IPO 在此的优势。

3. 让 rejected 回应平均长度是 chosen 的 2 倍。在不改变其他条件的情况下，用数值展示 DPO 的长度利用行为以及 SimPO 的修复效果。

4. Rafailov et al. (NeurIPS 2024) 声称 DAA 会过优化。复现一个单点版本：绘制 chosen 减 rejected 的 KL 散度，并观察 DPO 在较大 beta 下的过优化现象。

5. 阅读 BPO 论文摘要(OpenReview b97EwMUWu7)。写下 BPO 加入到 DPO 上的那一行修正。与 `code/main.py` 中的实现进行核对。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| DPO | "没有奖励模型的 RLHF" | 从闭式 RLHF 最优解推导出的损失；只涉及策略参数 |
| 隐式奖励 | "那个对数比值" | `beta * log(pi(y\|x) / pi_ref(y\|x))` ——DPO 所隐含的奖励 |
| IPO | "有界的 DPO" | 用恒等映射取代 log-sigmoid;隐式奖励差距被 `1/(2 beta)` 封顶 |
| KTO | "非成对的 DPO" | 在单个标签上使用带损失厌恶的前景理论效用 |
| SimPO | "无参考的 DPO" | 长度归一化的对数似然 + 间隔；无参考策略 |
| ORPO | "单阶段 DPO" | NLL + 几率比偏好项；从基座模型一次训练完成 |
| BPO | "保留 chosen 的 DPO" | DPO 加上对 chosen 回应绝对对数概率下降的惩罚 |
| 退化 Chosen | "chosen 下降了" | 只要 rejected 下降得更快,DPO 就会降低 chosen 的对数概率 |
| DAA | "直接对齐算法" | 任何跳过显式 RM 的偏好损失方法 |

## 延伸阅读

- [Rafailov et al. — Direct Preference Optimization (NeurIPS 2023, arXiv:2305.18290)](https://arxiv.org/abs/2305.18290)
- [Azar et al. — A General Theoretical Paradigm to Understand Learning from Human Preferences (AISTATS 2024, arXiv:2310.12036)](https://arxiv.org/abs/2310.12036) —— IPO
- [Ethayarajh et al. — KTO: Model Alignment as Prospect Theoretic Optimization (arXiv:2402.01306)](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen — SimPO (NeurIPS 2024, arXiv:2405.14734)](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne — ORPO (EMNLP 2024, arXiv:2403.07691)](https://arxiv.org/abs/2403.07691)
- [BPO — Behavior Preservation Optimization (ICLR 2026 OpenReview b97EwMUWu7)](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov et al. — Scaling Laws for RM Overoptimization in DAAs (NeurIPS 2024, arXiv:2406.02900)](https://arxiv.org/abs/2406.02900)