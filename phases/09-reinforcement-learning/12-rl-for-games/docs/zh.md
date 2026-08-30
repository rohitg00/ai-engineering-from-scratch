# 12 · 游戏强化学习——AlphaZero、MuZero 与 LLM 推理时代

> 1992 年：TD-Gammon 用纯粹的「时序差分（TD）」在西洋双陆棋上击败了人类冠军。2016 年：AlphaGo 击败李世石。2017 年：AlphaZero 从零开始统治了国际象棋、将棋和围棋。2024 年：DeepSeek-R1 证明了同一套配方——用 GRPO 替换 PPO——同样适用于推理任务。游戏是驱动本阶段每一次突破的基准。

**类型：** 构建
**语言：** Python
**前置：** 阶段 9 · 05（DQN）、阶段 9 · 08（PPO）、阶段 9 · 09（RLHF）、阶段 9 · 10（MARL）
**时长：** 约 120 分钟

## 问题所在

游戏拥有强化学习想要的一切。干净的奖励（输赢）。无限的回合（自我对弈可以重置）。完美的模拟（游戏*本身*就是模拟器）。离散或小型连续的动作空间。逼迫出对抗鲁棒性的多智能体结构。

而且，每一项重大的强化学习突破都是在游戏上验证的。TD-Gammon（西洋双陆棋，1992）。Atari-DQN（2013）。AlphaGo（2016）。AlphaZero（2017）。OpenAI Five（Dota 2，2019）。AlphaStar（星际争霸 II，2019）。MuZero（习得模型，2019）。AlphaTensor（矩阵乘法，2022）。AlphaDev（排序算法，2023）。DeepSeek-R1（数学推理，2025）——这是游戏强化学习技术适用于文本的最新例证。

这一压轴课通过一个统一的视角——**自我对弈 + 搜索 + 策略改进**——审视三种里程碑式的架构：AlphaZero、MuZero 和 GRPO。每一种都是对前一种的推广；尤其 GRPO，正是把 AlphaZero 的配方应用到 LLM 推理上，以 token 为动作、以数学验证为胜负信号。

## 核心概念

〔图：AlphaZero ↔ MuZero ↔ GRPO：同一个循环，不同的环境〕

**统一的循环。**

```
while True:
    trajectory = self_play(current_policy, search)     # 与自己对弈一局
    policy_target = search.improved_policy(trajectory) # 搜索改进原始策略
    policy_net.update(policy_target, value_target)     # 在搜索输出上做监督训练
```

**AlphaZero（2017）。** Silver 等人。给定一个规则已知的游戏（国际象棋、将棋、围棋）：

- 策略-价值网络：单塔 `f_θ(s) → (p, v)`。`p` 是合法着法上的先验分布。`v` 是博弈结果的期望。
- 「蒙特卡洛树搜索（Monte Carlo Tree Search，MCTS）」：在每一步着法时，展开一棵可能后续的树。用 `(p, v)` 作为先验 + 自举（bootstrap）。通过 UCB（PUCT）选择节点：`a* = argmax Q(s, a) + c · p(a|s) · √N(s) / (1 + N(s, a))`。
- 自我对弈：智能体对智能体下棋。在第 `t` 步着法时，MCTS 的访问分布 `π_t` 成为策略的训练目标。
- 损失：`L = (v - z)² - π · log p + c · ||θ||²`。`z` 是博弈结果（+1 / 0 / -1）。

零人类知识。零手工启发式。一套配方，在各自经过数千万局自我对弈后，掌握了国际象棋、将棋和围棋。

**MuZero（2019）。** Schrittwieser 等人。去掉了规则已知这一要求。

- 不再依赖一个固定的环境，而是学习一个*潜在动力学模型* `(h, g, f)`：
  - `h(s)`：将观测编码为潜在状态。
  - `g(s_latent, a)`：预测下一个潜在状态 + 奖励。
  - `f(s_latent)`：预测策略先验 + 价值。
- MCTS 在*习得的潜在空间*中运行。相同的搜索，相同的训练循环。
- 适用于围棋、国际象棋、将棋*以及* Atari——同一套算法，无需规则知识。

**随机 MuZero（Stochastic MuZero，2022）。** 加入随机动力学和机会节点（chance nodes）；扩展到西洋双陆棋这一类游戏。

**Muesli、Gumbel MuZero（2022-2024）。** 在样本效率和确定性搜索上的改进。

**GRPO（2024-2025）。** DeepSeek-R1 配方。同样形态的 AlphaZero 循环，应用到语言模型推理上：

