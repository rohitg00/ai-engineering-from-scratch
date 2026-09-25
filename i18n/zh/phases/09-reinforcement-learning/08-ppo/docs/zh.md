# 近端策略优化(PPO)

> A2C 在一次更新后就丢弃每条 rollout。PPO 用一个带裁剪的重要性比率包裹策略梯度，因此可以在同一份数据上做 10+ 个 epoch 而不会让策略爆炸。Schulman et al. (2017)。直到 2026 年它仍是默认的策略梯度算法。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 06 (REINFORCE)、Phase 9 · 07 (Actor-Critic)
**Time:** 约 75 分钟

## 问题所在

A2C(第 07 课)是在策略(on-policy)的：梯度 `E_{π_θ}[A · ∇ log π_θ]` 需要来自*当前* `π_θ` 采样的数据。做一次更新后，`π_θ` 就改变了；你用的数据现在成了异策略(off-policy)的。重复使用它，梯度就会有偏。

Rollout 的代价很高。在 Atari 上，8 个环境 × 128 步的一次 rollout = 1024 个转移，以及十几秒的环境时间。一次梯度步后就丢掉它太浪费了。

信任域策略优化(TRPO,Schulman 2015)是第一个修复方案：约束每次更新，使新旧策略之间的 KL 散度保持在 `δ` 以下。理论上很干净，但每次更新都需求解共轭梯度。2026 年没人再跑 TRPO 了。

PPO(Schulman et al. 2017)用一个简单的裁剪目标替代了硬性信任域约束。多加一行代码。每条 rollout 十个 epoch。不需要共轭梯度。理论上保证足够好。九年之后，它仍是从 MuJoCo 到 RLHF 所有场景的默认策略梯度算法。

## 核心概念

![PPO clipped surrogate objective: ratio clipping at 1 ± ε](../assets/ppo.svg)

**重要性比率。**

`r_t(θ) = π_θ(a_t | s_t) / π_{θ_old}(a_t | s_t)`

这是新策略相对于采集数据所用策略的似然比。`r_t = 1` 表示无变化。`r_t = 2` 表示新策略采取 `a_t` 的可能性是旧策略的两倍。

**裁剪代理目标。**

`L^{CLIP}(θ) = E_t [ min( r_t(θ) A_t, clip(r_t(θ), 1-ε, 1+ε) A_t ) ]`

两项：

- 如果优势 `A_t > 0` 且比率试图增长超过 `1 + ε`,裁剪会压平梯度——不要把一个好动作的概率推到比旧概率高出 `+ε` 之外。
- 如果优势 `A_t < 0` 且比率试图增长超过 `1 - ε`(意味着我们会让一个坏动作相对于其被裁剪后的缩减变得更可能)，裁剪会封顶梯度——不要把坏动作的概率压到 `-ε` 以下。

`min` 处理另一个方向：如果比率已朝*有益*方向移动，你仍然能得到梯度(在会伤害你的那一侧不做裁剪)。

典型取值 `ε = 0.2`。把目标作为 `r_t` 的函数画出来：一个分段线性函数，“好的一侧”是平屋顶，“坏的一侧”是平地板。

**完整的 PPO 损失。**

`L(θ, φ) = L^{CLIP}(θ) - c_v · (V_φ(s_t) - V_t^{target})² + c_e · H(π_θ(·|s_t))`

与 A2C 相同的 actor-critic 结构。三个系数，通常为 `c_v = 0.5`、`c_e = 0.01`、`ε = 0.2`。

**训练循环。**

1. 在 `N` 个并行环境中各采集 `T` 步，共 `N × T` 个转移。
2. 计算优势(GAE),将其冻结为常量。
3. 冻结 `π_{θ_old}` 作为当前 `π_θ` 的快照。
4. 进行 `K` 个 epoch,对每个大小为 `(s, a, A, V_target, log π_old(a|s))` 的 minibatch:
   - 计算 `r_t(θ) = exp(log π_θ(a|s) - log π_old(a|s))`。
   - 施加 `L^{CLIP}` + 价值损失 + 熵。
   - 梯度步。
5. 丢弃该 rollout。回到第 1 步。

`K = 10` 和大小为 64 的 minibatch 是一组标准超参数。PPO 很稳健：在 ±50% 范围内具体数值几乎没有影响。

**KL 惩罚变体。** 原论文提出了使用自适应 KL 惩罚的替代方案：`L = L^{PG} - β · KL(π_θ || π_old)`,并根据观测到的 KL 调整 `β`。裁剪版本成为了主流；KL 变体在 RLHF 中存续(在那里，相对参考策略的 KL 本来就是你想要的独立约束)。

```figure
ppo-clip
```

## 动手实现

### 第 1 步：在 rollout 时捕获 `log π_old(a | s)`

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

快照只取一次，在 rollout 时。它在更新 epoch 期间不变。

### 第 2 步：计算 GAE 优势(第 07 课)

与 A2C 相同。在批内做归一化。

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

“被裁剪 → 零梯度”模式是 PPO 的核心。如果新策略在有益方向上已经漂移太远，更新就停止。

### 第 4 步：价值和熵

加入标准的对 critic 目标的 MSE 和 actor 上的熵奖励，与 A2C 相同。

### 第 5 步：诊断

每次更新要关注三件事：

