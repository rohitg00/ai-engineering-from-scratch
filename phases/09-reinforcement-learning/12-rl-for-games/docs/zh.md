# 游戏 RL——AlphaZero、MuZero 与 LLM 推理时代

> 1992 年：TD-Gammon 用纯 TD 在西洋双陆棋上击败人类冠军。2016 年：AlphaGo 击败李世石。2017 年：AlphaZero 从零开始称霸国际象棋、将棋和围棋。2024 年：DeepSeek-R1 证明了同样的配方（用 GRPO 取代 PPO）适用于推理。游戏是推动本阶段每个突破的基准。

**类型：** 构建
**语言：** Python
**前置要求：** 阶段 9 · 05（DQN）、阶段 9 · 08（PPO）、阶段 9 · 09（RLHF）、阶段 9 · 10（MARL）
**时间：** ~120 分钟

## 问题

游戏拥有 RL 想要的一切。清晰的奖励（赢/输）。无限回合（自我对弈重置）。完美的仿真（游戏**就是**模拟器）。离散或小的连续动作空间。强制对抗鲁棒性的多智能体结构。

而且游戏是每个重大 RL 突破的测试场。TD-Gammon（西洋双陆棋，1992）。Atari-DQN（2013）。AlphaGo（2016）。AlphaZero（2017）。OpenAI Five（Dota 2，2019）。AlphaStar（StarCraft II，2019）。MuZero（学习模型，2019）。AlphaTensor（矩阵乘法，2022）。AlphaDev（排序算法，2023）。DeepSeek-R1（数学推理，2025）——游戏 RL 技术适用于文本的最新证明。

本总结课程通过一个统一的视角审视三个里程碑式架构——AlphaZero、MuZero 和 GRPO：**自我对弈 + 搜索 + 策略改进**。每个都是前一个的推广；GRPO 特别是 AlphaZero 配方应用于 LLM 推理，以 token 为动作，以数学验证为获胜信号。

## 概念

![AlphaZero ↔ MuZero ↔ GRPO：相同循环，不同环境](../assets/rl-games.svg)

**统一循环。**

`
while True:
    trajectory = self_play(current_policy, search)     # 与自己对弈
    policy_target = search.improved_policy(trajectory) # 搜索改进原始策略
    policy_net.update(policy_target, value_target)     # 在搜索输出上监督学习
`

**AlphaZero（2017）。** Silver 等人。给定一个已知规则的游戏（国际象棋、将棋、围棋）：

- 策略-价值网络：一个主干 _θ(s) → (p, v)。p 是合法走法的先验分布。 是期望的游戏结果。
- 蒙特卡洛树搜索（MCTS）：在每一步，展开一个可能后续的树。使用 (p, v) 作为先验 + 自助。通过 UCB（PUCT）选择节点：* = argmax Q(s, a) + c · p(a|s) · √N(s) / (1 + N(s, a))。
- 自我对弈：智能体 vs 智能体对弈。在第 	 步，MCTS 访问分布 π_t 成为策略训练目标。
- 损失：L = (v - z)² - π · log p + c · ||θ||²。z 是游戏结果（+1 / 0 / -1）。

零人类知识。零手工启发式。一个单一的配方，在各自数千万次自我对弈后掌握了国际象棋、将棋和围棋。

**MuZero（2019）。** Schrittwieser 等人。去除了规则必须已知的要求。

- 不依赖于固定环境，学习一个**潜在动力学模型** (h, g, f)：
  - h(s)：将观测编码到潜在状态。
  - g(s_latent, a)：预测下一个潜在状态 + 奖励。
  - (s_latent)：预测策略先验 + 价值。
- MCTS 在**学到的潜在空间**中运行。相同的搜索，相同的训练循环。
- 适用于围棋、国际象棋、将棋**和** Atari——一个算法，无需规则知识。

**随机 MuZero（2022）。** 添加随机动力学和机会节点；扩展到西洋双陆棋类游戏。

**Muesli、Gumbel MuZero（2022-2024）。** 在样本效率和确定性搜索上的改进。

**GRPO（2024-2025）。** DeepSeek-R1 配方。与 AlphaZero 形状相同的循环，应用于语言模型推理：

