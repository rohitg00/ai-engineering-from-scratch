# 07 · 演员-评论家（Actor-Critic）—— A2C 与 A3C

> REINFORCE 噪声很大。加入一个学习 `V̂(s)` 的评论家（critic），把它从回报中减去，你就得到一个期望相同但方差低得多的优势（advantage）。这就是演员-评论家。A2C 同步运行它，A3C 跨线程运行它。两者都是所有现代深度强化学习方法的思维模型。

**类型：** 实践构建
**语言：** Python
**前置：** 阶段 9 · 04（TD 学习），阶段 9 · 06（REINFORCE）
**时长：** 约 75 分钟

## 问题所在

朴素的 REINFORCE 能跑，但它的方差糟透了。蒙特卡洛回报（Monte Carlo return）`G_t` 在不同回合之间可能波动一个数量级。把这种噪声乘以 `∇ log π` 再取平均，得到的梯度估计量需要成千上万个回合才能把策略推进到——用远少得多的 DQN 更新就能达到的——同样距离。

方差来自使用原始回报。如果你减去一个基线（baseline）`b(s_t)` —— 任何关于状态的函数，包括一个学习出来的价值 —— 期望不变，方差却会下降。最优且可处理的基线就是 `V̂(s_t)`。此时乘以 `∇ log π` 的量就成了*优势*：

`A(s, a) = G - V̂(s)`

一个动作如果产生了高于平均的回报就是好的，低于平均就是坏的。带学习评论家的 REINFORCE 就是*演员-评论家*。评论家给了演员一位低方差的老师。2015 年之后的每一种深度策略方法都是如此（A2C、A3C、PPO、SAC、IMPALA）。

## 核心概念

〔图：演员-评论家：策略网络加价值网络，以 TD 残差作为优势〕

**两个网络，一个共享损失：**

- **演员（Actor）** `π_θ(a | s)`：策略本身。采样后用于行动。用策略梯度训练。
- **评论家（Critic）** `V_φ(s)`：估计从某状态出发的期望回报。训练目标是最小化 `(V_φ(s) - target)²`。

**优势（advantage）。** 两种标准形式：

- *MC 优势：* `A_t = G_t - V_φ(s_t)`。无偏，方差较高。
- *TD 优势：* `A_t = r_{t+1} + γ V_φ(s_{t+1}) - V_φ(s_t)`。有偏（用到了 `V_φ`），方差低得多。又称 *TD 残差（TD residual）* `δ_t`。

**n 步优势（n-step advantage）。** 在两者之间插值：

`A_t^{(n)} = r_{t+1} + γ r_{t+2} + … + γ^{n-1} r_{t+n} + γ^n V_φ(s_{t+n}) - V_φ(s_t)`

`n = 1` 是纯 TD，`n = ∞` 是 MC。大多数实现中 Atari 用 `n = 5`，MuJoCo 上的 PPO 用 `n = 2048`。

**广义优势估计（Generalized Advantage Estimation, GAE）。** Schulman 等人（2016）提出对所有 n 步优势做指数加权平均：

`A_t^{GAE} = Σ_{l=0}^{∞} (γλ)^l δ_{t+l}`

其中 `λ ∈ [0, 1]`。`λ = 0` 是 TD（低方差，高偏差），`λ = 1` 是 MC（高方差，无偏）。`λ = 0.95` 是 2026 年的默认值 —— 一直调到偏差/方差的旋钮处在你想要的位置为止。

**A2C：同步优势演员-评论家（synchronous advantage actor-critic）。** 在 `N` 个并行环境中各收集 `T` 步。为每一步计算优势。在合并后的批次上更新演员和评论家。重复。它是 A3C 更简单、更具可扩展性的同胞兄弟。

**A3C：异步优势演员-评论家（asynchronous advantage actor-critic）。** Mnih 等人（2016）。启动 `N` 个工作线程（worker），每个运行一个环境。每个 worker 在自己的轨迹（rollout）上本地计算梯度，然后异步地把梯度施加到一个共享的参数服务器上。不需要回放缓冲区（replay buffer）—— worker 通过运行不同的轨迹来去相关化。A3C 证明了你可以在 CPU 上大规模训练。到 2026 年，基于 GPU 的 A2C（批量并行环境）占主导地位，因为 GPU 喜欢大批次。

**合并后的损失。**

`L(θ, φ) = -E[ A_t · log π_θ(a_t | s_t) ]  +  c_v · E[(V_φ(s_t) - G_t)²]  -  c_e · E[H(π_θ(·|s_t))]`

三项：策略梯度损失、价值回归、熵奖励。`c_v ~ 0.5`、`c_e ~ 0.01` 是经典的起始值。

## 动手构建

### 第 1 步：一个评论家

用 MSE 更新的线性评论家 `V_φ(s) = w · features(s)`：

```python
def critic_update(w, x, target, lr):
    v_hat = dot(w, x)
    err = target - v_hat
    for j in range(len(w)):
        w[j] += lr * err * x[j]
    return v_hat
```

在表格型环境中，评论家几百个回合就能收敛。在 Atari 上，把线性评论家换成一个共享的 CNN 主干 + 价值头（value head）。

### 第 2 步：n 步优势

给定长度为 `T` 的一段轨迹和一个自举（bootstrap）出来的末态 `V(s_T)`：

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

`returns` 是评论家的目标。`advantages` 是乘以 `∇ log π` 的那一项。

### 第 3 步：合并更新

