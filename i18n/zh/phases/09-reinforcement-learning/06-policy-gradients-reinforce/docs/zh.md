# 策略梯度 —— 从零实现 REINFORCE

> 别再估计价值了。直接参数化策略，计算期望回报的梯度，向上攀升。Williams (1992) 用一个定理把它写了出来。这正是 PPO、GRPO 以及所有 LLM 强化学习循环存在的原因。

**Type:** Build
**Languages:** Python
**Prerequisites:** 阶段 3 · 03(反向传播)、阶段 9 · 03(蒙特卡洛)、阶段 9 · 04(TD 学习)
**Time:** ~75 分钟

## 问题所在

Q-learning 和 DQN 参数化的是*价值*函数。你通过 `argmax Q` 来选择动作。这对离散动作和离散状态没问题。但当动作是连续的(如何对 10 维力矩做 `argmax`?)或你想要随机性策略时(`argmax` 按其构造就是确定性的)，它就失效了。

策略梯度改为参数化*策略*本身。`π_θ(a | s)` 是一个输出动作分布的神经网络。从中采样以执行动作。计算期望回报关于 `θ` 的梯度。向上攀升。没有 `argmax`。没有 Bellman 递归。只是对 `J(θ) = E_{π_θ}[G]` 做梯度上升。

REINFORCE 定理(Williams 1992)告诉你这个梯度是可计算的：`∇J(θ) = E_π[ G · ∇_θ log π_θ(a | s) ]`。跑一个回合。计算回报。在每一步乘上 `∇ log π_θ(a | s)`。取平均。梯度上升。完成。

2026 年的每一个 LLM 强化学习算法 —— PPO、DPO、GRPO —— 都是 REINFORCE 的改进版。把它练到得心应手，是本阶段后续内容、阶段 10 · 07(RLHF 实现)和阶段 10 · 08(DPO)的先决条件。

## 概念

![Policy gradient: softmax policy, log-π gradient, return-weighted update](../assets/policy-gradient.svg)

**策略梯度定理。** 对任意由 `θ` 参数化的策略 `π_θ`:

`∇J(θ) = E_{τ ~ π_θ}[ Σ_{t=0}^{T} G_t · ∇_θ log π_θ(a_t | s_t) ]`

其中 `G_t = Σ_{k=t}^{T} γ^{k-t} r_{k+1}` 是从第 `t` 步起的折扣回报。期望是对从 `π_θ` 中采样的完整轨迹 `τ` 取的。

**证明很短。** 在期望符号下对 `J(θ) = Σ_τ P(τ; θ) G(τ)` 求导。使用 `∇P(τ; θ) = P(τ; θ) ∇ log P(τ; θ)`(对数导数技巧)。整理出因子 `log P(τ; θ) = Σ log π_θ(a_t | s_t) + environment terms that do not depend on θ`。环境相关项消失。两行代数就得到定理。

**方差削减技巧。** 原始 REINFORCE 的方差是致命的 —— 回报有噪声，`∇ log π` 有噪声，它们的乘积噪声极大。两个标准修正：

1. **基线减除。** 把 `G_t` 替换为 `G_t - b(s_t)`,其中基线 `b(s_t)` 不依赖于 `a_t`。由于 `E[b(s_t) · ∇ log π(a_t | s_t)] = 0`,该方法无偏。典型选择：由 critic 学到的 `b(s_t) = V̂(s_t)` → actor-critic(第 07 课)。
2. **Reward-to-go(未来回报)。** 把 `Σ_t G_t · ∇ log π_θ(a_t | s_t)` 替换为 `Σ_t G_t^{from t} · ∇ log π_θ(a_t | s_t)`。对一个给定动作来说，只有未来的回报才重要 —— 过去的奖励只贡献零均值噪声。

结合起来，得到：

`∇J ≈ (1/N) Σ_{i=1}^{N} Σ_{t=0}^{T_i} [ G_t^{(i)} - V̂(s_t^{(i)}) ] · ∇_θ log π_θ(a_t^{(i)} | s_t^{(i)})`

即带基线的 REINFORCE —— A2C(第 07 课)和 PPO(第 08 课)的直接祖先。

**Softmax 策略参数化。** 对离散动作，标准选择是：

`π_θ(a | s) = exp(f_θ(s, a)) / Σ_{a'} exp(f_θ(s, a'))`

其中 `f_θ` 是任意一个为每个动作输出分数的神经网络。梯度有一个简洁的形式：

`∇_θ log π_θ(a | s) = ∇_θ f_θ(s, a) - Σ_{a'} π_θ(a' | s) ∇_θ f_θ(s, a')`

即所采取动作的分数减去它在策略下的期望值。

**用于连续动作的高斯策略。** `π_θ(a | s) = N(μ_θ(s), σ_θ(s))`。`∇ log N(a; μ, σ)` 有闭式解。这正是阶段 9 · 07 中 SAC 所需的全部。

```figure
policy-gradient-landscape
```

## 动手实现

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

在表格型环境中使用线性策略(每个动作一个权重向量)。在 Atari 上换成 CNN,保留 softmax 输出头。

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

### 第 3 步：记录对数概率的 rollout

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

梯度 `∇ log π(a|s) = e_a - π(·|s)`(`a` 的 onehot 减去概率)是 softmax 策略梯度的核心。把它刻进肌肉记忆。

