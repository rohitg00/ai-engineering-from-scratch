# 06 · 策略梯度——从零实现 REINFORCE

> 别再去估计价值了。直接参数化策略，计算期望回报的梯度，沿梯度向上走一步。Williams（1992）用一条定理把它写清楚了。这正是 PPO、GRPO，以及每一个大语言模型（LLM）强化学习循环存在的原因。

**类型：** 构建
**语言：** Python
**前置：** 第 3 阶段 · 03（反向传播）、第 9 阶段 · 03（蒙特卡洛）、第 9 阶段 · 04（TD 学习）
**时长：** 约 75 分钟

## 问题所在

Q-learning 和 DQN 参数化的是「价值（value）」函数。你通过 `argmax Q` 来选择动作。对于离散动作和离散状态而言，这没问题。但当动作是连续的（在 10 维力矩上怎么做 `argmax`？），或者你想要一个随机策略（`argmax` 在构造上就是确定性的）时，它就失效了。

策略梯度（policy gradient）参数化的则是「策略（policy）」本身。`π_θ(a | s)` 是一个神经网络，它输出一个关于动作的分布。从中采样即可行动。计算期望回报关于 `θ` 的梯度，然后沿梯度向上走一步。没有 `argmax`，没有贝尔曼（Bellman）递归，只有对 `J(θ) = E_{π_θ}[G]` 做梯度上升（gradient ascent）。

REINFORCE 定理（Williams 1992）告诉你这个梯度是可计算的：`∇J(θ) = E_π[ G · ∇_θ log π_θ(a | s) ]`。跑一个回合（episode），计算回报，在每一步上乘以 `∇ log π_θ(a | s)`，求平均，做梯度上升。完成。

2026 年的每一个 LLM-RL 算法——PPO、DPO、GRPO——都是 REINFORCE 的精炼版。把它练到指尖成为肌肉记忆，是学好本阶段其余内容的前提，也是第 10 阶段 · 07（RLHF 实现）和第 10 阶段 · 08（DPO）的前提。

## 核心概念

〔图：策略梯度——softmax 策略、log-π 梯度与回报加权更新〕

**策略梯度定理。** 对任意由 `θ` 参数化的策略 `π_θ`：

`∇J(θ) = E_{τ ~ π_θ}[ Σ_{t=0}^{T} G_t · ∇_θ log π_θ(a_t | s_t) ]`

其中 `G_t = Σ_{k=t}^{T} γ^{k-t} r_{k+1}` 是从第 `t` 步起的折扣回报。期望是对从 `π_θ` 采样得到的完整轨迹（trajectory）`τ` 取的。

**证明很短。** 在期望下对 `J(θ) = Σ_τ P(τ; θ) G(τ)` 求导。使用 `∇P(τ; θ) = P(τ; θ) ∇ log P(τ; θ)`（对数导数技巧，log-derivative trick）。把 `log P(τ; θ) = Σ log π_θ(a_t | s_t) + 不依赖于 θ 的环境项` 拆开。环境项消失。两行代数运算就得到了这条定理。

**方差缩减技巧。** 朴素（vanilla）的 REINFORCE 方差大得吓人——回报是带噪的，`∇ log π` 是带噪的，二者的乘积噪声更大。两个标准的修正手段：

1. **基线相减（baseline subtraction）。** 把 `G_t` 替换为 `G_t - b(s_t)`，其中 `b(s_t)` 是任意不依赖于 `a_t` 的基线。由于 `E[b(s_t) · ∇ log π(a_t | s_t)] = 0`，这是无偏的。典型选择：由评论家（critic）学习得到的 `b(s_t) = V̂(s_t)` → 行动者-评论家（actor-critic）（第 07 课）。
2. **未来回报（reward-to-go）。** 把 `Σ_t G_t · ∇ log π_θ(a_t | s_t)` 替换为 `Σ_t G_t^{from t} · ∇ log π_θ(a_t | s_t)`。对某个给定动作而言，只有未来回报才重要——过去的奖励只会贡献零均值噪声。

二者结合，你得到：

`∇J ≈ (1/N) Σ_{i=1}^{N} Σ_{t=0}^{T_i} [ G_t^{(i)} - V̂(s_t^{(i)}) ] · ∇_θ log π_θ(a_t^{(i)} | s_t^{(i)})`

这就是带基线的 REINFORCE——它是 A2C（第 07 课）和 PPO（第 08 课）的直系祖先。

**Softmax 策略参数化。** 对离散动作而言，标准选择是：

`π_θ(a | s) = exp(f_θ(s, a)) / Σ_{a'} exp(f_θ(s, a'))`

