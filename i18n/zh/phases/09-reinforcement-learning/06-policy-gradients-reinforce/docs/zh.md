# 政策渐进 从零开始加强

> 停止估值.直接参数化政策,计算预期回报的梯度,上升步骤.威廉姆斯 (1992) 在一个定理中写下.这就是为什么PPO,GRPO和每一个LLM RL循环都存在.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 03 (Monte Carlo), Phase 9 · 04 (TD Learning)
**Time:** ~75 minutes

## 问题

通过Q-学习和DQN来参数 *值*函数.`argmax Q`它们是对单独的操作和单独的状态来说很好的.`argmax`对于10维扭矩而言,`argmax`根据结构的决定性性.

政策梯度则为"政策"设定参数.$\pi_\theta(a \mid s)$根据数据的数据,一个数据的分布在一个数据的分布中.$\theta$走上山坡.`argmax`没有贝尔曼复发,只是梯度上升.$J(\theta) = \mathbb E_{\pi_\theta}[G]$现在,我们要去.

强化定理 (威廉姆斯 1992) 告诉你,这个梯度是可计算的:$\nabla J(\theta) = \mathbb E_\pi[ G \cdot \nabla_\theta \log \pi_\theta(a \mid s) ]$运行一个集,计算返回,乘以$\nabla \log \pi_\theta(a \mid s)$平均水平,梯度上升,完成.

对于2026年每一个LLM-RL算法都是REINFORCE的完善.

## 概念

![Policy gradient: softmax policy, log-π gradient, return-weighted update](../assets/policy-gradient.svg)

**The policy gradient theorem.**任何政策$\pi_\theta$参数为$\theta$其他:

```math
\nabla J(\theta) = \mathbb{E}_{\tau \sim \pi_\theta}[ \sum_{t=0}^{T} G_t \cdot \nabla_\theta \log \pi_\theta(a_t \mid s_t) ]
```

在哪里$G_t = \sum_{k=t}^{T} \gamma^{k-t} r_{k+1}$是从步骤的折扣回报$t$预期已经超过了完整的轨迹$\tau$采集了$\pi_\theta$现在,我们要去.

**The proof is short.**区分$J(\theta) = \sum_\tau P(\tau; \theta) G(\tau)$使用 $\nabla P(\tau; \theta) = P(\tau; \theta) \nabla \log P(\tau; \theta)$原因是,我们在这个过程中,$\log P(\tau; \theta) = \sum \log \pi_\theta(a_t \mid s_t) + \text{environment terms that do not depend on } \theta$两个代数线给出了定理.

**Variance reduction tricks.**尼拉强化学品具有凶残的变化 回报很,$\nabla \log \pi$它们的产品非常杂.

1. **Baseline subtraction.**取代$G_t$随着$G_t - b(s_t)$对于任何基线$b(s_t)$这不取决于$a_t$公正,因为$\mathbb{E}[b(s_t) \cdot \nabla \log \pi(a_t \mid s_t)] = 0$典型的选择:$b(s_t) = \hat{V}(s_t)$经过评论家 →演员-评论家的学习 (课程07).
2. **Reward-to-go.**取代$\sum_t G_t \cdot \nabla \log \pi_\theta(a_t \mid s_t)$随着$\sum_t G_t^{\text{from } t} \cdot \nabla \log \pi_\theta(a_t \mid s_t)$只有未来的回报对特定行动而言是重要的过去的回报贡献零平均噪音.

结合起来,你得到:

```math
\nabla J \approx (1/N) \sum_{i=1}^{N} \sum_{t=0}^{T_i} [ G_t^{(i)} - \hat{V}(s_t^{(i)}) ] \cdot \nabla_\theta \log \pi_\theta(a_t^{(i)} \mid s_t^{(i)})
```

是A2C (课07),PPO (课08的直接祖先) 的基线.

**Softmax policy parameterization.**对于单独行动,标准选择:

```math
\pi_\theta(a \mid s) = \exp(f_\theta(s, a)) / \sum_{a'} \exp(f_\theta(s, a'))
```

在哪里$f_\theta$任何神经网络都能输出每次操作的分数.

```math
\nabla_\theta \log \pi_\theta(a \mid s) = \nabla_\theta f_\theta(s, a) - \sum_{a'} \pi_\theta(a' \mid s) \nabla_\theta f_\theta(s, a')
```

投资者: 投资者: 投资者: 投资者: 投资者:

**Gaussian policy for continuous actions.** $\pi_\theta(a \mid s) = N(\mu_\theta(s), \sigma_\theta(s))$现在,我们要去.$\nabla \log N(a; \mu, \sigma)$只有9期07期的SAC需要.

```figure
policy-gradient-landscape
```

## 建立它

### 步骤1:软max政策网络

```python
def policy_logits(theta, state_features):
    return [dot(theta[a], state_features) for a in range(N_ACTIONS)]

def softmax(logits):
    m = max(logits)
    exps = [exp(l - m) for l in logits]
    Z = sum(exps)
    return [e / Z for e in exps]
```

对于图表包装,使用线性政策 (每动作一个权重向量).对于Atari,切换在CNN中并保持软max头.

