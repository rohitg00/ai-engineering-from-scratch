# 08 · 近端策略优化（PPO）

> A2C 每次更新后就把整批采样数据丢弃。PPO 把策略梯度包裹在一个经过裁剪的重要性比率里，让你能在同一批数据上做 10 个甚至更多轮次的训练，而策略不会崩坏。出自 Schulman 等人（2017）。直到 2026 年，它仍是默认的策略梯度算法。

**类型：** 构建
**语言：** Python
**前置：** 第 9 阶段 · 06（REINFORCE）、第 9 阶段 · 07（演员-评论家）
**时长：** 约 75 分钟

## 问题所在

A2C（第 07 课）是「同策略（on-policy）」的：梯度 `E_{π_θ}[A · ∇ log π_θ]` 要求数据采样自*当前*的 `π_θ`。一旦做了一次更新，`π_θ` 就变了；你刚用过的数据现在成了「异策略（off-policy）」的。再拿它来复用，梯度就有偏。

采样很昂贵。在 Atari 上，一次跨 8 个环境 × 128 步的采样 = 1024 条转移，外加十几秒的环境运行时间。只做一步梯度更新就把它丢掉，太浪费了。

「信赖域策略优化（Trust Region Policy Optimization, TRPO）」（Schulman 2015）是第一个解法：约束每次更新，使新旧策略之间的 KL 散度保持在 `δ` 以下。理论上很干净，但每次更新都需要解一次共轭梯度。2026 年没人再跑 TRPO。

PPO（Schulman 等人 2017）用一个简单的裁剪目标取代了硬性的信赖域约束。只多一行代码。每批采样训练十个轮次。无需共轭梯度。理论保证也足够好。九年过去，从 MuJoCo 到 RLHF，它依然是一切场景下默认的策略梯度算法。

## 核心概念

〔图：PPO 裁剪代理目标：重要性比率在 1 ± ε 处被裁剪〕

**重要性比率（importance ratio）。**

`r_t(θ) = π_θ(a_t | s_t) / π_{θ_old}(a_t | s_t)`

这是新策略相对于采集该数据的旧策略的似然比。`r_t = 1` 表示没有变化。`r_t = 2` 表示新策略选取 `a_t` 的概率是旧策略的两倍。

**裁剪代理目标（clipped surrogate）。**

`L^{CLIP}(θ) = E_t [ min( r_t(θ) A_t, clip(r_t(θ), 1-ε, 1+ε) A_t ) ]`

两个分量：

- 如果优势 `A_t > 0` 且比率试图涨过 `1 + ε`，裁剪会把梯度压平——不要把一个好动作推到比旧概率高出 `+ε` 以上。
- 如果优势 `A_t < 0` 且比率试图涨过 `1 - ε`（意味着相对于其被裁剪后的下降量，我们反而会让一个坏动作更可能被选），裁剪会给梯度封顶——不要把一个坏动作压到 `-ε` 以下。

`min` 负责处理另一个方向：如果比率朝*有益*方向移动，你依然能拿到梯度（在那个会对你不利的一侧才不裁剪）。

典型取值 `ε = 0.2`。把目标画成关于 `r_t` 的函数：它是一个分段线性函数，在「好的一侧」有一个平顶，在「坏的一侧」有一个平底。

**完整的 PPO 损失。**

`L(θ, φ) = L^{CLIP}(θ) - c_v · (V_φ(s_t) - V_t^{target})² + c_e · H(π_θ(·|s_t))`

与 A2C 相同的演员-评论家结构。三个系数，通常 `c_v = 0.5`、`c_e = 0.01`、`ε = 0.2`。

**训练循环。**

1. 在 `N` 个并行环境上各跑 `T` 步，收集 `N × T` 条转移。
2. 计算优势（GAE），把它们冻结为常量。
3. 把 `π_{θ_old}` 冻结为当前 `π_θ` 的一份快照。
4. 进行 `K` 个轮次，对每个由 `(s, a, A, V_target, log π_old(a|s))` 组成的小批量：
   - 计算 `r_t(θ) = exp(log π_θ(a|s) - log π_old(a|s))`。
   - 套用 `L^{CLIP}` + 价值损失 + 熵。
   - 走一步梯度。
