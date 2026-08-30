# GPT — Causal Language Modeling

> BERT看到了双方。GPT只看到过去。三角形面具是现代人工智能中最重要的一行代码。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段7 · 02（自我注意力）、阶段7 · 05（全Transformer）、阶段7 · 06（BERT）
** 时间：** ~75分钟

## The Problem

语言模型回答了一个问题：给定前一个“t-1”标记，标记“t”的概率分布是多少？根据该信号进行训练--下一个令牌预测--您将获得一个模型，该模型可以一次生成一个令牌的任意文本。

为了在整个序列上并行地端到端训练它，您需要每个位置的预测仅取决于早期位置。否则，模型会通过查看答案来进行微不足道的作弊。

因果面具做到了这一点。它是添加到softmax之前的注意力分数的“-inf”值的单个上三角矩阵。softmax之后，这些位置变为0。每个职位只能处理其本身和早期职位。因为您将其应用于整个序列一次，因此您可以在一次向前传递中获得N个并行的下一个令牌预测。

GPT-1（2018）、GPT-2（2019）、GPT-3（2020）、GPT-4（2023）、GPT-5（2024）、Claude、Llama、Qwen、Mistral、DeepSeek、Kimi -它们都是仅解码器的因果转换器，具有相同的核心回路。只是更大、更好的数据和更好的RL HF。

## The Concept

![Causal mask creates a triangular attention matrix](../assets/causal-attention.svg)

### The mask

给定一个长度为“N”的序列，构建一个“N × N”矩阵：

```
M[i, j] = 0       if j <= i
M[i, j] = -inf    if j > i
```

在softmax之前将“M”添加到原始注意力分数中。' opp（-inf）= 0 '，因此掩蔽位置贡献零权重。注意力矩阵的每一行仅是先前位置的概率分布。

实现成本：一次`torch.tril（）`调用。计算时间：纳秒。对球场的影响：一切。

### Parallel training, serial inference

训练：向前传递整个“（N，d_模型）”序列一次，计算N个交叉熵损失（每个位置一个）、总和、反向推进。沿着序列平行。这就是GPT训练规模化的原因--您只需一次图形处理即可批量处理100万个令牌。

推理：您逐个代币生成代币。输入“[t1，t2，t3]”，获取“t4”。输入'[t1，t2，t3，t4]'，获取'。输入'[t1，t2，t3，t4，t5]'，获取' t6 '。KV缓存（第12课）保存' t1..dn '的隐藏状态，这样您就不会在每一步中重新计算它们。但推理时的序列深度=输出长度。这就是自回归税，也是为什么解码是每个LLM的延迟瓶颈。

### The loss — shift-by-one

给定令牌'[t1，t2，t3，t4]'：

- 输入：“[t1，t2，t3]'
- 目标：`[t2，t3，t4]`

对于每个位置‘i’，计算‘-log P（目标_i|输入[：i+1]）'。总和。这是整个序列的交叉熵。

你听说过的每个Transformer器都在这个损失上。预训练、微调、SFT -相同的损失，不同的数据。

### Decoding strategies

培训后，抽样选择比人们想象的更重要。

| 方法 | 它所做的 | 何时使用 |
|--------|--------------|-------------|
| 贪婪 | Argmax的每一步 | 确定性任务、代码完成 |
| 温度 | 将逻辑位除以T，样本 | 创造性任务，T越高=多样性越大 |
| Top-k | 仅来自前k代币的样本 | 杀死低概率尾巴 |
| Top-p（核心） | 来自累积概率≥ p的最小集的样本 | 2020+默认;适应分布形状 |
| 民普 | 保留带有' p ' min_p * max_p '的代币 | 2024年+;比top-p更擅长拒绝长尾 |
| 推测解码 | 模型草案提出N个代币，大模型验证 | 在相同质量下，延迟减少2-3倍 |

2026年，最小-p+温度0.7是开重量模型的合理默认值。推测解码对于任何生产推理栈来说都是赌注。

### What made the "GPT recipe" work

1. ** 仅限解码器。**没有编码器额外费用。每层一次注意力传递+ FFN。
2. ** 缩放。** 124 M → 1.5B → 175 B →万亿。龙猫缩放定律（第13课）告诉您如何使用计算。
3. ** 上下文学习。**出现在6 B-13 B左右。该模型可以遵循少数示例，无需微调。
4. ** RL HF。**对人类偏好的后训练将预训练的原始文本转换为聊天助手。
5. ** 规范前+ RoPE + SwiGLU。**规模稳定培训。

