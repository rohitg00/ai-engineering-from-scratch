# 09 · 奖励建模与 RLHF

> 人类写不出「优质助手回复」的奖励函数，但能比较两条回复并选出更好的那条。把奖励模型拟合到这些比较上，再用强化学习让语言模型对着它优化。Christiano 2017。InstructGPT 2022。正是这套配方把 GPT-3 变成了 ChatGPT。到 2026 年它大部分已被 DPO 取代——但其思维模型依然成立。

**类型：** 构建
**语言：** Python
**前置：** 阶段 5 · 05（情感分析）、阶段 9 · 08（PPO）
**时长：** 约 45 分钟

## 问题所在

你用「下一个 token 预测（next-token-prediction）」目标训练了一个语言模型。它能写出符合语法的英文，但它也会撒谎、啰嗦，并且该拒绝时不拒绝。你无法靠更多预训练来修复这一点——网页文本本身就是问题，而非解药。

你想要一个 *标量奖励（scalar reward）*，能表达「针对指令 X，回复 A 优于回复 B」。手写这样一个奖励函数是不可能的。「有用性（helpfulness）」并不是一个关于 token 的封闭形式表达式。但人类可以比较两条输出并标注偏好。这种数据可以大规模廉价收集。

RLHF（Christiano 等 2017；Ouyang 等 2022）把偏好转化为一个奖励模型，再通过 PPO 让语言模型对着该奖励优化。分三步走：SFT → RM → PPO。正是这套配方交付了 ChatGPT、Claude、Gemini，以及 2023–2025 年间其他所有对齐过的大语言模型。

到 2026 年，PPO 这一步大多被 DPO（阶段 10 · 08）取代，因为它更省算力，且在对齐微调上质量几乎相当。但 *奖励模型* 这一部分仍然支撑着每一个 Best-of-N 采样器、每一条从可验证奖励出发的强化学习（RL-from-verifiable-rewards）管线，以及每一个使用过程奖励模型的推理模型。理解了 RLHF，你就理解了整个对齐技术栈。

## 核心概念

〔图：三阶段 RLHF——SFT、基于成对偏好训练 RM、带 KL 惩罚的 PPO〕

**阶段 1：监督微调（Supervised Fine-Tuning，SFT）。** 从一个预训练基座模型出发。在人类撰写的目标行为示范（遵循指令的回复、有帮助的答复等）上进行微调。结果是一个模型 `π_SFT`，它 *偏向于良好行为*，但仍然拥有无界的动作空间。

**阶段 2：奖励模型（Reward Model）训练。**

- 针对提示 `x`，收集成对的回复 `(y_+, y_-)`，由人类标注为「`y_+` 优于 `y_-`」。
- 训练一个奖励模型 `R_φ(x, y)`，让它给 `y_+` 打更高的分。
- 损失：**Bradley-Terry 成对逻辑斯蒂损失（Bradley-Terry pairwise logistic）**：

  `L(φ) = -E[ log σ(R_φ(x, y_+) - R_φ(x, y_-)) ]`

  σ 是 sigmoid。奖励之差对应偏好的对数几率（log-odds）。BT 自 1952 年（Bradley-Terry）起就是标准做法，也是现代 RLHF 中的主流选择。

- `R_φ` 通常由 SFT 模型初始化，并在其上加一个标量头（scalar head）。共用同一个 transformer 主干；一个线性层输出奖励。

**阶段 3：带 KL 惩罚、对着 RM 跑的 PPO。**

- 用 `π_SFT` 初始化可训练策略 `π_θ`。同时保留一个冻结的 *参考模型* `π_ref = π_SFT`。
- 回复 `y` 结束时的奖励：

  `r_total(x, y) = R_φ(x, y) - β · KL(π_θ(·|x) || π_ref(·|x))`

  KL 惩罚防止 `π_θ` 从 `π_SFT` 任意漂移——它是一个 *正则项（regularizer）*，而非硬性的信赖域（trust region）。`β` 一般取 `0.01`-`0.05`。
- 用这个奖励运行 PPO（第 08 课）。优势（advantage）在 token 级轨迹上计算，但 RM 只对完整回复打分。

**为什么要 KL？** 没有它，PPO 会乐此不疲地找到奖励作弊（reward-hacking）的策略——RM 只在分布内（in-distribution）的补全上训练过。一条分布外（out-of-distribution）的回复可能比任何人类撰写的回复打分都高。KL 把 `π_θ` 约束在 RM 训练所在的流形（manifold）附近。它是 RLHF 中最重要的单个旋钮。

