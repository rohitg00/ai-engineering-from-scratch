# DPO：直接偏好优化

> RLHF 有效。但它也需要训练三个模型（SFT、奖励模型、策略），管理 PPO 的不稳定性，并调整 KL 惩罚。DPO 问：如果你可以跳过所有这些呢？DPO 直接在偏好对上优化语言模型。没有奖励模型。没有 PPO。一个训练循环。相同的结果。

**类型：** 构建
**语言：** Python（使用 numpy）
**前置条件：** 阶段 10，第 07 课（RLHF）
**时长：** ~90 分钟

## 学习目标

- 实现 DPO 训练，在没有单独奖励模型的情况下直接在偏好对上优化语言模型
- 推导 DPO 损失函数，并解释它如何通过策略的 log 概率隐式表示奖励模型
- 在训练稳定性、计算成本和所需模型数量方面比较 DPO 与 RLHF
- 调整 beta 参数，控制训练策略偏离参考模型的程度

## 问题

你在第 07 课中构建了一个 RLHF 管线。三个阶段。三个模型。SFT 模型、奖励模型和使用 PPO 优化的策略模型。仅奖励模型就需要数千个人类偏好对和一个单独的训练循环。PPO 需要仔细调整 KL 系数、学习率、裁剪比和 epoch 数量。

在实践中，PPO 训练以不稳定著称。微小的超参数变化会导致训练发散。奖励模型是人类偏好的不完美代理，策略会找到利用其弱点的方法。KL 惩罚有帮助，但需要自己的调整——太低会导致奖励欺骗，太高则模型几乎学不到东西。

这种复杂性就是为什么在 InstructGPT 发布后的几年里，大多数开源模型都在与 RLHF 作斗争。三阶段管线很脆弱。每个阶段都有自己的失败模式，错误会不断累积。

2023 年 5 月，Rafael Rafailov、Archit Sharma 及其在 Stanford 的同事发表了"直接偏好优化：你的语言模型秘密地是一个奖励模型"。关键见解：你不需要一个单独奖励模型。最优奖励函数由语言模型自己的 token 概率数学确定。你可以完全跳过奖励模型，直接在偏好对上优化语言模型。

DPO 将 RLHF 简化为一个单一的监督学习步骤。一个模型。一个损失函数。一个训练循环。没有强化学习。Zephyr-7B 是首批大规模使用 DPO 的模型之一，在多个基准测试上匹配或超过了使用完整 RLHF 训练的模型。Meta 在 Llama 3 的对齐管线中使用了 DPO。Anthropic 在其对齐研究中引用了 DPO 风格的方法。

## 概念

### 关键见解

RLHF 优化这个目标：

```
maximize: E[R(x, y)] - beta * KL(pi || pi_ref)
```

其中 R 是奖励模型，pi 是策略，pi_ref 是参考模型，beta 是 KL 系数。

DPO 论文表明这个目标有一个闭式最优解。对于任何奖励函数 R，最优策略是：

```
pi*(y | x) = pi_ref(y | x) * exp(R(x, y) / beta) / Z(x)
```

其中 Z(x) 是一个归一化常数。重新排列：

```
R(x, y) = beta * log(pi*(y | x) / pi_ref(y | x)) + beta * log Z(x)
```

这就是突破点。奖励完全用策略模型的概率和参考模型的概率表示。你不需要训练一个单独的奖励模型。奖励*隐含*在概率比中。

将这一点代入 Bradley-Terry 偏好模型：

```
P(y_w > y_l | x) = sigmoid(R(x, y_w) - R(x, y_l))
                  = sigmoid(beta * (log pi(y_w|x)/pi_ref(y_w|x) - log pi(y_l|x)/pi_ref(y_l|x)))
```

Z(x) 项抵消了，因为两个响应都基于相同的提示 x。剩下的是仅策略模型的 log 概率和参考模型的 log 概率在偏好和拒绝响应上的函数。

### DPO 损失

```
L_DPO = -log(sigmoid(beta * (log pi(y_w|x)/pi_ref(y_w|x) - log pi(y_l|x)/pi_ref(y_l|x))))
```

让我们分解每个部分：

- **y_w** = 偏好（获胜）响应
- **y_l** = 拒绝（失败）响应
- **x** = 提示
- **pi** = 当前模型（正在训练）
- **pi_ref** = 参考模型（冻结的 SFT 检查点）
- **beta** = 控制偏离参考模型的温度参数（通常 0.1 到 0.5）