- "游戏"：回答一个数学 / 编码 / 推理问题。"赢" = 验证器（测试用例通过、数值答案匹配）返回 1。
- 策略：LLM。动作：token。状态：提示 + 已生成的回答。
- 没有评论家（PPO 风格的 V_φ）。相反，对每个提示，从策略中采样 G 个完成。计算每个的奖励。使用**组相对优势** A_i = (r_i - mean_r) / std_r 作为 REINFORCE 风格更新的信号。
- 对参考策略的 KL 惩罚以防止漂移（如 RLHF）。
- 完整损失：

  L_GRPO(θ) = -E_{q, {o_i}} [ (1/G) Σ_i A_i · log π_θ(o_i | q) ] + β · KL(π_θ || π_ref)

没有奖励模型，没有评论家，没有 MCTS。组相对基线取代了三者。在推理基准上以一小部分计算量达到或超过 PPO-RLHF 的质量。

**完整的 R1 配方。** DeepSeek-R1（DeepSeek 2025）在一篇论文中包含了两个模型：

- **R1-Zero。** 从 DeepSeek-V3 基础模型开始。没有 SFT。直接应用 GRPO，使用两个奖励组件：*准确率奖励*（基于规则的——最终答案是否解析为正确数字 / 代码是否通过单元测试）和*格式奖励*（完成是否将其思维链包裹在 <think>…</think> 标签中）。经过数千步，平均回答长度从约 100 增长到约 10,000 个 token，数学基准分数攀升到接近 o1-preview 的水平。模型从零开始学习推理。缺点：其思维链通常难以阅读，混合多种语言，缺乏风格上的精炼。
- **R1。** 通过四个阶段流程修复 R1-Zero 的可读性问题：
  1. **冷启动 SFT。** 收集几千条具有清晰格式的长 CoT 示范。在它们上监督微调基础模型。这提供了一个可读的起点。
  2. **面向推理的 GRPO。** 应用 GRPO，使用准确率+格式奖励，加上*语言一致性*奖励以防止语言切换。
  3. **拒绝采样 + 第二轮 SFT。** 从 RL 检查点采样约 60 万条推理轨迹，只保留那些具有正确最终答案和可读 CoT 的，并与约 20 万条非推理 SFT 示例（写作、问答、自我认知）合并。再次微调基础模型。
  4. **全谱 GRPO。** 再一轮 RL，涵盖推理（基于规则的奖励）和一般对齐（有帮助性/无害性基于偏好的奖励）。

结果在 AIME 和 MATH-500 上以开放权重匹配 o1，并且规模足够小以进行蒸馏。同一篇论文还通过 SFT 在 R1 的推理轨迹上发布了六个蒸馏密集模型（Qwen-1.5B 到 Llama-70B）——学生端没有 RL。强 RL 教师的知识蒸馏始终优于在学生规模上从头开始 RL。

**为什么推理用 GRPO 而不是 PPO。** DeepSeekMath 论文（2024 年 2 月）中的三个原因：(1) 不需要训练价值网络，内存减半；(2) 组基线自然处理推理任务产生的稀疏轨迹末尾奖励；(3) 每个提示的归一化使得优势在不同的难度问题上具有可比性，而 PPO 的单个评论家无法做到。

**无搜索 vs 基于搜索。** 游戏已经分支：

- *具有长视野的完美信息游戏*（围棋、国际象棋）：仍然基于搜索。AlphaZero / MuZero 占主导。
- *LLM 推理*：生产中还没有 MCTS；使用完整 rollout 的 GRPO，推理时用 Best-of-N。过程奖励模型（PRM）暗示正在逐步添加步骤级搜索。

## 动手构建

code/main.py 中的代码实现了**微型 GRPO**——一个具有多个采样组的 bandit 问题。算法与 LLM 上的相同；只有策略和环境更简单。它教授了**损失**和**组相对优势**，这是 2025 年的创新。

### 步骤 1：微型验证器环境

`python
QUESTIONS = [
    {"prompt": "q1", "correct": 3},
    {"prompt": "q2", "correct": 1},
]

def verify(prompt_idx, answer_token):
    return 1.0 if answer_token == QUESTIONS[prompt_idx]["correct"] else 0.0
`

