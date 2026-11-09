# 游戏的RL AlphaZero,MuZero,和LLM推理时代

> 1992年:TD-Gammon在纯TD后游中击败了人类冠军. 2016年:AlphaGo击败了Lee Sedol. 2017年:AlphaZero从零开始主导了象棋,肖吉和GO. 2025年:DeepSeek-R1证明了相同的配方,GRP取代了PPO,基于推理.游戏是推动这一阶段的每一个突破的基准.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 05 (DQN), Phase 9 · 08 (PPO), Phase 9 · 09 (RLHF), Phase 9 · 10 (MARL)
**Time:** ~120 minutes

## 问题

游戏拥有RL想要的一切. 清洁的奖励 (胜负). 无限的集 (自动游戏重置). 完美的模拟 (游戏 *是*模拟器). 微小或连续的行动空间. 多代理结构,强迫对手的强度.

游戏是每个主要的RL突破都被测试的方法. 果 (背, 1992). 根据"中国"的规定, 其他类型: 果产品 开放AI五 (第2号) 星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星际星 泽罗 (学习模型,2019) 子 (矩阵乘法,2022年) 根据"国际数据"的规定, 最新的证明,游戏RL技术在文本上工作.

这块顶石通过一个统一镜头来测试了三个具有里程碑意义的建筑:**self-play + search + policy improvement**每个都将前一个概括起来;特别是GRPO是AlphaZero的配方,用于LLM推理,作为行动的代币和数学验证作为胜利信号.

## 概念

![AlphaZero ↔ MuZero ↔ GRPO: same loop, different environments](../assets/rl-games.svg)

**The unifying loop.**

```
while True:
    trajectory = self_play(current_policy, search)     # play game against self
    policy_target = search.improved_policy(trajectory) # search improves raw policy
    policy_net.update(policy_target, value_target)     # supervised on search output
```

**AlphaZero (2017).**银等. 根据已知规则的游戏 (象棋,肖吉,戈):

- 政策价值网络:一个塔$f_\theta(s) \to (p, v)$现在,我们要去.$p$法律行动的先驱.$v$游戏的预期结果.
- 果树搜索 (MCTS):每次移动,扩展一个可能的延续的树. 使用 $(p, v)$按 UCB (PUCT) 选择节点: $a^{\ast} = \arg\max_a Q(s, a) + c \cdot p(a \mid s) \cdot \sqrt{N(s)} / (1 + N(s, a))$现在,我们要去.
- 玩自己游戏:玩代理对代理.$t$士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,士,$\pi_t$成为政策培训目标.
- 损失:$L = (v - z)^2 - \pi \cdot \log p + c \cdot \lVert \theta \rVert^2$现在,我们要去.$z$是游戏结果 (+1 / 0 / -1).

没有人知道,没有手工修复,只有一个食谱, 掌握了几万个自动游戏的棋牌,肖吉和戈.

**MuZero (2019).**施里特维泽等. 取消了规则的要求.

- 学习一个置动态模型$(h, g, f)$其他:
  - $h(s)$编码观察到隐形状态.
  - $g(s_{\text{latent}}, a)$预测下一个潜伏状态 + 奖励.
  - $f(s_{\text{latent}})$预测政策前值.
-  MCTS在"学习的隐藏空间"中运行.
- 运行在棋牌,棋牌,肖吉和阿塔利,一个算法,没有规则知识.

**Stochastic MuZero (2022).**增加了动力和机会节点; 扩展到后游类游戏.

**Muesli, Gumbel MuZero (2022-2024).**样品效率和确定性搜索的提高.

**GRPO (2024-2025).**,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,

- "游戏":回答数学/编码/推理问题. "Win" =验证器 (测试案例通过,数值答案匹配) 返回1.
- 政策:法师. 行动:代币. 状态:快速+反应-迄今.
- 没有批评者 (PPO风格)$V_\phi$代替每次提示,$G$根据政策的完成,每一个收费的收费.**group-relative advantage** $A_i = (r_i - \text{mean}_r) / \text{std}_r$作为REINFORCE类型更新的信号.
- 根据"海上海域"的规定,海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域海域.
- 完全损失:

  $L_{\text{GRPO}}(\theta) = -\mathbb E_{q, \lbrace o_i \rbrace} \left[ \frac{1}{G} \sum_i A_i \cdot \log \pi_\theta(o_i \mid q) \right] + \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$

没有学习的奖励模型,没有评论员,没有MCTS.基于规则的验证器提供奖励,组相关的基线取代了评论员,搜索步骤被放弃.在计算的小部分上匹配或超过推理基准的PPO-RLHF质量.