5. 丢弃这批采样。回到第 1 步。

`K = 10`、小批量大小 64 是一组标准超参数。PPO 很稳健：在 ±50% 的范围内，具体数值往往无关紧要。

**KL 惩罚变体。** 原论文提出了一种使用自适应 KL 惩罚的替代方案：`L = L^{PG} - β · KL(π_θ || π_old)`，其中 `β` 根据观测到的 KL 进行调整。裁剪版本最终占据主流；KL 变体则在 RLHF 中存活下来（在那里，与参考策略的 KL 本来就是一个你始终想要的独立约束）。

## 动手构建

### 第 1 步：在采样时记录 `log π_old(a | s)`

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

这份快照只在采样时拍一次。它在更新轮次期间不会改变。

### 第 2 步：计算 GAE 优势（第 07 课）

与 A2C 相同。在整个批次上做归一化。

### 第 3 步：裁剪代理目标更新

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

「被裁剪 → 梯度归零」这个模式是 PPO 的核心。如果新策略已经在有益方向上漂移得太远，更新就会停下。

### 第 4 步：价值与熵

向评论家目标加上标准的 MSE，并在演员上加一个熵奖励，与 A2C 相同。

### 第 5 步：诊断指标

每次更新都要盯三样东西：

- **平均 KL** `E[log π_old - log π_θ]`。应保持在 `[0, 0.02]` 内。如果冲过 `0.1`，就调小 `K_EPOCHS` 或 `LR`。
- **裁剪比例（clip fraction）**——比率落在 `[1-ε, 1+ε]` 之外的样本占比。应在 `~0.1-0.3` 左右。如果约为 `0`，说明裁剪从未触发 → 调高 `LR` 或 `K_EPOCHS`。如果约为 `0.5+`，说明你在对这批采样过拟合 → 调低它们。
- **可解释方差（explained variance）** `1 - Var(V_target - V_pred) / Var(V_target)`。评论家质量指标。随着评论家学习，它应朝 1 攀升。

## 常见陷阱

- **裁剪系数没调好。** `ε = 0.2` 是事实标准。降到 `0.1` 会让更新过于胆怯；`0.3+` 则招致不稳定。
- **轮次太多。** `K > 20` 常常导致失稳，因为策略会偏离 `π_old` 太远。要给轮次封顶，对大网络尤其如此。
- **没有做奖励归一化。** 过大的奖励尺度会吃掉裁剪区间。在计算优势之前先对奖励做归一化（运行时标准差）。
- **忘了做优势归一化。** 逐批的零均值/单位标准差归一化是标准做法。省掉它会在大多数基准上把 PPO 搞砸。
- **学习率没有衰减。** PPO 受益于将学习率线性衰减到零。恒定学习率往往更差。
- **重要性比率的算法写错。** 为了数值稳定，永远用 `exp(log_new - log_old)`，而不是 `new / old`。
- **梯度符号搞反。** 最大化代理目标 = *最小化* `-L^{CLIP}`。符号写反是最常见的 PPO bug。

## 实战应用

PPO 是 2026 年默认的强化学习算法，覆盖的领域之广令人意外：

| 用例 | PPO 变体 |
|----------|-------------|
| MuJoCo / 机器人控制 | 配高斯策略的 PPO，GAE(0.95) |
| Atari / 离散游戏 | 配类别策略的 PPO，滚动 128 步采样 |
| 面向 LLM 的 RLHF | 配对参考模型 KL 惩罚的 PPO，奖励在回复结尾由 RM 给出 |
| 大规模游戏智能体 | IMPALA + PPO（AlphaStar、OpenAI Five） |
| 推理型 LLM | GRPO（第 12 课）——去掉评论家的 PPO 变体 |
| 仅有偏好数据 | DPO——PPO+KL 的闭式坍缩，无需在线采样 |

PPO 的*损失形态*——裁剪代理 + 价值 + 熵——是 DPO、GRPO 乃至几乎每一条 RLHF 流水线的骨架。

## 交付产物

保存为 `outputs/skill-ppo-trainer.md`：

