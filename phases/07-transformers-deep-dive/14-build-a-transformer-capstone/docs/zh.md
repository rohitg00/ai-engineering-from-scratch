# 14 · 从零构建一个 Transformer——压轴项目

> 十三节课。一个模型。绝不走捷径。

**类型：** 构建（Build）
**语言：** Python
**前置：** 第 7 阶段 · 01 到 13。别跳过。
**时长：** 约 120 分钟

## 问题所在

你已经读完了每一篇论文。你实现过注意力（attention）、多头拆分（multi-head splits）、位置编码（positional encodings）、编码器与解码器块（encoder and decoder blocks）、BERT 与 GPT 的损失函数、MoE、KV 缓存（KV cache）。现在，把它们组合起来，在一个真实任务上跑通。

压轴项目：端到端训练一个小型的「仅解码器」（decoder-only）transformer，完成一个字符级（character-level）语言建模任务。它读莎士比亚，它生成新的莎士比亚风格文本。它小到可以在笔记本电脑上 10 分钟内完成训练。它又足够正确——只要换上更大的数据集、跑更长的训练，你就能得到一个真正的语言模型（LM）。

这是本课程的「nanoGPT」。它并非原创——Karpathy 在 2023 年的 nanoGPT 教程是每个学生至少要亲手写一遍的参考实现。我们借用它的骨架，并围绕本阶段讲过的内容重新打磨。

## 核心概念

〔图：从零构建 Transformer 的整体结构框图〕

带注解的架构：

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

### 我们交付什么

- `GPTConfig` —— 集中配置所有超参数的唯一入口。
- `MultiHeadAttention` —— 因果（causal）、批处理（batched），并带有可选的 Flash 风格通路（PyTorch 的 `scaled_dot_product_attention`）。
- `SwiGLUFFN` —— 现代前馈网络（FFN）。
- `Block` —— 前置归一化（pre-norm）、残差包裹的注意力 + FFN。
- `GPT` —— 嵌入层、堆叠的块、LM 头、generate()。
- 训练循环：AdamW、余弦学习率（cosine LR）、梯度裁剪（gradient clipping）。
- 在莎士比亚文本上的字符级分词器。

### 我们不交付什么

- RoPE —— 已在第 04 课从概念上实现过。这里为了简洁，使用可学习的位置嵌入（learned positional embeddings）。练习会要求你换成 RoPE。
- 生成时的 KV 缓存 —— 每一步生成都会在整个前缀上重新计算注意力。更慢，但更简单。练习会要求你加上 KV 缓存。
- Flash Attention —— PyTorch 2.0+ 在输入匹配时会自动分派；我们使用 `F.scaled_dot_product_attention`。
- MoE —— 每个块只有一个 FFN。你在第 11 课见过 MoE。

### 目标指标

在一台 Mac M2 笔记本上，一个 4 层、4 头、d_model=128 的 GPT，在 `tinyshakespeare.txt` 上训练 2,000 步：

- 训练损失（training loss）在大约 6 分钟内从约 4.2（随机初始化）收敛到约 1.5。
- 采样输出看起来「有莎士比亚的样子」：出现古旧词汇、换行，以及像 "ROMEO:" 这样的专有名字。
- 验证损失（val loss，留出文本的最后 10%）与训练损失贴合得很紧；在这个规模/算力预算下没有过拟合。

## 动手构建

本课使用 PyTorch。安装 `torch`（CPU 版即可）。参见 `code/main.py`。该脚本负责：

- 在缺失时下载 `tinyshakespeare.txt`（或读取本地副本）。
- 字节级（byte-level）字符分词器。
- 按 90/10 划分训练集/验证集。
- 在受支持的硬件上使用 bf16 autocast 的训练循环。
- 训练完成后进行采样。

### 第 1 步：数据

```python
text = open("tinyshakespeare.txt").read()
chars = sorted(set(text))
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for c, i in stoi.items()}
encode = lambda s: [stoi[c] for c in s]
decode = lambda xs: "".join(itos[x] for x in xs)
```

65 个唯一字符。极小的词表。用 4 字节的 vocab_size 就装得下。没有 BPE，没有分词器的折腾。

### 第 2 步：模型

参见 `code/main.py`。这个块就是第 05 课里的教科书写法——前置归一化、RMSNorm、SwiGLU、因果 MHA。4/4/128 的参数量约为 800K。

