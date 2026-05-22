# 奖励建模与RLHF

> 人类无法为"优秀的助手回复"编写一个奖励函数，但他们可以比较两个回复并选出更好的那个。基于这些比较拟合一个奖励模型，然后使用强化学习让语言模型对抗该模型。Christiano 等人于2017年提出该方法，InstructGPT 于2022年应用。正是这个配方将GPT-3变成了ChatGPT。到2026年，它主要被DPO取代——但思维模型仍然保留。

**类型：** 构建
**语言：** Python
**前提条件：** 阶段5 · 05（情感分析），阶段9 · 08（PPO）
**时间：** ~45分钟

## 问题

你在下一个词元预测任务上训练了一个语言模型。它能写出语法正确的英文，但也会撒谎、漫无边际地胡扯、拒绝回答本不该拒绝的问题。仅靠更多预训练无法解决这些问题——网络文本本身就是问题，而非解药。

你希望有一个*标量奖励*来指示"对于指令X，回复A比回复B更好"。手工编写这样的奖励函数是不可能的。"有帮助程度"并不是一个关于词元的闭式表达式。但人类可以比较两个输出并标记偏好。这在规模化时收集成本很低。

RLHF（Christiano等人，2017；Ouyang等人，2022）将偏好转化为奖励模型，然后通过PPO针对该奖励优化语言模型。分为三步：SFT → RM → PPO。正是这个配方催生了ChatGPT、Claude、Gemini以及2023-2025年间所有其他经过对齐的LLM。

到2026年，PPO步骤主要被DPO（阶段10·08）取代，因为它成本更低且在对齐微调方面效果几乎同样好。但*奖励模型*部分仍然是每个Best-of-N采样器、每个基于可验证奖励的强化学习管线以及每个使用过程奖励模型的推理模型的基础。理解了RLHF，你就理解了整个对齐栈。

## 概念

![三阶段RLHF：SFT、基于成对偏好的RM训练、带KL惩罚的PPO](../assets/rlhf.svg)

**阶段1：监督微调（SFT）。** 从预训练的基础模型开始。在人类编写的目标行为示范（指令遵循回复、有帮助的回复等）上进行微调。结果：得到一个模型 `π_SFT`，它*偏向于良好行为*，但动作空间仍然无界。

**阶段2：奖励模型训练。**

- 收集对提示 `x` 的回复对 `(y_+, y_-)`，由人类标注为"y_+ 优于 y_-"。
- 训练一个奖励模型 `R_φ(x, y)`，使其为 `y_+` 分配更高的分数。
- 损失函数：**Bradley-Terry 成对逻辑损失**：

  `L(φ) = -E[ log σ(R_φ(x, y_+) - R_φ(x, y_-)) ]`

  σ 是 sigmoid 函数。奖励差值隐含了偏好的对数几率。BT 自1952年起就是标准（Bradley-Terry），并且是现代RLHF中的主流选择。

- `R_φ` 通常从SFT模型初始化，顶部添加一个标量头。使用相同的Transformer骨干网络；单个线性层输出奖励。

**阶段3：带KL惩罚的PPO对抗RM。**

- 从 `π_SFT` 初始化可训练的策略 `π_θ`。保留一个冻结的*参考模型* `π_ref = π_SFT`。
- 回复 `y` 结束时的奖励：

  `r_total(x, y) = R_φ(x, y) - β · KL(π_θ(·|x) || π_ref(·|x))`

  KL惩罚防止 `π_θ` 任意偏离 `π_SFT`——它是一个*正则化项*，而非硬性信任区域。`β` 通常为 `0.01`-`0.05`。
- 使用该奖励运行PPO（第08课）。优势在词元级别的轨迹上计算，但RM只对整个回复评分。

**为什么需要KL？** 没有它，PPO会愉快地找到奖励黑客策略——RM只在分布内的补全上训练过。一个分布外的回复可能比任何人类编写的回复得分更高。KL使 `π_θ` 保持在RM训练所在流形的附近。这是RLHF中最重要的控制旋钮。

**2026年现状：**

