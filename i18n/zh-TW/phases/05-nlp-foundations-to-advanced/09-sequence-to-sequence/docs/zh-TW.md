# 序列到序列模型（sequence-to-sequence）

> 兩個 RNN 假裝自己是翻譯器。它們撞上的瓶頸，就是注意力（attention）存在的理由。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 08 (CNNs + RNNs for Text), Phase 3 · 11 (PyTorch Intro)
**Time:** ~75 minutes

## The Problem｜問題

分類把長度可變的序列對到單一標籤（label）。翻譯把長度可變的序列對到另一段長度可變的序列。輸入和輸出活在不同的詞彙表（vocabulary），可能是不同語言，長度也不保證一樣。

序列到序列架構（Sutskever、Vinyals、Le，2014）用一個故意做簡單的食譜破解了這件事。兩個 RNN。一個讀來源句，產出固定大小的脈絡向量（context vector）。另一個讀那個向量，一個 token 一個 token 生成目標句。和你在第 08 課寫的程式一樣，只是接法不同。

值得學，有兩個理由。第一，脈絡向量的瓶頸是自然語言處理裡最適合教學的失敗。它說明注意力和 transformer 到底好在哪。第二，訓練食譜——teacher forcing、排程取樣、推論（inference）時的集束搜尋（beam search）——仍適用於每個現代生成系統，包含大型語言模型。

## The Concept｜核心概念

**編碼器（encoder）。** 讀來源句的 RNN。它最後的隱藏狀態（hidden state）就是**脈絡向量**——整段輸入的固定大小摘要。據說除了原文本身，什麼都沒丟。

**解碼器（decoder）。** 另一個 RNN，用脈絡向量初始化。每一步拿前一個生成的 token 當輸入，在目標詞彙表上產出一個分布。用取樣或 argmax 挑下一個 token。再餵回去。重複到產出 `<EOS>`，或碰到最大長度。

**訓練：** 解碼器每一步的交叉熵（cross-entropy）損失，沿序列加總。兩個網路都做沿時間的反向傳播（backpropagation through time）。

**Teacher forcing。** 訓練時，解碼器在步驟 `t` 的輸入是位置 `t-1` 的*真實標籤（ground truth）* token，不是解碼器自己前一步的預測。這讓訓練穩得住；沒有它，早期的錯會連鎖，模型永遠學不會。推論時你必須用模型自己的預測，所以訓練和推論的分布永遠有落差。那個落差叫做**暴露偏差（exposure bias）**。

**瓶頸。** 編碼器對來源學到的一切，都得擠進那一個脈絡向量。長句子丟掉細節。稀有詞變模糊。重排（chat noir 對上 black cat）必須背下來，不能算出來。

注意力（第 10 課）讓解碼器去看*每一個*編碼器隱藏狀態，不只是最後一個。整件事的賣點就是這個。

```figure
lstm-gates
```

## Build It｜動手實作

### 步驟 1：編碼器

```python
import torch
import torch.nn as nn


class Encoder(nn.Module):
    def __init__(self, src_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(src_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)

    def forward(self, src):
        e = self.embed(src)
        outputs, hidden = self.gru(e)
        return outputs, hidden
```

`outputs` 的形狀是 `[batch, seq_len, hidden_dim]`——每個輸入位置一個隱藏狀態。`hidden` 的形狀是 `[1, batch, hidden_dim]`——最後一步。第 08 課說「分類時在 outputs 上池化」。這裡我們把最後的隱藏狀態留成脈絡向量，逐位置的輸出先不用。

### 步驟 2：解碼器

```python
class Decoder(nn.Module):
    def __init__(self, tgt_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(tgt_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, tgt_vocab_size)

    def forward(self, token, hidden):
        e = self.embed(token)
        out, hidden = self.gru(e, hidden)
        logits = self.fc(out)
        return logits, hidden
```

解碼器一次叫一步。輸入：一批單 token，以及目前的隱藏狀態。輸出：下一個 token 的詞彙表 logits，以及更新後的隱藏狀態。

### 步驟 3：帶 teacher forcing 的訓練迴圈

```python
def train_batch(encoder, decoder, src, tgt, bos_id, optimizer, teacher_forcing_ratio=0.9):
    optimizer.zero_grad()
    _, hidden = encoder(src)
    batch_size, tgt_len = tgt.shape
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    loss = 0.0
    loss_fn = nn.CrossEntropyLoss(ignore_index=0)

    for t in range(tgt_len):
        logits, hidden = decoder(input_token, hidden)
        step_loss = loss_fn(logits.squeeze(1), tgt[:, t])
        loss += step_loss
        use_teacher = torch.rand(1).item() < teacher_forcing_ratio
        if use_teacher:
            input_token = tgt[:, t].unsqueeze(1)
        else:
            input_token = logits.argmax(dim=-1)

    loss.backward()
    optimizer.step()
    return loss.item() / tgt_len
```

兩個旋鈕值得點名。`ignore_index=0` 跳過填充 token 的損失。`teacher_forcing_ratio` 是每一步用真 token、而不是模型預測的機率。從 1.0 開始（完全 teacher forcing），訓練過程中退火降到約 0.5，縮小暴露偏差造成的落差。

### 步驟 4：推論迴圈（貪婪）

