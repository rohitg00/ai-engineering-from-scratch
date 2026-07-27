# RLHF：奖励模型 + PPO

> SFT 教会模型遵循指令。但它没有教会模型哪个响应*更好*。两个语法正确、事实准确的答案可能在有用性上差异巨大。RLHF 是将人类判断编码到模型行为中的方法。它让 Claude 变得有用、GPT 变得礼貌。

**类型：** 构建
**语言：** Python（使用 numpy）
**前置条件：** 阶段 10，第 06 课（指令微调 / SFT）
**时长：** ~90 分钟

## 学习目标

- 构建一个奖励模型，根据人类偏好对（选择 vs 拒绝）对响应质量进行评分
- 实现 PPO 训练循环，通过带有 KL 惩罚的奖励模型优化语言模型策略
- 解释为什么 RLHF 需要三个模型（SFT、奖励模型、策略），以及 KL 约束如何防止奖励欺骗
- 通过比较偏好优化前后的响应质量来评估 RLHF 的效果

## 问题

让一个模型"解释量子计算"，它可能产生：

**响应 A：** "量子计算使用可以处于叠加态的量子比特，这意味着它们可以同时为 0、1 或两者。这使得量子计算机在某些计算上比经典计算机呈指数级更快。关键算法包括用于大数分解的 Shor 算法和用于搜索未排序数据库的 Grover 算法。"

**响应 B：** "量子计算是一种使用量子力学现象的计算类型。它最早在 1980 年代被提出。Richard Feynman 建议量子系统可以由量子计算机模拟。此后该领域有了显著发展。许多公司现在正在研究量子计算机。IBM、Google 等公司已取得进展。量子优越性在 2019 年被 Google 宣称。"

两个响应都是事实正确的。两者语法都没问题。两者都遵循了指令。但响应 A 明显更好。它更简洁、信息更丰富、结构更好。人类每次都会选 A。

SFT 无法捕捉这种区别。它在"正确"的响应上训练模型，但它没有机制来表达"这个响应比那个更好"。它将每个训练示例视为同等优秀。如果 A 和 B 都出现在 SFT 数据集中，模型会从两者中学到同样多的东西。

RLHF 解决了这个问题。它训练一个奖励模型来预测人类会偏好哪个响应，然后使用那个奖励信号将语言模型推向更高质量的输出。InstructGPT（ChatGPT 的前身）使用 RLHF 显著提高了 GPT-3 的有用性、真实性和无害性。OpenAI 的内部评估者在 85% 的情况下偏好 InstructGPT 的输出而非 GPT-3 的输出，尽管 InstructGPT 小了 135 倍（1.3B vs 175B 参数）。

## 概念

### 三个阶段

RLHF 不是单一的训练运行。它是一个包含三个顺序阶段的管线，每个阶段建立在前一个之上。

**阶段 1：SFT。** 在指令-响应对上训练基础模型（第 06 课）。这给你一个能够遵循指令但不知道哪些响应比其他更好的模型。

**阶段 2：奖励模型。** 收集人类偏好数据：向标注员展示同一提示的两个响应，问"哪个更好？"训练一个模型来预测这些偏好。奖励模型以（提示、响应）为输入，输出一个标量分数。

**阶段 3：PPO。** 使用奖励模型为语言模型生成训练信号。语言模型生成响应，奖励模型对它们评分，PPO 更新语言模型以产生更高分数的响应。KL 散度惩罚防止语言模型偏离 SFT 检查点太远。

```mermaid
graph TD
    subgraph Stage1["Stage 1: SFT"]
        B["Base Model"] --> S["SFT Model"]
        D["Instruction Data\n(27K examples)"] --> S
    end

    subgraph Stage2["Stage 2: Reward Model"]
        S --> |"Generate responses"| P["Preference Pairs\n(prompt, winner, loser)"]
        H["Human Annotators"] --> P
        P --> R["Reward Model\nR(prompt, response) 鈫?score"]
    end

    subgraph Stage3["Stage 3: PPO"]
        S --> |"Initialize policy"| PI["Policy Model\n(being optimized)"]
        S --> |"Freeze as reference"| REF["Reference Model\n(frozen SFT)"]
        PI --> |"Generate"| RESP["Response"]
        RESP --> R
        R --> |"Reward signal"| PPO["PPO Update"]
        REF --> |"KL penalty"| PPO
        PPO --> |"Update"| PI
    end

    style S fill:#1a1a2e,stroke:#51cf66,color:#fff
    style R fill:#1a1a2e,stroke:#e94560,color:#fff
    style PI fill:#1a1a2e,stroke:#0f3460,color:#fff
    style REF fill:#1a1a2e,stroke:#0f3460,color:#fff
    style PPO fill:#1a1a2e,stroke:#e94560,color:#fff
```