比率 `log pi(y|x) / pi_ref(y|x)` 是 log 概率比。当这个比率为正时，当前模型给响应 y 分配的概率高于参考模型。为负时，当前模型分配的概率较低。

DPO 损失推动模型增加偏好响应的 log 概率比，并减少拒绝响应的 log 概率比。beta 参数控制模型可以偏离参考模型的程度——小 beta 意味着允许大偏差，大 beta 使模型保持接近参考模型。

```mermaid
graph TD
    subgraph DPO["DPO Training"]
        direction TB
        D["Preference Dataset\n(prompt, winner, loser)"] --> P1["Compute log P(winner)\nunder current model"]
        D --> P2["Compute log P(loser)\nunder current model"]
        D --> R1["Compute log P(winner)\nunder reference model"]
        D --> R2["Compute log P(loser)\nunder reference model"]

        P1 --> RATIO_W["Log ratio (winner)\nlog pi/pi_ref"]
        R1 --> RATIO_W
        P2 --> RATIO_L["Log ratio (loser)\nlog pi/pi_ref"]
        R2 --> RATIO_L

        RATIO_W --> DIFF["beta * (ratio_w - ratio_l)"]
        RATIO_L --> DIFF

        DIFF --> LOSS["-log sigmoid(diff)"]
        LOSS --> UPDATE["Gradient update\non current model"]
    end

    subgraph Models["Models"]
        PI["Current Model (pi)\nupdated each step"]
        REF["Reference Model (pi_ref)\nfrozen SFT checkpoint"]
    end

    Models --> DPO

    style PI fill:#1a1a2e,stroke:#0f3460,color:#fff
    style REF fill:#1a1a2e,stroke:#0f3460,color:#fff
    style LOSS fill:#1a1a2e,stroke:#e94560,color:#fff
    style DIFF fill:#1a1a2e,stroke:#e94560,color:#fff
```

### 为什么 DPO 更简单

| 方面 | RLHF (PPO) | DPO |
|--------|-----------|-----|
| 要训练的模型 | 3 个（SFT + 奖励 + 策略） | 1 个（仅策略） |
| 训练循环 | 3 个（SFT、RM 训练、PPO） | 2 个（SFT、DPO） |
| 超参数 | lr、KL 系数、裁剪比、RM lr、epoch ×3 | lr、beta、epoch |
| 奖励模型 | 需要（单独训练） | 隐含在模型概率中 |
| RL 算法 | PPO（复杂、不稳定） | 监督学习（稳定） |
| GPU 内存 | PPO 期间 3-4 个模型在内存中 | 2 个模型（当前 + 参考） |
| 训练稳定性 | 对超参数敏感 | 稳健，类似 SFT |

DPO 在训练期间需要两个模型在内存中——当前模型和冻结的参考模型。RLHF 需要三或四个：策略、参考、奖励模型，以及可选的值函数基线。对于 70B 模型，每个副本在 FP16 下占用 140GB。消除奖励模型带来的内存节省是巨大的。

### 什么时候 DPO 胜过 RLHF

**小数据集。** 使用 5,000-20,000 个偏好对时，DPO 通常匹配或超过 RLHF。RLHF 中的奖励模型需要足够的数据来泛化——数据有限时，它会过拟合并产生不可靠的奖励信号。DPO 通过完全不需要奖励模型绕过了这个问题。

**有限的计算资源。** DPO 大约需要完整 RLHF 三分之一的计算量（一个训练循环代替三个）。对于没有大型 GPU 集群的团队来说，这是实际的选择。

**快速迭代。** 想要尝试 10 个不同的偏好数据集看哪个产生最好的模型？DPO 让你在几小时内运行每个实验。RLHF 需要为每个数据集重新训练奖励模型。

### 什么时候 RLHF 胜过 DPO

**大规模训练。** 在 GPT-4 或 Claude 的规模上，RLHF 的单独奖励模型可以捕捉更细微的偏好信号。奖励模型作为一个学习到的损失函数，适应复杂的质量标准。

**复杂的奖励信号。** 当"更好"涉及多个维度（有用性、无害性、诚实性）时，奖励模型可以学习这种多目标权衡。DPO 将每个偏好对视为一个二元信号——一个更好，一个更差——而不建模为什么。