**The R1 recipe in full.**根据该报告,该报告的内容包括:

- **R1-Zero.**从DeepSeek-V3基模型开始.没有SFT.直接使用两个奖励组件应用GRPO: *准确性奖励* (基于规则的是否对最终答案进行了正确的解析,/代码是否通过单元测试) 和 *格式奖励* (完成是否包裹了其思想链在`<think>…</think>`通过数千个步骤,平均响应长度从100到10,000个代币,数学基准分数升到接近o1预览水平.该模型从零开始学习推理.缺点:它的思想链往往是不可读的,语言混合,缺乏风格抛光.
- **R1.**通过四阶段管道来解决R1-Zero的可读性问题:
  1. **Cold-start SFT.**收集几千个长时间的CoT示范, 进行清洁格式化, 监督, 调整它们的基模型. 这就给出了可读的起点.
  2. **Reasoning-oriented GRPO.**应用GRPPO,加上准确性+格式奖励以及*语言一致性*奖励,以防止代码交换.
  3. **Rejection sampling + SFT round 2.**从RL检查点采样600K的推理轨迹,只保留具有正确的最终答案和可读的CoT的轨迹,并将其结合到200K的非推理SFT例子 (写作,质量检查,自我认知).再次调整基础.
  4. **Full-spectrum GRPO.**另一个RL轮,涵盖了推理 (基于规则的奖励) 和一般的调整 (基于有用性/无害性偏好的奖励).

结果与AIME和 MATH-500的o1相匹配,并且足够小,可以蒸.同样的论文还通过SFT'ing对R1的推理痕迹进行释放六种蒸密集模型 (Qwen-1.5B到Llama-70B).学生没有RL.强大的RL教师的蒸始终从零开始击败RL.

**Why GRPO instead of PPO for reasoning.**根据DeepSeekMath论文 (Feb 2024) 的三个原因: (1) 没有值网络训练,将记忆减半; (2) 组基线自然处理了推理任务产生的稀少轨迹结尾奖励; (3) 每次调整使得不同难度的问题中的优势相对而易见,这是PPO的单独批评者无法做到的.

**Search-free vs search-based.**游戏分类:

- *长视野的完美信息游戏* (Go,棋牌):仍然基于搜索.
- *LLM推理*:目前还没有 MCTS; GRPO在完整的推广,最好的推理计算.过程奖励模型 (PRM) 暗示了阶段级搜索被添加回来.

```figure
f3-selfplay-ladder
```

## 建立它

编码在`code/main.py`实现**GRPO in miniature**专业的专业知识是:一个具有多组样本的强盗.算法与LLM相同;只有政策和环境更简单.它教导了*损失*和*组相关优势*,这是DeepSeekMath的2024年创新.

### 步骤1:一个小的验证器环境

```python
QUESTIONS = [
    {"prompt": "q1", "correct": 3},
    {"prompt": "q2", "correct": 1},
]

def verify(prompt_idx, answer_token):
    return 1.0 if answer_token == QUESTIONS[prompt_idx]["correct"] else 0.0
```

在真正的GRPO中,验证器执行单位测试或检查数学等式.

### 步骤2:政策:每提示的软max超过K答案代币

```python
def policy_probs(theta, p_idx):
    return softmax(theta[p_idx])
```

相当于一个即时的LLM的最终层输出.

### 阶段3:集团采样和集团相对优势

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

根据"基线"的定义,该组的平均值是"基线"的平均值,而正常化则使用"基层" (group std).

### 步骤4:与REINFORCE基线 (无价值) 进行比较

它们的设置和计算相同, 它们的复核能力也相同.

### 步骤5:观察和KL

根据"RLHF"的诊断, 平均KL是指标,政策透,奖励过时间.

## 陷

- **Reward hacking via verifier gaming.**经验者可能会发现实验者是错误的或可利用的.
- **Group size too small.**基准差异为:$1/G$(其标准错误如$1/\sqrt{G}$下面$G = 4$优势信号是噪音的;标准选择是$G = 8$现在,我们要做什么?
- **Length bias.**通过代币计数正常化,或使用序列级日志检查,或缩小到最大长度.
- **Pure self-play cycles.**球运动的总数可以被各种对手游泳池减轻 (联盟比赛,10课).
- **Search-policy mismatch.**如果政策网太小,不能代表搜索的分布,训练站.
- **Compute floor.**子/阿尔法零需要大量的计算.一个单个的除通常需要数百个GPU-小时.小型演示程序 (例如,AlphaZero在连接四) 为学习而存在.
- **Verifier coverage.**通过一个错误解决方案的单元测试,加强了错误. 设计验证器,

## 用它

游戏-RL2026年景观,按领域:

| Domain | Dominant method |
|--------|-----------------|
| Two-player zero-sum board games (Go, chess, shogi) | AlphaZero / MuZero / KataGo |
| Imperfect info card games (poker) | CFR + deep learning (DeepStack, Libratus, Pluribus) |
| Atari / pixel games | Muesli / MuZero / IMPALA-PPO |
| Large multiplayer strategy (Dota, StarCraft) | PPO + self-play + league (OpenAI Five, AlphaStar) |
| LLM math/code reasoning | GRPO (DeepSeek-R1, Qwen-RL, open replications) |
| LLM alignment | DPO / RLHF-PPO (not GRPO; verifier is preference not verifiable) |
| Robotics | PPO + DR (not game-RL, but uses same policy-gradient tools) |
| Combinatorial problems | AlphaZero variants (AlphaTensor, AlphaDev) |

食谱* 自动玩,搜索增强改进,政策蒸 跨越文字,像素和物理控制.

## 运送它

保存如`outputs/skill-game-rl-designer.md`其他:

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

## 运动

1. **Easy.**执行 GRPO 强盗在`code/main.py`训练用2个提示 ×4个答案代币.  konverge 在<1000个更新中$G=8$现在,我们要去.
2. **Medium.**入PPO (剪切) 和尼拉 REINFORCE. 比较样品效率和奖励差异与GRPO在同一名强盗.
3. **Hard.**扩展到长度-2的"推理链":代理发出两个代币,验证者奖励对.测量GRPO如何处理两个步骤的序列中信用分配. (提示:计算组优势每 *完整序列*,扩散到两个代币位置).

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MCTS | "Tree search with learned net" | Monte Carlo Tree Search; UCB1/PUCT selection with learned $(p, v)$ priors. |
| AlphaZero | "Self-play + MCTS" | Policy-value net trained to match MCTS visits and game outcome. |
| MuZero | "Learned-model AlphaZero" | Same loop but in latent space via learned dynamics. |
| GRPO | "Critic-free PPO" | Group Relative Policy Optimization; REINFORCE with group-mean baseline + KL. |
| PUCT | "AlphaZero's UCB" | $Q + c \cdot p \cdot \sqrt{N} / (1 + N_a)$ — balances value estimate with prior. |
| Self-play | "Agent vs past self" | Standard for zero-sum; symmetric training signal. |
| League play | "Population-based self-play" | Past + current + exploiters sampled as opponents. |
| Verifier reward | "Verifiable RL" | Reward comes from a deterministic checker (tests pass, answer matches). |
| Process reward | "PRM" | Scores each reasoning step, not just the final answer. |

## 进一步阅读

- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270)现在,我们要去.
- [Silver et al. (2018). A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play (AlphaZero)](https://www.science.org/doi/10.1126/science.aar6404)现在,我们要去.
- [Schrittwieser et al. (2020). Mastering Atari, Go, chess and shogi by planning with a learned model (MuZero)](https://www.nature.com/articles/s41586-020-03051-4)现在,我们要去.
- [Vinyals et al. (2019). Grandmaster level in StarCraft II (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z)现在,我们要去.
- [DeepSeek-AI (2024). DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models (GRPO)](https://arxiv.org/abs/2402.03300)引入GRPO和组相关基准的论文.
- [DeepSeek-AI (2025). DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948)全四阶段R1配方加上R1-零的除.
- [Brown et al. (2019). Superhuman AI for multiplayer poker (Pluribus)](https://www.science.org/doi/10.1126/science.aay2400)CFR+深度学习规模.
- [Tesauro (1995). Temporal Difference Learning and TD-Gammon](https://dl.acm.org/doi/10.1145/203330.203343)报纸是这一切的起始.
- [Hugging Face TRL — GRPOTrainer](https://huggingface.co/docs/trl/main/en/grpo_trainer)用于使用定制奖励功能的GRPO生产参考.
- [Qwen Team (2024). Qwen2.5-Math — GRPO replication](https://github.com/QwenLM/Qwen2.5-Math)多个尺度上对R1配方的开放复制.
- [Sutton & Barto (2018). Ch. 17 — Frontiers of Reinforcement Learning](http://incompleteideas.net/book/RLbook2020.pdf)R1在LLM规模上设置的自动游戏,搜索和"设计奖励"的教科书框架.
