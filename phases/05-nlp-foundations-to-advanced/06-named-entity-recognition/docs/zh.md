# 命名實體識別

> 把名字抽出來。聽起來很簡單，直到你碰上模糊的實體邊界、巢狀實體，還有領域術語。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 5 · 02（BoW + TF-IDF）、階段 5 · 03（詞嵌入）
**時間：** 約 75 分鐘

## 問題所在

"Apple sued Google over its iPhone search deal in the US." 這句話裡有五個實體：Apple（ORG）、Google（ORG）、iPhone（PRODUCT）、search deal（也許算）、US（GPE）。好的 NER 系統會把它們全部抽出來，型別也標對。差的系統會漏掉 iPhone、把水果的 Apple 跟公司的 Apple 搞混，還把 "US" 標成 PERSON。

NER 是每一條結構化抽取管線底下的那頭牛。履歷解析、法規遵循的日誌掃描、病歷去識別化、搜尋查詢理解、聊天機器人回應的依據標註、法律合約抽取。你幾乎不會直接看見它，卻一直在依賴它。

本單元從古典路線（規則式、HMM、CRF）一路走進現代路線（BiLSTM-CRF，再到 transformer）。每一步都在解決前一步的某個具體限制。這個模式本身就是本單元要教的東西。

## 核心概念

**BIO 標註**（或 BILOU）把實體抽取轉成一個序列標註問題。每個詞元標上 `B-TYPE`（實體開始）、`I-TYPE`（實體內部）或 `O`（不屬於任何實體）。

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

多詞元實體用連結表示：`New B-GPE`、`York I-GPE`、`City I-GPE`。看得懂 BIO 的模型就能抽出任意長度的區段。

架構的演進：

- **規則式。** regex 加上詞典（gazetteer）查表。對已知實體的精確率很高，對新實體的覆蓋率是零。
- **HMM。** 隱藏馬可夫模型。給定標記的詞元發射機率，加上標記到標記的轉移機率。用 Viterbi 解碼。需要標註資料來訓練。
- **CRF。** 條件隨機場。跟 HMM 類似但屬於判別式模型，所以你可以任意混搭特徵（詞形、大小寫、鄰近詞）。在 2026 年，它依然是低資源部署場景下的古典生產主力。
- **BiLSTM-CRF。** 用神經特徵取代手工特徵。LSTM 雙向讀過整個句子，上頭再疊一層 CRF 來確保標記序列一致。
- **Transformer 式。** 給 BERT 接上一個詞元分類頭去微調。準確度最好。算力花費也最高。

```figure
ner-bio-tagging
```

## 動手實作

### 步驟 1：BIO 標註的輔助函式

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

### 步驟 2：手工特徵

古典（非神經）NER 的勝負全在特徵。幾個好用的：

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

`word_shape("iPhone")` 會回傳 `xXxxxx`。`word_shape("USA-2024")` 會回傳 `XXX-dddd`。大小寫的樣態對專有名詞來說訊號極強。

### 步驟 3：一個簡單的規則式加字典基線

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

生產環境的詞典會有從 Wikipedia 與 DBpedia 抓來的數百萬筆條目。覆蓋率不錯。消歧（公司的 `Apple` 還是水果的 `Apple`）則糟得可以。這就是統計模型後來勝出的原因。

### 步驟 4：CRF 這一步（只給草圖，不做完整實作）

在沒有機率論基礎的前提下，用 50 行從零寫一個 CRF 並不會讓人學到什麼。改用 `sklearn-crfsuite`：

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

`c1` 與 `c2` 是 L1 與 L2 正則化。`all_possible_transitions=True` 讓模型學到不合法的序列（例如 `O` 後面接 `I-ORG`）機率很低——CRF 就是這樣在你完全不用寫出約束的情況下，維持住 BIO 的一致性。

### 步驟 5：BiLSTM-CRF 多帶來了什麼

特徵變成學出來的。輸入是詞元嵌入（GloVe 或 fastText）。LSTM 從左到右、再從右到左讀一遍。串接後的隱藏狀態送進一層 CRF 輸出層。CRF 依然負責維持標記序列的一致性；LSTM 則把手工特徵換成學出來的特徵。

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

CRF 層可以用 `torchcrf.CRF`（pip install pytorch-crf）。除非你手上有幾萬句標註資料，否則它比手工特徵 CRF 的提升雖然量得出來，但會比你預期的小。

## 框架應用

spaCy 開箱就附上生產級的 NER。

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

注意 `iPhone` 被標成 `ORG` 而不是 `PRODUCT`——spaCy 的小模型對產品類實體的覆蓋很弱。大模型（`en_core_web_lg`）好一些。transformer 模型（`en_core_web_trf`）更好。