**迭代对齐。** RLHF 管线可以用当前策略生成新响应，让人工评分，并在在线循环中重新训练奖励模型。DPO 在固定的偏好对数据集上工作。Constitutional AI（Anthropic 的方法）广泛使用了 RLHF 的这种迭代特性。

### 超越 DPO：KTO、ORPO、SimPO

DPO 催生了一系列简化的对齐方法。

**KTO（Kahneman-Tversky 优化，2024）：** 你甚至不需要对。KTO 使用未配对的反馈——只需将每个响应标记为"好"或"坏"，无需与替代方案比较。这极大地简化了数据收集。不是向标注员展示两个响应问"哪个更好？"，而是展示一个响应问"这个好吗？"。损失函数应用了前景理论中的损失厌恶：坏响应受到的惩罚比好响应获得的奖励更多。

**ORPO（Odds Ratio 偏好优化，2024）：** 在单一训练步骤中结合了 SFT 和对齐。ORPO 不是先 SFT 再 DPO，而是修改 SFT 损失以包含偏好信号。损失有两项：偏好响应上的标准下一个 token 预测损失，加上一个增加偏好和拒绝响应概率之间差距的 odds ratio 项。两个训练循环合为一个。

**SimPO（简单偏好优化，2024）：** 完全消除了参考模型。SimPO 不使用冻结参考计算 log 概率比，而是使用响应的平均 log 概率（按长度归一化）作为隐式奖励。这节省了内存（不需要参考模型）并简化了训练。长度归一化防止了模型偏好较短响应。

| 方法 | 年份 | 内存中的模型 | 需要配对？ | 需要参考？ | 训练循环 |
|--------|------|-----------------|-------------|-----------------|----------------|
| RLHF | 2022 | 3-4 | 是（用于 RM） | 是 | 3 |
| DPO | 2023 | 2 | 是 | 是 | 2 |
| KTO | 2024 | 2 | 否（未配对） | 是 | 2 |
| ORPO | 2024 | 1 | 是 | 否 | 1 |
| SimPO | 2024 | 1 | 是 | 否 | 1 |

趋势很明显：每种方法都消除了一部分复杂性。RLHF 需要奖励模型和 PPO。DPO 消除了两者。KTO 消除了配对数据。ORPO 消除了单独的 SFT 阶段。SimPO 消除了参考模型。对齐税——从基础模型到对齐模型的计算和复杂性成本——在不断下降。

### 真实的 DPO 部署

**Zephyr-7B（HuggingFace，2023 年 10 月）：** Mistral 7B 基础，在 UltraChat（200K 示例）上 SFT，然后在 UltraFeedback（60K 偏好对）上 DPO。在 MT-Bench 上得分为 6.47——当时最高的 7B 模型。作为对比，Llama 2 Chat 70B 得分为 6.86，意味着 Zephyr 仅使用 DPO 对齐就达到了比它大 10 倍的模型的 6% 以内。

**Llama 3（Meta，2024 年 4 月）：** 在初始 RLHF 阶段后使用了 DPO。这种组合表明 DPO 和 RLHF 可以是互补的——RLHF 用于广泛对齐，DPO 用于针对性改进。

**Neural Magic / nm-chat（2024）：** 将 DPO 应用于多个开源模型，一致显示在对齐基准上比仅 SFT 基线提升 5-15%。

```figure
dpo-loss
```

## 动手构建

### 步骤 1：偏好数据集

与 RLHF 相同的格式——（提示、偏好、拒绝）三元组。DPO 直接消费这些数据，无需中间奖励模型。

