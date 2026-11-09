# 直接偏好优化家庭

> 拉斐洛夫等人 根据RLHF的优势在偏好数据方面具有封闭形式,因此您可以跳过明确的奖励模式并直接优化政策. 这种洞察力产生了一家IPO,KTO,SimPO,ORPO,BPO,每个都解决了DPO失败模式. 2026年,直线配列算法将比PPO更多的边境训练后运行. 但第二课的过度优化曲线仍然适用:DAA不逃离Goodhart,

**Type:** Learn
**Languages:** Python (stdlib, six-variant preference-loss comparator), TypeScript
**Prerequisites:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking), Phase 10 · 08 (DPO basics)
**Time:** ~75 minutes

## 学习目标

- 取出DPO封闭形式从RLHF-with-KL最佳.
- 说明IPO,KTO,SimPO,ORPO,BPO的每个故障模式.
- 区分"隐含的奖励差距"与"偏好强度",并解释为什么IPO的身份映射是重要的.
- 解释为什么Rafailov等人 (NeurIPS 2024) 证明尽管没有明确的RM,但DAA过度优化.

## 问题

关于RLHF的目标 (课 1)

```math
\max_{\pi} \; \mathbb{E}_{x, y \sim \pi} \big[ r(x, y) \big] - \beta \, \mathrm{KL}(\pi \,\|\, \pi_{\text{ref}})
```

已知最佳值:

```math
\pi^*(y \mid x) = \frac{1}{Z(x)} \, \pi_{\text{ref}}(y \mid x) \exp\!\left(\frac{r(x, y)}{\beta}\right)
```

因此,奖励被隐含地定义为最佳政策与参考的比例:

```math
r(x, y) = \beta \log \frac{\pi^*(y \mid x)}{\pi_{\text{ref}}(y \mid x)} + \beta \log Z(x)
```

取代这个为布拉德利-特里偏好概率和分区函数`Z(x)`取消,因为它只取决于`x`只有政策参数的损失 没有奖励模型需要.

纹:衍生假设最佳可达,偏好数据是分布式的,参考政策是真实模式.这些都不完全适用.每个家庭成员都会修复不同的违反假设.

## 概念

### 果 (Rafailov等, 2023)

```math
L_{\text{DPO}} = -\log \sigma\!\left(
  \beta \log \frac{\pi(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)}
  - \beta \log \frac{\pi(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)}
\right)
```

什么可能会发生错误:

- 隐含的奖励差距`beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)`只有一个小的偏好,就会产生一个任意大的差距.
- 输出驱动选择和拒绝的日志探测器在相反的方向.只要拒绝的日志探测器更快地下降,它可以推倒所选的绝对日志探测器.这是降级的选择反应现象.
- 经过分销的偏好 (在参考政策中,两种答案都很少存在的对) 产生了任意的隐含奖励.

### 投资者:

身份偏好优化取代了日志-sigmoid 通过身份映射在偏好概率.损失成为一个有限的目标的二方误差:

```math
L_{\text{IPO}} = \left( \log \frac{\pi(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)} - \log \frac{\pi(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)} - \frac{1}{2\beta} \right)^2
```

边缘由`1/(2 beta)`偏好强度和隐含奖励差距均为比例.

### 技术技术技术 (Ethayarajh等,2024年)

由于单个标记输出和二进制"可"或"不可"信号,它将映射到一个前景理论实用性:

```math
v(x, y) = \sigma\!\left(\beta \log \frac{\pi(y \mid x)}{\pi_{\text{ref}}(y \mid x)} - z_{\text{ref}}\right)
```

优势:可以使用未配对数据,这更丰富.

### 博 (Meng等, 2024)

简单的偏好优化将训练信号与生成进行一致化. 完全删除参考政策,并根据长度正常化日志概率:

```math
L_{\text{SimPO}} = -\log \sigma\!\left(
  \frac{\beta}{|y_w|} \log \pi(y_w \mid x)
  - \frac{\beta}{|y_l|} \log \pi(y_l \mid x)
  - \gamma
\right)
```

