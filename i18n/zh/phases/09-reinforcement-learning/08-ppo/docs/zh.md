# 接近政策优化 (PPO)

> 根据APP的数据,PPO将政策梯度缩小到一个重要的比例,以便在不爆发的政策的情况下,您可以在同一数据上进行10+个时代.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~75 minutes

## 问题

向 (课07),是政策的$\mathbb E_{\pi_\theta}[A \cdot \nabla \log \pi_\theta]$需要从*流量*中采集的数据$\pi_\theta$接下来,我们要做一个更新,$\pi_\theta$您使用的数据现在是非政策的. 再利用它,你的偏差偏差.

在Atari上,一个8个Envs × 128 步骤的推出 = 1024 个转型和十几秒钟的环境时间.在一个梯度步骤后抛弃它是浪费的.

首先,我们必须限制每次更新,$\delta$理论上是清洁的,但每次更新需要一个结合分数解决.

根据PPO (Schulman et al. 2017) 的规定,硬信任区域的限制被简单的剪切目标所取代.一个额外的代码线.每次推出的十个时代.没有结合梯度.足够的理论保障.九年后,它仍然是从MuJoCo到RLHF的默认政策梯度算法.

## 概念

![PPO clipped surrogate objective: ratio clipping at 1 ± ε](../assets/ppo.svg)

**The importance ratio.**

```math
r_t(\theta) = \frac{\pi_\theta(a_t \mid s_t)}{\pi_{\theta_{\text{old}}}(a_t \mid s_t)}
```

这就是新政策与收集数据的政策的概率比率. $r_t = 1$没有变化.$r_t = 2$这意味着新政策的可能性是两倍$a_t$像以前一样.

**The clipped surrogate.**

```math
L^{\text{CLIP}}(\theta) = \mathbb{E}_t \left[ \min\left( r_t(\theta) A_t, \mathop{\mathrm{clip}}(r_t(\theta), 1-\epsilon, 1+\epsilon) A_t \right) \right]
```

两条条条款:

- 如果优势$A_t > 0$现在,这个比例试图扩大.$1 + \epsilon$不推出一个好的行动更远$+\epsilon$超过了旧的可能性.
- 如果优势$A_t < 0$它们的比例试图下降到以下.$1 - \epsilon$片平坦化梯度:不要推出一个坏行动$-\epsilon$现在,我们在这个问题上,

其他`min`处理另一方向:如果比率移动到*有益*方向,你仍然得到梯度 (没有侧面剪辑会伤害你).

典型的$\epsilon = 0.2$绘制目标作为函数$r_t$部分直线功能,"好面"有一个平面的屋顶,"坏面"一个平面的地板.

**The full PPO loss.**

```math
L(\theta, \phi) = L^{\text{CLIP}}(\theta) - c_v \cdot (V_\phi(s_t) - V_t^{\text{target}})^2 + c_e \cdot H(\pi_\theta(\cdot \mid s_t))
```

平均水平为3个系数,通常是$c_v = 0.5$现在$c_e = 0.01$现在$\epsilon = 0.2$现在,我们要去.

**The training loop.**

1. 收集$N \times T$跨境的过渡$N$对于平行环境$T$每一步都在做.
2. 计算优势 (GAE),将它们作为常数结结.
3. 结$\pi_{\theta_{\text{old}}}$作为目前的快照$\pi_\theta$现在,我们要去.
4. 为了$K$对于每一批小批量,`(s, a, A, V_target, log π_old(a|s))`其他:
   - 计算$r_t(\theta) = \exp(\log \pi_\theta(a \mid s) - \log \pi_{\text{old}}(a \mid s))$现在,我们要去.
   - 申请$L^{\text{CLIP}}$它们的价值损失
   - 渐进步骤.
5. 放弃部署,回到第一步.

$K = 10$率强度:确切数量很少在 ± 50% 范围内.

**KL-penalty variant.**原稿提出了使用适应性KL罚款的替代方案: $L = L^{\text{PG}} - \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{old}})$随着$\beta$根据观察到的KL调整.剪辑版本成为主导性;KL变体在RLHF中存活 (KL对参考政策是你总是想要的单独的限制).

