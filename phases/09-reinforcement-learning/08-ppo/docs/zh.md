# 近端策略优化（Proximal Policy Optimization, PPO）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> A2C 每次 rollout 只用一次更新就丢掉。PPO 把策略梯度包进一个被 clip（截断）的重要性比率里，让你能在同一份数据上跑 10+ 个 epoch 也不至于让策略炸掉。Schulman et al. (2017)。直到 2026 年仍然是默认的策略梯度算法。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~75 minutes

## 问题（The Problem）

A2C（第 07 课）是 on-policy 的：梯度 `E_{π_θ}[A · ∇ log π_θ]` 要求数据采样自*当前*的 `π_θ`。一更新一次，`π_θ` 就变了；你刚用过的数据现在已经是 off-policy 的了。继续复用就会让梯度有偏。

Rollout 很贵。在 Atari 上，一次 rollout 跑 8 个 env × 128 步 = 1024 个 transition，环境运行时间要十几秒。一次梯度步之后就扔掉，太浪费。

Trust Region Policy Optimization（TRPO，Schulman 2015）是第一种修法：约束每次更新，让新旧策略之间的 KL 散度保持在 `δ` 以下。理论上很干净，但每次更新都要解一次共轭梯度。2026 年没人再跑 TRPO 了。

PPO（Schulman et al. 2017）把硬性的信赖域约束换成了一个简单的 clipped 目标。多写一行代码。每次 rollout 跑十个 epoch。不要共轭梯度。理论保证够用就行。九年过去，从 MuJoCo 到 RLHF，它仍然是默认的策略梯度算法。

## 概念（The Concept）

![PPO clipped surrogate objective: ratio clipping at 1 ± ε](../assets/ppo.svg)

**重要性比率（importance ratio）。**

`r_t(θ) = π_θ(a_t | s_t) / π_{θ_old}(a_t | s_t)`

这是新策略相对于采集数据时那个策略的似然比。`r_t = 1` 表示没有变化。`r_t = 2` 表示新策略选 `a_t` 的概率是旧策略的两倍。

**Clipped surrogate（截断代理目标）。**

`L^{CLIP}(θ) = E_t [ min( r_t(θ) A_t, clip(r_t(θ), 1-ε, 1+ε) A_t ) ]`

两项：

- 如果 advantage（优势）`A_t > 0` 而比率试图涨到 `1 + ε` 之上，clip 会把梯度压平——别把一个好动作的概率推得比旧概率高出超过 `+ε`。
- 如果 advantage `A_t < 0` 而比率试图跌到 `1 - ε` 之下（意味着相对于被 clip 截断后的下降幅度，我们会让坏动作变得更有可能），clip 会给梯度封顶——别把坏动作压低超过 `-ε`。

那个 `min` 处理另一边的方向：如果比率已经朝*有利*的方向移动，你仍然能拿到梯度（在会伤害你的那一侧才 clip）。

典型取 `ε = 0.2`。把这个目标当作 `r_t` 的函数画出来：是一段分段线性函数，「好的一侧」有一个平顶，「坏的一侧」有一个平底。

**完整的 PPO 损失。**

`L(θ, φ) = L^{CLIP}(θ) - c_v · (V_φ(s_t) - V_t^{target})² + c_e · H(π_θ(·|s_t))`

和 A2C 一样的 actor-critic 结构。三个系数，一般取 `c_v = 0.5`、`c_e = 0.01`、`ε = 0.2`。

**训练循环。**

1. 在 `N` 个并行 env 上各跑 `T` 步，收集 `N × T` 个 transition。
2. 计算 advantage（GAE），把它们冻结为常量。
3. 把 `π_{θ_old}` 冻结为当前 `π_θ` 的快照。
4. 跑 `K` 个 epoch，对每个 minibatch `(s, a, A, V_target, log π_old(a|s))`：
   - 计算 `r_t(θ) = exp(log π_θ(a|s) - log π_old(a|s))`。
   - 应用 `L^{CLIP}` + 价值损失 + 熵项。
   - 梯度更新一步。
