# 直接偏好优化家族#

> Rafailov et al. (2023) 表明 RLHF 的最优在偏好数据方面具有闭式形式，因此你可以跳过显式奖励模型并直接优化策略。这一见解催生了一个家族——IPO、KTO、SimPO、ORPO、BPO——每个都修复了 DPO 的一个失败模式。在 2026 年，直接对齐算法在 frontier 后训练运行中的部署比 PPO 更多。但第 2 课中的过度优化曲线仍然适用：DAA 不会逃避 Goodhart，它们只是改变了它咬人的位置。

**类型：** 学习
**语言：** Python（标准库，六变体偏好损失比较器）
**先决条件：** 阶段 18 · 01 (InstructGPT)、阶段 18 · 02 (Reward hacking)、阶段 10 · 08 (DPO 基础）
**时间：** 约 75 分钟

## 学习目标#

- 从带 KL 最优的 RLHF 推导出 DPO 闭式形式。
- 陈述 IPO、KTO、SimPO、ORPO、BPO 在 DPO 中修复的失败模式。
- 区分"隐式奖励差距"与"偏好强度"，并解释为什么 IPO 的恒等映射很重要。
- 解释为什么 Rafailov et al. (NeurIPS 2024) 证明 DA 尽管没有显式 RM，但仍会过度优化。

## 问题#

RLHF 目标（第 1 课）：

```
max_pi E_{x,y~pi} [ r(x, y) ] - beta * KL(pi || pi_ref)
```

有一个已知的最优：

```
pi*(y|x) = (1/Z(x)) * pi_ref(y|x) * exp(r(x, y) / beta)
```

因此，奖励通过最优策略与参考之间的比率隐式定义：

```
r(x, y) = beta * log(pi*(y|x) / pi_ref(y|x)) + beta * log Z(x)
```

将其代入 Bradley-Terry 偏好似然，Partition 函数 `Z(x)` 抵消了，因为它只依赖于 `x`。剩下的仅是策略参数中的损失——不需要奖励模型。这就是 DPO。

问题：推导假设最优是可达到的，偏好数据是在分布内的，并且参考策略是真实模型锚点。这些都不是完全成立的。每个家族成员都修复了一个不同的违反假设。

## 概念#

### DPO (Rafailov et al., 2023)#

```
L_DPO = -log sigmoid(
  beta * log(pi(y_w | x) / pi_ref(y_w | x))
  - beta * log(pi(y_l | x) / pi_ref(y_l | x))
)
```

可能出错的地方：

- 隐式奖励差距 `beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l` 是无界的。一个微小的偏好可能产生任意大的差距。
- 损失将选中（chosen）和拒绝（rejected）的对数概率推向相反方向。只要拒绝下降得更快，它就可以将选中的绝对对数概率推低。这就是"选中响应降级"（Degraded Chosen Response）现象。
- 分布外偏好（罕见的罕见对 vs 罕见的罕见对）产生任意的隐式奖励。

### IPO (Azar et al., 2024)#

恒等偏好优化用偏好概率上的恒等映射替换对数 sigmoid。损失变成有界目标上的平方误差：

```
L_IPO = (log(pi(y_w | x) / pi_ref(y_w | x)) - log(pi(y_l | x) / pi_ref(y_l | x)) - 1/(2 beta))^2
```

边界由 `1/(2 beta)` 限定。偏好强度和隐式奖励差距成正比。没有爆炸。

### KTO (Ethayarajh et al., 2024)#

Kahneman-Tversky 优化完全丢弃成对结构。给定单个标注输出和二元"可取"或"不可取"信号，它映射到前景理论效用：

```
v(x, y) = sigma(beta * log(pi(y|x) / pi_ref(y|x)) - z_ref)
```

对收益和损失有不同的权重（损失厌恶）。好处：你可以使用非配对数据，这要丰富得多。

### SimPO (Meng et al., 2024)#

简单偏好优化使训练信号与生成对齐。完全移除参考策略，并按长度归一化对数似然：

```
L_SimPO = -log sigmoid(
  (beta / |y_w|) * log pi(y_w | x)
  - (beta / |y_l|) * log pi(y_l | x)
  - gamma
)
```

带有边界 `gamma` 以稳定。长度归一化移除了利用 DPO 的长度偏差失败模式的动机（更长的 `y_w` 通过构造给出更大的对数概率差距）。

### ORPO (Hong et al., 2024)#

比值偏好优化在标准 SFT 负对数似然中添加了一个偏好项：

```
L_ORPO = L_NLL(y_w) + lambda * L_OR
L_OR = -log sigmoid(log(odds(y_w)) / log(odds(y_l)))
```

无参考策略——SFT 项是正则化器。从基础模型到对齐模型在单个阶段中训练。无独立的 SFT 检查点。

### BPO (ICLR 2026 投稿，OpenReview id=b97EwMUWu7)#

识别"选中响应降级"问题：DPO 保留排名 `y_w > y_l`，但 `y_w` 的绝对对数概率可能下降。BPO 添加了一个单行修正，惩罚选中响应的下降移动。在数学推理上，报告相比 DPO 在 Llama-3.1-8B-Instruct 上准确率提高 +10.1%。

### 通用结果：DAA 仍然过度优化#

Rafailov et al. "Scaling Laws for Reward Model Overoptimization in Direct Alignment Algorithms" (NeurIPS 2024) 在多个数据集上针对 KL 预算使用 DPO、IPO、SLiC 训练策略。真实奖励 vs KL 曲线具有相同的 Gao et al. 峰值和崩溃形状。隐式奖励在训练期间查询分布外样本；KL 正则化不能稳定这一点。

DAA 不会逃避 Goodhart。它们将咬人的表面从"奖励模型过度优化"更改为"参考策略比率过度优化"。通用修复——更好的数据、集成、提前停止——适用于两者。

### 在它们之间进行选择 (2026)#

- 如果你有大型配对偏好数据：DPO 带有保守 beta，如果长度偏差明显则使用 SimPO。
- 如果你有非配对二元反馈：KTO。
- 如果你想要从基础模型的单阶段流水线：ORPO。
- 如果你在 DPO 日志中看到选中的对数概率下降：BPO。
- 如果偏好强度变化很大且 DPO 正在饱和：IPO。

每个实验室都在一组测试上运行所有五个，并针对每个任务选择获胜者。没有理由认为数学推理和安全性的最优是相同的。

## 使用它#

`code/main.py` 在真实偏好强度因对而异的简单偏好数据集上比较六种损失（DPO、IPO、KTO、SimPO、ORPO、BPO）。每个损失都针对相同的 500 对样本和小型 softmax 策略进行优化。绘制每种方法的最终胜率、选中对数概率漂移和隐式奖励分布。

## 部署它#

本课生成 `outputs/skill-reference-loss-selector.md`。给定数据集统计（配对 vs 非配对、可变 vs 均匀偏好强度、长度分布）和目标（单阶段或 SFT-然后-偏好），推荐偏好损失并报告它防止的失败模式。

## 练习#

1. 运行 `code/main.py`。报告 DPO 和 BPO 的最终选中对数概率下降。BPO 应保留更高的选中绝对概率——验证这一点。
2. 修改偏好数据，使所有对具有相等的强度。六种方法中哪一种最鲁棒？哪一种降级？解释 IPO 在这里的优势。
3. 使拒绝的响应平均比选中的长 2 倍。在不更改其他任何内容的情况下，数值化地显示 DPO 的长度利用和 SimPO 的修复。
4. Rafailov et al. (NeurIPS 2024) 声称 DAA 过度优化。重现单点版本：绘制选中减去拒绝 KL 散度，并观察大 beta 时 DPO 中的过度优化。
5. 阅读 BPO 论文摘要（OpenReview b97EwMUWu7）。写下 BPO 添加到 DPO 的单行修正。对照 `code/main.py` 中的实现进行确认。

## 关键术语#

| 术语 | 人们说的 | 实际含义 |
|------|----------------|------------------------|
| DPO | "没有奖励模型的 RLHF" | 从闭式 RLHF 最优导出的损失；仅策略参数 |
| Implicit reward | "对数比率" | `beta * log(pi(y\|x) / pi_ref(y\|x))` — DPO 隐含的奖励 |
| IPO | "有界 DPO" | 用恒等替换对数 sigmoid；隐式奖励差距由 `1/(2 beta)` 上限限定 |
| KTO | "非配对 DPO" | 关于单个标签的前景理论效用，带有损失厌恶 |
| SimPO | "无参考 DPO" | 长度归一化对数似然 + 边界；无参考策略 |
| ORPO | "单阶段 DPO" | NLL + 比值比偏好项；在一次传递中从基础模型训练 |
| BPO | "保留选中的 DPO" | DPO 加上惩罚降低选中响应的绝对对数概率 |
| Degraded Chosen | "选中的下降" | 只要拒绝下降更快，DPO 就会降低选中的对数概率 |
| DAA | "直接对齐算法" | 跳过显式 RM 的任何偏好损失方法 |

## 延伸阅读#

- [Rafailov et al. — Direct Preference Optimization (NeurIPS 2023, arXiv:2305.18290)](https://arxiv.org/abs/2305.18290)
- [Azar et al. — A General Theoretical Paradigm to Understand Learning from Human Preferences (AISTATS 2024, arXiv:2310.12036)] — IPO
- [Ethayarajh et al. — KTO: Model Alignment as Prospect Theoretic Optimization (arXiv:2402.01306)](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen — SimPO (NeurIPS 2024, arXiv:2405.14734)](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne — ORPO (EMNLP 2024, arXiv:2403.07691)](https://arxiv.org/abs/2403.07691)
- [BPO — Behavior Preservation Optimization (ICLR 2026 OpenReview b97EwMUWu7)](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov et al. — Scaling Laws for RM Overoptimization in DAAs (NeurIPS 2024, arXiv:2406.02900)](https://arxiv.org/abs/2406.02900)
