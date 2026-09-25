# 奖励建模与 RLHF

> 人类无法为“好的助手回复”写出一个奖励函数，但他们可以比较两个回复并挑出更好的那个。用这些比较数据拟合一个奖励模型，然后让语言模型针对该奖励做强化学习。Christiano 2017。InstructGPT 2022。这就是把 GPT-3 变成 ChatGPT 的配方。到 2026 年它大多已被 DPO 取代——但其思维模型依然成立。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 05（情感分析）、Phase 9 · 08（PPO）
**Time:** ~45 分钟

## 问题所在

你在下一词预测目标上训练了一个语言模型。它能写出语法正确的英文，但它也会撒谎、絮叨，并且不会拒绝该拒绝的请求。你无法通过更多预训练来解决这个问题——网页文本是问题所在，而非解药。

你想要一个*标量奖励*，它能表示“对于指令 X，回复 A 比回复 B 更好”。手工编写这个奖励函数是不可能的。“有用性”不是关于 token 的闭式表达式。但人类可以比较两个输出并标出偏好。这在规模化收集上是低成本的。

RLHF（Christiano et al. 2017; Ouyang et al. 2022）将偏好转化为一个奖励模型，然后通过 PPO 针对该奖励优化语言模型。分三步：SFT → RM → PPO。这正是 2023–2025 年间 ChatGPT、Claude、Gemini 以及所有其他对齐 LLM 的交付配方。

到 2026 年，PPO 步骤大多已被 DPO（Phase 10 · 08）取代，因为它更便宜，且在对齐微调上效果几乎一样好。但*奖励模型*这一组件仍然支撑着每一个 Best-of-N 采样器、每一个基于可验证奖励的强化学习流水线，以及每一个使用过程奖励模型的推理模型。理解了 RLHF，你就理解了整个对齐技术栈。

## 核心概念

![Three-stage RLHF: SFT, RM training on pairwise prefs, PPO with KL penalty](../assets/rlhf.svg)

**阶段 1：监督微调（SFT）。** 从预训练的基础模型开始。在人工编写的目标行为示范数据（指令跟随回复、有帮助的回答等）上进行微调。结果：得到一个模型 `π_SFT`，它*偏向良好行为*，但动作空间仍然是无界的。

**阶段 2：奖励模型训练。**

- 收集针对提示 `x` 的成对回复 `(y_+, y_-)`，由人类标注为“y_+ 优于 y_-”。
- 训练一个奖励模型 `R_φ(x, y)`，使其给 `y_+` 打更高的分。
- 损失函数：**Bradley-Terry 成对逻辑损失**：

  `L(φ) = -E[ log σ(R_φ(x, y_+) - R_φ(x, y_-)) ]`

  σ 是 sigmoid 函数。奖励的差值蕴含着偏好的对数几率。BT 自 1952 年（Bradley-Terry）以来一直是标准方法，也是现代 RLHF 中的主流选择。

- `R_φ` 通常从 SFT 模型初始化，并在其上添加一个标量输出头。相同的 Transformer 骨干网络；一个单独的线性层输出奖励。

**阶段 3：带 KL 惩罚的针对 RM 的 PPO。**

- 从 `π_SFT` 初始化可训练策略 `π_θ`。保留一个冻结的*参考*模型 `π_ref = π_SFT`。
- 回复结束时的奖励 `y`：

  `r_total(x, y) = R_φ(x, y) - β · KL(π_θ(·|x) || π_ref(·|x))`

  KL 惩罚防止 `π_θ` 任意偏离 `π_SFT`——它是一个*正则化项*，而非硬性信任域。`β` 通常在 `0.01` 到 `0.05` 之间。
- 用这个奖励运行 PPO（第 08 课）。优势在 token 级轨迹上计算，但 RM 只对完整回复打分。

**为什么要 KL？** 没有它，PPO 会轻易找到奖励作弊策略——RM 只在分布内补全上训练过。一个分布外回复可能获得比任何人工撰写的回复更高的分数。KL 使 `π_θ` 保持在 RM 训练时所在的流形附近。它是 RLHF 中最重要的单一旋钮。

**2026 年的现状：**

- **DPO**（Rafailov 2023）：用闭式代数把阶段 2+3 合并为一个针对偏好数据的监督损失。无需 RM，无需 PPO。在对齐基准上以一小部分计算量达到同等质量。见 Phase 10 · 08。
- **GRPO**（DeepSeek 2024–2025）：用组相对基线代替 critic 的 PPO，奖励来自*验证器*（代码运行/数学答案匹配）而非人工训练的 RM。在推理模型中占主导地位。见 Phase 9 · 12。
- **过程奖励模型（PRM）：** 对部分解答（每个推理步骤）打分，在 RLHF 和 GRPO 变体中用于推理任务。
- **Constitutional AI / RLAIF：** 用一个对齐的 LLM 来生成偏好，代替人类。扩展了偏好数据的预算。