5. 丢掉这次 rollout。回到第 1 步。

`K = 10`、minibatch 大小 64 是一组标准超参数。PPO 鲁棒性很好：这些数字在 ±50% 范围内通常都不重要。

**KL-penalty 变体。** 原始论文给出了一种使用自适应 KL 惩罚的替代方案：`L = L^{PG} - β · KL(π_θ || π_old)`，根据观测到的 KL 调整 `β`。clipping 版本占了主流；KL 变体在 RLHF 里活了下来（在 RLHF 里你本来就需要一个相对参考策略的 KL 约束）。

## 动手实现（Build It）

### 第 1 步：在 rollout 时记录 `log π_old(a | s)`

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

快照是在 rollout 时拍一次。在更新的多个 epoch 里它都不变。

### 第 2 步：计算 GAE advantage（第 07 课）

和 A2C 一样。在整个 batch 里做归一化。

### 第 3 步：clipped surrogate 更新

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
            # backprop -surrogate, add value loss, subtract entropy
            grad_logpi = onehot(rec["a"]) - probs
            if (adv > 0 and ratio >= 1 + EPS) or (adv < 0 and ratio <= 1 - EPS):
                pg_grad = 0.0  # clipped
            else:
                pg_grad = ratio * adv
            for i in range(N_ACTIONS):
                for j in range(N_FEAT):
                    theta[i][j] += LR * pg_grad * grad_logpi[i] * x[j]
