# Actor-Critic —— A2C 与 A3C

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> REINFORCE 噪声太大。加一个学习 `V̂(s)` 的 critic（评论家），用回报减去它，就得到一个期望相同、方差却低得多的 advantage（优势）。这就是 actor-critic（演员-评论家）。A2C 同步跑，A3C 多线程跑。所有现代深度强化学习方法的心智模型都源自这里。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 04（TD Learning）, Phase 9 · 06（REINFORCE）
**Time:** ~75 minutes

## 问题（The Problem）

朴素 REINFORCE 能跑，但方差糟糕。蒙特卡洛回报 `G_t` 在不同 episode 之间能波动 10 倍。把这种噪声乘上 `∇ log π` 再求平均，得到的梯度估计器要花上几千个 episode 才能把策略推动到 DQN 几次更新就能达到的位置。

方差源自直接使用原始回报。如果你减去一个 baseline（基线）`b(s_t)` —— 任何状态的函数，包括一个学到的 value（值）—— 期望保持不变，方差却会下降。可行 baseline 中最优的就是 `V̂(s_t)`。这样乘在 `∇ log π` 上的量就变成了 *advantage*：

`A(s, a) = G - V̂(s)`

如果一个动作产生的回报高于平均，它就是好的；低于平均就是坏的。带学习型 critic 的 REINFORCE 就是 *actor-critic*。critic 给 actor 提供一个低方差的老师。这就是 2015 年之后所有深度策略方法的范式（A2C、A3C、PPO、SAC、IMPALA）。

## 概念（The Concept）

![Actor-critic：策略网络加值网络，TD 残差作为 advantage](../assets/actor-critic.svg)

**两个网络，一个共享损失：**

- **Actor** `π_θ(a | s)`：策略，采样产生动作，用策略梯度训练。
- **Critic** `V_φ(s)`：估计从某状态出发的期望回报，通过最小化 `(V_φ(s) - target)²` 来训练。

**advantage 的两种标准形式：**

- *MC advantage：* `A_t = G_t - V_φ(s_t)`。无偏，方差更高。
- *TD advantage：* `A_t = r_{t+1} + γ V_φ(s_{t+1}) - V_φ(s_t)`。有偏（用了 `V_φ`），方差却低得多。也叫 *TD 残差* `δ_t`。

**n 步 advantage。** 在两者之间插值：

`A_t^{(n)} = r_{t+1} + γ r_{t+2} + … + γ^{n-1} r_{t+n} + γ^n V_φ(s_{t+n}) - V_φ(s_t)`

`n = 1` 是纯 TD，`n = ∞` 是 MC。多数实现在 Atari 上用 `n = 5`，PPO 在 MuJoCo 上用 `n = 2048`。

**Generalized Advantage Estimation（GAE，广义优势估计）。** Schulman 等（2016）提出对所有 n 步 advantage 做指数加权平均：

`A_t^{GAE} = Σ_{l=0}^{∞} (γλ)^l δ_{t+l}`

其中 `λ ∈ [0, 1]`。`λ = 0` 是 TD（低方差、高偏差），`λ = 1` 是 MC（高方差、无偏）。`λ = 0.95` 是 2026 年的默认值 —— 调到你想要的偏差/方差平衡点为止。

**A2C：同步 advantage actor-critic。** 在 `N` 个并行环境上各采集 `T` 步。逐步计算 advantage。在合并 batch 上更新 actor 和 critic，重复。是 A3C 更简单、更易扩展的兄弟。

**A3C：异步 advantage actor-critic。** Mnih 等（2016）。开 `N` 个 worker 线程，每个跑一个环境。每个 worker 在自己的 rollout 上本地计算梯度，然后异步推送到共享参数服务器。不需要 replay buffer —— worker 通过跑不同的轨迹自然解相关。A3C 证明了你可以在 CPU 上大规模训练。到了 2026，基于 GPU 的 A2C（批量并行环境）占主导，因为 GPU 喜欢大 batch。

**组合损失：**

`L(θ, φ) = -E[ A_t · log π_θ(a_t | s_t) ]  +  c_v · E[(V_φ(s_t) - G_t)²]  -  c_e · E[H(π_θ(·|s_t))]`

三项：策略梯度损失、值回归、熵奖励项。`c_v ~ 0.5`、`c_e ~ 0.01` 是教科书式的起点。

## 动手实现（Build It）

### Step 1：一个 critic

线性 critic `V_φ(s) = w · features(s)`，用 MSE 更新：

```python
def critic_update(w, x, target, lr):
    v_hat = dot(w, x)
    err = target - v_hat
    for j in range(len(w)):
        w[j] += lr * err * x[j]
    return v_hat
```

在表格型环境里，critic 几百个 episode 就能收敛。在 Atari 上，把线性 critic 换成共享 CNN 主干 + value head 即可。

### Step 2：n 步 advantage

给定一段长度 `T` 的 rollout 和自举的最后一个 `V(s_T)`：

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

`returns` 是 critic 的目标，`advantages` 是乘在 `∇ log π` 上的量。

### Step 3：组合更新

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

