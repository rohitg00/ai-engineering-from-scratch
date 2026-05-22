# 用于文本的CNN与RNN

> 卷积学习n-gram。循环网络记忆。两者均已被注意力机制取代，但在硬件受限的场景下仍然重要。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段3·11（PyTorch入门）、阶段5·03（词嵌入）、阶段4·02（从零实现卷积）
**时间：** 约75分钟

## 问题

TF-IDF和Word2Vec生成的平坦向量忽略了词序。基于它们的分类器无法区分 "dog bites man" 和 "man bites dog"。词序有时携带着信号。

在Transformer出现之前，两类架构填补了这一空白。

**文本卷积网络（TextCNN）。** 在词嵌入序列上应用一维卷积。一个宽度为3的滤波器是一个可学习的三词元（trigram）检测器：它跨越三个词并输出一个分数。堆叠不同宽度（2、3、4、5）以检测多尺度模式。通过最大池化得到固定大小的表示。平坦、并行、快速。

**循环网络（RNN、LSTM、GRU）。** 逐个处理词元，维护一个向前传递信息的隐藏状态。顺序处理、具有记忆能力、可处理变长输入。从2014年到2017年主导了序列建模，后来注意力机制出现了。

本课将构建这两种模型，并指出促使注意力机制诞生的缺陷。

## 概念

**TextCNN**（Kim, 2014）。对词元进行嵌入。一个宽度为`k`的一维卷积滤波器在连续的`k`-gram嵌入上滑动，生成一个特征图。对该图进行全局最大池化，选出最强的激活值。将从多个滤波器宽度得到的最大池化输出拼接起来。送入分类器头部。

为什么有效。一个滤波器就是一个可学习的n-gram。最大池化具有位置不变性，因此"not good"无论在评论的开头还是中间都能触发相同的特征。三个滤波器宽度各100个滤波器，你就得到了300个可学习的n-gram检测器。训练是并行的，没有序列依赖。

**RNN。** 在每个时间步`t`，隐藏状态`h_t = f(W * x_t + U * h_{t-1} + b)`。跨时间步共享`W`、`U`、`b`。时间`T`处的隐藏状态是整个前缀的摘要。对于分类任务，对`h_1 ... h_T`进行池化（最大、平均或最后一个）。

普通RNN存在梯度消失问题。**LSTM** 添加了门控，用于决定遗忘什么、存储什么、输出什么，从而在长序列中稳定梯度。**GRU** 将LSTM简化为两个门，性能相似但参数更少。

**双向RNN** 同时运行一个前向RNN和一个后向RNN，将隐藏状态拼接起来。每个词元的表示都能看到左右两边的上下文。对标注任务至关重要。

## 构建

### 第一步：PyTorch中的TextCNN

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

`transpose(1, 2)` 将形状从 `[batch, seq_len, embed_dim]` 转换为 `[batch, embed_dim, seq_len]`，因为 `nn.Conv1d` 将中间轴视为通道。无论输入长度如何，池化后的输出都是固定大小的。

### 第二步：LSTM分类器

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

对序列进行最大池化，而不是取最后一个状态。对于分类任务，最大池化通常优于取最后一个隐藏状态，因为长序列末尾的信息往往主导最后一个状态。

### 第三步：梯度消失演示（直觉理解）

