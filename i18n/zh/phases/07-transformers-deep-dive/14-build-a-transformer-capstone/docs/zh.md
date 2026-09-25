# 从零构建 Transformer — 毕业项目

> 十三节课。一个模型。没有捷径。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 01 至 13。请勿跳过。
**Time:** 约 120 分钟

## 问题所在

你已经读完了每一篇论文。你已经实现了注意力机制、多头拆分、位置编码、编码器与解码器块、BERT 和 GPT 损失、MoE、KV cache。现在让它们在一个真实任务上协同工作。

毕业项目：在字符级语言建模任务上端到端训练一个小型 decoder-only transformer。它阅读莎士比亚。它生成新的莎士比亚。它足够小，可以在笔记本电脑上 10 分钟内完成训练。它足够正确，只要换上更大的数据集和更长的训练时间，就能得到一个真正的 LM。

这是本课程的 "nanoGPT"。它并非原创 — Karpathy 2023 年的 nanoGPT 教程是每个学生至少都会写一次的参考实现。我们沿用其结构，并围绕我们已学的内容加以改造。

## 核心概念

![Transformer-from-scratch block diagram](../assets/capstone.svg)

带注释的架构：

```
input tokens (B, N)
   │
   ▼
token embedding + positional embedding  ◀── Lesson 04 (RoPE option)
   │
   ▼
┌──── block × L ────────────────────┐
│  RMSNorm                          │  ◀── Lesson 05
│  MultiHeadAttention (causal)      │  ◀── Lesson 03 + 07 (causal mask)
│  residual                         │
│  RMSNorm                          │
│  SwiGLU FFN                       │  ◀── Lesson 05
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
shift-by-one cross-entropy            ◀── Lesson 07
```

### 我们交付的内容

- `GPTConfig` — 一个统一配置所有超参数的地方。
- `MultiHeadAttention` — 因果、分批，并带有可选的 Flash 风格路径（PyTorch 的 `scaled_dot_product_attention`）。
- `SwiGLUFFN` — 现代 FFN。
- `Block` — pre-norm、残差包裹的 attention + FFN。
- `GPT` — 嵌入、堆叠块、LM head、generate()。
- 使用 AdamW、cosine LR、梯度裁剪的训练循环。
- 基于莎士比亚文本的字符级 tokenizer。

### 我们不交付的内容

- RoPE — 已在第 04 课中从概念上实现。此处为简单起见使用可学习的位置嵌入。练习会要求你换入 RoPE。
- 生成期间的 KV cache — 每个生成步骤都会对整个前缀重新计算注意力。更慢但更简单。练习会要求你添加 KV cache。
- Flash Attention — 如果输入匹配，PyTorch 2.0+ 会自动分发；我们使用 `F.scaled_dot_product_attention`。
- MoE — 每个块使用单个 FFN。你在第 11 课中见过 MoE。

### 目标指标

在 Mac M2 笔记本电脑上，一个 4 层、4 头、d_model=128 的 GPT 在 `tinyshakespeare.txt` 上训练 2,000 步：

- 训练损失在大约 6 分钟内从 ~4.2（随机）收敛到 ~1.5。
- 采样输出呈现莎士比亚风格：古旧词汇、换行、"ROMEO:" 这类专有名词逐渐显现。
- 验证损失（最后 10% 的留出文本）与训练损失紧密贴合；在此规模/预算下没有过拟合。

```figure
n5-block-stack
```

## 动手构建

本课使用 PyTorch。安装 `torch`（CPU 版本即可）。参见 `code/main.py`。该脚本处理：

- 如果缺失则下载 `tinyshakespeare.txt`（或读取本地副本）。
- 字节级字符 tokenizer。
- 按 90/10 划分训练/验证集。
- 在支持的硬件上使用 bf16 autocast 的训练循环。
- 训练完成后进行采样。

### 步骤 1：数据

```python
text = open("tinyshakespeare.txt").read()
chars = sorted(set(text))
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for c, i in stoi.items()}
encode = lambda s: [stoi[c] for c in s]
decode = lambda xs: "".join(itos[x] for x in xs)
```

65 个唯一字符。极小的词表。 Fits a 4-byte vocab_size. 无 BPE，无 tokenizer 纠纷。