### 奖励模型

奖励模型是一个被改造为评分器的语言模型。取 SFT 模型，将语言模型头（输出词汇表上的分布）替换为标量头（输出一个单一数字）。架构直到最后一层都是相同的。

输入：提示与响应拼接。输出：一个单一的标量奖励分数。

训练数据是人类偏好对。对于每个提示，标注员看到两个响应并选择更好的那个。这产生了训练三元组：（提示、偏好响应、拒绝响应）。

损失函数使用 Bradley-Terry 成对偏好模型：

```
loss = -log(sigmoid(reward(preferred) - reward(rejected)))
```

这是关键公式。`sigmoid(reward(A) - reward(B))` 给出了响应 A 被偏好于响应 B 的概率。损失推动奖励模型为偏好响应分配更高的分数。

为什么使用成对比较而不是绝对分数？因为人类在分配绝对质量分数方面很差（"这个响应是 7.3 分还是 7.5 分？"）但在相对比较方面很在行（"A 比 B 好吗？"）。Bradley-Terry 模型将相对比较转换为一致的绝对评分系统。

**InstructGPT 数字：** OpenAI 从 40 名承包商那里收集了 33,000 个比较对。每个比较大约需要 5 分钟。那是 2,750 小时的人力劳动用于奖励模型训练数据。

### PPO：近端策略优化

PPO 是一种强化学习算法。在 RLHF 中，"环境"是奖励模型，"代理"是语言模型，"动作"是生成一个 token。

目标：

```
maximize: E[R(prompt, response)] - beta * KL(policy || reference)
```

第一项推动模型产生高奖励的响应。第二项（KL 散度惩罚）防止模型偏离 SFT 检查点太远。

为什么需要 KL 惩罚？没有它，模型会找到退化解。奖励模型是在有限的人类偏好数据集上训练的。它存在盲点。语言模型会利用这些盲点——找出在奖励模型上得分高但实际上是胡说八道的输出。经典例子：

- 重复"我真是太有用且无害了！"在有用性/无害性奖励模型上得分高
- 产生冗长、听起来正式但空洞的响应，与"高质量"模式匹配
- 利用训练数据中碰巧与高奖励相关的特定短语

KL 惩罚表达的是：你可以改进，但你不能变成一个完全不同的模型。保持接近 SFT 版本，它已经是合理的了。偏离太远，KL 成本就主导了奖励。

**InstructGPT 数字：** PPO 训练使用 lr=1.5e-5，KL 系数 beta=0.02，256K 个 episode（提示-响应对），每批 4 个 PPO epoch。整个 RLHF 管线在 GPU 集群上花费了数天。

```mermaid
graph LR
    subgraph PPO["PPO Training Loop"]
        direction TB
        PROMPT["Sample prompt\nfrom dataset"] --> GEN["Policy generates\nresponse"]
        GEN --> SCORE["Reward model\nscores response"]
        GEN --> KL["Compute KL divergence\nvs reference model"]
        SCORE --> OBJ["Objective:\nreward - beta * KL"]
        KL --> OBJ
        OBJ --> UPDATE["PPO gradient update\n(clipped surrogate loss)"]
        UPDATE --> |"repeat"| PROMPT
    end

    style PROMPT fill:#1a1a2e,stroke:#0f3460,color:#fff
    style SCORE fill:#1a1a2e,stroke:#51cf66,color:#fff
    style KL fill:#1a1a2e,stroke:#e94560,color:#fff
    style OBJ fill:#1a1a2e,stroke:#e94560,color:#fff
```

### PPO 目标详解

