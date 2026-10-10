# 文字前處理（preprocessing）：tokenization、詞幹提取（stemming）、詞形還原（lemmatization）

> 語言是連續的。模型是離散的。前處理是中間那座橋。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## The Problem｜問題

模型讀不了「The cats were running.」。它讀的是整數。

每個自然語言處理系統一開始都問同樣三個問題。一個詞從哪裡開始。這個詞的詞根是什麼。什麼時候把「run」、「running」、「ran」當成同一個東西有幫助，什麼時候又必須分開。

tokenization 弄錯，模型就在垃圾上學。如果你的 tokenizer 把 `don't` 當成一個 token，卻把 `do n't` 當成兩個，訓練分布就裂開。如果詞幹提取把 `organization` 和 `organ` 併成同一個詞幹，主題模型就完了。如果詞形還原需要詞性脈絡，你卻沒傳進去，動詞會被當成名詞。

這一課從零做出這三個前處理步驟，再看 NLTK 和 spaCy 怎麼做同一件事，好讓你看見取捨。

## The Concept｜核心概念

三個操作。每個都有自己的工作，也有自己的失敗方式。

**tokenization** 把字串切成 token。「token」故意說得含糊，因為對的粒度看任務。古典自然語言處理用詞級。transformer 用子詞（subword）。沒有空白的語言用字元。

**詞幹提取**用規則砍掉詞尾。快、兇、笨。`running -> run`。`organization -> organ`。第二個就是失敗方式。

**詞形還原**用文法知識把詞收回字典形式。較慢、較準，需要查表或構詞分析器。`ran -> run`（得知道「ran」是「run」的過去式）。`better -> good`（得知道比較級）。

經驗法則。速度要緊、又忍得了雜訊時做詞幹提取（搜尋索引、粗分類）。意思要緊時做詞形還原（問答、語意搜尋、使用者會讀到的東西）。

```figure
edit-distance
```

## Build It｜動手實作

### 步驟 1：正規表示式的詞 tokenizer

最簡單、又真的有用的 tokenizer，在非英數的地方切開，同時把標點自己留成 token。不完美，也不是最終版，但一行就跑得起來。

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

依優先順序有三種樣式。詞可以帶一個內部撇號（`don't`、`it's`）。純數字。任何單一的、非空白、非英數的字元，自己當一個 token（標點）。

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

要注意的失敗方式。`3pm` 會拆成 `['3', 'pm']`，因為字母串和數字串是輪流匹配的。對多數任務夠用。網址、電子郵件、主題標籤全都會壞。正式環境要在通用規則前面先加樣式。

### 步驟 2：Porter 詞幹提取器（只做步驟 1a）

完整的 Porter 演算法（algorithm）有五段規則。單是步驟 1a 就蓋住英文最常見的詞尾，也把這個模式教清楚。

```python
def stem_step_1a(word):
    if word.endswith("sses"):
        return word[:-2]
    if word.endswith("ies"):
        return word[:-2]
    if word.endswith("ss"):
        return word
    if word.endswith("s") and len(word) > 1:
        return word[:-1]
    return word
```

```python
>>> [stem_step_1a(w) for w in ["caresses", "ponies", "caress", "cats"]]
['caress', 'poni', 'caress', 'cat']
```

規則由上往下讀。`ies -> i` 這條就是 `ponies -> poni` 而不是 `pony` 的原因。真正的 Porter 有步驟 1b 會把它修好。規則彼此競爭。較早的規則贏。順序比任何單一規則都重要。

### 步驟 3：查表的詞形還原器

真正的詞形還原需要構詞。教學上做得到的版本，用一張小的詞條表，再加一條退路。

```python
LEMMA_TABLE = {
    ("running", "VERB"): "run",
    ("ran", "VERB"): "run",
    ("runs", "VERB"): "run",
    ("better", "ADJ"): "good",
    ("best", "ADJ"): "good",
    ("cats", "NOUN"): "cat",
    ("cat", "NOUN"): "cat",
    ("were", "VERB"): "be",
    ("was", "VERB"): "be",
    ("is", "VERB"): "be",
}

def lemmatize(word, pos):
    key = (word.lower(), pos)
    if key in LEMMA_TABLE:
        return LEMMA_TABLE[key]
    if pos == "VERB" and word.endswith("ing"):
        return word[:-3]
    if pos == "NOUN" and word.endswith("s"):
        return word[:-1]
    return word.lower()
```

```python
>>> lemmatize("running", "VERB")
'run'
>>> lemmatize("cats", "NOUN")
'cat'
>>> lemmatize("better", "ADJ")
'good'
>>> lemmatize("watched", "VERB")
'watched'
```

最後一個例子才是要教的地方。`watched` 不在表裡，而退路只處理 `ing`。真正的詞形還原還要蓋住 `ed`、不規則動詞、比較級形容詞，以及讀音會變的複數（`children -> child`）。所以正式環境的系統用 WordNet、spaCy 的構詞器，或完整的構詞分析器。

### 步驟 4：把它們接起來

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

缺的那一塊是詞性標註器（POS tagger）。第 5 階段第 07 課（詞性標記）會做一個。現在先全部預設成 `NOUN`，並承認這個限制。

## Use It｜實際應用

NLTK 和 spaCy 交付的是正式環境版本。各幾行。