```figure
reward-model
```

## 动手构建

本课使用以字符串表示的微型合成“提示”和“回复”。RM 是基于词袋表示的线性打分器。没有真实的 LLM——重要的是流水线的*形态*，而非规模。见 `code/main.py`。

### 步骤 1：合成偏好数据

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

在真实 RLHF 中，这由人工标注员完成。其数据形态——`(prompt, preferred_response, rejected_response)`——是完全一致的。

### 步骤 2：Bradley-Terry 奖励模型

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

几百次更新后，`w` 会给好词 token 分配正权重，给坏词分配负权重。

### 步骤 3：在 RM 之上构建类 PPO 策略

我们的玩具策略从词表中生成单个 token。我们用 RM 给该 token 打分，计算 `log π_θ(token | prompt)`，加上对参考模型的 KL 惩罚，然后应用裁剪的 PPO 代理目标。

```python
def rlhf_step(theta, ref, w, prompt, rng, eps=0.2, beta=0.1, lr=0.05):
    logits_theta = policy_logits(theta, prompt)
    probs = softmax(logits_theta)
    token = sample(probs, rng)
    logits_ref = policy_logits(ref, prompt)
    probs_ref = softmax(logits_ref)
    reward = dot(w, bag([token])) - beta * kl(probs, probs_ref)
    # ppo-style update on theta, treating reward as the return
    ...
```

### 步骤 4：监控 KL

每次更新都跟踪平均 `KL(π_θ || π_ref)`。如果它爬升超过 `~5-10`，说明策略已大幅偏离 `π_SFT`——降低 `β` 或奖励作弊已经开始。这是真实 RLHF 中的首要诊断指标。

### 步骤 5：使用 TRL 的生产级配方