其中 `f_θ` 是任意一个为每个动作输出一个得分的神经网络。其梯度有一个干净的形式：

`∇_θ log π_θ(a | s) = ∇_θ f_θ(s, a) - Σ_{a'} π_θ(a' | s) ∇_θ f_θ(s, a')`

也就是：所采取动作的得分，减去它在策略下的期望值。

**用于连续动作的高斯策略。** `π_θ(a | s) = N(μ_θ(s), σ_θ(s))`。`∇ log N(a; μ, σ)` 有闭式解。这正是第 9 阶段 · 07 的 SAC 所需的全部。

## 动手构建

### 第 1 步：softmax 策略网络

```python
def policy_logits(theta, state_features):
    return [dot(theta[a], state_features) for a in range(N_ACTIONS)]

def softmax(logits):
    m = max(logits)
    exps = [exp(l - m) for l in logits]
    Z = sum(exps)
    return [e / Z for e in exps]
```

对表格型（tabular）环境使用线性策略（每个动作一个权重向量）。对 Atari，换成一个 CNN，并保留 softmax 头。

### 第 2 步：采样与对数概率

```python
def sample_action(probs, rng):
    x = rng.random()
    cum = 0
    for a, p in enumerate(probs):
        cum += p
        if x <= cum:
            return a
    return len(probs) - 1

def log_prob(probs, a):
    return log(probs[a] + 1e-12)
```

### 第 3 步：在采样轨迹时捕获对数概率

```python
def rollout(theta, env, rng, gamma):
    trajectory = []
    s = env.reset()
    while not done:
        logits = policy_logits(theta, s)
        probs = softmax(logits)
        a = sample_action(probs, rng)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r, probs))
        s = s_next
    return trajectory
```

### 第 4 步：REINFORCE 更新

```python
def reinforce_step(theta, trajectory, gamma, lr, baseline=0.0):
    returns = compute_returns(trajectory, gamma)
    for (s, a, _, probs), G in zip(trajectory, returns):
        advantage = G - baseline
        grad_log_pi_a = [-p for p in probs]
        grad_log_pi_a[a] += 1.0
        for i in range(N_ACTIONS):
            for j in range(len(s)):
                theta[i][j] += lr * advantage * grad_log_pi_a[i] * s[j]
```

梯度 `∇ log π(a|s) = e_a - π(·|s)`（`a` 的独热向量减去概率分布）是 softmax 策略梯度的核心。把它刻进肌肉记忆里。

### 第 5 步：基线

在最近若干回合上对 `G` 取滑动均值（running mean），其带来的方差缩减就足以让一个 4×4 GridWorld 跑起来；它需要约 500 个回合才能收敛。把基线升级为学习得到的 `V̂(s)`，你就得到了行动者-评论家。

## 常见陷阱

- **梯度爆炸。** 回报可能极大。在乘以 `∇ log π` 之前，务必在整个批次上把 `G` 归一化到 `~N(0, 1)`。
- **熵坍缩（entropy collapse）。** 策略过早收敛到一个近乎确定性的动作，停止探索，陷入卡死。修复方法：在目标函数中加入熵奖励（entropy bonus）`β · H(π(·|s))`。
- **高方差。** 朴素 REINFORCE 需要成千上万个回合。标准修复方法是评论家基线（第 07 课）或 TRPO/PPO 的信任域（trust region，第 08 课）。
- **样本效率低。** 同策略（on-policy）意味着每次更新后你就把每一条转移（transition）丢弃。通过重要性采样（importance sampling）做的异策略（off-policy）修正能把数据找回来，但代价是方差（PPO 的比率就是一个被裁剪的重要性采样权重）。
- **非平稳梯度。** 来自 100 个回合之前的同一个梯度用的是旧的 `π`。正是出于这个原因，同策略方法每隔几次采样就更新一次。
- **信用分配（credit assignment）。** 没有未来回报，过去的奖励就会贡献噪声。始终使用未来回报。

## 实战应用

在 2026 年，REINFORCE 已很少被直接运行，但它的梯度公式无处不在：

| 应用场景 | 衍生方法 |
|----------|---------------|
| 连续控制 | PPO / SAC 配合高斯策略 |
| LLM RLHF | 带 KL 惩罚的 PPO，运行在 token 级策略上 |
| LLM 推理（DeepSeek） | GRPO——带组内相对基线（group-relative baseline）的 REINFORCE，无需评论家 |
| 多智能体（Multi-agent） | 中心化评论家（centralized-critic）的 REINFORCE（MADDPG、COMA） |
| 离散动作机器人 | A2C、A3C、PPO |
| 仅偏好（preference-only）场景 | DPO——把 REINFORCE 改写为偏好似然损失，无需采样 |