```python
@torch.no_grad()
def greedy_decode(encoder, decoder, src, bos_id, eos_id, max_len=50):
    _, hidden = encoder(src)
    batch_size = src.shape[0]
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    output_ids = []
    for _ in range(max_len):
        logits, hidden = decoder(input_token, hidden)
        next_token = logits.argmax(dim=-1)
        output_ids.append(next_token)
        input_token = next_token
        if (next_token == eos_id).all():
            break
    return torch.cat(output_ids, dim=1)
```

貪婪解碼（greedy decoding）每一步挑機率最高的 token。它會走偏：一旦選定一個 token，就不能收回。**集束搜尋**把前 `k` 條部分序列留著，最後挑分數最高的完整那條。集束寬度 3 到 5 是標準。

### 步驟 5：把瓶頸示範出來

在玩具複製任務上訓練：來源 `[a, b, c, d, e]`，目標 `[a, b, c, d, e]`。把序列加長。看準確率（accuracy）。

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

單一 GRU 隱藏狀態無法無損記住 40 個 token 的輸入。資訊在編碼器的每一步都在，但解碼器只看得到最後狀態。注意力直接修這件事。

## Use It｜實際應用

PyTorch 有 `nn.Transformer`，也有以 `nn.LSTM` 為基礎的序列到序列範本。Hugging Face 的 `transformers` 函式庫（library）交付完整的編碼器－解碼器模型（BART、T5、mBART、NLLB），在數十億個 token 上訓練過。

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

現代編碼器－解碼器用 transformer 換掉 RNN。高層形狀（編碼器、解碼器、一個 token 一個 token 生成）和 2014 年的序列到序列論文一樣。每個區塊裡面的機制不同。

### 什麼時候仍會拿以 RNN 為基礎的序列到序列

新專案幾乎不會。特定例外：

- 串流翻譯：一次吃一個 token，記憶體（memory）有上界。
- 在裝置（device）上生成文字，transformer 的記憶體成本高到不行。
- 教學。懂編碼器－解碼器的瓶頸，是懂 transformer 為什麼贏的最快路徑。

### 暴露偏差和它的緩解

- **排程取樣（scheduled sampling）。** 訓練時把 teacher forcing 的比例退火，讓模型學會從自己的錯誤恢復。
- **最小風險訓練。** 用句子級的 BLEU，而不是 token 級的交叉熵來訓練。更接近你真正要的東西。
- **用強化學習 fine-tune。** 用一個指標獎勵序列生成器。現代大型語言模型的 RLHF 在用。

三個都仍適用於以 transformer 為基礎的生成。

## Ship It｜交付成果

存成 `outputs/prompt-seq2seq-design.md`：

```markdown
---
name: seq2seq-design
description: Design a sequence-to-sequence pipeline for a given task.
phase: 5
lesson: 09
---

Given a task (translation, summarization, paraphrase, question rewrite), output:

1. Architecture. Pretrained transformer encoder-decoder (BART, T5, mBART, NLLB) is the default. RNN-based seq2seq only for specific constraints.
2. Starting checkpoint. Name it (`facebook/bart-base`, `google/flan-t5-base`, `facebook/nllb-200-distilled-600M`). Match the checkpoint to task and language coverage.
3. Decoding strategy. Greedy for deterministic output, beam search (width 4-5) for quality, sampling with temperature for diversity. One sentence justification.
4. One failure mode to verify before shipping. Exposure bias manifests as generation drift on longer outputs; sample 20 outputs at the 90th-percentile length and eyeball.

Refuse to recommend training a seq2seq from scratch for under a million parallel examples. Flag any pipeline that uses greedy decoding for user-facing content as fragile (greedy repeats and loops).
```

## Exercises｜練習

1. **簡單。** 實作玩具複製任務。在目標等於來源的輸入輸出配對上訓練 GRU 序列到序列。量長度 5、10、20 的準確率。重現那個瓶頸。
2. **中等。** 加上集束寬度 3 的集束搜尋解碼。在一份小的平行語料庫（corpus）上，和貪婪比 BLEU。寫下集束搜尋在哪裡贏（通常是最後幾個 token），以及在哪裡沒有差別。
3. **困難。** 在 1 萬對的改寫資料集（dataset）上 fine-tune `facebook/bart-base`。把 fine-tune 後、集束寬度 4 的輸出，和基模型在留出輸入上的輸出比。回報 BLEU，並挑 10 個質性例子。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 編碼器 | 輸入 RNN | 讀來源。產出每一步的隱藏狀態，以及最後的脈絡向量。 |
| 解碼器 | 輸出 RNN | 用脈絡向量初始化。一次生成一個目標 token。 |
| 脈絡向量 | 那份摘要 | 編碼器最後的隱藏狀態。大小固定。注意力要解決的瓶頸。 |
| Teacher forcing | 用真的 token | 訓練時餵前一個位置的真實 token。讓學習穩得住。 |
| 暴露偏差 | 訓練和測試的落差 | 在真 token 上訓練的模型，從沒練習過從自己的錯誤恢復。 |
| 集束搜尋 | 更好的解碼 | 每一步留下前 k 條部分序列，而不是貪婪地選定。 |

## Further Reading｜延伸閱讀

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) ——原始的序列到序列論文。四頁。
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) ——帶出 GRU 和編碼器－解碼器這個框架。
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) ——注意力論文。這一課讀完立刻讀它。
- [PyTorch NLP from Scratch tutorial](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) ——可以照著做的序列到序列加注意力程式。
