# Actor-Critic — A2C 与 A3C

> REINFORCE 噪声很大。加入一个学习 `V̂(s)` 的 critic，从回报中减去它，就得到了一个期望相同但方差远低的优势（advantage）。这就是 actor-critic。A2C 同步地运行它；A3C 在多线程上运行它。两者是所有现代深度强化学习方法的心智模型。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 04（TD 学习）、Phase 9 · 06（REINFORCE）
**Time:** ~75 分钟

## 问题

原始 REINFORCE 可以工作，但它的方差糟透了。Monte Carlo 回报 `G_t` 在不同回合之间可以波动 10 倍。把这种噪声乘以 `∇ log π` 再取平均，得到的梯度估计器需要数千个回合才能把策略移动到 DQN 用少得多的更新就能达到的距离。

方差来自使用原始回报。如果你减去一个基线（baseline）`b(s_t)`——任何状态的函数，包括学习到的价值——期望不变而方差下降。最好的可计算基线是 `V̂(s_t)`。此时乘以 `∇ log π` 的量就是*优势*：

`A(s, a) = G - V̂(s)`

如果某个动作产生了高于平均的回报，它就是好的；低于平均则是坏的。带学习 critic 的 REINFORCE 就是 *actor-critic*。critic 为 actor 提供了一个低方差的教师。这是 2015 年之后所有深度策略方法（A2C、A3C、PPO、SAC、IMPALA）的基础。

## 概念

![Actor-critic: policy net plus value net, TD residual as advantage](../assets/actor-critic.svg)

**两个网络，一个共享损失：**

- **Actor** `π_θ(a | s)`：策略。被采样用于行动。用策略梯度训练。
- **Critic** `V_φ(s)`：估计从状态出发的期望回报。训练以最小化 `(V_φ(s) - target)²`。

**优势。** 两种标准形式：

- *MC 优势：* `A_t = G_t - V_φ(s_t)`。无偏，方差较高。
- *TD 优势：* `A_t = r_{t+1} + γ V_φ(s_{t+1}) - V_φ(s_t)`。有偏（使用了 `V_φ`），方差低得多。也称为 *TD 残差* `δ_t`。

**n 步优势。** 在两者之间插值：

`A_t^{(n)} = r_{t+1} + γ r_{t+2} + … + γ^{n-1} r_{t+n} + γ^n V_φ(s_{t+n}) - V_φ(s_t)`

`n = 1` 是纯 TD。`n = ∞` 是 MC。大多数实现中 Atari 用 `n = 5`，MuJoCo 上的 PPO 用 `n = 2048`。

**广义优势估计（GAE）。** Schulman 等人（2016）提出了对所有 n 步优势的指数加权平均：

`A_t^{GAE} = Σ_{l=0}^{∞} (γλ)^l δ_{t+l}`

其中 `λ ∈ [0, 1]`。`λ = 0` 是 TD（低方差、高偏差）。`λ = 1` 是 MC（高方差、无偏）。`λ = 0.95` 是 2026 年的默认值——调整它直到偏差/方差的旋钮落在你想要的位置。

**A2C：同步优势 actor-critic。** 在 `N` 个并行环境中收集 `T` 步。为每一步计算优势。在合并的批次上更新 actor 和 critic。重复。这是 A3C 更简单、更可扩展的兄弟版本。

**A3C：异步优势 actor-critic。** Mnih 等人（2016）。启动 `N` 个工作线程，每个线程运行一个环境。每个 worker 在自己的 rollout 上本地计算梯度，然后异步地应用到共享的参数服务器上。不需要回放缓冲区——worker 通过运行不同的轨迹来去相关。A3C 证明了你可以在 CPU 上大规模训练。2026 年，基于 GPU 的 A2C（批量并行环境）占主导地位，因为 GPU 需要大批次。

**组合损失。**

