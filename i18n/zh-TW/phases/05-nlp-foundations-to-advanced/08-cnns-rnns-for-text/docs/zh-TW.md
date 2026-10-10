# 文字用的 CNN 與 RNN

> 卷積（convolution）學會 n-gram。循環會記住。兩者都被注意力（attention）取代。在受限的硬體上，兩者仍然要緊。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3 · 11 (PyTorch Intro), Phase 5 · 03 (Word Embeddings), Phase 4 · 02 (Convolutions from Scratch)
**Time:** ~75 minutes

## The Problem｜問題

TF-IDF 和 Word2Vec 產出的是扁平向量，不理會詞序。建在它們上面的分類器（classifier）分不出 `dog bites man` 和 `man bites dog`。詞序有時才是訊號。

transformer 出現之前，有兩族架構填上這個缺口。

**文字用的卷積網路（TextCNN）。** 在 word embedding 的序列上做一維卷積。寬度 3 的濾波器（filter）是一個可學習的三元 n-gram 偵測器：它橫跨三個詞，輸出一個分數。疊不同寬度（2、3、4、5）來偵測多尺度的樣式。最大池化成固定大小的表示。扁平、平行、快。

**循環神經網路（recurrent neural network：RNN、LSTM、GRU）。** 一次處理一個 token，維持一個把資訊往前帶的隱藏狀態（hidden state）。循序、帶著記憶、輸入長度有彈性。從 2014 年到 2017 年主導序列建模，然後注意力出現了。

這一課把兩者都做出來，再點名那個催生注意力的失敗。

## The Concept｜核心概念

**TextCNN**（Kim，2014）。token 先做成 embedding。寬度 `k` 的一維卷積，把濾波器滑過連續 `k` 個 embedding，產出特徵圖（feature map）。對那張圖做全域最大池化（global max-pooling），挑出最強的活化。把幾種濾波器寬度的最大池化輸出接起來。送進分類器頭。

它為什麼行。濾波器是可學習的 n-gram。最大池化與位置無關，所以「not good」在評論開頭或中間都會觸發同一個特徵（feature）。三種寬度、每種 100 個濾波器，就是 300 個學來的 n-gram 偵測器。訓練是平行的；沒有循序依賴。

**RNN。** 在每個時間步 `t`，隱藏狀態是 `h_t = f(W * x_t + U * h_{t-1} + b)`。`W`、`U`、`b` 跨時間共用。時間 `T` 的隱藏狀態是整個前綴的摘要。分類時，在 `h_1 ... h_T` 上池化（最大、平均，或最後一個）。

普通 RNN 會遇到梯度消失問題（vanishing gradient）。**LSTM** 加上閘門（gate），決定忘掉什麼、存什麼、輸出什麼，讓梯度在長序列上穩得住。**GRU** 把 LSTM 簡化成兩個閘門；參數較少，表現相近。

**雙向 RNN（bidirectional RNN）** 一個往前、一個往後，再把隱藏狀態接起來。每個 token 的表示同時看見左右脈絡。標記任務少不了它。

```figure
rnn-unroll
```

## Build It｜動手實作

### 步驟 1：PyTorch 裡的 TextCNN

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

`transpose(1, 2)` 把 `[batch, seq_len, embed_dim]` 重排成 `[batch, embed_dim, seq_len]`，因為 `nn.Conv1d` 把中間那一軸當成通道（channel）。池化後的輸出大小固定，跟輸入長度無關。

### 步驟 2：LSTM 分類器

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

在序列上做最大池化，不要只取最後狀態。分類時，最大池化通常贏過取最後一個隱藏狀態，因為長序列末端的資訊容易主導最後狀態。

### 步驟 3：梯度消失示範（直覺）

沒有閘門的普通 RNN 學不會長距離依賴。看一個玩具任務：預測 token `A` 是否在序列的任何地方出現過。如果 `A` 在位置 1，序列有 100 個 token，損失的梯度必須穿過循環權重的 99 次乘法往回流。權重小於 1，梯度就消失。大於 1，就爆炸。

```python
def vanishing_gradient_sim(seq_len, recurrent_weight=0.9):
    import math
    return math.pow(recurrent_weight, seq_len)


# At weight=0.9 over 100 steps:
#   0.9 ^ 100 ≈ 2.7e-5
# The gradient from step 100 to step 1 is effectively zero.
```