当你在 2026 年的某个训练脚本里读到 `loss = -advantage * log_prob` 时，那就是带基线的 REINFORCE。一整篇一整篇的论文（DPO、GRPO、RLOO）都只是建立在这一行代码之上的方差缩减技巧。

## 交付物

保存为 `outputs/skill-policy-gradient-trainer.md`：

```markdown
---
name: policy-gradient-trainer
description: Produce a REINFORCE / actor-critic / PPO training config for a given task and diagnose variance issues.
version: 1.0.0
phase: 9
lesson: 6
tags: [rl, policy-gradient, reinforce]
---

Given an environment (discrete / continuous actions, horizon, reward stats), output:

1. Policy head. Softmax (discrete) or Gaussian (continuous) with parameter counts.
2. Baseline. None (vanilla), running mean, learned `V̂(s)`, or A2C critic.
3. Variance controls. Reward-to-go on by default, return normalization, gradient clip value.
4. Entropy bonus. Coefficient β and decay schedule.
5. Batch size. Episodes per update; on-policy data freshness contract.

Refuse REINFORCE-no-baseline on horizons > 500 steps. Refuse continuous-action control with a softmax head. Flag any run with `β = 0` and observed policy entropy < 0.1 as entropy-collapsed.
```

## 练习

1. **简单。** 在 4×4 GridWorld 上用线性 softmax 策略实现 REINFORCE。在不带基线的情况下训练 1,000 个回合。画出学习曲线；测量方差（回报的标准差）。
2. **中等。** 加入一个滑动均值基线。重新训练。把样本效率和方差与朴素版的运行结果做对比。基线把收敛所需的步数减少了多少？
3. **困难。** 加入熵奖励 `β · H(π)`。扫描 `β ∈ {0, 0.01, 0.1, 1.0}`。画出最终回报与策略熵。在这个任务上，最佳平衡点在哪里？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 策略梯度（Policy gradient） | “直接训练策略” | `∇J(θ) = E[G · ∇ log π_θ(a\|s)]`；由对数导数技巧推导而来。 |
| REINFORCE | “最初的策略梯度算法” | Williams（1992）；蒙特卡洛回报乘以对数策略梯度。 |
| 对数导数技巧（Log-derivative trick） | “得分函数估计器（score function estimator）” | `∇P(τ;θ) = P(τ;θ) · ∇ log P(τ;θ)`；让期望的梯度变得可处理。 |
| 基线（Baseline） | “方差缩减” | 任意从 `G` 中减去的 `b(s)`；因 `E[b · ∇ log π] = 0` 而无偏。 |
| 未来回报（Reward-to-go） | “只有未来回报算数” | 用 `G_t^{from t}` 而非完整的 `G_0`；既正确又方差更低。 |
| 熵奖励（Entropy bonus） | “鼓励探索” | `+β · H(π(·\|s))` 项，防止策略坍缩。 |
| 同策略（On-policy） | “在你刚看到的数据上训练” | 梯度期望是相对于当前策略取的——不能直接复用旧数据。 |
| 优势（Advantage） | “比平均水平好多少” | `A(s, a) = G(s, a) - V(s)`；带基线的 REINFORCE 所乘的那个带符号量。 |

## 延伸阅读

- [Williams (1992). Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning](https://link.springer.com/article/10.1007/BF00992696) —— REINFORCE 原始论文。
- [Sutton et al. (2000). Policy Gradient Methods for Reinforcement Learning with Function Approximation](https://papers.nips.cc/paper_files/paper/1999/hash/464d828b85b0bed98e80ade0a5c43b0f-Abstract.html) —— 带函数逼近的现代策略梯度定理。
- [Sutton & Barto (2018). Ch. 13 — Policy Gradient Methods](http://incompleteideas.net/book/RLbook2020.pdf) —— 教科书式的讲解。
- [OpenAI Spinning Up — VPG / REINFORCE](https://spinningup.openai.com/en/latest/algorithms/vpg.html) —— 清晰的教学式阐述，附 PyTorch 代码。
- [Peters & Schaal (2008). Reinforcement Learning of Motor Skills with Policy Gradients](https://homes.cs.washington.edu/~todorov/courses/amath579/reading/PolicyGradient.pdf) —— 方差缩减以及把 REINFORCE 与信任域家族（TRPO、PPO）联系起来的自然梯度（natural-gradient）视角。