- **DPO**（Rafailov，2023）：闭式代数将阶段2和3合并为一个针对偏好数据的监督损失。无需RM，无需PPO。在对齐基准上质量相同，计算量却只有一小部分。详见阶段10·08。
- **GRPO**（DeepSeek，2024–2025）：使用组相对基线替代价值函数的PPO，奖励来自*验证器*（代码运行/数学答案匹配）而非人类训练的RM。在推理模型中占主导地位。详见阶段9·12。
- **过程奖励模型（PRM）：** 对部分解决方案（每个推理步骤）进行评分，用于RLHF和GRPO变体中的推理。
- **宪法AI / RLAIF：** 使用已对齐的LLM生成偏好，而非人类。可扩展偏好预算。

## 构建

本课程使用以字符串表示的微小合成"提示"和"回复"。RM是一个基于词袋表示的线性评分器。没有真正的LLM——重要的是管线的*形状*，而非规模。参见 `code/main.py`。

### 第1步：合成偏好数据

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

在真实的RLHF中，这部分由人类标注员替代。其形状——`(提示, 优选回复, 拒绝回复)`——完全相同。

### 第2步：Bradley-Terry奖励模型

线性分数：`R(x, y) = w · bag(y)`。训练以最小化BT成对对数损失：

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

经过几百次更新后，`w` 为好的词元赋予正权重，为坏的词元赋予负权重。

### 第3步：基于RM的类PPO策略

我们的玩具策略从词汇表中生成单个词元。我们在RM下对该词元进行评分，计算 `log π_θ(词元 | 提示)`，添加与参考模型的KL惩罚，并应用裁剪后的PPO代理：

```python
def rlhf_step(theta, ref, w, prompt, rng, eps=0.2, beta=0.1, lr=0.05):
    logits_theta = policy_logits(theta, prompt)
    probs = softmax(logits_theta)
    token = sample(probs, rng)
    logits_ref = policy_logits(ref, prompt)
    probs_ref = softmax(logits_ref)
    reward = dot(w, bag([token])) - beta * kl(probs, probs_ref)
    # 对theta进行PPO风格的更新，将奖励视为回报
    ...
```

### 第4步：监控KL

每次更新时跟踪平均 `KL(π_θ || π_ref)`。如果超过 `~5-10`，说明策略已经严重偏离 `π_SFT`——可能是 `β` 过低或奖励黑客开始出现。这是真实RLHF中的首要诊断指标。

### 第5步：使用TRL的生产配方