`L(θ, φ) = -E[ A_t · log π_θ(a_t | s_t) ]  +  c_v · E[(V_φ(s_t) - G_t)²]  -  c_e · E[H(π_θ(·|s_t))]`

三项：策略梯度损失、价值回归、熵奖励。`c_v ~ 0.5`、`c_e ~ 0.01` 是经典的起始值。

```figure
actor-critic
```

## 动手实现

### 第 1 步：一个 critic

线性 critic `V_φ(s) = w · features(s)` 用 MSE 更新：

```python
def critic_update(w, x, target, lr):
    v_hat = dot(w, x)
    err = target - v_hat
    for j in range(len(w)):
        w[j] += lr * err * x[j]
    return v_hat
```

在表格型环境中，critic 在几百个回合内收敛。在 Atari 上，把线性 critic 替换为共享的 CNN 主干 + 价值头。

### 第 2 步：n 步优势

给定长度为 `T` 的 rollout 和 bootstrap 的最终 `V(s_T)`：

```python
def compute_advantages(rewards, values, gamma=0.99, lam=0.95, last_value=0.0):
    advantages = [0.0] * len(rewards)
    gae = 0.0
    for t in reversed(range(len(rewards))):
        next_v = values[t + 1] if t + 1 < len(values) else last_value
        delta = rewards[t] + gamma * next_v - values[t]
        gae = delta + gamma * lam * gae
        advantages[t] = gae
    returns = [a + v for a, v in zip(advantages, values)]
    return advantages, returns
```

`returns` 是 critic 的目标。`advantages` 是乘以 `∇ log π` 的量。

### 第 3 步：组合更新

```python
for step_i, (x, a, _r, probs) in enumerate(traj):
    adv = advantages[step_i]
    target_v = returns[step_i]

    # critic
    critic_update(w, x, target_v, lr_v)

    # actor
    for i in range(N_ACTIONS):
        grad_logpi = (1.0 if i == a else 0.0) - probs[i]
        for j in range(N_FEAT):
            theta[i][j] += lr_a * adv * grad_logpi * x[j]
```

On-policy，每次更新一个 rollout，actor 和 critic 使用各自的学习率。

### 第 4 步：并行化（A3C 对比 A2C）

- **A3C：** 启动 `N` 个线程。每个线程运行自己的环境和自己的一次前向传播。定期把梯度更新推送到共享的主节点。主节点不加锁——竞态是可以的，只是增加噪声。
- **A2C：** 在单个进程中运行 `N` 个环境实例，把观测堆叠成 `[N, obs_dim]` 的批次，批量前向传播，批量反向传播。GPU 利用率更高、确定性、更容易推理。2026 年的默认选择。

我们的玩具代码为了清晰是单线程的；改写为批量 A2C 只需三行 numpy。

## 常见陷阱

- **critic 偏差先于 actor 梯度。** 如果 critic 是随机的，它的基线没有信息量，你就是在纯噪声上训练。在开启策略梯度之前先预热 critic 几百步，或者使用较慢的 actor 学习率。
- **优势归一化。** 在每个批次内把优势归一化为零均值/单位标准差。以几乎为零的成本极大稳定训练。
- **共享主干。** 在图像输入上为 actor 和 critic 使用共享的特征提取器。分离的输出头。共享特征在两个损失上搭便车。
- **On-policy 契约。** A2C 对每份数据只复用一次更新。更多次的话梯度就有偏（重要性采样修正正是 PPO 增加的内容）。
- **熵坍缩。** 没有 `c_e > 0`，策略会在几百次更新内变得接近确定性并停止探索。
- **奖励尺度。** 优势的大小取决于奖励尺度。对奖励做归一化（例如除以运行标准差），以在不同任务间保持一致的梯度大小。

## 应用

A2C/A3C 在 2026 年很少是最终选择，但它们是后来一切方法都在改进的架构：

