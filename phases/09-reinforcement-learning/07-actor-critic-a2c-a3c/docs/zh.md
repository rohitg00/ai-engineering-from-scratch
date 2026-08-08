# Actor-Critic —— A2C、A3C 和优势估计

> 策略梯度（演员）在回报方差下挣扎。价值函数（评论家）学习期望回报，并从回报中减去它，将方差降低一个数量级。A2C 是同步的。A3C 是异步的。两者在 2016 年都击败了 Atari 基准。

**类型：** 构建
**语言：** Python
**前置知识：** 第九阶段 · 06（REINFORCE、策略梯度）
**时间：** ~75 分钟

## 问题

REINFORCE 使用完整的蒙特卡洛回报 `G_t` 作为优势估计。`G_t` 的方差随视界增长——10 步的方差是 1 步的 10 倍。在 200 步的 Atari 回合上，方差是灾难性的。训练曲线看起来像布朗运动。

Actor-critic 用一个学习的价值函数 `V(s; w)` 替换 `G_t`。优势变为 `A(s, a) = G_t - V(s_t)`。`V(s; w)` 是 TD 目标——低方差、自举的。方差降低是戏剧性的：在 Atari 上，A3C 在几小时内达到人类水平，而 REINFORCE 需要几天或永远。

A2C（Mnih 等人，2016）同步运行多个工作者，等待全部完成，然后在一个批次上更新。A3C（Mnih 等人，2016）异步运行它们——每个工作者独立更新共享网络。A3C 更花哨；A2C 更简单且同样好。两者都是 PPO（第 08 课）的前身，PPO 保留了 actor-critic 结构但用信任域替换了朴素的梯度上升。

## 概念

![Actor-Critic：演员（策略）采样动作，评论家（价值）估计优势，两者通过共享特征或独立网络更新](../assets/actor-critic.svg)

**优势函数。** `A^π(s, a) = Q^π(s, a) - V^π(s)`。直观地说："在这个状态下，这个动作比平均好多少？" 优势是策略梯度相乘的有符号量：

`∇J(θ) = E_π[ A^π(s, a) · ∇_θ log π_θ(a | s) ]`

**为什么优势有效。** 用 `A = G - V` 替换 `G`：

- 如果 `G` 是*高*于 `V(s)` 的，优势为正 → 向上推动作概率。
- 如果 `G` 是*低*于 `V(s)` 的，优势为负 → 向下推动作概率。
- `V(s)` 是*状态*的基线——它依赖于 `s` 但不依赖于 `a`。无偏因为 `E[V(s) · ∇ log π(a|s)] = 0`。

**n 步优势。** 纯 TD（1 步）偏差高，方差低。纯蒙特卡洛（完整 `G_t`）偏差低，方差高。折中：

`A^{(n)}(s_t, a_t) = Σ_{k=0}^{n-1} γ^k r_{t+k+1} + γ^n V(s_{t+n}) - V(s_t)`

`n` = 1 是 TD 残差。`n` = `T` 是蒙特卡洛。`n` = 5 在 Atari 上是一个甜点。

**广义优势估计（GAE）。** Schulman（2016）平滑了 n 步折中：

`A^{GAE}(s_t, a_t) = Σ_{l=0}^{∞} (γλ)^l δ_{t+l}`

其中 `δ_t = r_{t+1} + γ V(s_{t+1}) - V(s_t)` 是 TD 残差。`λ = 0` → TD(0)。`λ = 1` → 蒙特卡洛。`λ = 0.95` 是 PPO 的标准。GAE 将 n 步折中从离散选择变成连续旋钮。

**A2C 算法。** 同步。运行 `N` 个工作者 `T` 步。收集 `N·T` 个转移。计算回报和优势。在一个批次上更新 actor 和 critic。重复。

**A3C 算法。** 异步。每个工作者运行一个回合，计算梯度，推送到共享网络。没有锁；梯度更新是原子的。 Hogwild! 风格。理论上优雅；实践中 A2C 更简单且收敛相同。

**损失函数。** A2C 最小化两个损失之和：

`L = L_actor + c1 · L_critic - c2 · L_entropy`

