# 从零构建Transformer — 顶点项目

> 十三节课。一个模型。没有捷径。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 01 through 13. Don't skip.
**Time:** ~120 minutes

## 问题

你已经阅读了所有论文。你已经实现了注意力（attention）、多头分割（multi-head splits）、位置编码（positional encodings）、编码器和解码器块（encoder and decoder blocks）、BERT和GPT损失函数、MoE、KV缓存。现在，让它们在一个真实任务中协同工作。

顶点项目：在字符级语言建模任务上端到端训练一个小型仅解码器（decoder-only）transformer。它能阅读莎士比亚作品，生成新的莎士比亚风格文本。它足够小，可以在10分钟内用笔记本电脑完成训练。它足够准确，只需更换更大的数据集和更长的训练时间，就能获得一个真正的语言模型（LM）。

这是本课程的"nanoGPT"。它并非原创——Karpathy的2023年nanoGPT教程是每个学生至少要写一次的参考实现。我们借鉴了其架构，并根据我们所学内容进行了重新设计。

## 概念

![从零构建Transformer的块状图](../assets/capstone.svg)

架构注释：
```
输入标记 (B, N)
   │
   ▼
标记嵌入（token embedding）+ 位置嵌入（positional embedding）  ◀── 第04课（RoPE选项）
   │
   ▼
┌──── 块 × L ────────────────────┐
│  RMSNorm                          │  ◀── 第05课
│  多头注意力（MultiHeadAttention）（因果）      │  ◀── 第03课 + 第07课（因果掩码）
│  残差连接（residual）                         │
│  RMSNorm                          │
│  SwiGLU 前馈网络（FFN）                       │  ◀── 第05课
│  残差连接（residual）                         │
└────────────────────────────────── ┘
   │
   ▼
最终 RMSNorm
   │
   ▼
语言模型头部（lm_head）（与标记嵌入共享）
   │
   ▼
logits (B, N, V)
   │
   ▼
移位交叉熵（shift-by-one cross-entropy）            ◀── 第07课
```

### 我们提供的内容

- `GPTConfig` — 一个配置所有超参数的地方。
- `MultiHeadAttention` — 因果型、批处理、带有可选的Flash风格路径（PyTorch的`scaled_dot_product_attention`）。
- `SwiGLUFFN` — 现代前馈网络（FFN）。
- `Block` — 预归一化（pre-norm）、残差包装的注意力（residual-wrapped attention）+ 前馈网络（FFN）。
- `GPT` — 嵌入（embeddings）、堆叠的块（stacked blocks）、语言模型头部（LM head）、生成函数（generate()）。
- 训练循环，包含AdamW优化器、余弦学习率（cosine LR）、梯度裁剪（gradient clipping）。
- 莎士比亚文本的字符级（char-level）分词器。

### 我们不提供的内容

- RoPE（旋转位置编码）— 在第04课中概念性实现。这里为了简单起见，我们使用学习到的位置嵌入。练习要求你替换为RoPE。
- 生成过程中的KV缓存 — 每个生成步骤都会重新计算整个前缀的注意力。速度较慢但更简单。练习要求你添加一个KV缓存。
- Flash Attention — 如果输入匹配，PyTorch 2.0+会自动分发；我们使用`F.scaled_dot_product_attention`。
- MoE（专家混合）— 每个块只有一个FFN。你在第11课已经了解了MoE。

### 目标指标

在Mac M2笔记本电脑上，一个4层、4头、d_model=128的GPT在`tinyshakespeare.txt`上训练2000步：

- 训练损失从约4.2（随机）收敛到约1.5，耗时约6分钟。
- 采样输出看起来像莎士比亚风格：古语、换行、像"ROMEO:"这样的专有名词开始出现。
- 验证损失（保留最后10%的文本）紧密跟踪训练损失；在此规模/预算下没有过拟合。

## 构建它

本课程使用PyTorch。安装`torch`（CPU版本即可）。参见`code/main.py`。该脚本处理：

- 如果缺少`tinyshakespeare.txt`则下载（或读取本地副本）。
- 字节级字符分词器。
- 90/10的训练/验证分割。
- 在支持的硬件上进行bf16自动混合精度训练循环。
- 训练完成后进行采样。

### 步骤1：数据

