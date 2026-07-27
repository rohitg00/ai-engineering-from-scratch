# 直接偏好优化家族

> Rafailov 等人（2023）证明 RLHF 的最优解在偏好数据空间中存在闭式解，因此可以跳过显式奖励模型，直接优化策略。这一洞见衍生出一个技术家族——IPO、KTO、SimPO、ORPO、BPO——每种方法都解决了 DPO 的某种失效模式。到 2026 年，直接对齐算法在前沿模型的后训练中占比已超过 PPO。但第二课中的过度优化曲线仍然适用：DAA 并未逃脱古德哈特定律，只是改变了其生效的位置。

**类型：** 学习  
**语言：** Python（标准库，六种变体偏好损失比较器）  
**前置条件：** 阶段 18 · 01（InstructGPT）、阶段 18 · 02（奖励黑客攻击）、阶段 10 · 08（DPO 基础）  
**时长：** 约 75 分钟

## 学习目标

- 从带 KL 正则化的 RLHF 最优解推导出 DPO 闭式解。
- 说明 IPO、KTO、SimPO、ORPO、BPO 各自解决了 DPO 的哪种失效模式。
- 区分"隐式奖励差距"与"偏好强度"，并解释为何 IPO 的恒等映射很重要。
- 解释为何 Rafailov 等人（NeurIPS 2024）证明 DAA 即使没有显式奖励模型仍会过度优化。

## 问题

RLHF 目标函数（第一课）：

```
max_pi E_{x,y~pi} [ r(x, y) ] - beta * KL(pi || pi_ref)
```

存在已知的最优解：

```
pi*(y|x) = (1/Z(x)) * pi_ref(y|x) * exp(r(x, y) / beta)
```

因此奖励可以由最优策略与参考策略的比值隐式定义：

```
r(x, y) = beta * log(pi*(y|x) / pi_ref(y|x)) + beta * log Z(x)
```

将其代入 Bradley-Terry 偏好似然函数，配分函数 `Z(x)` 因为仅依赖于 `x` 而抵消。剩下的损失函数只包含策略参数——不再需要奖励模型。这就是 DPO。

问题在于：该推导假设最优解可达、偏好数据在分布内、且参考策略是真正的模态锚点。这些假设没有一条完全成立。该技术家族的每个成员修复了其中一条被违反的假设。

## 概念解析

### DPO（Rafailov 等人，2023）

```
L_DPO = -log sigmoid(
  beta * log(pi(y_w | x) / pi_ref(y_w | x))
  - beta * log(pi(y_l | x) / pi_ref(y_l | x))
)
```

可能出问题的地方：

- 隐式奖励差距 `beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)` 是无界的。微小的偏好差异也能产生任意大的差距。
- 损失函数驱使胜选和落选的对数概率向相反方向变化。只要落选的对数概率下降得更快，胜选的对数概率绝对值也可能下降。这就是"胜选响应退化"现象。
- 分布外的偏好（稀有对 vs 稀有对）会产生任意的隐式奖励。

### IPO（Azar 等人，2024）

恒等偏好优化（Identity Preference Optimization）用偏好概率上的恒等映射替代 log-sigmoid。损失函数变为一个有界目标上的平方误差：

```
L_IPO = (log(pi(y_w | x) / pi_ref(y_w | x)) - log(pi(y_l | x) / pi_ref(y_l | x)) - 1/(2 beta))^2
```

边距由 `1/(2 beta)` 界定。偏好强度与隐式奖励差距成正比。不会出现数值爆炸。

### KTO（Ethayarajh 等人，2024）

Kahneman-Tversky 优化完全放弃了成对结构。给定一个标注的输出和一个二元的"合意"或"不合意"信号，将其映射为前景理论效用：

```
v(x, y) = sigma(beta * log(pi(y|x) / pi_ref(y|x)) - z_ref)
```

对收益和损失使用不同的权重（损失厌恶）。优点：可以使用非配对数据，这类数据要丰富得多。

### SimPO（Meng 等人，2024）

简单偏好优化（Simple Preference Optimization）将训练信号与生成过程对齐。完全移除参考策略，并按长度归一化对数似然：

```
L_SimPO = -log sigmoid(
  (beta / |y_w|) * log pi(y_w | x)
  - (beta / |y_l|) * log pi(y_l | x)
  - gamma
)
```

使用边距 `gamma` 进行稳定。长度归一化消除了利用 DPO 长度偏差失效模式的动机（更长的 `y_w` 天然会产生更大的对数概率差距）。

### ORPO（Hong 等人，2024）

比值比偏好优化（Odds-Ratio Preference Optimization）在标准的 SFT 负对数似然上增加了一个偏好项：

```
L_ORPO = L_NLL(y_w) + lambda * L_OR
L_OR = -log sigmoid(log(odds(y_w) / odds(y_l)))
```

没有参考策略——SFT 项本身就是正则化器。从基座模型到对齐模型只需单阶段训练，无需独立的 SFT 检查点。

### BPO（ICLR 2026 投稿，OpenReview id=b97EwMUWu7）

识别了"胜选响应退化"问题：DPO 保留了 `y_w > y_l` 的排序，但 `y_w` 的对数概率绝对值可能下降。BPO 增加了一行修正代码，惩罚胜选响应的概率下降。在 Llama-3.1-8B-Instruct 的数学推理任务上，相较 DPO 报告了 +10.1% 的准确率提升。