**2026 年现状：**

- **DPO**（Rafailov 2023）：闭式代数把阶段 2+3 坍缩为对偏好数据的单个监督损失。无需 RM，无需 PPO。在对齐基准上质量相当，算力却只需其零头。详见阶段 10 · 08。
- **GRPO**（DeepSeek 2024–2025）：把 PPO 中的 critic 换成组内相对基线（group-relative baseline），奖励来自 *验证器（verifier）*（代码能跑通 / 数学答案匹配）而非人类训练的 RM。在推理模型中占主导地位。详见阶段 9 · 12。
- **过程奖励模型（Process reward models，PRMs）：** 对部分解（每一个推理步骤）打分，在 RLHF 和 GRPO 变体的推理任务中均有使用。
- **宪法式 AI / RLAIF（Constitutional AI / RLAIF）：** 用一个对齐过的大语言模型代替人类来生成偏好。可扩展偏好预算。

## 动手构建

本课使用以字符串表示的微型合成「提示」与「回复」。RM 是一个在词袋（bag-of-tokens）表示上的线性打分器。没有真正的 LLM——重要的是管线的 *形状*，而非规模。参见 `code/main.py`。

### 第 1 步：合成偏好数据

```python
PROMPTS = ["help me", "answer me", "explain this"]
GOOD_WORDS = {"clear", "specific", "kind", "thorough"}
BAD_WORDS = {"vague", "rude", "wrong", "short"}

def make_pair(rng):
    x = rng.choice(PROMPTS)
    y_good = rng.choice(list(GOOD_WORDS)) + " " + rng.choice(list(GOOD_WORDS))
    y_bad = rng.choice(list(BAD_WORDS)) + " " + rng.choice(list(BAD_WORDS))
    return (x, y_good, y_bad)
```

在真实 RLHF 中，这一步由人类标注者取代。其形状——`(prompt, preferred_response, rejected_response)`——是完全相同的。

### 第 2 步：Bradley-Terry 奖励模型

线性打分：`R(x, y) = w · bag(y)`。训练以最小化 BT 成对对数损失：

```python
def rm_train_step(w, x, y_pos, y_neg, lr):
    r_pos = dot(w, bag(y_pos))
    r_neg = dot(w, bag(y_neg))
    p = sigmoid(r_pos - r_neg)
    for tok, cnt in bag(y_pos).items():
        w[tok] += lr * (1 - p) * cnt
    for tok, cnt in bag(y_neg).items():
        w[tok] -= lr * (1 - p) * cnt
```

经过几百次更新后，`w` 会给好词 token 赋予正权重，给坏词赋予负权重。

### 第 3 步：在 RM 之上的类 PPO 策略

我们的玩具策略从一个词表中产出单个 token。我们用 RM 给该 token 打分，计算 `log π_θ(token | prompt)`，加上一项对参考模型的 KL 惩罚，再应用裁剪后的 PPO 替代目标（clipped PPO surrogate）。

```python
def rlhf_step(theta, ref, w, prompt, rng, eps=0.2, beta=0.1, lr=0.05):
    logits_theta = policy_logits(theta, prompt)
    probs = softmax(logits_theta)
    token = sample(probs, rng)
    logits_ref = policy_logits(ref, prompt)
    probs_ref = softmax(logits_ref)
    reward = dot(w, bag([token])) - beta * kl(probs, probs_ref)
    # 以 PPO 风格更新 theta，把 reward 当作回报（return）
    ...
```

### 第 4 步：监控 KL

每次更新都跟踪平均 `KL(π_θ || π_ref)`。如果它悄悄爬过 `~5-10`，说明策略已经远离 `π_SFT`——要么是 `β` 调得太低，要么是奖励作弊开始出现。这是真实 RLHF 中最重要的诊断指标。

### 第 5 步：用 TRL 实现生产级配方