On-policy（同策略），每条 rollout 更新一次，actor 和 critic 用各自独立的学习率。

### Step 4：并行化（A3C vs A2C）

- **A3C：** 起 `N` 个线程，每个跑自己的环境和前向。周期性地把梯度更新推到共享 master。master 上不加锁 —— 竞态没关系，无非是多点噪声。
- **A2C：** 在单进程里跑 `N` 个环境实例，把 observation 堆叠成 `[N, obs_dim]` 的 batch，批量前向、批量反向。GPU 利用率更高、确定性、推理起来也更轻松。2026 年的默认选择。

我们的玩具代码为了清晰是单线程的；改成批量 A2C 也就是三行 numpy。

## 陷阱（Pitfalls）

- **actor 梯度之前的 critic 偏差。** 如果 critic 是随机初始化的，它给出的 baseline 没有信息量，你就是在纯噪声上训练。先让 critic 预热几百步再开启策略梯度，或者把 actor 学习率调小。
- **advantage 归一化。** 每个 batch 把 advantage 归一化为零均值、单位方差。代价几乎为零，却能极大稳定训练。
- **共享主干。** 在图像输入上，让 actor 和 critic 共享一个特征提取器，再各自接独立的 head。共享特征同时受两个损失驱动，搭便车。
- **on-policy 契约。** A2C 每份数据只用一次更新。再多就有偏（PPO 加上的就是 importance sampling 修正）。
- **熵坍缩。** 不设 `c_e > 0` 的话，策略几百次更新内就会趋近确定性，停止探索。
- **奖励尺度。** advantage 大小取决于奖励尺度。归一化 reward（比如除以 running-std）能让不同任务上的梯度量级保持一致。

## 用起来（Use It）

A2C/A3C 在 2026 年很少是最终选择，但后来一切方法都是在这个架构上做精修：

| 方法 | 与 A2C 的关系 |
|--------|----------------|
| PPO | A2C + clipped importance ratio，可以多 epoch 更新 |
| IMPALA | A3C + V-trace off-policy 修正 |
| SAC（Phase 9 · 07） | off-policy 版的 A2C，带软值 critic（下一课） |
| GRPO（Phase 9 · 12） | 不要 critic 的 A2C —— 用 group-relative advantage |
| DPO | A2C 坍缩成偏好排序损失，不再采样 |
| AlphaStar / OpenAI Five | A2C + league training + 模仿预训练 |

2026 年的论文里看到 "advantage"，脑子里就该浮现 actor-critic。

## 上线部署（Ship It）

存为 `outputs/skill-actor-critic-trainer.md`：

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

## 练习（Exercises）

1. **Easy.** 在 4×4 GridWorld 上用 MC advantage（`G_t - V(s_t)`）训练 actor-critic。把样本效率与第 06 课带 running-mean baseline 的 REINFORCE 做对比。
2. **Medium.** 切换到 TD 残差 advantage（`r + γ V(s') - V(s)`）。测量 advantage batch 的方差，下降了多少？
3. **Hard.** 实现 GAE(λ)。扫 `λ ∈ {0, 0.5, 0.9, 0.95, 1.0}`。画出最终回报与样本效率的曲线。这个任务上偏差/方差的甜点在哪儿？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Actor | "策略网络" | `π_θ(a\|s)`，由策略梯度更新。 |
| Critic | "值网络" | `V_φ(s)`，对 returns / TD target 做 MSE 回归更新。 |
| Advantage | "比平均好多少" | `A(s, a) = Q(s, a) - V(s)` 或其各种估计器，是 `∇ log π` 的乘子。 |
| TD residual | "δ" | `δ_t = r + γ V(s') - V(s)`；单步 advantage 估计。 |
| GAE | "插值旋钮" | n 步 advantage 的指数加权和，由 `λ` 参数化。 |
| A2C | "同步 actor-critic" | 跨环境批量化；每条 rollout 一次梯度更新。 |
| A3C | "异步 actor-critic" | worker 线程把梯度推送到共享参数服务器。开山论文；2026 已不常见。 |
| Bootstrap | "在地平线处用 V" | 截断 rollout，加上 `γ^n V(s_{t+n})` 把求和闭合。 |

## 延伸阅读（Further Reading）

- [Mnih et al. (2016). Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783) —— A3C，最初的异步 actor-critic 论文。
- [Schulman et al. (2016). High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) —— GAE。
- [Sutton & Barto (2018). Ch. 13 — Actor-Critic Methods](http://incompleteideas.net/book/RLbook2020.pdf) —— 基础；当 critic 是神经网络时，搭配第 9 章的函数逼近一起读。
- [Espeholt et al. (2018). IMPALA](https://arxiv.org/abs/1802.01561) —— 可扩展的分布式 actor-critic，带 V-trace off-policy 修正。
- [OpenAI Baselines / Stable-Baselines3](https://stable-baselines3.readthedocs.io/) —— 值得读的生产级 A2C/PPO 实现。
- [Konda & Tsitsiklis (2000). Actor-Critic Algorithms](https://papers.nips.cc/paper/1786-actor-critic-algorithms) —— 双时间尺度 actor-critic 分解的奠基性收敛结果。
