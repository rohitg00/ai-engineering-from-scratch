# 奖励建模与 RLHF（Reward Modeling & RLHF）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 人类无法手写一个「好的助手回复」的奖励函数，但可以拿两条回复出来挑出哪个更好。把那些比较拟合成一个 reward model（奖励模型），再用 RL 让语言模型对着它优化。Christiano 2017，InstructGPT 2022。把 GPT-3 变成 ChatGPT 的配方。到 2026 年，它大多被 DPO 取代了——但心智模型不变。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 05 (Sentiment), Phase 9 · 08 (PPO)
**Time:** ~45 minutes

## 问题（Problem）

你用 next-token-prediction 目标训了一个语言模型。它能写语法正确的英文。它也会撒谎、啰嗦、该拒绝的不拒绝。再多预训练也救不了——网页文本是病因，不是解药。

你想要一个 *标量奖励*，告诉你「对指令 X 来说，回复 A 比回复 B 更好」。手写这个奖励函数是不可能的。「Helpfulness（有用性）」不是 token 上的某个闭式表达式。但人类可以比较两条输出并标出偏好。这种数据可以低成本地大规模收集。

RLHF（Christiano et al. 2017；Ouyang et al. 2022）把偏好转成 reward model，然后让 LM 通过 PPO 对着这个奖励优化。三步走：SFT → RM → PPO。这是 2023–2025 年间把 ChatGPT、Claude、Gemini 以及其他所有对齐过的 LLM 推上线的配方。

到 2026 年，PPO 那一步大多被 DPO（Phase 10 · 08）取代了，因为它更便宜，对齐微调上几乎一样好。但 *reward model* 这一块依然是每个 Best-of-N 采样器、每条 RL-from-verifiable-rewards 流水线、每个使用 process reward model 的推理模型的底层。理解了 RLHF，你就理解了整个对齐栈。

## 概念（Concept）

![三阶段 RLHF：SFT、基于成对偏好训练 RM、带 KL 惩罚的 PPO](../assets/rlhf.svg)

**Stage 1：Supervised Fine-Tuning（SFT，监督微调）。** 从一个预训练好的基础模型开始。在人类编写的目标行为示例（指令跟随回复、有帮助的回答等）上微调。结果：得到一个 *偏向好行为* 但动作空间仍然无界的模型 `π_SFT`。

**Stage 2：Reward Model 训练。**

- 收集对 prompt `x` 的回复对 `(y_+, y_-)`，由人类标注「y_+ 比 y_- 更好」。
- 训练一个 reward model `R_φ(x, y)`，让它给 `y_+` 更高的分数。
- 损失：**Bradley-Terry 成对 logistic 损失**：

  `L(φ) = -E[ log σ(R_φ(x, y_+) - R_φ(x, y_-)) ]`

  σ 是 sigmoid。奖励的差对应偏好的对数几率（log-odds）。BT 自 1952 年（Bradley-Terry）以来一直是标准做法，也是现代 RLHF 的主流选择。

- `R_φ` 通常用 SFT 模型初始化，再在顶上加一个标量头（scalar head）。同一个 transformer backbone；一层线性输出奖励。

**Stage 3：在 RM 上跑 PPO 并加 KL 惩罚。**

- 用 `π_SFT` 初始化可训练的 policy `π_θ`。冻一份 *reference* `π_ref = π_SFT`。
- 在回复 `y` 末端的奖励：

  `r_total(x, y) = R_φ(x, y) - β · KL(π_θ(·|x) || π_ref(·|x))`

  这个 KL 惩罚防止 `π_θ` 任意偏离 `π_SFT`——它是一个 *正则化项*，不是硬性的 trust region。`β` 通常取 `0.01`–`0.05`。
- 用这个奖励跑 PPO（Lesson 08）。优势在 token 级轨迹上算，但 RM 只对完整回复打分。

**为什么要 KL？** 不加的话，PPO 会很乐意找到 reward-hacking（奖励黑客）的策略——RM 只在分布内的补全上训过。一条分布外的回复可能比任何人类写的回复得分都高。KL 把 `π_θ` 约束在 RM 训练时所在的流形附近。它是 RLHF 里最重要的一个旋钮。

**2026 年现状：**

