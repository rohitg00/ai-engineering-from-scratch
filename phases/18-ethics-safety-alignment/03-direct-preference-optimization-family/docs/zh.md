# 直接偏好优化（DPO）家族

> Rafailov 等人（2023）证明 RLHF 的最优解在偏好数据下具有闭式形式，因此可以跳过显式奖励模型，直接优化策略。这一洞见催生了一个家族 —— IPO、KTO、SimPO、ORPO、BPO —— 每个都修复了 DPO 的一个失败模式。2026 年，直接对齐算法（DAA）在前沿后训练中的使用已超过 PPO。但第 2 课的过度优化曲线仍然适用：DAA 并未逃脱古德哈特，只是改变了它咬人的位置。

**类型：** 学习
**语言：** Python（标准库，六变体偏好损失比较器）
**前置知识：** 第 18 阶段 · 01（InstructGPT）、第 18 阶段 · 02（奖励黑客）、第 10 阶段 · 08（DPO 基础）
**时间：** ~75 分钟

## 学习目标

- 从带 KL 的 RLHF 最优解推导 DPO 闭式形式。
- 说明 IPO、KTO、SimPO、ORPO、BPO 各自修复了 DPO 的哪个失败模式。
- 区分"隐式奖励差距"与"偏好强度"，并解释为何 IPO 的恒等映射很重要。
- 解释为何 Rafailov 等人（NeurIPS 2024）证明 DAA 尽管没有显式 RM，仍会过度优化。

## 问题背景

RLHF 目标（第 1 课）：

```
max_pi E_{x,y~pi} [ r(x, y) ] - beta * KL(pi || pi_ref)
```

已知最优解：

```
pi*(y|x) = (1/Z(x)) * pi_ref(y|x) * exp(r(x, y) / beta)
```

因此奖励由最优策略与参考策略的比值隐式定义：

```
r(x, y) = beta * log(pi*(y|x) / pi_ref(y|x)) + beta * log Z(x)
```

将其代入 Bradley-Terry 偏好似然，配分函数 `Z(x)` 因仅依赖 `x` 而消去。剩下的是仅含策略参数的损失 —— 无需奖励模型。这就是 DPO。

问题在于：推导假设最优解可达、偏好数据在分布内、参考策略是真正的模态锚点。这些都不完全成立。每个家族成员修复了不同的被违反假设。

## 核心概念

### DPO（Rafailov 等人，2023）

```
L_DPO = -log sigmoid(
  beta * log(pi(y_w | x) / pi_ref(y_w | x))
  - beta * log(pi(y_l | x) / pi_ref(y_l | x))
)
```

可能出错的地方：

- 隐式奖励差距 `beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)` 无界。微小偏好可产生任意大差距。
- 损失将被选和拒绝的对数概率推向相反方向。只要拒绝的下降更快，被选的对数概率可以下降。这就是"退化被选响应"现象。
- 分布外偏好（罕见对罕见）产生任意隐式奖励。

### IPO（Azar 等人，2024）

恒等偏好优化将 log-sigmoid 替换为偏好概率上的恒等映射。损失变为对有界目标的平方误差：

```
L_IPO = (log(pi(y_w | x) / pi_ref(y_w | x)) - log(pi(y_l | x) / pi_ref(y_l | x)) - 1/(2 beta))^2
```

差距被 `1/(2 beta)` 有界。偏好强度与隐式奖励差距成正比。不会爆炸。

### KTO（Ethayarajh 等人，2024）

Kahneman-Tversky 优化完全放弃成对结构。给定单个标注输出和二元的"可取"或"不可取"信号，映射到前景理论效用：

```
v(x, y) = sigma(beta * log(pi(y|x) / pi_ref(y|x)) - z_ref)
```

对收益和损失赋予不同权重（损失厌恶）。好处：可以使用未成对数据，这种数据远更丰富。

### SimPO（Meng 等人，2024）

简单偏好优化将训练信号与生成对齐。完全移除参考策略，并用长度归一化对数似然：

```
L_SimPO = -log sigmoid(
  (beta / |y_w|) * log pi(y_w | x)
  - (beta / |y_l|) * log pi(y_l | x)
  - gamma
)
```

附加 margin `gamma` 以稳定。长度归一化消除了利用 DPO 长度偏见失败模式的动机（更长的 `y_w` 按构造给出更大的对数概率差距）。

### ORPO（Hong 等人，2024）

赔率比偏好优化在标准 SFT 负对数似然上添加偏好项：

```
L_ORPO = L_NLL(y_w) + lambda * L_OR
L_OR = -log sigmoid(log(odds(y_w) / odds(y_l)))
```

无参考策略 —— SFT 项就是正则化器。从基础模型到对齐模型单阶段训练。无需单独的 SFT 检查点。

### BPO（ICLR 2026 投稿，OpenReview id=b97EwMUWu7）

