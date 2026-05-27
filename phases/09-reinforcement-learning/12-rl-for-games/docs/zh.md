# 游戏RL——AlphaZero、MuZero与LLM推理时代

> 1992年：TD-Gammon（时差双陆棋）凭借纯时差学习（TD）击败人类冠军。2016年：AlphaGo击败李世石。2017年：AlphaZero从零开始称霸国际象棋、将棋和围棋。2024年：DeepSeek-R1证明同样的配方（用GRPO替代PPO）适用于推理。游戏是推动这一阶段每个突破的基准。

**类型：** 构建  
**语言：** Python  
**前置知识：** 第9阶段·05（DQN），第9阶段·08（PPO），第9阶段·09（RLHF），第9阶段·10（MARL）  
**时间：** 约120分钟

## 问题

游戏拥有强化学习（RL）所需的一切。清晰的奖励（赢/输）。无限的回合（自我对弈可重置）。完美的仿真（游戏本身就是仿真器）。离散或小规模连续动作空间。强制对抗鲁棒性的多智能体结构。

而这些游戏正是每个重大RL突破的测试平台。TD-Gammon（双陆棋，1992年）。Atari-DQN（2013年）。AlphaGo（2016年）。AlphaZero（2017年）。OpenAI Five（Dota 2，2019年）。AlphaStar（星际争霸II，2019年）。MuZero（学习模型，2019年）。AlphaTensor（矩阵乘法，2022年）。AlphaDev（排序算法，2023年）。DeepSeek-R1（数学推理，2025年）——最新证明游戏RL技术适用于文本。

本专题通过一个统一的视角审视三种里程碑式架构——AlphaZero、MuZero和GRPO：**自我对弈 + 搜索 + 策略改进**。每一种都是前一种的泛化；尤其是GRPO，它是AlphaZero的配方应用于LLM推理，以token为动作，以数学验证为获胜信号。

## 概念

![AlphaZero ↔ MuZero ↔ GRPO：相同循环，不同环境](../assets/rl-games.svg)

**统一循环。**

```
while True:
    trajectory = self_play(current_policy, search)     # 使用当前策略和搜索进行自我对弈
    policy_target = search.improved_policy(trajectory) # 搜索改进原始策略
    policy_net.update(policy_target, value_target)     # 在搜索输出上进行监督学习
```

**AlphaZero（2017年）。** Silver等人。给定一个规则已知的游戏（国际象棋、将棋、围棋）：

- 策略价值网络：一个塔`f_θ(s) → (p, v)`。`p`是合法动作上的先验概率。`v`是预期游戏结果。
- 蒙特卡洛树搜索（MCTS）：每步走棋时，扩展一个可能后续棋局的树。使用`(p, v)`作为先验和引导。通过UCB（PUCT）选择节点：`a* = argmax Q(s, a) + c · p(a|s) · √N(s) / (1 + N(s, a))`。
- 自我对弈：智能体与自身对弈。在第`t`步，MCTS的访问分布`π_t`成为策略的训练目标。
- 损失函数：`L = (v - z)² - π · log p + c · ||θ||²`。`z`是游戏结果（+1 / 0 / -1）。

零人类知识。零手工特征。一个统一的配方，每个游戏经过数千万局自我对弈后，就掌握了国际象棋、将棋和围棋。

**MuZero（2019年）。** Schrittwieser等人。移除了规则已知的要求。

- 不再使用固定环境，而是学习一个*隐式动力学模型* `(h, g, f)`：
  - `h(s)`：将观测编码为隐状态。
  - `g(s_latent, a)`：预测下一个隐状态和奖励。
  - `f(s_latent)`：预测策略先验和价值。
- MCTS在*学习到的隐空间*中运行。相同的搜索，相同的训练循环。
- 在围棋、国际象棋、将棋*和*Atari上均有效——一个算法，无需规则知识。

**随机MuZero（2022年）。** 增加了随机动力学和机会节点；扩展到双陆棋类游戏。

**Muesli、Gumbel MuZero（2022-2024年）。** 在样本效率和确定性搜索方面的改进。

**GRPO（2024-2025年）。** DeepSeek-R1配方。与AlphaZero相同的循环，应用于语言模型推理：

- “游戏”：回答数学/编程/推理问题。“赢”=验证器（测试用例通过、数值答案匹配）返回1。
- 策略：LLM。动作：token。状态：提示词 + 已生成的回答。
- 无评论家（PPO风格的V_φ）。相反，对每个提示词，从策略中采样`G`个完整回答。计算每个回答的奖励。使用**组相对优势（Group-Relative Advantage）** `A_i = (r_i - mean_r) / std_r`作为REINFORCE风格更新的信号。
- 对参考策略施加KL惩罚以防止漂移（类似RLHF）。
- 完整损失：

  `L_GRPO(θ) = -E_{q, {o_i}} [ (1/G) Σ_i A_i · log π_θ(o_i | q) ] + β · KL(π_θ || π_ref)`

