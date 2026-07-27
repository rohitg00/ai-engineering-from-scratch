# Actor-Critic——A2C 与 A3C

> REINFORCE 噪声很大。添加一个学习 V̂(s) 的评论家，从回报中减去它，你就得到一个具有相同期望但方差低得多的优势。这就是 actor-critic。A2C 同步运行；A3C 跨线程运行。两者都是所有现代深度 RL 方法的心智模型。

**类型：** 构建
**语言：** Python
**前置要求：** 阶段 9 · 04（TD 学习）、阶段 9 · 06（REINFORCE）
**时间：** ~75 分钟

## 问题

原始 REINFORCE 能工作，但其方差非常糟糕。蒙特卡洛回报 G_t 在不同回合之间可能波动 10 倍。将该噪声乘以 ∇ log π 并取平均产生的梯度估计器需要数千个回合才能将策略移动相同的距离，而用少得多的 DQN 更新就能达到。

方差来源于使用原始回报。如果你减去一个基线 (s_t)——任何状态的函数，包括学习到的价值——期望不变，方差降低。最好的易处理基线是 V̂(s_t)。现在乘以 ∇ log π 的量是**优势**：

A(s, a) = G - V̂(s)

如果一个动作产生了高于平均的回报，它就是好的；低于平均就是坏的。带学习到的评论家的 REINFORCE 就是 *actor-critic*。评论家给了演员一个低方差的教师。这是 2015 年后每个深度策略方法（A2C、A3C、PPO、SAC、IMPALA）的基础。

## 概念

![Actor-critic：策略网络加价值网络，TD 残差作为优势](../assets/actor-critic.svg)

**两个网络，一个共享损失：**

- **演员** π_θ(a | s)：策略。采样来行动。用策略梯度训练。
- **评论家** V_φ(s)：估计从状态出发的期望回报。训练以最小化 (V_φ(s) - target)²。

**优势。** 两种标准形式：

- *MC 优势：* A_t = G_t - V_φ(s_t)。无偏，方差较高。
- *TD 优势：* A_t = r_{t+1} + γ V_φ(s_{t+1}) - V_φ(s_t)。有偏（使用了 V_φ），方差低得多。也称为 *TD 残差* δ_t。

**n-步优势。** 在两者之间插值：

A_t^{(n)} = r_{t+1} + γ r_{t+2} + … + γ^{n-1} r_{t+n} + γ^n V_φ(s_{t+n}) - V_φ(s_t)


 = 1 是纯 TD。
 = ∞ 是 MC。大多数实现中 Atari 使用 
 = 5，MuJoCo 上的 PPO 使用 
 = 2048。

**广义优势估计（GAE）。** Schulman 等人（2016）提出了对所有 n-步优势的指数加权平均：

A_t^{GAE} = Σ_{l=0}^{∞} (γλ)^l δ_{t+l}

其中 λ ∈ [0, 1]。λ = 0 是 TD（低方差，高偏差）。λ = 1 是 MC（高方差，无偏）。λ = 0.95 是 2026 年的默认值——调节直到偏差/方差旋钮到你想要的位置。

**A2C：同步优势 actor-critic。** 跨 N 个并行环境收集 T 步。为每一步计算优势。在合并的批次上更新演员和评论家。重复。A3C 的更简单、更可扩展的兄弟。

**A3C：异步优势 actor-critic。** Mnih 等人（2016）。生成 N 个工作线程，每个运行一个环境。每个工作线程在自己的 rollout 上本地计算梯度，然后异步地将其应用到共享的参数服务器。不需要回放缓冲区——工作线程通过运行不同的轨迹来去相关。A3C 证明了可以在 CPU 上大规模训练。在 2026 年，基于 GPU 的 A2C（批量并行环境）占据主导，因为 GPU 需要大批量。

**组合损失。**

L(θ, φ) = -E[ A_t · log π_θ(a_t | s_t) ]  +  c_v · E[(V_φ(s_t) - G_t)²]  -  c_e · E[H(π_θ(·|s_t))]

三项：策略梯度损失、价值回归、熵奖励。c_v ~ 0.5，c_e ~ 0.01 是标准起点。

## 动手构建

### 步骤 1：评论家

线性评论家 V_φ(s) = w · features(s)，用 MSE 更新：

`python
def critic_update(w, x, target, lr):
    v_hat = dot(w, x)
    err = target - v_hat
    for j in range(len(w)):
        w[j] += lr * err * x[j]
    return v_hat
`

在表格型环境中，评论家在几百个回合内收敛。在 Atari 上，将线性评论家替换为共享 CNN 主干 + 价值头。

### 步骤 2：n-步优势

给定长度为 T 的 rollout 和自助的最终 V(s_T)：

`python
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
`

eturns 是评论家目标。dvantages 是乘以 ∇ log π 的量。

### 步骤 3：组合更新

`python
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
`

同策略，每次更新一个 rollout，演员和评论家使用不同的学习率。

### 步骤 4：并行化（A3C vs A2C）

- **A3C：** 启动 N 个线程。每个运行自己的环境和自己的前向传播。定期将梯度更新推送到共享主节点。主节点不加锁——竞争是允许的，它们只是增加噪声。
- **A2C：** 在单个进程中运行 N 个环境实例，将观测堆叠成 [N, obs_dim] 批次，批量前向传播，批量反向传播。GPU 利用率更高，确定性更强，更容易推理。2026 年的默认选择。