- 「游戏」：回答一个数学 / 编程 / 推理问题。「赢」= 验证器（verifier，测试用例通过、数值答案匹配）返回 1。
- 策略：LLM。动作：token。状态：提示词 + 已生成的回答。
- 没有评论家（critic，PPO 风格的 V_φ）。取而代之的是，对每个提示词，从策略中采样 `G` 个补全。为每个补全计算奖励。用**组相对优势（group-relative advantage）** `A_i = (r_i - mean_r) / std_r` 作为 REINFORCE 式更新的信号。
- 对参考策略施加 KL 惩罚以防止漂移（类似 RLHF）。
- 完整损失：

  `L_GRPO(θ) = -E_{q, {o_i}} [ (1/G) Σ_i A_i · log π_θ(o_i | q) ] + β · KL(π_θ || π_ref)`

没有奖励模型，没有评论家，没有 MCTS。组相对基线（baseline）取代了这三者。在推理基准上以一小部分算力即可匹敌或超越 PPO-RLHF 的质量。

**完整的 R1 配方。** DeepSeek-R1（DeepSeek 2025）在一篇论文里其实是两个模型：

- **R1-Zero。** 从 DeepSeek-V3 基座模型出发。不做 SFT。直接施加 GRPO，配两个奖励分量：*准确性奖励*（基于规则——最终答案是否解析为正确的数字 / 代码是否通过单元测试）和*格式奖励*（补全是否把思维链包裹在 `<think>…</think>` 标签里）。在数千步的训练中，平均回答长度从约 100 增长到约 10,000 token，数学基准分数攀升到接近 o1-preview 的水平。模型从零学会了推理。代价是：它的思维链往往难以阅读、混杂多种语言，且缺乏文体上的打磨。

- **R1。** 用一条四阶段管线修复 R1-Zero 的可读性问题：
  1. **冷启动 SFT。** 收集数千条格式干净的长思维链示范。在其上对基座模型做监督微调。这给出了一个可读的起点。
  2. **面向推理的 GRPO。** 施加 GRPO，奖励为准确性 + 格式，外加一个*语言一致性*奖励以防止语码切换（code-switching）。
  3. **拒绝采样 + 第二轮 SFT。** 从 RL 检查点采样约 60 万条推理轨迹，只保留最终答案正确且思维链可读的那些，再与约 20 万条非推理 SFT 样本（写作、问答、自我认知）合并。再次微调基座模型。
  4. **全谱 GRPO。** 再做一轮 RL，同时覆盖推理（基于规则的奖励）和通用对齐（基于偏好的有用性 / 无害性奖励）。

最终结果在 AIME 和 MATH-500 上以开放权重匹敌 o1，且足够小巧可以蒸馏。同一篇论文还通过在 R1 的推理轨迹上做 SFT，发布了六个蒸馏得到的稠密模型（从 Qwen-1.5B 到 Llama-70B）——学生端不做任何 RL。在学生的规模下，从强 RL 教师蒸馏始终优于从零开始做 RL。

**为何推理用 GRPO 而非 PPO。** DeepSeekMath 论文（2024 年 2 月）给出三条理由：（1）无需训练价值网络，内存减半；（2）组基线天然地处理推理任务所产生的稀疏的轨迹末端奖励；（3）逐提示词归一化使得优势在难度差异巨大的问题之间可比，而 PPO 的单一评论家做不到这一点。

**无搜索 vs 有搜索。** 游戏领域已经分叉：

- *长视野的完全信息游戏*（围棋、国际象棋）：仍然基于搜索。AlphaZero / MuZero 占主导。
- *LLM 推理*：生产环境中还没有 MCTS；在完整 rollout 上做 GRPO，推理时算力用 best-of-N。「过程奖励模型（Process Reward Models，PRMs）」暗示着步级搜索正被重新加回来。

## 动手构建

`code/main.py` 中的代码实现了**微缩版 GRPO**——一个带有多组样本的多臂老虎机（bandit）。算法与在 LLM 上的完全相同；只是策略和环境更简单。它讲解的是*损失*和*组相对优势*，后者正是 2025 年的创新所在。

### 第 1 步：一个极小的验证器环境

```python
QUESTIONS = [
    {"prompt": "q1", "correct": 3},
    {"prompt": "q2", "correct": 1},
]

def verify(prompt_idx, answer_token):
    return 1.0 if answer_token == QUESTIONS[prompt_idx]["correct"] else 0.0
```

在真实的 GRPO 中，验证器会运行单元测试或检查数学等价性。

### 第 2 步：策略——对每个提示词的 K 个答案 token 做 softmax

```python
def policy_probs(theta, p_idx):
    return softmax(theta[p_idx])
```

