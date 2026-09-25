# GPT — 因果语言建模

> BERT 两边都看，GPT 只看过去。这个三角掩码是现代 AI 中最关键的一行代码。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02(自注意力)、Phase 7 · 05(完整 Transformer)、Phase 7 · 06(BERT)
**Time:** 约 75 分钟

## 问题

语言模型只回答一个问题：给定前 `t-1` 个 token,token `t` 的概率分布是什么？用这个信号——下一个 token 预测——进行训练，你会得到一个可以逐个 token 生成任意文本的模型。

要在一个完整序列上端到端地并行训练，你需要让每个位置的预测只依赖更早的位置。否则模型会通过偷看答案轻易作弊。

因果掩码就是干这个的。它是一个单一的上三角矩阵，其 `-inf` 值在 softmax 之前加到注意力分数上。softmax 之后，这些位置的权重变为 0。每个位置只能关注它自己和更早的位置。而且因为整个序列只需应用一次掩码，一次前向传播就能得到 N 个并行的下一个 token 预测。

GPT-1(2018)、GPT-2(2019)、GPT-3(2020)、GPT-4(2023)、GPT-5(2025)、Claude、Llama、Qwen、Mistral、DeepSeek、Kimi——它们全都是使用相同核心循环的 decoder-only 因果 Transformer。将它们区分开的是数据质量、规模与架构上的改进，以及后训练(SFT、RLHF、DPO 及其后续方法)。

## 概念

![Causal mask creates a triangular attention matrix](../assets/causal-attention.svg)

### 掩码

给定长度为 `N` 的序列，构建一个 `N × N` 矩阵:

```
M[i, j] = 0       if j <= i
M[i, j] = -inf    if j > i
```

在 softmax 之前，把 `M` 加到原始注意力分数上。由于 `exp(-inf) = 0`,被掩码的位置贡献零权重。注意力矩阵的每一行都是一个仅覆盖之前位置的概率分布。

实现成本：一次 `torch.tril()` 调用。计算时间：纳秒级。对领域的影响：一切。

### 三角从何而来

掩码通常被呈现为贴在注意力上的一块补丁。但从另一个方向推导，它就不再神秘了：注意力是前缀平均的第三次精化，而那个三角就是该平均的循环边界，写成了矩阵的形式。

**阶段 1 — 前缀平均。** 一个序列最笨的因果摘要：位置 `i` 变成位置 `0…i` 的均值。写成循环就是 `out[i] = X[:i+1].mean(0)`。同样的计算就是一次矩阵乘法。取一个全 1 的下三角矩阵，每行除以它的计数，相乘:

```python
import numpy as np

A = np.tril(np.ones((n, n)))
A = A / A.sum(axis=1, keepdims=True)
out = A @ X
```

`A` 的第 `i` 行是 `[1/(i+1), …, 1/(i+1), 0, …, 0]`。对角线以上的零就是因果性。未来并没有被掩码掉；未来根本就不在求和之中。

**阶段 2 — 学习到的权重。** 均匀平均把每个过去的 token 视为同等相关。把 1 换成学习到的分数矩阵 `S`。现在各行不再天然求和为 1,所以改用 softmax 对每行归一化，而不是除以计数。Softmax 从不输出精确的零，这会破坏因果性——除非把未来位置的分数输入为 `-inf`,因为 `exp(-inf) = 0`:

```python
def softmax(x, axis):
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

S = S + np.triu(np.full((n, n), -np.inf), k=1)
A = softmax(S, axis=1)
out = A @ X
```

同样的三角，同样的行随机矩阵，同样的一次 matmul。`-inf` 掩码并不是新机制。它就是阶段 1 的那些零，换算到了 softmax 的输入域中。

**阶段 3 — 依赖内容的权重。** 在阶段 2 中，`S` 在训练后是固定的：无论 token 内容如何，位置 7 对位置 3 的权重总是一样的。让分数依赖于 token 本身：`S = Q @ K.T / sqrt(d_k)`。其他什么都不变。掩码、softmax、matmul——完全一样。

三个阶段，一个不变量：一个下三角行随机矩阵乘上序列。均匀平均、学习到的静态权重、依赖内容的权重。掩码从来不是加到注意力上的。它是从前缀平均中一路存续下来的。

```figure
mask-derivation
```

### 并行训练，串行推理

训练：对整个 `(N, d_model)` 序列做一次前向传播，计算 N 个交叉熵损失(每个位置一个)，求和，反向传播。沿序列方向并行。这就是 GPT 训练可以扩展的原因——一次 GPU 前向就能处理一个批次中的 100 万个 token。

推理：你逐个 token 生成。输入 `[t1, t2, t3]`,得到 `t4`。输入 `[t1, t2, t3, t4]`,得到 `t5`。输入 `[t1, t2, t3, t4, t5]`,得到 `t6`。KV 缓存(第 12 课)保存了 `t1…tn` 的隐藏状态，这样你就不必每步重新计算它们。但推理时的串行深度 = 输出长度。这就是自回归税，也是为什么解码是每个 LLM 的延迟瓶颈。

### 损失 — 错位一位

给定 token `[t1, t2, t3, t4]`:

- 输入:`[t1, t2, t3]`
- 目标:`[t2, t3, t4]`

对每个位置 `i`,计算 `-log P(target_i | inputs[:i+1])`。求和。这就是整个序列的交叉熵。

你听说过的每一个 Transformer LM 都是用这个损失训练的。预训练、微调、SFT——同样的损失，不同的数据。

### 解码策略

训练完成后，采样选择的重要性超出人们的想象。

