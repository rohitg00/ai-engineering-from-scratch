# CNNs and RNNs for Text

> 卷积学习n-gram。反复记住。两者都被注意力所取代。两者在受限的硬件上仍然很重要。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段3 · 11（PyTorch简介）、阶段5 · 03（文字嵌入）、阶段4 · 02（从头开始的卷积）
** 时间：** ~75分钟

## The Problem

TF-IDF和Word 2 Vec产生了忽略词序的平坦载体。基于它们的分类器无法区分“狗咬人”和“人咬人”。词序有时会携带信号。

在变压器出现之前，两个系列的架构填补了这一空白。

** 文本卷积网络（TextCNN）。**对单词嵌入序列应用1D卷积。宽度为3的过滤器是一个可学习的三元组检测器：它跨越三个单词并输出分数。堆叠不同的宽度（2，3，4，5）来检测多尺度模式。最大池到固定大小的表示。平的、平行的、快的。

** 循环网络（RNN、LSTM、GRU）。**一次处理一个令牌，保持向前传输信息的隐藏状态。连续、承载内存、灵活的输入长度。2014年至2017年主导序列建模，随后引起了关注。

这一课建立了两者，然后列出了激发注意力的失败。

## The Concept

![TextCNN filters vs. RNN hidden state unrolling](./assets/cnn-rnn.svg)

** 文本CNN **（Kim，2014）。代币被嵌入。宽度' k ' 1D卷积将过滤器滑动到连续的' k '-克嵌入上，产生特征地图。该地图上的全球最大池选择最强的激活。将多个过滤器宽度的最大池输出级联。输送到分类器头。

为什么它有效。过滤器是一个可学习的n-gram。最大池化是位置不变的，因此“不好”在评论的开始或中间触发相同的功能。三个过滤器宽度，每个过滤器100个，为您提供300个学习的n-gram检测器。训练是平行的;没有顺序依赖性。

**RNN。**在每个时间步' t '，隐藏状态' h_t = f（W * x_t + U * h_{t-1} + b）'。跨越时间分享“W”、“U”、“b”。时间' T '的隐藏状态是整个前置的摘要。对于分类，请跨' h_1. h_T '（最大值、平均值或最后值）。

普通RNN的梯度消失。**LSTM** 添加了决定忘记什么、存储什么和输出什么的门，通过长序列稳定梯度。**GRU** 将LSTM简化为两个门;使用更少的参数执行类似的功能。

** 双向RNN ** 向前运行一个RNN，向后运行另一个RNN，连接隐藏状态。每个令牌的表示都看到左上下文和右上下文。对于标记任务至关重要。

## Build It

### Step 1: TextCNN in PyTorch

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

'转置（1，2）'将'[batch，seq_len，embed_dim]'重塑为'[batch，embed_dim，seq_len]'因为'将中间轴视为通道。无论输入长度如何，池输出都是固定大小的。

### Step 2: LSTM classifier

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

序列上的最大池，而不是最后状态池。对于分类来说，最大池化通常优于采用最后一个隐藏状态，因为长序列末尾的信息往往会主导最后一个状态。

### Step 3: the vanishing gradient demo (intuition)

没有门控的普通RNN无法学习长期依赖关系。考虑一个玩具任务：预测标记“A”是否出现在序列中的任何地方。如果“A”位于位置1并且序列长100个令牌，则损失的梯度必须通过循环权重的99次相乘回流。如果权重小于1，则梯度消失。如果超过1，就会爆炸。

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# At weight=0.9 over 100 steps:
#   0.9 ^ 100 ≈ 2.7e-5
# The gradient from step 100 to step 1 is effectively zero.
```

LSTM通过 ** 单元状态 ** 来解决这个问题，该状态只通过添加性相互作用贯穿网络（忘记门以乘数方式扩展它，但梯度仍然沿着“高速公路”流动）。GROUP用更少的参数做类似的事情。两者均可通过100多个步骤为您提供稳定的训练。

### Step 4: why this still was not enough

即使使用LSTM也存在三个问题。

1. ** 顺序瓶颈。**在长度为1000的序列上训练RNN需要1000个连续的向前/向后步骤。无法跨时间并行。
2. ** 编码器-解码器设置中的固定大小上下文载体。**解码器仅看到编码器的最终隐藏状态，该状态在整个输入上被压缩。长输入会失去细节。第09课直接涵盖了这一点。
3. ** 距离依赖准确性上限。** LSTM的性能优于普通RNN，但仍难以在200多个步骤中传播特定信息。

注意力解决了这三个问题。变形金刚完全降低了复发率。第10课是重点。

## Use It

PyTorch的“nn.LSTM”、“nn.GRU”和“nn.Conv1d”已可生产。培训代码是标准的。

Hugging Face发布您插入作为输入层的预训练嵌入：

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

当它适合限制时，就可以选择检查表。

- ** 边缘/设备上推断。**具有GloVe嵌入的文本CNN比Transformer小10- 100倍。如果您的部署目标是手机，那么这就是堆栈。
- ** 流媒体/在线分类。** RNN一次处理一个令牌;转换器需要完整序列。对于实时输入的文本，LSTM仍然获胜。
- ** 基线的微型模型。**新任务的快速迭代。在中央处理器上5分钟内训练文本CNN。
- ** 数据有限的序列标签。** BiLSTM-CF（第06课）仍然是用于1 k-10 k标签句子的生产级NER架构。

其他一切都交给了Transformer。

## Ship It

另存为“输出/prompt-text-encoder-picker.md”：

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

## Exercises

1. ** 简单。**在3类玩具数据集上训练文本CNN（您发明了数据）。验证过滤器宽度（2，3，4）在F1上是否优于单个宽度（3）。
2. ** 中等。**为LSTM分类器实现最大池、平均池和最后状态池。在一个小数据集上进行比较;记录哪个池会获胜并假设原因。
3. ** 很难。**构建BiLSTM-CF NER标记器（结合第06课和本课）。在CoNLL-2003上训练。与第06课中的单独CFR基线和BERT微调进行比较。报告训练时间、记忆力和F1。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| TextCNN | CNN文本 | 具有全局最大池的单词嵌入上的1D卷积堆栈。Kim（2014）。 |
| RNN | 经常性净 | 每个时间步更新隐藏状态：' h_t = f（W x_t + U h_{t-1}）'。 |
| LSTM | 门控RNN | 添加输入/遗忘/输出门+单元状态。通过长序列稳定训练。 |
| GRU | 更简单的LSTM | 两个门而不是三个。准确性相似，参数更少。 |
| 双向 | 两个方向 | 前向+后向RNN级联。每个代币都看到其上下文的两面。 |
| 消失梯度 | 训练信号消失 | 在普通RNN中重复乘以<1的权重会使早期步骤的梯度实际上为零。 |

## Further Reading

- [Kim、Y.（2014）。用于句子分类的卷积神经网络]（https：//arxiv.org/ab/1408.5882）-文本CNN论文。八页。可读。
- [Hochreiter，S.和Schmidhuber，J.（1997）。长短期记忆]（https：//www.bioinf.jku.at/publications/older/2604.pdf）-LSTM论文。出乎意料的清醒。
- [Olah、C.（2015）。了解LSTM网络]（https：//colah.github.io/posts/2015-08-Understanding-LSTMs/）-让每个人都可以访问LSTM的图表。