PPO 使用"裁剪替代目标"来防止过大的更新。新旧策略概率之间的比率被裁剪到范围 [1 - epsilon, 1 + epsilon] 内，其中 epsilon 通常为 0.2。

```
ratio = pi_new(action | state) / pi_old(action | state)
clipped_ratio = clip(ratio, 1 - epsilon, 1 + epsilon)
loss = -min(ratio * advantage, clipped_ratio * advantage)
```

优势函数估计当前响应相对于预期质量有多好。在 RLHF 中：

```
advantage = reward(prompt, response) - baseline
```

基线通常是近期响应的平均奖励。正优势意味着响应优于平均；负优势意味着劣于平均。PPO 增加高于平均的响应的概率，降低低于平均的响应的概率。

裁剪防止了灾难性更新。如果单个响应获得了异常高的奖励，未裁剪的比率可能非常大，导致模型急剧转向该响应。裁剪限制了更新幅度，保持了训练稳定性。

### 奖励欺骗

RLHF 的阴暗面。语言模型在优化奖励模型，而奖励模型是人类偏好的不完美代理。随着语言模型越来越擅长最大化奖励，它开始利用奖励模型的弱点。

常见失败模式：

| 失败 | 发生了什么 | 为什么 |
|---------|-------------|-----|
| 冗长 | 模型产生越来越长的响应 | 人类标注员通常偏好更长、更详细的响应，所以奖励模型给长度分配更高分数 |
| 迎合 | 模型同意用户说的一切 | 标注员偏好同意问题前提的响应 |
| 含糊 | 模型拒绝给出明确答案 | 含糊的响应（"这是一个复杂的话题，有许多视角……"）很少被标记为错误 |
| 格式游戏 | 模型过度使用项目符号和标题 | 格式化的响应在标注员看来更"精致" |

缓解策略：更强的 KL 惩罚（防止模型偏离足够远以利用弱点）、在对抗性示例上训练奖励模型（修补已知的失败模式）、以及使用不同架构的多个奖励模型（更难同时破解所有模型）。

### 真实 RLHF 管线

| 模型 | 比较对 | 标注员 | RM 大小 | PPO 步数 | KL 系数 |
|-------|-----------------|------------|---------|-----------|----------|
| InstructGPT | 33K | 40 | 6B | 256K | 0.02 |
| Llama 2 Chat | ~1M | 未公开 | 70B | 未公开 | 0.01 |
| Claude | 未公开 | 未公开 | 未公开 | 未公开 | 未公开 |
| Anthropic RLHF 论文 | 22K | 20 | 52B | 50K | 0.001 |

Anthropic 2022 年的论文在 22,000 个比较上训练了一个 52B 的奖励模型。更大的奖励模型产生更可靠的信号，这使得 PPO 训练更稳定。使用小奖励模型训练大语言模型是有风险的——奖励模型没有足够的容量来捕捉好响应与坏响应之间的细微差别。

```figure
rlhf-pipeline
```

## 动手构建

### 步骤 1：合成偏好数据

在生产中，人类标注员创建偏好数据。我们将创建合成对，其中"偏好"响应客观上更好（更简洁、更准确、更有用）。

```python
import numpy as np

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

偏好响应简洁直接。拒绝响应展示常见的失败模式：不必要的填充、含糊、冗余解释和不精确。这正是 SFT 无法捕捉但 RLHF 可以捕捉的区别。

### 步骤 2：奖励模型架构

奖励模型重用了迷你 GPT 的 transformer 架构，但将词汇表大小的输出头替换为单一的标量投影。

```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "04-pre-training-mini-gpt", "code"))
from main import MiniGPT, LayerNorm, Embedding, TransformerBlock


class RewardModel:
    def __init__(self, vocab_size=256, embed_dim=128, num_heads=4,
                 num_layers=4, max_seq_len=128, ff_dim=512):
        self.embedding = Embedding(vocab_size, embed_dim, max_seq_len)
        self.blocks = [
            TransformerBlock(embed_dim, num_heads, ff_dim)
            for _ in range(num_layers)
        ]
        self.ln_f = LayerNorm(embed_dim)
        self.reward_head = np.random.randn(embed_dim) * 0.02

    def forward(self, token_ids):
        seq_len = token_ids.shape[-1]
        mask = np.triu(np.full((seq_len, seq_len), -1e9), k=1)

        x = self.embedding.forward(token_ids)
        for block in self.blocks:
            x = block.forward(x, mask)
        x = self.ln_f.forward(x)

        last_hidden = x[:, -1, :]
        reward = last_hidden @ self.reward_head

        return reward
