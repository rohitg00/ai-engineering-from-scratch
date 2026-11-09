# 语文的CNN和RNN

> 转变学会 n- 克,回复记忆,两者都被注意力取代,在有限的硬件上都很重要.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 11 (PyTorch Intro), Phase 5 · 03 (Word Embeddings), Phase 4 · 02 (Convolutions from Scratch)
**Time:** ~75 minutes

## 问题

基于这些类别的分类器无法辨别`dog bites man`其他`man bites dog`字序有时带来信号.

在变压器到达之前,两个建筑家族填补了这一差距.

**Convolutional nets for text (TextCNN).**应用1D卷曲在文字嵌入序列上.宽度3的过器是一种可学习的三重符号探测器:它跨越三个词并输出分数. 堆积不同的宽度 (2, 3, 4, 5) 检测多尺度模式. 最大积分到一个固定尺寸的表示. 平坦,平行,快速.

**Recurrent nets (RNN, LSTM, GRU).**处理代币一次,保持一个隐藏状态,将信息传递到前方.序列,存储器,灵活的输入长度.从2014年到2017年,主导序列建模,然后引起了关注.

这一课就建立了两者,然后给出了引起人们注意的失败的名字.

## 概念

**TextCNN**代币被嵌入.`k`连续的缩将光滑到一个光器上`k`总体的最大聚合在该地图上选择最强的激活. 连接多个过器宽度的最大聚合输出. 输入到一个分类器头.

过器是可以学习的n-gram. 极共聚是位置变异性的,所以"不好"在审查的开始或中期会引发相同的功能.三个过器宽度,每个过器都有100个,给你300个学习的n-gram探测器.训练是平行的;没有连续依赖.

**RNN.**每次都会有点`t`隐藏的状态`h_t = f(W * x_t + U * h_{t-1} + b)`分享`W`现在`U`现在`b`时间的隐藏状态.`T`为了分类,集合在`h_1 ... h_T`(最大,平均或最后).

染性质的化物质在化.**LSTM**通过长序列稳定梯度, 通过 向的向, 通过向的向, 通过向的向, 通过向的向, 通过向的向, 通过向的向, 通过向的向, 通过向的向, 通过向的向, 通过向的向, 通过向的向, 通过向的向, 通过向的向, 向的向, 向的向, 向的向, 向的向, 向的向, 向的向,向的向,向的向,向的向,向的向,向的向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,向,,,,,,.**GRU**简化LSTM为两个门;具有较少参数的性能.

**Bidirectional RNNs**运行一个RNN向前和另一个向后,连接隐藏状态.每个代币的表示可以看到左和右的文本.

```figure
rnn-unroll
```

## 建立它

### 步骤1:PyTorch中文字CNN

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

其他`transpose(1, 2)`转型`[batch, seq_len, embed_dim]`为了`[batch, embed_dim, seq_len]`因为`nn.Conv1d`总量输出不论输入长度如何,均为固定尺寸.

### 步骤 2:LSTM分类器

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

为了分类,最大分组通常比取最后一个隐藏状态更好,因为长序列结束的信息往往占据了最后一个状态.

### 步骤3:消失梯度演示 (直觉)

简单的RNN没有门户不能学习长距离的依赖性.`A`任何一个序列中出现.`A`如果重量低于1,梯度会消失.如果超过1,它会爆炸.如果重量低于1,梯度会消失.如果超过1,它会爆炸.

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# At weight=0.9 over 100 steps:
#   0.9 ^ 100 ≈ 2.7e-5
# The gradient from step 100 to step 1 is effectively zero.
```

机器将这个解决**cell state**通过网络运行的只有添加互动 (忘记门乘以其量度,但梯度仍然沿着"高速公路"流动).

### 步骤4:为什么这仍然不够

尽管有3个问题,但即使是LSTM仍然存在.

1. **Sequential bottleneck.**训练一个RNN在长度1000的序列需要1000个连续前后步骤.不能在时间间平行化.
2. **Fixed-size context vector in encoder-decoder setups.**解码器只能看到编码器的最后隐藏状态,压缩到整个输入.长入输入会丢失细节.第09课直接涵盖这一点.
3. **Distant-dependency accuracy ceiling.**虽然LSTM比普通RNN更有效,但仍然在200多个步骤中难以传播特定信息.

变形器完全放弃了复发性. 第10课是旋转.

## 用它

皮托尔奇的`nn.LSTM`现在`nn.GRU`其他`nn.Conv1d`训练规范是标准的.

拥抱面孔船,预训练嵌入式,你插入作为输入层:

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

需要使用时适合限制的清单.

- **Edge / on-device inference.**如果你的部署目标是手机,这是堆.
- **Streaming / online classification.**对于实时输入文本,LSTM仍然获胜.
- **Tiny models for baselines.**在CPU上训练一个TextCNN5分钟.
- **Sequence labeling with limited data.**对于1k-10k标记句子,BiLSTM-CRF (课06) 仍然是一个生产级NER架构.

其他一切都会被转变器所控制.

## 运送它

保存如`outputs/prompt-text-encoder-picker.md`其他:

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

## 运动

1. **Easy.**训练一个 TextCNN 在3类玩具数据集 (你发明数据). 检查过器宽度 (2, 3, 4) 超过平均F1的单个宽度 (3).
2. **Medium.**实现LSTM分类器的最大池,中池和最后状态聚合. 在一个小数据集上进行比较; 文件聚合中获胜的,并假设为什么.
3. **Hard.**建立一个BiLSTM-CRF NER标签 (组合课06和这项).在CoNLL-2003上训练.比较课06的CRF单独基线和BERT细调.报告训练时间,内存和F1.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TextCNN | CNN for text | Stack of 1D convolutions over word embeddings with global max-pool. Kim (2014). |
| RNN | Recurrent net | Hidden state updated at each time step: `h_t = f(W x_t + U h_{t-1})`. |
| LSTM | Gated RNN | Adds input / forget / output gates + a cell state. Trains stably through long sequences. |
| GRU | Simpler LSTM | Two gates instead of three. Similar accuracy, fewer parameters. |
| Bidirectional | Both directions | Forward + backward RNN concatenated. Every token sees both sides of its context. |
| Vanishing gradient | Training signal dies | Repeated multiplication by <1 weights in plain RNNs makes early-step gradients effectively zero. |

## 进一步阅读

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882)文章CNN报纸,八页,可读.
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) LSTM 论文,意外的清晰.
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/)使LSTM可供所有人使用的图表.