一旦你理解了玩具管线，下面是真实库用户编写的相同循环。Hugging Face 的 [TRL](https://huggingface.co/docs/trl) 是参考实现——`RewardTrainer` 用于阶段2，`PPOTrainer`（内置与参考模型的KL惩罚）用于阶段3。

```python
# 阶段2：从成对偏好训练奖励模型
from trl import RewardTrainer, RewardConfig
from transformers import AutoModelForSequenceClassification, AutoTokenizer

tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B-Instruct")
rm = AutoModelForSequenceClassification.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct", num_labels=1
)

# 数据集行：{"prompt", "chosen", "rejected"} — Bradley-Terry格式
trainer = RewardTrainer(
    model=rm,
    tokenizer=tok,
    train_dataset=preference_data,
    args=RewardConfig(output_dir="./rm", num_train_epochs=1, learning_rate=1e-5),
)
trainer.train()
```

```python
# 阶段3：对RM进行PPO训练，并带有到SFT参考模型的KL惩罚
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
    # stats包含：mean_kl, clip_frac, value_loss — 三个PPO诊断指标
```

库为你做了三件事：`adap_kl_ctrl=True` 实现了自适应β调度：如果观测到的KL超过 `target_kl`，β加倍；如果低于一半，β减半。参考模型按惯例冻结——你必须确保不与 `policy` 意外共享参数。价值头存在于与策略相同的骨干网络上（`AutoModelForCausalLMWithValueHead` 附加一个标量MLP头），这就是为什么TRL分别报告 `policy/kl` 和 `value/loss`。

## 陷阱

- **过度优化 / 奖励黑客。** RM不完美；`π_θ` 会找到得分高但实则糟糕的对抗性补全。症状：奖励持续攀升，而人类评估分数停滞或下降。修复：提前停止，提高 `β`，扩大RM训练数据。
- **长度黑客。** 基于有帮助回复训练的RM通常隐式地奖励长度。策略学会填充回复。补救措施：长度归一化奖励，或使用长度感知RM的RLAIF。
- **RM过小。** RM至少需要与策略同样大。一个过小的RM无法可靠地对策略输出进行评分。
- **KL调参。** β过低 → 漂移和奖励黑客。β过高 → 策略几乎不变。标准技巧是使用*自适应*β，目标为每步固定KL。
- **偏好数据噪声。** 大约30%的人类标注存在噪声或歧义。通过在一致性过滤后的数据上训练RM或对BT使用温度进行校准。
- **离策略问题。** 第一个epoch后PPO数据略微偏离策略。如第08课所述，监控裁剪比例。

## 使用

2026年的RLHF是分层的：

| 层次 | 目标 | 方法 |
|------|------|------|
| 指令遵循、有用性、无害性 | 对齐 | DPO（阶段10·08）优于RLHF-PPO。 |
| 推理正确性（数学、代码） | 能力 | 带验证器奖励的GRPO（阶段9·12）。 |
| 长期多步任务 | 智能体 | 基于步骤的PPO/GRPO与过程奖励模型。 |
| 安全性 / 拒绝行为 | 安全性 | 单独安全RM的RLHF-PPO，或宪法AI。 |
| 推理时的Best-of-N | 快速对齐 | 解码时使用RM；无需策略训练。 |
| 奖励蒸馏 | 推理计算 | 在冻结的LM顶部训练小型"奖励头"。 |

RLHF在2022–2024年是*核心*方法。到2026年，生产级对齐管线以DPO为首选，仅在对RM密集型或安全关键步骤使用PPO。

## 输出

保存为 `outputs/skill-rlhf-architect.md`：

```markdown
---
name: rlhf-architect
description: 为语言模型设计RLHF / DPO / GRPO对齐管线，包括RM、KL和数据策略。
version: 1.0.0
phase: 9
lesson: 9
tags: [rl, rlhf, alignment, llm]
---

给定一个基础LM、目标行为（对齐/推理/拒绝/智能体）以及偏好或验证器预算，输出：

1. 阶段。SFT？RM？DPO？GRPO？附上理由。
2. 偏好或验证器来源。人类、AI反馈、基于规则、单元测试通过或奖励蒸馏。
3. KL策略。固定β、自适应β或DPO（隐式KL）。
4. 诊断指标。平均KL、奖励稳定性、过度优化防护（留出人类评估集）。
5. 安全门控。红队测试集、拒绝率、独立于有用性RM的安全RM。

如果RLHF-PPO管线没有KL监控器，则拒绝发布。如果RM小于目标策略，则拒绝使用。拒绝仅以长度为奖励。标记任何未保留盲法人类评估集的管线，因为其缺乏过度优化保护。
```

## 练习

1. **简单。** 在 `code/main.py` 中用500个合成偏好对训练Bradley-Terry奖励模型。在100个保留的成对数据上测量成对准确率。应超过90%。
2. **中等。** 使用 `β ∈ {0.0, 0.1, 1.0}` 运行玩具PPO-RLHF循环。对于每个β，绘制RM分数与到参考模型KL随更新的变化图。哪个运行出现了奖励黑客？
3. **困难。** 在相同偏好数据上实现DPO（闭式偏好似然损失），并与RLHF-PPO管线在所用计算量和最终RM分数方面进行比较。

## 关键术语

| 术语 | 人们所说的 | 实际含义 |
|------|-----------|----------|
| RLHF | "对齐RL" | 三阶段SFT + RM + PPO管线（Christiano 2017, Ouyang 2022）。 |
| 奖励模型（RM） | "评分网络" | 通过Bradley-Terry拟合到成对偏好的学习标量函数。 |
| Bradley-Terry | "成对逻辑损失" | `P(y_+ ≻ y_-) = σ(R(y_+) - R(y_-))`；标准的RM目标。 |
| KL惩罚 | "停留在参考附近" | 奖励中的 `β · KL(π_θ || π_ref)`；抗奖励黑客正则化项。 |
| 奖励黑客 | "古德哈特定律" | 策略利用RM缺陷；症状：奖励上升，人类评估平坦。 |
