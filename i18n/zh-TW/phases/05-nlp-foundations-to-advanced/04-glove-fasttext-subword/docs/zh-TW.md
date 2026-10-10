# GloVe、FastText 與子詞 embedding

> Word2Vec 一個詞訓練一個 embedding。GloVe 把共現（co-occurrence）矩陣做了矩陣分解（matrix factorization）。FastText 把片段做成 embedding。BPE 接上了 transformer。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 03 (Word2Vec from Scratch)
**Time:** ~45 minutes

## The Problem｜問題

Word2Vec 留下兩個還沒回答的問題。

第一，另有一支研究方向直接分解共現矩陣（LSA、HAL），而不是逐筆做 skip-gram 更新。Word2Vec 的迭代做法是不是本質上更好，還是差別只是兩種方法處理計數方式造成的假象？**GloVe** 回答了：用一個挑過的損失函數（loss function）做矩陣分解，可以追平或超過 Word2Vec，而且訓練成本更低。

第二，兩種方法都沒有辦法處理沒看過的詞。`Zoomer-approved`、`dogecoin`、上週才造出來的專有名詞、稀有詞根的每一種屈折形式。**FastText** 用字元 n-gram 的 embedding 修了這件事：一個詞是它各部分的和，包含語素（morpheme），所以連詞彙表外（out-of-vocabulary）的詞也能得到一個說得通的向量。

第三，transformer 出現之後，問題又換了。詞級詞彙表（vocabulary）頂多到大約 100 萬筆；真實語言比這更開放。**位元組對編碼（byte-pair encoding，BPE）**和它的近親，用學出來的常見子詞（subword）單位當詞彙表，什麼都蓋得住。每個現代 LLM 的每個現代 tokenizer，都是子詞 tokenizer。

這一課把三條都走一遍，再說明什麼時候該伸手拿哪一個。

## The Concept｜核心概念

**GloVe（Global Vectors）。** 建立詞對詞的共現矩陣 `X`，`X[i][j]` 是詞 `j` 出現在詞 `i` 脈絡裡的次數。訓練向量，使 `v_i · v_j + b_i + b_j ≈ log(X[i][j])`。把損失加權，讓常見配對不會主導。就這樣。

**FastText。** 一個詞是它的字元 n-gram 加上詞本身的和。`where` 變成 `<wh, whe, her, ere, re>, <where>`。詞向量是這些成分向量的和。訓練方式和 Word2Vec 一樣。好處：沒看過的詞（`whereupon`）能用已知的 n-gram 組出來。

**BPE。** 從個別位元組（byte）或字元的詞彙表開始。數語料庫（corpus）裡每一對相鄰的配對。把最常出現的配對合併成一個新 token。重複 `k` 次。結果是 `k + 256` 個 token 的詞彙表：常見序列（`ing`、`tion`、`the`）是單一 token，稀有詞被拆成熟悉的片段。每個句子都能切分成 token 序列。

```figure
n5-subword-merge
```

## Build It｜動手實作

### GloVe：分解共現矩陣

```python
import numpy as np
from collections import Counter


def build_cooccurrence(docs, window=5):
    pair_counts = Counter()
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    for doc in docs:
        indexed = [vocab[t] for t in doc]
        for i, center in enumerate(indexed):
            for j in range(max(0, i - window), min(len(indexed), i + window + 1)):
                if i != j:
                    distance = abs(i - j)
                    pair_counts[(center, indexed[j])] += 1.0 / distance
    return vocab, pair_counts


def glove_train(vocab, pair_counts, dim=16, epochs=100, lr=0.05, x_max=100, alpha=0.75, seed=0):
    n = len(vocab)
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(n, dim))
    W_tilde = rng.normal(0, 0.1, size=(n, dim))
    b = np.zeros(n)
    b_tilde = np.zeros(n)

    for epoch in range(epochs):
        for (i, j), x_ij in pair_counts.items():
            weight = (x_ij / x_max) ** alpha if x_ij < x_max else 1.0
            diff = W[i] @ W_tilde[j] + b[i] + b_tilde[j] - np.log(x_ij)
            coef = weight * diff

            grad_W_i = coef * W_tilde[j]
            grad_W_tilde_j = coef * W[i]
            W[i] -= lr * grad_W_i
            W_tilde[j] -= lr * grad_W_tilde_j
            b[i] -= lr * coef
            b_tilde[j] -= lr * coef

    return W + W_tilde
```