- **DPO**（Rafailov 2023）：闭式代数把 Stage 2+3 折叠成一个对偏好数据的监督损失。无 RM、无 PPO。在对齐基准上同等质量，算力却只用一小部分。Phase 10 · 08 详述。
- **GRPO**（DeepSeek 2024–2025）：把 critic 换成组相对基线（group-relative baseline）的 PPO，奖励来自 *verifier*（代码能跑通／数学答案匹配）而不是人训出来的 RM。在推理模型上占主导。Phase 9 · 12 详述。
- **Process reward models（PRMs）：** 给部分解（每个推理步骤）打分，在 RLHF 和 GRPO 的推理变体里都用得上。
- **Constitutional AI / RLAIF：** 用一个对齐过的 LLM 来生成偏好，替代人类。把偏好预算扩展上去。

## 动手实现（Build It）

本课用极小的合成「prompt」和「response」，都用字符串表示。RM 是基于词袋表示的线性打分器。没有真正的 LLM——重要的是流水线的 *形状*，不是规模。见 `code/main.py`。

### Step 1：合成偏好数据

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

真实 RLHF 里这一步换成人类标注员。形状——`(prompt, preferred_response, rejected_response)`——完全一样。

### Step 2：Bradley-Terry reward model

线性打分：`R(x, y) = w · bag(y)`。训练以最小化 BT 成对 log-loss：

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

迭代几百步之后，`w` 给好词 token 正权重、给坏词 token 负权重。

### Step 3：在 RM 之上跑类 PPO 的 policy

我们的玩具 policy 从词表里产出单个 token。我们用 RM 给这个 token 打分，算 `log π_θ(token | prompt)`，加上一个对 reference 的 KL 惩罚，再套上 PPO 的 clipped surrogate。

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

### Step 4：盯住 KL

每次更新都跟踪平均的 `KL(π_θ || π_ref)`。如果它爬过 `~5–10`，policy 已经从 `π_SFT` 漂得太远——要么 `β` 太低，要么 reward hacking 开始了。这是真实 RLHF 里最关键的诊断指标。

### Step 5：用 TRL 的生产配方