### 第 5 步：基线

对近期回合的 `G` 取滑动平均，就足以让 4×4 GridWorld 跑起来；大约需要 500 个回合收敛。把基线升级为学习到的 `V̂(s)`,就得到了 actor-critic。

## 常见陷阱

- **梯度爆炸。** 回报可能非常大。在乘以 `∇ log π` 之前，务必先把 `G` 在整个 batch 上归一化到 `~N(0, 1)`。
- **熵坍缩。** 策略过早收敛到近乎确定性的动作，停止探索，陷入停滞。修复：在目标函数中加入熵奖励项 `β · H(π(·|s))`。
- **高方差。** 原始 REINFORCE 需要数千个回合。critic 基线(第 07 课)或 TRPO/PPO 的信任域(第 08 课)是标准修复手段。
- **样本效率低。** On-policy 意味着每次更新后就要丢弃所有转移数据。通过重要性采样做 off-policy 修正可以回收数据，但代价是方差增加(PPO 的 ratio 是截断的重要性采样权重)。
- **梯度非平稳。** 100 个回合前的梯度用的是旧的 `π`。正因如此，on-policy 方法每几个 rollout 就更新一次。
- **信用分配。** 不用 reward-to-go 的话，过去的奖励只会贡献噪声。永远使用 reward-to-go。

## 实际应用

到 2026 年，REINFORCE 很少被直接运行，但它的梯度公式无处不在：

| 使用场景 | 派生方法 |
|----------|---------------|
| 连续控制 | 采用高斯策略的 PPO / SAC |
| LLM RLHF | 带 KL 惩罚的 PPO,运行在 token 级策略上 |
| LLM 推理(DeepSeek) | GRPO —— 带组相对基线的 REINFORCE,无需 critic |
| 多智能体 | 集中式 critic 的 REINFORCE(MADDPG、COMA) |
| 离散动作机器人 | A2C、A3C、PPO |
| 仅基于偏好的场景 | DPO —— REINFORCE 改写为偏好似然损失，无需采样 |

当你在 2026 年的训练脚本中读到 `loss = -advantage * log_prob` 时，那就是带基线的 REINFORCE。整篇论文(DPO、GRPO、RLOO)都是在这行代码之上做方差削减。

## 交付

保存为 `outputs/skill-policy-gradient-trainer.md`:

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

1. **简单。** 在 4×4 GridWorld 上用线性 softmax 策略实现 REINFORCE。不带基线训练 1,000 个回合。绘制学习曲线；度量方差(回报的标准差)。
2. **中等。** 加入滑动平均基线。再次训练。与原始版本比较样本效率和方差。基线把收敛步数降低了多少？
3. **困难。** 加入熵奖励项 `β · H(π)`。扫描 `β ∈ {0, 0.01, 0.1, 1.0}`。绘制最终回报和策略熵。这个任务上的最佳平衡点在哪里？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 策略梯度 | "直接训练策略" | `∇J(θ) = E[G · ∇ log π_θ(a\|s)]`;由对数导数技巧推导而来。 |
| REINFORCE | "最初的策略梯度算法" | Williams (1992);蒙特卡洛回报乘以策略对数梯度。 |
| 对数导数技巧 | "得分函数估计器" | `∇P(τ;θ) = P(τ;θ) · ∇ log P(τ;θ)`;使期望的梯度变得可计算。 |
| 基线 | "方差削减" | 任何从 `G` 中减去的、与动作无关的 `b(s)`;因为 `E[b · ∇ log π] = 0` 所以无偏。 |
| Reward-to-go | "只算未来的回报" | 用 `G_t^{from t}` 代替完整的 `G_0`;正确且方差更低。 |
| 熵奖励 | "鼓励探索" | `+β · H(π(·\|s))` 项防止策略坍缩。 |
| On-policy | "用刚看到的数据训练" | 梯度期望是关于当前策略的 —— 不能直接复用旧数据。 |
| 优势(Advantage) | "比平均好多少" | `A(s, a) = G(s, a) - V(s)`;带基线的 REINFORCE 所乘的带符号量。 |

## 延伸阅读

- [Williams (1992). Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning](https://link.springer.com/article/10.1007/BF00992696) — REINFORCE 原始论文。
- [Sutton et al. (2000). Policy Gradient Methods for Reinforcement Learning with Function Approximation](https://papers.nips.cc/paper_files/paper/1999/hash/464d828b85b0bed98e80ade0a5c43b0f-Abstract.html) — 带函数逼近的现代策略梯度定理。
- [Sutton & Barto (2018). Ch. 13 — Policy Gradient Methods](http://incompleteideas.net/book/RLbook2020.pdf) — 教科书式讲解。
- [OpenAI Spinning Up — VPG / REINFORCE](https://spinningup.openai.com/en/latest/algorithms/vpg.html) — 配有 PyTorch 代码的清晰教学阐述。
- [Peters & Schaal (2008). Reinforcement Learning of Motor Skills with Policy Gradients](https://homes.cs.washington.edu/~todorov/courses/amath579/reading/PolicyGradient.pdf) — 方差削减，以及把 REINFORCE 与信任域家族(TRPO、PPO)联系起来的自然梯度视角。