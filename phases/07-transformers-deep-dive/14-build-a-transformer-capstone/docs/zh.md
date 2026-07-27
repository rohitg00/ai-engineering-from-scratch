# 从零构建 Transformer — 收官之作

> 十三课。一个模型。不抄近路。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 01 到 13。不要跳过。
**Time:** ~120 分钟

## 问题

你已经读了每篇论文。你已经实现了注意力、multi-head 拆分、位置编码、编码器和解码器模块、BERT 和 GPT 损失、MoE、KV cache。现在让它们在一个真实任务上协同工作。

收官之作：在字符级语言建模任务上端到端训练一个小型 decoder-only transformer。它读莎士比亚。它生成新的莎士比亚。它小到可以在笔记本上 10 分钟内训练完成。它足够正确，换用更大的数据集和更长的训练就能得到一个真正的 LM。

这是本课程的"nanoGPT"。它不是原创——Karpathy 2023 年的 nanoGPT 教程是每个学生至少写一次的参考实现。我们借用其形状并根据我们覆盖的内容进行改造。

## 概念

![从零构建 transformer 模块图](../assets/capstone.svg)

带注释的架构：

```
input tokens (B, N)
   │
   ▼
token embedding + positional embedding  ◀── 第 04 课（RoPE 选项）
   │
   ▼
┌──── block × L ────────────────────┐
│  RMSNorm                          │  ◀── 第 05 课
│  MultiHeadAttention (causal)      │  ◀── 第 03 课 + 07 课（causal mask）
│  residual                         │
│  RMSNorm                          │
│  SwiGLU FFN                       │  ◀── 第 05 课
│  residual                         │
└────────────────────────────────── ┘
   │
   ▼
final RMSNorm
   │
   ▼
lm_head (tied to token embedding)
   │
   ▼
logits (B, N, V)
   │
   ▼
shift-by-one cross-entropy            ◀── 第 07 课
```

### 我们交付什么

- `GPTConfig` — 一处配置所有超参数。
- `MultiHeadAttention` — 因果、批处理、带可选的 Flash 风格路径（PyTorch 的 `scaled_dot_product_attention`）。
- `SwiGLUFFN` — 现代 FFN。
- `Block` — pre-norm、残差包裹的 attention + FFN。
- `GPT` — 嵌入、堆叠模块、LM head、generate()。
- 带 AdamW、余弦 LR、梯度裁剪的训练循环。
- 莎士比亚文本上的字符级 tokenizer。

### 我们不交付什么

- RoPE — 第 04 课概念上已实现。这里我们为简化使用学习的位置嵌入。练习要求你替换为 RoPE。
- 生成时的 KV cache — 每个生成步骤重新计算整个前缀上的注意力。更慢但更简单。练习要求你添加 KV cache。
- Flash Attention — PyTorch 2.0+ 在输入匹配时自动分发；我们使用 `F.scaled_dot_product_attention`。
- MoE — 每模块单个 FFN。你在第 11 课中见过 MoE。

### 目标指标

在 Mac M2 笔记本上，一个 4 层、4 head、d_model=128 的 GPT 在 `tinyshakespeare.txt` 上训练 2,000 步：

- 训练损失从约 4.2（随机）收敛到约 1.5，大约 6 分钟。
- 采样输出看起来像莎士比亚形状：古词、换行、像"ROMEO:"这样的专有名词出现。
- 验证损失（保留的文本最后 10%）与训练损失紧密跟踪；在此大小/预算下没有过拟合。

## 动手构建

本课使用 PyTorch。安装 `torch`（CPU 版本即可）。参见 `code/main.py`。脚本处理：

- 如果缺失则下载 `tinyshakespeare.txt`（或读取本地副本）。
- 字节级字符 tokenizer。
- 90/10 训练/验证分割。
- 在支持的硬件上使用 bf16 autocast 的训练循环。
- 训练完成后采样。

### 步骤 1：数据

```python
text = open("tinyshakespeare.txt").read()
chars = sorted(set(text))
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for c, i in stoi.items()}
encode = lambda s: [stoi[c] for c in s]
decode = lambda xs: "".join(itos[x] for x in xs)
```

65 个唯一字符。微型的词汇表。适合 4 字节 vocab_size。没有 BPE，没有 tokenizer 的麻烦。

