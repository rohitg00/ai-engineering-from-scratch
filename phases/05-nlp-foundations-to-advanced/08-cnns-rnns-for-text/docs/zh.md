# 用于文本的 CNN 和 RNN

> 卷积学习 n-grams。循环记忆。两者都被 attention 取代。但两者在受限硬件上仍然重要。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 3 · 11（PyTorch 入门），阶段 5 · 03（词嵌入），阶段 4 · 02（从零实现卷积）
**时间：** ~75 分钟

## 问题

TF-IDF 和 Word2Vec 生成忽略词序的平面向量。基于它们构建的分类器无法区分 `dog bites man` 和 `man bites dog`。词序有时携带着信号。

在 transformer 出现之前，两个架构家族填补了这个空白。

**用于文本的卷积网络（TextCNN）。** 在词嵌入序列上应用 1D 卷积。宽度为 3 的过滤器是一个可学习的 trigram 检测器：它跨越三个词并输出一个分数。堆叠不同的宽度（2、3、4、5）以检测多尺度模式。最大池化到固定大小的表示。平坦、并行、快速。

**循环网络（RNN、LSTM、GRU）。** 一次处理一个 token，维护一个向前传递信息的隐藏状态。顺序执行、有记忆、输入长度灵活。从 2014 年到 2017 年主导了序列建模，然后 attention 出现了。

本课构建这两种架构，然后指出激发 attention 的失败。

## 概念

**TextCNN**（Kim, 2014）。Token 被嵌入。一个宽度为 `k` 的 1D 卷积在连续的 `k`-gram 嵌入上滑动过滤器，生成特征图。对该图进行全局最大池化，选取最强激活。将多个过滤器宽度的最大池化输出拼接起来。送入分类头。

为什么有效。一个过滤器是一个可学习的 n-gram。最大池化是位置不变的，因此 "not good" 在评论的开头或中间都会触发相同的特征。三个过滤器宽度，每个 100 个过滤器，给你 300 个可学习的 n-gram 检测器。训练是并行的；没有顺序依赖。

**RNN。** 在每个时间步 `t`，隐藏状态 `h_t = f(W * x_t + U * h_{t-1} + b)`。跨时间共享 `W`、`U`、`b`。时间 `T` 的隐藏状态是整个前缀的摘要。对于分类，在 `h_1 ... h_T` 上池化（最大、均值或最后一个）。

普通 RNN 存在梯度消失问题。**LSTM** 添加了决定遗忘什么、存储什么和输出什么的门，稳定了长序列的梯度。**GRU** 将 LSTM 简化为两个门；性能相似但参数更少。

**双向 RNN** 运行一个前向 RNN 和一个后向 RNN，拼接隐藏状态。每个 token 的表示既看到左侧也看到右侧上下文。对标任务必要。

```figure
rnn-unroll
```

## 开始构建

### 第 1 步：PyTorch 中的 TextCNN

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

`transpose(1, 2)` 将 `[batch, seq_len, embed_dim]` 重塑为 `[batch, embed_dim, seq_len]`，因为 `nn.Conv1d` 将中间轴视为通道。无论输入长度如何，池化输出都是固定大小的。

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

对序列进行最大池化，而非取最后一个状态池化。对于分类，最大池化通常优于取最后一个隐藏状态，因为长序列末尾的信息往往主导最后一个状态。

### 第 3 步：梯度消失演示（直觉）

没有门控的普通 RNN 无法学习长距离依赖。考虑一个玩具任务：预测 token `A` 是否出现在序列中的任何位置。如果 `A` 在位置 1，而序列有 100 个 token，损失函数的梯度必须经过 99 次循环权重的乘法才能回传。如果权重小于 1，梯度消失；如果大于 1，梯度爆炸。

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# 在 weight=0.9、100 步的情况下：
#   0.9 ^ 100 ≈ 2.7e-5
# 从第 100 步到第 1 步的梯度实际上为零。
```

LSTM 通过一个**细胞状态**来解决这个问题，该状态仅通过加法交互在网络中传递（遗忘门对其做乘法缩放，但梯度仍然沿着"高速公路"流动）。GRU 用更少的参数做类似的事情。两者都能让你在 100+ 步的序列中稳定训练。

### 第 4 步：为什么这仍然不够

即使有了 LSTM，三个问题仍然存在。

1. **顺序瓶颈。** 在长度为 1000 的序列上训练 RNN 需要 1000 次串行前向/后向步骤。无法跨时间并行化。
2. **编码器-解码器设置中的固定大小上下文向量。** 解码器只看到编码器的最终隐藏状态，压缩了整个输入。长输入会丢失细节。第 09 课直接介绍这个问题。
3. **远距离依赖准确率上限。** LSTM 优于普通 RNN，但仍然难以在 200+ 步中传递特定信息。

Attention 解决了所有三个问题。Transformer 完全去掉了循环。第 10 课是转折点。

## 使用现成工具

PyTorch 的 `nn.LSTM`、`nn.GRU` 和 `nn.Conv1d` 已可投入生产。训练代码是标准的。

Hugging Face 提供了预训练 embeddings，你可以将其作为输入层插入：

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

在约束条件下使用时的检查清单。

- **边缘/设备端推理。** 使用 GloVe embeddings 的 TextCNN 比 transformer 小 10-100 倍。如果你的部署目标是手机，这就是技术栈。
- **流式/在线分类。** RNN 一次处理一个 token；transformer 需要完整的序列。对于实时传入的文本，LSTM 仍然胜出。
- **用作基线的微型模型。** 在新任务上快速迭代。在 CPU 上 5 分钟训练一个 TextCNN。
- **数据有限的序列标注。** BiLSTM-CRF（第 06 课）仍是 1k-10k 标注句子的生产级 NER 架构。

其他所有情况都使用 transformer。

## 交付

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

1. **简单。** 在三类玩具数据集（你自己创造数据）上训练 TextCNN。验证过滤器宽度（2、3、4）在平均 F1 上优于单一宽度（3）。
2. **中等。** 为 LSTM 分类器实现最大池化、均值池化和最后一个状态池化。在小型数据集上比较；记录哪种池化胜出并假设原因。
3. **困难。** 构建 BiLSTM-CRF NER tagger（结合第 06 课和本课）。在 CoNLL-2003 上训练。与第 06 课的纯 CRF 基线和 BERT 微调进行比较。报告训练时间、内存和 F1。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| TextCNN | 用于文本的 CNN | 词嵌入上的 1D 卷积堆叠加全局最大池化。Kim (2014)。 |
| RNN | 循环网络 | 每个时间步更新的隐藏状态：`h_t = f(W x_t + U h_{t-1})`。 |
| LSTM | 门控 RNN | 添加输入/遗忘/输出门 + 细胞状态。在长序列中稳定训练。 |
| GRU | 更简单的 LSTM | 两个门代替三个。相似准确率，更少参数。 |
| Bidirectional | 双向 | 前向 + 后向 RNN 拼接。每个 token 看到其上下文的双侧。 |
| Vanishing gradient | 训练信号消失 | 普通 RNN 中连续乘以 <1 的权重使早期梯度的梯度实际上变为零。 |

## 延伸阅读

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882) —— TextCNN 论文。八页。易读。
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) —— LSTM 论文。出乎意料地清晰。
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) —— 使 LSTM 对所有人都可理解的图表。
