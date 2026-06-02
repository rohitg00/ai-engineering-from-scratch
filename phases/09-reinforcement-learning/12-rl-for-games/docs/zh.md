# 游戏中的 RL —— AlphaZero、MuZero 与 LLM 推理时代

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 1992 年：TD-Gammon 用纯 TD 算法击败西洋双陆棋人类冠军。2016 年：AlphaGo 击败李世石。2017 年：AlphaZero 从零开始横扫国际象棋、将棋和围棋。2024 年：DeepSeek-R1 证明同一套配方——把 PPO 换成 GRPO——同样适用于推理任务。游戏，是驱动本阶段每一次重大突破的基准（benchmark）。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 9 · 05 (DQN), Phase 9 · 08 (PPO), Phase 9 · 09 (RLHF), Phase 9 · 10 (MARL)
**Time:** ~120 minutes

## 问题（The Problem）

游戏几乎拥有 RL 想要的一切。干净的奖励（输/赢）。无限的 episode（自博弈即重置）。完美的模拟器（游戏*本身*就是模拟器）。离散或小规模连续的动作空间。多 agent 结构会逼出对抗鲁棒性。

而每一次重大的 RL 突破，都是在游戏上验证的。TD-Gammon（西洋双陆棋，1992）。Atari-DQN（2013）。AlphaGo（2016）。AlphaZero（2017）。OpenAI Five（Dota 2，2019）。AlphaStar（星际争霸 II，2019）。MuZero（学到的模型，2019）。AlphaTensor（矩阵乘法，2022）。AlphaDev（排序算法，2023）。DeepSeek-R1（数学推理，2025）——后者是最新一次证明：游戏 RL 的技术也能用于文本。

这节 capstone 借由一个统一的视角——**自博弈 + 搜索 + 策略改进**——纵览三大里程碑式架构：AlphaZero、MuZero 和 GRPO。每一个都是上一个的推广；尤其是 GRPO，本质上就是把 AlphaZero 的配方搬到 LLM 推理上：token 是动作，数学验证是胜负信号。

## 概念（The Concept）

![AlphaZero ↔ MuZero ↔ GRPO：同一个循环，不同的环境](../assets/rl-games.svg)

**统一循环。**

```
while True:
    trajectory = self_play(current_policy, search)     # play game against self
    policy_target = search.improved_policy(trajectory) # search improves raw policy
    policy_net.update(policy_target, value_target)     # supervised on search output
```

**AlphaZero（2017）。** Silver 等人。给定一个规则已知的游戏（国际象棋、将棋、围棋）：

- Policy-value 网络：单塔结构 `f_θ(s) → (p, v)`。`p` 是合法走法上的先验，`v` 是预期对局结果。
- 蒙特卡洛树搜索（MCTS）：每一步都展开一棵后续可能性的树，用 `(p, v)` 作为先验 + 自举。用 UCB（PUCT）选节点：`a* = argmax Q(s, a) + c · p(a|s) · √N(s) / (1 + N(s, a))`。
- 自博弈：agent 自己跟自己下。在第 `t` 步，MCTS 的访问分布 `π_t` 成为策略训练目标。
- 损失：`L = (v - z)² - π · log p + c · ||θ||²`。`z` 是对局结果（+1 / 0 / -1）。

零人类知识，零手工启发式。一套配方，分别经过几千万局自博弈，就掌握了国际象棋、将棋和围棋。

**MuZero（2019）。** Schrittwieser 等人。去掉了「规则必须已知」这一前提。

- 不再依赖固定环境，而是学一个 *latent dynamics model* `(h, g, f)`：
  - `h(s)`：把观测编码成 latent 状态。
  - `g(s_latent, a)`：预测下一个 latent 状态 + 奖励。
  - `f(s_latent)`：预测策略先验 + 价值。
- MCTS 在 *学到的 latent 空间* 中运行。同样的搜索，同样的训练循环。
- 一套算法，无需规则知识，同时拿下围棋、国际象棋、将棋 *和* Atari。