### 普适结论：DAA 仍然会过度优化

Rafailov 等人在《Scaling Laws for Reward Model Overoptimization in Direct Alignment Algorithms》（NeurIPS 2024）中，使用 DPO、IPO、SLiC 在多个数据集上、跨越不同 KL 预算训练策略。Gold-reward-vs-KL 曲线呈现出与 Gao 等人相同的峰值-坍塌形状。隐式奖励在训练过程中查询了分布外的样本；KL 正则化无法稳定这一现象。

DAA 并未逃脱古德哈特定律。它们只是改变了问题发生的表面——从"奖励模型过度优化"变为"参考策略比值过度优化"。通用的解决方案——更好的数据、集成方法、早停——对两者都适用。

### 如何选择（2026）

- 如果有大量成对偏好数据：使用 DPO（保守的 beta），若存在明显的长度偏差则使用 SimPO。
- 如果有非配对的二元反馈：使用 KTO。
- 如果希望从基座模型出发进行单阶段训练：使用 ORPO。
- 如果在 DPO 日志中观察到胜选响应对数概率退化：使用 BPO。
- 如果偏好强度差异很大且 DPO 趋于饱和：使用 IPO。

每个实验室都会在测试集上运行全部五种方法，为每个任务选择最优方案。数学推理和安全对齐的最优方法没有理由相同。

```figure
dpo-margin
```

## 使用

`code/main.py` 在一个玩具偏好数据集上比较六种损失函数（DPO、IPO、KTO、SimPO、ORPO、BPO），其中真实的偏好强度因配对而异。每种损失函数使用相同的 500 对样本和一个小型的 softmax 策略进行优化。输出包括每种方法的最终胜率、胜选对数概率漂移和隐式奖励分布。

## 交付

本课程产出 `outputs/skill-preference-loss-selector.md`。给定数据集统计特征（成对 vs 非成对、可变 vs 均匀偏好强度、长度分布）和目标（单阶段或 SFT-再-偏好），推荐一种偏好损失函数，并说明其防护的失效模式。

## 练习

1. 运行 `code/main.py`。报告 DPO 和 BPO 的最终胜选对数概率下降值。BPO 应保持更高的胜选绝对概率——请验证这一点。

2. 修改偏好数据，使所有配对的偏好强度相等。六种方法中哪种最鲁棒？哪种退化最严重？解释 IPO 在此处的优势。

3. 使落选响应的平均长度是胜选响应的 2 倍。在不改变其他任何条件的情况下，通过数值展示 DPO 的长度利用现象以及 SimPO 的修复效果。

4. Rafailov 等人（NeurIPS 2024）声称 DAA 会过度优化。重现单点版本：绘制胜选减落选的 KL 散度，观察 DPO 在大 beta 下的过度优化现象。

5. 阅读 BPO 论文摘要（OpenReview b97EwMUWu7）。写下 BPO 在 DPO 基础上增加的一行修正代码。对照 `code/main.py` 中的实现进行确认。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| DPO | "没有奖励模型的 RLHF" | 从 RLHF 闭式最优解推导出的损失函数；仅含策略参数 |
| 隐式奖励 | "对数比值" | `beta * log(pi(y\|x) / pi_ref(y\|x))` —— DPO 隐含的奖励 |
| IPO | "有界 DPO" | 用恒等映射替代 log-sigmoid；隐式奖励差距由 `1/(2 beta)` 限定 |
| KTO | "非配对 DPO" | 基于前景理论的单一标签效用函数，具有损失厌恶特性 |
| SimPO | "无参考 DPO" | 长度归一化的对数似然 + 边距；无需参考策略 |
| ORPO | "单阶段 DPO" | NLL + 比值比偏好项；从基座模型出发一次训练完成 |
| BPO | "保护胜选的 DPO" | DPO 基础上增加对胜选响应绝对对数概率下降的惩罚 |
| 胜选响应退化 | "胜选概率下降" | DPO 会降低胜选响应的对数概率，只要落选响应下降得更快 |
| DAA | "直接对齐算法" | 任何跳过显式奖励模型的偏好损失方法 |

## 延伸阅读

- [Rafailov 等人 — Direct Preference Optimization（NeurIPS 2023, arXiv:2305.18290）](https://arxiv.org/abs/2305.18290)
- [Azar 等人 — A General Theoretical Paradigm to Understand Learning from Human Preferences（AISTATS 2024, arXiv:2310.12036）](https://arxiv.org/abs/2310.12036) —— IPO
- [Ethayarajh 等人 — KTO: Model Alignment as Prospect Theoretic Optimization（arXiv:2402.01306）](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen — SimPO（NeurIPS 2024, arXiv:2405.14734）](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne — ORPO（EMNLP 2024, arXiv:2403.07691）](https://arxiv.org/abs/2403.07691)
- [BPO — Behavior Preservation Optimization（ICLR 2026 OpenReview b97EwMUWu7）](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov 等人 — Scaling Laws for RM Overoptimization in DAAs（NeurIPS 2024, arXiv:2406.02900）](https://arxiv.org/abs/2406.02900)
