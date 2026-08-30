# 游戏中的强化学习

> 2016 年：AlphaGo 击败李世石。2017 年：AlphaZero 掌握围棋、国际象棋、将棋。2019 年：AlphaStar 达到星际争霸 II 大师级。2024 年：DeepSeek 的 GRPO 在数学推理上击败了 PPO。游戏 AI 推动了 RL 的边界，从树搜索到自对弈再到推理优化。

**类型：** 构建
**语言：** Python
**前置知识：** 第九阶段 · 08（PPO），第九阶段 · 10（多智能体 RL）
**时间：** ~90 分钟

## 问题

游戏是 RL 的理想测试平台：
- 规则明确，奖励清晰（赢/输）。
- 状态空间巨大（围棋：10^170，星际争霸：10^1685）。
- 需要长期规划（围棋：200+ 步，Dota：45 分钟）。
- 涉及不完美信息（扑克、星际争霸的雾战争）。
- 需要实时决策（每秒数十个动作）。

但游戏 RL 也引入了独特的挑战：
- **巨大的分支因子：** 围棋每步 ~250 个动作，国际象棋 ~35，星际争霸 ~10^26。
- **稀疏奖励：** 只有在游戏结束时才有奖励。
- **非平稳对手：** 对手也在学习和适应。
- **信用分配：** 哪个动作导致了胜利？

## 概念

![游戏 RL：MCTS + 神经网络、自对弈、联盟训练](../assets/rl-for-games.svg)

### 蒙特卡洛树搜索（MCTS）

MCTS 是围棋和国际象棋中规划的标准算法。它构建一个搜索树，通过模拟来评估位置：

1. **选择：** 使用 UCT（上限置信树）选择动作：
   `UCT(s, a) = Q(s, a) + c · sqrt(log N(s) / N(s, a))`
   其中 `Q(s, a)` 是平均价值，`N(s)` 是访问次数，`c` 是探索常数。

2. **扩展：** 添加新节点到树。

3. **模拟：** 从扩展的节点运行随机 rollout（或使用策略网络）。

4. **反向传播：** 更新路径上所有节点的统计信息。

AlphaGo 用神经网络（策略 + 价值）替代了随机 rollout，使 MCTS 强大了数个数量级。

### AlphaZero / MuZero

**AlphaZero（Silver 等人，2017）：** 没有人类数据，没有人类特征。只通过自对弈学习：
- 策略网络 `p(s)`：建议动作。
- 价值网络 `v(s)`：评估位置。
- MCTS 使用 `p` 和 `v` 来指导搜索。
- 从 MCTS 搜索中生成训练目标（改进的策略和值）。

**MuZero（Schrittwieser 等人，2020）：** AlphaZero 的扩展，不需要游戏规则。它学习一个*模型*：
- 表示函数 `h`：将观察映射到隐藏状态。
- 动态函数 `g`：预测下一个隐藏状态和奖励。
- 预测函数 `f`：从隐藏状态输出策略和价值。

MuZero 可以玩任何游戏，包括那些没有已知规则的游戏（例如，Atari）。

### 自对弈与联盟训练

**自对弈：** 智能体与过去的自己训练。这是 AlphaGo/AlphaZero 的核心。挑战：可能收敛到循环或局部最优。

**联盟训练（Vinyals 等人，2019）：** AlphaStar 使用的方法：
- **主要智能体：** 与整个联盟训练。
- **剥削者：** 专门击败主要智能体，暴露弱点。
- **学习者：** 探索新策略。

这防止了策略崩溃到单一风格，并鼓励稳健性。

### 过程奖励模型（PRM）与验证器奖励

对于推理任务（数学、代码），最终答案的稀疏奖励是不够的。PRM 为中间步骤提供奖励：

- **验证器奖励：** 训练一个模型来验证中间步骤的正确性。
- **过程奖励模型（PRM）：** 为每个推理步骤分配奖励，而不仅仅是最终结果。

这是 OpenAI 的 o1/o3 和 DeepSeek-R1 的核心：训练模型进行"思考"，通过为正确的推理链提供密集奖励。