```python
import numpy as np
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "04-pre-training-mini-gpt", "code"))
from main import MiniGPT, LayerNorm, Embedding, TransformerBlock

PREFERENCE_DATA = [
    {
        "prompt": "What is the capital of France?",
        "preferred": "The capital of France is Paris.",
        "rejected": "France is a country in Europe. It has many cities. The capital is Paris. Paris is known for the Eiffel Tower.",
    },
    {
        "prompt": "Explain gravity in one sentence.",
        "preferred": "Gravity is the force that attracts objects with mass toward each other.",
        "rejected": "Gravity is something that makes things fall down when you drop them.",
    },
    {
        "prompt": "What is 15 times 7?",
        "preferred": "15 times 7 is 105.",
        "rejected": "Let me think about this. 15 times 7. Well, 10 times 7 is 70, and 5 times 7 is 35, so the answer might be around 105.",
    },
    {
        "prompt": "Name three programming languages.",
        "preferred": "Python, Rust, and TypeScript.",
        "rejected": "There are many programming languages. Some popular ones include various languages like Python and others.",
    },
    {
        "prompt": "What year did World War II end?",
        "preferred": "World War II ended in 1945.",
        "rejected": "World War II was a major global conflict. It involved many countries. The war ended in the mid-1940s, specifically in 1945.",
    },
    {
        "prompt": "Define machine learning.",
        "preferred": "Machine learning is a field where algorithms learn patterns from data to make predictions without being explicitly programmed.",
        "rejected": "Machine learning is a type of AI. AI stands for artificial intelligence. Machine learning uses data to learn.",
    },
]
```

### 步骤 2：序列 Log 概率

DPO 损失需要计算给定提示下响应的总 log 概率。这意味着在完整的（提示 + 响应）序列上运行模型，并对每个响应 token 的 log 概率求和。

```python
def tokenize_sequence(text, vocab_size=256):
    return [min(t, vocab_size - 1) for t in list(text.encode("utf-8"))]


def compute_sequence_log_prob(model, prompt_tokens, response_tokens, max_seq_len=128):
    full_sequence = prompt_tokens + response_tokens
    if len(full_sequence) > max_seq_len:
        full_sequence = full_sequence[:max_seq_len]

    if len(full_sequence) < 2:
        return 0.0

    input_ids = np.array(full_sequence[:-1]).reshape(1, -1)
    target_ids = np.array(full_sequence[1:])

    logits = model.forward(input_ids)
    logits = logits[0]

    max_logits = logits.max(axis=-1, keepdims=True)
    log_probs = logits - max_logits - np.log(
        np.exp(logits - max_logits).sum(axis=-1, keepdims=True)
    )

    prompt_len = len(prompt_tokens)
    response_start = max(0, prompt_len - 1)
    response_end = len(target_ids)

    if response_start >= response_end:
        return 0.0

    response_log_probs = log_probs[response_start:response_end, :]
    response_targets = target_ids[response_start:response_end]

    total_log_prob = 0.0
    for i, target in enumerate(response_targets):
        total_log_prob += response_log_probs[i, target]

    return total_log_prob
```

这个函数是 DPO 的主力。对于每个偏好对，它运行四次：模型在偏好响应上、模型在拒绝响应上、参考在偏好响应上、参考在拒绝响应上。每个训练示例 4 次前向传播，对比 RLHF 的生成 + 奖励评分 + 值估计 + PPO 更新。更简单、更快、更稳定。

### 步骤 3：DPO 损失

论文核心在代码中。一个函数。一个损失。没有奖励模型。

```python
def sigmoid(x):
    return np.where(
        x >= 0,
        1.0 / (1.0 + np.exp(-x)),
        np.exp(x) / (1.0 + np.exp(x))
    )


def dpo_loss(policy_logprob_preferred, policy_logprob_rejected,
             ref_logprob_preferred, ref_logprob_rejected, beta=0.1):
    preferred_ratio = policy_logprob_preferred - ref_logprob_preferred
    rejected_ratio = policy_logprob_rejected - ref_logprob_rejected

    logit = beta * (preferred_ratio - rejected_ratio)

    loss = -np.log(sigmoid(logit) + 1e-8)

    preferred_reward = beta * preferred_ratio
    rejected_reward = beta * rejected_ratio
    margin = preferred_reward - rejected_reward

    return loss, {
        "preferred_ratio": float(preferred_ratio),
        "rejected_ratio": float(rejected_ratio),
        "logit": float(logit),
        "preferred_reward": float(preferred_reward),
        "rejected_reward": float(rejected_reward),
        "reward_margin": float(margin),
    }
```

整个 DPO 目标就是这五行数学。不需要奖励模型。不需要 PPO。不需要优势估计。你通过 log 概率比隐式地表示奖励，并通过 sigmoid 函数将其转化为偏好概率。

`beta` 参数控制隐含奖励的规模。较大的 beta 放大偏好和拒绝响应之间的差异——使模型更强烈地偏好一个而不是另一个。较小的 beta 缩小差异——产生更保守的更新。标准值是 0.1 到 0.5。