LSTM 用**細胞狀態（cell state）**修這件事：它以加法穿過網路。遺忘閘門（forget gate）會用乘法縮放它，但梯度仍沿著那條通路流。GRU 用較少參數做類似的事。兩者都能讓 100 步以上的序列訓練得穩。

### 步驟 4：為什麼這仍然不夠

就算有 LSTM，三個問題還在。

1. **序列瓶頸。** 在長度 1000 的序列上訓練 RNN，需要 1000 步串行的前向傳遞和反向傳遞。無法沿時間平行。
2. **編碼器－解碼器裡固定大小的脈絡向量。** 解碼器只看得到編碼器最後的隱藏狀態，整段輸入被壓進那一個向量。長輸入會丟掉細節。第 09 課直接講這個。
3. **遠距離依賴的準確率（accuracy）天花板。** LSTM 打得過普通 RNN，但要把特定資訊傳過 200 步以上仍然吃力。

注意力把三個都解決了。transformer 整個丟掉循環。第 10 課是轉折。

## Use It｜實際應用

PyTorch 的 `nn.LSTM`、`nn.GRU` 和 `nn.Conv1d` 可以直接上正式環境。訓練程式是標準的。

Hugging Face 交付預訓練 embedding，你把它接成輸入層：

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

什麼時候用、要對上約束：

- **邊緣／在裝置（device）上推論（inference）。** 用 GloVe embedding 的 TextCNN，比 transformer 小 10 到 100 倍。部署目標是手機的話，這就是適合的技術組合。
- **串流／逐筆進來的分類。** RNN 一次處理一個 token；transformer 需要整段序列。即時進來的文字，LSTM 仍然贏。
- **拿來當基準模型（baseline）的小模型。** 新任務上快速迭代。在 CPU 上 5 分鐘就能訓練一個 TextCNN。
- **資料有限的序列標記。** BiLSTM-CRF（第 06 課）對 1000 到 1 萬句標好的句子，仍是正式環境等級的命名實體辨識（named entity recognition）架構。

其他全部交給 transformer。

## Ship It｜交付成果

存成 `outputs/prompt-text-encoder-picker.md`：

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

## Exercises｜練習

1. **簡單。** 在一份三類的玩具資料集（dataset）上訓練 TextCNN（資料你自己編）。驗證濾波器寬度 (2, 3, 4) 的平均 F1 贏過單一寬度 (3)。
2. **中等。** 為 LSTM 分類器實作最大池化、平均池化，以及最後狀態池化。在一份小資料集上比較；寫下哪一種池化贏，並假設為什麼。
3. **困難。** 做一個 BiLSTM-CRF 的命名實體辨識標註器（把第 06 課和這一課合起來）。在 CoNLL-2003 上訓練。和第 06 課只有 CRF 的基準模型比，也和 BERT fine-tune 比。回報訓練時間、記憶體（memory）和 F1。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| TextCNN | 給文字用的 CNN | 在 word embedding 上疊一維卷積，再做全域最大池化（global max-pooling）。Kim（2014）。 |
| RNN | 循環網路 | 每個時間步更新隱藏狀態：`h_t = f(W x_t + U h_{t-1})`。 |
| LSTM | 有閘門的 RNN | 加上輸入閘門、遺忘閘門、輸出閘門，以及細胞狀態。長序列也能訓練得穩。 |
| GRU | 較簡單的 LSTM | 兩個閘門，不是三個。準確率相近，參數較少。 |
| 雙向 | 兩個方向 | 向前和向後的 RNN 接起來。每個 token 都看見自己脈絡的兩邊。 |
| 梯度消失 | 訓練訊號死掉 | 普通 RNN 反覆乘上小於 1 的權重，早期步驟的梯度實質上變成零。 |

## Further Reading｜延伸閱讀

- [Kim, Y. (2014). Convolutional Neural Networks for Sentence Classification](https://arxiv.org/abs/1408.5882) ——TextCNN 論文。八頁。好讀。
- [Hochreiter, S. and Schmidhuber, J. (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) ——LSTM 論文。清楚得意外。
- [Olah, C. (2015). Understanding LSTM Networks](https://colah.github.io/posts/2015-08-Understanding-LSTMs/) ——讓 LSTM 變得人人看得懂的那些圖。
