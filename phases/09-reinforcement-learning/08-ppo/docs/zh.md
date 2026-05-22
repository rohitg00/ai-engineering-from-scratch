# 近端策略优化（Proximal Policy Optimization, PPO）

> A2C算法在每次更新后丢弃整个轨迹。PPO将策略梯度包裹在裁剪的重要性比率中，使得同一批数据可以重复使用10个以上训练周期而不会导致策略爆炸。Schulman等人（2017）。截至2026年，它仍是默认的策略梯度算法。

**类型：** 构建
**语言：** Python
**前置条件：** 阶段9·06（REINFORCE）、阶段9·07（Actor-Critic）
**时间：** 约75分钟

## 问题

A2C（第07课）是在策略（On-policy）的：梯度 `E_{π_θ}[A · ∇ log π_θ]` 要求数据从*当前*的 `π_θ` 采样。进行一次更新后，`π_θ` 发生了变化；之前使用的数据现在变成了离策略（Off-policy）。重复使用这些数据会导致梯度有偏。

轨迹采样成本高昂。在Atari上，一次轨迹穿过8个环境×128步=1024个转移，相当于几十秒的环境时间。一次梯度步骤后就丢弃这些数据是浪费的。

信任区域策略优化（Trust Region Policy Optimization, TRPO，Schulman 2015）是第一个修复方案：约束每次更新，使得新旧策略之间的KL散度保持在 `δ` 以下。理论上很完善，但每次更新需要执行共轭梯度求解。2026年已经没人运行TRPO了。

PPO（Schulman等人，2017）用一个简单的裁剪目标函数替代了硬性的信任区域约束。只需额外一行代码，每个轨迹可以训练10个周期，无需共轭梯度，理论保证足够好。九年后，它依然是MuJoCo到RLHF等所有任务的默认策略梯度算法。

## 概念

![PPO裁剪替代目标函数：比率裁剪范围1±ε](../assets/ppo.svg)

**重要性比率（Importance ratio）。**

`r_t(θ) = π_θ(a_t | s_t) / π_{θ_old}(a_t | s_t)`

这是新策略与收集数据的策略之间似然比。`r_t = 1` 表示没有变化；`r_t = 2` 表示新策略选择 `a_t` 的概率是旧策略的两倍。

**裁剪替代（Clipped surrogate）。**

`L^{CLIP}(θ) = E_t [ min( r_t(θ) A_t, clip(r_t(θ), 1-ε, 1+ε) A_t ) ]`

包含两项：

- 如果优势 `A_t > 0` 且比率试图增长超过 `1 + ε`，裁剪会平缓梯度——不要将一个好的动作推到旧概率的 `+ε` 以上。
- 如果优势 `A_t < 0` 且比率试图增长超过 `1 - ε`（意味着相比裁剪后的降低，我们反而让一个坏动作变得更有可能），裁剪会限制梯度——不要将一个坏动作推到 `-ε` 以下。

`min` 处理另一种方向：如果比率已朝*有利*方向移动，你仍然获得梯度（在可能损害你的那侧不裁剪）。

典型 `ε = 0.2`。将目标函数绘制为 `r_t` 的函数：一个分段线性函数，在“好侧”有平坦顶，在“坏侧”有平坦底。

**完整的PPO损失函数。**

`L(θ, φ) = L^{CLIP}(θ) - c_v · (V_φ(s_t) - V_t^{target})² + c_e · H(π_θ(·|s_t))`

与A2C相同的Actor-Critic结构。三个系数，通常 `c_v = 0.5`，`c_e = 0.01`，`ε = 0.2`。

**训练循环。**

1. 在 `N` 个并行环境中分别收集 `T` 步，总共 `N × T` 个转移。
2. 计算优势（GAE），将其冻结为常数。
3. 将 `π_{θ_old}` 冻结为当前 `π_θ` 的快照。
4. 对于 `K` 个训练周期，对于每个由 `(s, a, A, V_target, log π_old(a|s))` 组成的小批量：
   - 计算 `r_t(θ) = exp(log π_θ(a|s) - log π_old(a|s))`。
   - 应用 `L^{CLIP}` + 价值损失 + 熵。
   - 执行梯度步骤。
5. 丢弃该轨迹。返回步骤1。

`K = 10` 且小批量大小为64是一组标准超参数。PPO很鲁棒：精确数值在±50%范围内很少影响结果。