**Stochastic MuZero（2022）。** 加入随机动力学和概率节点；扩展到西洋双陆这类游戏。

**Muesli、Gumbel MuZero（2022-2024）。** 在样本效率和确定性搜索上的改进。

**GRPO（2024-2025）。** DeepSeek-R1 的配方。同样是 AlphaZero 形状的循环，应用于语言模型推理：

- 「游戏」：解一道数学/编程/推理题。「赢」= 验证器（测试用例通过、数值答案匹配）返回 1。
- 策略：LLM。动作：token。状态：prompt + 已生成的 response。
- 没有 critic（PPO 风格的 V_φ）。取而代之，每个 prompt 从策略中采样 `G` 个 completion，对每个算奖励，用 **group-relative advantage（组内相对优势）** `A_i = (r_i - mean_r) / std_r` 作为 REINFORCE 风格更新的信号。
- 加上对参考策略的 KL 惩罚，防止漂移（同 RLHF）。
- 完整损失：

  `L_GRPO(θ) = -E_{q, {o_i}} [ (1/G) Σ_i A_i · log π_θ(o_i | q) ] + β · KL(π_θ || π_ref)`

没有奖励模型，没有 critic，没有 MCTS。组内相对基线（baseline）一并替代了三者。在推理基准上，以 PPO-RLHF 几分之一的算力，达到甚至超过其质量。

**完整的 R1 配方。** DeepSeek-R1（DeepSeek 2025）一篇论文里其实是两个模型：

- **R1-Zero。** 从 DeepSeek-V3 base 模型起步，无 SFT，直接套 GRPO，奖励由两部分组成：*accuracy reward*（基于规则——最终答案能否解析为正确数字 / 代码能否通过单元测试）和 *format reward*（completion 是否把思维链包裹在 `<think>…</think>` 标签里）。经过几千步训练，平均回复长度从 ~100 token 增长到 ~10,000 token，数学基准成绩攀升至接近 o1-preview 的水平。模型从零学会了推理。代价是：思维链常常难以阅读、混杂多种语言、缺乏文风打磨。
- **R1。** 用四阶段流水线修复 R1-Zero 的可读性问题：
  1. **Cold-start SFT。** 收集几千条格式干净的长 CoT 示范，对 base 模型做监督微调，得到一个可读的起点。
  2. **面向推理的 GRPO。** 在 accuracy + format 奖励之上加一个 *language-consistency*（语言一致性）奖励来防止语种切换，再做 GRPO。
  3. **拒绝采样 + 第二轮 SFT。** 从 RL checkpoint 里采样 ~60 万条推理轨迹，只保留最终答案正确且 CoT 可读的样本，再叠加 ~20 万条非推理 SFT 样本（写作、QA、自我认知），重新微调 base。
  4. **全光谱 GRPO。** 再来一轮 RL，覆盖推理（基于规则的奖励）和通用对齐（基于偏好的有用性/无害性奖励）。

最终模型在 AIME 和 MATH-500 上追平 o1，且开放权重，体量小到能蒸馏。同一篇论文还放出了六个蒸馏后的稠密模型（Qwen-1.5B 到 Llama-70B），方法是用 R1 的推理轨迹做 SFT——学生端无需 RL。强 RL 教师的蒸馏，在学生量级上始终优于学生端从零做 RL。

**为什么推理用 GRPO 而不是 PPO。** DeepSeekMath 论文（2024 年 2 月）给了三个理由：(1) 不用训练 value 网络，显存减半；(2) 组内基线天然适合推理任务那种稀疏的 end-of-trajectory 奖励；(3) 按 prompt 归一化，让难度天差地别的题目之间 advantage 也可比，这是 PPO 单一 critic 做不到的。

**有搜索 vs 无搜索。** 游戏世界已经分叉：