有兩件事值得點名。加權函數 `f(x) = (x/x_max)^alpha` 把非常常見的配對（像 `(the, and)`）權重壓低，免得它們主導損失。最終的 embedding 是 `W`（中心）和 `W_tilde`（脈絡）兩張表的和。兩張都加進去是論文裡的手法，通常比只用一張好。

### FastText：看得到子詞的 embedding

```python
def char_ngrams(word, n_min=3, n_max=6):
    wrapped = f"<{word}>"
    grams = {wrapped}
    for n in range(n_min, n_max + 1):
        for i in range(len(wrapped) - n + 1):
            grams.add(wrapped[i:i + n])
    return grams
```

```python
>>> char_ngrams("where")
{'<where>', '<wh', 'whe', 'her', 'ere', 're>', '<whe', 'wher', 'here', 'ere>', '<wher', 'where', 'here>'}
```

每個詞用它的一組 n-gram 表示（通常 3 到 6 個字元）。word embedding 是這些 n-gram embedding 的和。做 skip-gram 訓練時，接到 Word2Vec 原本用單一向量的那個位置。

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

沒看過的詞仍然可以得到向量，只要它的某些 n-gram 是已知的。`whereupon` 和 `where` 共用 `<wh`、`her`、`ere` 和 `<where`，所以兩者會落在彼此附近。

### BPE：學出來的子詞詞彙表

```python
def learn_bpe(corpus, k_merges):
    vocab = Counter()
    for word, freq in corpus.items():
        tokens = tuple(word) + ("</w>",)
        vocab[tokens] = freq

    merges = []
    for _ in range(k_merges):
        pair_freq = Counter()
        for tokens, freq in vocab.items():
            for a, b in zip(tokens, tokens[1:]):
                pair_freq[(a, b)] += freq
        if not pair_freq:
            break
        best = pair_freq.most_common(1)[0][0]
        merges.append(best)

        new_vocab = Counter()
        for tokens, freq in vocab.items():
            new_tokens = []
            i = 0
            while i < len(tokens):
                if i + 1 < len(tokens) and (tokens[i], tokens[i + 1]) == best:
                    new_tokens.append(tokens[i] + tokens[i + 1])
                    i += 2
                else:
                    new_tokens.append(tokens[i])
                    i += 1
            new_vocab[tuple(new_tokens)] = freq
        vocab = new_vocab
    return merges


def apply_bpe(word, merges):
    tokens = list(word) + ["</w>"]
    for a, b in merges:
        new_tokens = []
        i = 0
        while i < len(tokens):
            if i + 1 < len(tokens) and tokens[i] == a and tokens[i + 1] == b:
                new_tokens.append(a + b)
                i += 2
            else:
                new_tokens.append(tokens[i])
                i += 1
        tokens = new_tokens
    return tokens
```

```python
>>> corpus = Counter({"low": 5, "lower": 2, "newest": 6, "widest": 3})
>>> merges = learn_bpe(corpus, k_merges=10)
>>> apply_bpe("lowest", merges)
['low', 'est</w>']
```

第一次迭代合併最常相鄰的配對。迭代夠多次之後，常見子字串（`low`、`est`、`tion`）變成單一 token，稀有詞則乾淨地拆開。

真正的 GPT、BERT、T5 tokenizer 學 3 萬到 10 萬次合併。結果：任何文字都切成一串長度有上界、而且全是已知 ID 的序列，永遠不會有詞彙表外的詞。