理解了玩具管线之后，下面是同一套循环，但写成真实库使用者会写的样子。Hugging Face 的 [TRL](https://huggingface.co/docs/trl) 是参考实现——阶段 2 用 `RewardTrainer`，阶段 3 用 `PPOTrainer`（内置了对参考模型的 KL）。

```python
# 阶段 2：从成对偏好训练奖励模型
from trl import RewardTrainer, RewardConfig
from transformers import AutoModelForSequenceClassification, AutoTokenizer

tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B-Instruct")
rm = AutoModelForSequenceClassification.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct", num_labels=1
)

# 数据集行：{"prompt", "chosen", "rejected"} —— Bradley-Terry 格式
trainer = RewardTrainer(
    model=rm,
    tokenizer=tok,
    train_dataset=preference_data,
    args=RewardConfig(output_dir="./rm", num_train_epochs=1, learning_rate=1e-5),
)
trainer.train()
```

```python
# 阶段 3：对着 RM 跑 PPO，带对 SFT 参考模型的 KL 惩罚
from trl import PPOTrainer, PPOConfig, AutoModelForCausalLMWithValueHead

policy = AutoModelForCausalLMWithValueHead.from_pretrained("./sft-checkpoint")
ref    = AutoModelForCausalLMWithValueHead.from_pretrained("./sft-checkpoint")  # 冻结

ppo = PPOTrainer(
    config=PPOConfig(learning_rate=1.41e-5, batch_size=64, init_kl_coef=0.05,
                     target_kl=6.0, adap_kl_ctrl=True),
    model=policy, ref_model=ref, tokenizer=tok,
)

for batch in dataloader:
    responses = ppo.generate(batch["query_ids"], max_new_tokens=128)
    rewards   = rm(torch.cat([batch["query_ids"], responses], dim=-1)).logits[:, 0]
    stats     = ppo.step(batch["query_ids"], responses, rewards)
    # stats 包含：mean_kl、clip_frac、value_loss —— PPO 三大诊断指标
```

这个库替你做了三件事。`adap_kl_ctrl=True` 实现了自适应 β 调度：如果观测到的 KL 超过 `target_kl`，β 翻倍；如果低于其一半，β 减半。参考模型按惯例被冻结——你绝不能不小心让它与 `policy` 共享参数。而价值头（value head）与策略共享同一主干（`AutoModelForCausalLMWithValueHead` 挂上一个标量 MLP 头），这正是 TRL 会分别报告 `policy/kl` 和 `value/loss` 的原因。

## 常见陷阱

- **过度优化 / 奖励作弊。** RM 并不完美；`π_θ` 会找到打分很高但实际很糟的对抗性补全。症状：奖励无限攀升，而人类评测分数停滞甚至下降。修复：提早停止、调高 `β`、扩充 RM 训练数据。
- **长度作弊（Length hacking）。** 在有用回复上训练的 RM 往往隐式地奖励长度。策略于是学会给回复注水。补救：长度归一化的奖励，或使用具备长度感知的 RM 做 RLAIF。
- **RM 太小。** RM 至少要和策略一样大。一个过小的 RM 无法忠实地为策略的输出打分。
- **KL 调参。** β 太低 → 漂移与奖励作弊。β 太高 → 策略几乎不变。标准技巧是使用 *自适应* β，让其瞄准每步固定的 KL。
- **偏好数据噪声。** 约 30% 的人类标注是有噪声或模棱两可的。可通过在「一致性过滤后」的数据上训练 RM 来校准，或在 BT 上使用温度（temperature）。
- **离策略问题（Off-policy problems）。** 第一个 epoch 之后，PPO 数据就略微偏离策略了。如第 08 课所述，监控裁剪比例（clip fraction）。

## 实际应用

2026 年的 RLHF 是分层的：

| 层次 | 目标 | 方法 |
|-------|--------|--------|
| 遵循指令、有用性、无害性 | 对齐 | DPO（阶段 10 · 08）优于 RLHF-PPO。 |
| 推理正确性（数学、代码） | 能力 | 带验证器奖励的 GRPO（阶段 9 · 12）。 |
| 长程多步任务 | 智能体 | 在步骤上使用过程奖励模型的 PPO / GRPO。 |
| 安全 / 拒答行为 | 安全 | 带独立安全 RM 的 RLHF-PPO，或宪法式 AI。 |
| 推理时 Best-of-N | 快速对齐 | 在解码时使用 RM；无需训练策略。 |
| 奖励蒸馏（Reward distillation） | 推理算力 | 在冻结的 LM 之上训练一个小「奖励头」。 |

2022–2024 年，RLHF 是 *那个* 方法。到 2026 年，生产级对齐管线以 DPO 为先，只在 RM 密集或安全攸关的步骤上才用 PPO。

## 交付产物

保存为 `outputs/skill-rlhf-architect.md`：

```markdown
---
name: rlhf-architect
description: Design an RLHF / DPO / GRPO alignment pipeline for a language model, including RM, KL, and data strategy.
version: 1.0.0
phase: 9
lesson: 9
tags: [rl, rlhf, alignment, llm]
---

Given a base LM, a target behavior (alignment / reasoning / refusal / agent), and a preference or verifier budget, output:

1. Stage. SFT? RM? DPO? GRPO? With justification.
2. Preference or verifier source. Humans, AI feedback, rule-based, unit-test-pass, or reward distillation.
3. KL strategy. Fixed β, adaptive β, or DPO (implicit KL).
4. Diagnostics. Mean KL, reward stability, over-optimization guard (holdout human eval).
5. Safety gate. Red-team set, refusal rate, safety RM separate from helpfulness RM.

Refuse to ship RLHF-PPO without a KL monitor. Refuse to use an RM smaller than the target policy. Refuse length-only rewards. Flag any pipeline that does not hold back a blind human-eval set as lacking over-optimization protection.
```

## 练习

1. **简单。** 在 `code/main.py` 中用 500 对合成偏好数据训练 Bradley-Terry 奖励模型。在留出的 100 对上测量成对准确率（pairwise accuracy）。应当超过 90%。
2. **中等。** 用 `β ∈ {0.0, 0.1, 1.0}` 运行玩具 PPO-RLHF 循环。对每个取值，绘制 RM 分数随更新变化与对参考模型 KL 的曲线。哪些运行出现了奖励作弊？
3. **困难。** 在同一份偏好数据上实现 DPO（闭式的偏好似然损失），并在所用算力和最终达到的 RM 分数上与 RLHF-PPO 管线作对比。

## 关键术语

| 术语 | 人们怎么说 | 它实际是什么 |
|------|-----------------|-----------------------|
| RLHF | 「对齐 RL」 | 三阶段 SFT + RM + PPO 管线（Christiano 2017, Ouyang 2022）。 |
| 奖励模型（Reward Model, RM） | 「打分网络」 | 通过 Bradley-Terry 拟合到成对偏好的、学习得到的标量函数。 |
| Bradley-Terry | 「成对逻辑斯蒂损失」 | `P(y_+ ≻ y_-) = σ(R(y_+) - R(y_-))`；标准的 RM 目标。 |
| KL 惩罚 | 「贴着参考模型走」 | 奖励中的 `β · KL(π_θ \|\| π_ref)`；防奖励作弊的正则项。 |
| 奖励作弊（Reward hacking） | 「古德哈特定律（Goodhart's law）」 | 策略钻 RM 的漏洞；症状：奖励上升、人类评测不动。 |
| RLAIF | 「AI 标注的偏好」 | 标签来自另一个 LM 而非人类的 RLHF。 |
| PRM | 「过程奖励模型」 | 对部分推理步骤打分；用于推理管线。 |
| 宪法式 AI（Constitutional AI） | 「Anthropic 的方法」 | 由显式规则引导、AI 生成的偏好。 |

## 延伸阅读

- [Christiano et al. (2017). Deep Reinforcement Learning from Human Preferences](https://arxiv.org/abs/1706.03741) —— 开启 RLHF 的论文。
- [Ouyang et al. (2022). InstructGPT —— Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) —— ChatGPT 背后的配方。
- [Stiennon et al. (2020). Learning to summarize with human feedback](https://arxiv.org/abs/2009.01325) —— 更早的用于摘要任务的 RLHF。
- [Rafailov et al. (2023). Direct Preference Optimization](https://arxiv.org/abs/2305.18290) —— DPO；2026 年后 RLHF 时代的默认方法。
- [Bai et al. (2022). Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) —— RLAIF 与自我批判循环。
- [Anthropic RLHF paper (Bai et al. 2022). Training a Helpful and Harmless Assistant](https://arxiv.org/abs/2204.05862) —— HH 论文。
- [Hugging Face TRL library](https://huggingface.co/docs/trl) —— 生产级的 `RewardTrainer` 和 `PPOTrainer`。阅读 trainer 源码可了解自适应 KL 与价值头的细节。
- [Hugging Face —— Illustrating Reinforcement Learning from Human Feedback](https://huggingface.co/blog/rlhf)，作者 Lambert, Castricato, von Werra, Havrilla —— 配有图示的三阶段管线经典讲解。
- [von Werra et al. (2020). TRL: Transformer Reinforcement Learning](https://github.com/huggingface/trl) —— 这个库；`examples/` 里有针对 Llama、Mistral 和 Qwen 的端到端 RLHF 脚本。
- [Sutton & Barto (2018). Ch. 17.4 —— Designing Reward Signals](http://incompleteideas.net/book/RLbook2020.pdf) —— 奖励假设（reward-hypothesis）视角；思考奖励作弊的必备前置阅读。
