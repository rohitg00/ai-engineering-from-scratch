# 原因语言建模

> 现在,我们可以看到一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符串,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符,一个字符.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT)
**Time:** ~75 minutes

## 问题

语言模型回答了一个问题:`t-1`代币,代币的概率分布是多少?`t`训练这个信号,预测下一个代币,你得到一个模型,可以生成任意的文字,一个代币一次.

为了在整个序列上进行端到端训练,你需要每个位置的预测仅依赖于之前的位置.否则模型通过查看答案就会轻微地欺骗.

原因面膜是这样做的.`-inf`随着软max之后,这些位置变为0. 每个位置只能关注自己和之前的位置. 因为你将它应用到整个序列上一次,你得到N平行下一个代币预测在一个前进传递.

它们都是具有相同的核心循环的仅可解码的因果变压器.它们分别于数据质量,规模和建筑精炼以及后培训 (SFT,RLHF,DPO及其后代).

## 概念

![Causal mask creates a triangular attention matrix](../assets/causal-attention.svg)

### 面具

由于长度的顺序$N$建立一个$N \times N$矩阵:

```math
M_{ij} = \begin{cases} 0 & \text{if } j \le i \\ -\infty & \text{if } j > i \end{cases}
```

加入`M`软max之前的注意力分数. $\exp(-\infty) = 0$关注矩阵的每个行是仅对前位置的概率分布.

实施成本:一 `torch.tril()`电话,计算时间:纳秒,现场影响:一切.

### 长方体来自哪里

面具通常以注意力上的补丁呈现. 运行衍生在另一方向,它不再神秘:注意力是预सर्ग平均的第三个精炼,三角形是该平均的循环边界,写成矩阵.

**Stage 1 — prefix average.**顺序的最愚蠢的因果总结:位置$i$成为位置的平均值$0 \ldots i$作为一个循环,这是`out[i] = X[:i+1].mean(0)`按一个矩阵乘以一个矩阵,然后把每个行分为数,然后乘以

```python
import numpy as np

A = np.tril(np.ones((n, n)))
A = A / A.sum(axis=1, keepdims=True)
out = A @ X
```

排列$i$其他$A$是$[1/(i+1), \ldots, 1/(i+1), 0, \ldots, 0]$未来的任何东西都没有被掩盖,未来从来没有在总数中.

**Stage 2 — learned weights.**统一的平均值将过去的每个代币都视为同样相关.`S`现在,行列不再按构造算数积为一个,所以将每个行列正常化为软max,而不是按数量分.软max从来没有输出精确的零,这会破坏因果关系,除非未来的分数进入为`-inf`因为`exp(-inf) = 0`其他:

```python
def softmax(x, axis):
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

S = S + np.triu(np.full((n, n), -np.inf), k=1)
A = softmax(S, axis=1)
out = A @ X
```

它们是三角形,三行矩阵,三角形.`-inf`面具不是新机器,而是第一阶段的零输入,

**Stage 3 — content-dependent weights.**在第二阶段,`S`选后的位置:位置7总是重量位置3相同,无论代币说什么. 让得分取决于代币本身:`S = Q @ K.T / sqrt(d_k)`面具,软质,,都是一样的.

基本上,它是一个不变的阶段,一个不变的阶段:一个低三角的排列-stochastic矩阵乘以序列. 均的平均,学习的静态权重,内容依赖的权重.

```figure
mask-derivation
```

### 并行培训,串行推断

培训:向前传递整体`(N, d_model)`顺序一次,计算N跨进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进进

引号:你生成代币.`[t1, t2, t3]`现在,`t4`料`[t1, t2, t3, t4]`现在,`t5`料`[t1, t2, t3, t4, t5]`现在,`t6` KV缓存 (课 12) 保存了隐藏的状态`t1…tn`所以你不会每一步都重新计算它们. 但推断的序列深度=输出长度. 这就是自动降低税,

### 损失 变量

给出的代币`[t1, t2, t3, t4]`其他:

- 输入:`[t1, t2, t3]`
- 目标:`[t2, t3, t4]`

对于每一个职位`i`计算`-log P(target_i | inputs[:i+1])`总结,这是整个序列的交叉化.

每个变压器 LM 你听说过的火车在这个损失. 预训练,细节调整,SFT 相同的损失,不同的数据.

### 解码策略

训练后,样本选项比人们想象的更重要.

