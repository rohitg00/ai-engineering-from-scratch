# 07 · GPT — 因果语言建模

> BERT 同时看到两侧上下文，而 GPT 只能看到过去。三角掩码（triangle mask）堪称现代 AI 中最具决定性意义的一行代码。

**类型：** 实战构建
**语言：** Python
**前置：** 第 7 阶段 · 02（自注意力）、第 7 阶段 · 05（完整 Transformer）、第 7 阶段 · 06（BERT）
**时长：** 约 75 分钟

## 问题所在

语言模型回答的只有一个问题：给定前 `t-1` 个 token，第 `t` 个 token 的概率分布是什么？用这个信号——「下一个 token 预测（next-token prediction）」——来训练，你就得到一个能够逐个 token 生成任意文本的模型。

要在整条序列上并行地端到端训练，你需要让每个位置的预测只依赖于更早的位置。否则模型会通过偷看答案来轻松作弊。

「因果掩码（causal mask）」就负责这件事。它是一个由 `-inf` 值构成的上三角矩阵，在 softmax 之前加到注意力分数上。经过 softmax 后，这些位置变为 0。每个位置只能注意到它自身以及更早的位置。而且因为你只需对整条序列施加一次，你就能在一次前向传播中得到 N 个并行的下一个 token 预测。

GPT-1（2018）、GPT-2（2019）、GPT-3（2020）、GPT-4（2023）、GPT-5（2024）、Claude、Llama、Qwen、Mistral、DeepSeek、Kimi——它们全都是仅含解码器（decoder-only）的因果 Transformer，核心循环完全相同。只是更大、数据更好、RLHF 更好而已。

## 核心概念

〔图：因果掩码形成一个三角形的注意力矩阵〕

### 掩码

给定一条长度为 `N` 的序列，构建一个 `N × N` 矩阵：

```
M[i, j] = 0       if j <= i
M[i, j] = -inf    if j > i
```

在 softmax 之前把 `M` 加到原始注意力分数上。由于 `exp(-inf) = 0`，被掩码的位置贡献的权重为零。注意力矩阵的每一行都是一个仅覆盖更早位置的概率分布。

实现成本：一次 `torch.tril()` 调用。计算耗时：纳秒级。对整个领域的影响：一切。

### 并行训练，串行推理

训练：把整条 `(N, d_model)` 序列一次性前向传播，计算 N 个交叉熵损失（每个位置一个），求和，反向传播。沿序列方向并行。这正是 GPT 训练能够扩展的原因——你可以在一次 GPU 计算中处理一个含 100 万 token 的批次。

推理：你逐个 token 地生成。输入 `[t1, t2, t3]`，得到 `t4`。输入 `[t1, t2, t3, t4]`，得到 `t5`。输入 `[t1, t2, t3, t4, t5]`，得到 `t6`。「KV 缓存（KV cache）」（第 12 课）会保存 `t1…tn` 的隐藏状态，这样你就不必每一步都重新计算它们。但推理时的串行深度 = 输出长度。这就是「自回归税（autoregressive tax）」，也是为什么解码是每个 LLM 的延迟瓶颈。

### 损失——错位一位

给定 token `[t1, t2, t3, t4]`：

- 输入：`[t1, t2, t3]`
- 目标：`[t2, t3, t4]`

对每个位置 `i`，计算 `-log P(target_i | inputs[:i+1])`。求和。这就是整条序列的交叉熵。

你听说过的每一个 Transformer 语言模型都是用这个损失训练的。预训练、微调、SFT——同样的损失，不同的数据。

### 解码策略

训练之后，采样的选择比人们想象的更重要。

| 方法 | 它做什么 | 何时使用 |
|--------|--------------|-------------|
| Greedy | 每一步取 argmax | 确定性任务、代码补全 |
| Temperature | 用 T 除以 logits，再采样 | 创意类任务，T 越高多样性越强 |
| Top-k | 只从前 k 个 token 中采样 | 砍掉低概率长尾 |
| Top-p（nucleus） | 从累计概率 ≥ p 的最小集合中采样 | 2020 年后的默认选择；能自适应分布形状 |
| Min-p | 保留满足 `p > min_p * max_p` 的 token | 2024 年后；比 top-p 更善于拒绝长尾 |
| Speculative decoding | 草稿模型提议 N 个 token，大模型验证 | 在同等质量下延迟降低 2–3 倍 |

到 2026 年，min-p + temperature 0.7 对开放权重模型而言是一个合理的默认配置。投机解码（speculative decoding）则是任何生产级推理栈的基本门槛。

### 是什么让「GPT 配方」奏效

