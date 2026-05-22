# GPT — 因果语言建模（Causal Language Modeling）

> BERT 能看到两边。GPT 只能看到过去。三角掩码（triangle mask）是现代人工智能中最具深远影响的一行代码。

**类型：** 构建  
**语言：** Python  
**前置知识：** 阶段7·02（自注意力机制（Self-Attention）），阶段7·05（完整Transformer），阶段7·06（BERT）  
**时长：** 约75分钟

## 问题

语言模型回答一个问题：给定前 `t-1` 个词元，第 `t` 个词元的概率分布是什么？通过这个信号（下一个词元预测）进行训练，你就能得到一个模型，它可以一次一个词元地生成任意文本。

为了在整条序列上以并行方式端到端地训练模型，每个位置的预测必须只依赖于前面的位置。否则模型会通过查看答案而轻易作弊。

因果掩码（Causal mask）实现了这一点。它是一个上三角矩阵，在 softmax 之前将 `-inf` 值加到注意力分数上。经过 softmax 后，这些位置变成 0。每个位置只能关注到自身及之前的位置。由于你对整条序列只应用一次掩码，你在一次前向传播中就能得到 N 个并行的下一个词元预测。

GPT-1（2018）、GPT-2（2019）、GPT-3（2020）、GPT-4（2023）、GPT-5（2024）、Claude、Llama、Qwen、Mistral、DeepSeek、Kimi——它们都是仅解码器（decoder-only）的因果Transformer，拥有相同的核心循环。只是更大、数据更好、RLHF 更好。

## 概念

![因果掩码创建了一个三角注意力矩阵](../assets/causal-attention.svg)

### 掩码

给定长度为 `N` 的序列，构建一个 `N × N` 矩阵：

```
M[i, j] = 0       if j <= i
M[i, j] = -inf    if j > i
```

在 softmax 之前将 `M` 加到原始注意力分数上。`exp(-inf) = 0`，因此被掩码的位置权重为零。注意力矩阵的每一行都是仅基于之前位置的概率分布。

实现成本：一次 `torch.tril()` 调用。计算时间：纳秒级。对该领域的影响：一切。

### 并行训练，串行推理

训练：对整个 `(N, d_model)` 序列进行一次前向传播，计算 N 个交叉熵损失（每个位置一个），求和，反向传播。沿序列方向并行。这就是 GPT 训练能扩展的原因——你在一次 GPU 批量处理中就能处理 100 万个词元。

推理：你逐个生成词元。输入 `[t1, t2, t3]`，得到 `t4`。输入 `[t1, t2, t3, t4]`，得到 `t5`。输入 `[t1, t2, t3, t4, t5]`，得到 `t6`。KV 缓存（第12课）保存了 `t1…tn` 的隐藏状态，这样你就不必每一步都重新计算它们。但推理时的串行深度等于输出长度。这就是自回归（autoregressive）的代价，也是为什么解码是每个大语言模型（LLM）的延迟瓶颈。

### 损失——移位一位

给定词元 `[t1, t2, t3, t4]`：

- 输入：`[t1, t2, t3]`
- 目标：`[t2, t3, t4]`

对于每个位置 `i`，计算 `-log P(target_i | inputs[:i+1])`。求和。这就是整个序列的交叉熵。

你听过的每个Transformer语言模型都用这个损失进行训练。预训练、微调、SFT——相同的损失，不同的数据。

### 解码策略

训练之后，采样选择的重要性远超人们的想象。

| 方法 | 功能 | 适用场景 |
|------|------|----------|
| 贪婪（Greedy） | 每一步取 argmax | 确定性任务、代码补全 |
| 温度（Temperature） | 用 T 除 logits，然后采样 | 创造性任务，T 越高多样性越大 |
| Top-k | 只从 top-k 个词元中采样 | 消除低概率尾部 |
| Top-p（核采样（Nucleus Sampling）） | 从累积概率 ≥ p 的最小集合中采样 | 2020年后的默认方法；自适应分布形状 |
| Min-p | 保留满足 `p > min_p * max_p` 的词元 | 2024年后出现；比 top-p 更好地拒绝长尾分布 |
| 投机性解码（Speculative Decoding） | 草稿模型提出 N 个词元，大模型验证 | 在相同质量下延迟降低 2–3 倍 |

到 2026 年，对于开放权重模型，min-p + 温度 0.7 是一个合理的默认配置。投机性解码是任何生产级推理栈的基础要求。

### 什么让“GPT 配方”奏效