### NLTK

```python
import nltk
nltk.download("punkt_tab")
nltk.download("wordnet")
nltk.download("averaged_perceptron_tagger_eng")

from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer, WordNetLemmatizer
from nltk import pos_tag

text = "The cats were running."
tokens = word_tokenize(text)
stems = [PorterStemmer().stem(t) for t in tokens]
lemmatizer = WordNetLemmatizer()
tagged = pos_tag(tokens)


def nltk_pos_to_wordnet(tag):
    if tag.startswith("V"):
        return "v"
    if tag.startswith("J"):
        return "a"
    if tag.startswith("R"):
        return "r"
    return "n"


lemmas = [lemmatizer.lemmatize(t, nltk_pos_to_wordnet(tag)) for t, tag in tagged]
```

`word_tokenize` 處理縮寫、Unicode，以及你的正規表示式會漏的邊界。`PorterStemmer` 跑完整五段。`WordNetLemmatizer` 需要把詞性標記從 NLTK 的 Penn Treebank 方案，翻成 WordNet 的縮寫集合。上面那段轉接，是多數教學會跳過的部分。

### spaCy

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running.")

for token in doc:
    print(token.text, token.lemma_, token.pos_)
```

```
The      the     DET
cats     cat     NOUN
were     be      AUX
running  run     VERB
.        .       PUNCT
```

spaCy 把整條管線（pipeline）藏在 `nlp(text)` 後面。tokenization、詞性標記、詞形還原一起跑。規模一大，比 NLTK 快。開箱就比較準。代價是你不容易把個別元件換掉。

### 什麼時候選哪一個

| 情況 | 選擇 |
|-----------|------|
| 教學、研究、要換元件 | NLTK |
| 正式環境、多語言、速度要緊 | spaCy |
| transformer 管線（反正會用模型自己的 tokenizer） | 用 `tokenizers`／`transformers`，跳過古典前處理 |

### 沒人警告你的兩種失敗

多數教學講完演算法就停。真正的前處理管線會被兩件事咬到，而且幾乎沒人講。

**可重現性漂掉。** NLTK 和 spaCy 換版本，tokenization 和詞形還原的行為會變。spaCy 2.x 產出 `['do', "n't"]` 的，3.x 可能產出 `["don't"]`。模型在一種分布上訓練。推論卻跑在另一種上。準確率在不知不覺中下降，沒人知道為什麼。把函式庫（library）版本釘在 `requirements.txt`。寫一個前處理回歸測試，把 20 句樣本的預期 tokenization 凍住。每次升級都跑。

**訓練和推論不一致。** 訓練時前處理很兇（小寫、拿掉停用詞、做詞幹提取），部署時卻吃使用者的原文，表現就垮了。這是正式環境自然語言處理最常見的失敗。訓練時做了前處理，推論就必須跑同一個函式。把前處理當成模型套件裡的函式交出去，不要留成 notebook 裡的一格，讓上線的人重寫。

## Ship It｜交付成果

一份可以重複用的 prompt，幫工程師挑前處理策略，不用先讀三本教科書。

存成 `outputs/prompt-preprocessing-advisor.md`：

```markdown
---
name: preprocessing-advisor
description: Recommends a tokenization, stemming, and lemmatization setup for an NLP task.
phase: 5
lesson: 01
---

You advise on classical NLP preprocessing. Given a task description, you output:

1. Tokenization choice (regex, NLTK word_tokenize, spaCy, or transformer tokenizer). Explain why.
2. Whether to stem, lemmatize, both, or neither. Explain why.
3. Specific library calls. Name the functions. Quote the POS-tag translation if NLTK is involved.
4. One failure mode the user should test for.

Refuse to recommend stemming for user-visible text. Refuse to recommend lemmatization without POS tags. Flag non-English input as needing a different pipeline.
```

## Exercises｜練習

1. **簡單。** 擴充 `tokenize`，讓網址保持成單一 token。測試：`tokenize("Visit https://example.com today.")` 應該產出一個網址 token。
2. **中等。** 實作 Porter 步驟 1b。如果一個詞含有母音，而且以 `ed` 或 `ing` 結尾，就拿掉。處理雙子音規則（`hopping -> hop`，不是 `hopp`）。
3. **困難。** 做一個詞形還原器，用 WordNet 當查表，WordNet 沒有條目時退回你的 Porter 詞幹提取器。在一份標好詞性的語料上，和純 WordNet、純 Porter 比準確率。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| token | 一個詞 | 模型吃進去的單位。可以是詞、子詞（subword）、字元或位元組。 |
| 詞幹 | 一個詞的根 | 用規則剝掉詞尾的結果。不一定是真的詞。 |
| 詞條 | 字典形式 | 你會去查的那個形式。要算對，需要文法脈絡。 |
| 詞性標記 | 詞類 | NOUN、VERB、ADJ 這類標記。要準確做詞形還原就需要它。 |
| 構詞 | 詞形規則 | 詞怎麼因時態、數量、格而變形。詞形還原靠它。 |

## Further Reading｜延伸閱讀

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt) ——原始論文，五頁，到現在仍是最清楚的說明。
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features) ——真正的管線怎麼接起來。
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html) ——你還沒想到的 tokenization 邊界。