```figure
ppo-clip
```

## 建立它

### 步骤1: 捕获`log π_old(a | s)`在推出时

```python
for step in range(T):
    probs = softmax(logits(theta, state_features(s)))
    a = sample(probs, rng)
    s_next, r, done = env.step(s, a)
    buffer.append({
        "s": s, "a": a, "r": r, "done": done,
        "v_old": value(w, state_features(s)),
        "log_pi_old": log(probs[a] + 1e-12),
    })
    s = s_next
```

快照一次拍摄,在推出时,它不会在更新时代发生变化.

### 步骤2:计算GAE的优势 (07课)

像A2C一样,在整个批量中正常化.

### 步骤3:切断替代更新

```python
for _ in range(K_EPOCHS):
    for mb in minibatches(buffer, size=64):
        for rec in mb:
            x = state_features(rec["s"])
            probs = softmax(logits(theta, x))
            logp = log(probs[rec["a"]] + 1e-12)
            ratio = exp(logp - rec["log_pi_old"])
            adv = rec["advantage"]
            surrogate = min(
                ratio * adv,
                clamp(ratio, 1 - EPS, 1 + EPS) * adv,
            )
            # backprop -surrogate, add value loss, subtract entropy
            grad_logpi = onehot(rec["a"]) - probs
            if (adv > 0 and ratio >= 1 + EPS) or (adv < 0 and ratio <= 1 - EPS):
                pg_grad = 0.0  # clipped
            else:
                pg_grad = ratio * adv
            for i in range(N_ACTIONS):
                for j in range(N_FEAT):
                    theta[i][j] += LR * pg_grad * grad_logpi[i] * x[j]
```

如果新政策已经过于偏向有利方向,更新就会停止.

### 步骤4:价值和缩

加入标准的MSE到批评目标和对演员的透奖励,与A2C相同.

### 步骤5:诊断

每次更新都需要看三个东西:

- **Mean KL** $\mathbb{E}[\log \pi_{\text{old}} - \log \pi_\theta]$应该留在里面.`[0, 0.02]`如果它过去`0.1`减少`K_EPOCHS`或`LR`现在,我们要去.
- **Clip fraction** 占外面比例的样本比例$[1-\epsilon, 1+\epsilon]$应该是`~0.1-0.3`如果`~0`片从来没有触发的升`LR`或`K_EPOCHS`如果`~0.5+`现在,你把它们放下.
- **Explained variance** $1 - \text{Var}(V_{\text{target}} - V_{\text{pred}}) / \text{Var}(V_{\text{target}})$评论家学习时,应该朝1.

## 陷

- **Clip coefficient mistuned.** $\epsilon = 0.2$实际上,我们将会使用`0.1`让更新变得太尬;`0.3+`造成不稳定.
- **Too many epochs.** $K > 20$由于政策偏离了$\pi_{\text{old}}$限制时代,尤其是对于大型网络.
- **No reward normalization.**运行的奖励 (STD) 在计算优势之前,将奖励正常化.
- **Forgetting advantage normalization.**平均零/单位STD正常化是标准的. 跳过它,在大多数基准上会破坏PPO.
- **Learning rate not decayed.**由于线性LR衰退到零,PPO受益.
- **Importance ratio math errors.**总是`exp(log_new - log_old)`对于数值稳定性而言,不`new / old`现在,我们要去.
- **Wrong gradient sign.**增加代孕的可能性.$-L^{\text{CLIP}}$翻转标志是最常见的PPO虫.

## 用它

据了解,

| Use case | PPO variant |
|----------|-------------|
| MuJoCo / robotics control | PPO with Gaussian policy, GAE(0.95) |
| Atari / discrete games | PPO with categorical policy, rolling 128-step rollouts |
| RLHF for LLMs | PPO with KL penalty to reference model, reward from RM at end of response |
| Large-scale game agents | IMPALA + PPO (AlphaStar, OpenAI Five) |
| Reasoning LLMs | GRPO (Lesson 12) — PPO variant without critic |
| Preference-only data | DPO — closed-form collapsing of PPO+KL, no online sampling |