## Use It｜實際應用

實務上，你很少自己訓練這些。你載入預訓練的 checkpoint。

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

transformer 時代、BPE 風格的子詞 tokenization：

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

`Ġ` 前綴標記詞的邊界（GPT-2 的慣例）。每個現代 tokenizer 都是 BPE 的變體、WordPiece（BERT）或 SentencePiece（T5、LLaMA）。

### 什麼時候選哪一個

| 情況 | 選擇 |
|-----------|------|
| 預訓練的通用詞向量，不必處理 OOV | GloVe 300 維 |
| 預訓練的通用詞向量，必須處理拼錯、新造詞、構詞豐富的語言 | FastText |
| 任何要送進 transformer 的東西（訓練或推論（inference）） | 模型一起交出來的那個 tokenizer。絕對不要換。 |
| 從零訓練你自己的語言模型 | 先在你的語料庫上訓練 BPE 或 SentencePiece tokenizer |
| 正式環境裡用線性模型做文字分類 | 仍然用 TF-IDF。第 02 課。 |

## Ship It｜交付成果

存成 `outputs/skill-embeddings-picker.md`：

```markdown
---
name: tokenizer-picker
description: Pick a tokenization approach for a new language model or text pipeline.
version: 1.0.0
phase: 5
lesson: 04
tags: [nlp, tokenization, embeddings]
---

Given a task and dataset description, you output:

1. Tokenization strategy (word-level, BPE, WordPiece, SentencePiece, byte-level). One-sentence reason.
2. Vocabulary size target (e.g., 32k for an English-only LM, 64k-100k for multilingual).
3. Library call with the exact training command. Name the library. Quote the arguments.
4. One reproducibility pitfall. Tokenizer-model mismatch is the single most common silent production bug; call out which pair must be used together.

Refuse to recommend training a custom tokenizer when the user is fine-tuning a pretrained LLM. Refuse to recommend word-level tokenization for any model targeting production inference. Flag non-English / multi-script corpora as needing SentencePiece with byte fallback.
```

## Exercises｜練習

1. **簡單。** 跑 `char_ngrams("playing")` 和 `char_ngrams("played")`。算兩個 n-gram 集合的 Jaccard 重疊。你應該會看到大量共用片段（`pla`、`lay`、`play`），這就是 FastText 能在構詞變體之間轉移得好的原因。
2. **中等。** 擴充 `learn_bpe`，追蹤詞彙表怎麼長大。把每個語料字元對應幾個 token，畫成合併次數的函數。你應該會看到一開始壓縮很快，然後趨近每個 token 約 2 到 3 個字元。
3. **困難。** 在莎士比亞全集上訓練 1000 次合併的 BPE。比較常見詞和稀有專有名詞的 tokenization。量合併前後每個詞的平均 token 數。寫下什麼讓你意外。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 共現矩陣 | 詞對詞的頻率表 | `X[i][j]` 是詞 `j` 出現在詞 `i` 周圍視窗（window）裡的次數。 |
| 子詞 | 一個詞的片段 | 字元 n-gram（FastText），或學出來的 token（BPE／WordPiece／SentencePiece）。 |
| BPE | 位元組對編碼 | 反覆合併最常相鄰的配對，直到詞彙表達到目標大小。 |
| OOV | 詞彙表外 | 模型沒看過的詞。Word2Vec 和 GloVe 會失敗。FastText 和 BPE 處理得了。 |
| 位元組層級 BPE | 直接在原始位元組上做 BPE | GPT-2 的做法。詞彙表從 256 個位元組開始，所以永遠沒有 OOV。 |

## Further Reading｜延伸閱讀

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf) ——GloVe 論文，七頁，到現在仍是這個損失最好的推導。
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) ——FastText。
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) ——把 BPE 帶進現代自然語言處理的論文。
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) ——BPE、WordPiece、SentencePiece 在實務上到底差在哪。