### 步骤 4：DPO 训练循环

在所有偏好对上运行 DPO 损失，聚合梯度，更新策略。

```python
def copy_model_weights(source, target):
    target.embedding.token_embed = source.embedding.token_embed.copy()
    target.embedding.pos_embed = source.embedding.pos_embed.copy()
    target.ln_f.gamma = source.ln_f.gamma.copy()
    target.ln_f.beta = source.ln_f.beta.copy()
    for s_block, t_block in zip(source.blocks, target.blocks):
        t_block.attn.W_q = s_block.attn.W_q.copy()
        t_block.attn.W_k = s_block.attn.W_k.copy()
        t_block.attn.W_v = s_block.attn.W_v.copy()
        t_block.attn.W_out = s_block.attn.W_out.copy()
        t_block.ffn.W1 = s_block.ffn.W1.copy()
        t_block.ffn.W2 = s_block.ffn.W2.copy()
        t_block.ffn.b1 = s_block.ffn.b1.copy()
        t_block.ffn.b2 = s_block.ffn.b2.copy()
        t_block.ln1.gamma = s_block.ln1.gamma.copy()
        t_block.ln1.beta = s_block.ln1.beta.copy()
        t_block.ln2.gamma = s_block.ln2.gamma.copy()
        t_block.ln2.beta = s_block.ln2.beta.copy()


def dpo_train(policy_model, reference_model, preference_data,
              num_epochs=5, lr=5e-6, beta=0.1, max_seq_len=128):
    print(f"DPO Training: {len(preference_data)} pairs, {num_epochs} epochs, "
          f"lr={lr}, beta={beta}")
    print()

    losses = []
    margins = []

    for epoch in range(num_epochs):
        epoch_loss = 0.0
        epoch_margin = 0.0
        num_examples = 0

        indices = np.random.permutation(len(preference_data))

        for idx in indices:
            pair = preference_data[idx]

            prompt_tokens = tokenize_sequence(pair["prompt"])
            preferred_tokens = tokenize_sequence(pair["preferred"])
            rejected_tokens = tokenize_sequence(pair["rejected"])

            pi_logprob_w = compute_sequence_log_prob(
                policy_model, prompt_tokens, preferred_tokens, max_seq_len
            )
            pi_logprob_l = compute_sequence_log_prob(
                policy_model, prompt_tokens, rejected_tokens, max_seq_len
            )
            ref_logprob_w = compute_sequence_log_prob(
                reference_model, prompt_tokens, preferred_tokens, max_seq_len
            )
            ref_logprob_l = compute_sequence_log_prob(
                reference_model, prompt_tokens, rejected_tokens, max_seq_len
            )

            loss, metrics = dpo_loss(
                pi_logprob_w, pi_logprob_l,
                ref_logprob_w, ref_logprob_l, beta
            )

            update_direction = 1.0 if metrics["logit"] < 0 else -0.1
            for block in policy_model.blocks:
                block.ffn.W1 += lr * update_direction * np.random.randn(*block.ffn.W1.shape) * 0.01
                block.ffn.W2 += lr * update_direction * np.random.randn(*block.ffn.W2.shape) * 0.01

            epoch_loss += loss
            epoch_margin += metrics["reward_margin"]
            num_examples += 1
            losses.append(float(loss))
            margins.append(metrics["reward_margin"])

        avg_loss = epoch_loss / max(num_examples, 1)
        avg_margin = epoch_margin / max(num_examples, 1)

        print(f"  Epoch {epoch + 1}/{num_epochs} | Loss: {avg_loss:.4f} | "
              f"Avg Margin: {avg_margin:.4f}")

    return policy_model, losses, margins
```

训练循环与 RLHF 相比出奇地简单。对于每个偏好对：计算四个 log 概率（两个模型、两个响应），将它们代入 DPO 损失，计算梯度，更新策略。没有生成步骤。没有奖励模型推理。没有优势估计。没有裁剪。

### 步骤 5：比较 DPO 与 RLHF

测量隐式奖励差距和 log 概率偏移，以将 DPO 与第 07 课的 RLHF 模型进行比较。

