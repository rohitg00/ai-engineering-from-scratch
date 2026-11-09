# 演员评论家 A2C和A3C

> 强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强加强$\hat{V}(s)$现在,我们可以看到一个值,从 A2C 运行它同步,A3C 运行它在线程.这两个是每个现代深度RL方法的心理模型.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (TD Learning), Phase 9 · 06 (REINFORCE)
**Time:** ~75 minutes

## 问题

尼拉反弹力有效,但它的变化是可怕的.$G_t$通过数量增加,我们可以在节目之间摆动10倍.$\nabla \log \pi$平均化产生了梯度估计器,需要数千个集,

如果减去基线,则将其从原始返回中取出.$b(s_t)$任何状态函数,包括学习值 预期保持不变,变异下降.最好的可处理的基线是$\hat{V}(s_t)$现在数量乘以$\nabla \log \pi$是*优势*:

```math
A(s, a) = G - \hat{V}(s)
```

作为一个高于平均水平的收益,一个低于平均水平的收益是好的. 作为一个熟练的批评者,反复强化是*演员批评者*.批评者给演员一个低变量教师.这是2015年后的每一个深度政策方法 (A2C,A3C,PPO,SAC,IMPALA).

## 概念

![Actor-critic: policy net plus value net, TD residual as advantage](../assets/actor-critic.svg)

**Two networks, one shared loss:**

- **Actor** $\pi_\theta(a \mid s)$经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训,经过培训.
- **Critic** $V_\phi(s)$预计来自国家的回报.$(V_\phi(s) - \text{target})^2$现在,我们要去.

**The advantage.**两种标准表格:

- 果公司的优势$A_t = G_t - V_\phi(s_t)$无偏见,更高的差异性.
- 果的优势$A_t = r_{t+1} + \gamma V_\phi(s_{t+1}) - V_\phi(s_t)$偏见性 (使用)$V_\phi$),更低的变量.$\delta_t$现在,我们要去.

**n-step advantage.**两者之间进行间接:

```math
A_t^{(n)} = r_{t+1} + \gamma r_{t+2} + \ldots + \gamma^{n-1} r_{t+n} + \gamma^n V_\phi(s_{t+n}) - V_\phi(s_t)
```

$n = 1$纯粹的TD.$n = \infty$许多应用程序使用$n = 5$对于阿塔利,$n = 2048$对于 MuJoCo的PPO.

**Generalized Advantage Estimation (GAE).**舒尔曼等人 (2016) 提出了对所有 n 步骤优势的指数权重平均值:

```math
A_t^{\text{GAE}} = \sum_{l=0}^{\infty} (\gamma \lambda)^l \delta_{t+l}
```

随着$\lambda \in [0, 1]$现在,我们要去.$\lambda = 0$是TD (低差异,高偏差). $\lambda = 1$是MC (高差异性,无偏见性).$\lambda = 0.95$是2026年默认调调,直到偏差/变量拨号是你想要的.

**A2C: synchronous advantage actor-critic.**收集$T$跨越的步骤$N$通过平行环境计算每个步骤的优势 更新演员和评论家的组合. 重复. 简单,更可扩展的A3C兄弟.

**A3C: asynchronous advantage actor-critic.**其他研究人员$N$工作者线程,每个操作一个环境.每个操作员在自己的推广上本地计算梯度,然后异步地将其应用到共享参数服务器上. 没有重复缓冲器需要. 工作者通过运行不同的轨迹来解关联. A3C证明你可以在规模上训练CPU. 在2026年,基于GPU的A2C (批量并行环境) 主导,因为GPU想要大批量.

**The combined loss.**

```math
L(\theta, \phi) = -\mathbb{E}[ A_t \cdot \log \pi_\theta(a_t \mid s_t) ] + c_v \cdot \mathbb{E}[(V_\phi(s_t) - G_t)^2] - c_e \cdot \mathbb{E}[H(\pi_\theta(\cdot \mid s_t))]
```

政策渐进损失,价值回归,值奖金.`c_v ~ 0.5`现在`c_e ~ 0.01`它们是神圣的起点.

```figure
actor-critic
```

## 建立它

### 步骤1:一个批评者

线性评论家$V_\phi(s) = w \cdot \text{features}(s)$更新与MSE:

```python
def critic_update(w, x, target, lr):
    v_hat = dot(w, x)
    err = target - v_hat
    for j in range(len(w)):
        w[j] += lr * err * x[j]
    return v_hat
```

在图表环境中,评论家在几百集中融合.在阿塔利上,用共享的CNN库 +值头取代线性评论家.

### 步骤2:n-步骤优势