1. **仅含解码器。** 没有编码器开销。每层只做一次注意力 + FFN。
2. **扩展规模。** 124M → 1.5B → 175B → 万亿级。Chinchilla 扩展定律（第 13 课）告诉你该如何分配算力。
3. **上下文内学习（in-context learning）。** 在 6B–13B 量级附近涌现。模型无需微调即可遵循少样本示例。
4. **RLHF。** 在人类偏好上做后训练，把原始的预训练文本模型转化为聊天助手。
5. **Pre-norm + RoPE + SwiGLU。** 在大规模下保持训练稳定。

自 GPT-2 以来，核心架构并没有太大变化。所有有意思的进展都发生在数据、规模和后训练上。

## 动手构建

### 第 1 步：因果掩码

参见 `code/main.py`。一行搞定：

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

在 softmax 之前把它加到注意力分数上。整个机制就这么简单。

### 第 2 步：一个 2 层的「类 GPT」模型

堆叠两个解码器块（带掩码的自注意力 + FFN，没有交叉注意力）。加上一个 token 嵌入、一个位置编码，以及一个反嵌入（unembedding，与 token 嵌入矩阵共享权重——这是自 GPT-2 起的标准技巧）。

### 第 3 步：端到端的下一个 token 预测

在一个 20 个 token 的玩具词表上，在每个位置产生 logits。针对错位一位的目标计算交叉熵损失。不计算梯度——这只是一次前向传播的健全性检查。

### 第 4 步：采样

实现 greedy、temperature、top-k、top-p、min-p。在一个固定的提示上分别运行并比较输出。一个采样函数只要 10 行。

## 实际运用

PyTorch，2026 年的写法：

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

在底层，`generate()` 执行前向传播，取出最后一个位置的 logits，采样出下一个 token，将其追加，然后重复。每一个生产级 LLM 推理栈（vLLM、TensorRT-LLM、llama.cpp、Ollama、MLX）都实现了同样的循环，并辅以大量优化——批量 prefill、连续批处理（continuous batching）、KV 缓存分页、投机解码。

**GPT 对比 BERT，各一句话：** GPT 预测 `P(x_t | x_{<t})`。BERT 预测 `P(x_masked | x_unmasked)`。损失决定了模型能否生成。

## 交付落地

参见 `outputs/skill-sampling-tuner.md`。该技能为新的生成任务挑选采样参数，并在需要确定性解码时发出标记提示。

## 练习

1. **简单。** 运行 `code/main.py`，验证经过 softmax 后因果注意力矩阵是下三角的。抽查：第 3 行应只在第 0–3 列上有权重。
2. **中等。** 实现宽度为 4 的束搜索（beam search）。在 10 个短提示上比较 beam-4 与 greedy 的困惑度（perplexity）。beam 总是更优吗？（提示：通常在翻译任务上更优，但在开放式聊天上不一定。）
3. **困难。** 实现投机解码：用一个微型的 2 层模型作为草稿模型，用一个 6 层模型作为验证模型。在 100 条长度为 64 的补全上测量挂钟时间（wall-clock）加速比。确认输出与验证模型的 greedy 结果一致。

## 关键术语

| 术语 | 人们怎么说 | 它实际的含义 |
|------|-----------------|-----------------------|
| Causal mask（因果掩码） | “那个三角形” | 一个上三角的 `-inf` 矩阵，加到注意力分数上，使位置 `i` 只能看到位置 `≤ i`。 |
| Next-token prediction（下一个 token 预测） | “那个损失” | 模型分布相对于每个位置真实下一个 token 的交叉熵。 |
| Autoregressive（自回归） | “一次生成一个” | 把输出反馈作为输入；并行只发生在训练期间，生成时没有。 |
| Logits | “softmax 之前的分数” | LM head 在 softmax 之前的原始输出；采样就发生在这些值上。 |
| Temperature（温度） | “创造力旋钮” | 用 T 除以 logits；T→0 等于 greedy，T→∞ 等于均匀分布。 |
| Top-p | “核采样（nucleus sampling）” | 把分布截断到和 ≥p 的最小集合；从剩下的部分采样。 |
| Min-p | “比 top-p 更好” | 保留满足 `p ≥ min_p × max_p` 的 token；根据分布的尖锐程度自适应截断阈值。 |
| Speculative decoding（投机解码） | “草稿 + 验证” | 廉价模型提议 N 个 token；大模型并行验证。 |
| Teacher forcing（教师强制） | “训练技巧” | 训练时喂入真实的前一个 token，而非模型自己的预测。这是每个 seq2seq 语言模型的标准做法。 |

## 延伸阅读

- [Radford et al. (2018). Improving Language Understanding by Generative Pre-Training](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) —— GPT-1。
- [Radford et al. (2019). Language Models are Unsupervised Multitask Learners](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) —— GPT-2。
- [Brown et al. (2020). Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) —— GPT-3 与上下文内学习。
- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) —— 投机解码论文。
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) —— 权威的因果语言模型参考代码。