| Method | What it does | When to use |
|--------|--------------|-------------|
| Greedy | Argmax every step | Deterministic tasks, code completion |
| Temperature | Divide logits by T, sample | Creative tasks, higher T = more diversity |
| Top-k | Sample from top-k tokens only | Kills low-probability tails |
| Top-p (nucleus) | Sample from smallest set with cumulative prob ≥ p | 2020+ default; adapts to distribution shape |
| Min-p | Keep tokens with `p > min_p * max_p` | 2024+; better at rejecting long tails than top-p |
| Speculative decoding | Draft model proposes N tokens, big model verifies | 2–3× latency reduction at same quality |

2026年,min-p + 0.7温度是开放权重模型的合理默认.

### 什么让"GPT配方"工作

1. **Decoder-only.**没有编码器,每层一个注意力传输+FFN.
2. **Scaling.**基数法 (课 13) 告诉你如何花钱计算.
3. **In-context learning.**模型可以在不需要细调的情况下遵循一些拍摄的例子.
4. **RLHF.**培训后的人类偏好将原始预训练的文本转化为聊天助理.
5. **Pre-norm + RoPE + SwiGLU.**稳定训练规模.

根据GPT-2的数据,规模和训练后的情况,

```figure
causal-mask
```

## 建立它

### 步骤1:因果性面具

看到`code/main.py`一个单行:

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

在软max之前,再加上注意力分数.

### 步骤2:两层GPT型模型

堆叠两个解码器块 (掩盖自注意+FFN,没有交叉注意).添加一个代币嵌入,一个定位编码和一个解嵌 (绑定到代币嵌入矩阵是GPT-2以来的标准技巧).

### 步骤3:下一个标志预测,端到端

在20个代币玩具词汇上,在每个位置都生成 logits. 计算交叉缩损失与转移对一个目标. 没有梯度.

### 步骤4:采样

运行一个固定提示,并比较输出.一个样本取函数是10行.

## 用它

火,2026年语法:

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

在帽子下,`generate()`运行前进传递,拉出最后位置的记录,样本下一个代币,添加它,并重复.每个生产LLM推理堆 (vLLM,TensorRT-LLM, llama.cpp,Ollama,MLX) 实现相同的循环,重量优化批量预填,连续批量,KV缓存页面,投机解码.

**GPT vs BERT, one line each:**GPT预测$P(x_t \mid x_{<t})$伯特预测$P(x_{\text{masked}} \mid x_{\text{unmasked}})$损失决定模型是否能产生.

## 运送它

看到`outputs/skill-sampling-tuner.md`技能选择新一代任务的样本参数,并在确定性解码需要时标记.

## 运动

1. **Easy.**跑步`code/main.py`检查:排列3只应在03列中重量.
2. **Medium.**根据10个短提示,比较beam-4的困难与贪.beam总是赢得吗? (提示:通常用于翻译,而不是开放式聊天.)
3. **Hard.**实施投机解码:使用一个小的2层模型作为草案和一个6层模型作为验证器.测量长度100次的墙钟加速.64次验证输出与验证器的贪匹配.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Causal mask | "The triangle" | Upper-triangular `-inf` matrix added to attention scores so position `i` only sees positions `≤ i`. |
| Next-token prediction | "The loss" | Cross-entropy of the model's distribution against the true next token at every position. |
| Autoregressive | "Generate one at a time" | Feed output back as input; parallelism only during training, not during generation. |
| Logits | "Pre-softmax scores" | Raw output of the LM head before softmax; sampling happens on these. |
| Temperature | "Creativity knob" | Divide logits by $T$; $T \to 0$ = greedy, $T \to \infty$ = uniform. |
| Top-p | "Nucleus sampling" | Truncate distribution to smallest set summing to $\ge p$; sample from what remains. |
| Min-p | "Better than top-p" | Keep tokens where `p ≥ min_p × max_p`; adapts cutoff to sharpness of distribution. |
| Speculative decoding | "Draft + verify" | Cheap model proposes N tokens; big model verifies in parallel. |
| Teacher forcing | "Training trick" | During training, feed the true previous token, not the model's prediction. Standard for every seq2seq LM. |

## 进一步阅读

- [Radford et al. (2018). Improving Language Understanding by Generative Pre-Training](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf)GPT-1.
- [Radford et al. (2019). Language Models are Unsupervised Multitask Learners](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf)GPT-2.
- [Brown et al. (2020). Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165)GPT-3和在环境中学习.
- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192)规格解码纸.
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py)可нони化因果性-LM参考码.