等价于以提示词为条件的 LLM 最后一层的输出。

### 第 3 步：组采样与组相对优势

```python
def grpo_step(theta, p_idx, G=8, beta=0.01, lr=0.1, rng=None):
    probs = policy_probs(theta, p_idx)
    samples = [sample(probs, rng) for _ in range(G)]
    rewards = [verify(p_idx, s) for s in samples]
    mean_r = sum(rewards) / G
    std_r = stddev(rewards) + 1e-8
    advs = [(r - mean_r) / std_r for r in rewards]

    for a, A in zip(samples, advs):
        grad = onehot(a) - probs
        for i in range(len(probs)):
            theta[p_idx][i] += lr * A * grad[i]
    # KL 惩罚：把 theta 拉向参考策略
    for i in range(len(probs)):
        theta[p_idx][i] -= beta * (theta[p_idx][i] - reference[p_idx][i])
```

组相对优势是 2024 年 DeepSeek 的技巧。无需评论家。「基线」就是组均值，归一化用组标准差。

### 第 4 步：与 REINFORCE 基线（无价值函数）对比

相同的设置，相同的算力，使用朴素 REINFORCE。GRPO 收敛得更快、更稳定。

### 第 5 步：观察熵与 KL

与 RLHF 相同的诊断指标：对参考策略的平均 KL、策略熵、奖励随时间的变化。一旦这些指标稳定下来，训练就完成了。

## 常见陷阱

- **通过钻验证器空子实现奖励黑客（reward hacking）。** GRPO 继承了 RLHF 的风险：如果验证器有误或可被利用，LLM 就会找到这个漏洞。鲁棒的验证器（多个测试用例、形式化证明）至关重要。
- **组规模太小。** 组基线的方差大致按 `1/√G` 变化。当 `G = 4` 以下时，优势信号很嘈杂；标准选择是 `G = 8` 到 `64`。
- **长度偏差。** 长度不同的 LLM 补全有着不同的对数概率。要么按 token 数归一化，要么使用序列级对数概率，要么截断到最大长度。
- **纯自我对弈陷入循环。** AlphaZero 式训练在一般和（general-sum）博弈上可能卡在支配循环中。可通过多样化的对手池（联赛制对弈，见第 10 课）来缓解。
- **搜索-策略不匹配。** AlphaZero 训练策略去模仿搜索的输出。如果策略网络太小，无法表示搜索的分布，训练就会停滞。
- **算力下限。** MuZero / AlphaZero 需要海量算力。单次消融实验常常要数百 GPU-小时。出于学习目的存在微缩版示例（例如在四子棋 Connect Four 上的 AlphaZero）。
- **验证器覆盖率。** 对一个有 bug 的解也能通过的单元测试会强化这个 bug。设计能捕捉边界情况的验证器。

## 实际应用

2026 年游戏强化学习全景，按领域划分：

| 领域 | 主导方法 |
|--------|-----------------|
| 两人零和棋类游戏（围棋、国际象棋、将棋） | AlphaZero / MuZero / KataGo |
| 不完全信息纸牌游戏（扑克） | CFR + 深度学习（DeepStack、Libratus、Pluribus） |
| Atari / 像素游戏 | Muesli / MuZero / IMPALA-PPO |
| 大型多人策略（Dota、星际争霸） | PPO + 自我对弈 + 联赛（OpenAI Five、AlphaStar） |
| LLM 数学 / 代码推理 | GRPO（DeepSeek-R1、Qwen-RL、开源复现） |
| LLM 对齐 | DPO / RLHF-PPO（非 GRPO；验证器是偏好而非可验证的） |
| 机器人学 | PPO + DR（非游戏强化学习，但使用相同的策略梯度工具） |
| 组合问题 | AlphaZero 变体（AlphaTensor、AlphaDev） |

这套*配方*——自我对弈、搜索增强的改进、策略蒸馏——横跨文本、像素和物理控制。GRPO 是最年轻的实例；还会有更多。

## 交付上线

保存为 `outputs/skill-game-rl-designer.md`：

```markdown
---
name: game-rl-designer
description: Design a game-RL or reasoning-RL training pipeline (AlphaZero / MuZero / GRPO) for a given domain.
version: 1.0.0
phase: 9
lesson: 12
tags: [rl, alphazero, muzero, grpo, self-play]
---

Given a target (perfect-info game / imperfect-info / Atari / LLM reasoning / combinatorial), output:

1. Environment fit. Known rules? Markov? Stochastic? Multi-agent? Informs AlphaZero vs MuZero vs GRPO.
2. Search strategy. MCTS (PUCT with learned prior), Gumbel-sampled, best-of-N, or none.
3. Self-play plan. Symmetric self-play / league / offline data / verifier-generated.
4. Target signal. Game outcome / verifier reward / preference / learned model. Include robustness plan.
5. Diagnostics. Win rate vs baseline, ELO curve, verifier pass rate, KL to reference.

Refuse AlphaZero on imperfect-info games (route to CFR). Refuse GRPO without a trusted verifier. Refuse any game-RL pipeline without a fixed baseline opponent set (self-play ELO is uncalibrated otherwise).
```