- **平均 KL** `E[log π_old - log π_θ]`。应保持在 `[0, 0.02]` 内。如果冲过 `0.1`,就减小 `K_EPOCHS` 或 `LR`。
- **裁剪比例** —— 比率落在 `[1-ε, 1+ε]` 之外的样本比例。应在 `~0.1-0.3`。如果 `~0`,裁剪从未触发 → 提高 `LR` 或 `K_EPOCHS`。如果 `~0.5+`,你正在对 rollout 过拟合 → 降低它们。
- **解释方差** `1 - Var(V_target - V_pred) / Var(V_target)`。Critic 质量指标。应随 critic 学习而趋近于 1。

## 常见陷阱

- **裁剪系数调错。** `ε = 0.2` 是事实上的标准。改成 `0.1` 会让更新过于胆怯；`0.3+` 则会招致不稳定。
- **epoch 太多。** `K > 20` 常规性地导致不稳定，因为策略会远离 `π_old`。限制 epoch 数，尤其是大网络。
- **没有奖励归一化。** 过大的奖励量级会侵蚀裁剪范围。在计算优势之前先对奖励做归一化(运行标准差)。
- **忘记优势归一化。** 按批零均值/单位标准差归一化是标准做法。跳过它会在大多数基准上毁掉 PPO。
- **学习率不衰减。** PPO 受益于线性衰减到零的 LR。恒定 LR 往往更差。
- **重要性比率计算错误。** 为数值稳定性，总是先 `exp(log_new - log_old)`,而不是 `new / old`。
- **梯度符号写反。** 最大化代理目标 = *最小化* `-L^{CLIP}`。符号写反是最常见的 PPO bug。

## 应用场景

PPO 是 2026 年在数量惊人的领域中通用的默认 RL 算法：

| 用例 | PPO 变体 |
|----------|-------------|
| MuJoCo / 机器人控制 | 高斯策略的 PPO,GAE(0.95) |
| Atari / 离散游戏 | 类别策略的 PPO,滚动 128 步 rollout |
| LLM 的 RLHF | 带对参考模型 KL 惩罚的 PPO,奖励来自响应末尾的 RM |
| 大规模游戏智能体 | IMPALA + PPO(AlphaStar、OpenAI Five) |
| 推理 LLM | GRPO(第 12 课)——不带 critic 的 PPO 变体 |
| 仅偏好数据 | DPO —— PPO+KL 的闭式化简，无在线采样 |

PPO 的*损失形态* —— 裁剪代理目标 + 价值 + 熵 —— 是 DPO、GRPO 以及几乎每个 RLHF 流水线的骨架。

## 发布

保存为 `outputs/skill-ppo-trainer.md`:

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

1. **简单。** 在 4×4 GridWorld 上用 `ε=0.2, K=4` 跑 PPO。在相同环境步数下，与 A2C(每条 rollout 一个 epoch)比较样本效率。
2. **中等。** 扫描 `K ∈ {1, 4, 10, 30}`。画出回报 vs 环境步数，并跟踪每次更新的平均 KL。在这个任务上，`K` 取多大时 KL 会爆炸？
3. **困难。** 用自适应 KL 惩罚替换裁剪代理目标(若 `KL > 2·target` 则 `β` 翻倍，若 `KL < target/2` 则减半)。比较最终回报、稳定性和无裁剪程度。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 重要性比率 | "r_t(θ)" | `π_θ(a\|s) / π_old(a\|s)`;相对于采集数据所用策略的偏离。 |
| 裁剪代理目标 | "PPO 的核心技巧" | `min(r·A, clip(r, 1-ε, 1+ε)·A)`;在有益一侧越过裁剪后梯度变平。 |
| 信任域 | "TRPO / PPO 的意图" | 限制每次更新的 KL 以保证单调改进。 |
| KL 惩罚 | "软信任域" | PPO 的替代方案：`L - β · KL(π_θ \|\| π_old)`。自适应 `β`。 |
| 裁剪比例 | "裁剪触发的频率" | 诊断指标 —— 应为 0.1-0.3;超出意味着调参失误。 |
| 多 epoch 训练 | "数据复用" | 每条 rollout 上做 K 个 epoch;以方差代价换取样本效率。 |
| 类在策略 | “基本算在策略” | PPO 名义上是在策略的，但 K>1 个 epoch 会安全地使用略微异策略的数据。 |
| PPO-KL | “另一个 PPO” | KL 惩罚变体；用于 RLHF,因为相对参考策略的 KL 本来就是约束。 |

## 延伸阅读

- [Schulman et al. (2017). Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347) —— 原论文。
- [Schulman et al. (2015). Trust Region Policy Optimization](https://arxiv.org/abs/1502.05477) —— TRPO,PPO 的前身。
- [Andrychowicz et al. (2021). What Matters In On-Policy RL? A Large-Scale Empirical Study](https://arxiv.org/abs/2006.05990) —— 对 PPO 所有超参数做了消融。
- [Ouyang et al. (2022). Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) —— InstructGPT;RLHF 中的 PPO 配方。
- [OpenAI Spinning Up — PPO](https://spinningup.openai.com/en/latest/algorithms/ppo.html) —— 使用 PyTorch 的干净现代讲解。
- [CleanRL PPO implementation](https://github.com/vwxyzjn/cleanrl) —— 许多论文使用的单文件参考实现。
- [Hugging Face TRL — PPOTrainer](https://huggingface.co/docs/trl/main/en/ppo_trainer) —— 语言模型上 PPO 的生产级配方；请结合第 09 课(RLHF)阅读。
- [Engstrom et al. (2020). Implementation Matters in Deep Policy Gradients](https://arxiv.org/abs/2005.12729) —— “37 项代码级优化”论文；哪些 PPO 技巧是关键支撑，哪些只是江湖传说。