普通RNN没有门控，无法学习长程依赖。考虑一个玩具任务：预测词元`A`是否出现在序列中的任何位置。如果`A`在位置1，而序列长度为100，则损失函数产生的梯度必须反向传播通过99次循环权重乘法。如果权重大于1，梯度会爆炸。

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# 当权重=0.9时，经过100步：
#   0.9 ^ 100 ≈ 2.7e-5
# 从第100步到第1步的梯度实际上为零。
```

LSTM通过一个**细胞状态**解决了这个问题，该状态仅通过加性操作在网络中传递（遗忘门会对其进行乘法缩放，但梯度仍然沿着这条“高速公路”流动）。GRU用更少的参数做了类似的事情。两者都能在100步以上的序列中稳定训练。

### 第四步：为何这仍然不够

即使有了LSTM，三个问题依然存在。

1. **序列瓶颈。** 在长度为1000的序列上训练RNN需要1000个串行的前向/反向步骤。无法跨时间步并行化。
2. **编码器-解码器设置中的固定大小上下文向量。** 解码器只能看到编码器的最终隐藏状态，该状态压缩了整个输入。长输入会丢失细节。第09课会直接讨论这个问题。
3. **远程依赖准确率上限。** LSTM优于普通RNN，但仍然难以在200步以上传播特定信息。

注意力机制解决了所有三个问题。Transformer完全摒弃了循环。第10课是一个转折点。

## 实际应用

PyTorch的`nn.LSTM`、`nn.GRU`和`nn.Conv1d`已可用于生产。训练代码是标准的。

Hugging Face提供了预训练嵌入，你可以将其插入作为输入层：

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

在符合约束条件时使用的检查清单。

- **边缘设备/端侧推理。** 使用GloVe嵌入的TextCNN比Transformer小10-100倍。如果你的部署目标是手机，这是首选方案。
- **流式/在线分类。** RNN一次处理一个词元；Transformer需要完整的序列。对于实时输入的文本，LSTM仍然胜出。
- **用作基线的小模型。** 快速迭代新任务。在CPU上5分钟训练一个TextCNN。
- **数据有限的序列标注。** BiLSTM-CRF（第06课）仍然是生产级命名实体识别架构，适用于1k-10k标注句子。

其他情况都转向Transformer。

## 交付物

保存为 `outputs/prompt-text-encoder-picker.md`：

```markdown
---
name: text-encoder-picker
description: 根据给定的约束条件选择文本编码器架构。
phase: 5
lesson: 08
---

给定约束条件（任务、数据量、延迟预算、部署目标、计算预算），输出：

1. 编码器架构：TextCNN、BiLSTM、BiLSTM-CRF、Transformer微调，或“使用预训练Transformer作为冻结编码器+小型头部”。
2. 嵌入输入：随机初始化、冻结的GloVe/fastText、或上下文化的Transformer嵌入。
3. 5行训练方案：优化器、学习率、批量大小、轮数、正则化。
4. 一个监控信号。对于RNN/CNN模型：缺乏注意力机制意味着它们会错过长程依赖；检查基于长度的准确率。对于Transformer：学习率过高时微调会崩溃；检查训练损失。

当数据量少于约500个标注样本时，拒绝推荐微调Transformer，除非表明TextCNN/BiLSTM基线已无法提升。标记边缘部署需要优先考虑架构。
```

## 练习

1. **简单。** 在一个3类玩具数据集（你自行创建）上训练TextCNN。验证滤波器宽度（2, 3, 4）在平均F1上是否优于单一宽度（3）。
2. **中等。** 为LSTM分类器实现最大池化、平均池化和最后一个状态池化。在小数据集上比较；记录哪种池化胜出并推测原因。
3. **困难。** 构建一个BiLSTM-CRF命名实体识别标注器（结合第06课和本课）。在CoNLL-2003上训练。与第06课中的纯CRF基线以及BERT微调进行比较。报告训练时间、内存和F1。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|------------|----------|
| TextCNN | 用于文本的CNN | 对词嵌入进行一维卷积堆叠，配合全局最大池化。Kim (2014)。 |
| RNN | 循环网络 | 每个时间步更新隐藏状态：`h_t = f(W x_t + U h_{t-1})`。 |
| LSTM | 门控RNN | 增加输入/遗忘/输出门以及一个细胞状态。能在长序列中稳定训练。 |
| GRU | 简化的LSTM | 两个门替代三个。相近的准确率，更少的参数。 |
| 双向 | 两个方向 | 前向+后向RNN拼接。每个词元都能看到其上下文的两侧。 |
| 梯度消失 | 训练信号消失 | 普通RNN中重复乘以小于1的权重会导致早期步骤的梯度几乎为零。 |

## 延伸阅读

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882) — TextCNN论文。八页。可读性强。
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) — LSTM论文。出奇地清晰。
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) — 使LSTM易于理解的图解。