```

「被 clip → 梯度归零」这个模式是 PPO 的核心。如果新策略已经朝有利方向漂得太远，更新就停下。

### 第 4 步：value 与 entropy

给 critic 目标加上标准的 MSE，给 actor 加上熵奖励，和 A2C 一样。

### 第 5 步：诊断指标

每次更新都要看三件事：

- **Mean KL** `E[log π_old - log π_θ]`。应该保持在 `[0, 0.02]`。如果飙过 `0.1`，就降低 `K_EPOCHS` 或 `LR`。
- **Clip fraction（截断比例）**——比率落在 `[1-ε, 1+ε]` 之外的样本占比。应该在 `~0.1-0.3`。如果接近 `0`，clip 从来没触发 → 调高 `LR` 或 `K_EPOCHS`。如果到 `~0.5+`，说明你在 over-fit（过拟合）这次 rollout → 调低它们。
- **Explained variance（可解释方差）** `1 - Var(V_target - V_pred) / Var(V_target)`。critic 质量指标。critic 学到东西时这个值应该往 1 爬。

## 常见坑（Pitfalls）

- **Clip 系数没调好。** `ε = 0.2` 是事实标准。降到 `0.1` 更新过于胆小；`0.3+` 又招来不稳定。
- **Epoch 太多。** `K > 20` 经常会失稳，因为策略漂得离 `π_old` 太远。封顶 epoch 数，特别是大网络。
- **没做奖励归一化。** 奖励尺度太大会吃掉 clip 区间。在算 advantage 之前先把奖励归一化（用滑动 std）。
- **忘了 advantage 归一化。** 按 batch 做零均值/单位方差归一化是标配。在大多数 benchmark 上跳过这一步会毁掉 PPO。
- **学习率没衰减。** PPO 配合线性学习率衰减到零会更好。常数学习率往往更差。
- **Importance ratio 数值出错。** 永远写 `exp(log_new - log_old)` 保证数值稳定，不要直接 `new / old`。
- **梯度符号写反。** 最大化 surrogate = *最小化* `-L^{CLIP}`。符号弄反是 PPO 最常见的 bug。

## 用起来（Use It）

PPO 是 2026 年默认的强化学习算法，覆盖范围多到出人意料：

| 用例 | PPO 变体 |
|----------|-------------|
| MuJoCo / 机器人控制 | 高斯策略 PPO，GAE(0.95) |
| Atari / 离散游戏 | 类别分布策略 PPO，滚动 128 步 rollout |
| LLM 的 RLHF | 带 KL 惩罚的 PPO（相对参考模型），奖励来自 RM 在回复结尾给出 |
| 大规模游戏 agent | IMPALA + PPO（AlphaStar、OpenAI Five） |
| 推理 LLM | GRPO（第 12 课）——不带 critic 的 PPO 变体 |
| 仅有偏好数据 | DPO——PPO+KL 的闭式坍缩，不用在线采样 |

PPO 的*损失结构*——clipped surrogate + value + entropy——是 DPO、GRPO 以及几乎所有 RLHF 流水线的脚手架。

## 上线部署（Ship It）

存为 `outputs/skill-ppo-trainer.md`：

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

## 练习（Exercises）

1. **Easy.** 在 4×4 GridWorld 上用 `ε=0.2, K=4` 跑 PPO。在相同环境步数下，把样本效率和 A2C（每个 rollout 只跑一个 epoch）对比一下。
2. **Medium.** 扫一遍 `K ∈ {1, 4, 10, 30}`。画 return vs 环境步数，并跟踪每次更新的 mean KL。在这个任务上，`K` 取多少时 KL 会爆掉？
3. **Hard.** 把 clipped surrogate 换成自适应 KL 惩罚（`KL > 2·target` 时把 `β` 翻倍，`KL < target/2` 时减半）。比较最终 return、稳定性，以及「无需 clip」的程度。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Importance ratio | "r_t(θ)" | `π_θ(a\|s) / π_old(a\|s)`；相对于采集数据那个策略的偏离程度。 |
| Clipped surrogate | "PPO's main trick" | `min(r·A, clip(r, 1-ε, 1+ε)·A)`；在有利一侧越过 clip 后梯度变平。 |
| Trust region | "TRPO / PPO intent" | 限制每次更新的 KL，以保证单调改进。 |
| KL penalty | "Soft trust region" | PPO 的另一种写法：`L - β · KL(π_θ \|\| π_old)`。`β` 自适应。 |
| Clip fraction | "How often clipping triggers" | 诊断指标——应在 0.1-0.3；超出说明没调好。 |
| Multi-epoch training | "Data reuse" | 每次 rollout 跑 K 个 epoch；用方差代价换样本效率。 |
| On-policy-ish | "Mostly on-policy" | PPO 名义上是 on-policy 的，但 K>1 个 epoch 安全地使用了略微 off-policy 的数据。 |
| PPO-KL | "The other PPO" | KL 惩罚变体；用于 RLHF——那里相对参考的 KL 本来就是一个约束。 |

## 延伸阅读（Further Reading）

- [Schulman et al. (2017). Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347) — 原论文。
- [Schulman et al. (2015). Trust Region Policy Optimization](https://arxiv.org/abs/1502.05477) — TRPO，PPO 的前身。
- [Andrychowicz et al. (2021). What Matters In On-Policy RL? A Large-Scale Empirical Study](https://arxiv.org/abs/2006.05990) — 把 PPO 的每个超参都做了消融实验（ablation）。
- [Ouyang et al. (2022). Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) — InstructGPT；PPO-in-RLHF 的配方。
- [OpenAI Spinning Up — PPO](https://spinningup.openai.com/en/latest/algorithms/ppo.html) — 干净的现代讲解，配 PyTorch。
- [CleanRL PPO implementation](https://github.com/vwxyzjn/cleanrl) — 单文件 PPO 参考实现，被很多论文使用。
- [Hugging Face TRL — PPOTrainer](https://huggingface.co/docs/trl/main/en/ppo_trainer) — 在语言模型上跑 PPO 的生产级配方；与第 09 课（RLHF）配合阅读。
- [Engstrom et al. (2020). Implementation Matters in Deep Policy Gradients](https://arxiv.org/abs/2005.12729) — 「37 个代码级优化」那篇；告诉你哪些 PPO 技巧是承重墙、哪些是民间传说。