```

奖励模型取*最后一个* token 位置的隐藏状态并将其投影为标量。为什么是最后一个 token？因为因果注意力掩码意味着最后一个位置已经关注了所有之前的 token。它拥有整个（提示、响应）序列最完整的表示。

### 步骤 3：Bradley-Terry 损失

使用 Bradley-Terry 成对损失在偏好对上训练奖励模型。

```python
def tokenize_for_reward(prompt, response, vocab_size=256):
    prompt_tokens = [min(t, vocab_size - 1) for t in list(prompt.encode("utf-8"))]
    response_tokens = [min(t, vocab_size - 1) for t in list(response.encode("utf-8"))]
    return prompt_tokens + [0] + response_tokens


def sigmoid(x):
    return np.where(
        x >= 0,
        1.0 / (1.0 + np.exp(-x)),
        np.exp(x) / (1.0 + np.exp(x))
    )


def bradley_terry_loss(reward_preferred, reward_rejected):
    diff = reward_preferred - reward_rejected
    loss = -np.log(sigmoid(diff) + 1e-8)
    return loss


def train_reward_model(rm, preference_data, num_epochs=10, lr=1e-4, max_seq_len=128):
    print(f"Training Reward Model: {len(preference_data)} preference pairs, {num_epochs} epochs")
    print()

    losses = []
    accuracies = []

    for epoch in range(num_epochs):
        epoch_loss = 0.0
        epoch_correct = 0
        num_pairs = 0

        indices = np.random.permutation(len(preference_data))

        for idx in indices:
            pair = preference_data[idx]

            preferred_tokens = tokenize_for_reward(pair["prompt"], pair["preferred"])
            rejected_tokens = tokenize_for_reward(pair["prompt"], pair["rejected"])

            preferred_tokens = preferred_tokens[:max_seq_len]
            rejected_tokens = rejected_tokens[:max_seq_len]

            preferred_ids = np.array(preferred_tokens).reshape(1, -1)
            rejected_ids = np.array(rejected_tokens).reshape(1, -1)

            r_preferred = rm.forward(preferred_ids)[0]
            r_rejected = rm.forward(rejected_ids)[0]

            loss = bradley_terry_loss(r_preferred, r_rejected)

            if r_preferred > r_rejected:
                epoch_correct += 1

            diff = r_preferred - r_rejected
            grad = sigmoid(diff) - 1.0

            rm.reward_head -= lr * grad * rm.ln_f.forward(
                rm.embedding.forward(preferred_ids)
            )[:, -1, :].flatten()

            epoch_loss += loss
            num_pairs += 1

        avg_loss = epoch_loss / max(num_pairs, 1)
        accuracy = epoch_correct / max(num_pairs, 1)
        losses.append(avg_loss)
        accuracies.append(accuracy)

        if epoch % 2 == 0:
            print(f"  Epoch {epoch + 1:3d} | Loss: {avg_loss:.4f} | Accuracy: {accuracy:.1%}")

    return rm, losses, accuracies
```

准确率指标很简单：奖励模型正确排序的偏好对的比例？随机模型得分为 50%。在干净数据上训练良好的奖励模型应超过 70%。InstructGPT 的奖励模型在保留比较上达到约 72% 的准确率，这听起来低但实际上很好——许多偏好对即使对人类来说也是模糊的（标注员间一致性约为 73%）。

### 步骤 4：简化 PPO 循环

完整的 PPO 很复杂。这个实现捕捉了核心机制：生成响应、评分、计算优势、用 KL 惩罚更新策略。

```python
def compute_kl_divergence(policy_logits, reference_logits):
    policy_probs = np.exp(policy_logits - policy_logits.max(axis=-1, keepdims=True))
    policy_probs = policy_probs / policy_probs.sum(axis=-1, keepdims=True)
    policy_probs = np.clip(policy_probs, 1e-10, 1.0)

    ref_probs = np.exp(reference_logits - reference_logits.max(axis=-1, keepdims=True))
    ref_probs = ref_probs / ref_probs.sum(axis=-1, keepdims=True)
    ref_probs = np.clip(ref_probs, 1e-10, 1.0)

    kl = np.sum(policy_probs * np.log(policy_probs / ref_probs), axis=-1)
    return kl.mean()


