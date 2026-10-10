# 詞性標記（part-of-speech tagging）與句法剖析（syntactic parsing）

> 文法有一陣子不流行。後來每條大型語言模型管線（pipeline）都要驗證結構化抽取，它又回來了。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## The Problem｜問題

第 01 課答應過，詞形還原（lemmatization）需要詞性標記。不知道 `running` 是動詞，詞形還原器就無法把它還原成 `run`。不知道 `better` 是形容詞，就無法還原成 `good`。

那個承諾後面藏著一整個子領域。詞性標記指派文法類別。句法剖析還原句子的樹狀結構：哪個詞修飾哪個詞，哪個動詞管轄哪些論元。古典自然語言處理花了二十年把兩者磨細。然後深度學習把它們壓成預訓練 transformer 上的 token 分類任務，研究社群就往前走了。

應用社群沒有。每條結構化抽取管線底下仍用詞性和依存樹。大型語言模型生成的 JSON，會拿文法約束來驗證。問答系統用依存剖析把查詢拆開。機器翻譯的品質評估器檢查剖析樹是否對齊。

值得知道。這一課介紹標記集、基準模型（baseline），以及你該停掉從零實作、改呼叫 spaCy 的那個點。

## The Concept｜核心概念

**詞性標記**給每個 token 一個文法類別。**Penn Treebank（PTB）**標記集是英文的預設。36 個標記，區分細到一般讀者覺得挑剔：`NN` 單數名詞、`NNS` 複數名詞、`NNP` 單數專有名詞、`VBD` 動詞過去式、`VBZ` 動詞第三人稱單數現在式，諸如此類。**Universal Dependencies（UD）**標記集較粗（17 個標記），而且不綁語言；它成了跨語言工作的預設。

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**句法剖析**產出一棵樹。兩種主要風格：

- **組成剖析（constituency parsing）。** 名詞組、動詞組、介系詞組彼此巢狀。輸出是非終端類別（NP、VP、PP）的樹，詞是葉子。
- **依存剖析（dependency parsing）。** 每個詞有一個它依存的中心詞，邊上標著文法關係。輸出是一棵樹，每條邊是（中心、依存項、關係）三元組。

依存剖析在 2010 年代贏了，因為它跨語言泛化（generalize）得乾淨，尤其是詞序自由的語言。

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

## Build It｜動手實作

### 步驟 1：最常見標記的基準模型

最笨、但行得通的詞性標註器。每個詞預測它在訓練裡最常出現的標記。

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

在 Brown 語料庫（corpus）上，這個基準模型大約 85% 準確率（accuracy）。不好，但它是下限：認真的模型不該掉到這下面。

### 步驟 2：二元 n-gram 的 HMM 標註器

把序列的聯合機率建模成：

```
P(tags, words) = prod P(tag_i | tag_{i-1}) * P(word_i | tag_i)
```

兩張表：轉移機率（transition probability，給定前一個標記的標記），發射機率（emission probability，給定標記的詞）。用拉普拉斯平滑（Laplace smoothing）從次數估計兩者。用維特比解碼（Viterbi decoding），也就是在標記格子上做動態規劃（dynamic programming）。

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

Brown 上的二元 n-gram HMM 大約 93% 準確率。從 85% 跳到 93%，主要是轉移機率——模型學到 `DET NOUN` 常見、`NOUN DET` 稀有。

### 步驟 3：為什麼現代標註器打得過這個

轉移機率和發射機率都是局部的。它們抓不到 `saw` 在「I bought a saw」裡是名詞，在「I saw the movie.」裡是動詞。帶任意特徵（feature）的條件隨機場（conditional random field）大約 97%：詞尾、詞形、前後的詞、這個詞本身。BiLSTM-CRF 或 transformer 大約 98% 以上。

這個任務的天花板由標註者的不一致決定。人類標註者在 Penn Treebank 上大約 97% 的時候意見一致。超過 98% 的模型，大概是在過度擬合（overfitting）測試集。