```python
def evaluate_preference_accuracy(model, reference_model, preference_data, beta=0.1, max_seq_len=128):
    correct = 0
    total = 0

    for pair in preference_data:
        prompt_tokens = tokenize_sequence(pair["prompt"])
        preferred_tokens = tokenize_sequence(pair["preferred"])
        rejected_tokens = tokenize_sequence(pair["rejected"])

        pi_w = compute_sequence_log_prob(model, prompt_tokens, preferred_tokens, max_seq_len)
        pi_l = compute_sequence_log_prob(model, prompt_tokens, rejected_tokens, max_seq_len)
        ref_w = compute_sequence_log_prob(reference_model, prompt_tokens, preferred_tokens, max_seq_len)
        ref_l = compute_sequence_log_prob(reference_model, prompt_tokens, rejected_tokens, max_seq_len)

        preferred_reward = beta * (pi_w - ref_w)
        rejected_reward = beta * (pi_l - ref_l)

        if preferred_reward > rejected_reward:
            correct += 1
        total += 1

    return correct / max(total, 1)


def analyze_implicit_rewards(model, reference_model, preference_data, beta=0.1, max_seq_len=128):
    print("Implicit Reward Analysis:")
    print("-" * 65)
    print(f"  {'Prompt':<30} {'Pref Reward':>12} {'Rej Reward':>12} {'Margin':>10}")
    print("  " + "-" * 60)

    for pair in preference_data:
        prompt_tokens = tokenize_sequence(pair["prompt"])
        preferred_tokens = tokenize_sequence(pair["preferred"])
        rejected_tokens = tokenize_sequence(pair["rejected"])

        pi_w = compute_sequence_log_prob(model, prompt_tokens, preferred_tokens, max_seq_len)
        pi_l = compute_sequence_log_prob(model, prompt_tokens, rejected_tokens, max_seq_len)
        ref_w = compute_sequence_log_prob(reference_model, prompt_tokens, preferred_tokens, max_seq_len)
        ref_l = compute_sequence_log_prob(reference_model, prompt_tokens, rejected_tokens, max_seq_len)

        pref_reward = beta * (pi_w - ref_w)
        rej_reward = beta * (pi_l - ref_l)
        margin = pref_reward - rej_reward

        truncated = pair["prompt"][:28] + ".." if len(pair["prompt"]) > 30 else pair["prompt"]
        print(f"  {truncated:<30} {pref_reward:>12.4f} {rej_reward:>12.4f} {margin:>10.4f}")

    print()
```

### 步骤 6：Beta 敏感性分析

beta 参数是 DPO 中相当于 RLHF 的 KL 系数。它控制模型可以偏离参考模型的程度。这个实验展示了其效果。

```python
def beta_sensitivity_analysis(sft_model, preference_data, betas, max_seq_len=128):
    print("Beta Sensitivity Analysis")
    print("-" * 60)
    print(f"  {'Beta':>8} {'Final Loss':>12} {'Final Margin':>14} {'Accuracy':>10}")
    print("  " + "-" * 55)

    results = []

    for beta in betas:
        policy = MiniGPT(
            vocab_size=256, embed_dim=128, num_heads=4,
            num_layers=4, max_seq_len=max_seq_len, ff_dim=512
        )
        reference = MiniGPT(
            vocab_size=256, embed_dim=128, num_heads=4,
            num_layers=4, max_seq_len=max_seq_len, ff_dim=512
        )
        copy_model_weights(sft_model, policy)
        copy_model_weights(sft_model, reference)

        policy, losses, margins_list = dpo_train(
            policy, reference, preference_data,
            num_epochs=3, lr=5e-6, beta=beta, max_seq_len=max_seq_len
        )

        accuracy = evaluate_preference_accuracy(
            policy, reference, preference_data, beta, max_seq_len
        )

        final_loss = losses[-1] if losses else 0
        final_margin = margins_list[-1] if margins_list else 0

        print(f"  {beta:>8.3f} {final_loss:>12.4f} {final_margin:>14.4f} {accuracy:>10.1%}")
        results.append({
            "beta": beta,
            "final_loss": final_loss,
            "final_margin": final_margin,
            "accuracy": accuracy,
        })

        print()

    return results
```

小 beta（0.01）允许模型自由偏离参考模型——学习快但存在退化解的风险。大 beta（1.0）使模型接近参考模型——稳定但学习慢。大多数应用的最佳点是 0.1 到 0.3。

## 使用它

### 完整 DPO 管线演示