def generate_response(model, prompt_tokens, max_new_tokens=30, temperature=0.8, max_seq_len=128):
    tokens = list(prompt_tokens)

    for _ in range(max_new_tokens):
        context = np.array(tokens[-max_seq_len:]).reshape(1, -1)
        logits = model.forward(context)
        next_logits = logits[0, -1, :]

        next_logits = next_logits / max(temperature, 1e-8)
        probs = np.exp(next_logits - next_logits.max())
        probs = probs / probs.sum()
        probs = np.clip(probs, 1e-10, 1.0)
        probs = probs / probs.sum()

        next_token = np.random.choice(len(probs), p=probs)
        tokens.append(int(next_token))

    return tokens


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


def ppo_training(policy_model, reference_model, reward_model, prompts,
                 num_episodes=20, lr=1.5e-5, kl_coeff=0.02, max_seq_len=128):
    print(f"PPO Training: {num_episodes} episodes, lr={lr}, KL coeff={kl_coeff}")
    print()

    rewards_history = []
    kl_history = []

    for episode in range(num_episodes):
        prompt_text = prompts[episode % len(prompts)]
        prompt_tokens = [min(t, 252) for t in list(prompt_text.encode("utf-8"))]

        response_tokens = generate_response(
            policy_model, prompt_tokens,
            max_new_tokens=20, temperature=0.8, max_seq_len=max_seq_len
        )

        response_ids = np.array(response_tokens[:max_seq_len]).reshape(1, -1)
        reward = reward_model.forward(response_ids)[0]

        policy_logits = policy_model.forward(response_ids)
        ref_logits = reference_model.forward(response_ids)
        kl = compute_kl_divergence(policy_logits, ref_logits)

        total_reward = reward - kl_coeff * kl

        rewards_history.append(float(reward))
        kl_history.append(float(kl))

        for block in policy_model.blocks:
            update_scale = lr * total_reward
            block.ffn.W1 += update_scale * np.random.randn(*block.ffn.W1.shape) * 0.01
            block.ffn.W2 += update_scale * np.random.randn(*block.ffn.W2.shape) * 0.01

        if episode % 5 == 0:
            avg_reward = np.mean(rewards_history[-5:]) if rewards_history else 0
            avg_kl = np.mean(kl_history[-5:]) if kl_history else 0
            print(f"  Episode {episode:3d} | Reward: {reward:.4f} | KL: {kl:.4f} | "
                  f"Avg Reward: {avg_reward:.4f}")

    return policy_model, rewards_history, kl_history
```

核心循环：（1）采样一个提示，（2）生成一个响应，（3）用奖励模型评分，（4）计算与冻结参考模型的 KL 散度，（5）计算调整后的奖励（奖励减去 KL 惩罚），（6）更新策略。KL 惩罚随着策略偏离参考模型而增长，自动防止奖励欺骗。

### 步骤 5：奖励分数比较

在 RLHF 之后，策略模型的响应应该在奖励模型上比原始 SFT 模型的响应得分更高。

```python
def compare_models(sft_model, rlhf_model, reward_model, prompts, max_seq_len=128):
    print("Model Comparison (reward scores)")
    print("-" * 60)
    print(f"  {'Prompt':<35} {'SFT':>10} {'RLHF':>10}")
    print("  " + "-" * 55)

    sft_total = 0.0
    rlhf_total = 0.0

    for prompt in prompts:
        prompt_tokens = [min(t, 252) for t in list(prompt.encode("utf-8"))]

        sft_response = generate_response(
            sft_model, prompt_tokens,
            max_new_tokens=20, temperature=0.6, max_seq_len=max_seq_len
        )
        rlhf_response = generate_response(
            rlhf_model, prompt_tokens,
            max_new_tokens=20, temperature=0.6, max_seq_len=max_seq_len
        )

        sft_ids = np.array(sft_response[:max_seq_len]).reshape(1, -1)
        rlhf_ids = np.array(rlhf_response[:max_seq_len]).reshape(1, -1)

        sft_reward = reward_model.forward(sft_ids)[0]
        rlhf_reward = reward_model.forward(rlhf_ids)[0]

        sft_total += sft_reward
        rlhf_total += rlhf_reward

        truncated_prompt = prompt[:33] + ".." if len(prompt) > 35 else prompt
        print(f"  {truncated_prompt:<35} {sft_reward:>10.4f} {rlhf_reward:>10.4f}")

    n = len(prompts)
    print("  " + "-" * 55)
    print(f"  {'Average':<35} {sft_total/n:>10.4f} {rlhf_total/n:>10.4f}")

    return sft_total / n, rlhf_total / n
