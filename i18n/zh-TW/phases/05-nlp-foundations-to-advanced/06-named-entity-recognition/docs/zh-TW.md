# 命名實體辨識（named entity recognition）

> 把名字抽出來。聽起來容易，直到你碰到邊界含糊、巢狀實體，和領域行話。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word Embeddings)
**Time:** ~75 minutes

## The Problem｜問題

「Apple sued Google over its iPhone search deal in the US.」五個實體：Apple（ORG）、Google（ORG）、iPhone（PRODUCT）、search deal（也許）、US（GPE）。好的命名實體辨識系統把它們全部抽出來，類型也對。差的會漏掉 iPhone，把水果的 Apple 和公司的 Apple 搞混，還把「US」標成 PERSON。

命名實體辨識是每條結構化抽取管線（pipeline）底下的主力。履歷解析、合規日誌掃描、病歷去識別、搜尋查詢理解、為聊天機器人的回答提供依據（grounding）、法律合約抽取。你幾乎看不見它；你一直依賴它。

這一課走古典路徑（規則、隱藏馬可夫模型（hidden Markov model）、條件隨機場（conditional random field）），再走進現代路徑（BiLSTM-CRF，然後 transformer）。每一步都解決前一步的某個限制。這個模式本身就是這一課。

## The Concept｜核心概念

**BIO 標記**（或 BILOU）把實體抽取變成序列標記問題。每個 token 標成 `B-TYPE`（實體開頭）、`I-TYPE`（實體內部）或 `O`（任何實體之外）。

```
Apple    B-ORG
sued     O
Google   B-ORG
over     O
its      O
iPhone   B-PRODUCT
search   O
deal     O
in       O
the      O
US       B-GPE
.        O
```

多 token 的實體串起來：`New B-GPE`、`York I-GPE`、`City I-GPE`。懂 BIO 的模型可以抽出任意片段。

架構的進展：

- **規則。** 正規表示式加上專名表（gazetteer）查詢。已知實體的精確率（precision）高，新實體的涵蓋是零。
- **HMM。** 隱藏馬可夫模型。給定標記時 token 的發射機率（emission probability），以及標記到標記的轉移機率（transition probability）。用維特比解碼（Viterbi decoding）。在有標籤（label）的資料上訓練。
- **CRF。** 條件隨機場。像 HMM，但是判別式，所以你可以混用任意特徵（feature）（詞形、大小寫、鄰近的詞）。到 2026 年，資源少的部署裡，它仍是古典正式環境的主力。
- **BiLSTM-CRF。** 用神經特徵取代手刻特徵。LSTM 從兩個方向讀句子，上面的 CRF 層強制標記序列一致。
- **以 transformer 為基礎。** 用 token 分類頭 fine-tune BERT。準確率（accuracy）最好。算力也最多。

```figure
ner-bio-tagging
```

## Build It｜動手實作

### 步驟 1：BIO 標記的幫手

```python
def spans_to_bio(tokens, spans):
    labels = ["O"] * len(tokens)
    for start, end, label in spans:
        labels[start] = f"B-{label}"
        for i in range(start + 1, end):
            labels[i] = f"I-{label}"
    return labels


def bio_to_spans(tokens, labels):
    spans = []
    current = None
    for i, label in enumerate(labels):
        if label.startswith("B-"):
            if current:
                spans.append(current)
            current = (i, i + 1, label[2:])
        elif label.startswith("I-") and current and current[2] == label[2:]:
            current = (current[0], i + 1, current[2])
        else:
            if current:
                spans.append(current)
                current = None
    if current:
        spans.append(current)
    return spans
```

```python
>>> tokens = ["Apple", "sued", "Google", "over", "iPhone", "sales", "."]
>>> labels = ["B-ORG", "O", "B-ORG", "O", "B-PRODUCT", "O", "O"]
>>> bio_to_spans(tokens, labels)
[(0, 1, 'ORG'), (2, 3, 'ORG'), (4, 5, 'PRODUCT')]
```

### 步驟 2：手刻特徵

古典（非神經）的命名實體辨識，特徵就是整個遊戲。有用的有這些：

```python
def token_features(token, prev_token, next_token):
    return {
        "lower": token.lower(),
        "is_upper": token.isupper(),
        "is_title": token.istitle(),
        "has_digit": any(c.isdigit() for c in token),
        "suffix_3": token[-3:].lower(),
        "shape": word_shape(token),
        "prev_lower": prev_token.lower() if prev_token else "<BOS>",
        "next_lower": next_token.lower() if next_token else "<EOS>",
    }


def word_shape(word):
    out = []
    for c in word:
        if c.isupper():
            out.append("X")
        elif c.islower():
            out.append("x")
        elif c.isdigit():
            out.append("d")
        else:
            out.append(c)
    return "".join(out)
```

`word_shape("iPhone")` 回傳 `xXxxxx`。`word_shape("USA-2024")` 回傳 `XXX-dddd`。大小寫樣式對專有名詞訊號很強。

