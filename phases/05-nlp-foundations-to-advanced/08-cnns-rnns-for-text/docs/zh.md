# 08 · 用于文本的 CNN 与 RNN

> 卷积学习 n-gram，循环网络负责记忆。两者都被注意力机制取代，但在算力受限的硬件上，两者依然重要。

**类型：** 实践构建
**语言：** Python
**前置：** 阶段 3 · 11（PyTorch 入门）、阶段 5 · 03（词嵌入）、阶段 4 · 02（从零实现卷积）
**时长：** 约 75 分钟

## 问题所在

「TF-IDF（词频-逆文档频率）」和 Word2Vec 产生的是忽略词序的扁平向量。基于它们构建的分类器无法区分 `dog bites man`（狗咬人）和 `man bites dog`（人咬狗）。而词序有时正是承载语义信号的关键。

在 Transformer 出现之前，有两类架构填补了这一空白。

**用于文本的卷积网络（TextCNN）。** 在词嵌入序列上施加一维卷积。一个宽度为 3 的滤波器就是一个可学习的「三元组（trigram）」检测器：它横跨三个词并输出一个分数。堆叠不同宽度（2、3、4、5）的滤波器即可检测多尺度的模式。再通过最大池化得到一个固定大小的表示。整个过程扁平、可并行、速度快。

**循环网络（RNN、LSTM、GRU）。** 逐个处理词元（token），维护一个把信息向前传递的隐藏状态。它具备序列性、记忆性，并能灵活适应不同的输入长度。从 2014 年到 2017 年，它主导了序列建模，直到注意力机制的出现。

本课会同时实现这两者，然后指出促使注意力机制诞生的那个失败之处。

## 核心概念

**TextCNN**（Kim，2014）。词元先被嵌入。一个宽度为 `k` 的一维卷积在嵌入序列上滑动滤波器，逐个扫过连续的 `k`-gram，生成一张特征图（feature map）。在该特征图上做「全局最大池化（global max-pooling）」，挑出最强的激活。把多个滤波器宽度的最大池化输出拼接起来，送入分类头（classifier head）。

它为什么有效。一个滤波器就是一个可学习的 n-gram。最大池化具有位置不变性，因此「not good」无论出现在评论的开头还是中间，都会触发同一个特征。三种滤波器宽度、每种 100 个滤波器，就给了你 300 个学到的 n-gram 检测器。训练是并行的，没有时序上的依赖。

**RNN。** 在每个时间步 `t`，隐藏状态 `h_t = f(W * x_t + U * h_{t-1} + b)`。`W`、`U`、`b` 在所有时间步之间共享。时刻 `T` 的隐藏状态是整个前缀的一个摘要。对于分类任务，则在 `h_1 ... h_T` 上做池化（最大、平均或取最后一个）。

朴素 RNN 会遭遇「梯度消失（vanishing gradient）」。**LSTM（长短期记忆网络）** 增加了若干门，用来决定遗忘什么、存储什么、输出什么，从而在长序列上稳定梯度。**GRU（门控循环单元）** 把 LSTM 简化为两个门，参数更少而表现相近。

**双向 RNN（Bidirectional RNN）** 一个 RNN 正向运行，另一个反向运行，再把两者的隐藏状态拼接起来。每个词元的表示都能同时看到左侧和右侧的上下文。这对标注类任务至关重要。

## 动手构建

### 第 1 步：用 PyTorch 实现 TextCNN

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


class TextCNN(nn.Module):
    def __init__(self, vocab_size, embed_dim, n_classes, filter_widths=(2, 3, 4), n_filters=64, dropout=0.3):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.convs = nn.ModuleList([
            nn.Conv1d(embed_dim, n_filters, kernel_size=k)
            for k in filter_widths
        ])
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(n_filters * len(filter_widths), n_classes)

    def forward(self, token_ids):
        x = self.embed(token_ids).transpose(1, 2)
        pooled = []
        for conv in self.convs:
            c = F.relu(conv(x))
            p = F.max_pool1d(c, c.size(2)).squeeze(2)
            pooled.append(p)
        h = torch.cat(pooled, dim=1)
        return self.fc(self.dropout(h))
```

`transpose(1, 2)` 把 `[batch, seq_len, embed_dim]` 重塑为 `[batch, embed_dim, seq_len]`，因为 `nn.Conv1d` 把中间这一轴当作通道。无论输入长度如何，池化后的输出都是固定大小的。

### 第 2 步：LSTM 分类器

```python
class LSTMClassifier(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_classes, bidirectional=True, dropout=0.3):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True, bidirectional=bidirectional)
        factor = 2 if bidirectional else 1
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(hidden_dim * factor, n_classes)

    def forward(self, token_ids):
        x = self.embed(token_ids)
        out, _ = self.lstm(x)
        pooled = out.max(dim=1).values
        return self.fc(self.dropout(pooled))
```

要在序列上做最大池化，而不是只取最后状态来池化。对于分类任务，最大池化通常优于取最后一个隐藏状态，因为长序列末尾的信息往往会主导最后状态。

### 第 3 步：梯度消失演示（直觉）

不带门控的朴素 RNN 学不会长程依赖。考虑一个玩具任务：预测词元 `A` 是否在序列中的任何位置出现过。如果 `A` 在位置 1，而序列长度为 100 个词元，那么损失产生的梯度必须沿着循环权重的 99 次连乘往回传播。如果权重小于 1，梯度就会消失；如果大于 1，梯度就会爆炸。

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# 当权重为 0.9、经过 100 步时:
#   0.9 ^ 100 ≈ 2.7e-5
# 从第 100 步传回第 1 步的梯度实际上等于零。
```