### 步骤2:采样和记录概率

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

### 步骤3: 随着记录探测器的捕获,部署

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

### 步骤4: 更新 REINFORCE

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

梯度$\nabla \log \pi(a \mid s) = e_a - \pi(\cdot \mid s)$(其中一个是$a$软max的核心是软max的政策梯度.

### 步骤5:基线

运行的平均值$G$为了使4×4 GridWorld运行,需要500个集集集.$\hat{V}(s)$你会得到演员评论.

## 陷

- **Exploding gradients.**总是正常化.$G$为了`~N(0, 1)`在乘以之前,$\nabla \log \pi$现在,我们要去.
- **Entropy collapse.**政策过早收缩到近定决策行动,停止探索,陷入困境.$\beta \cdot H(\pi(\cdot \mid s))$实现目标.
- **High variance.**尼拉 REINFORCE需要数千个集. 标准解决方案是批评基线 (课时07),或TRPO/PPO的信任区域 (课时08).
- **Sample inefficiency.**政策上意味着你在一次更新后都会丢弃每一个过渡.通过重要样本取样,在变化成本下,通过政策外的纠正将数据恢复 (PPO的比例是减小 IS重量).
- **Non-stationary gradients.**百集前的梯度使用旧的$\pi$政策方法每次更新都是因为这个原因.
- **Credit assignment.**没有奖励,过去的奖励会产生噪音.

## 用它

在2026年,REINFORCE很少直接运行,但其梯度公式在各处:

| Use case | Derived method |
|----------|---------------|
| Continuous control | PPO / SAC with Gaussian policy |
| LLM RLHF | PPO with KL penalty, running on token-level policy |
| LLM reasoning (DeepSeek) | GRPO — REINFORCE with group-relative baseline, no critic |
| Multi-agent | Centralized-critic REINFORCE (MADDPG, COMA) |
| Discrete action robotics | A2C, A3C, PPO |
| Preference-only settings | DPO — REINFORCE rewritten as a preference-likelihood loss, no sampling |

当你读的时候`loss = -advantage * log_prob`整个论文 (DPO,GRPO,RLOO) 是此一行之上的一些变化降低技巧.

## 运送它

保存如`outputs/skill-policy-gradient-trainer.md`其他:

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

## 运动

1. **Easy.**运用4×4 GridWorld上 REINFORCE 进行直线软max 政策. 训练1000集没有基线. 绘制学习曲线;测量变异 (回报的STD).
2. **Medium.**加入运行平均基线. 再次训练. 比较样本效率和变异与尼拉运行.
3. **Hard.**添加一个体奖金$\beta \cdot H(\pi)$扫描$\beta \in \lbrace 0, 0.01, 0.1, 1.0 \rbrace$关于这个任务的甜点点是什么?

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Policy gradient | "Train the policy directly" | $\nabla J(\theta) = \mathbb{E}[G \cdot \nabla \log \pi_\theta(a \mid s)]$; derived from the log-derivative trick. |
| REINFORCE | "The original PG algorithm" | Williams (1992); Monte Carlo returns multiplied by log-policy gradient. |
| Log-derivative trick | "Score function estimator" | $\nabla P(\tau;\theta) = P(\tau;\theta) \cdot \nabla \log P(\tau;\theta)$; makes gradients of expectations tractable. |
| Baseline | "Variance reduction" | Any $b(s)$ subtracted from $G$; unbiased because $\mathbb{E}[b \cdot \nabla \log \pi] = 0$. |
| Reward-to-go | "Only future returns count" | $G_t^{\text{from } t}$ instead of the full $G_0$; correct and lower-variance. |
| Entropy bonus | "Encourage exploration" | $+\beta \cdot H(\pi(\cdot \mid s))$ term keeps the policy from collapsing. |
| On-policy | "Train on what you just saw" | Gradient expectation is w.r.t. the current policy — cannot reuse old data directly. |
| Advantage | "How much better than average" | $A(s, a) = G(s, a) - V(s)$; the signed quantity REINFORCE-with-baseline multiplies. |

## 进一步阅读

- [Williams (1992). Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning](https://link.springer.com/article/10.1007/BF00992696)原始的 REINFORCE 文件.
- [Sutton et al. (2000). Policy Gradient Methods for Reinforcement Learning with Function Approximation](https://papers.nips.cc/paper_files/paper/1999/hash/464d828b85b0bed98e80ade0a5c43b0f-Abstract.html)现代政策渐变定理与函数近似.
- [Sutton & Barto (2018). Ch. 13 — Policy Gradient Methods](http://incompleteideas.net/book/RLbook2020.pdf) 教科书的演示.
- [OpenAI Spinning Up — VPG / REINFORCE](https://spinningup.openai.com/en/latest/algorithms/vpg.html)使用 PyTorch 代码的明确教学说明.
- [Peters & Schaal (2008). Reinforcement Learning of Motor Skills with Policy Gradients](https://homes.cs.washington.edu/~todorov/courses/amath579/reading/PolicyGradient.pdf) 变化减少和自然梯度视图,将REINFORCE与信托区域家族 (TRPO,PPO) 联系起来.
