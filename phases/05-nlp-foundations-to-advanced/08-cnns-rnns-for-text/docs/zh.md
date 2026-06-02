# 文本处理中的 CNN 与 RNN（CNNs and RNNs for Text）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 卷积学的是 n-gram，循环负责记忆。两者都被 attention（注意力）超越，但在受限硬件上仍然重要。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3 · 11 (PyTorch Intro), Phase 5 · 03 (Word Embeddings), Phase 4 · 02 (Convolutions from Scratch)
**Time:** ~75 minutes

## 问题（The Problem）

TF-IDF 和 Word2Vec 输出的是扁平向量，忽略了词序。基于它们的分类器无法区分 `dog bites man` 和 `man bites dog`。而词序有时承载着关键信号。

在 transformer 出现之前，有两类架构填补了这个空缺。

**面向文本的卷积网络（TextCNN）。** 在词 embedding 序列上做一维卷积。宽度为 3 的 filter 就是一个可学习的 trigram 检测器：它跨越三个词输出一个分数。叠加不同宽度（2、3、4、5）就能检测多尺度模式。max-pool 到固定大小的表示。结构扁平、并行、快速。

**循环网络（RNN、LSTM、GRU）。** 一次处理一个 token，靠 hidden state 把信息向前传递。顺序、带记忆、输入长度灵活。从 2014 到 2017 主导了序列建模，然后 attention 来了。

本课实现两者，并指出促使 attention 诞生的失败之处。

## 概念（The Concept）

**TextCNN**（Kim, 2014）。token 先做 embedding。宽度为 `k` 的一维卷积在 embedding 序列上滑动，对连续 `k`-gram 输出一个 feature map。在该 map 上做全局 max-pooling，挑出最强激活。把多种 filter 宽度的 max-pool 输出拼接起来，送入分类器头。

它为什么有效。一个 filter 就是一个可学习的 n-gram。max-pooling 是位置无关的，所以「not good」不论出现在评论开头还是中间，都会触发同一个特征。三种 filter 宽度、每种 100 个 filter，等于 300 个学到的 n-gram 检测器。训练可并行，没有时间维上的依赖。

**RNN。** 每个时间步 `t` 的 hidden state 是 `h_t = f(W * x_t + U * h_{t-1} + b)`。`W`、`U`、`b` 跨时间共享。时刻 `T` 的 hidden state 就是整段前缀的摘要。做分类时，对 `h_1 ... h_T` 做池化（max、mean，或取最后一个）。

普通 RNN 会有梯度消失。**LSTM** 加入了门控，决定该忘掉什么、该存什么、该输出什么，让梯度在长序列里保持稳定。**GRU** 把 LSTM 简化成两个门，参数更少而性能相近。

**双向 RNN（Bidirectional RNNs）** 让一个 RNN 正向跑、另一个反向跑，再把 hidden state 拼接。每个 token 的表示同时看到左右上下文。在标注任务里是必备的。

## 动手实现（Build It）

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

`transpose(1, 2)` 把 `[batch, seq_len, embed_dim]` 变成 `[batch, embed_dim, seq_len]`，因为 `nn.Conv1d` 把中间那一维当作 channel。池化后的输出与输入长度无关，是固定大小。

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

对序列做 max-pool，而不是只取最后一个 state。做分类时 max-pooling 通常优于取最后一个 hidden state，因为长序列尾部的信息往往会主导最后那个 state。

### Step 3: 梯度消失演示（直觉版）

没有门控的普通 RNN 学不到长距离依赖。考虑一个玩具任务：判断 token `A` 是否在序列里出现过。如果 `A` 在位置 1，序列长 100，那 loss 的梯度要回流过 99 次循环权重的乘法。权重小于 1，梯度就消失；大于 1，就爆炸。

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# At weight=0.9 over 100 steps:
#   0.9 ^ 100 ≈ 2.7e-5
# The gradient from step 100 to step 1 is effectively zero.
```

LSTM 用一条 **cell state** 来解决：它在网络中只通过加法交互流动（forget gate 会做乘法缩放，但梯度仍可沿这条「高速路」流动）。GRU 用更少的参数实现了类似效果。两者都能让 100+ 步序列的训练保持稳定。

### Step 4: 为什么这还不够

即使有了 LSTM，三个问题依然存在。

1. **顺序瓶颈。** 在长度为 1000 的序列上训练 RNN 需要 1000 次串行的前向 / 反向。无法在时间维上并行。
2. **encoder-decoder 里的固定大小 context vector。** decoder 只看到 encoder 最后一个 hidden state，整段输入被压缩到这一个向量里。长输入会丢失细节。第 09 课会直接讲这个问题。
3. **远距离依赖的精度天花板。** LSTM 比普通 RNN 强，但要把具体信息传过 200+ 步仍然很吃力。

attention 一次解决了三个问题。transformer 干脆把 recurrence 整个扔掉。第 10 课就是这个转折点。

## 用起来（Use It）

PyTorch 的 `nn.LSTM`、`nn.GRU`、`nn.Conv1d` 都已经是生产级的。训练代码是标准写法。

Hugging Face 提供预训练 embedding，可以作为输入层接入：

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

「这个约束下用得上」清单。

- **边缘 / 端侧推理。** 用 GloVe embedding 的 TextCNN 比 transformer 小 10–100 倍。如果部署目标是手机，就用这套。
- **流式 / 在线分类。** RNN 一次处理一个 token；transformer 需要完整序列。对于实时进来的文本，LSTM 仍占优。
- **做基线（baseline）的小模型。** 在新任务上快速迭代。CPU 上 5 分钟能训出一个 TextCNN。
- **数据有限的序列标注。** BiLSTM-CRF（第 06 课）在 1k–10k 标注句子规模下，仍是生产级的 NER 架构。

其他场景统统交给 transformer。

## 上线部署（Ship It）

存为 `outputs/prompt-text-encoder-picker.md`：

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

## 练习（Exercises）

1. **简单。** 在一个三分类玩具数据集上训练 TextCNN（数据自己造）。验证 filter 宽度组合 (2, 3, 4) 在平均 F1 上优于单一宽度 (3)。
2. **中等。** 给 LSTM 分类器实现 max-pool、mean-pool 和 last-state pool 三种池化方式。在小数据集上对比，记录哪个赢，并猜测原因。
3. **困难。** 搭一个 BiLSTM-CRF NER 标注器（结合第 06 课和本课）。在 CoNLL-2003 上训练。和第 06 课的纯 CRF 基线、以及 BERT 微调做对比。报告训练时间、内存与 F1。

## 关键术语（Key Terms）

| 术语 | 一般说法 | 实际含义 |
|------|-----------------|-----------------------|
| TextCNN | 文本 CNN | 在词 embedding 上叠一组一维卷积，再做全局 max-pool。Kim (2014)。 |
| RNN | 循环网络 | 每个时间步更新 hidden state：`h_t = f(W x_t + U h_{t-1})`。 |
| LSTM | 带门的 RNN | 加入 input / forget / output 三个门和一条 cell state。长序列训练稳定。 |
| GRU | 简化版 LSTM | 两个门代替三个。精度相近，参数更少。 |
| Bidirectional | 双向 | 正向 + 反向 RNN 拼接。每个 token 都能看到左右两侧的上下文。 |
| Vanishing gradient | 训练信号衰亡 | 普通 RNN 中反复乘以 <1 的权重，导致早期时间步的梯度趋近于零。 |

## 延伸阅读（Further Reading）

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882) — TextCNN 的原论文。八页。可读性强。
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) — LSTM 的原论文。出乎意料地清晰。
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) — 那些让所有人都看懂 LSTM 的图解。
