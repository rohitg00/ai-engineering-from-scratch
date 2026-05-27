# 蒙特卡洛方法——从完整回合中学习

> 动态规划需要一个模型。蒙特卡洛方法只需要回合。运行策略，观察回报，取平均值。这是强化学习中最简单的想法——也是解锁一切后续方法的关键。

**类型：** 构建  
**语言：** Python  
**先修要求：** 阶段9 · 01（MDP），阶段9 · 02（动态规划）  
**时长：** 约75分钟

## 问题

动态规划很优雅，但它假设你可以查询每个状态和动作的 `P(s' | s, a)`。现实世界中几乎没有东西是这样工作的。一个机器人无法解析计算施加关节力矩后相机像素的分布。一个定价算法无法对所有可能的客户反应进行积分。一个LLM无法枚举一个token之后所有可能的延续。

你需要一种方法，它只需要能够从环境中*采样*。运行策略。获取一条轨迹 `s_0, a_0, r_1, s_1, a_1, r_2, …, s_T`。用它来估计价值。这就是蒙特卡洛。

从DP到MC的转变在哲学上很重要：我们从*已知模型 + 精确备份* 转向 *采样 rollout + 平均回报*。方差会激增，但适用性会爆炸性增长。本课之后的所有强化学习算法——TD、Q-learning、REINFORCE、PPO、GRPO——本质上都是蒙特卡洛估计器，有时会叠加自举（Bootstrapping）。

## 概念

![蒙特卡洛：rollout，计算回报，取平均；首次访问 vs 每次访问](../assets/monte-carlo.svg)

**核心思想，一句话：** `V^π(s) = E_π[G_t | s_t = s] ≈ (1/N) Σ_i G^{(i)}(s)`，其中 `G^{(i)}(s)` 是在策略 `π` 下访问状态 `s` 后观察到的回报。

**首次访问（First-visit）vs 每次访问（Every-visit）MC。** 给定一个多次访问状态 `s` 的回合，首次访问MC只计算第一次访问的回报；每次访问MC则计算所有访问的回报。两者在极限情况下都是无偏的。首次访问更容易分析（独立同分布样本）。每次访问在每个回合中使用更多数据，在实践中通常收敛更快。

**增量平均值。** 不必存储所有回报，而是更新运行平均值：

`V_n(s) = V_{n-1}(s) + (1/n) [G_n - V_{n-1}(s)]`

重组：`V_new = V_old + α · (target - V_old)`，其中 `α = 1/n`。将 `1/n` 替换为常数步长 `α ∈ (0, 1)`，你就得到了一个非平稳MC估计器，它能够跟踪 `π` 的变化。这一步就是从MC到TD再到所有现代强化学习算法的整个跳跃。

**探索现在成了一个问题。** DP通过枚举触及了每一个状态。MC只看到策略访问的状态。如果 `π` 是确定性的，那么状态空间的整个区域永远不会被采样，其价值估计将永远保持为零。按历史顺序有三种解决方法：

1. **探索性起点（Exploring starts）。** 每个回合从一个随机的 (s, a) 对开始。保证覆盖；但实践中不现实（你无法将一个机器人“重置”到任意状态）。
2. **ε-贪心（ε-greedy）。** 相对于当前Q采取贪心动作，但有概率 `ε` 选择一个随机动作。所有状态-动作对渐近地都能被采样到。
3. **离策略（Off-policy）MC。** 在行为策略 `μ` 下收集数据，通过重要性采样（Importance Sampling）学习目标策略 `π`。方差较高，但这是通向DQN等回放缓冲区方法的桥梁。

**蒙特卡洛控制（Monte Carlo Control）。** 评估 → 改进 → 评估，就像策略迭代一样，但评估是基于采样的：

1. 运行 `π`，获得一个回合。
2. 根据观察到的回报更新 `Q(s, a)`。
3. 使 `π` 相对于 `Q` 成为ε-贪心策略。
4. 重复。

在温和条件下（每个 (s, a) 对无限频繁访问，`α` 满足Robbins-Monro条件），以概率1收敛到 `Q*` 和 `π*`。

