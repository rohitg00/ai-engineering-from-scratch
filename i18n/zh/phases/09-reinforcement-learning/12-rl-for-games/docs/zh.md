# 游戏强化学习 — AlphaZero、MuZero 与 LLM 推理时代

> 1992 年：TD-Gammon 凭借纯 TD 方法击败了西洋双陆棋人类冠军。2016 年：AlphaGo 击败李世石。2017 年：AlphaZero 从零开始统治了国际象棋、将棋和围棋。2024 年：DeepSeek-R1 证明了同样的配方——用 GRPO 取代 PPO——在推理任务上同样有效。游戏是推动这一阶段每次突破的基准。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 05 (DQN), Phase 9 · 08 (PPO), Phase 9 · 09 (RLHF), Phase 9 · 10 (MARL)
**Time:** ~120 minutes

## 问题

游戏具备强化学习所需的一切要素：清晰的奖励（胜负）、无限的回合（自我对弈重置）、完美的模拟（游戏本身就是模拟器）、离散或小的连续动作空间，以及迫使策略具备对抗鲁棒性的多智能体结构。

而且，每次重大 RL 突破都是在游戏中验证的。TD-Gammon（西洋双陆棋，1992）。Atari-DQN（2013）。AlphaGo（2016）。AlphaZero（2017）。OpenAI Five（Dota 2，2019）。AlphaStar（星际争霸 II，2019）。MuZero（学习模型，2019）。AlphaTensor（矩阵乘法，2022）。AlphaDev（排序算法，2023）。DeepSeek-R1（数学推理，2025）——最新的证明：游戏 RL 技术同样适用于文本。

本 capstone 通过一个统一的视角——**自我对弈 + 搜索 + 策略改进**——来考察三个里程碑式的架构：AlphaZero、MuZero 和 GRPO。每一个都是对前一个的泛化；尤其是 GRPO，它就是 AlphaZero 的配方应用于 LLM 推理：token 作为动作，数学验证作为胜负信号。

## 概念

![AlphaZero ↔ MuZero ↔ GRPO: same loop, different environments](../assets/rl-games.svg)

**统一循环。**

```
while True:
    trajectory = self_play(current_policy, search)     # play game against self
    policy_target = search.improved_policy(trajectory) # search improves raw policy
    policy_net.update(policy_target, value_target)     # supervised on search output
```

**AlphaZero（2017）。** Silver 等人。给定一个规则已知的游戏（国际象棋、将棋、围棋）：

- 策略-价值网络：单塔结构 `f_θ(s) → (p, v)`。`p` 是合法走法的先验分布。`v` 是预期对局结果。
- 蒙特卡洛树搜索（MCTS）：在每一步，扩展一棵可能走法的树。用 `(p, v)` 作为先验 + bootstrap。按 UCB（PUCT）选择节点：`a* = argmax Q(s, a) + c · p(a|s) · √N(s) / (1 + N(s, a))`。
- 自我对弈：智能体对智能体对弈。在第 `t` 步，MCTS 访问分布 `π_t` 成为策略的训练目标。
- 损失函数：`L = (v - z)² - π · log p + c · ||θ||²`。`z` 是对局结果（+1 / 0 / -1）。

零人类知识，零手工启发式。仅凭这一个配方，每种游戏在几千万次自我对弈之后就精通了国际象棋、将棋和围棋。

**MuZero（2019）。** Schrittwieser 等人。去掉了规则已知的要求。

- 不用固定的环境，而是学习一个*潜在动力学模型* `(h, g, f)`：
  - `h(s)`：将观测编码为潜在状态。
  - `g(s_latent, a)`：预测下一个潜在状态 + 奖励。
  - `f(s_latent)`：预测策略先验 + 价值。
- MCTS 在*学习到的潜在空间*中运行。同样的搜索，同样的训练循环。
- 适用于围棋、国际象棋、将棋*以及* Atari——一个算法，无需规则知识。