```python
text = open("tinyshakespeare.txt").read()
chars = sorted(set(text))
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for i, c in stoi.items()}
encode = lambda s: [stoi[c] for c in s]
decode = lambda xs: "".join(itos[x] for x in xs)
```

65个独特字符。极小词汇表。适合4字节的vocab_size。没有BPE，没有分词器的复杂性。

### 步骤2：模型

参见`code/main.py`。该块是第05课中的标准实现——预归一化（pre-norm）、RMSNorm、SwiGLU、因果MHA。4/4/128的参数计数：约800K。

### 步骤3：训练循环

获取一个长度为256的标记窗口的随机批次。前向传播。移位交叉熵。反向传播。AdamW步骤。记录。重复。

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

### 步骤4：采样

给定一个提示，反复进行前向传播，从top-p的logits中采样，追加，然后继续。500个标记后停止。

### 步骤5：阅读输出

2000步后：

```
ROMEO:
Away and mild will not thy friend, that thou shalt wit:
The chief that well shame and hath been his friends,
...
```

不是莎士比亚。但看起来像莎士比亚。对于约800K参数和6分钟的笔记本电脑训练来说，这是一个明显的成功。

## 使用它

这个顶点项目是一个参考架构。三个扩展可以将其部署到实际应用中：

1. **更换分词器。** 使用BPE（例如`tiktoken.get_encoding("cl100k_base")`）。词汇表大小从65跃升到约50,000。模型容量需要相应扩展以补偿。
2. **在更大的语料库上训练。** 使用`OpenWebText`或`fineweb-edu`（HuggingFace）。在单个A100上，125M参数的GPT处理100亿个标记需要约24小时。
3. **添加RoPE + KV缓存 + Flash Attention。** 下面的练习将引导你逐步实现每个功能。

最终得到一个能生成流畅英语的125M参数GPT。不是前沿模型。但相同的代码路径——只是规模更大——正是Karpathy、EleutherAI和艾伦研究所（Allen Institute）在2026年用于训练研究检查点的方法。

## 发布它

参见`outputs/skill-transformer-review.md`。该技能评估了从零开始构建的transformer实现，检查了所有13节课内容的正确性。

## 练习

1. **简单。** 运行`code/main.py`。验证你训练的模型在最后一步的验证损失是否低于2.0。将`max_steps`从2000改为5000——验证损失是否持续改善？
2. **中等。** 用RoPE替换学习到的位置嵌入。将旋转应用于`MultiHeadAttention`内部的Q和K。训练并验证验证损失至少同样低。
3. **中等。** 在采样循环中实现KV缓存。使用和不使用缓存生成500个标记。在笔记本电脑上，时钟时间应提高5-20倍。
4. **困难。** 为模型添加第二个头，预测下一个标记（MTP — 来自DeepSeek-V3的多标记预测）。联合训练。这有帮助吗？
5. **困难。** 将每个块的单一FFN替换为4专家MoE。路由器（Router）+ top-2路由。查看在匹配的活跃参数下验证损失如何变化。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| nanoGPT | "Karpathy的教程仓库" | 最小化的仅解码器transformer训练代码，约300行；规范参考。 |
| tinyshakespeare | "标准玩具语料库" | 约1.1 MB的文本；自2015年以来每个字符级语言模型教程都使用它。 |
| 绑定嵌入（Tied embeddings） | "共享输入/输出矩阵" | 语言模型头部权重 = 标记嵌入矩阵的转置；节省参数，提高质量。 |
| bf16自动混合精度（bf16 autocast） | "训练精度技巧" | 在bf16中运行前向/反向传播，保持优化器状态为fp32；自2021年起的标准。 |
| 梯度裁剪（Gradient clipping） | "阻止峰值" | 将全局梯度范数限制在1.0；防止训练崩溃。 |
| 余弦学习率调度（Cosine LR schedule） | "2020年后默认" | 学习率线性上升（预热）然后以余弦形状衰减到峰值的10%。 |
| 模型FLOP利用率（MFU） | "模型FLOP利用率" | 实际达到的FLOPs / 理论峰值；2026年，40%密集型、30% MoE是强表现。 |
| 验证损失（Val loss） | "保留集损失" | 在模型从未见过的数据上的交叉熵；过拟合检测器。 |

## 延伸阅读

- [《带注释的Transformer》（哈佛NLP）](https://nlp.seas.harvard.edu/annotated-transformer/) — 经典的带注释实现。