- `L_actor = - E[ A(s,a) · log π_θ(a|s) ]` —— 策略梯度。
- `L_critic = E[ (G - V(s; w))² ]` —— TD 均方误差。
- `L_entropy = E[ H(π_θ(·|s)) ]` —— 鼓励探索。

`c1`（critic 系数）≈ 0.5。`c2`（熵系数）≈ 0.01。

## 构建

### 第一步：共享特征提取器

```python
def features(state, W_f):
    h = [max(0.0, dot(w, state) + b) for w, b in W_f]
    return h
```

对 Atari，这是 CNN。对 GridWorld，一个单隐藏层 MLP 就够了。`h` 被送入 actor 头和 critic 头。

### 第二步：Actor 和 Critic 头

```python
def actor_logits(h, W_a):
    return [dot(w, h) + b for w, b in W_a]

def critic_value(h, W_c):
    return dot(W_c[0], h) + W_c[1]
```

Actor 输出每个动作分数 → softmax → 策略。Critic 输出标量 `V(s)`。

### 第三步：A2C 更新

```python
def a2c_update(shared_params, batch, gamma, n_steps, lr_actor, lr_critic, c1, c2):
    actor_grads = zeros_like(shared_params.actor)
    critic_grads = zeros_like(shared_params.critic)
    for trajectory in batch:
        returns = compute_n_step_returns(trajectory, gamma, n_steps)
        for (s, a, r, s_next, done), G in zip(trajectory, returns):
            h = features(s, shared_params.features)
            V_s = critic_value(h, shared_params.critic)
            advantage = G - V_s
            # Actor gradient
            logits = actor_logits(h, shared_params.actor)
            probs = softmax(logits)
            grad_log = [-p for p in probs]
            grad_log[a] += 1.0
            for i in range(N_ACTIONS):
                for j in range(len(h)):
                    actor_grads[i][j] += lr_actor * advantage * grad_log[i] * h[j]
            # Critic gradient
            td_error = G - V_s
            for j in range(len(h)):
                critic_grads[0][j] += lr_critic * td_error * h[j]
            critic_grads[1] += lr_critic * td_error
    apply_sgd(shared_params, actor_grads, critic_grads)
```

关键：actor 和 critic 共享特征。这强制策略和价值对齐——如果 critic 看到某些东西，actor 也看到它。

### 第四步：多工作者（A2C）

```python
def a2c_train(env_fns, shared_params, num_workers, steps_per_worker, total_updates):
    workers = [env_fns[i]() for i in range(num_workers)]
    for update in range(total_updates):
        batch = []
        for worker in workers:
            trajectory = []
            s = worker.reset()
            for _ in range(steps_per_worker):
                h = features(s, shared_params.features)
                logits = actor_logits(h, shared_params.actor)
                a = sample_action(softmax(logits))
                s_next, r, done = worker.step(a)
                trajectory.append((s, a, r, s_next, done))
                s = s_next if not done else worker.reset()
            batch.append(trajectory)
        a2c_update(shared_params, batch, gamma, n_steps, lr_actor, lr_critic, c1, c2)
```

`num_workers` = 16 是 Atari 的标准。`steps_per_worker` = 5（5 步回报）。每个更新处理 `16 × 5 = 80` 个转移。

## 陷阱

- **Critic 过拟合。** 如果 `c1` 太大，critic 主导梯度。如果太小，价值估计差，优势噪声。从 `c1 = 0.5` 开始。
- **优势归一化。** 在小批量上减去均值并除以标准差。这稳定了梯度幅度，不引入偏差。
- **特征共享。** 如果 actor 和 critic 不共享特征，critic 可能学习 actor 看不到的特征，使优势无意义。始终共享至少一层。
- **n 步目标。** `n` 太大 → 高方差。`n` 太小 → 高偏差。Atari 上 `n = 5` 是标准。长视界任务上 `n = 20`。
- **熵衰减。** 早期高熵鼓励探索。后期低熵让策略收敛。衰减时间表：`β_t = β_0 · α^t`。不要让它降到零。
- **工作者去相关。** 每个工作者必须有独立的随机种子。否则它们看到相同的转移，批量没有方差。

## 应用