## 构建它

### 第一步：rollout → (s, a, r) 列表

```python
def rollout(env, policy, max_steps=200):
    """rollout函数，生成轨迹"""
    trajectory = []  # 轨迹列表
    s = env.reset()  # 重置环境
    for _ in range(max_steps):
        a = policy(s)  # 根据策略选择动作
        s_next, r, done = env.step(s, a)  # 执行一步
        trajectory.append((s, a, r))  # 记录状态、动作、奖励
        s = s_next
        if done:
            break
    return trajectory
```

没有模型，只有 `env.reset()` 和 `env.step(s, a)`。与gym环境接口相同，但更精简。

### 第二步：计算回报（反向扫描）

```python
def returns_from(trajectory, gamma):
    """从轨迹计算回报"""
    returns = []  # 回报列表
    G = 0.0
    for _, _, r in reversed(trajectory):  # 反向遍历
        G = r + gamma * G  # 累积折扣回报
        returns.append(G)  # 添加回报
    return list(reversed(returns))  # 反转回正确顺序
```

一次遍历，复杂度 `O(T)`。反向递推 `G_t = r_{t+1} + γ G_{t+1}` 避免了重新求和。

### 第三步：首次访问MC评估

```python
def mc_policy_evaluation(env, policy, episodes, gamma=0.99):
    """首次访问蒙特卡洛策略评估"""
    V = defaultdict(float)  # 状态价值字典
    counts = defaultdict(int)  # 访问次数字典
    for _ in range(episodes):
        trajectory = rollout(env, policy)  # 生成轨迹
        returns = returns_from(trajectory, gamma)  # 计算回报
        seen = set()  # 记录已访问状态
        for t, ((s, _, _), G) in enumerate(zip(trajectory, returns)):
            if s in seen:  # 如果已访问过，跳过
                continue
            seen.add(s)  # 标记为已访问
            counts[s] += 1  # 访问次数加1
            V[s] += (G - V[s]) / counts[s]  # 增量更新均值
    return V
```

三行代码完成工作：首次访问时标记状态，增加计数，更新运行均值。

### 第四步：ε-贪心MC控制（同策略）

```python
def mc_control(env, episodes, gamma=0.99, epsilon=0.1):
    """ε-贪心蒙特卡洛控制"""
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})  # Q表
    counts = defaultdict(lambda: {a: 0 for a in ACTIONS})  # 动作计数

    def policy(s):
        """ε-贪心策略"""
        if random() < epsilon:
            return choice(ACTIONS)  # 随机探索
        return max(Q[s], key=Q[s].get)  # 贪心选择

    for _ in range(episodes):
        trajectory = rollout(env, policy)  # 生成轨迹
        returns = returns_from(trajectory, gamma)  # 计算回报
        seen = set()  # 记录已访问的(s,a)对
        for (s, a, _), G in zip(trajectory, returns):
            if (s, a) in seen:  # 首次访问检查
                continue
            seen.add((s, a))
            counts[s][a] += 1
            Q[s][a] += (G - Q[s][a]) / counts[s][a]  # 增量更新Q值
    return Q, policy
```

### 第五步：与DP黄金标准比较

你的 `V^π` 的MC估计值应与第2课中的DP结果在回合数→∞时一致。实际中：在4×4 GridWorld上运行50,000个回合，结果与DP答案相差约 `~0.1`。

## 陷阱

- **无限回合。** MC要求回合*终止*。如果你的策略可能无限循环，设置 `max_steps` 上限，并将上限视为隐式失败。使用随机策略的GridWorld经常超时——这很正常，只要确保正确计数即可。
- **方差。** MC使用完整回报。在长回合中，方差巨大——一个不幸的奖励在结尾会同样程度地改变 `V(s_0)`。TD方法（第4课）通过自举来削减这种影响。
- **状态覆盖。** 在全新的Q上使用贪心MC，如果存在平局，只会尝试一个动作。你*必须*探索（ε-贪心、探索性起点、UCB）。
- **非平稳策略。** 如果 `π` 发生变化（如MC控制中），旧的回报来自不同的策略。常数α MC可以处理这种情况；样本平均MC则不行。
- **离策略重要性采样。** 权重 `π(a|s)/μ(a|s)` 在轨迹中相乘。方差随步长爆炸。使用逐决策加权重要性采样（per-decision weighted IS）或切换到TD。