无需奖励模型、评论家或MCTS。组相对基线替代了三者。在推理基准上，匹配或超过PPO-RLHF质量，计算量却少得多。

**完整的R1配方。** DeepSeek-R1（DeepSeek 2025）在单篇论文中提出了两个模型：

- **R1-Zero。** 从DeepSeek-V3基础模型开始。无需SFT（监督微调）。直接应用GRPO，包含两个奖励组件：*准确性奖励*（基于规则——最终答案是否解析为正确数字/代码是否通过单元测试）和*格式奖励*（回答是否将思维链包裹在``标签中）。经过数千步后，平均响应长度从约100个token增长到约10,000个token，数学基准分数接近o1-preview水平。模型从零开始学会推理。缺点是：其思维链往往难以阅读、混合多种语言、缺乏风格上的打磨。
- **R1。** 通过一个四阶段流水线修复R1-Zero的可读性问题：
  1. **冷启动SFT。** 收集几千条格式整洁的长思维链示例。基于这些示例对基础模型进行监督微调。这提供了可读的起点。
  2. **面向推理的GRPO。** 应用GRPO，使用准确性+格式奖励，外加一个*语言一致性*奖励以防止语码转换。
  3. **拒绝采样 + 第二轮SFT。** 从RL检查点采样约60万条推理轨迹，只保留最终答案正确且思维链可读的轨迹，并组合约20万条非推理SFT示例（写作、QA、自我认知）。再次微调基础模型。
  4. **全谱GRPO。** 再进行一轮RL，涵盖推理（基于规则的奖励）和通用对齐（有用性/无害性偏好奖励）。

结果在AIME和MATH-500上以开放权重匹配o1，并且足够小以便蒸馏。同一篇论文还发布了六个蒸馏密集模型（Qwen-1.5B到Llama-70B），通过在R1的推理轨迹上进行SFT——学生模型无需RL。从强RL教师处蒸馏，始终优于在学生自身规模上从零开始进行RL。

**为何在推理中使用GRPO而非PPO。** DeepSeekMath论文（2024年2月）中的三个原因：（1）无需训练价值网络，内存减半；（2）组基线自然处理推理任务产生的稀疏的回合结束奖励；（3）每个提示词的归一化使得优势在不同难度的问题间具有可比性，而PPO的单一评论家无法做到。

**无搜索 vs. 基于搜索。** 游戏领域已分化为：

- *具有长期视野的完美信息游戏（围棋、国际象棋）*：仍然基于搜索。AlphaZero / MuZero 占主导地位。
- *LLM推理*：目前尚无MCTS投入生产；GRPO使用完整轨迹，推理时使用最佳N采样。过程奖励模型（PRM）暗示逐步搜索可能重新加入。

## 构建它

`code/main.py`中的代码实现了**迷你版GRPO**——一个具有多组样本的赌博机。算法与LLM上的相同；只是策略和环境更简单。它教授2025年的创新点——*损失函数*和*组相对优势*。

### 第一步：一个微小的验证器环境

```python
QUESTIONS = [
    {"prompt": "q1", "correct": 3},
    {"prompt": "q2", "correct": 1},
]

def verify(prompt_idx, answer_token):
    return 1.0 if answer_token == QUESTIONS[prompt_idx]["correct"] else 0.0
```

在真实的GRPO中，验证器运行单元测试或检查数学等式。

### 第二步：策略：每个提示词在K个答案token上的softmax

```python
def policy_probs(theta, p_idx):
    return softmax(theta[p_idx])
```

等价于LLM在给定提示词条件下的最后一层输出。

### 第三步：组采样和组相对优势

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
    # KL惩罚：将theta拉向参考策略
    for i in range(len(probs)):
        theta[p_idx][i] -= beta * (theta[p_idx][i] - reference[p_idx][i])
