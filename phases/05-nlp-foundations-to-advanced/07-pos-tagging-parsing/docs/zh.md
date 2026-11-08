# 詞性標註與句法剖析

> 文法曾經有一陣子很不流行。後來每條 LLM 管線都需要驗證結構化抽取的結果，它就又回來了。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 5 · 01（文字處理）、階段 2 · 14（單純貝氏）
**時間：** 約 45 分鐘

## 問題所在

單元 01 說過，詞形還原需要一個詞性標記。不知道 `running` 是動詞，詞形還原器就沒辦法把它還原成 `run`。不知道 `better` 是形容詞，也就沒辦法還原成 `good`。

那個承諾底下藏了一整個子領域。詞性標註負責指派文法類別。句法剖析則還原句子的樹狀結構：哪個詞修飾哪個詞、哪個動詞支配哪些論元。傳統 NLP 花了二十年打磨這兩件事。後來深度學習把它們壓縮成預訓練 Transformer 之上的一個詞元分類任務，研究社群也就轉向別處了。

但應用社群沒有。每一條結構化抽取管線底層仍然在用詞性與依存樹。LLM 產生的 JSON 會拿文法約束去驗證。問答系統用依存剖析來拆解查詢。機器翻譯的品質評估器會檢查剖析樹之間的對齊。

值得懂。本單元介紹標記集、基線做法，以及你該在哪一步停下來、不再從零實作而直接呼叫 spaCy。

## 核心概念

**詞性標註（POS tagging）** 給每個詞元標上一個文法類別。**Penn Treebank（PTB）** 標記集是英文的預設選擇。36 個標記，區分得細到讓一般讀者覺得瑣碎：`NN` 單數名詞、`NNS` 複數名詞、`NNP` 單數專有名詞、`VBD` 動詞過去式、`VBZ` 動詞第三人稱單數現在式，以此類推。**Universal Dependencies（UD）** 標記集比較粗（17 個標記）且與語言無關；它成了跨語言工作的預設。

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**句法剖析（syntactic parsing）** 產生一棵樹。有兩大流派：

- **成分剖析（constituency parsing）。** 名詞片語、動詞片語、介詞片語彼此層層嵌套。輸出是一棵由非終端類別（NP、VP、PP）組成的樹，詞是葉節點。
- **依存剖析（dependency parsing）。** 每個詞都有唯一一個它所依附的中心詞，並標上一個文法關係。輸出是一棵樹，每條邊都是一個（中心詞, 依存詞, 關係）三元組。

依存剖析在 2010 年代勝出，因為它能乾淨地泛化到各種語言，特別是語序自由的語言。

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

```figure
pos-tagger
```

```figure
dependency-arcs
```

## 動手實作

### 步驟 1：最高頻標記基線

最笨但堪用的詞性標註器。對每個詞，就預測它在訓練資料裡出現最多次的那個標記。

```python
from collections import Counter, defaultdict


def train_mft(train_examples):
    word_tag_counts = defaultdict(Counter)
    all_tags = Counter()
    for tokens, tags in train_examples:
        for token, tag in zip(tokens, tags):
            word_tag_counts[token.lower()][tag] += 1
            all_tags[tag] += 1
    word_best = {w: c.most_common(1)[0][0] for w, c in word_tag_counts.items()}
    default_tag = all_tags.most_common(1)[0][0]
    return word_best, default_tag


def predict_mft(tokens, word_best, default_tag):
    return [word_best.get(t.lower(), default_tag) for t in tokens]
```

在 Brown 語料上，這個基線大約有 85% 的準確度。不算好，但任何正經的模型都不該掉到這個下限之下。

### 步驟 2：bigram HMM 標註器

對序列的聯合機率建模：

```math
P(\text{tags}, \text{words}) = \prod_i P(\text{tag}_i \mid \text{tag}_{i-1}) \cdot P(\text{word}_i \mid \text{tag}_i)
```

兩張表：轉移機率（給定前一個標記時的標記）與發射機率（給定標記時的詞）。兩者都用 Laplace 平滑從計數估出來。解碼用維特比演算法（在標記格點上做動態規劃）。