### 步驟 3：簡單的規則加字典基準模型（baseline）

```python
ORG_GAZETTEER = {"Apple", "Google", "Microsoft", "OpenAI", "Meta", "Amazon", "Netflix"}
GPE_GAZETTEER = {"US", "USA", "UK", "India", "Germany", "France"}
PRODUCT_GAZETTEER = {"iPhone", "Android", "Windows", "ChatGPT", "Claude"}


def rule_based_ner(tokens):
    labels = []
    for token in tokens:
        if token in ORG_GAZETTEER:
            labels.append("B-ORG")
        elif token in GPE_GAZETTEER:
            labels.append("B-GPE")
        elif token in PRODUCT_GAZETTEER:
            labels.append("B-PRODUCT")
        else:
            labels.append("O")
    return labels
```

正式環境的專名表有數百萬條，從 Wikipedia 和 DBpedia 抓下來。涵蓋不錯。消歧（公司的 `Apple` 對上水果）很糟。所以統計模型贏了。

### 步驟 4：CRF 這一步（草圖，不是完整實作）

沒有機率論的基礎，用 50 行從零寫完整 CRF 不會讓人更懂。改用 `sklearn-crfsuite`：

```python
import sklearn_crfsuite

def to_features(tokens):
    out = []
    for i, tok in enumerate(tokens):
        prev = tokens[i - 1] if i > 0 else ""
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        out.append({
            "word.lower()": tok.lower(),
            "word.isupper()": tok.isupper(),
            "word.istitle()": tok.istitle(),
            "word.isdigit()": tok.isdigit(),
            "word.suffix3": tok[-3:].lower(),
            "word.shape": word_shape(tok),
            "prev.word.lower()": prev.lower(),
            "next.word.lower()": nxt.lower(),
            "BOS": i == 0,
            "EOS": i == len(tokens) - 1,
        })
    return out


crf = sklearn_crfsuite.CRF(algorithm="lbfgs", c1=0.1, c2=0.1, max_iterations=100, all_possible_transitions=True)
X_train = [to_features(s) for s in sentences_tokenized]
crf.fit(X_train, bio_labels_train)
```

`c1` 和 `c2` 是 L1 正則化（regularization）和 L2 正則化。`all_possible_transitions=True` 讓模型學到不合法的序列（例如 `O` 後面接到 `I-ORG`）不太可能，這就是 CRF 強制 BIO 一致、又不用你自己寫約束的方式。

### 步驟 5：BiLSTM-CRF 多了什麼

特徵變成學出來的。輸入：token embedding（GloVe 或 fastText）。LSTM 從左到右、再從右到左讀。接起來的隱藏狀態（hidden state）送進 CRF 輸出層。CRF 仍強制標記序列一致；LSTM 用學來的特徵換掉手刻特徵。

```python
import torch
import torch.nn as nn


class BiLSTM_CRF_Head(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_labels):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, bidirectional=True, batch_first=True)
        self.fc = nn.Linear(hidden_dim * 2, n_labels)

    def forward(self, token_ids):
        e = self.embed(token_ids)
        h, _ = self.lstm(e)
        emissions = self.fc(h)
        return emissions
```

CRF 層用 `torchcrf.CRF`（pip install pytorch-crf）。比起手刻 CRF，增益量得到，但沒有你想的那麼大，除非你有數萬句標好的句子。

## Use It｜實際應用

spaCy 開箱就交付正式環境等級的命名實體辨識。

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("Apple sued Google over its iPhone search deal in the US.")
for ent in doc.ents:
    print(f"{ent.text:20s} {ent.label_}")
```

```
Apple                ORG
Google               ORG
iPhone               ORG
US                   GPE
```

注意 `iPhone` 被標成 `ORG` 而不是 `PRODUCT`——spaCy 的小模型對產品實體的辨識涵蓋率不佳。大模型（`en_core_web_lg`）好一些。transformer 模型（`en_core_web_trf`）更好。

Hugging Face 上以 BERT 為基礎的命名實體辨識：

```python
from transformers import pipeline

ner = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
print(ner("Apple sued Google over its iPhone in the US."))
```

```
[{'entity_group': 'ORG', 'word': 'Apple', ...},
 {'entity_group': 'ORG', 'word': 'Google', ...},
 {'entity_group': 'MISC', 'word': 'iPhone', ...},
 {'entity_group': 'LOC', 'word': 'US', ...}]