| 方法 | 它做什么 | 何时使用 |
|--------|--------------|-------------|
| Greedy | 每一步取 argmax | 确定性任务、代码补全 |
| Temperature | 将 logits 除以 T 后采样 | 创意任务，T 越高越多样 |
| Top-k | 仅从前 k 个 token 中采样 | 消灭低概率尾部 |
| Top-p(nucleus)| 从累计概率 ≥ p 的最小集合中采样 | 2020 年以来的默认；适应分布形状 |
| Min-p | 保留满足 `p > min_p * max_p` 的 token | 2024 年以来；比 top-p 更擅长拒绝长尾 |
| Speculative decoding | 草稿模型提出 N 个 token,大模型验证 | 同等质量下降低 2–3 倍延迟 |

在 2026 年，对开源权重模型而言，min-p + temperature 0.7 是一个合理的默认。Speculative decoding 是任何生产级推理栈的标配。

### "GPT 配方"成功的原因

1. **Decoder-only。** 没有 encoder 开销。每层只需一次注意力 + FFN 的前向。
2. **扩展。** 124M → 1.5B → 175B → 数万亿。Chinchilla 缩放定律(第 13 课)告诉你如何分配算力。
3. **上下文学习。** 在 6B–13B 规模左右涌现。模型无需微调即可跟随 few-shot 示例。
4. **RLHF。** 基于人类偏好的后训练把原始预训练文本变成了对话助手。
5. **Pre-norm + RoPE + SwiGLU。** 大规模下稳定训练。

自 GPT-2 以来，核心架构几乎没有变化。所有有趣的事情都发生在数据、规模和后训练上。

```figure
causal-mask
```

## 动手构建

### 步骤 1:因果掩码

见 `code/main.py`。一行代码:

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

在 softmax 之前把它加到注意力分数上。这就是全部机制。

### 步骤 2:一个 2 层的类 GPT 模型

堆叠两个 decoder 块(带掩码的自注意力 + FFN,没有交叉注意力)。加上 token 嵌入、位置编码，以及一个 unembedding(与 token 嵌入矩阵绑定——GPT-2 以来的标准技巧)。

### 步骤 3:下一个 token 预测，端到端

在一个 20 个 token 的玩具词表上，在每个位置产生 logits。对照错位一位的目标计算交叉熵损失。不求梯度——这只是前向传播的合理性检查。

### 步骤 4:采样

实现 greedy、temperature、top-k、top-p、min-p。在固定提示上运行每个方法并比较输出。一个采样函数只有 10 行。

## 使用它

PyTorch,2026 年惯用写法:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")
tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")

prompt = "Attention is all you need because"
inputs = tok(prompt, return_tensors="pt")
out = model.generate(
    **inputs,
    max_new_tokens=64,
    temperature=0.7,
    top_p=0.9,
    do_sample=True,
)
print(tok.decode(out[0]))
```

底层上,`generate()` 运行前向传播，取最后位置的 logits,采样下一个 token,追加，然后重复。每个生产级 LLM 推理栈(vLLM、TensorRT-LLM、llama.cpp、Ollama、MLX)都实现了同样的循环，但做了重度优化——批量化 prefill、continuous batching、KV 缓存分页、speculative decoding。

**GPT vs BERT,各一句话:** GPT 预测 `P(x_t | x_{<t})`。BERT 预测 `P(x_masked | x_unmasked)`。损失决定了模型能否生成。

## 交付它

见 `outputs/skill-sampling-tuner.md`。该技能为新的生成任务挑选采样参数，并在需要确定性解码时给出提示。

## 练习

1. **简单。** 运行 `code/main.py`,验证因果注意力矩阵在 softmax 之后是下三角的。抽查：第 3 行应该只在第 0–3 列有权重。
2. **中等。** 实现宽度为 4 的 beam search。在 10 个短提示上比较 beam-4 与 greedy 的困惑度。beam 总是赢吗？(提示：对翻译通常成立，对开放式聊天则不一定。)
3. **困难。** 实现 speculative decoding:用一个 2 层小模型作草稿，用一个 6 层模型作验证者。在 100 个长度为 64 的补全上测量实际加速比。确认输出与验证者的 greedy 输出一致。

## 关键术语

| 术语 | 人们怎么说 | 它实际意味着什么 |
|------|-----------------|-----------------------|
| 因果掩码 | "那个三角" | 加到注意力分数上的上三角 `-inf` 矩阵，使位置 `i` 只能看到位置 `≤ i`。 |
| 下一个 token 预测 | "那个损失" | 在每个位置上，模型分布对真实下一个 token 的交叉熵。 |
| 自回归 | "一次生成一个" | 把输出反馈为输入；并行只存在于训练中，不存在于生成中。 |
| Logits | "softmax 之前的分数" | LM head 在 softmax 之前的原始输出；采样在这些值上进行。 |
| Temperature | "创造力旋钮" | 将 logits 除以 T;T→0 = greedy,T→∞ = 均匀分布。 |
| Top-p | "nucleus sampling" | 把分布截断到求和 ≥p 的最小集合；从剩余部分中采样。 |
| Min-p | "比 top-p 更好" | 保留满足 `p ≥ min_p × max_p` 的 token;根据分布的尖锐程度自适应调整截断。 |
| Speculative decoding | "草稿 + 验证" | 便宜的模型提出 N 个 token;大模型并行验证。 |
| Teacher forcing | "训练技巧" | 训练时输入真实的上一个 token,而不是模型的预测。是所有 seq2seq LM 的标准做法。 |

## 延伸阅读

- [Radford et al. (2018). Improving Language Understanding by Generative Pre-Training](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) — GPT-1。
- [Radford et al. (2019). Language Models are Unsupervised Multitask Learners](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) — GPT-2。
- [Brown et al. (2020). Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) — GPT-3 与上下文学习。
- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — spec decoding 论文。
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) — 权威的因果 LM 参考代码。