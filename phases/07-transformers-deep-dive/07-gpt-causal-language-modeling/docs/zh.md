# GPT —— 因果语言建模（Causal Language Modeling）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> BERT 同时看左右两侧，GPT 只看过去。三角 mask 是现代 AI 中最举足轻重的一行代码。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT)
**Time:** ~75 minutes

## 问题（The Problem）

语言模型只回答一个问题：给定前 `t-1` 个 token，第 `t` 个 token 的概率分布是什么？拿这个信号——也就是 next-token prediction（下一个 token 预测）——去训练，你就能得到一个能逐 token 生成任意文本的模型。

要在整段序列上端到端地并行训练，每个位置的预测就只能依赖更早的位置。否则模型会偷懒，直接看答案。

causal mask（因果 mask）就是干这件事的。它是一个上三角矩阵，元素全是 `-inf`，在 softmax 之前加到 attention 分数上。softmax 之后，那些位置就变成 0。每个位置只能 attend 到自己以及之前的位置。而且因为这套机制对整段序列只用一次，一次前向传播就能拿到 N 个并行的下一 token 预测。

GPT-1 (2018)、GPT-2 (2019)、GPT-3 (2020)、GPT-4 (2023)、GPT-5 (2024)、Claude、Llama、Qwen、Mistral、DeepSeek、Kimi —— 它们全都是 decoder-only 的因果 transformer，核心循环完全一样。只是更大、数据更好、RLHF 做得更到位罢了。

## 概念（The Concept）

![Causal mask creates a triangular attention matrix](../assets/causal-attention.svg)

### 这块 mask（The mask）

给定长度为 `N` 的序列，构造一个 `N × N` 矩阵：

```
M[i, j] = 0       if j <= i
M[i, j] = -inf    if j > i
```

在 softmax 之前把 `M` 加到原始 attention 分数上。`exp(-inf) = 0`，所以被 mask 的位置贡献的权重为 0。attention 矩阵的每一行就是一个只覆盖之前位置的概率分布。

实现成本：一行 `torch.tril()`。计算耗时：纳秒级。对整个领域的影响：颠覆性的。

### 训练并行，推理串行（Parallel training, serial inference）

训练：把整段 `(N, d_model)` 序列前向传播一次，计算 N 个 cross-entropy loss（每个位置一个）求和、反向传播。沿序列方向并行。这就是 GPT 训练之所以能 scale 的原因——一次 GPU 前向就能处理一个 batch 里的 100 万个 token。

推理：你得一个 token 一个 token 地生成。喂 `[t1, t2, t3]`，得到 `t4`；喂 `[t1, t2, t3, t4]`，得到 `t5`；喂 `[t1, t2, t3, t4, t5]`，得到 `t6`。KV cache（第 12 课）会把 `t1…tn` 的隐状态保存下来，省得每步重算。但推理时的串行深度 = 输出长度。这就是 autoregressive 的代价，也是为什么解码是每个 LLM 的延迟瓶颈。

### loss——错位一格（The loss — shift-by-one）

给定 token 序列 `[t1, t2, t3, t4]`：

- 输入：`[t1, t2, t3]`
- 目标：`[t2, t3, t4]`

对每个位置 `i`，计算 `-log P(target_i | inputs[:i+1])`。求和。这就是整段序列的 cross-entropy。

你听过的每一个 transformer 语言模型都是用这个 loss 训练的。预训练、微调、SFT —— 同一个 loss，不同数据。

### 解码策略（Decoding strategies）

训练完之后，采样策略的影响比大多数人以为的要大得多。

| 方法 | 做什么 | 何时用 |
|--------|--------------|-------------|
| Greedy | 每步取 argmax | 确定性任务、代码补全 |
| Temperature | logits 除以 T 后采样 | 创意任务，T 越大多样性越高 |
| Top-k | 只在 top-k 个 token 里采样 | 砍掉低概率长尾 |
| Top-p（nucleus） | 在累计概率 ≥ p 的最小集合里采样 | 2020 年起的默认选择，会自适应分布形状 |
| Min-p | 保留 `p > min_p * max_p` 的 token | 2024 年起；比 top-p 更擅长拒绝长尾 |
| Speculative decoding | draft 模型先提议 N 个 token，大模型再验证 | 同等质量下延迟降低 2–3 倍 |

2026 年，对开源权重模型来说，min-p + temperature 0.7 是个挺合理的默认。speculative decoding 已经是任何生产级推理栈的标配。

### 「GPT 配方」为什么能成（What made the "GPT recipe" work）