识别退化被选响应问题：DPO 保持排序 `y_w > y_l`，但 `y_w` 的绝对对数概率可以下降。BPO 添加一行修正，惩罚被选响应的向下移动。报告在 Llama-3.1-8B-Instruct 的数学推理上比 DPO 提升 +10.1% 准确率。

### 普适结果：DAA 仍会过度优化

Rafailov 等人 "Scaling Laws for Reward Model Overoptimization in Direct Alignment Algorithms"（NeurIPS 2024）在多个数据集和 KL 预算下用 DPO、IPO、SLiC 训练策略。真实奖励-vs-KL 曲线具有与 Gao 等人相同的先升后塌形状。隐式奖励在训练期间查询分布外样本；KL 正则化不能稳定这一点。

DAA 并未逃脱古德哈特。它们将咬人的表面从"奖励模型过度优化"改为"参考策略比值过度优化"。通用修复 —— 更好的数据、集成、早停 —— 对两者都适用。

### 如何选择（2026）

- 如果你有大量成对偏好数据：DPO 配保守 beta，如果长度偏见明显则用 SimPO。
- 如果你有未成对二元反馈：KTO。
- 如果你想从基础模型单阶段管线：ORPO。
- 如果你在 DPO 日志中看到退化被选对数概率：BPO。
- 如果偏好强度变化大且 DPO 饱和：IPO。

每个实验室都会在一组任务上跑全部五种并挑选胜者。数学推理和安全任务的最优解没有理由相同。

## 使用

`code/main.py` 在玩具偏好数据集上比较六种损失（DPO、IPO、KTO、SimPO、ORPO、BPO），其中真实偏好强度因对而异。每种损失在相同的 500 对样本上优化，使用小型 softmax 策略。绘制每种方法的最终胜率、被选对数概率漂移和隐式奖励分布。

## 交付

本课产出 `outputs/skill-preference-loss-selector.md`。给定数据集统计（成对 vs 未成对、可变 vs 均匀偏好强度、长度分布）和目标（单阶段或 SFT-然后-偏好），推荐偏好损失并报告它防范的失败模式。

## 练习

1. 运行 `code/main.py`。报告 DPO 和 BPO 的最终被选对数概率下降。BPO 应保持更高的被选绝对概率 —— 验证这一点。

2. 修改偏好数据使所有对具有相等强度。六种方法中哪种最鲁棒？哪种退化？解释 IPO 在此的优势。

3. 使拒绝响应平均比被选长 2 倍。不改其他任何东西，数值展示 DPO 的长度利用和 SimPO 的修复。

4. Rafailov 等人（NeurIPS 2024）声称 DAA 过度优化。复现单点版本：绘制被选减拒绝的 KL 散度，观察 DPO 在大 beta 下的过度优化。

5. 阅读 BPO 论文摘要（OpenReview b97EwMUWu7）。写下 BPO 添加到 DPO 的一行修正。与 `code/main.py` 中的实现确认。

## 关键术语

| 术语 | 业界说法 | 实际含义 |
|------|---------|---------|
| DPO | "RLHF without a reward model" | 从 RLHF 闭式最优推导的损失；仅策略参数 |
| Implicit reward | "the log-ratio" | `beta * log(pi(y|x) / pi_ref(y|x))` —— DPO 隐含的奖励 |
| IPO | "bounded DPO" | 用恒等映射替换 log-sigmoid；隐式奖励差距被 `1/(2 beta)` 封顶 |
| KTO | "unpaired DPO" | 对单个标签的前景理论效用，带损失厌恶 |
| SimPO | "reference-free DPO" | 长度归一化对数似然 + margin；无参考策略 |
| ORPO | "one-stage DPO" | NLL + 赔率比偏好项；从基础模型单遍训练 |
| BPO | "chosen-preserving DPO" | DPO 加惩罚被选响应对数概率下降的项 |
| Degraded Chosen | "chosen goes down" | DPO 降低被选对数概率，只要拒绝的下降更快 |
| DAA | "direct alignment algorithm" | 任何跳过显式 RM 的偏好损失方法 |

## 延伸阅读

- [Rafailov et al. — Direct Preference Optimization (NeurIPS 2023, arXiv:2305.18290)](https://arxiv.org/abs/2305.18290)
- [Azar et al. — A General Theoretical Paradigm to Understand Learning from Human Preferences (AISTATS 2024, arXiv:2310.12036)](https://arxiv.org/abs/2310.12036) —— IPO
- [Ethayarajh et al. — KTO: Model Alignment as Prospect Theoretic Optimization (arXiv:2402.01306)](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen — SimPO (NeurIPS 2024, arXiv:2405.14734)](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne — ORPO (EMNLP 2024, arXiv:2403.07691)](https://arxiv.org/abs/2403.07691)
- [BPO — Behavior Preservation Optimization (ICLR 2026 OpenReview b97EwMUWu7)](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov et al. — Scaling Laws for RM Overoptimization in DAAs (NeurIPS 2024, arXiv:2406.02900)](https://arxiv.org/abs/2406.02900)