```python
for step_i, (x, a, _r, probs) in enumerate(traj):
    adv = advantages[step_i]
    target_v = returns[step_i]

    # 评论家
    critic_update(w, x, target_v, lr_v)

    # 演员
    for i in range(N_ACTIONS):
        grad_logpi = (1.0 if i == a else 0.0) - probs[i]
        for j in range(N_FEAT):
            theta[i][j] += lr_a * adv * grad_logpi * x[j]
```

同策略（on-policy），每次更新对应一段轨迹，演员和评论家使用各自独立的学习率。

### 第 4 步：并行化（A3C 与 A2C 对比）

- **A3C：** 启动 `N` 个线程。每个线程运行自己的环境和自己的前向传播。周期性地把梯度更新推送给一个共享的主进程（master）。主进程上不加锁 —— 竞态是可以的，它们只是增加一些噪声。
- **A2C：** 在单个进程中运行 `N` 个环境实例，把观测堆叠成一个 `[N, obs_dim]` 的批次，做批量前向传播、批量反向传播。GPU 利用率更高，确定性强，更易于推理。2026 年的默认选择。

我们的玩具代码为了清晰起见是单线程的；改写成批量化的 A2C 只需三行 numpy。

## 常见陷阱

- **评论家偏差先于演员梯度。** 如果评论家是随机的，它的基线毫无信息量，你就是在纯噪声上做训练。在打开策略梯度之前，先把评论家热身（warm up）几百步，或者用一个较慢的演员学习率。
- **优势归一化。** 按批次把优势归一化为零均值/单位标准差。以接近零的成本极大地稳定训练。
- **共享主干。** 在图像输入上，演员和评论家共用一个特征提取器，各自接独立的头。共享特征可以同时从两个损失中“搭便车”受益。
- **同策略契约。** A2C 把数据恰好用于一次更新。再多就会让梯度有偏（重要性采样修正正是 PPO 所添加的东西）。
- **熵崩塌（entropy collapse）。** 如果没有 `c_e > 0`，策略会在几百次更新内变得近乎确定性，从而停止探索。
- **奖励尺度。** 优势的量级依赖于奖励的尺度。对奖励做归一化（例如除以滑动标准差），以在不同任务间保持一致的梯度量级。

## 实际应用

A2C/A3C 在 2026 年很少是最终选择，但它们是后续一切方法所打磨的那套架构：

| 方法 | 与 A2C 的关系 |
|--------|----------------|
| PPO | A2C + 用于多轮更新的裁剪重要性比率 |
| IMPALA | A3C + V-trace 异策略修正 |
| SAC（阶段 9 · 07） | 带软价值评论家的异策略 A2C（下一课） |
| GRPO（阶段 9 · 12） | 去掉评论家的 A2C —— 组相对优势 |
| DPO | 坍缩成偏好排序损失的 A2C，无需采样 |
| AlphaStar / OpenAI Five | A2C + 联赛训练（league training）+ 模仿预训练 |

如果你在 2026 年的论文里看到“优势（advantage）”，就联想到演员-评论家。

## 交付产物

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

1. **简单。** 在 4×4 GridWorld 上用 MC 优势（`G_t - V(s_t)`）训练演员-评论家。把样本效率与第 06 课中的“带滑动均值基线的 REINFORCE”作比较。
2. **中等。** 改用 TD 残差优势（`r + γ V(s') - V(s)`）。测量各批优势的方差。它下降了多少？
3. **困难。** 实现 GAE(λ)。扫描 `λ ∈ {0, 0.5, 0.9, 0.95, 1.0}`。绘制最终回报对样本效率的关系图。对这个任务而言，偏差/方差的最佳平衡点在哪里？

## 关键术语

| 术语 | 人们怎么说 | 它实际的含义 |
|------|-----------------|-----------------------|
| Actor（演员） | “那个策略网络” | `π_θ(a\|s)`，由策略梯度更新。 |
| Critic（评论家） | “那个价值网络” | `V_φ(s)`，通过对回报 / TD 目标做 MSE 回归来更新。 |
| Advantage（优势） | “比平均好多少” | `A(s, a) = Q(s, a) - V(s)` 或其各种估计量。`∇ log π` 的乘数。 |
| TD residual（TD 残差） | “δ” | `δ_t = r + γ V(s') - V(s)`；单步优势估计。 |
| GAE | “那个插值旋钮” | n 步优势的指数加权和，由 `λ` 参数化。 |
| A2C | “同步演员-评论家” | 跨环境批量化；每段轨迹一次梯度步。 |
| A3C | “异步演员-评论家” | worker 线程把梯度推送给共享的参数服务器。最初的论文；2026 年已不太常见。 |
| Bootstrap（自举） | “在视界处用 V” | 截断轨迹，加上 `γ^n V(s_{t+n})` 来收尾整个求和。 |

## 延伸阅读

- [Mnih et al. (2016). Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783) —— A3C，最初的异步演员-评论家论文。
- [Schulman et al. (2016). High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) —— GAE。
- [Sutton & Barto (2018). Ch. 13 — Actor-Critic Methods](http://incompleteideas.net/book/RLbook2020.pdf) —— 基础理论；当评论家是神经网络时，可与第 9 章关于函数逼近的内容配合阅读。
- [Espeholt et al. (2018). IMPALA](https://arxiv.org/abs/1802.01561) —— 带 V-trace 异策略修正的可扩展分布式演员-评论家。
- [OpenAI Baselines / Stable-Baselines3](https://stable-baselines3.readthedocs.io/) —— 值得一读的生产级 A2C/PPO 实现。
- [Konda & Tsitsiklis (2000). Actor-Critic Algorithms](https://papers.nips.cc/paper/1786-actor-critic-algorithms) —— 双时间尺度演员-评论家分解的奠基性收敛结果。