- *长视野的完美信息博弈*（围棋、国际象棋）：仍以搜索为主，AlphaZero / MuZero 主导。
- *LLM 推理*：生产环境暂时没有 MCTS；GRPO 跑在完整 rollout 上，推理时算力靠 best-of-N。Process reward model（PRM）暗示，step 级别的搜索可能会重新被加回来。

## 动手实现（Build It）

`code/main.py` 里的代码实现了 **GRPO 的迷你版**——一个分多组采样的 bandit。算法跟 LLM 上完全一样，只是策略和环境更简单。它讲的是 *loss* 与 *组内相对优势*——这正是 2025 年的创新所在。

### Step 1：一个迷你的验证器环境

```python
QUESTIONS = [
    {"prompt": "q1", "correct": 3},
    {"prompt": "q2", "correct": 1},
]

def verify(prompt_idx, answer_token):
    return 1.0 if answer_token == QUESTIONS[prompt_idx]["correct"] else 0.0
```

真实 GRPO 里，验证器会跑单元测试或检查数学等式。

### Step 2：策略——每个 prompt 上对 K 个答案 token 做 softmax

```python
def policy_probs(theta, p_idx):
    return softmax(theta[p_idx])
```

等价于 LLM 在某个 prompt 条件下最末层的输出。

### Step 3：分组采样 + 组内相对优势

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

组内相对优势就是 2024 年 DeepSeek 的小妙招：不需要 critic，「baseline」是组均值，归一化用组内标准差。

### Step 4：和 REINFORCE 基线（无 value）对比

同样的设置、同样的算力，跑朴素 REINFORCE。GRPO 收敛更快、更稳。

### Step 5：观察 entropy 与 KL

诊断指标和 RLHF 一致：到参考策略的平均 KL、策略 entropy、reward 随时间的变化。这些稳定下来，训练就完成了。

## 陷阱（Pitfalls）

- **通过愚弄验证器实现 reward hacking。** GRPO 继承了 RLHF 的风险：验证器写错了或可被利用，LLM 一定会找到漏洞。鲁棒的验证器（多个测试用例、形式化证明）很关键。
- **组太小。** 组基线的方差按 `1/√G` 走。`G < 4` 时 advantage 信号太噪；标准选法是 `G = 8` 到 `64`。
- **长度偏置。** 不同长度的 LLM completion 对应不同的 log-probability。要按 token 数归一化、或用序列级 log-prob、或截断到最大长度。
- **纯自博弈循环。** AlphaZero 风格的训练在一般和博弈里可能陷入「统治环」。多样化对手池（联赛 / league play，见第 10 课）可以缓解。
- **搜索-策略不匹配。** AlphaZero 训练策略去模仿搜索输出；如果策略网络小到表达不了搜索的分布，训练就会停滞。
- **算力门槛。** MuZero / AlphaZero 需要海量算力。一次消融实验经常要数百 GPU-小时。学习用途下有迷你 demo（如 Connect Four 上的 AlphaZero）。
- **验证器覆盖。** 对一个有 bug 的方案恰好通过的单元测试，会强化这个 bug。设计验证器时要覆盖边界情况。

## 用起来（Use It）

2026 年的游戏 RL 版图，按领域看：

| 领域 | 主流方法 |
|--------|-----------------|
| 双人零和棋盘游戏（围棋、国际象棋、将棋） | AlphaZero / MuZero / KataGo |
| 不完美信息纸牌（扑克） | CFR + 深度学习（DeepStack、Libratus、Pluribus） |
| Atari / 像素游戏 | Muesli / MuZero / IMPALA-PPO |
| 大型多人策略（Dota、星际争霸） | PPO + 自博弈 + 联赛（OpenAI Five、AlphaStar） |
| LLM 数学/代码推理 | GRPO（DeepSeek-R1、Qwen-RL、开源复刻） |
| LLM 对齐 | DPO / RLHF-PPO（不是 GRPO；验证器是偏好而非可验证信号） |
| 机器人 | PPO + DR（不算游戏 RL，但用同一套 policy-gradient 工具） |
| 组合优化问题 | AlphaZero 变体（AlphaTensor、AlphaDev） |