### 步骤 2：模型

参见 `code/main.py`。该块是第 05 课的标准教科书内容 — pre-norm、RMSNorm、SwiGLU、因果 MHA。4/4/128 配置的参数量约为 ~800K。

### 步骤 3：训练循环

获取一个长度为 256 的 token 窗口的随机批次。前向。偏移一位的交叉熵。反向。AdamW 步。记录。重复。

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

给定一个 prompt，反复前向，从 top-p logits 中采样，追加，然后继续。在 500 个 token 后停止。

### 步骤 5：阅读输出

经过 2,000 步之后：

```
ROMEO:
Away and mild will not thy friend, that thou shalt wit:
The chief that well shame and hath been his friends,
...
```

不是莎士比亚。但具有莎士比亚的形状。对于 ~800K 参数和笔记本电脑上 6 分钟的时间来说，这是一个明确的胜利。

## 使用它

这个毕业项目是一个参考架构。三个扩展可以将其变成真正可用的东西：

1. **更换 tokenizer。** 使用 BPE（例如 `tiktoken.get_encoding("cl100k_base")`）。词表大小从 65 跃升至约 50,000。模型容量需要相应扩大以作补偿。
2. **在更大的语料库上训练。** 使用 `OpenWebText` 或 `fineweb-edu`（HuggingFace）。在单个 A100 上，125M 参数的 GPT 训练 10B token 大约需要 24 小时。
3. **添加 RoPE + KV cache + Flash Attention。** 下面的练习会引导你逐一完成。

最终得到的是一个能生成流畅英语的 125M 参数 GPT。不是前沿模型。但同样的代码路径 — 只是更大 — 正是 Karpathy、EleutherAI 和 Allen Institute 在 2026 年用于训练研究 checkpoint 的方式。

## 交付它

参见 `outputs/skill-transformer-review.md`。该技能会审阅一个从零构建的 transformer 实现，检查其在之前全部 13 课中的正确性。

## 练习

1. **简单。** 运行 `code/main.py`。验证你训练的模型最终一步的验证损失低于 2.0。将 `max_steps` 从 2,000 改为 5,000 — 验证损失是否持续改善？
2. **中等。** 用 RoPE 替换可学习的位置嵌入。在 `MultiHeadAttention` 内部对 Q 和 K 应用旋转。训练并验证验证损失至少同样低。
3. **中等。** 在采样循环中实现 KV cache。分别带缓存和不带缓存生成 500 个 token。在笔记本电脑上挂钟时间应提升 5–20 倍。
4. **困难。** 为模型添加第二个头，用于预测下下个 token（MTP — 来自 DeepSeek-V3 的 Multi-Token Prediction）。联合训练。它有帮助吗？
5. **困难。** 将每个块的单个 FFN 替换为 4 专家 MoE。Router + top-2 路由。观察在匹配激活参数的情况下验证损失如何变化。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| nanoGPT | “Karpathy 的教程仓库” | 极简的 decoder-only transformer 训练代码，约 300 行；权威参考。 |
| tinyshakespeare | “标准的玩具语料库” | 约 1.1 MB 的文本；自 2015 年以来每个字符级 LM 教程都在使用它。 |
| Tied embeddings | “共享输入/输出矩阵” | LM head 权重 = token 嵌入矩阵的转置；节省参数，提升质量。 |
| bf16 autocast | “训练精度技巧” | 前向/反向以 bf16 运行，优化器状态保持 fp32；自 2021 年以来的标准做法。 |
| Gradient clipping | “抑制尖峰” | 将全局梯度范数限制在 1.0；防止训练崩溃。 |
| Cosine LR schedule | “2020 年之后的默认选择” | 学习率先线性上升（warmup），然后按余弦形状衰减至峰值的 10%。 |
| MFU | "Model FLOP Utilization" | 实际 FLOPs / 理论峰值；2026 年稠密模型 40%、MoE 30% 即属优秀。 |
| Val loss | “留出集损失” | 模型从未见过的数据上的交叉熵；过拟合检测器。 |

## 延伸阅读

- [The Annotated Transformer (Harvard NLP)](https://nlp.seas.harvard.edu/annotated-transformer/) — 经典的带注释实现。