考虑到长度的推广$T$起的决赛$V(s_T)$其他:

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

`returns`对于这些问题,我们必须要做出一些决定.`advantages`它们是什么乘法$\nabla \log \pi$现在,我们要去.

### 步骤3: 综合更新

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

政策上,每次发布一次, 演员和评论家的学习率分开.

### 步骤4:并行 (A3C与A2C)

- **A3C:**转动起来$N$它们是个""的,它们是""的,它们是""的,它们是""的,它们是""的.
- **A2C:**跑步$N$集观察到一个过程中的实例`[N, obs_dim]`批量前进,批量后退,高GPU使用率,确定性,更容易推理.

我们的玩具代码是单线的,以便更清晰; 重写成批量A2C是三行的无线.

## 陷

- **Critic bias before actor gradient.**如果评论家是随机的,它的基线是非信息性的,你正在训练纯粹的噪音. 在启动政策梯度之前,加热评论家几百步,或者使用缓慢的演员学习率.
- **Advantage normalization.**实现每批次平均零/单位/STd的优势.
- **Shared trunk.**通过使用共享功能提取器,在影像输入中使用演员和评论家. 分开头.共享功能在两种输入中自由行.
- **On-policy contract.**更多的数据,你的梯度偏差 (重要样本纠正是PPO添加的).
- **Entropy collapse.**没有$c_e > 0$几百次更新后,政策就会变得近乎决定性,
- **Reward scale.**优势大小取决于奖励规模. 规范奖励 (例如,运行-std 分类) 对于不同任务的一致梯度大小.

## 用它

它们是后来的建筑物,

| Method | Relation to A2C |
|--------|----------------|
| PPO | A2C + clipped importance ratio for multi-epoch updates |
| IMPALA | A3C + V-trace off-policy correction |
| SAC (Phase 9 · 07) | Off-policy A2C with a soft-value critic (next lesson) |
| GRPO (Phase 9 · 12) | A2C without the critic — group-relative advantage |
| DPO | A2C collapsed into a preference-ranking loss, no sampling |
| AlphaStar / OpenAI Five | A2C with league training + imitation pre-training |

如果在2026年的一篇论文中看到"优势",

## 运送它

保存如`outputs/skill-actor-critic-trainer.md`其他:

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

## 运动

1. **Easy.**训练演员-批评者,具有MC优势$(G_t - V(s_t))$根据第06课,对样本效率进行反复强化与运行平均基线的比较.
2. **Medium.**转向 TD残余优势$(r + \gamma V(s') - V(s))$测量优势分组的差异.
3. **Hard.**执行GAE () 扫描$\lambda \in \lbrace 0, 0.5, 0.9, 0.95, 1.0 \rbrace$图案最终回报与样本效率. 这个任务的偏差/变异点是什么?

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Actor | "The policy net" | $\pi_\theta(a \mid s)$, updated by policy gradient. |
| Critic | "The value net" | $V_\phi(s)$, updated by MSE regression to returns / TD targets. |
| Advantage | "How much better than average" | $A(s, a) = Q(s, a) - V(s)$ or its estimators. Multiplier for $\nabla \log \pi$. |
| TD residual | "δ" | $\delta_t = r + \gamma V(s') - V(s)$; one-step advantage estimate. |
| GAE | "The interpolation knob" | Exponentially weighted sum of n-step advantages, parameterized by $\lambda$. |
| A2C | "Synchronous actor-critic" | Batched across envs; one gradient step per rollout. |
| A3C | "Async actor-critic" | Worker threads push gradients to a shared param server. Original paper; less common in 2026. |
| Bootstrap | "Use V at the horizon" | Truncate the rollout, add $\gamma^n V(s_{t+n})$ to close the sum. |

## 进一步阅读

- [Mnih et al. (2016). Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783)A3C,原始的异步演员评论论文.
- [Schulman et al. (2016). High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) 
- [Sutton & Barto (2018). Ch. 13 — Actor-Critic Methods](http://incompleteideas.net/book/RLbook2020.pdf)基础;与第9章关于函数近似的结合,当批评者是神经网络.
- [Espeholt et al. (2018). IMPALA](https://arxiv.org/abs/1802.01561)可扩展的分布式演员批评,可通过V-trace的政策外纠正.
- [OpenAI Baselines / Stable-Baselines3](https://stable-baselines3.readthedocs.io/)生产A2C/PPO的实施值得阅读.
- [Konda & Tsitsiklis (2000). Actor-Critic Algorithms](https://papers.nips.cc/paper/1786-actor-critic-algorithms)对两次度的演员-批评分解的基本融合结果.
