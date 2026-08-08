# 多智能体强化学习

> 2017 年：OpenAI 在 Dota 2 中击败了顶级玩家。2019 年：DeepMind 的 AlphaStar 在星际争霸 II 中达到了大师级。两者都使用多智能体 RL。核心挑战：其他智能体也是学习者——环境从任何单个智能体的角度来看是非平稳的。

**类型：** 构建
**语言：** Python
**前置知识：** 第九阶段 · 08（PPO），第九阶段 · 09（Actor-Critic）
**时间：** ~75 分钟

## 问题

单智能体 RL 假设环境是马尔可夫的且平稳的。在多智能体设置中，其他智能体也是学习者。当你更新你的策略时，其他智能体的行为发生变化，使环境对你来说是*非平稳的*。Q-learning 的收敛证明假设平稳性——它们在这里不成立。

此外：
- **信用分配：** 哪个智能体对团队奖励负责？
- **探索协调：** 智能体可能探索相同的区域或干扰彼此。
- **可扩展性：** 智能体数量增加时，联合动作空间指数增长。

多智能体 RL（MARL）处理这些问题。它是自动驾驶、机器人团队、游戏 AI 和分布式系统的核心。

## 概念

![MARL：多个智能体共享环境，每个智能体有自己的策略，可能通信或竞争](../assets/multi-agent-rl.svg)

### 马尔可夫博弈

将 MDP 扩展到多个智能体。一个马尔可夫博弈是 `(S, {A_i}, P, {R_i}, γ)`：
- `S`：状态空间。
- `A_i`：智能体 `i` 的动作空间。
- `P(s' | s, a_1, ..., a_n)`：转移函数，取决于所有动作。
- `R_i(s, a_1, ..., a_n)`：智能体 `i` 的奖励。
- `γ`：折扣因子。

如果所有智能体共享相同的奖励（`R_i = R`），这是*完全合作*的。如果奖励之和为零（`Σ R_i = 0`），这是*零和*的。混合设置是*一般和*的。

### 非平稳性

从智能体 `i` 的角度来看，其他智能体的策略 `π_{-i}` 是环境的一部分。当其他智能体学习时，`π_{-i}` 变化，使环境非平稳。标准 RL 算法（Q-learning、PPO）假设平稳性，可能发散。

修复方法：
1. **自对弈：** 所有智能体使用相同的策略。环境对自己是对称的。
2. **CTDE（集中式训练，分布式执行）：** 训练时使用全局信息，执行时只使用局部观察。
3. **经验回放修改：** 只使用最近的转移，或按重要性加权。

### CTDE 方法

**MADDPG（Lowe 等人，2017）。** 每个智能体有一个 actor（局部观察）和一个集中式 critic（全局状态 + 所有动作）。critic 在训练时访问全局信息，actor 在执行时只使用局部观察。

**COMA（Foerster 等人，2018）。** 反事实多智能体策略梯度。使用反事实基线："如果智能体 `i` 采取动作 `a` 而其他人不变，奖励会如何变化？" 这解决了信用分配问题。

**MAPPO（Yu 等人，2021）。** PPO 的多智能体扩展。所有智能体共享一个集中式价值函数。在实践中，MAPPO 经常优于 MADDPG。

**QMIX（Rashid 等人，2018）。** 用于合作任务的值分解。学习一个联合动作-价值函数 `Q_tot`，它是每个智能体的 `Q_i` 的单调组合。这允许分布式执行（每个智能体选择 `argmax Q_i`），同时保持集中式训练。

### 通信

智能体可以学习通信：
- **CommNet（Sukhbaatar 等人，2016）：** 智能体通过可微的通信通道交换连续向量。
- **TarMAC（Das 等人，2019）：** 注意力机制选择通信对象。
- **RIAL / DIAL（Foerster 等人，2016）：** 学习离散通信协议。

### 自对弈与联盟训练

**自对弈：** 智能体与过去的自己训练。用于 AlphaGo、OpenAI Dota。

**联盟训练（Vinyals 等人，2019）：** 维护一个策略联盟（"主要智能体"、"剥削者"、"学习者"）。主要智能体与联盟训练以变得稳健。剥削者专门击败主要智能体，暴露弱点。这防止了策略崩溃到单一风格。

## 构建

### 第一步：多智能体环境

```python
class MultiAgentEnv:
    def reset(self):
        return [obs_1, obs_2, ..., obs_n]
    
    def step(self, actions):
        # actions = [a_1, a_2, ..., a_n]
        next_state = self.transition(state, actions)
        rewards = [r_1, r_2, ..., r_n]
        dones = [done_1, ..., done_n]
        return [obs_1, ..., obs_n], rewards, dones
```

### 第二步：MADDPG 风格的 CTDE

```python
class MADDPGActor:
    def __init__(self, obs_dim, action_dim):
        self.policy = MLP(obs_dim, action_dim)
    
    def act(self, obs):
        return self.policy(obs)

class MADDPGCritic:
    def __init__(self, state_dim, total_action_dim):
        self.q = MLP(state_dim + total_action_dim, 1)
    
    def evaluate(self, state, all_actions):
        return self.q(concat(state, all_actions))
```