在真实的 GRPO 中，验证器运行单元测试或检查数学等式。

### 步骤 2：策略：每个提示在 K 个答案 token 上的 softmax

`python
def policy_probs(theta, p_idx):
    return softmax(theta[p_idx])
`

等价于 LLM 在给定提示条件下最后一层的输出。

### 步骤 3：组采样和组相对优势

`python
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
    # KL 惩罚：将 theta 拉向参考
    for i in range(len(probs)):
        theta[p_idx][i] -= beta * (theta[p_idx][i] - reference[p_idx][i])
`

组相对优势是 2024 年 DeepSeek 的技巧。不需要评论家。"基线"是组均值，归一化使用组标准差。

### 步骤 4：与 REINFORCE 基线比较（无价值函数）

相同的设置，相同的计算，普通的 REINFORCE。GRPO 收敛更快且更稳定。

### 步骤 5：观察熵和 KL

与 RLHF 相同的诊断指标：对参考的平均 KL、策略熵、奖励随时间的变化。一旦这些稳定下来，训练就完成了。

## 常见陷阱

- **通过验证器游戏的奖励破解。** GRPO 继承了 RLHF 的风险：如果验证器是错误的或可被利用的，LLM 会找到利用方式。鲁棒的验证器（多个测试用例、形式化证明）很重要。
- **组大小太小。** 组基线的方差与 1/√G 成比例。低于 G = 4，优势信号有噪声；标准选择是 G = 8 到 64。
- **长度偏差。** 不同长度的 LLM 完成有不同的对数概率。通过 token 数归一化，或使用序列级别的对数概率，或截断到最大长度。
- **纯自我对弈循环。** AlphaZero 风格的训练可能在一般和游戏中陷入主导循环。通过多样化的对手池（联赛玩法，课程 10）来缓解。
- **搜索-策略不匹配。** AlphaZero 训练策略以模仿搜索输出。如果策略网络太小而无法表示搜索的分布，训练会停滞。
- **计算门槛。** MuZero / AlphaZero 需要大量计算。一次消融实验通常需要数百 GPU 小时。存在用于学习的微型演示（例如 Connect Four 上的 AlphaZero）。
- **验证器覆盖范围。** 对有 bug 的解决方案也通过的单元测试会强化 bug。设计能捕获边缘情况的验证器。

## 使用场景

2026 年游戏 RL 的格局，按领域划分：

| 领域 | 主导方法 |
|--------|-----------------|
| 双人零和棋盘游戏（围棋、国际象棋、将棋） | AlphaZero / MuZero / KataGo |
| 不完美信息纸牌游戏（扑克） | CFR + 深度学习（DeepStack、Libratus、Pluribus）|
| Atari / 像素游戏 | Muesli / MuZero / IMPALA-PPO |
| 大型多人策略游戏（Dota、StarCraft） | PPO + 自我对弈 + 联赛（OpenAI Five、AlphaStar）|
| LLM 数学/代码推理 | GRPO（DeepSeek-R1、Qwen-RL、开源复现）|
| LLM 对齐 | DPO / RLHF-PPO（不是 GRPO；验证器是偏好而非可验证）|
| 机器人 | PPO + DR（不是游戏 RL，但使用相同的策略梯度工具）|
| 组合问题 | AlphaZero 变体（AlphaTensor、AlphaDev）|

**配方**——自我对弈、搜索增强改进、策略蒸馏——跨越了文本、像素和物理控制。GRPO 是最年轻的一个实例；更多的还在路上。

## 交付物

保存为 outputs/skill-game-rl-designer.md：