### 步骤 2：模型

参见 `code/main.py`。模块来自第 05 课的标准教材——pre-norm、RMSNorm、SwiGLU、因果 MHA。4/4/128 的参数量：约 800K。

### 步骤 3：训练循环

获取一个随机 batch，长度为 256 的 token 窗口。前向传播。移位一位交叉熵。反向传播。AdamW 步。日志。重复。

```python
for step in range(max_steps):
    x, y = get_batch("train")
    logits = model(x)
    loss = F.cross_entropy(logits.view(-1, vocab_size), y.view(-1))
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step()
    opt.zero_grad()
```

### 步骤 4：采样

给定一个 prompt，重复前向传播，从 top-p logits 采样，追加，继续。500 个 token 后停止。

### 步骤 5：读取输出

经过 2,000 步：

```
ROMEO:
Away and mild will not thy friend, that thou shalt wit:
The chief that well shame and hath been his friends,
...
```

不是莎士比亚。但形状像莎士比亚。~800K 参数和笔记本上 6 分钟明显是胜利。

## 实际应用

这个收官之作是一个参考架构。将其交付为真实产品的三个扩展：

1. **替换 tokenizer。** 使用 BPE（如 `tiktoken.get_encoding("cl100k_base")`）。词汇表大小从 65 跳到约 50,000。模型容量需要相应扩展。
2. **在更大的语料库上训练。** 使用 `OpenWebText` 或 `fineweb-edu`（HuggingFace）。在单个 A100 上 10B token 对 125M 参数的 GPT 大约需要 24 小时。
3. **添加 RoPE + KV cache + Flash Attention。** 下面的练习带你逐个完成。

这会变成一个生成流利英语的 125M 参数 GPT。不是前沿模型。但相同的代码路径——只是更大——就是 Karpathy、EleutherAI 和 Allen Institute 在 2026 年用来训练研究检查点的方案。

## 交付

参见 `outputs/skill-transformer-review.md`。该 skill 审查从零构建的 transformer 实现是否正确，覆盖前 13 课的所有内容。

## 练习

1. **简单。** 运行 `code/main.py`。验证你训练的模型在最终步骤的验证损失低于 2.0。将 `max_steps` 从 2,000 改为 5,000——验证损失是否持续改善？
2. **中等。** 将学习的位置嵌入替换为 RoPE。在 `MultiHeadAttention` 内对 Q 和 K 应用旋转。训练并验证验证损失至少一样低。
3. **中等。** 在采样循环中实现 KV cache。生成 500 个 token，分别使用和不使用缓存。在笔记本上墙钟时间应改善 5–20×。
4. **困难。** 向模型添加第二个 head，预测下一个加一个的 token（MTP——DeepSeek-V3 的多 token 预测）。联合训练。有帮助吗？
5. **困难。** 将每个模块中的单个 FFN 替换为 4 专家 MoE。路由器 + top-2 路由。在匹配激活参数下观察验证损失如何变化。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| nanoGPT | "Karpathy 的教程仓库" | 最小 decoder-only transformer 训练代码，约 300 LOC；典范参考。 |
| tinyshakespeare | "标准玩具语料库" | 约 1.1 MB 文本；自 2015 年以来每个字符 LM 教程都使用它。 |
| Tied embeddings | "共享输入/输出矩阵" | LM head 权重 = token 嵌入矩阵的转置；节省参数，改善质量。 |
| bf16 autocast | "训练精度技巧" | 前向/反向在 bf16 中运行，优化器状态保持在 fp32；自 2021 年以来的标准。 |
| Gradient clipping | "阻止尖峰" | 将全局梯度范数限制在 1.0；防止训练爆炸。 |
| Cosine LR schedule | "2020+ 默认" | LR 线性上升（warmup）然后余弦衰减到峰值的 10%。 |
| MFU | "Model FLOP Utilization" | 达到的 FLOPs / 理论峰值；2026 年稠密 40%、MoE 30% 很强。 |
| Val loss | "保留损失" | 模型从未见过的数据上的交叉熵；过拟合检测器。 |

## 延伸阅读

- [The Annotated Transformer (Harvard NLP)](https://nlp.seas.harvard.edu/annotated-transformer/) — 经典的带注释实现。