LSTM 用一个「细胞状态（cell state）」解决了这个问题，该状态贯穿整个网络，且只参与加性的交互（遗忘门会以乘法方式对它进行缩放，但梯度仍能沿着这条「高速公路」流动）。GRU 用更少的参数做了类似的事。两者都能让你在 100 步以上的序列上稳定训练。

### 第 4 步：为什么这仍然不够

即便用上 LSTM，仍有三个问题挥之不去。

1. **序列瓶颈。** 在长度为 1000 的序列上训练 RNN，需要 1000 个串行的前向/反向步骤。无法跨时间维度并行化。
2. **编码器-解码器结构中固定大小的上下文向量。** 解码器只能看到编码器的最后一个隐藏状态，它是整个输入压缩后的产物。长输入会丢失细节。第 09 课会直接讲解这一点。
3. **远程依赖的精度天花板。** LSTM 优于朴素 RNN，但在跨越 200 步以上传播特定信息时仍然吃力。

注意力机制解决了这全部三个问题。Transformer 则彻底抛弃了循环结构。第 10 课就是这个转折点。

## 实际应用

PyTorch 的 `nn.LSTM`、`nn.GRU` 和 `nn.Conv1d` 都已可用于生产环境。训练代码也很标准。

Hugging Face 提供了预训练嵌入，你可以把它作为输入层接进来：

```python
from transformers import AutoModel

encoder = AutoModel.from_pretrained("bert-base-uncased")
for param in encoder.parameters():
    param.requires_grad = False


class BertCNN(nn.Module):
    def __init__(self, n_classes, filter_widths=(2, 3, 4), n_filters=64):
        super().__init__()
        self.encoder = encoder
        self.convs = nn.ModuleList([nn.Conv1d(768, n_filters, kernel_size=k) for k in filter_widths])
        self.fc = nn.Linear(n_filters * len(filter_widths), n_classes)

    def forward(self, input_ids, attention_mask):
        with torch.no_grad():
            out = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        x = out.transpose(1, 2)
        pooled = [F.max_pool1d(F.relu(conv(x)), kernel_size=conv(x).size(2)).squeeze(2) for conv in self.convs]
        return self.fc(torch.cat(pooled, dim=1))
```

「在符合约束时才用」的检查清单。

- **边缘端 / 设备端推理。** 搭配 GloVe 嵌入的 TextCNN 比 Transformer 小 10 到 100 倍。如果你的部署目标是手机，这就是该用的技术栈。
- **流式 / 在线分类。** RNN 一次处理一个词元；Transformer 则需要完整序列。对于实时涌入的文本，LSTM 仍占优势。
- **作为基线的微型模型。** 在新任务上快速迭代。在 CPU 上 5 分钟就能训练出一个 TextCNN。
- **数据有限的序列标注。** 对于 1 千到 1 万句已标注语料，BiLSTM-CRF（第 06 课）仍是生产级的「命名实体识别（NER）」架构。

其余一切都交给 Transformer。

## 交付产物

保存为 `outputs/prompt-text-encoder-picker.md`：

```markdown
---
name: text-encoder-picker
description: Pick a text encoder architecture for a given constraint set.
phase: 5
lesson: 08
---

Given constraints (task, data volume, latency budget, deploy target, compute budget), output:

1. Encoder architecture: TextCNN, BiLSTM, BiLSTM-CRF, transformer fine-tune, or "use a pretrained transformer as a frozen encoder + small head".
2. Embedding input: random init, GloVe / fastText frozen, or contextualized transformer embeddings.
3. Training recipe in 5 lines: optimizer, learning rate, batch size, epochs, regularization.
4. One monitoring signal. For RNN/CNN models: attention mechanism absence means they miss long-range deps; check per-length accuracy. For transformers: fine-tuning collapse if LR too high; check train loss.

Refuse to recommend fine-tuning a transformer when data is under ~500 labeled examples without showing that a TextCNN / BiLSTM baseline has plateaued. Flag edge deployment as needing architecture-before-everything.
```

## 练习

1. **简单。** 在一个 3 分类的玩具数据集上训练 TextCNN（数据由你自己设计）。验证滤波器宽度 (2, 3, 4) 在平均 F1 上优于单一宽度 (3)。
2. **中等。** 为 LSTM 分类器分别实现最大池化、平均池化和取最后状态的池化。在一个小数据集上比较；记录哪种池化胜出，并对原因提出假设。
3. **困难。** 构建一个 BiLSTM-CRF 的 NER 标注器（把第 06 课和本课结合起来）。在 CoNLL-2003 上训练。把它与第 06 课中纯 CRF 的基线、以及一个 BERT 微调模型作对比。报告训练时间、内存占用和 F1。

## 关键术语

| 术语 | 人们怎么说 | 它实际是什么 |
|------|-----------------|-----------------------|
| TextCNN | 用于文本的 CNN | 在词嵌入上叠加一维卷积并做全局最大池化。出自 Kim（2014）。 |
| RNN | 循环网络 | 在每个时间步更新的隐藏状态：`h_t = f(W x_t + U h_{t-1})`。 |
| LSTM | 带门控的 RNN | 增加了输入门 / 遗忘门 / 输出门以及细胞状态。能在长序列上稳定训练。 |
| GRU | 更简单的 LSTM | 用两个门代替三个门。精度相近，参数更少。 |
| Bidirectional（双向） | 双向 | 正向 + 反向 RNN 拼接而成。每个词元都能看到其上下文的两侧。 |
| Vanishing gradient（梯度消失） | 训练信号消亡 | 朴素 RNN 中反复乘以小于 1 的权重，使得早期时间步的梯度实际趋于零。 |

## 延伸阅读

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882) —— TextCNN 的原始论文。八页，易读。
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) —— LSTM 的原始论文。出乎意料地清晰。
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) —— 让 LSTM 变得人人都能理解的那些图解。