| 方法 | 与 A2C 的关系 |
|--------|----------------|
| PPO | A2C + 用于多轮更新的截断重要性比率 |
| IMPALA | A3C + V-trace off-policy 修正 |
| SAC（Phase 9 · 07） | 带 soft-value critic 的 off-policy A2C（下一课） |
| GRPO（Phase 9 · 12） | 去掉 critic 的 A2C——组相对优势 |
| DPO | A2C 坍缩成偏好排序损失，无需采样 |
| AlphaStar / OpenAI Five | A2C + 联赛训练 + 模仿预训练 |

如果你在 2026 年的论文中看到“优势”，就想想 actor-critic。

## 发布

保存为 `outputs/skill-actor-critic-trainer.md`：

```markdown
---
name: actor-critic-trainer
description: Produce an A2C / A3C / GAE configuration for a given environment, with advantage estimation and loss weights specified.
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, gae]
---

Given an environment and compute budget, output:

1. Parallelism. A2C (GPU batched) vs A3C (CPU async) and the number of workers.
2. Rollout length T. Steps per env per update.
3. Advantage estimator. n-step or GAE(λ); specify λ.
4. Loss weights. `c_v` (value), `c_e` (entropy), gradient clip.
5. Learning rates. Actor and critic (separate if using).

Refuse single-worker A2C on environments with horizon > 1000 (too on-policy, too slow). Refuse to ship without advantage normalization. Flag any run with `c_e = 0` and observed entropy < 0.1 as entropy-collapsed.
```

## 练习

1. **简单。** 用 MC 优势（`G_t - V(s_t)`）在 4×4 GridWorld 上训练 actor-critic。与第 06 课的带运行均值基线的 REINFORCE 比较样本效率。
2. **中等。** 切换到 TD 残差优势（`r + γ V(s') - V(s)`）。测量优势批次的方差。它下降了多少？
3. **困难。** 实现 GAE(λ)。扫描 `λ ∈ {0, 0.5, 0.9, 0.95, 1.0}`。绘制最终回报对比样本效率的曲线。这个任务的偏差/方差最佳点在哪里？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| Actor | “策略网络” | `π_θ(a\|s)`，由策略梯度更新。 |
| Critic | “价值网络” | `V_φ(s)`，通过到回报 / TD 目标的 MSE 回归更新。 |
| Advantage | “比平均好多少” | `A(s, a) = Q(s, a) - V(s)` 或其估计器。`∇ log π` 的乘数。 |
| TD residual | "δ" | `δ_t = r + γ V(s') - V(s)`；一步优势估计。 |
| GAE | “插值旋钮” | n 步优势的指数加权和，由 `λ` 参数化。 |
| A2C | “同步 actor-critic” | 跨环境批量化；每个 rollout 一次梯度步。 |
| A3C | “异步 actor-critic” | 工作线程把梯度推送到共享参数服务器。原始论文；2026 年较少见。 |
| Bootstrap | “在地平线处使用 V” | 截断 rollout，加上 `γ^n V(s_{t+n})` 来闭合求和。 |

## 延伸阅读

- [Mnih 等人（2016）。Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783) — A3C，最早的异步 actor-critic 论文。
- [Schulman 等人（2016）。High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) — GAE。
- [Sutton & Barto（2018）。第 13 章 — Actor-Critic 方法](http://incompleteideas.net/book/RLbook2020.pdf) — 基础；当 critic 是神经网络时，配合第 9 章关于函数逼近的内容一起阅读。
- [Espeholt 等人（2018）。IMPALA](https://arxiv.org/abs/1802.01561) — 带有 V-trace off-policy 修正的可扩展分布式 actor-critic。
- [OpenAI Baselines / Stable-Baselines3](https://stable-baselines3.readthedocs.io/) — 值得一读的生产级 A2C/PPO 实现。
- [Konda & Tsitsiklis（2000）。Actor-Critic Algorithms](https://papers.nips.cc/paper/1786-actor-critic-algorithms) — 双时间尺度 actor-critic 分解的基础收敛结果。