### 步驟 4：依存剖析草圖

從零做完整的依存剖析超出這一課。標準教科書講法在 Jurafsky 和 Martin。要知道的兩支古典家族：

- **基於轉移（transition-based）**的剖析器（arc-eager、arc-standard）像移進－歸約剖析器：讀 token，移進堆疊，再做歸約動作造出邊。貪婪解碼很快。經典實作是 MaltParser。現代神經版本：Chen 和 Manning 的基於轉移剖析器。
- **基於圖（graph-based）**的剖析器（Eisner 演算法（algorithm）、Dozat-Manning 雙仿射）為每條可能的中心－依存邊打分，再挑最大權重生成樹（maximum spanning tree）。較慢，但較準。

多數應用工作，呼叫 spaCy：

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

把 `dep` 欄由下往上讀，句子的文法結構就自己出現。

## Use It｜實際應用

每個正式環境的自然語言處理函式庫（library）都把詞性和依存剖析器放進標準管線。

- **spaCy**（`en_core_web_sm`／`md`／`lg`／`trf`）。快、準，和 tokenization、命名實體辨識（named entity recognition）、詞形還原接在一起。`token.tag_`（Penn）、`token.pos_`（UD）、`token.dep_`（依存關係）。
- **Stanford NLP（stanza）**。Stanford 推出的 CoreNLP 後繼系統。在 60 多種語言上達到最先進水準。
- **trankit**。以 transformer 為基礎，UD 準確率好。
- **NLTK**。`pos_tag`。能用、慢、較舊。教學夠用。

### 這在 2026 年哪裡仍然要緊

- **詞形還原。** 第 01 課要詞性才能正確還原。永遠要。
- **從大型語言模型輸出做結構化抽取。** 驗證生成的句子遵守文法約束（例如主詞和動詞一致、必要的修飾語）。
- **面向情感分析（aspect-based sentiment）。** 依存剖析告訴你哪個形容詞修飾哪個名詞。
- **查詢理解。** 「movies directed by Wes Anderson starring Bill Murray」經由剖析拆成結構化約束。
- **跨語言遷移。** UD 標記和依存關係不綁語言，所以能對新語言做零樣本（zero-shot）的結構化分析。
- **算力低的管線。** 如果你無法交付 transformer，詞性加依存剖析加專名表（gazetteer）可以走得意外地遠。

## Ship It｜交付成果

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

## Exercises｜練習

1. **簡單。** 在一份小的已標記語料庫（例如 NLTK 的 Brown 子集）上用最常見標記基準模型，量留出句子的準確率。驗證大約 85% 的結果。
2. **中等。** 訓練上面的二元 n-gram HMM，報每個標記的精確率（precision）和召回率（recall）。HMM 最常搞混哪些標記？
3. **困難。** 用 spaCy 的依存剖析，從 1000 句樣本抽出主詞－動詞－受詞三元組。在 50 筆人工標好的三元組上評估。寫下抽取在哪裡失敗（常常是被動、並列，以及省略的主詞）。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 詞性標記 | 詞的類型 | 文法類別。PTB 有 36 個；UD 有 17 個。 |
| Penn Treebank | 標準標記集 | 專給英文。動詞時態和名詞數量分得很細。 |
| Universal Dependencies | 多語標記集 | 比 PTB 粗；語言中立；跨語言工作的預設。 |
| 依存剖析 | 句子的樹 | 每個詞有一個中心，每條邊有一個文法關係。 |
| 維特比 | 動態規劃 | 給定發射和轉移，找出機率最高的標記序列。 |

## Further Reading｜延伸閱讀

- [Jurafsky and Martin — Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/) ——詞性和剖析的標準教科書講法。
- [Universal Dependencies project](https://universaldependencies.org/) ——每個多語剖析器都在用的跨語言標記集和樹庫。
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features) ——`Token` 上每個屬性的實務參考。
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf) ——把神經剖析器帶進主流的論文。
