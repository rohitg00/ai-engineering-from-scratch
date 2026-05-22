# 策略梯度（Policy Gradient）——从零实现REINFORCE

> 别再估计价值了。直接参数化策略，计算期望收益的梯度，然后沿梯度向上攀登。Williams（1992）用一个定理就讲清楚了。这就是PPO、GRPO以及所有LLM RL循环存在的原因。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段3·03（反向传播, Backpropagation），阶段9·03（蒙特卡洛, Monte Carlo），阶段9·04（时序差分学习, TD Learning）
**时长：** 约75分钟

## 问题

Q学习和DQN参数化的是*价值*函数。你通过`argmax Q`来选择动作。这对于离散动作和离散状态来说没问题。但当动作是连续的（对10维力矩做`argmax`？）或者你想要一个随机策略（`argmax`本质上就是确定性的）时，它就失效了。

策略梯度直接参数化的是*策略*。`π_θ(a | s)`是一个神经网络，它输出一个动作上的分布。从该分布中采样来执行动作。计算期望收益相对于`θ`的梯度。然后沿梯度向上攀登。没有`argmax`。没有贝尔曼递归。只需在`J(θ) = E_{π_θ}[G]`上做梯度上升。

REINFORCE定理（Williams 1992）告诉我们这个梯度是可计算的：`∇J(θ) = E_π[ G · ∇_θ log π_θ(a | s) ]`。运行一个回合（episode）。计算收益。在每一步将其乘以`∇ log π_θ(a | s)`。取平均。梯度上升。完成。

到2026年，每一个LLM-RL算法——PPO、DPO、GRPO——都是REINFORCE的改进版本。深入理解它是掌握本阶段剩余内容以及阶段10·07（RLHF实现）和阶段10·08（DPO）的前提。

## 概念

![策略梯度：softmax策略、对数π梯度、以收益加权的更新](../assets/policy-gradient.svg)

**策略梯度定理。** 对于由`θ`参数化的任意策略`π_θ`：

`∇J(θ) = E_{τ ~ π_θ}[ Σ_{t=0}^{T} G_t · ∇_θ log π_θ(a_t | s_t) ]`

其中`G_t = Σ_{k=t}^{T} γ^{k-t} r_{k+1}`是从时刻`t`开始的折扣收益。期望是对从`π_θ`采样的完整轨迹`τ`求取的。

**证明很短。** 在期望符号内对`J(θ) = Σ_τ P(τ; θ) G(τ)`求导。使用`∇P(τ; θ) = P(τ; θ) ∇ log P(τ; θ)`（对数导数技巧）。分解`log P(τ; θ) = Σ log π_θ(a_t | s_t) + 不依赖于θ的环境项`。环境项消失。两行代数推导即可得到该定理。

**方差降低技巧。** 原始REINFORCE的方差大得惊人——收益是有噪声的，`∇ log π`也是有噪声的，它们的乘积噪声更大。两个标准的修复方法：

1. **基线相减。** 对于任何不依赖于`a_t`的基线`b(s_t)`，用`G_t - b(s_t)`替换`G_t`。因为`E[b(s_t) · ∇ log π(a_t | s_t)] = 0`，所以该替换是无偏的。典型选择：通过学习一个评论家（critic）得到`b(s_t) = V̂(s_t)` → 即演员-评论家（Actor-Critic, 第07课）。
2. **仅使用未来收益（Reward-to-go）。** 将`Σ_t G_t · ∇ log π_θ(a_t | s_t)`替换为`Σ_t G_t^{from t} · ∇ log π_θ(a_t | s_t)`。对于给定的动作，只有未来的回报才重要——过去的奖励贡献的是零均值噪声。

两者结合，你得到：

`∇J ≈ (1/N) Σ_{i=1}^{N} Σ_{t=0}^{T_i} [ G_t^{(i)} - V̂(s_t^{(i)}) ] · ∇_θ log π_θ(a_t^{(i)} | s_t^{(i)})`