具有一个边缘`gamma`长度正常化消除了利用DPO的长度偏差失败模式的激励 (更长时间`y_w`根据建筑物,它提供了更大的日志检测差距.

### 欧罗波 (Hong等, 2024)

优化偏好率增加一个偏好术语,

```math
\begin{aligned}
L_{\text{ORPO}} &= L_{\text{NLL}}(y_w) + \lambda L_{\text{OR}} \\
L_{\text{OR}} &= -\log \sigma\!\left(\log \frac{\text{odds}(y_w)}{\text{odds}(y_l)}\right)
\end{aligned}
```

没有参考政策 SFT术语是调节剂.从基模型到对齐模型的单一阶段训练.没有单独的SFT检查点.

### 报告的内容:

确定级选择答案问题:DPO保留排名`y_w > y_l`但绝对的记录测试`y_w`报告在Llama-3.1-8B-Instruct上对数学推理而言.

### 普遍结果:DAA仍然过度优化

拉斐洛夫等人"直接调整算法中奖励模型过度优化的扩展法则" (NeurIPS 2024) 与DPO,IPO,SLiC在KL预算中多个数据集上培训政策.金-奖励-KL曲线具有相同的Gao等.峰值和崩形状.暗示奖励在培训期间询问出分布样本;KL规范化并没有稳定这一点.

报价分析系统 (DAA) 没有逃离Goodhart.它们从"奖励模型过度优化"到"参考政策比率过度优化"的表面变化.

### 选择他们中的 (2026)

- 如果您有大量的对取决数据:DPO与保守的beta,SimPO如果长度偏差明显.
- 如果您有双重反:KTO.
- 如果您想要从基模型中获得单阶段管道:ORPO.
- 如果您看到DPO日志中被选择的记录检查器,
- 如果偏好强度很大,且DPO和:IPO.

每个实验室都用电池运行五个任务,每项任务都会选择胜利者.

```figure
dpo-margin
```

## 用它

`code/main.py`根据玩具偏好数据集,对比六次损失 (DPO,IPO,KTO,SimPO,ORPO,BPO) 进行了比较.每次损失都以小的软最大政策优化于相同的500对样本.每种方法的最终胜率,选项日志-试验漂移和隐含奖励差距.

## 运送它

这一课产生了`outputs/skill-preference-loss-selector.md`鉴于数据集统计数据 (对对对对对对对对对对对对对变量对均偏好强度,长度分布) 和目标 (单阶段或SFT-then-preference),建议对偏好损失进行报告,并报告它保护的故障模式.

## 运动

1. 跑步`code/main.py`报告DPO和BPO的最后选择日志检查下降.BPO应该保持更高的选择绝对概率验证这一点.

2. 修改偏好数据,使所有对具有相同的强度. 在六种方法中,哪种方法最强大?哪种降低?

3. 没有改变任何其他东西,数字显示DPO的长度利用和SIMPO的修正.

4. 拉斐洛夫等人 (NeurIPS 2024) 声称DAA过度优化. 复制一个点版本:图 chosen-minus-rejected KL divergence,并观察大型beta中的DPO过度优化.

5. 阅读BPO论文摘要 (OpenReview b97EwMUWu7). 写下BPO在DPO添加的一行纠正. 确认在`code/main.py`现在,我们要去.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| DPO | "RLHF without a reward model" | Loss derived from the closed-form RLHF optimum; policy parameters only |
| Implicit reward | "the log-ratio" | `beta * log(pi(y\|x) / pi_ref(y\|x))` — the DPO-implied reward |
| IPO | "bounded DPO" | Replaces log-sigmoid with identity; implicit reward gap capped by `1/(2 beta)` |
| KTO | "unpaired DPO" | Prospect-theory utility over single labels with loss aversion |
| SimPO | "reference-free DPO" | Length-normalized log-likelihood + margin; no reference policy |
| ORPO | "one-stage DPO" | NLL + odds-ratio preference term; trains from base model in one pass |
| BPO | "chosen-preserving DPO" | DPO plus a penalty for decreasing the chosen response's absolute log-prob |
| Degraded Chosen | "chosen goes down" | DPO decreases chosen log-prob so long as rejected falls faster |
| DAA | "direct alignment algorithm" | Any preference-loss method that skips an explicit RM |

## 进一步阅读

- [Rafailov et al. — Direct Preference Optimization (NeurIPS 2023, arXiv:2305.18290)](https://arxiv.org/abs/2305.18290)
- [Azar et al. — A General Theoretical Paradigm to Understand Learning from Human Preferences (AISTATS 2024, arXiv:2310.12036)](https://arxiv.org/abs/2310.12036)IPO
- [Ethayarajh et al. — KTO: Model Alignment as Prospect Theoretic Optimization (arXiv:2402.01306)](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen — SimPO (NeurIPS 2024, arXiv:2405.14734)](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne — ORPO (EMNLP 2024, arXiv:2403.07691)](https://arxiv.org/abs/2403.07691)
- [BPO — Behavior Preservation Optimization (ICLR 2026 OpenReview b97EwMUWu7)](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov et al. — Scaling Laws for RM Overoptimization in DAAs (NeurIPS 2024, arXiv:2406.02900)](https://arxiv.org/abs/2406.02900)
