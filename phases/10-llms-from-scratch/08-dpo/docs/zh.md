# 直接偏好优化（DPO）

## 学习目标

完成本课程后，你将能够：

- 理解为什么 DPO 用监督学习替代了 RLHF 中的 RL 部分
- 从 Bradley-Terry 模型推导出 DPO 损失函数
- 在偏好数据上训练一个 DPO 模型，无需奖励模型或 PPO
- 提取并分析隐式奖励以验证训练效果
- 调整 beta 参数来控制与参考模型的偏离程度
- 比较 DPO 与 RLHF 在复杂度、稳定性和性能方面的差异

## 核心概念

### DPO 的核心洞察

RLHF 训练三个模型：策略模型、奖励模型、参考模型。PPO 循环生成响应、评分、计算优势、裁剪更新——计算量大且不稳定。

DPO 意识到一个关键事实：**语言模型本身就可以作为奖励模型**。策略与参考模型之间的对数概率比，与 Bradley-Terry 模型中的奖励差异成正比。因此，DPO 直接从偏好数据优化策略，完全绕过奖励模型和 PPO。

结果：一个损失函数、一个训练循环、两个模型（策略 + 参考）。没有生成步骤，没有奖励推断，没有优势估计。

### 从奖励模型到策略优化

RLHF 的流程：

1. 训练奖励模型 $r_\theta(x, y)$ 来预测人类偏好
2. 使用 PPO 优化策略 $pi_\phi$ 以最大化奖励，同时通过 KL 散度惩罚保持接近参考模型

DPO 展示了奖励可以表示为策略与参考之间的对数概率比：

$$r(x, y) = \beta \log \frac{\pi_\phi(y|x)}{\pi_{\text{ref}}(y|x)}$$

其中 $\beta$ 控制策略与参考的偏离程度。将此代入 Bradley-Terry 偏好模型，得到 DPO 损失：

$$\mathcal{L}_{\text{DPO}}(\pi_\phi; \pi_{\text{ref}}) = -\mathbb{E}_{(x, y_w, y_l) \sim \mathcal{D}} \left[ \log \sigma \left( \beta \log \frac{\pi_\phi(y_w|x)}{\pi_{\text{ref}}(y_w|x)} - \beta \log \frac{\pi_\phi(y_l|x)}{\pi_{\text{ref}}(y_l|x)} \right) \right]$$

其中：
- $x$ = prompt
- $y_w$ = 偏好的（"胜利"）响应
- $y_l$ = 被拒绝的（"失败"）响应
- $\sigma$ = sigmoid 函数
- $\beta$ = 温度/正则化参数

当策略对偏好响应的概率高于参考，且对被拒绝响应的概率低于参考时，sigmoid 的参数为正，损失较低。训练信号推动策略朝这个方向发展。

### 隐式奖励

DPO 不显式训练奖励模型，但你可以从对数概率比中提取隐式奖励：

$$\hat{r}(x, y) = \beta \log \frac{\pi_\phi(y|x)}{\pi_{\text{ref}}(y|x)}$$

这告诉你当前策略对给定响应的评价相对于参考模型如何。正值表示策略比参考更喜欢该响应；负值表示不太喜欢。

### Beta 参数

Beta 是 DPO 中唯一需要调整的超参数：

- **低 beta（0.01-0.05）**：允许策略大幅偏离参考。学习更快，但可能不稳定或产生退化输出
- **中等 beta（0.1-0.3）**：大多数应用的最佳平衡点
- **高 beta（0.5-1.0）**：将策略紧密约束在参考附近。稳定但学习缓慢

Beta 类似于 RLHF 中的 KL 系数，但更简单——它是一个乘法因子，而不是约束优化中的拉格朗日乘子。

## 构建

### 步骤 1：偏好数据格式

DPO 需要成对的偏好数据：每个示例包含一个 prompt、一个偏好响应和一个被拒绝的响应。

```python
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

### 步骤 2：序列对数概率

DPO 损失需要计算给定 prompt 下响应的总对数概率。这意味着在完整的（prompt + 响应）序列上运行模型，并对每个响应 token 的对数概率求和。

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

这个函数是 DPO 的主力。对于每个偏好对，它运行四次：模型在偏好响应上、模型在被拒绝响应上、参考模型在偏好响应上、参考模型在被拒绝响应上。每个训练样本需要 4 次前向传播，而 RLHF 需要生成 + 奖励评分 + 价值估计 + PPO 更新。更简单、更快、更稳定。

### 步骤 3：DPO 损失

论文的核心代码。一个函数。一个损失。不需要奖励模型。

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

    return loss, {
        "preferred_ratio": float(preferred_ratio),
        "rejected_ratio": float(rejected_ratio),
        "logit": float(logit),
        "implicit_preferred_reward": float(preferred_reward),
        "implicit_rejected_reward": float(rejected_reward),
        "reward_margin": float(preferred_reward - rejected_reward),
    }
```

`preferred_ratio` 和 `rejected_ratio` 来自 DPO 推导的对数概率比。当当前模型对偏好响应赋予更高概率（相对于参考），且对被拒绝响应赋予更低概率时，logit 为正，损失较低。训练信号正好推动模型朝这个方向发展。

`implicit_preferred_reward` 和 `implicit_rejected_reward` 是 DPO 损失隐式分配的奖励。你可以提取它们来验证训练是否有效——偏好与被拒绝奖励之间的差距应该随着训练逐渐增加。

### 步骤 4：DPO 训练循环

标准的监督学习训练循环。没有 PPO。没有奖励模型。只有前向传播和梯度更新。

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