1. **仅解码器（Decoder-only）**。没有编码器（encoder）开销。每层一次注意力 + FFN。
2. **扩展（Scaling）**。124M → 1.5B → 175B → 万亿级。Chinchilla 缩放定律（第13课）告诉你如何分配计算量。
3. **上下文学习（In-context Learning）**。大约在 6B–13B 参数时涌现。模型可以在不微调的情况下遵循少样本示例。
4. **RLHF**。基于人类偏好的后训练将原始预训练文本转化为聊天助手。
5. **Pre-norm + RoPE + SwiGLU**。大规模稳定训练。

自 GPT-2 以来，核心架构变化不大。所有有趣的变化都发生在数据、规模和后训练方面。

## 构建它

### 第1步：因果掩码

参见 `code/main.py`。一行代码：

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

在 softmax 之前将其加到注意力分数上。这就是整个机制。

### 第2步：一个2层类GPT模型

堆叠两个解码器块（掩码自注意力 + FFN，无跨注意力）。添加一个词元嵌入（token embedding）、一个位置编码（positional encoding）和一个解嵌入（unembedding，与词元嵌入矩阵共享权重——自GPT-2以来的标准技巧）。

### 第3步：端到端下一个词元预测

在一个20词元的玩具词汇表上，在每个位置产生 logits。计算与移位一位的目标的交叉熵损失。无需梯度——这是一个前向传播的合理性检查。

### 第4步：采样

实现贪婪、温度、top-k、top-p、min-p。在固定提示上运行每种方法并比较输出。一个采样函数只需10行代码。

## 使用它

PyTorch，2026年惯用法：

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

在底层，`generate()` 运行前向传播，取出最后一个位置的 logits，对下一个词元进行采样，将其追加，然后重复。每个生产级 LLM 推理栈（vLLM、TensorRT-LLM、llama.cpp、Ollama、MLX）都实现了相同的循环，并进行了大量优化——批处理预填充（batched prefill）、连续批处理（continuous batching）、KV 缓存分页（KV cache paging）、投机性解码。

**GPT vs BERT，一句话概括：** GPT 预测 `P(x_t | x_{<t})`。BERT 预测 `P(x_masked | x_unmasked)`。损失决定了模型是否能够生成。

## 交付它

参见 `outputs/skill-sampling-tuner.md`。该技能为新的生成任务选择采样参数，并在需要确定性解码时进行标记。

## 练习

1. **简单。** 运行 `code/main.py`，验证因果注意力矩阵在 softmax 后是否成为下三角矩阵。抽查：第3行应只在列0–3上有权重。
2. **中等。** 实现宽度为4的束搜索（beam search）。比较10个短提示的束搜索与贪婪搜索的困惑度（perplexity）。束搜索总是更好吗？（提示：通常对翻译有效，对开放式聊天无效。）
3. **困难。** 实现投机性解码：使用一个2层小模型作为草稿模型，一个6层模型作为验证模型。在100个长度为64的补全上测量墙钟加速比。确认输出与验证模型的贪婪搜索输出一致。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| 因果掩码（Causal mask） | “那个三角形” | 上三角 `-inf` 矩阵，加到注意力分数上，使位置 `i` 只能看到位置 `≤ i`。 |
| 下一个词元预测（Next-token prediction） | “那个损失” | 每个位置上模型分布与真实下一个词元的交叉熵。 |
| 自回归（Autoregressive） | “一次生成一个” | 将输出作为输入反馈；仅训练时并行，生成时不行。 |
| Logits | “softmax之前的分数” | 语言模型头在 softmax 之前的原始输出；采样基于这些值。 |
| 温度（Temperature） | “创造力旋钮” | 用 T 除 logits；T→0 变为贪婪，T→∞ 变为均匀分布。 |
| Top-p | “核采样（Nucleus sampling）” | 将分布截断到累积概率 ≥ p 的最小集合；然后对剩余部分采样。 |
| Min-p | “比 top-p 好” | 保留满足 `p ≥ min_p × max_p` 的词元；根据分布的尖锐程度自适应截断。 |
| 投机性解码（Speculative decoding） | “草稿+验证” | 廉价模型提出 N 个词元；大模型并行验证。 |
| 教师强制（Teacher forcing） | “训练技巧” | 训练时，提供真实的前一个词元，而不是模型的预测。对每个序列到序列语言模型都是标准做法。 |

## 进一步阅读

- [Radford et al. (2018). Improving Language Understanding by Generative Pre-Training](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) — GPT-1。
- [Radford et al. (2019). Language Models are Unsupervised Multitask Learners](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) — GPT-2。
- [Brown et al. (2020). Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) — GPT-3 与上下文学习。
- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — 投机性解码论文。
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) — 规范的因果语言模型参考代码。