理解完玩具流水线之后，下面是真实库使用者写的同一个循环。Hugging Face 的 [TRL](https://huggingface.co/docs/trl) 是参考实现——Stage 2 用 `RewardTrainer`，Stage 3 用 `PPOTrainer`（内置了 KL-to-reference）。

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

库给你做了三件事。`adap_kl_ctrl=True` 实现自适应 β 调度：观测到的 KL 超过 `target_kl`，β 翻倍；低于一半，β 减半。Reference 模型按惯例是冻住的——你绝对不能不小心把参数和 `policy` 共享。Value head 和 policy 共用同一个 backbone（`AutoModelForCausalLMWithValueHead` 挂上一个标量 MLP 头），这就是为什么 TRL 把 `policy/kl` 和 `value/loss` 分开报。

## 坑（Pitfalls）

- **过度优化／reward hacking。** RM 不完美；`π_θ` 会找到能拿高分但实际很差的对抗式补全。症状：奖励一路涨，但人类评测分平稳甚至下降。修复：早停、调高 `β`、扩充 RM 训练数据。
- **长度作弊（length hacking）。** 用「有帮助的回复」训出来的 RM 经常隐性奖励长度。Policy 学会把回复填长。补救：长度归一化的奖励，或者用一个考虑长度的 RM 做 RLAIF。
- **RM 太小。** RM 至少要和 policy 一样大。一个小 RM 没法忠实地给 policy 的输出打分。
- **KL 调参。** β 太低 → 漂移和 reward hacking。β 太高 → policy 几乎不变。标准做法是用 *自适应* β 来锁定每步固定的 KL 目标。
- **偏好数据噪声。** 大约 30% 的人类标签是噪声或模糊的。校准方法是用一致性筛过的数据训 RM，或者在 BT 上加温度。
- **Off-policy 问题。** 第一个 epoch 之后 PPO 数据就略 off-policy 了。和 Lesson 08 一样，盯住 clip fraction。

## 用起来（Use It）

2026 年的 RLHF 是分层的：

| 层 | 目标 | 方法 |
|-------|--------|--------|
| 指令跟随、有用性、无害性 | 对齐 | DPO（Phase 10 · 08）优于 RLHF-PPO。 |
| 推理正确性（数学、代码） | 能力 | 带 verifier 奖励的 GRPO（Phase 9 · 12）。 |
| 长链路多步任务 | Agentic | 在步骤上用 process reward model 跑 PPO / GRPO。 |
| 安全 / 拒答行为 | 安全 | RLHF-PPO 配独立的安全 RM，或者 Constitutional AI。 |
| 推理时 Best-of-N | 快速对齐 | 解码时用 RM；不需要 policy 训练。 |
| 奖励蒸馏 | 推理算力 | 在冻结的 LM 上训一个小「奖励头」。 |

2022–2024 年间 RLHF 是 *那个* 方法。2026 年，生产对齐流水线以 DPO 优先，PPO 只用于 RM 密集型或安全关键的步骤。

## 上线部署（Ship It）

存为 `outputs/skill-rlhf-architect.md`：

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

## 练习（Exercises）

1. **Easy。** 在 `code/main.py` 里用 500 条合成偏好对训 Bradley-Terry reward model。在留出的 100 对上测成对准确率。应当超过 90%。
2. **Medium。** 用 `β ∈ {0.0, 0.1, 1.0}` 跑玩具 PPO-RLHF 循环。对每组，画出 RM 分数与对 reference 的 KL 随更新次数的曲线。哪几组在 reward-hack？
3. **Hard。** 在同一份偏好数据上实现 DPO（闭式偏好似然损失），并在算力消耗和最终达到的 RM 分数上与 RLHF-PPO 流水线做对比。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| RLHF | 「对齐 RL」 | 三阶段 SFT + RM + PPO 流水线（Christiano 2017，Ouyang 2022）。 |
| Reward Model（RM） | 「打分网」 | 通过 Bradley-Terry 拟合到成对偏好的可学习标量函数。 |
| Bradley-Terry | 「成对 logistic 损失」 | `P(y_+ ≻ y_-) = σ(R(y_+) - R(y_-))`；标准的 RM 目标。 |
| KL penalty | 「待在 reference 附近」 | 奖励里的 `β · KL(π_θ \|\| π_ref)`；防 reward-hacking 的正则化项。 |
| Reward hacking | 「Goodhart 定律」 | Policy 钻 RM 的漏洞；症状：奖励上升，人类评测持平。 |
| RLAIF | 「AI 标的偏好」 | 标签来自另一个 LM 而非人类的 RLHF。 |
| PRM | 「Process Reward Model」 | 给部分推理步骤打分；推理流水线里用。 |
| Constitutional AI | 「Anthropic 的方法」 | 由显式规则引导 AI 生成偏好。 |

## 延伸阅读（Further Reading）

- [Christiano et al. (2017). Deep Reinforcement Learning from Human Preferences](https://arxiv.org/abs/1706.03741) — 开启 RLHF 的论文。
- [Ouyang et al. (2022). InstructGPT — Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) — ChatGPT 背后的配方。
- [Stiennon et al. (2020). Learning to summarize with human feedback](https://arxiv.org/abs/2009.01325) — 早期用于摘要的 RLHF。
- [Rafailov et al. (2023). Direct Preference Optimization](https://arxiv.org/abs/2305.18290) — DPO；2026 年后 RLHF 的默认选择。
- [Bai et al. (2022). Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) — RLAIF 与自我批评循环。
- [Anthropic RLHF paper (Bai et al. 2022). Training a Helpful and Harmless Assistant](https://arxiv.org/abs/2204.05862) — HH 论文。
- [Hugging Face TRL library](https://huggingface.co/docs/trl) — 生产级 `RewardTrainer` 和 `PPOTrainer`。读 trainer 源码可以了解自适应 KL 和 value head 的细节。
- [Hugging Face — Illustrating Reinforcement Learning from Human Feedback](https://huggingface.co/blog/rlhf) by Lambert, Castricato, von Werra, Havrilla — 配图版三阶段流水线的经典走读。
- [von Werra et al. (2020). TRL: Transformer Reinforcement Learning](https://github.com/huggingface/trl) — 这个库；`examples/` 目录里有 Llama、Mistral、Qwen 的端到端 RLHF 脚本。
- [Sutton & Barto (2018). Ch. 17.4 — Designing Reward Signals](http://incompleteideas.net/book/RLbook2020.pdf) — 奖励假说视角；思考 reward hacking 的必备前置。
