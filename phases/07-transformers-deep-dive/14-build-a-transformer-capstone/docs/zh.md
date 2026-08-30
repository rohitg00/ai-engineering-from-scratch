# Build a Transformer from Scratch — The Capstone

> 十三课。一个模型。没有捷径。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段7 · 01至13。不要跳过。
** 时间：** ~120分钟

## The Problem

你读过每一份报纸。你已经实现了注意力，多头分割，位置编码，编码器和解码器块，BERT和GPT损失，MoE，KV缓存。现在让他们一起完成一项真正的任务。

顶点：在字符级语言建模任务上训练一个小型的仅解码器Transformer端到端。上面写着莎士比亚。它产生了新的莎士比亚。它足够小，可以在10分钟内通过笔记本电脑进行训练。交换更大的数据集和更长的训练可以让您获得真正的LM，这是足够正确的。

这是课程的“nanoGPT”。它不是原创的- Karpathy的2023年nanoGPT教程是每个学生至少写一次的参考实现。我们提升形状并围绕我们所涵盖的内容重新调整它。

## The Concept

![Transformer-from-scratch block diagram](../assets/capstone.svg)

建筑，注释：

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

### What we ship

- ' GPTSwitch '-配置所有超参数的一个地方。
- “MultiHeadAttention”-因果、批量处理，可选Flash风格路径（PyTorch的“scale_dot_Products_attention”）。
- “SwiGLUFFN”--现代FFN。
- “Block”-规范前、剩余包裹的注意力+ FFN。
- “GPT”-嵌入、堆叠块、LM头、generate（）。
- 使用AdamW、cos LR、梯度剪裁训练循环。
- 莎士比亚文本的字符级符号化器。

### What we don't ship

- RoPE -在第04课中概念性地实现。为了简单起见，我们在这里使用学习到的位置嵌入。这些练习要求您更换RoPE。
- 生成过程中的KV缓存-每个生成步骤都会重新计算完整前置码的注意力。更慢但更简单。这些练习要求您添加KV缓存。
- Flash Attention -如果输入匹配，PyTorch 2.0+会自动调度;我们使用“F. scale_dot_Products_attention”。
- MoE -每个区块单一FFN。您在第11课中看过MoE。

### Target metrics

在Mac M2笔记本电脑上，4层、4头、d_型号=128 GPT在' tinyshakespeare. https '上训练了2，000步：

- 训练损失在大约6分钟内从~4.2（随机）收敛到~1.5。
- 抽样的输出看起来像日历形状：出现了古老的单词、断点、“ROMEO：”等专有名称。
- Val损失（保留文本的最后10%）密切跟踪训练损失;在此规模/预算下没有过度匹配。

## Build It

本课使用PyTorch。安装“torch”（中央处理器构建可以）。请参阅' code/main.py '。该脚本处理：

- 如果丢失，则下载' tinyshakespeare. text '（或阅读本地副本）。
- 字节级字符标记化器。
- Train/val分裂为90/10。
- Training loop with bf16 autocast on supported hardware.
- 培训完成后采样。

### Step 1: data

```python
text = open("tinyshakespeare.txt").read()
chars = sorted(set(text))
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for c, i in stoi.items()}
encode = lambda s: [stoi[c] for c in s]
decode = lambda xs: "".join(itos[x] for x in xs)
```

65 独特的人物。词汇量很小。适合4字节vocab_size。没有BPE，没有象征性戏剧。

### Step 2: model

请参阅' code/main.py '。该区块是第05课的教科书-预规范、RMSNorm、SwiGLU、因果MHA。4/4/128的参数计数：~ 800 K。

### Step 3: training loop

获取随机一批长度为256个令牌窗口。性新逐一移动的交叉熵。向后。AdamW步骤。Log.重复.

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

### Step 4: sample

如果出现提示，反复转发，从top-p logits中采样，添加并继续。500个代币后停止。

### Step 5: read the output

2，000步后：

```
ROMEO:
Away and mild will not thy friend, that thou shalt wit:
The chief that well shame and hath been his friends,
...
```

不是莎士比亚。但呈长方形。约80万参数和笔记本电脑6分钟的明显胜利。

## Use It

这个顶石是一个参考架构。三个扩展将其运送到真实的东西：

1. ** 交换标记器。**使用BPE（例如' tiktoken.get_encoding（' cl100k_base '）'）。Vocab大小从65跃升至~ 50，000。模型容量需要扩大规模来弥补。
2. ** 在更大的数据库上训练。**使用“OpenWebtext”或“fineweb-edu”（HuggingFace）。对于125 M参数GPT，单个A100上的10 B代币需要约24小时。
3. ** 添加RoPE + KV缓存+ Flash Attention。**下面的练习将引导您完成每个练习。

这最终成为一个125 M参数GPT，可以生成流利的英语。不是前沿模型。但Karpathy、EleutherAI和Allen Institute在2026年训练研究检查站时使用的代码路径相同--只是更大。

## Ship It

请参阅“输出/skill-transformer-review.md”。该技能审查从头开始的变形器实现在所有13个之前课程中的正确性。

## Exercises

1. ** 简单。**运行'代码/main.py '。验证您的训练模型的最后一步验证损失是否低于2.0。将“max_steps”从2，000更改为5，000-val loss是否持续改善？
2. ** 中等。**用RoPE替换学习的位置嵌入。在“MultiHeadAttention”中对Q和K应用旋转。训练并验证valle损失至少同样低。
3. ** 中等。**在采样循环中实现KV缓存。生成500个带和不带缓存的令牌。笔记本电脑上的闹钟应提高5-20倍。
4. ** 很难。**将第二个头部添加到预测下一个加一代币的模型中（来自DeepSeek-V3的RTP-多代币预测）。共同训练。有帮助吗？
5. ** 很难。**用4位专家MoE替换每个区块的单个FFN。路由器+前2路由。查看匹配的活动参数下val loss如何变化。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 纳米GPT | “卡帕西的教程回购” | 最小的仅解码器Transformer训练代码，~300;规范参考。 |
| 小莎士比亚 | “标准玩具库” | ~1.1 MB文本;自2015年以来的每个字符LM教程都使用它。 |
| 捆绑嵌入 | “共享输入/输出矩阵” | LM头部权重=令牌嵌入矩阵的转置;节省参数，提高质量。 |
| bf 16自动广播 | “训练精准技巧” | 在bf 16中向前/向后运行，将优化器状态保持在fp 32中;自2021年起成为标准。 |
| 渐变剪裁 | “停止尖峰” | 全球毕业生标准上限为1.0;防止培训爆发。 |
| Cosine LR时间表 | “2020+默认” | LR线性上升（热身），然后呈cos形衰减至峰值的10%。 |
| MFU | “模型FLOP利用率” | 达到FLOPs /理论峰值; 2026年40%密集、30% MoE强劲。 |
| Val损失 | “持续的损失” | 模型从未见过的数据上的交叉信息;过适合检测器。 |

## Further Reading

- [The注释Transformer（哈佛NLP）]（https：//nlp.seas.harvard.edu/annotated-transformer/）-经典的注释实现。