用 Hugging Face 做 BERT 式 NER：

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

`aggregation_strategy="simple"` 會把連續的 B-X、I-X 詞元合併成一個區段。不加的話，你拿到的是詞元層級的標記，得自己合併。

### LLM 式 NER（2026 年的選項）

零樣本與少樣本的 LLM NER 現在在許多領域已經能跟微調過的模型打成平手，而在標註資料稀缺時更是遙遙領先。

- **零樣本提示。** 給 LLM 一份實體型別清單和一個範例 schema，要求輸出 JSON。開箱就能用；在陌生領域的準確度只算中等。
- **ZeroTuneBio 式提示。** 把任務拆解成候選抽取 → 語意解釋 → 判斷 → 覆核。多階段提示（而非一次問完）能大幅提升生醫 NER 的準確度。同樣的模式在法律、金融與科學領域都適用。
- **搭配 RAG 的動態提示。** 每次推論都從一小份標註種子集裡檢索最相似的標註範例，即時組出少樣本提示。在 2026 年的基準測試中，這比靜態提示把 GPT-4 的生醫 NER F1 拉高了 11-12%。
- **按實體型別拆解。** 對長文件來說，一次呼叫就把所有實體型別全抽出來，召回率會隨長度成長而下滑。改成每個實體型別各跑一次抽取。推論成本更高，準確度提升相當明顯。這是臨床病歷與法律合約的標準做法。

2026 年的生產環境建議：在你動手收集訓練資料之前，先做一個 LLM 零樣本基線。常常 F1 就已經夠好，讓你根本不需要微調。

### 古典 NER 仍然勝出的場合

即使有 LLM 可用，古典 NER 在這些情況仍然贏：

- 延遲預算低於 50ms。
- 你有數千筆標註範例，而且需要 98% 以上的 F1。
- 領域有一套穩定的本體，讓預訓練好的 CRF 或 BiLSTM 能順利轉移。
- 法規要求必須是地端、非生成式的模型。

### 什麼時候會崩掉

- **領域偏移。** 在 CoNLL 上訓練的 NER 拿去跑法律合約，表現比詞典還差。請在你自己的領域上做領域適應微調。
- **巢狀實體。** "Bank of America Tower" 同時是一個 ORG 也是一個 FACILITY。標準 BIO 沒辦法表示重疊的區段。你需要巢狀 NER（多趟式或以區段為單位的模型）。
- **超長實體。** "United States Federal Deposit Insurance Corporation."。詞元層級的模型有時會把它切開。用 `aggregation_strategy` 或後處理來收拾。
- **稀有型別。** 像 DRUG_BRAND、ADVERSE_EVENT、DOSE 這類醫療 NER 標記。通用模型完全沒概念。那邊的起點是 Scispacy 和 BioBERT。

## 產出交付

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

## 練習

1. **簡單。** 實作 `bio_to_spans`（`spans_to_bio` 的反向操作），並在 10 個句子上驗證來回轉換的一致性。
2. **中等。** 把上面的 sklearn-crfsuite CRF 拿去 CoNLL-2003 英文 NER 資料集上訓練。用 `seqeval` 回報各實體型別的 F1。典型結果：約 84 F1。
3. **困難。** 在一份特定領域的 NER 資料集（醫療、法律或金融）上微調 `distilbert-base-cased`。跟 spaCy 小模型比較。記錄你做了哪些資料洩漏檢查，並把最讓你意外的地方寫下來。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| NER | 「把名字抽出來」 | 給詞元區段標上型別（PERSON、ORG、GPE、DATE……）。 |
| BIO | 「一種標註方案」 | `B-X` 是開始，`I-X` 是延續，`O` 是外部。 |
| BILOU | 「更好的 BIO」 | 多了 `L-X`（最後一個）與 `U-X`（單一詞元），讓實體邊界更乾淨。 |
| CRF | 「結構化分類器」 | 不只建模發射機率，還建模標記之間的轉移。能確保序列合法。 |
| 巢狀 NER | 「重疊的實體」 | 一個區段的型別，跟它內部某個子區段的型別不同。BIO 表達不了這件事。 |
| 實體層級 F1 | 「NER 該用的指標」 | 預測出的區段必須跟正確答案完全一致。詞元層級 F1 會高估準確度。 |

## 延伸閱讀

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360) —— BiLSTM-CRF 那篇論文。經典。
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) —— 提出了後來成為標準做法的詞元分類模式。
- [spaCy linguistic features — named entities](https://spacy.io/usage/linguistic-features#named-entities) —— `Doc.ents` 與 `Span` 上每個屬性的實用參考。
- [seqeval](https://github.com/chakki-works/seqeval) —— 正確的指標函式庫。永遠用它。