**KL惩罚变体（KL-penalty variant）。** 原论文提出了一种使用自适应KL惩罚的替代方案：`L = L^{PG} - β · KL(π_θ || π_old)`，其中 `β` 根据观测到的KL进行调整。裁剪版本成为主流；KL变体在RLHF中幸存（此时与参考策略的KL是你始终想要的一个单独约束）。

## 动手实现

### 步骤1：在轨迹采集时捕获 `log π_old(a | s)`

```python
for step in range(T):
    probs = softmax(logits(theta, state_features(s)))
    a = sample(probs, rng)
    s_next, r, done = env.step(s, a)
    buffer.append({
        "s": s, "a": a, "r": r, "done": done,
        "v_old": value(w, state_features(s)),
        "log_pi_old": log(probs[a] + 1e-12),
    })
    s = s_next
```

快照在轨迹采集时仅捕获一次，在更新周期内保持不变。

### 步骤2：计算GAE优势（第07课）

与A2C相同。对整个批次进行归一化。

### 步骤3：裁剪替代更新

```python
for _ in range(K_EPOCHS):
    for mb in minibatches(buffer, size=64):
        for rec in mb:
            x = state_features(rec["s"])
            probs = softmax(logits(theta, x))
            logp = log(probs[rec["a"]] + 1e-12)
            ratio = exp(logp - rec["log_pi_old"])
            adv = rec["advantage"]
            surrogate = min(
                ratio * adv,
                clamp(ratio, 1 - EPS, 1 + EPS) * adv,
            )
            # 反向传播 -surrogate，加上价值损失，减去熵
            grad_logpi = onehot(rec["a"]) - probs
            if (adv > 0 and ratio >= 1 + EPS) or (adv < 0 and ratio <= 1 - EPS):
                pg_grad = 0.0  # 被裁剪
            else:
                pg_grad = ratio * adv
            for i in range(N_ACTIONS):
                for j in range(N_FEAT):
                    theta[i][j] += LR * pg_grad * grad_logpi[i] * x[j]
```

“裁剪 → 零梯度”模式是PPO的核心。如果新策略已朝有利方向漂移过远，更新就会停止。

### 步骤4：价值与熵

与A2C相同，加入对目标价值的标准均方误差（MSE）以及Actor上的熵奖励。

### 步骤5：诊断

每次更新需关注三个指标：

- **平均KL（Mean KL）** `E[log π_old - log π_θ]`。应保持在 `[0, 0.02]` 之间。若超过 `0.1`，则减小 `K_EPOCHS` 或 `LR`。
- **裁剪比例（Clip fraction）** ——比率落在 `[1-ε, 1+ε]` 之外的样本比例。应约为 `0.1-0.3`。若趋近 `0`，则裁剪从未触发 → 提高 `LR` 或 `K_EPOCHS`。若超过 `0.5`，说明你在过度拟合轨迹 → 降低它们。
- **解释方差（Explained variance）** `1 - Var(V_target - V_pred) / Var(V_target)`。Critic质量指标。随着Critic学习应逐渐升高至1。

## 常见陷阱

- **裁剪系数调节不当。** `ε = 0.2` 是事实标准。设为 `0.1` 会使更新过于保守；`0.3+` 会引发不稳定。
- **训练周期过多。** `K > 20` 经常导致不稳定，因为策略与 `π_old` 的偏离过大。限制周期数，特别是对于大型网络。
- **未做奖励归一化。** 大规模奖励会侵蚀裁剪范围。在计算优势前先对奖励进行归一化（运行标准差）。
- **忘记优势归一化。** 每批次零均值/单位标准差归一化是标准做法。跳过它会在大多数基准上破坏PPO。
- **学习率未衰减。** PPO受益于线性学习率衰减至零。恒定学习率通常更差。
- **重要性比率计算错误。** 数值稳定性上应始终使用 `exp(log_new - log_old)`，而不是 `new / old`。
- **梯度符号错误。** 最大化替代目标 = *最小化* `-L^{CLIP}`。翻转符号是最常见的PPO错误。

## 应用

PPO是2026年默认的RL算法，应用于许多领域，令人惊讶：

| 应用场景 | PPO变体 |
|----------|---------|
| MuJoCo / 机器人控制 | 带高斯策略、GAE(0.95)的PPO |
| Atari / 离散游戏 | 带分类策略、128步滚动轨迹的PPO |
| LLM 的 RLHF | 带对参考模型KL惩罚、由RM在响应结束时给出奖励的PPO |
| 大规模游戏智能体 | IMPALA + PPO（AlphaStar、OpenAI Five） |
| 推理LLM | GRPO（第12课）—— 不带Critic的PPO变体 |
| 仅偏好数据 | DPO —— PPO+KL的闭式简化，无需在线采样 |