A2C/A3C 是 2016 年最先进的。在 2026 年，它们被 PPO（第 08 课）取代用于在线策略 RL，但结构——actor + critic + 优势估计——是普遍的：

| 系统 | Actor | Critic | 优势类型 |
|---------|-------|--------|-------------|
| PPO（第 08 课） | 策略网络 | 价值网络 | GAE(λ) |
| SAC（第 09 课） | 策略网络 | 两个 Q 网络 | 无（离线策略 Q） |
| TD3（第 09 课） | 确定性策略 | 两个 Q 网络 | 无 |
| AlphaGo / AlphaZero | 策略网络 | 价值网络 | MCTS 返回 |
| LLM RLHF（第 10 课） | LLM 策略 | 奖励模型 | PPO 优势 |
| GRPO（第 12 课） | LLM 策略 | 无（组基线） | 组相对优势 |

A2C 的教训：始终使用优势，始终共享特征，始终归一化优势。

## 交付

保存为 `outputs/skill-actor-critic-trainer.md`：

```markdown
---
name: actor-critic-trainer
description: 为离散或连续动作 RL 生成 A2C / A3C / PPO 训练配置，指定优势估计和工作者设置。
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, a2c, a3c]
---

给定一个环境（动作空间、视界、奖励统计），输出：

1. 网络。共享特征层深度、actor 头（softmax / 高斯）、critic 头（标量）。
2. 优势估计。n 步（n）或 GAE（λ、γ）。默认 GAE(λ=0.95, γ=0.99)。
3. 工作者设置。工作者数量、每工作者步数、总批量大小。
4. 损失权重。c1（critic 系数）、c2（熵系数）、梯度裁剪值。
5. 学习率。Actor LR、Critic LR（通常相同或 critic 稍高）。

拒绝没有共享特征的 actor-critic。拒绝 `c1 = 0`（没有 critic）。拒绝 `λ > 1` 或 `λ < 0` 的 GAE。标记任何工作者数量 < 4 的设置，因为批量方差会很高。
```

## 练习

1. **简单。** 在 4×4 GridWorld 上实现 A2C，有 4 个工作者、5 步回报、共享特征。训练 1,000 更新。绘制每工作者回报。
2. **中等。** 比较 n 步优势（n=1, 5, 20）与 GAE（λ=0, 0.5, 0.95, 1.0）。哪个收敛最快？哪个方差最低？
3. **困难。** 实现 A3C：每个工作者独立计算梯度并原子地推送到共享网络。与同步 A2C 比较样本效率和稳定性。A3C 的异步更新是否引入显著的梯度冲突？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Actor | "策略网络" | 采样动作的网络；通过策略梯度更新。 |
| Critic | "价值网络" | 估计 `V(s)` 的网络；通过 TD 误差更新。 |
| 优势 | "比平均好多少" | `A(s,a) = Q(s,a) - V(s)`；策略梯度相乘的有符号量。 |
| A2C | "同步 actor-critic" | 等待所有工作者，然后在一个批次上更新。 |
| A3C | "异步 actor-critic" | 工作者独立更新共享网络；Hogwild! 风格。 |
| n 步回报 | "折中 TD-MC" | `Σ_{k=0}^{n-1} γ^k r_{t+k+1} + γ^n V(s_{t+n})`。 |
| GAE | "平滑的 n 步" | `Σ (γλ)^l δ_{t+l}`；连续折中 TD 和 MC。 |
| 熵奖励 | "探索正则化" | `+β · H(π)` 项；防止过早收敛。 |

## 延伸阅读

- [Mnih et al. (2016). Asynchronous Methods for Deep RL](https://arxiv.org/abs/1602.01783) — A3C 论文；A2C 在附录中描述。
- [Schulman et al. (2016). High-Dimensional Continuous Control Using GAE](https://arxiv.org/abs/1506.02438) — GAE 论文。
- [OpenAI Spinning Up — A2C / A3C](https://spinningup.openai.com/en/latest/algorithms/a2c.html) — 教学阐述。
- [Sutton & Barto (2018). Ch. 13 — Actor-Critic Methods](http://incompleteideas.net/book/RLbook2020.pdf) — 教科书处理。