```

`aggregation_strategy="simple"` 把連續的 B-X、I-X token 併成一個片段。沒有它，你拿到的是 token 級標記，得自己合併。

### 以 LLM 做的命名實體辨識（2026 年的選項）

零樣本（zero-shot）和少樣本（few-shot）的 LLM 命名實體辨識，現在已在很多領域和 fine-tune 過的模型不相上下，標註資料稀少時，表現往往更好。

- **零樣本 prompting。** 給 LLM 一份實體類型清單和一個範例綱要。要求 JSON 輸出。開箱就用；在新領域上準確率中等。
- **ZeroTuneBio 風格的 prompting。** 把任務拆成抽出候選、解釋意思、判斷、再檢查。多階段 prompt（不是 one-shot）在生物醫學命名實體辨識上把準確率拉高不少。同一套模式適用法律、金融和科學領域。
- **用 RAG 的動態 prompting。** 每次推論（inference）都從一小份標好的種子集合裡取出最相似的例子，當場組少樣本 prompt。在 2026 年的基準上，這比靜態 prompting 把 GPT-4 生物醫學命名實體辨識的 F1 提升 11% 到 12%。
- **按實體類型拆開。** 長文件若一次呼叫就抽所有類型，長度一增加，召回率（recall）就掉。每種實體類型各跑一輪抽取。推論成本較高，準確率高不少。這是病歷和法律合約的標準做法。

截至 2026 年的正式環境建議：在你收集訓練資料之前，先做一個 LLM 零樣本基準模型。F1 常常已經夠好，你根本不必 fine-tune。

### 古典命名實體辨識什麼時候仍然贏

就算有 LLM，古典命名實體辨識在這些情況仍會贏：

- 延遲（latency）預算低於 50 毫秒。
- 你有數千筆標好的例子，而且需要 98% 以上的 F1。
- 領域有穩定的本體（ontology），預訓練的 CRF 或 BiLSTM 轉移得很好。
- 法規要求模型在自己的機房裡，而且不是生成式的。

### 它在哪裡垮掉

- **領域偏移。** 在 CoNLL 上訓練的命名實體辨識，放到法律合約上，表現比一份專名表還差。在你的領域上 fine-tune。
- **巢狀實體。** 「Bank of America Tower」同時是 ORG 和 FACILITY。標準 BIO 無法表示重疊片段。你需要巢狀命名實體辨識（多輪或基於片段的模型）。
- **很長的實體。** 「United States Federal Deposit Insurance Corporation.」token 級模型有時會把它拆開。用 `aggregation_strategy` 或事後處理。
- **低頻實體類別。** 醫學命名實體辨識的標記像 DRUG_BRAND、ADVERSE_EVENT、DOSE。通用模型完全沒概念。那裡的起點是 Scispacy 和 BioBERT。

## Ship It｜交付成果

存成 `outputs/skill-ner-picker.md`：

```markdown
---
name: ner-picker
description: Pick the right NER approach for a given extraction task.
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

Given a task description (domain, label set, language, latency, data volume), output:

1. Approach. Rule-based + gazetteer, CRF, BiLSTM-CRF, or transformer fine-tune.
2. Starting model. Name it (spaCy model ID, Hugging Face checkpoint ID, or "custom, trained from scratch").
3. Labeling strategy. BIO, BILOU, or span-based. Justify in one sentence.
4. Evaluation. Use `seqeval`. Always report entity-level F1 (not token-level).

Refuse to recommend fine-tuning a transformer for under 500 labeled examples unless the user already has a pretrained domain model. Flag nested entities as needing span-based or multi-pass models. Require a gazetteer audit if the user mentions "production scale" and labels are unchanged from CoNLL-2003.
```

## Exercises｜練習

1. **簡單。** 實作 `bio_to_spans`（`spans_to_bio` 的反向），在 10 個句子上驗證來回一致。
2. **中等。** 在 CoNLL-2003 英文命名實體辨識資料集（dataset）上訓練上面的 sklearn-crfsuite CRF。用 `seqeval` 報每個實體的 F1。典型結果：約 84 的 F1。
3. **困難。** 在特定領域的命名實體辨識資料集（醫學、法律或金融）上 fine-tune `distilbert-base-cased`。和 spaCy 小模型比。寫下資料洩漏（data leakage）檢查，以及什麼讓你意外。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 命名實體辨識 | 把名字抽出來 | 把 token 片段標上類型（PERSON、ORG、GPE、DATE……）。 |
| BIO | 標記方案 | `B-X` 開始，`I-X` 接續，`O` 在外面。 |
| BILOU | 更好的 BIO | 加上 `L-X`（最後）和 `U-X`（單獨一個），邊界更乾淨。 |
| CRF | 有結構的分類器（classifier） | 建模標記之間的轉移，不只是發射。強制合法序列。 |
| 巢狀命名實體辨識 | 重疊的實體 | 一個片段是一種實體，它的子片段是另一種。BIO 表達不了。 |
| 實體級 F1 | 正確的命名實體辨識指標 | 預測片段必須和真實片段完全一致。token 級 F1 會把準確率說得過高。 |

## Further Reading｜延伸閱讀

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360) ——BiLSTM-CRF 論文。標準參考。
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) ——帶出後來成為標準的 token 分類模式。
- [spaCy linguistic features — named entities](https://spacy.io/usage/linguistic-features#named-entities) ——`Doc.ents` 和 `Span` 上每個屬性的實務參考。
- [seqeval](https://github.com/chakki-works/seqeval) ——正確的指標函式庫（library）。永遠用它。