1. **Decoder-only。** 没有 encoder 那一坨开销。每层一次 attention + FFN 走完。
2. **Scaling。** 124M → 1.5B → 175B → 万亿级。Chinchilla 缩放定律（第 13 课）告诉你算力该怎么花。
3. **In-context learning。** 大约在 6B–13B 规模涌现。模型不用微调就能跟随 few-shot 例子。
4. **RLHF。** 在人类偏好上做后训练，把原始的预训练文本模型变成了聊天助手。
5. **Pre-norm + RoPE + SwiGLU。** 让大规模训练保持稳定。

自 GPT-2 以来，核心架构其实没怎么变。所有有意思的进展都发生在数据、规模和后训练上。

## 动手实现（Build It）

### 第 1 步：causal mask（Step 1: the causal mask）

见 `code/main.py`。一行的事：

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

在 softmax 之前加到 attention 分数上。整个机制就这么点东西。

### 第 2 步：一个 2 层的 GPT 风格模型（Step 2: a 2-layer GPT-ish model）

堆两个 decoder block（masked self-attention + FFN，没有 cross-attention）。加上 token embedding、位置编码、以及一个 unembedding（与 token embedding 矩阵共享权重——GPT-2 之后的标准技巧）。

### 第 3 步：端到端的下一 token 预测（Step 3: next-token prediction, end-to-end）

在一个只有 20 个 token 的玩具词表上，让模型在每个位置都输出 logits。对照错位一格的目标计算 cross-entropy loss。不算梯度——这只是个前向传播健全性检查。

### 第 4 步：采样（Step 4: sampling）

实现 greedy、temperature、top-k、top-p、min-p。在固定的 prompt 上各跑一遍，对比输出。一个采样函数 10 行就能写完。

## 用起来（Use It）

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

底层逻辑是：`generate()` 跑一次前向、取最后一个位置的 logits、采样下一 token、追加进去、再重复。每一个生产级 LLM 推理栈（vLLM、TensorRT-LLM、llama.cpp、Ollama、MLX）实现的都是同一个循环，只不过加了大量优化——批量 prefill、continuous batching、KV cache 分页、speculative decoding。

**GPT vs BERT，各一句话：** GPT 预测 `P(x_t | x_{<t})`，BERT 预测 `P(x_masked | x_unmasked)`。loss 决定了模型能不能生成。

## 上线部署（Ship It）

见 `outputs/skill-sampling-tuner.md`。这个 skill 会为新的生成任务挑选采样参数，并在需要确定性解码时给出提示。

## 练习（Exercises）

1. **简单。** 跑一遍 `code/main.py`，验证 softmax 之后 causal attention 矩阵是下三角的。抽查：第 3 行应该只在第 0–3 列有权重。
2. **中等。** 实现宽度为 4 的 beam search。在 10 个短 prompt 上对比 beam-4 与 greedy 的 perplexity。beam 总能赢吗？（提示：通常翻译任务能赢，开放式聊天不一定。）
3. **困难。** 实现 speculative decoding：用一个 2 层小模型当 draft、用一个 6 层模型当验证器。测 100 次长度为 64 的生成的实际加速比。确认输出与验证器的 greedy 结果一致。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Causal mask | 「那块三角」 | 加到 attention 分数上的上三角 `-inf` 矩阵，让位置 `i` 只能看到位置 `≤ i`。 |
| Next-token prediction | 「那个 loss」 | 在每个位置上，模型分布与真实下一 token 的 cross-entropy。 |
| Autoregressive | 「一次生成一个」 | 把输出再喂回输入；只有训练时并行，生成时不行。 |
| Logits | 「softmax 之前的分数」 | LM head 在 softmax 之前的原始输出；采样就发生在这上面。 |
| Temperature | 「创造力旋钮」 | logits 除以 T；T→0 就是 greedy，T→∞ 就是均匀分布。 |
| Top-p | 「nucleus 采样」 | 把分布截断到累计和 ≥p 的最小集合，再在剩下的里面采样。 |
| Min-p | 「比 top-p 更好」 | 保留 `p ≥ min_p × max_p` 的 token；截断点会随分布的尖锐程度自适应。 |
| Speculative decoding | 「draft + verify」 | 便宜模型先提议 N 个 token，大模型并行验证。 |
| Teacher forcing | 「训练小技巧」 | 训练时喂真实的上一个 token，而不是模型自己的预测。每个 seq2seq LM 都这么干。 |

## 延伸阅读（Further Reading）

- [Radford et al. (2018). Improving Language Understanding by Generative Pre-Training](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) —— GPT-1。
- [Radford et al. (2019). Language Models are Unsupervised Multitask Learners](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) —— GPT-2。
- [Brown et al. (2020). Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) —— GPT-3 与 in-context learning。
- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) —— spec decoding 论文。
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) —— 因果 LM 的标杆参考代码。