**Stochastic MuZero（2022）。** 加入随机动力学和机会节点；扩展到西洋双陆棋类游戏。

**Muesli、Gumbel MuZero（2022-2024）。** 在样本效率和确定性搜索上的改进。

**GRPO（2024-2025）。** DeepSeek-R1 的配方。同样的 AlphaZero 形状循环，应用于语言模型推理：

- “游戏”：回答一个数学 / 编程 / 推理问题。“获胜” = 验证器（测试用例通过、数值答案匹配）返回 1。
- 策略：LLM。动作：token。状态：提示词 + 已生成的响应。
- 无 critic（PPO 式的 V_φ）。取而代之，对每个提示词从策略中采样 `G` 个补全，为每个补全计算奖励，用**组相对优势** `A_i = (r_i - mean_r) / std_r` 作为 REINFORCE 式更新的信号。
- 对参考策略的 KL 惩罚以防止漂移（类似 RLHF）。
- 完整损失：

  `L_GRPO(θ) = -E_{q, {o_i}} [ (1/G) Σ_i A_i · log π_θ(o_i | q) ] + β · KL(π_θ || π_ref)`

无奖励模型，无 critic，无 MCTS。组相对基线取代了这三者。在推理基准上以极小的计算量达到甚至超过 PPO-RLHF 的质量。

**完整的 R1 配方。** DeepSeek-R1（DeepSeek 2025）在一篇论文中包含了两个模型：

- **R1-Zero。** 从 DeepSeek-V3 基座模型出发。无 SFT。直接应用 GRPO，使用两个奖励组件：*准确性奖励*（基于规则——最终答案是否解析出正确数值 / 代码是否通过单元测试）和*格式奖励*（补全是否把思维链包裹在 `<think>…</think>` 标签中）。经过数千步之后，平均响应长度从约 100 增长到约 10,000 个 token，数学基准分数攀升至接近 o1-preview 的水平。模型从零学会了推理。缺点：其思维链常常难以阅读，混杂多种语言，且缺乏文风上的打磨。
- **R1。** 用四阶段流程修复 R1-Zero 的可读性问题：
  1. **冷启动 SFT。** 收集几千条格式整洁的长 CoT 演示数据，对基座模型做监督微调。这提供了一个可读的起点。
  2. **面向推理的 GRPO。** 应用 GRPO，使用准确性 + 格式奖励，外加一个*语言一致性*奖励以防止语码切换。
  3. **拒绝采样 + 第二轮 SFT。** 从 RL 检查点采样约 60 万条推理轨迹，只保留最终答案正确且 CoT 可读的样本，并与约 20 万条非推理 SFT 样本（写作、问答、自我认知）合并。再次微调基座。
  4. **全谱 GRPO。** 再做一轮 RL，同时覆盖推理（基于规则的奖励）和通用对齐（基于偏好、有益性/无害性的奖励）。

结果以开源权重在 AIME 和 MATH-500 上匹敌 o1，且小到可以蒸馏。同一篇论文还发布了六个蒸馏出的稠密模型（Qwen-1.5B 到 Llama-70B），方法是在 R1 的推理轨迹上做 SFT——学生端不做 RL。在学生模型的规模上，蒸馏强大的 RL 教师始终优于从零做 RL。

**为什么推理任务用 GRPO 而不是 PPO。** DeepSeekMath 论文（2024 年 2 月）给出三个理由：（1）无需训练价值网络，显存减半；（2）组基线天然处理推理任务产生的稀疏的轨迹末端奖励；（3）按提示词归一化使优势在难度差异极大的问题之间可比，而 PPO 的单一 critic 做不到这一点。

**无搜索 vs 基于搜索。** 游戏领域已经分化：

- *长视野的完全信息游戏*（围棋、国际象棋）：仍然基于搜索。AlphaZero / MuZero 占主导。
- *LLM 推理*：生产环境中尚无 MCTS；GRPO 用于完整 rollout，推理期算力用 best-of-N。过程奖励模型（PRM）预示着步级搜索可能被重新加入。