`markdown
---
name: game-rl-designer
description: 为给定领域设计游戏 RL 或推理 RL 训练流程（AlphaZero / MuZero / GRPO）。
version: 1.0.0
phase: 9
lesson: 12
tags: [rl, alphazero, muzero, grpo, self-play]
---

给定一个目标（完美信息游戏 / 不完美信息 / Atari / LLM 推理 / 组合问题），输出：

1. 环境适配。已知规则？马尔可夫？随机？多智能体？决定 AlphaZero vs MuZero vs GRPO。
2. 搜索策略。MCTS（带学习先验的 PUCT）、Gumbel 采样、Best-of-N 或无。
3. 自我对弈计划。对称自我对弈 / 联赛 / 离线数据 / 验证器生成。
4. 目标信号。游戏结果 / 验证器奖励 / 偏好 / 学习模型。包含鲁棒性计划。
5. 诊断指标。与基线的胜率、ELO 曲线、验证器通过率、对参考的 KL。

拒绝在不完美信息游戏上使用 AlphaZero（引导到 CFR）。拒绝在没有可信验证器的情况下使用 GRPO。拒绝任何没有固定基线对手集的游戏 RL 流程（否则自我对弈 ELO 未校准）。
`

## 练习

1. **简单。** 在 code/main.py 中实现 GRPO bandit。在 2 个提示 × 每个 4 个答案 token 上训练。在 G=8 时在 < 1,000 次更新内收敛。
2. **中等。** 接入 PPO（裁剪版）和原始 REINFORCE。在同一个 bandit 上比较样本效率和奖励方差与 GRPO。
3. **困难。** 扩展到长度为 2 的"推理链"：智能体发出两个 token，验证器奖励这对 token。衡量 GRPO 如何处理跨两步序列的信用分配。（提示：按**完整序列**计算组优势，传播到两个 token 位置。）

## 关键术语

| 术语 | 人们说的 | 实际意思 |
|------|-----------------|-----------------------|
| MCTS | "带学习网络的树搜索" | 蒙特卡洛树搜索；使用学习到的 (p, v) 先验进行 UCB1/PUCT 选择。 |
| AlphaZero | "自我对弈 + MCTS" | 策略-价值网络训练以匹配 MCTS 访问和游戏结果。 |
| MuZero | "学习模型的 AlphaZero" | 相同循环但在潜在空间中通过学习的动力学进行。 |
| GRPO | "无评论家的 PPO" | 组相对策略优化；带组均值基线 + KL 的 REINFORCE。 |
| PUCT | "AlphaZero 的 UCB" | Q + c · p · √N / (1 + N_a)——用先验平衡价值估计。 |
| 自我对弈 | "智能体 vs 过去的自己" | 零和游戏的标准；对称的训练信号。 |
| 联赛玩法 | "基于种群的自我对弈" | 过去 + 当前 + 利用者作为对手采样。 |
| 验证器奖励 | "可验证的 RL" | 奖励来自确定性检查器（测试通过、答案匹配）。 |
| 过程奖励 | "PRM" | 对每个推理步骤评分，而不仅仅是最终答案。 |

## 扩展阅读

- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270).
- [Silver et al. (2018). A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play (AlphaZero)](https://www.science.org/doi/10.1126/science.aar6404).
- [Schrittwieser et al. (2020). Mastering Atari, Go, chess and shogi by planning with a learned model (MuZero)](https://www.nature.com/articles/s41586-020-03051-4).
- [Vinyals et al. (2019). Grandmaster level in StarCraft II (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z).
- [DeepSeek-AI (2024). DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models (GRPO)](https://arxiv.org/abs/2402.03300) — 引入 GRPO 和组相对基线的论文。
- [DeepSeek-AI (2025). DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948) — 完整的四阶段 R1 配方加上 R1-Zero 消融实验。
- [Brown et al. (2019). Superhuman AI for multiplayer poker (Pluribus)](https://www.science.org/doi/10.1126/science.aay2400) — 大规模 CFR + 深度学习。
- [Tesauro (1995). Temporal Difference Learning and TD-Gammon](https://dl.acm.org/doi/10.1145/203330.203343) — 开启一切的论文。
- [Hugging Face TRL — GRPOTrainer](https://huggingface.co/docs/trl/main/en/grpo_trainer) — 使用自定义奖励函数应用 GRPO 的生产参考。
- [Qwen Team (2024). Qwen2.5-Math — GRPO replication](https://github.com/QwenLM/Qwen2.5-Math) — 多个规模的 R1 配方开源复现。
- [Sutton & Barto (2018). Ch. 17 — Frontiers of Reinforcement Learning](http://incompleteideas.net/book/RLbook2020.pdf) — 关于自我对弈、搜索和 R1 在 LLM 规模上实例化的"设计奖励"的教材框架。