我们的玩具代码为了清晰而使用单线程；重写为批量 A2C 只需要三行 numpy。

## 常见陷阱

- **演员梯度之前的评论家偏差。** 如果评论家是随机的，其基线不提供信息，你就是在纯噪声上训练。在开启策略梯度之前，预热评论家几百步，或使用慢速演员学习率。
- **优势归一化。** 将每个批次内的优势归一化为零均值/单位标准差。以接近零的成本大幅稳定训练。
- **共享主干。** 对于图像输入，为演员和评论家使用共享特征提取器。单独的头。共享特征同时受益于两个损失。
- **同策略约定。** A2C 的数据只重用一次。更多次重用会导致梯度偏差（重要性采样校正是 PPO 添加的）。
- **熵坍缩。** 没有 c_e > 0，策略会在几百次更新后变得近乎确定性并停止探索。
- **奖励尺度。** 优势幅度取决于奖励尺度。归一化奖励（例如，除以运行标准差）以使不同任务的梯度幅度一致。

## 使用场景

A2C/A3C 在 2026 年很少是最终选择，但它们是后续所有方法改进的架构：

| 方法 | 与 A2C 的关系 |
|--------|----------------|
| PPO | A2C + 用于多周期更新的裁剪重要性比率 |
| IMPALA | A3C + V-trace 离策略校正 |
| SAC（阶段 9 · 07） | 带软价值评论家的离策略 A2C（下一课） |
| GRPO（阶段 9 · 12） | 没有评论家的 A2C——组相对优势 |
| DPO | 坍缩为偏好排序损失的 A2C，无需采样 |
| AlphaStar / OpenAI Five | 带联赛训练 + 模仿预训练的 A2C |

如果你在 2026 年的论文中看到"优势"，就想到 actor-critic。

## 交付物

保存为 outputs/skill-actor-critic-trainer.md：

`markdown
---
name: actor-critic-trainer
description: 为给定环境生成 A2C / A3C / GAE 配置，指定优势估计和损失权重。
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, gae]
---

给定环境和计算预算，输出：

1. 并行方式。A2C（GPU 批量）vs A3C（CPU 异步）及工作线程数。
2. Rollout 长度 T。每次更新每个环境的步数。
3. 优势估计器。n-步或 GAE(λ)；指定 λ。
4. 损失权重。c_v（价值）、c_e（熵）、梯度裁剪。
5. 学习率。演员和评论家（如果使用分开的）。

拒绝在视野 > 1000 的环境上使用单工作线程 A2C（太同策略、太慢）。拒绝在没有优势归一化的情况下交付。标记任何 c_e = 0 且观察熵 < 0.1 的运行视为熵坍缩。
`

## 练习

1. **简单。** 在 4×4 GridWorld 上用 MC 优势（G_t - V(s_t)）训练 actor-critic。与课程 06 的带运行均值基线的 REINFORCE 比较样本效率。
2. **中等。** 切换到 TD 残差优势（ + γ V(s') - V(s)）。衡量优势批次的方差。下降了多少？
3. **困难。** 实现 GAE(λ)。扫描 λ ∈ {0, 0.5, 0.9, 0.95, 1.0}。绘制最终回报 vs 样本效率。在这个任务上偏差/方差的最佳点在哪里？

## 关键术语

| 术语 | 人们说的 | 实际意思 |
|------|-----------------|-----------------------|
| 演员 | "策略网络" | π_θ(a\|s)，通过策略梯度更新。 |
| 评论家 | "价值网络" | V_φ(s)，通过 MSE 回归到回报/TD 目标来更新。 |
| 优势 | "比平均好多少" | A(s, a) = Q(s, a) - V(s) 或其估计器。∇ log π 的乘数。 |
| TD 残差 | "δ" | δ_t = r + γ V(s') - V(s)；一步优势估计。 |
| GAE | "插值旋钮" | n-步优势的指数加权和，由 λ 参数化。 |
| A2C | "同步 actor-critic" | 跨环境批量处理；每次 rollout 一个梯度步骤。 |
| A3C | "异步 actor-critic" | 工作线程将梯度推送到共享参数服务器。原始论文；2026 年不太常见。 |
| 自助法 | "在视野处使用 V" | 截断 rollout，添加 γ^n V(s_{t+n}) 来闭合求和。 |

## 扩展阅读

- [Mnih et al. (2016). Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783) — A3C，原始的异步 actor-critic 论文。
- [Schulman et al. (2016). High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) — GAE。
- [Sutton & Barto (2018). Ch. 13 — Actor-Critic Methods](http://incompleteideas.net/book/RLbook2020.pdf) — 基础；当评论家是神经网络时，与第 9 章关于函数近似的内容配合阅读。
- [Espeholt et al. (2018). IMPALA](https://arxiv.org/abs/1802.01561) — 带 V-trace 离策略校正的可扩展分布式 actor-critic。
- [OpenAI Baselines / Stable-Baselines3](https://stable-baselines3.readthedocs.io/) — 值得阅读的生产级 A2C/PPO 实现。
- [Konda & Tsitsiklis (2000). Actor-Critic Algorithms](https://papers.nips.cc/paper/1786-actor-critic-algorithms) — 双时间尺度 actor-critic 分解的基础收敛结果。