与 RLHF 相比，训练循环简单得令人耳目一新。对于每个偏好对：计算四个对数概率（两个模型，两个响应），代入 DPO 损失，计算梯度，更新策略。没有生成步骤。没有奖励模型推断。没有优势估计。没有裁剪。

### 步骤 5：比较 DPO 与 RLHF

测量隐式奖励差距和对数概率偏移，将 DPO 与第 07 课的 RLHF 模型进行比较。

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

Beta 参数是 DPO 中等价于 RLHF 中 KL 系数的参数。它控制模型与参考的偏离程度。这个实验展示了它的效果。

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

小的 beta（0.01）允许模型自由偏离参考——学习快但有退化解的风险。大的 beta（1.0）将模型紧密约束在参考附近——稳定但学习缓慢。大多数应用的最佳平衡点为 0.1 到 0.3。

## 使用它

### 完整 DPO 流程演示

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

本课程生成 `outputs/prompt-alignment-method-selector.md` —— 一个帮助你为特定用例选择正确对齐方法（SFT、RLHF、DPO、KTO、ORPO、SimPO）的 prompt。根据你的数据可用性、计算预算和对齐目标，它推荐一种方法和训练计划。

## 练习

1. 实现 KTO（Kahneman-Tversky Optimization）。KTO 不需要成对数据——只需将每个响应标记为"好"或"坏"。好响应的损失为 `-log(sigmoid(beta * log_ratio))`，坏响应的损失为 `-log(1 - sigmoid(beta * log_ratio))`，坏响应损失上有损失厌恶乘数（通常为 1.5 倍）。在相同数据上训练（将偏好响应视为"好"，被拒绝的视为"坏"，独立处理），并与 DPO 比较准确率。

2. 实现长度归一化 DPO。不使用原始对数概率，而是除以响应 token 数量：`normalized_logprob = total_logprob / num_tokens`。这防止模型偏爱更短的响应（总对数概率更高）。比较有和没有归一化时的隐式奖励差距。

3. 构建 ORPO 风格的组合损失。将标准 next-token prediction 损失（在偏好响应上）加到 DPO 损失上：`L = L_sft(preferred) + alpha * L_dpo`。尝试 alpha 值为 0.1、0.5 和 1.0。组合损失应该产生一个既遵循指令（来自 SFT 项）又偏好更好响应（来自 DPO 项）的模型，无需单独的 SFT 阶段。

4. 实现迭代 DPO。运行 DPO 3 个 epoch，然后从训练好的模型生成新响应，将它们与原始偏好响应配对作为新的偏好对，再次运行 DPO。两轮这种"自我博弈"过程。比较第 1 轮和第 2 轮后的偏好准确率，看迭代细化是否有帮助。

5. 比较使用不同参考模型的 DPO。不使用 SFT checkpoint 作为参考，尝试：(a) 基础模型（pre-SFT），(b) DPO epoch 1 的 checkpoint，(c) 策略模型的指数移动平均。报告哪个参考产生最高的偏好准确率和最稳定的训练曲线。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| DPO | "没有 RL 的 RLHF" | 直接偏好优化：一种监督学习算法，直接在偏好对上优化语言模型，绕过奖励模型和 PPO |
| 隐式奖励 | "奖励在模型里" | 奖励函数由策略与参考模型之间的对数概率比决定——不需要单独的奖励模型 |
| Beta (DPO) | "温度" | 控制策略与参考模型的偏离程度——小的 beta 允许大幅偏离，大的 beta 保持模型接近参考 |
| 对数概率比 | "模型变化了多少" | log pi(y\|x) - log pi_ref(y\|x) —— 正值表示当前模型比参考赋予更高概率 |
| 参考模型 | "冻结的 checkpoint" | SFT 模型的副本，权重永不改变——作为计算概率比的锚点 |
| KTO | "不需要成对的 DPO" | Kahneman-Tversky Optimization：使用未成对的"好"或"坏"标签，不需要偏好对 |
| ORPO | "一步对齐" | Odds Ratio Preference Optimization：通过向 SFT 损失添加偏好项，将 SFT 和对齐合并为单个训练循环 |
| SimPO | "不需要参考模型" | Simple Preference Optimization：通过使用长度归一化的平均对数概率作为隐式奖励，完全消除参考模型 |
| 对齐税 | "让模型安全的代价" | 从基础模型到对齐模型所需的额外计算、数据和复杂度——DPO 显著降低了这一成本 |

## 延伸阅读

- [Rafailov et al., 2023 -- "Direct Preference Optimization: Your Language Model is Secretly a Reward Model"](https://arxiv.org/abs/2305.18290) —— 将 RLHF 简化为监督学习的 DPO 论文
- [Tunstall et al., 2023 -- "Zephyr: Direct Distillation of LM Alignment"](https://arxiv.org/abs/2310.16944) —— Zephyr-7B，展示在 UltraFeedback 上的 DPO 与 RLHF 在基准测试上表现相当
- [Ethayarajh et al., 2024 -- "KTO: Model Alignment as Prospect Theoretic Optimization"](https://arxiv.org/abs/2402.01306) —— 消除成对偏好的需求
- [Hong et al., 2024 -- "ORPO: Monolithic Preference Optimization without Reference Model"](https://arxiv.org/abs/2403.07691) —— 将 SFT 和对齐合并为一步
- [Meng et al., 2024 -- "SimPO: Simple Preference Optimization with a Reference-Free Reward"](https://arxiv.org/abs/2405.14734) —— 完全消除参考模型
- [Llama 3 Technical Report](https://arxiv.org/abs/2407.21783) —— Meta 结合 RLHF 和 DPO 的对齐流程