```python
import math


def train_hmm(train_examples, alpha=0.01):
    transitions = defaultdict(Counter)
    emissions = defaultdict(Counter)
    tags = set()
    vocab = set()

    for tokens, ts in train_examples:
        prev = "<BOS>"
        for token, tag in zip(tokens, ts):
            transitions[prev][tag] += 1
            emissions[tag][token.lower()] += 1
            tags.add(tag)
            vocab.add(token.lower())
            prev = tag
        transitions[prev]["<EOS>"] += 1

    return transitions, emissions, tags, vocab


def log_prob(table, given, key, smooth_denom, alpha):
    return math.log((table[given].get(key, 0) + alpha) / smooth_denom)


def viterbi(tokens, transitions, emissions, tags, vocab, alpha=0.01):
    tags_list = list(tags)
    n = len(tokens)
    V = [[0.0] * len(tags_list) for _ in range(n)]
    back = [[0] * len(tags_list) for _ in range(n)]

    for j, tag in enumerate(tags_list):
        em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
        tr_denom = sum(transitions["<BOS>"].values()) + alpha * (len(tags_list) + 1)
        tr = log_prob(transitions, "<BOS>", tag, tr_denom, alpha)
        em = log_prob(emissions, tag, tokens[0].lower(), em_denom, alpha)
        V[0][j] = tr + em
        back[0][j] = 0

    for i in range(1, n):
        for j, tag in enumerate(tags_list):
            em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
            em = log_prob(emissions, tag, tokens[i].lower(), em_denom, alpha)
            best_prev = 0
            best_score = -1e30
            for k, prev_tag in enumerate(tags_list):
                tr_denom = sum(transitions[prev_tag].values()) + alpha * (len(tags_list) + 1)
                tr = log_prob(transitions, prev_tag, tag, tr_denom, alpha)
                score = V[i - 1][k] + tr + em
                if score > best_score:
                    best_score = score
                    best_prev = k
            V[i][j] = best_score
            back[i][j] = best_prev

    last_best = max(range(len(tags_list)), key=lambda j: V[n - 1][j])
    path = [last_best]
    for i in range(n - 1, 0, -1):
        path.append(back[i][path[-1]])
    return [tags_list[j] for j in reversed(path)]
```

bigram HMM 在 Brown 上大約有 93% 的準確度。從 85% 跳到 93%，主要功勞在轉移機率——模型學到 `DET NOUN` 很常見，而 `NOUN DET` 很少見。

### 步驟 3：為什麼現代標註器能贏過它

轉移機率加發射機率是局部的。它們沒辦法捕捉到 `saw` 在 "I bought a saw" 裡是名詞、在 "I saw the movie" 裡卻是動詞。一個帶任意特徵（字尾、詞形、前後鄰詞、詞本身）的 CRF 可以到約 97%。BiLSTM-CRF 或 Transformer 可以到 98% 以上。

這個任務的上限是由標註者之間的分歧決定的。人類標註者在 Penn Treebank 上的一致率約為 97%。超過 98% 的模型很可能只是在過度擬合測試集。

### 步驟 4：依存剖析速寫

從零實作完整的依存剖析超出本單元範圍；標準的教科書處理見 Jurafsky and Martin。有兩個傳統家族要認識：

- **轉移式（transition-based）** 剖析器（arc-eager、arc-standard）的行為像個 shift-reduce 剖析器：讀入詞元、把它們推上堆疊，再套用建立弧的 reduce 動作。貪婪解碼很快。經典實作是 MaltParser。現代的類神經版本：Chen and Manning 的轉移式剖析器。
- **圖式（graph-based）** 剖析器（Eisner 演算法、Dozat-Manning biaffine）會給每一條可能的中心詞—依存詞邊打分，再取最大生成樹。比較慢，但比較準。

多數應用場合，直接呼叫 spaCy：

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running at 3pm.")
for token in doc:
    print(f"{token.text:10s} tag={token.tag_:5s} pos={token.pos_:6s} dep={token.dep_:10s} head={token.head.text}")