### 第三步：MAPPO 更新

```python
def mappo_update(actors, critic, batch, epsilon, lr):
    # 集中式价值函数
    global_states = [t.global_state for t in batch]
    values = critic(global_states)
    
    for i, actor in enumerate(actors):
        # 每个智能体的局部观察
        obs_i = [t.obs[i] for t in batch]
        actions_i = [t.actions[i] for t in batch]
        
        # 使用全局优势（来自集中式 critic）
        advantages = compute_gae(batch, critic, gamma, lam)
        
        # PPO 更新（与单智能体相同，但使用全局优势）
        ppo_update(actor, obs_i, actions_i, advantages, epsilon, lr)
```

### 第四步：自对弈

```python
def self_play_train(agent, env, num_iterations):
    opponents = [copy(agent.policy)]  # 过去的自己
    
    for iteration in range(num_iterations):
        # 随机选择对手
        opponent = random.choice(opponents)
        
        # 收集经验
        trajectory = collect_trajectory(env, agent.policy, opponent)
        
        # 更新
        update(agent, trajectory)
        
        # 定期保存策略
        if iteration % save_every == 0:
            opponents.append(copy(agent.policy))
```

## 陷阱

- **非平稳性。** 始终使用 CTDE 或自对弈。朴素的独立 Q-learning 在多智能体设置中会发散。
- **信用分配。** 在合作任务中，使用反事实基线（COMA）或值分解（QMIX）。
- **可扩展性。** 智能体数量 > 4 时，联合动作空间变得难以处理。使用均值场近似或注意力机制。
- **通信开销。** 学习到的通信可能不可解释。在关键系统中，使用预定义的通信协议。
- **联盟维护。** 自对弈可能收敛到循环（石头-剪刀-布）。联盟训练通过维护多样化的对手池来解决这个问题。

## 应用

| 领域 | 方法 | 说明 |
|------|------|------|
| 自动驾驶 | CTDE（MADDPG/MAPPO） | 车辆合作避免碰撞。 |
| 机器人团队 | QMIX / MAPPO | 仓库机器人协调。 |
| 游戏 AI | 自对弈 / 联盟训练 | AlphaStar、OpenAI Five。 |
| 分布式系统 | 多智能体 Q-learning | 资源分配、负载均衡。 |
| 经济学 | 一般和博弈 | 市场模拟、拍卖设计。 |

## 交付

保存为 `outputs/skill-multi-agent-trainer.md`：

```markdown
---
name: multi-agent-trainer
description: 为多智能体任务生成 MARL 训练配置，包括 CTDE、通信和自对弈设置。
version: 1.0.0
phase: 9
lesson: 10
tags: [rl, multi-agent, marl, ctde]
---

给定一个多智能体环境（智能体数量、观察空间、动作空间、奖励结构），输出：

1. 架构。CTDE（MADDPG/MAPPO）或独立学习者。
2. 信用分配。COMA 反事实基线、QMIX 值分解或全局奖励。
3. 通信。是否学习通信、通信维度、协议类型。
4. 训练。自对弈、联盟训练或固定对手。
5. 可扩展性。均值场近似、注意力机制或分组。

拒绝在超过 4 个智能体的合作任务上使用独立 Q-learning。拒绝没有信用分配机制的全局奖励任务。
```

## 练习

1. **简单。** 实现一个 2 智能体合作 GridWorld。比较独立 Q-learning 与 CTDE（集中式 critic）。
2. **中等。** 实现自对弈在石头-剪刀-布上。策略是否收敛到纳什均衡（均匀随机）？
3. **困难。** 实现 MAPPO 在 3 智能体合作任务上。比较有无通信学习的性能。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| MARL | "多智能体 RL" | 多个学习者共享环境。 |
| CTDE | "集中式训练，分布式执行" | 训练时使用全局信息，执行时只使用局部观察。 |
| 非平稳性 | "其他智能体也在学习" | 环境从单个智能体的角度来看随时间变化。 |
| 信用分配 | "谁做得好" | 将团队奖励归因于单个智能体的贡献。 |
| 自对弈 | "与自己训练" | 智能体与过去的自己对抗。 |
| 联盟训练 | "多样化对手" | 维护一个策略联盟以防止崩溃。 |
| QMIX | "值分解" | 联合 Q 函数是每个智能体 Q 的单调组合。 |

## 延伸阅读

- [Lowe et al. (2017). Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments](https://arxiv.org/abs/1706.02275) — MADDPG 论文。
- [Rashid et al. (2018). QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485) — QMIX 论文。
- [Foerster et al. (2018). Counterfactual Multi-Agent Policy Gradients](https://arxiv.org/abs/1705.08926) — COMA 论文。
- [Vinyals et al. (2019). Grandmaster level in StarCraft II using multi-agent reinforcement learning](https://www.nature.com/articles/s41586-019-1724-z) — AlphaStar 论文。
- [Yu et al. (2021). The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games](https://arxiv.org/abs/2103.01955) — MAPPO 论文。