```figure
f3-selfplay-ladder
```

## 动手实现

`code/main.py` 中的代码实现了** miniature 版 GRPO**——一个带有多组样本的 bandit。算法与 LLM 上的完全相同；只是策略和环境更简单。它教你的是*损失函数*和*组相对优势*——这正是 2025 年的创新点。

### 步骤 1：一个微型验证器环境

```python
QUESTIONS = [
    {"prompt": "q1", "correct": 3},
    {"prompt": "q2", "correct": 1},
]

def verify(prompt_idx, answer_token):
    return 1.0 if answer_token == QUESTIONS[prompt_idx]["correct"] else 0.0
```

在真实的 GRPO 中，验证器会运行单元测试或检查数学等式。

### 步骤 2：策略：每个提示词在 K 个答案 token 上做 softmax

```python
def policy_probs(theta, p_idx):
    return softmax(theta[p_idx])
```

等价于 LLM 在给定提示词条件下的最后一层输出。

### 步骤 3：组采样与组相对优势

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
    # KL penalty: pull theta toward reference
    for i in range(len(probs)):
        theta[p_idx][i] -= beta * (theta[p_idx][i] - reference[p_idx][i])
```

组相对优势是 2024 年 DeepSeek 的技巧。无需 critic。“基线”是组均值，归一化使用组标准差。

### 步骤 4：与 REINFORCE 基线（无价值函数）对比

相同的设置，相同的计算量，纯 REINFORCE。GRPO 收敛更快、更稳定。

### 步骤 5：观察熵和 KL

与 RLHF 相同的诊断指标：相对参考策略的平均 KL、策略熵、随时间变化的奖励。这些指标稳定后，训练即告完成。

## 常见陷阱

- **通过玩弄验证器来 hack 奖励。** GRPO 继承了 RLHF 的风险：如果验证器有误或可被利用，LLM 就会找到漏洞。稳健的验证器（多个测试用例、形式化证明）至关重要。
- **组大小过小。** 组基线的方差与 `1/√G` 成正比。低于 `G = 4` 时，优势信号噪声很大；标准选择是 `G = 8` 到 `64`。
- **长度偏差。** 不同长度的 LLM 补全具有不同的对数概率。可按 token 数归一化，或使用序列级对数概率，或截断到最大长度。
- **纯自我对弈循环。** AlphaZero 式训练在一般和博弈中可能陷入支配循环。可通过多样化的对手池缓解（联赛对弈，第 10 课）。
- **搜索-策略失配。** AlphaZero 训练策略去模仿搜索输出。如果策略网络太小、无法表示搜索的分布，训练就会停滞。
- **计算下限。** MuZero / AlphaZero 需要海量算力。单个消融实验往往要几百 GPU 小时。存在微型演示（如 Connect Four 上的 AlphaZero）供学习之用。
- **验证器覆盖度。** 对错误解也能通过的单元测试会强化错误。设计能捕获边界情况的验证器。

## 实际应用

2026 年游戏 RL 的格局，按领域划分：

| 领域 | 主导方法 |
|--------|-----------------|
| 双人零和棋类（围棋、国际象棋、将棋） | AlphaZero / MuZero / KataGo |
| 不完全信息牌类（扑克） | CFR + 深度学习（DeepStack、Libratus、Pluribus） |
| Atari / 像素游戏 | Muesli / MuZero / IMPALA-PPO |
| 大型多人策略（Dota、星际争霸） | PPO + 自我对弈 + 联赛（OpenAI Five、AlphaStar） |
| LLM 数学/代码推理 | GRPO（DeepSeek-R1、Qwen-RL、开源复现） |
| LLM 对齐 | DPO / RLHF-PPO（非 GRPO；奖励是偏好而非可验证的） |
| 机器人 | PPO + DR（非游戏 RL，但使用同样的策略梯度工具） |
| 组合优化问题 | AlphaZero 变体（AlphaTensor、AlphaDev） |

这个*配方*——自我对弈、搜索增强的改进、策略蒸馏——跨越了文本、像素和物理控制。GRPO 是最年轻的实例；更多还会到来。

## 交付

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

1. **简单。** 在 `code/main.py` 中实现 GRPO bandit。在 2 个提示词 × 每个 4 个答案 token 上训练。用 `G=8` 在 1,000 次更新内收敛。
2. **中等。** 接入 PPO（clipped）和原始 REINFORCE。在同一个 bandit 上，比较它们与 GRPO 的样本效率和奖励方差。
3. **困难。** 扩展到长度为 2 的“推理链”：智能体发出两个 token，验证器对这一对进行奖励。测量 GRPO 如何处理两步序列上的信用分配。（提示：对*完整序列*计算组优势，再传播到两个 token 位置。）

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| MCTS | “带学习网络的树搜索” | 蒙特卡洛树搜索；使用学习到的 `(p, v)` 先验做 UCB1/PUCT 选择。 |
| AlphaZero | “自我对弈 + MCTS” | 策略-价值网络被训练去匹配 MCTS 访问分布和对局结果。 |
| MuZero | “学习模型的 AlphaZero” | 相同的循环，但通过学习到的动力学在潜在空间中进行。 |
| GRPO | “无 critic 的 PPO” | 组相对策略优化（Group Relative Policy Optimization）；带组均值基线 + KL 的 REINFORCE。 |
| PUCT | “AlphaZero 的 UCB” | `Q + c · p · √N / (1 + N_a)`——平衡价值估计与先验。 |
| 自我对弈 | “智能体对过去的自己” | 零和博弈的标准做法；对称的训练信号。 |
| 联赛对弈 | “基于种群的自我对弈” | 过去 + 当前 + 剥削者作为对手被采样。 |
| 验证器奖励 | “可验证 RL” | 奖励来自确定性检查器（测试通过、答案匹配）。 |
| 过程奖励 | “PRM” | 对每个推理步骤评分，而不仅仅是最终答案。 |

## 延伸阅读

- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270)。
- [Silver et al. (2018). A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play (AlphaZero)](https://www.science.org/doi/10.1126/science.aar6404)。
- [Schrittwieser et al. (2020). Mastering Atari, Go, chess and shogi by planning with a learned model (MuZero)](https://www.nature.com/articles/s41586-020-03051-4)。
- [Vinyals et al. (2019). Grandmaster level in StarCraft II (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z)。
- [DeepSeek-AI (2024). DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models (GRPO)](https://arxiv.org/abs/2402.03300)——提出 GRPO 和组相对基线的论文。
- [DeepSeek-AI (2025). DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948)——完整的四阶段 R1 配方以及 R1-Zero 消融。
- [Brown et al. (2019). Superhuman AI for multiplayer poker (Pluribus)](https://www.science.org/doi/10.1126/science.aay2400)——大规模的 CFR + 深度学习。
- [Tesauro (1995). Temporal Difference Learning and TD-Gammon](https://dl.acm.org/doi/10.1145/203330.203343)——开启这一切的论文。
- [Hugging Face TRL — GRPOTrainer](https://huggingface.co/docs/trl/main/en/grpo_trainer)——使用自定义奖励函数应用 GRPO 的生产参考实现。
- [Qwen Team (2024). Qwen2.5-Math — GRPO replication](https://github.com/QwenLM/Qwen2.5-Math)——R1 配方在多个规模上的开源复现。
- [Sutton & Barto (2018). Ch. 17 — Frontiers of Reinforcement Learning](http://incompleteideas.net/book/RLbook2020.pdf)——关于自我对弈、搜索和“设计奖励”的教科书式框架，R1 正是在 LLM 规模上实例化了这些概念。