## 使用场景

2026年蒙特卡洛方法的作用：

| 使用场景 | 为什么用MC |
|----------|------------|
| 短视界游戏（二十一点、扑克） | 回合自然终止；回报干净。 |
| 离线评估已记录的策略 | 对存储的轨迹计算平均折扣回报。 |
| 蒙特卡洛树搜索（AlphaZero） | 从树叶节点进行MC rollout指导选择。 |
| LLM强化学习评估 | 对给定策略的采样完成序列计算平均奖励。 |
| PPO中的基线估计 | 优势目标 `A_t = G_t - V(s_t)` 使用MC `G_t`。 |
| 强化学习教学 | 最简单且实际可行的算法——去掉自举以看清核心。 |

现代深度强化学习算法（PPO、SAC）通过 `n`-步回报或GAE在纯MC（完整回报）和纯TD（单步自举）之间进行插值。两个端点都是同一估计器的实例。

## 交付

保存为 `outputs/skill-mc-evaluator.md`：

```markdown
---
name: mc-evaluator
description: 通过蒙特卡洛rollout评估策略，并生成包含DP对比的收敛报告（如果可用）。
version: 1.0.0
phase: 9
lesson: 3
tags: [rl, monte-carlo, evaluation]
---

给定一个环境（回合制，具有reset+step API）和一个策略，输出：

1. 方法。首次访问 vs 每次访问MC。说明原因。
2. 回合预算。目标数量、方差诊断、预期标准误差。
3. 探索计划。ε调度（如果需要）或探索性起点。
4. 黄金标准对比。如果表格型，则使用DP最优V*；否则使用Q-learning/PPO基线的界。
5. 终止检查。最大步长上限、超时、对非终止轨迹的处理。

拒绝在非回合制任务上运行MC（除非有有限视界上限）。对于表格型任务，当每个状态的回合数少于100时，拒绝报告V^π估计值。将任何具有零方差动作的策略标记为探索风险。
```

## 练习

1. **简单。** 在4×4 GridWorld上实现均匀随机策略的首次访问MC评估。运行10,000个回合。绘制 `V(0,0)` 随回合数变化的曲线，并与DP答案对比。
2. **中等。** 实现ε-贪心MC控制，其中 `ε ∈ {0.01, 0.1, 0.3}`。比较20,000个回合后的平均回报。曲线是什么样子？偏差-方差权衡在哪里？
3. **困难。** 使用重要性采样实现*离策略*MC：在均匀随机策略 `μ` 下收集数据，估计确定性最优策略 `π` 的 `V^π`。比较普通IS、逐决策IS和加权IS。哪一种方差最低？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| 蒙特卡洛（Monte Carlo） | "随机采样" | 通过对来自分布的独立同分布样本取平均来估计期望。 |
| 回报 `G_t` | "未来奖励" | 从步骤 `t` 到回合结束的折扣奖励之和：`Σ_{k≥0} γ^k r_{t+k+1}`。 |
| 首次访问MC（First-visit MC） | "每个状态只计数一次" | 只有回合中的第一次访问贡献于价值估计。 |
| 每次访问MC（Every-visit MC） | "使用所有访问" | 每次访问都贡献；略有偏差但样本效率更高。 |
| ε-贪心（ε-greedy） | "探索噪声" | 以概率 `1-ε` 选择贪心动作；以概率 `ε` 选择随机动作。 |
| 重要性采样（Importance Sampling） | "纠正从错误分布采样" | 通过 `π(a|s)/μ(a|s)` 乘积对回报重新加权，以从 `μ` 数据估计 `V^π`。 |
| 同策略（On-policy） | "从自己的数据学习" | 目标策略 = 行为策略。原始MC、PPO、SARSA。 |
| 离策略（Off-policy） | "从别人的数据学习" | 