一旦理解了玩具流水线，下面就是真实库用户编写的相同循环。Hugging Face 的 [TRL](https://huggingface.co/docs/trl) 是参考实现——阶段 2 用 `RewardTrainer`，阶段 3 用 `PPOTrainer`（内置对参考模型的 KL）。

```python
# Stage 2: reward model from pairwise preferences
from trl import RewardTrainer, RewardConfig
from transformers import AutoModelForSequenceClassification, AutoTokenizer

tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B-Instruct")
rm = AutoModelForSequenceClassification.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct", num_labels=1
)

# dataset rows: {"prompt", "chosen", "rejected"} — Bradley-Terry format
trainer = RewardTrainer(
    model=rm,
    tokenizer=tok,
    train_dataset=preference_data,
    args=RewardConfig(output_dir="./rm", num_train_epochs=1, learning_rate=1e-5),
)
trainer.train()
```

```python
# Stage 3: PPO against the RM with KL penalty to the SFT reference
from trl import PPOTrainer, PPOConfig, AutoModelForCausalLMWithValueHead

policy = AutoModelForCausalLMWithValueHead.from_pretrained("./sft-checkpoint")
ref    = AutoModelForCausalLMWithValueHead.from_pretrained("./sft-checkpoint")  # frozen

ppo = PPOTrainer(
    config=PPOConfig(learning_rate=1.41e-5, batch_size=64, init_kl_coef=0.05,
                     target_kl=6.0, adap_kl_ctrl=True),
    model=policy, ref_model=ref, tokenizer=tok,
)

for batch in dataloader:
    responses = ppo.generate(batch["query_ids"], max_new_tokens=128)
    rewards   = rm(torch.cat([batch["query_ids"], responses], dim=-1)).logits[:, 0]
    stats     = ppo.step(batch["query_ids"], responses, rewards)
    # stats includes: mean_kl, clip_frac, value_loss — the three PPO diagnostics
```

这个库替你做了三件事。`adap_kl_ctrl=True` 实现了自适应 β 调度：如果观测到的 KL 超过 `target_kl`，β 翻倍；如果低于一半，β 减半。参考模型按惯例是冻结的——你绝不能意外地让它与 `policy` 共享参数。价值头与策略共用同一个骨干网络（`AutoModelForCausalLMWithValueHead` 会附加一个标量 MLP 头），这就是 TRL 将 `policy/kl` 和 `value/loss` 分开报告的原因。

## 常见陷阱

- **过度优化 / 奖励作弊。** RM 是不完美的；`π_θ` 会找到得分高但实际很差的对抗性补全。症状：奖励持续攀升而人工评估分数停滞或下降。修复：提前停止、提高 `β`、扩充 RM 训练数据。
- **长度作弊。** 在有帮助的回复上训练的 RM 往往隐式地奖励长度。策略会学会填充回复。补救：长度归一化奖励，或使用带长度感知 RM 的 RLAIF。
- **RM 太小。** RM 至少要和策略一样大。太小的 RM 无法忠实评估策略的输出。
- **KL 调参。** β 太低 → 漂移和奖励作弊。β 太高 → 策略几乎不变。标准技巧是*自适应* β，以每步固定 KL 为目标。
- **偏好数据噪声。** 约 30% 的人类标注有噪声或含糊。可通过在一致性过滤后的数据上训练 RM 来校准，或在 BT 上使用温度参数。
- **离策略问题。** PPO 数据在第一个 epoch 之后略微离策略。像第 08 课那样监控裁剪比例。

## 实际应用

2026 年的 RLHF 是分层的：

| 层面 | 目标 | 方法 |
|-------|--------|--------|
| 指令跟随、有用性、无害性 | 对齐 | DPO（Phase 10 · 08）优于 RLHF-PPO。 |
| 推理正确性（数学、代码） | 能力 | 带验证器奖励的 GRPO（Phase 9 · 12）。 |
| 长时程多步任务 | 智能体 | 带过程奖励模型的 PPO / GRPO。 |
| 安全 / 拒答行为 | 安全 | 带独立安全 RM 的 RLHF-PPO，或 Constitutional AI。 |
| 推理时 Best-of-N | 快速对齐 | 解码时使用 RM；无需策略训练。 |
| 奖励蒸馏 | 推理计算 | 在冻结的 LM 之上训练一个小的“奖励头”。 |

RLHF 在 2022–2024 年间是*主流*方法。到 2026 年，生产级对齐流水线以 DPO 优先，PPO 仅用于 RM 密集或安全关键的步骤。

## 发布成果

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

1. **简单。** 用 500 个合成偏好对训练 `code/main.py` 中的 Bradley-Terry 奖励模型。在留出的 100 对上测量成对准确率。应超过 90%。
2. **中等。** 用不同的 `β ∈ {0.0, 0.1, 1.0}` 运行玩具 PPO-RLHF 循环。对每次运行绘制 RM 分数与对参考模型的 KL 随更新的变化曲线。哪些运行出现了奖励作弊？
3. **困难。** 在相同偏好数据上实现 DPO（闭式偏好似然损失），并在计算量和最终 RM 分数上与 RLHF-PPO 流水线进行比较。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| RLHF | “对齐强化学习” | 三阶段 SFT + RM + PPO 流水线（Christiano 2017, Ouyang 2022）。 |
| 奖励模型（RM） | “打分网络” | 通过 Bradley-Terry 从成对偏好拟合的标量函数。 |
| Bradley-Terry | “成对逻辑损失” | `P(y_+ ≻ y_-) = σ(R(y_+) - R(y_-))`；标准的 RM 目标函数。 |
| KL 惩罚 | “贴近参考模型” | 奖励中的 `β · KL(π_θ \|\| π_ref)`；防止奖励作弊的正则化项。 |
| 奖励作弊 | “古德哈特定律” | 策略利用 RM 的缺陷；症状：奖励上升，人工评估持平。 |
| RLAIF | “AI 标注的偏好” | 标签来自另一个 LM 而非人类的 RLHF。 |
| PRM | “过程奖励模型” | 对部分推理步骤打分；用于推理流水线。 |
| Constitutional AI | “Anthropic 的方法” | 由明确规则引导的 AI 生成偏好。 |

## 延伸阅读

- [Christiano et al. (2017). Deep Reinforcement Learning from Human Preferences](https://arxiv.org/abs/1706.03741) — 开创 RLHF 的论文。
- [Ouyang et al. (2022). InstructGPT — Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) — ChatGPT 背后的配方。
- [Stiennon et al. (2020). Learning to summarize with human feedback](https://arxiv.org/abs/2009.01325) — 更早的用于摘要的 RLHF。
- [Rafailov et al. (2023). Direct Preference Optimization](https://arxiv.org/abs/2305.18290) — DPO；2026 年 RLHF 之后的新默认方法。
- [Bai et al. (2022). Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) — RLAIF 与自我批评循环。
- [Anthropic RLHF 论文（Bai et al. 2022）. Training a Helpful and Harmless Assistant](https://arxiv.org/abs/2204.05862) — HH 论文。
- [Hugging Face TRL 库](https://huggingface.co/docs/trl) — 生产级 `RewardTrainer` 和 `PPOTrainer`。阅读 trainer 源码了解自适应 KL 和价值头的细节。
- [Hugging Face — Illustrating Reinforcement Learning from Human Feedback](https://huggingface.co/blog/rlhf)，作者 Lambert, Castricato, von Werra, Havrilla — 带图解的三阶段流水线权威讲解。
- [von Werra et al. (2020). TRL: Transformer Reinforcement Learning](https://github.com/huggingface/trl) — 该库；`examples/` 提供 Llama、Mistral 和 Qwen 的端到端 RLHF 脚本。
- [Sutton & Barto (2018). Ch. 17.4 — Designing Reward Signals](http://incompleteideas.net/book/RLbook2020.pdf) — 奖励假设视角；思考奖励作弊的必读前置材料。