这就是带有基线的REINFORCE——A2C（第07课）和PPO（第08课）的直接祖先。

**Softmax策略参数化。** 对于离散动作，标准选择：

`π_θ(a | s) = exp(f_θ(s, a)) / Σ_{a'} exp(f_θ(s, a'))`

其中`f_θ`是输出每个动作得分的任意神经网络。梯度有一个简洁的形式：

`∇_θ log π_θ(a | s) = ∇_θ f_θ(s, a) - Σ_{a'} π_θ(a' | s) ∇_θ f_θ(s, a')`

即，已采取动作的得分减去其在策略下的期望值。

**用于连续动作的高斯策略。** `π_θ(a | s) = N(μ_θ(s), σ_θ(s))`。`∇ log N(a; μ, σ)`有闭式解。这正是阶段9·07中SAC所需要的一切。

## 构建它

### 第1步：softmax策略网络

```python
def policy_logits(theta, state_features):
    return [dot(theta[a], state_features) for a in range(N_ACTIONS)]

def softmax(logits):
    m = max(logits)
    exps = [exp(l - m) for l in logits]
    Z = sum(exps)
    return [e / Z for e in exps]
```

对表格环境使用线性策略（每个动作一个权重向量）。对于Atari，换成CNN并保留softmax输出层。

### 第2步：采样和对数概率

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

### 第3步：记录对数概率的轨迹采样

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

### 第4步：REINFORCE更新

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

梯度`∇ log π(a|s) = e_a - π(·|s)`（`a`的one-hot向量减去概率）是softmax策略梯度的核心。把它刻进肌肉记忆里。

### 第5步：基线

将近期回合中`G`的运行均值作为基线，足以使4×4格子世界运行起来；大约需要500个回合收敛。将基线升级为学习得到的`V̂(s)`，你就得到了演员-评论家算法。

## 常见陷阱

- **梯度爆炸。** 收益可能很大。总是在将`G`乘以`∇ log π`之前，对整个批次将其归一化为`~N(0, 1)`。
- **熵坍塌。** 策略过早地收敛到近似确定性动作，停止探索，陷入困境。修复方法：在目标函数中添加熵奖励`β · H(π(·|s))`。
- **高方差。** 原始REINFORCE需要数千个回合。使用评论家基线（第07课）或TRPO/PPO的信任区域（第08课）是标准修复方法。
- **样本效率低。** 同策略（On-policy）意味着每次更新后你都会丢弃所有转换。通过重要性采样的离策略（Off-policy）修正可以复用数据，但代价是方差增加（PPO的比值就是经裁剪的IS权重）。
- **非平稳梯度。** 100个回合之前的梯度使用的是旧的策略。出于这个原因，同策略方法每隔几次轨迹采样就会做一次更新。
- **信用分配。** 如果不使用仅未来收益（reward-to-go），过去的奖励会贡献噪声。总是使用仅未来收益。

## 应用

在2026年，REINFORCE很少被直接运行，但其梯度公式无处不在：

| 用例 | 衍生方法 |
|----------|---------------|
| 连续控制 | 基于高斯策略的PPO / SAC |
| LLM RLHF | 带KL惩罚的PPO，在token级策略上运行 |
| LLM推理（DeepSeek） | GRPO——使用组相对基线、无评论家的REINFORCE |
| 多智能体 | 集中式评论家REINFORCE（MADDPG, COMA） |
| 离散动作机器人 | A2C, A3C, PPO |
| 仅偏好设置 | DPO——将REINFORCE重写为偏好似然损失，无需采样 |

当你在2026年的训练脚本中看到`loss = -advantage * log_prob`时，那就是带有基线的REINFORCE。整篇论文（DPO, GRPO, RLOO）都是在这一行之上的方差降低技巧。

## 交付它

保存为`outputs/skill-policy-gradient-trainer.md`：