```

```
The        tag=DT    pos=DET    dep=det        head=cats
cats       tag=NNS   pos=NOUN   dep=nsubj      head=running
were       tag=VBD   pos=AUX    dep=aux        head=running
running    tag=VBG   pos=VERB   dep=ROOT       head=running
at         tag=IN    pos=ADP    dep=prep       head=running
3pm        tag=NN    pos=NOUN   dep=pobj       head=at
.          tag=.     pos=PUNCT  dep=punct      head=running
```

把 `dep` 這一欄從下往上讀，句子的文法結構就浮出來了。

## 框架應用

每個生產級 NLP 函式庫都把詞性標註與依存剖析當成標準管線的一部分附上。

- **spaCy**（`en_core_web_sm` / `md` / `lg` / `trf`）。快、準，與分詞、NER、詞形還原整合在一起。`token.tag_`（Penn）、`token.pos_`（UD）、`token.dep_`（依存關係）。
- **Stanford NLP（stanza）**。Stanford 給 CoreNLP 的接班人。在 60 多種語言上都達到最先進水準。
- **trankit**。基於 Transformer，UD 準確度不錯。
- **NLTK**。`pos_tag`。堪用、慢、比較舊。教學用很合適。

### 到了 2026 年它為什麼還重要

- **詞形還原。** 單元 01 需要詞性才能正確還原。永遠需要。
- **從 LLM 輸出做結構化抽取。** 驗證生成的句子有沒有遵守文法約束（例如主謂一致、必要的修飾語）。
- **面向屬性的情感分析。** 依存剖析會告訴你哪個形容詞修飾哪個名詞。
- **查詢理解。** "movies directed by Wes Anderson starring Bill Murray" 透過剖析結果拆解成結構化的約束條件。
- **跨語言遷移。** UD 標記與依存關係與語言無關，讓你能對新語言做零樣本的結構分析。
- **低算力管線。** 如果你沒辦法上線一個 Transformer，詞性標註加依存剖析再加地名詞表，能走得比你想像的遠。

## 產出交付

存成 `outputs/skill-grammar-pipeline.md`：

```markdown
---
name: grammar-pipeline
description: Design a classical POS + dependency pipeline for a downstream NLP task.
version: 1.0.0
phase: 5
lesson: 07
tags: [nlp, pos, parsing]
---

Given a downstream task (information extraction, rewrite validation, query decomposition, lemmatization), you output:

1. Tagset to use. Penn Treebank for English-only legacy pipelines, Universal Dependencies for multilingual or cross-lingual.
2. Library. spaCy for most production, stanza for academic-grade multilingual, trankit for highest UD accuracy. Name the specific model ID.
3. Integration pattern. Show the 3-5 lines that call the library and consume the needed attributes (`.pos_`, `.dep_`, `.head`).
4. Failure mode to test. Noun-verb ambiguity (`saw`, `book`, `can`) and PP-attachment ambiguity are the classical traps. Sample 20 outputs and eyeball.

Refuse to recommend rolling your own parser. Building parsers from scratch is a research project, not an application task. Flag any pipeline that consumes POS tags without handling lowercase/uppercase variants as fragile.
```

## 練習

1. **簡單。** 在一份小型的帶標記語料上（例如 NLTK 的 Brown 子集）用最高頻標記基線，量測留出句子的準確度。驗證那個約 85% 的結果。
2. **中等。** 訓練上面那個 bigram HMM，並回報各標記的精確率／召回率。HMM 最容易混淆哪些標記？
3. **困難。** 用 spaCy 的依存剖析從 1000 句的樣本中抽出主詞—動詞—受詞三元組。在 50 個人工標註的三元組上做評估。記錄抽取在哪裡失敗（常見於被動語態、並列結構與省略主詞）。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| 詞性標記（POS tag） | 「詞的類型」 | 文法類別。PTB 有 36 個；UD 有 17 個。 |
| Penn Treebank | 「標準標記集」 | 專屬英文。動詞時態與名詞單複數分得很細。 |
| Universal Dependencies | 「多語言標記集」 | 比 PTB 粗；與語言無關；跨語言工作的預設選擇。 |
| 依存剖析 | 「句子的樹」 | 每個詞有一個中心詞，每條邊有一個文法關係。 |
| 維特比演算法（Viterbi） | 「動態規劃」 | 在給定發射與轉移機率下，找出機率最高的那條標記序列。 |

## 延伸閱讀

- [Jurafsky and Martin — Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/) —— 詞性標註與剖析的標準教科書處理。
- [Universal Dependencies project](https://universaldependencies.org/) —— 每個多語言剖析器都在用的跨語言標記集與樹庫集合。
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features) —— `Token` 上每個屬性的實用參考。
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf) —— 把類神經剖析器帶進主流的那篇論文。