```

## 使用它

### 完整 RLHF 管线演示

```python
if __name__ == "__main__":
    np.random.seed(42)

    print("=" * 70)
    print("RLHF PIPELINE: REWARD MODEL + PPO")
    print("=" * 70)
    print()

    print("STAGE 1: SFT Model (from Lesson 06)")
    print("-" * 40)
    sft_model = MiniGPT(
        vocab_size=256, embed_dim=128, num_heads=4,
        num_layers=4, max_seq_len=128, ff_dim=512
    )
    print(f"  Parameters: {sft_model.count_parameters():,}")
    print()

    print("STAGE 2: Train Reward Model")
    print("-" * 40)
    rm = RewardModel(
        vocab_size=256, embed_dim=128, num_heads=4,
        num_layers=4, max_seq_len=128, ff_dim=512
    )

    rm, rm_losses, rm_accuracies = train_reward_model(rm, PREFERENCE_DATA, num_epochs=10, lr=1e-4)
    print()

    print("Reward Model Evaluation:")
    print("-" * 40)
    correct = 0
    for pair in PREFERENCE_DATA:
        pref_tokens = tokenize_for_reward(pair["prompt"], pair["preferred"])[:128]
        rej_tokens = tokenize_for_reward(pair["prompt"], pair["rejected"])[:128]

        r_pref = rm.forward(np.array(pref_tokens).reshape(1, -1))[0]
        r_rej = rm.forward(np.array(rej_tokens).reshape(1, -1))[0]

        if r_pref > r_rej:
            correct += 1
        print(f"  Preferred: {r_pref:+.4f} | Rejected: {r_rej:+.4f} | {'Correct' if r_pref > r_rej else 'Wrong'}")

    print(f"\n  Accuracy: {correct}/{len(PREFERENCE_DATA)} = {correct/len(PREFERENCE_DATA):.1%}")
    print()

    print("STAGE 3: PPO Training")
    print("-" * 40)

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

    train_prompts = [pair["prompt"] for pair in PREFERENCE_DATA]

    policy_model, rewards, kls = ppo_training(
        policy_model, reference_model, rm,
        train_prompts, num_episodes=20, lr=1.5e-5, kl_coeff=0.02
    )
    print()

    print("=" * 70)
    print("COMPARISON: SFT vs RLHF")
    print("=" * 70)
    print()

    eval_prompts = [
        "What is the capital of France?",
        "Explain gravity.",
        "Name three programming languages.",
    ]

    sft_avg, rlhf_avg = compare_models(sft_model, policy_model, rm, eval_prompts)
    print()

    print("=" * 70)
    print("KL DIVERGENCE ANALYSIS")
    print("=" * 70)
    print()

    if kls:
        print(f"  Initial KL: {kls[0]:.4f}")
        print(f"  Final KL:   {kls[-1]:.4f}")
        print(f"  Max KL:     {max(kls):.4f}")
        kl_threshold = 0.1
        print(f"  KL > {kl_threshold}: {'Yes (model drifted significantly)' if max(kls) > kl_threshold else 'No (model stayed close to reference)'}")