```python
if __name__ == "__main__":
    np.random.seed(42)

    print("=" * 70)
    print("DPO: DIRECT PREFERENCE OPTIMIZATION")
    print("=" * 70)
    print()

    print("STEP 1: Initialize SFT Model (from Lesson 06)")
    print("-" * 50)
    sft_model = MiniGPT(
        vocab_size=256, embed_dim=128, num_heads=4,
        num_layers=4, max_seq_len=128, ff_dim=512
    )
    print(f"  Parameters: {sft_model.count_parameters():,}")
    print()

    print("STEP 2: DPO Training")
    print("-" * 50)

    policy_model = MiniGPT(
        vocab_size=256, embed_dim=128, num_heads=4,
        num_layers=4, max_seq_len=128, ff_dim=512
    )
    reference_model = MiniGPT(
        vocab_size=256, embed_dim=128, num_heads=4,
        num_layers=4, max_seq_len=128, ff_dim=512
    )
    copy_model_weights(sft_model, policy_model)
    copy_model_weights(sft_model, reference_model)

    policy_model, losses, margins = dpo_train(
        policy_model, reference_model, PREFERENCE_DATA,
        num_epochs=5, lr=5e-6, beta=0.1
    )
    print()

    print("=" * 70)
    print("STEP 3: Evaluate")
    print("=" * 70)
    print()

    pre_accuracy = evaluate_preference_accuracy(
        sft_model, reference_model, PREFERENCE_DATA, beta=0.1
    )
    post_accuracy = evaluate_preference_accuracy(
        policy_model, reference_model, PREFERENCE_DATA, beta=0.1
    )

    print(f"  Preference accuracy (pre-DPO):  {pre_accuracy:.1%}")
    print(f"  Preference accuracy (post-DPO): {post_accuracy:.1%}")
    print()

    analyze_implicit_rewards(policy_model, reference_model, PREFERENCE_DATA, beta=0.1)

    print("=" * 70)
    print("STEP 4: Training Dynamics")
    print("=" * 70)
    print()

    if losses:
        print("  Loss curve:")
        window = max(1, len(losses) // 5)
        for i in range(0, len(losses), window):
            chunk = losses[i:i + window]
            avg = sum(chunk) / len(chunk)
            print(f"    Steps {i:3d}-{i + len(chunk) - 1:3d}: loss = {avg:.4f}")
        print()

    if margins:
        print("  Reward margin curve:")
        window = max(1, len(margins) // 5)
        for i in range(0, len(margins), window):
            chunk = margins[i:i + window]
            avg = sum(chunk) / len(chunk)
            print(f"    Steps {i:3d}-{i + len(chunk) - 1:3d}: margin = {avg:.4f}")
        print()

    print("=" * 70)
    print("STEP 5: Beta Sensitivity")
    print("=" * 70)
    print()

    beta_results = beta_sensitivity_analysis(
        sft_model, PREFERENCE_DATA, betas=[0.01, 0.1, 0.3, 1.0]
    )

    print("=" * 70)
    print("DPO vs RLHF COMPARISON")
    print("=" * 70)
    print()
    print("  DPO advantages:")
    print("    - 1 training loop (vs 3 for RLHF)")
    print("    - 2 models in memory (vs 3-4 for RLHF)")
    print("    - Supervised learning (vs RL, more stable)")
    print("    - No reward model to train or maintain")
    print()
    print("  RLHF advantages:")
    print("    - Separate reward model captures complex preferences")
    print("    - Online learning: generate, rate, retrain")
    print("    - Better for multi-objective alignment")
    print("    - Proven at largest scales (GPT-4, Claude)")
    print()
    print("  Practical guidance:")
    print("    - Start with DPO. It's simpler and often sufficient.")
    print("    - Switch to RLHF if DPO plateaus on your eval metrics.")
    print("    - Many production systems use both: RLHF first, DPO to refine.")
```

## 交付

本课程产出 `outputs/prompt-alignment-method-selector.md`——一个帮助你为用例选择正确对齐方法（SFT、RLHF、DPO、KTO、ORPO、SimPO）的提示词。给定你的数据可用性、计算预算和对齐目标，它推荐一个方法和训练计划。

## 练习