```markdown
---
name: ppo-trainer
description: Produce a PPO training config and a diagnostic plan for a given environment.
version: 1.0.0
phase: 9
lesson: 8
tags: [rl, ppo, policy-gradient]
---

Given an environment and training budget, output:

1. Rollout size. `N` envs × `T` steps.
2. Update schedule. `K` epochs, minibatch size, LR schedule.
3. Surrogate params. `ε` (clip), `c_v`, `c_e`, advantage normalization on.
4. Advantage. GAE(`λ`) with explicit `γ` and `λ`.
5. Diagnostics plan. KL, clip fraction, explained variance thresholds with alerts.

Refuse `K > 30` or `ε > 0.3` (unsafe trust region). Refuse any PPO run without advantage normalization or KL/clip monitoring. Flag clip fraction sustained above 0.4 as drift.
```

## 练习

1. **简单。** 在 4×4 GridWorld 上用 `ε=0.2, K=4` 跑 PPO。在相同环境步数下，把样本效率与 A2C（每批采样只跑一个轮次）作对比。
2. **中等。** 扫描 `K ∈ {1, 4, 10, 30}`。画出回报随环境步数的变化曲线，并跟踪每次更新的平均 KL。在这个任务上，`K` 取到多少时 KL 会爆掉？
3. **困难。** 把裁剪代理换成自适应 KL 惩罚（若 `KL > 2·target` 则把 `β` 翻倍，若 `KL < target/2` 则减半）。对比最终回报、稳定性以及「无裁剪」程度。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 重要性比率（Importance ratio） | "r_t(θ)" | `π_θ(a\|s) / π_old(a\|s)`；与采集数据所用策略之间的偏离。 |
| 裁剪代理（Clipped surrogate） | "PPO 的主要绝招" | `min(r·A, clip(r, 1-ε, 1+ε)·A)`；在有益一侧越过裁剪点后梯度变平。 |
| 信赖域（Trust region） | "TRPO / PPO 的意图" | 限制每次更新的 KL，以保证单调改进。 |
| KL 惩罚（KL penalty） | "软信赖域" | PPO 的替代方案：`L - β · KL(π_θ \|\| π_old)`。自适应 `β`。 |
| 裁剪比例（Clip fraction） | "裁剪触发的频率" | 诊断指标——应在 0.1-0.3；超出区间意味着没调好。 |
| 多轮次训练（Multi-epoch training） | "数据复用" | 对每批采样训练 K 个轮次；用方差代价换取样本效率。 |
| 近似同策略（On-policy-ish） | "基本是同策略" | PPO 名义上是同策略，但 K>1 轮次会安全地使用略带异策略的数据。 |
| PPO-KL | "另一种 PPO" | KL 惩罚变体；用于 RLHF，那里「与参考策略的 KL」本就是一个约束。 |

## 延伸阅读

- [Schulman et al. (2017). Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347)——原论文。
- [Schulman et al. (2015). Trust Region Policy Optimization](https://arxiv.org/abs/1502.05477)——TRPO，PPO 的前身。
- [Andrychowicz et al. (2021). What Matters In On-Policy RL? A Large-Scale Empirical Study](https://arxiv.org/abs/2006.05990)——对每一个 PPO 超参数做了消融。
- [Ouyang et al. (2022). Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155)——InstructGPT；RLHF 中的 PPO 配方。
- [OpenAI Spinning Up — PPO](https://spinningup.openai.com/en/latest/algorithms/ppo.html)——干净的现代讲解，配 PyTorch。
- [CleanRL PPO implementation](https://github.com/vwxyzjn/cleanrl)——许多论文采用的单文件 PPO 参考实现。
- [Hugging Face TRL — PPOTrainer](https://huggingface.co/docs/trl/main/en/ppo_trainer)——在语言模型上跑 PPO 的生产级配方；与第 09 课（RLHF）一并阅读。
- [Engstrom et al. (2020). Implementation Matters in Deep Policy Gradients](https://arxiv.org/abs/2005.12729)——「37 项代码级优化」论文；哪些 PPO 技巧真正承重，哪些只是民间传说。