### GRPO

DeepSeek 的组相对策略优化（GRPO）是 PPO 的变体，专为 LLM 推理设计：
- 没有价值网络（节省内存）。
- 对同一问题的多个响应进行采样。
- 使用组内相对奖励作为基线。
- 特别适合数学和代码任务。

`A_i = (r_i - mean(r_group)) / std(r_group)`

## 构建

### 第一步：MCTS 实现

```python
class MCTSNode:
    def __init__(self, state, parent=None, action=None):
        self.state = state
        self.parent = parent
        self.action = action
        self.children = {}
        self.visits = 0
        self.value = 0.0
        self.prior = 0.0
    
    def uct_score(self, c_puct=1.0):
        if self.visits == 0:
            return float('inf')
        return self.value / self.visits + c_puct * self.prior * sqrt(self.parent.visits) / (1 + self.visits)

def mcts_search(root, network, num_simulations):
    for _ in range(num_simulations):
        node = root
        # 选择
        while node.children and not node.is_terminal:
            node = max(node.children.values(), key=lambda n: n.uct_score())
        
        # 扩展
        if not node.is_terminal:
            for action, prob in network.policy(node.state):
                child = MCTSNode(node.state.next(action), node, action)
                child.prior = prob
                node.children[action] = child
            node = random.choice(list(node.children.values()))
        
        # 评估
        value = network.value(node.state)
        
        # 反向传播
        while node:
            node.visits += 1
            node.value += value
            node = node.parent
    
    # 返回访问次数的分布作为改进的策略
    return {a: n.visits / root.visits for a, n in root.children.items()}
```

### 第二步：AlphaZero 训练循环

```python
def alphazero_train(game, network, num_iterations):
    replay_buffer = []
    
    for iteration in range(num_iterations):
        # 自对弈
        trajectory = []
        state = game.reset()
        while not game.is_terminal(state):
            # MCTS 搜索
            root = MCTSNode(state)
            policy = mcts_search(root, network, num_simulations=800)
            
            # 采样动作（带温度）
            action = sample_action(policy, temperature=1.0 if len(trajectory) < 30 else 0.0)
            
            trajectory.append((state, policy))
            state = game.step(state, action)
        
        # 计算最终奖励
        reward = game.reward(state)
        
        # 添加到回放缓冲区
        for state, policy in trajectory:
            replay_buffer.append((state, policy, reward))
        
        # 训练网络
        batch = sample(replay_buffer, batch_size)
        for state, target_policy, target_value in batch:
            pred_policy, pred_value = network(state)
            loss = cross_entropy(pred_policy, target_policy) + (pred_value - target_value) ** 2
            network.update(loss)
```

### 第三步：GRPO（简化版）

```python
def grpo_update(policy, questions, num_samples_per_question, beta):
    for question in questions:
        # 对同一问题采样多个响应
        responses = [policy.generate(question) for _ in range(num_samples_per_question)]
        
        # 获取奖励（例如，来自验证器）
        rewards = [verifier(r) for r in responses]
        
        # 计算组相对优势
        mean_r = sum(rewards) / len(rewards)
        std_r = (sum((r - mean_r) ** 2 for r in rewards) / len(rewards)) ** 0.5
        advantages = [(r - mean_r) / (std_r + 1e-8) for r in rewards]
        
        # 策略梯度更新（类似 PPO，但没有价值网络）
        for response, advantage in zip(responses, advantages):
            log_prob = policy.log_prob(question, response)
            loss = -advantage * log_prob + beta * kl_divergence(policy, ref_policy)
            policy.update(loss)
```

## 陷阱

- **搜索深度。** MCTS 的模拟次数必须足够（AlphaGo：1600；AlphaZero：800）。太少 → 策略质量差。
- **温度退火。** 早期训练使用高温度（探索），后期使用低温度（利用）。AlphaZero 在前 30 步使用 `τ=1`，之后 `τ→0`。
- **自对弈循环。** 可能收敛到局部最优或循环。使用联盟训练或多样化对手池。
- **计算成本。** AlphaZero 需要数千个 TPU 小时。对于小规模实验，使用更小的网络、更少的模拟。
- **验证器质量。** PRM 和验证器奖励的质量决定了推理性能。糟糕的验证器会奖励错误的推理链。