## 练习

1. **简单。** 在 `code/main.py` 中实现 GRPO 老虎机。在 2 个提示词 × 每个 4 个答案 token 上训练。用 `G=8`，在 < 1,000 次更新内收敛。
2. **中等。** 接入 PPO（带裁剪）和朴素 REINFORCE。在同一个老虎机上，对比它们与 GRPO 的样本效率和奖励方差。
3. **困难。** 扩展到一条长度为 2 的「推理链」：智能体发出两个 token，验证器对这一组合给予奖励。测量 GRPO 如何处理跨两步序列的信用分配。（提示：按*完整序列*计算组优势，再传播到两个 token 位置。）

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| MCTS | 「带习得网络的树搜索」 | 蒙特卡洛树搜索；用习得的 `(p, v)` 先验做 UCB1/PUCT 选择。 |
| AlphaZero | 「自我对弈 + MCTS」 | 训练策略-价值网络去匹配 MCTS 的访问次数和博弈结果。 |
| MuZero | 「带习得模型的 AlphaZero」 | 相同的循环，但通过习得动力学在潜在空间中进行。 |
| GRPO | 「无评论家的 PPO」 | 组相对策略优化（Group Relative Policy Optimization）；带组均值基线 + KL 的 REINFORCE。 |
| PUCT | 「AlphaZero 的 UCB」 | `Q + c · p · √N / (1 + N_a)`——在价值估计与先验之间权衡。 |
| 自我对弈 | 「智能体对战过去的自己」 | 零和博弈的标准做法；对称的训练信号。 |
| 联赛制对弈 | 「基于种群的自我对弈」 | 把过去的、当前的和专攻型（exploiters）智能体采样为对手。 |
| 验证器奖励 | 「可验证 RL」 | 奖励来自一个确定性的检查器（测试通过、答案匹配）。 |
| 过程奖励 | 「PRM」 | 对每一步推理打分，而不只是最终答案。 |

## 延伸阅读

- [Silver 等人（2017）。在无人类知识下掌握围棋（AlphaGo Zero）](https://www.nature.com/articles/nature24270)。
- [Silver 等人（2018）。一种通过自我对弈掌握国际象棋、将棋和围棋的通用强化学习算法（AlphaZero）](https://www.science.org/doi/10.1126/science.aar6404)。
- [Schrittwieser 等人（2020）。通过习得模型规划来掌握 Atari、围棋、国际象棋和将棋（MuZero）](https://www.nature.com/articles/s41586-020-03051-4)。
- [Vinyals 等人（2019）。星际争霸 II 的宗师级水平（AlphaStar）](https://www.nature.com/articles/s41586-019-1724-z)。
- [DeepSeek-AI（2024）。DeepSeekMath：在开放语言模型中突破数学推理的极限（GRPO）](https://arxiv.org/abs/2402.03300)——引入 GRPO 和组相对基线的论文。
- [DeepSeek-AI（2025）。DeepSeek-R1：通过强化学习激励 LLM 的推理能力](https://arxiv.org/abs/2501.12948)——完整的四阶段 R1 配方加上 R1-Zero 消融实验。
- [Brown 等人（2019）。多人扑克的超人类 AI（Pluribus）](https://www.science.org/doi/10.1126/science.aay2400)——大规模 CFR + 深度学习。
- [Tesauro（1995）。时序差分学习与 TD-Gammon](https://dl.acm.org/doi/10.1145/203330.203343)——开启这一切的论文。
- [Hugging Face TRL — GRPOTrainer](https://huggingface.co/docs/trl/main/en/grpo_trainer)——使用自定义奖励函数应用 GRPO 的生产级参考。
- [Qwen Team（2024）。Qwen2.5-Math — GRPO 复现](https://github.com/QwenLM/Qwen2.5-Math)——多种规模下对 R1 配方的开源复现。
- [Sutton & Barto（2018）。第 17 章——强化学习的前沿](http://incompleteideas.net/book/RLbook2020.pdf)——关于自我对弈、搜索和「设计奖励」的教科书式框架，R1 正是在 LLM 规模上对其的具体实现。