PPO的*损失形状* —— 裁剪替代 + 价值 + 熵 —— 是DPO、GRPO和几乎所有RLHF流水线的骨架。

## 交付

保存为 `outputs/skill-ppo-trainer.md`：

```markdown
---
name: ppo-trainer
description: 为给定环境生成PPO训练配置和诊断计划。
version: 1.0.0
phase: 9
lesson: 8
tags: [rl, ppo, policy-gradient]
---

给定一个环境和训练预算，输出：

1. 轨迹规模。`N` 个环境 × `T` 步。
2. 更新调度。`K` 个周期，小批量大小，学习率调度。
3. 替代参数。`ε`（裁剪），`c_v`，`c_e`，开启优势归一化。
4. 优势。GAE(`λ`) 并明确指定 `γ` 和 `λ`。
5. 诊断计划。KL、裁剪比例、可解释方差阈值及警报。

拒绝 `K > 30` 或 `ε > 0.3`（不安全的信任区域）。拒绝任何不进行优势归一化或不监控KL/裁剪比例的PPO运行。如果裁剪比例持续高于0.4，标记为漂移。
```

## 练习

1. **简单。** 在4×4网格世界中运行PPO，设置 `ε=0.2, K=4`。与A2C（每轨迹一个周期）在相同环境步数下比较样本效率。
2. **中等。** 对 `K ∈ {1, 4, 10, 30}` 进行扫参。绘制回报随环境步数的变化曲线，并追踪每次更新的平均KL。在此任务中，KL在哪个 `K` 值下爆炸？
3. **困难。** 用自适应KL惩罚（若 `KL > 2·target` 则 `β` 加倍，若 `KL < target/2` 则 `β` 减半）替换裁剪替代目标函数。比较最终回报、稳定性以及无裁剪性。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------|---------|
| 重要性比率（Importance ratio） | "r_t(θ)" | `π_θ(a|s) / π_old(a|s)`；偏离采集数据的策略的程度。 |
| 裁剪替代（Clipped surrogate） | "PPO的主要技巧" | `min(r·A, clip(r, 1-ε, 1+ε)·A)`；在优势侧超过裁剪后梯度变平。 |
| 信任区域（Trust region） | "TRPO / PPO的设计意图" | 限制每次更新的KL以保证单调改进。 |
| KL惩罚（KL penalty） | "软信任区域" | PPO的替代形式：`L - β · KL(π_θ || π_old)`。自适应 `β`。 |
| 裁剪比例（Clip fraction） | "裁剪触发的频率" | 诊断指标——应为0.1-0.3；超出则意味着调节不当。 |
| 多周期训练（Multi-epoch training） | "数据重用" | 每个轨迹上执行K个训练周期；方差成本换取样效率。 |
| 近在线策略（On-policy-ish） | "主要是在线策略" | PPO名义上是在线策略，但K>1个周期会安全地使用轻微离线策略的数据。 |
| PPO-KL | "另一种PPO" | KL惩罚变体；用于RLHF，其中与参考策略的KL已经是一个约束。 |

## 延伸阅读

- [Schulman等人 (2017). Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347) —— 原论文。
- [Schulman等人 (2015). Trust Region Policy Optimization](https://arxiv.org/abs/1502.05477) —— TRPO，PPO的前身。
- [Andrychowicz等人 (2021). What Matters In On-Policy RL? A Large-Scale Empirical Study](https://arxiv.org/abs/2006.05990) —— 对所有PPO超参数的消融研究。
- [Ouyang等人 (2022). Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) —— InstructGPT；PPO在RLHF中的配方。
- [OpenAI Spinning Up — PPO](https://spinningup.openai.com/en/latest/algorithms/ppo.html) —— 使用PyTorch的清晰现代阐述。
- [CleanRL PPO实现](https://github.com/vwxyzjn/cleanrl) —— 许多论文引用的单文件PPO参考实现。
- [Hugging Face TRL — PPOTrainer](https://huggingface.co/docs/trl/main/en/ppo_trainer) —— 针对语言模型的PPO生产级配方；可结合第09课（RLHF）阅读。
- [Engstrom等人 (2020). Implementation Matters in Deep Policy Gradients](https://arxiv.org/abs/2005.12729) —— “37个代码级优化”的论文；揭示哪些PPO技巧是关键的，哪些只是传说。