```markdown
---
name: policy-gradient-trainer
description: 为给定任务生成REINFORCE / 演员-评论家 / PPO训练配置，并诊断方差问题。
version: 1.0.0
phase: 9
lesson: 6
tags: [rl, policy-gradient, reinforce]
---

给定一个环境（离散/连续动作、时间范围、奖励统计信息），输出：

1. 策略输出层。Softmax（离散）或高斯（连续），附带参数数量。
2. 基线。无（原始）、运行均值、学习得到的`V̂(s)`或A2C评论家。
3. 方差控制。默认启用仅未来收益（reward-to-go）、收益归一化、梯度裁剪值。
4. 熵奖励。系数β及其衰减计划。
5. 批次大小。每次更新的回合数；同策略数据新鲜度契约。

对于时间范围>500步的环境，拒绝使用无基线的REINFORCE。对于连续动作控制，拒绝使用softmax输出层。如果观察到策略熵<0.1且`β=0`，则标记为熵坍塌。
```

## 练习

1. **简单。** 在4×4格子世界上使用线性softmax策略实现REINFORCE。不加基线训练1000个回合。绘制学习曲线；测量方差（收益的标准差）。
2. **中等。** 添加运行均值基线。再次训练。将样本效率和方差与原始运行进行比较。基线将收敛步数减少了多少？
3. **困难。** 添加熵奖励`β · H(π)`。扫描`β ∈ {0, 0.01, 0.1, 1.0}`。绘制最终收益和策略熵。在此任务上，最佳点在哪里？

## 关键术语

| 术语 | 人们通常说的 | 实际含义 |
|------|-----------------|-----------------------|
| 策略梯度（Policy gradient） | “直接训练策略” | `∇J(θ) = E[G · ∇ log π_θ(a|s)]`；由对数导数（log-derivative）技巧推导而来。 |
| REINFORCE | “原始策略梯度算法” | Williams（1992）；蒙特卡洛收益乘以对数策略梯度。 |
| 对数导数技巧（Log-derivative trick） | “得分函数估计器” | `∇P(τ;θ) = P(τ;θ) · ∇ log P(τ;θ)`；使期望的梯度变得可处理。 |
| 基线（Baseline） | “方差降低” | 任何从`G`中减去的`b(s)`；因为`E[b · ∇ log π] = 0`所以无偏。 |
| 仅未来收益（Reward-to-go） | “只看未来的回报” | 用`G_t^{from t}`代替完整的`G_0`；正确且方差更低。 |
| 熵奖励（Entropy bonus） | “鼓励探索” | 添加`+β · H(π(·|s))`项防止策略坍塌。 |
| 同策略（On-policy） | “用刚看到的数据训练” | 梯度期望是关于当前策略的——不能直接重用旧数据。 |
| 优势（Advantage） | “比平均水平好多少” | `A(s, a) = G(s, a) - V(s)`；带基线REINFORCE所乘的有符号量。 |

## 延伸阅读

- [Williams (1992). Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning](https://link.springer.com/article/10.1007/BF00992696) — 原始REINFORCE论文。
- [Sutton et al. (2000). Policy Gradient Methods for Reinforcement Learning with Function Approximation](https://papers.nips.cc/paper_files/paper/1999/hash/464d828b85b0bed98e80ade0a5c43b0f-Abstract.html) — 带有函数逼近的现代策略梯度定理。
- [Sutton & Barto (2018). 第13章——策略梯度方法](http://incompleteideas.net/book/RLbook2020.pdf) — 教科书式讲解。
- [OpenAI Spinning Up — VPG / REINFORCE](https://spinningup.openai.com/en/latest/algorithms/vpg.html) — 清晰的启蒙式阐述，附带PyTorch代码。
- [Peters & Schaal (2008). Reinforcement Learning of Motor Skills with Policy Gradients](https://homes.cs.washington.edu/~todorov/courses/amath579/reading/PolicyGradient.pdf) — 方差降低以及将REINFORCE与信任区域家族（TRPO, PPO）联系起来的自然梯度观点。