自GPT-2以来，核心架构没有太大变化。所有有趣的事情都发生在数据、规模和训练后。

## Build It

### Step 1: the causal mask

请参阅' code/main.py '。一行台词：

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

将其添加到softmax之前的注意力分数中。这就是整个机制。

### Step 2: a 2-layer GPT-ish model

堆叠两个解码器块（掩蔽自我注意+ FFN，没有交叉注意）。添加令牌嵌入、位置编码和取消嵌入（与令牌嵌入矩阵绑定-自GPT-2以来的标准技巧）。

### Step 3: next-token prediction, end-to-end

在20个代币的玩具词汇中，在每个位置生成日志。根据移一目标计算交叉熵损失。没有梯度-这是向前传递的健全检查。

### Step 4: sampling

实现grey、temperature、top-k、top-p、min-p。在固定提示下运行每一个并比较输出。一个采样函数为10行。

## Use It

PyTorch，2026年习语：

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

在后台，`generate（）`运行向前传递，拉取最终位置的logit，采样下一个标记，追加它，然后重复。每个生产LLM推理堆栈（vLLM，TensorRT-LLM，llama.cpp，Ollama，MLX）都使用大量优化实现了相同的循环-批量预填充，连续缓存，KV缓存分页，推测解码。

**GPT vs BERT，每行：** GPT预测`P（x_t| x_{<t}）`。BERT预测`P（x_masked| x_unmasked）`。损失决定了模型是否能产生。

## Ship It

请参阅“输出/skill-sampling-tuner.md”。该技能为新一代任务选择采样参数，并在需要确定性解码时标记。

## Exercises

1. ** 简单。**运行“code/main.py”并验证因果注意力矩阵在softmax后是否为下三角形。抽检：第3行应仅在0-3列中具有权重。
2. ** 中等。**对宽度4进行射束搜索。在10个简短提示中比较beam-4与贪婪的困惑。梁总是赢吗？(Hint：通常用于翻译，而不是用于开放式聊天。）
3. ** 很难。**实现推测解码：使用一个微型2层模型作为草稿，使用一个6层模型作为验证器。测量100件长度为64的作品的壁挂加速。确认输出与验证者的贪婪相匹配。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 因果面具 | “三角形” | 上三角形“-inf”矩阵添加到注意力分数中，因此位置“i”只看到位置“<i”。 |
| 下一个代币预测 | “损失” | 模型分布与每个位置上真实下一个令牌的交叉信息。 |
| 自回归 | “一次生成一个” | 将输出作为输入进行反馈;仅在训练期间并行化，而不是在生成期间。 |
| Logits | “softmax前分数” | softmax之前LM头的原始输出;对这些进行采样。 |
| 温度 | “创意旋钮” | 将logits除以T; T-0 =贪婪，T-Infinity =均匀。 |
| Top-p | “核采样” | 将分布截断到最小集，总和为' p;从剩余部分中抽样。 |
| 民普 | “比top-p更好” | 保留标记，其中`p ≥ min_p × max_p`;根据分布的锐度调整截止值。 |
| 推测解码 | “草案+验证” | 廉价模型提出N个令牌;大型模型并行验证。 |
| 老师强迫 | “训练技巧” | 在训练过程中，输入真实的先前令牌，而不是模型的预测。每个seq 2 seq LM的标准配置。 |

## Further Reading

- [雷德福等人（2018）。通过生成性预训练提高语言理解]（https：//cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf）- GPT-1。
- [雷德福等人（2019）。语言模型是无监督多任务学习者]（https：//cdn.openai.com/better-language-models/language_models_are_unsupervised_multightask_learners.pdf）- GPT-2。
- [布朗等人（2020）。语言模型是少数学习者]（https：//arxiv.org/ab/2005.14165）- GPT-3和上下文学习。
- [利维坦、卡尔曼、马蒂亚斯（2023）。通过推测解码从变形金刚中快速推断]（https：//arxiv.org/ab/2211.17192）-规范解码论文。
- [HuggingFace ' modeling_llama.py ']（https：//github.com/huggingface/transformers/blo/main/SRC/transformers/models/llama/modeling_llama.py）-规范的cashe-LM参考代码。