切割替代+值+入力是DPO,GRPO和几乎每个RLHF管道的架构.

## 运送它

保存如`outputs/skill-ppo-trainer.md`其他:

```markdown
---
name: ppo-trainer
description: Produce a PPO training config and a diagnostic plan for a given environment.
version: 1.0.0
phase: 9
lesson: 8
tags: [rl, ppo, policy-gradient]
---

Given an environment and training budget, output:

1. Rollout size. `N` envs × `T` steps.
2. Update schedule. `K` epochs, minibatch size, LR schedule.
3. Surrogate params. `ε` (clip), `c_v`, `c_e`, advantage normalization on.
4. Advantage. GAE(`λ`) with explicit `γ` and `λ`.
5. Diagnostics plan. KL, clip fraction, explained variance thresholds with alerts.

Refuse `K > 30` or `ε > 0.3` (unsafe trust region). Refuse any PPO run without advantage normalization or KL/clip monitoring. Flag clip fraction sustained above 0.4 as drift.
```

## 运动

1. **Easy.**在4×4格里德世界上运行PPO$\epsilon=0.2, K=4$通过相对环境步骤,比较样品效率与A2C (每次推出一次)
2. **Medium.**扫描$K \in \lbrace 1, 4, 10, 30 \rbrace$节点返回与环境步骤,跟踪平均KL每次更新.$K$这项任务是否会爆炸?
3. **Hard.**取代切割的替代母体用适应性 KL罚款 ($\beta$如果$\mathrm{KL} > 2 \cdot \text{target}$半个如果$\mathrm{KL} < \text{target}/2$) 比较最终回报,稳定性和无剪辑性.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Importance ratio | "r_t(θ)" | $\pi_\theta(a \mid s) / \pi_{\text{old}}(a \mid s)$; deviation from the policy that collected the data. |
| Clipped surrogate | "PPO's main trick" | $\min(r \cdot A, \mathop{\mathrm{clip}}(r, 1-\epsilon, 1+\epsilon) \cdot A)$; flat gradient past the clip on beneficial side. |
| Trust region | "TRPO / PPO intent" | Limit each update's KL to guarantee monotone improvement. |
| KL penalty | "Soft trust region" | Alternative PPO: $L - \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{old}})$. Adaptive $\beta$. |
| Clip fraction | "How often clipping triggers" | Diagnostic — should be 0.1-0.3; outside means mistuned. |
| Multi-epoch training | "Data reuse" | K epochs on each rollout; variance cost traded for sample efficiency. |
| On-policy-ish | "Mostly on-policy" | PPO is nominally on-policy but K>1 epochs uses slightly-off-policy data safely. |
| PPO-KL | "The other PPO" | KL-penalty variant; used in RLHF where KL-to-reference is already a constraint. |

## 进一步阅读

- [Schulman et al. (2017). Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347)报纸.
- [Schulman et al. (2015). Trust Region Policy Optimization](https://arxiv.org/abs/1502.05477)TRPO,是PPO的前任.
- [Andrychowicz et al. (2021). What Matters In On-Policy RL? A Large-Scale Empirical Study](https://arxiv.org/abs/2006.05990)每一个PPO超参数都被取消.
- [Ouyang et al. (2022). Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) 导读GPT;PPO-in-RLHF配方.
- [OpenAI Spinning Up — PPO](https://spinningup.openai.com/en/latest/algorithms/ppo.html)使用 PyTorch 清洁现代化展览.
- [CleanRL PPO implementation](https://github.com/vwxyzjn/cleanrl)许多论文所使用的单档PPO参考.
- [Hugging Face TRL — PPOTrainer](https://huggingface.co/docs/trl/main/en/ppo_trainer)语言模型的PPO生产配方;阅读与第09课 (RLHF) 一起.
- [Engstrom et al. (2020). Implementation Matters in Deep Policy Gradients](https://arxiv.org/abs/2005.12729)"37代码级优化"论文;哪些PPO技巧承载负载,哪些是民间故事.