## 应用

| 系统 | 游戏 | 方法 | 说明 |
|------|------|------|------|
| AlphaGo | 围棋 | MCTS + 深度网络 + 自对弈 | 击败李世石。 |
| AlphaZero | 围棋/国际象棋/将棋 | 无人类数据，纯自对弈 | 掌握所有三个游戏。 |
| AlphaStar | 星际争霸 II | 联盟训练 + Transformer | 大师级。 |
| OpenAI Five | Dota 2 | PPO + 自对弈 | 击败世界冠军。 |
| MuZero | Atari / 棋类游戏 | 学习模型 + MCTS | 无需规则。 |
| DeepSeek-R1 | 数学/代码 | GRPO + PRM | 推理优化。 |

## 交付

保存为 `outputs/skill-game-rl-trainer.md`：

```markdown
---
name: game-rl-trainer
description: 为游戏 AI 生成训练配置，包括 MCTS、自对弈、联盟训练和推理优化。
version: 1.0.0
phase: 9
lesson: 12
tags: [rl, game-ai, mcts, alphazero, grpo]
---

给定一个游戏（完美/不完美信息、状态空间、动作空间、奖励结构），输出：

1. 算法。MCTS（完美信息）、PPO（实时）、AlphaZero（棋类）、GRPO（推理）。
2. 网络。策略网络架构、价值网络架构、表示网络（MuZero）。
3. 搜索。MCTS 模拟次数、UCT 常数、温度时间表。
4. 训练。自对弈、联盟训练、对手池大小。
5. 推理优化。PRM、验证器奖励、过程监督。

拒绝在没有搜索的情况下将 MCTS 用于完美信息游戏。拒绝在实时游戏中使用纯 MCTS（太慢）。标记任何验证器准确率 < 80% 的推理任务为不可靠。
```

## 练习

1. **简单。** 实现一个简化版 MCTS 用于井字棋。与随机对手对战。胜率是多少？
2. **中等。** 实现 AlphaZero 风格的自对弈用于 Connect Four。训练一个小型网络（2 层 CNN）。与 MCTS-only 基线比较。
3. **困难。** 实现 GRPO 用于一个简单的数学推理任务（例如，两位数加法）。使用验证器奖励。比较与标准 PPO 的样本效率。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| MCTS | "树搜索" | 蒙特卡洛树搜索；通过模拟评估动作。 |
| UCT | "平衡探索和利用" | `Q + c·sqrt(log N / n)`；选择要扩展的节点。 |
| AlphaZero | "无人类数据" | 只通过自对弈和 MCTS 学习。 |
| MuZero | "无需规则" | 学习内部模型，用于任何游戏。 |
| 自对弈 | "与自己训练" | 智能体与过去的自己对战。 |
| 联盟训练 | "多样化对手" | 维护策略联盟以防止崩溃。 |
| PRM | "过程奖励" | 为中间推理步骤提供奖励。 |
| GRPO | "无价值网络的 PPO" | 使用组相对基线；用于 LLM 推理。 |

## 延伸阅读

- [Silver et al. (2016). Mastering the game of Go with deep neural networks and tree search](https://www.nature.com/articles/nature16961) — AlphaGo 论文。
- [Silver et al. (2017). Mastering Chess and Shogi by Self-Play](https://arxiv.org/abs/1712.01815) — AlphaZero 论文。
- [Schrittwieser et al. (2020). Mastering Atari, Go, Chess and Shogi by Planning with a Learned Model](https://www.nature.com/articles/s41586-020-03051-4) — MuZero 论文。
- [Vinyals et al. (2019). Grandmaster level in StarCraft II](https://www.nature.com/articles/s41586-019-1724-z) — AlphaStar 论文。
- [DeepSeek-AI (2024). DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948) — GRPO 和推理优化。