这套 *配方*——自博弈、搜索增强的策略改进、策略蒸馏——横跨文本、像素和物理控制。GRPO 是最年轻的实例，更多还会到来。

## 上线部署（Ship It）

存为 `outputs/skill-game-rl-designer.md`：

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

## 练习（Exercises）

1. **Easy。** 在 `code/main.py` 里实现 GRPO bandit。在 2 个 prompt × 每个 4 个答案 token 上训练。`G=8` 时在 < 1,000 次更新内收敛。
2. **Medium。** 接入 PPO（clipped）和原始 REINFORCE。在同一个 bandit 上对比它们与 GRPO 的样本效率与 reward 方差。
3. **Hard。** 扩展到长度为 2 的「推理链」：agent 输出两个 token，验证器奖励整对。测一下 GRPO 在两步序列上的 credit assignment（信用分配）表现。（提示：按 *完整序列* 计算组内 advantage，再传播到两个 token 位置。）

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MCTS | "Tree search with learned net" | 蒙特卡洛树搜索；用学到的 `(p, v)` 作先验，按 UCB1/PUCT 选节点。 |
| AlphaZero | "Self-play + MCTS" | Policy-value 网络，训练目标是匹配 MCTS 访问分布与对局结果。 |
| MuZero | "Learned-model AlphaZero" | 同一循环，但通过学到的 dynamics 在 latent 空间里跑。 |
| GRPO | "Critic-free PPO" | Group Relative Policy Optimization；REINFORCE + 组均值基线 + KL。 |
| PUCT | "AlphaZero's UCB" | `Q + c · p · √N / (1 + N_a)` —— 平衡价值估计与先验。 |
| Self-play | "Agent vs past self" | 零和博弈的标配；对称的训练信号。 |
| League play | "Population-based self-play" | 把过去版本 + 当前版本 + exploiter 一起作为对手池采样。 |
| Verifier reward | "Verifiable RL" | 奖励来自一个确定性的检查器（测试通过、答案匹配）。 |
| Process reward | "PRM" | 给推理的每一步打分，而不仅仅是最终答案。 |

## 延伸阅读（Further Reading）

- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270).
- [Silver et al. (2018). A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play (AlphaZero)](https://www.science.org/doi/10.1126/science.aar6404).
- [Schrittwieser et al. (2020). Mastering Atari, Go, chess and shogi by planning with a learned model (MuZero)](https://www.nature.com/articles/s41586-020-03051-4).
- [Vinyals et al. (2019). Grandmaster level in StarCraft II (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z).
- [DeepSeek-AI (2024). DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models (GRPO)](https://arxiv.org/abs/2402.03300) —— 提出 GRPO 与组内相对基线的论文。
- [DeepSeek-AI (2025). DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948) —— 完整四阶段 R1 配方加 R1-Zero 消融。
- [Brown et al. (2019). Superhuman AI for multiplayer poker (Pluribus)](https://www.science.org/doi/10.1126/science.aay2400) —— 大规模 CFR + 深度学习。
- [Tesauro (1995). Temporal Difference Learning and TD-Gammon](https://dl.acm.org/doi/10.1145/203330.203343) —— 一切的开端。
- [Hugging Face TRL — GRPOTrainer](https://huggingface.co/docs/trl/main/en/grpo_trainer) —— 用自定义奖励函数跑 GRPO 的生产参考实现。
- [Qwen Team (2024). Qwen2.5-Math — GRPO replication](https://github.com/QwenLM/Qwen2.5-Math) —— 多个量级上对 R1 配方的开源复刻。
- [Sutton & Barto (2018). Ch. 17 — Frontiers of Reinforcement Learning](http://incompleteideas.net/book/RLbook2020.pdf) —— 自博弈、搜索与「设计奖励」的教科书框架，R1 把它在 LLM 量级上具象化了。