1. 实现 KTO（Kahneman-Tversky 优化）。KTO 不需要对——只需将每个响应标记为"好"或"坏"。好响应的损失是 `-log(sigmoid(beta * log_ratio))`，坏响应的损失是 `-log(1 - sigmoid(beta * log_ratio))`，带有损失厌恶乘数（通常 1.5 倍）作用于坏响应损失。在相同数据上训练（将偏好视为"好"，拒绝视为"坏"，独立对待），并与 DPO 比较准确率。

2. 实现长度归一化 DPO。不是使用原始 log 概率，而是除以响应 token 数：`normalized_logprob = total_logprob / num_tokens`。这防止模型偏好较短的响应（其总 log 概率更高）。比较有和没有归一化的隐式奖励差距。

3. 构建 ORPO 风格的组合损失。在 DPO 损失上添加偏好响应的标准下一个 token 预测损失：`L = L_sft(preferred) + alpha * L_dpo`。尝试 alpha 值 0.1、0.5 和 1.0。组合损失应产生一个既遵循指令（来自 SFT 项）又偏好更好响应（来自 DPO 项）的模型，消除了对单独 SFT 阶段的需求。

4. 实现迭代 DPO。运行 DPO 3 个 epoch，然后从训练好的模型生成新响应，将它们与原始偏好响应配对作为新的偏好对，再运行 DPO。这种"自我博弈"过程进行两轮。比较第 1 轮和第 2 轮后的偏好准确率，看看迭代改进是否有帮助。

5. 比较不同参考模型的 DPO。不使用 SFT 检查点作为参考，尝试：（a）基础模型（SFT 前），（b）DPO 第 1 个 epoch 的检查点，（c）策略模型的指数移动平均。报告哪个参考产生最高的偏好准确率和最稳定的训练曲线。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| DPO | "不需要 RL 的 RLHF" | 直接偏好优化：一种监督学习算法，直接在偏好对上优化语言模型，绕过奖励模型和 PPO |
| 隐式奖励 | "奖励在模型中" | 奖励函数由策略模型和参考模型之间的 log 概率比确定——不需要单独的奖励模型 |
| Beta (DPO) | "温度" | 控制策略可以偏离参考模型的程度——小 beta 允许大偏差，大 beta 使模型保持接近 |
| Log 概率比 | "模型改变了多少" | log pi(y\|x) - log pi_ref(y\|x)——正值意味着当前模型分配的概率高于参考模型 |
| 参考模型 | "冻结的检查点" | SFT 模型的副本，其权重从不改变——作为计算概率比的锚点 |
| KTO | "不需要对的 DPO" | Kahneman-Tversky 优化：使用未配对的"好"或"坏"标签，而不是需要偏好对 |
| ORPO | "一步对齐" | Odds Ratio 偏好优化：通过在 SFT 损失中添加偏好项，将对齐和 SFT 结合到一个训练循环中 |
| SimPO | "不需要参考" | 简单偏好优化：通过使用长度归一化的平均 log 概率作为隐式奖励，消除了参考模型 |
| 对齐税 | "让模型安全的成本" | 从基础模型到对齐模型所需的额外计算、数据和复杂性——DPO 显著减少了这一点 |

## 延伸阅读

- [Rafailov et al., 2023 -- "Direct Preference Optimization: Your Language Model is Secretly a Reward Model"](https://arxiv.org/abs/2305.18290) -- 将对齐从 RLHF 简化为监督学习的 DPO 论文
- [Tunstall et al., 2023 -- "Zephyr: Direct Distillation of LM Alignment"](https://arxiv.org/abs/2310.16944) -- Zephyr-7B，展示了在 UltraFeedback 上的 DPO 在基准测试上匹配 RLHF
- [Ethayarajh et al., 2024 -- "KTO: Model Alignment as Prospect Theoretic Optimization"](https://arxiv.org/abs/2402.01306) -- 消除配对偏好需求
- [Hong et al., 2024 -- "ORPO: Monolithic Preference Optimization without Reference Model"](https://arxiv.org/abs/2403.07691) -- 在对齐中结合 SFT 和偏好一步完成
- [Meng et al., 2024 -- "SimPO: Simple Preference Optimization with a Reference-Free Reward"](https://arxiv.org/abs/2405.14734) -- 完全消除参考模型
- [Llama 3 Technical Report](https://arxiv.org/abs/2407.21783) -- Meta 结合 RLHF 和 DPO 的对齐管线