```

组相对优势是2024年DeepSeek的秘诀。无需评论家。“基线”是组均值，归一化使用组标准差。

### 第四步：与REINFORCE基线（无价值）比较

相同的设置，相同的计算量，纯REINFORCE。GRPO收敛更快更稳定。

### 第五步：观察熵和KL

与RLHF相同的诊断指标：相对于参考策略的平均KL、策略熵、奖励随时间变化。一旦这些指标稳定，训练就完成了。

## 陷阱

- **通过欺骗验证器获取奖励。** GRPO继承了RLHF的风险：如果验证器有误或可被利用，LLM会找到漏洞。稳健的验证器（多个测试用例、形式化证明）很重要。
- **组大小太小。** 组基线的方差与`1/√G`成正比。当`G < 4`时，优势信号噪声大；标准选择是`G = 8`到`64`。
- **长度偏差。** 不同长度的LLM回答具有不同的对数概率。按token计数归一化，或使用序列级对数概率，或截断到最大长度。
- **纯自我对弈循环。** AlphaZero风格的训练可能在一般和游戏中陷入主导循环。通过多样化的对手池（联赛式训练，见第10课）缓解。
- **搜索-策略不匹配。** AlphaZero训练策略模仿搜索输出。如果策略网络太小，无法表示搜索的分布，训练会停滞。
- **计算量门槛。** MuZero / AlphaZero需要大量计算。单个消融实验往往需要数百GPU小时。存在用于学习的迷你演示（例如，四子棋上的AlphaZero）。
- **验证器覆盖率。** 对有bug的解决方案通过的单元测试会强化bug。设计能捕捉边缘情况的验证器。

## 应用

2026年游戏RL格局，按领域划分：

| 领域 | 主导方法 |
|--------|-----------------|
| 双人零和棋类游戏（围棋、国际象棋、将棋） | AlphaZero / MuZero / KataGo |
| 不完美信息纸牌游戏（扑克） | CFR + 深度学习（DeepStack, Libratus, Pluribus） |
| Atari / 像素游戏 | Muesli / MuZero / IMPALA-PPO |
| 大型多人策略游戏（Dota、星际争霸） | PPO + 自我对弈 + 联赛（OpenAI Five, AlphaStar） |
| LLM数学/代码推理 | GRPO（DeepSeek-R1, Qwen-RL, 开源复现） |
| LLM对齐 | DPO / RLHF-PPO（非GRPO；验证器是偏好而非可验证信号） |
| 机器人 | PPO + DR（非游戏RL，但使用相同的策略梯度工具） |
| 组合优化问题 | AlphaZero变体（AlphaTensor, AlphaDev） |

这个*配方*——自我对弈、搜索增强改进、策略蒸馏——跨越了文本、像素和物理控制。GRPO是最新实例；更多的还在后面。

## 交付

保存为 `outputs/skill-game-rl-designer.md`：

```markdown
---
name: game-rl-designer
description: 为给定领域设计游戏RL或推理RL训练流水线（AlphaZero / MuZero / GRPO）。
version: 1.0.0
phase: 9
lesson: 12
tags: [rl, alphazero, muzero, grpo, self-play]
---

给定目标（完美信息游戏/不完美信息/Atari/LLM推理/组合优化），输出：

1. 环境适配。规则已知？马尔可夫性？随机性？多智能体？决定选择AlphaZero vs MuZero vs GRPO。
2. 搜索策略。MCTS（带学习先验的PUCT）、Gumbel采样、最佳N或无需搜索。
3. 自我对弈计划。对称自我对弈/联赛/离线数据/验证器生成。
4. 目标信号。游戏结果/验证器奖励/偏好/学习模型。包括鲁棒性计划。
5. 诊断指标。对基线的胜率、ELO曲线、验证器通过率、相对于参考策略的KL。

拒绝在不完美信息游戏上使用AlphaZero（应选择CFR）。拒绝在没有可信验证器的情况下使用GRPO。拒绝任何没有固定基线对手集的游戏RL流水线（否则自我对弈ELO无法校准）。
```

## 练习

1. **简单。** 在`code/main.py`中实现GRPO赌博机。在2个提示词×每个提示词4个答案token上训练。用`G=8`在不到1000次更新内收敛。
2. **中等。** 接入PPO（clipped）和原始REINFORCE。在同一赌博机上比较GRPO的样本效率和奖励方差。
3. **困难。** 扩展为长度2的“推理链”：智能体生成两个token，验证器对这对进行奖励。衡量GRPO如何跨两步序列处理信用分配。（提示：按*完整序列*计算组优势，传播到两个token位置。）

## 关键术语

| 术语 | 人们常说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| MCTS | “带学习网络的树搜索” | 蒙特卡洛树搜索；使用学习到的`(p, v)`先验进行UCB1/PUCT选择。 |
| AlphaZero | “自我对弈 + MCTS” | 策略价值网络被训练成匹配MCTS访问分布和游戏结果。 |
| MuZero | “学习模型的AlphaZero” | 相同的循环，但在通过学习到的动力学获得的隐空间中。 |
| GRPO | “无评论家的PPO” | 组相对策略优化（Group Relative Policy Optimization）；带组均值基线和KL惩罚的REINFORCE。 |
| PUCT | “AlphaZero的UCB” | `Q + c · p · √N / (1 + N_a)` — 平衡价值估计与先验。 |
| 自我对弈 | “智能体与过去的自己对抗” | 零和游戏的标准；对称训练信号。 |
| 联赛式训练 | “基于种群的自我对弈” | 从过去、当前和利用者中采样作为对手。 |
| 验证器奖励 | “可验证的RL” | 奖励来自确定性检查器（测试通过、答案匹配）。 |
| 过程奖励 | “PRM” | 对每个推理步骤评分，不仅针对最终答案。 |

## 拓展阅读

- [Silver等人 (2017). 无需人类知识掌握围棋（AlphaGo Zero）](https://www.nature.com/articles/nature24270)。
- [Silver等人 (2018). 通过自我对弈掌握国际象棋、将棋和围棋的通用强化学习算法（AlphaZero）](https://www.science.org/doi/10.1126/science.aar6404)。
- [Schrittwieser等人 (2020). 