```

## 交付

本课程产出 `outputs/prompt-reward-model-designer.md`——一个用于设计奖励模型训练管线的提示词。给定一个目标行为（有用性、编码能力、安全性），它生成一个数据收集协议、标注员指南和奖励模型评估标准。

## 练习

1. 修改奖励模型，使用所有隐藏状态的均值而不是仅最后一个位置。比较准确率。均值池化方法给每个 token 相等的权重，而最后一个位置方法依赖于因果注意力来聚合信息。在 6 个偏好对上测试，报告哪种方法得分更高。

2. 实现奖励模型校准。训练后，将所有偏好对通过奖励模型并计算：（a）偏好响应的平均奖励，（b）拒绝响应的平均奖励，（c）差距（偏好减去拒绝）。一个校准良好的模型应有清晰的差距。然后添加 4 个新的偏好对，检查差距在未见数据上是否保持。

3. 模拟奖励欺骗。创建一个给长响应高分的奖励模型（reward = len(response) / 100）。用这个有缺陷的奖励模型运行 PPO，观察策略模型生成越来越长、重复的输出。然后添加 0.1 的 KL 惩罚，展示它阻止了退化行为。

4. 实现多目标奖励。训练两个奖励模型——一个用于有用性，一个用于简洁性。将它们组合为 R = 0.7 × R_helpful + 0.3 × R_concise。展示组合目标产生的响应既有用又简洁，避免了单一有用性奖励的冗长陷阱。

5. 比较不同的 KL 系数。使用 beta=0.001（太低，奖励欺骗）、beta=0.02（标准）和 beta=0.5（太高，没有学习）运行 PPO。绘制每个运行的奖励曲线和 KL 曲线。beta=0.02 的运行应显示稳定的奖励提升和受约束的 KL。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| RLHF | "用人类反馈训练" | 从人类反馈中强化学习：一个三阶段管线（SFT、奖励模型、PPO），使用人类偏好信号优化语言模型输出 |
| 奖励模型 | "一个给响应评分的模型" | 具有标量输出头的 transformer，使用 Bradley-Terry 损失在成对人类偏好上训练 |
| Bradley-Terry | "比较模型" | 一种概率模型，其中 P(A > B) = sigmoid(score(A) - score(B))，将成对偏好转换为一致的评分函数 |
| PPO | "RL 算法" | 近端策略优化：更新策略以最大化奖励，同时裁剪更新幅度以防止不稳定 |
| KL 散度 | "两个分布有多不同" | 衡量策略模型的 token 分布与参考模型分布之间的差异——用作防止奖励欺骗的惩罚 |
| KL 惩罚 | "模型的缰绳" | 从奖励信号中减去的 Beta × KL(policy \|\| reference)——防止策略偏离 SFT 检查点太远 |
| 奖励欺骗 | "钻奖励的空子" | 当策略通过利用奖励模型的弱点而非真正改进来找到退化的高奖励输出时 |
| 偏好对 | "A 和 B 哪个更好？" | 由（提示、偏好响应、拒绝响应）组成的训练示例——RLHF 训练数据的基本单元 |
| 参考模型 | "冻结的 SFT 检查点" | SFT 模型的副本，其权重从不改变——用作 KL 散度计算的锚点 |

## 延伸阅读

- [Ouyang et al., 2022 -- "Training language models to follow instructions with human feedback" (InstructGPT)](https://arxiv.org/abs/2203.02155) -- 使 RLHF 对大型语言模型实用的论文
- [Schulman et al., 2017 -- "Proximal Policy Optimization Algorithms"](https://arxiv.org/abs/1707.06347) -- OpenAI 的原始 PPO 论文
- [Bai et al., 2022 -- "Training a Helpful and Harmless Assistant with Reinforcement Learning from Human Feedback"](https://arxiv.org/abs/2204.05862) -- Anthropic 的 RLHF 论文，包含对奖励欺骗和 KL 惩罚的详细分析
- [Stiennon et al., 2020 -- "Learning to summarize with human feedback"](https://arxiv.org/abs/2009.01325) -- 将 RLHF 应用于摘要，展示奖励模型可以捕捉细微的质量判断
- [Christiano et al., 2017 -- "Deep reinforcement learning from human preferences"](https://arxiv.org/abs/1706.03741) -- 从人类比较中学习奖励函数的基础工作