### 第 3 步：训练循环

取一批长度为 256 的 token 窗口。前向。错位一位的交叉熵（shift-by-one cross-entropy）。反向。AdamW 更新一步。记录日志。重复。

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

### 第 4 步：采样

给定一个提示词，反复前向、从 top-p logits 中采样、追加、继续。生成 500 个 token 后停止。

### 第 5 步：阅读输出

训练 2,000 步之后：

```
ROMEO:
Away and mild will not thy friend, that thou shalt wit:
The chief that well shame and hath been his friends,
...
```

不是莎士比亚。但「有莎士比亚的样子」。对约 800K 参数、在笔记本上跑 6 分钟来说，这是一场明明白白的胜利。

## 用起来

这个压轴项目是一套参考架构。要把它推进到真正可用的程度，有三个扩展方向：

1. **换掉分词器。** 改用 BPE（例如 `tiktoken.get_encoding("cl100k_base")`）。词表大小从 65 跃升到约 50,000。模型容量需要相应放大以匹配。
2. **在更大的语料上训练。** 使用 `OpenWebText` 或 `fineweb-edu`（HuggingFace）。在单张 A100 上，对一个 125M 参数的 GPT 处理 100 亿（10B）token 大约需要 24 小时。
3. **加上 RoPE + KV 缓存 + Flash Attention。** 下面的练习会逐一带你完成。

最终这会成为一个 125M 参数的 GPT，能生成流畅的英文。算不上前沿模型。但同一条代码路径——只是更大——正是 Karpathy、EleutherAI 与艾伦人工智能研究所（Allen Institute）在 2026 年训练研究检查点（checkpoint）所用的那一套。

## 交付

参见 `outputs/skill-transformer-review.md`。该 skill 会对一个「从零构建的 transformer」实现进行审查，覆盖前 13 节课的全部正确性要点。

## 练习

1. **简单。** 运行 `code/main.py`。验证你训练出的模型在最后一步的验证损失低于 2.0。把 `max_steps` 从 2,000 改成 5,000——验证损失还会继续下降吗？
2. **中等。** 把可学习的位置嵌入替换为 RoPE。在 `MultiHeadAttention` 内部对 Q 和 K 施加旋转。训练并验证验证损失至少能达到同样低的水平。
3. **中等。** 在采样循环中实现 KV 缓存。分别用「带缓存」和「不带缓存」生成 500 个 token。在笔记本上墙钟时间（wall-clock）应当提升 5–20 倍。
4. **困难。** 给模型再加一个头，预测「下一个再下一个」的 token（MTP——来自 DeepSeek-V3 的多 token 预测，Multi-Token Prediction）。联合训练。有帮助吗？
5. **困难。** 把每个块里的单一 FFN 替换为一个 4 专家的 MoE。路由器 + top-2 路由。看看在激活参数量匹配的情况下验证损失如何变化。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| nanoGPT | 「Karpathy 的教程仓库」 | 极简的「仅解码器」transformer 训练代码，约 300 行；公认的参考实现。 |
| tinyshakespeare | 「标准玩具语料」 | 约 1.1 MB 文本；自 2015 年以来每个字符级 LM 教程都在用它。 |
| Tied embeddings（绑定嵌入） | 「共享输入/输出矩阵」 | LM 头权重 = token 嵌入矩阵的转置；省参数，且提升质量。 |
| bf16 autocast | 「训练精度技巧」 | 前向/反向用 bf16 运行，优化器状态保留 fp32；自 2021 年起成为标准做法。 |
| Gradient clipping（梯度裁剪） | 「抑制毛刺」 | 把全局梯度范数封顶在 1.0；防止训练爆炸。 |
| Cosine LR schedule（余弦学习率调度） | 「2020 年以后的默认选择」 | 学习率先线性爬升（warmup），再按余弦形状衰减到峰值的 10%。 |
| MFU | 「模型 FLOP 利用率（Model FLOP Utilization）」 | 实际达到的 FLOPs / 理论峰值；2026 年，稠密模型 40%、MoE 30% 算是很强。 |
| Val loss（验证损失） | 「留出损失」 | 在模型从未见过的数据上的交叉熵；过拟合的检测器。 |

## 延伸阅读

- [The Annotated Transformer (Harvard NLP)](https://nlp.seas.harvard.edu/annotated-transformer/) —— 经典的带注解实现。
