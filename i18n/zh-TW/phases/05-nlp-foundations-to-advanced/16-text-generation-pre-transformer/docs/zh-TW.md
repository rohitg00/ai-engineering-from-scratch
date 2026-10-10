# 文字生成在 transformer 之前——n-gram 語言模型

> 一個詞若讓人意外，模型就不好。困惑度（perplexity）把意外變成一個數字。平滑（smoothing）讓它保持有限。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## The Problem｜問題

在 transformer 之前、在循環神經網路（recurrent neural network）之前、在 word embedding 之前，語言模型靠計數預測下一個詞：它在前 `n-1` 個詞之後出現過幾次。數到「the cat」後面是「sat」47 次、「jumped」12 次、「refrigerator」0 次。正規化（normalization）成一個機率分布。

那就是 n-gram 語言模型。從 1980 到 2015，每個語音辨識器、每個拼字檢查、每套片語式機器翻譯都在跑它。當你需要便宜、在裝置（device）上的語言建模，它現在還在跑。

有意思的問題是沒看過的 n-gram 怎麼辦。純計數模型把沒看過的東西機率設成零。這是災難，因為句子很長，幾乎每句長句都至少有一段沒看過的序列。五十年的平滑研究修了這件事。Kneser-Ney 平滑是那個結果，現代深度學習繼承了它的經驗傳統。

## The Concept｜核心概念

![N-gram model: count, smooth, generate](../assets/ngram.svg)

### 預測遊戲

這套機器存在之前，有一個實驗定義了什麼是語言模型。蓋住英文句子的下一個字母。請人一次猜一個，猜到對為止。記下猜測次數。對幾百個字母重複。

猜測次數不是冷知識。它們是文本的無損再編碼：把次數序列交給第二個、一模一樣的猜測者，他們能重建每個字母，因為每個位置他們都知道哪些猜測排在前面。能用更少符號再編碼的訊息，每個符號攜帶的資訊較少，所以猜測次數的統計給英文的熵（entropy）一個上限。

Shannon 在 1951 年跑了這個，得到一個至今仍主導這個領域的數字。27 個符號的字母表（26 個字母加空白）每個字母最多能帶 `log2(27) ≈ 4.75` 位元。有 100 個字母脈絡的人類猜測者，落在每個字母 0.6 到 1.3 位元。英文中字母約有四分之三可由脈絡大致預測。模型必須學的結構，在任何模型學得會之前就量過了。

此後每個語言模型都是這個遊戲的機械玩家，這一課的每個評估數字都是這個遊戲的分數：

- **交叉熵（cross-entropy）損失**是模型每個符號平均需要的位元數。訓練語言模型，字面上就是在最小化它在猜測遊戲的分數。
- **困惑度**是 `2^bits`（或 `e^nats`）：模型猜完之後仍需面對的選項數（branching factor）。在 27 個符號上均勻猜，困惑度是 27；每個字母 1 位元的玩家，困惑度是 2。
- **脈絡長度是玩家的記憶。** 三元模型（trigram model）用兩個 token 的記憶來玩。transformer 用 10 萬個 token 玩同一個遊戲。規則沒變；玩家變好了。

有一個單位轉換要盯住：遊戲以位元（`log2`）按字母計分，下面的 n-gram 公式以 nat（自然對數）按詞 token 計分——而 nat 裡的困惑度 `e^H` 等於位元裡的 `2^H`，所以兩個看法是同一種量測、不同單位。

```figure
prediction-game
```

**N-gram 機率：** `P(w_i | w_{i-n+1}, ..., w_{i-1})`。固定 `n`（通常三元是 3，四元是 4）。從計數算出：

```text
P(w | context) = count(context, w) / count(context)
```

**零計數問題。** 訓練裡沒看過的 n-gram 機率是零。2007 年在 Brown 語料庫（corpus）上的研究發現，即使四元模型，留出集合裡仍有 30% 的四元在訓練中沒出現。不做平滑，你無法在任何真實文本上評估。

**平滑做法，由粗到細：**

1. **拉普拉斯平滑（加一）。** 每個計數加 1。簡單，在罕見事件上很糟。
2. **Good-Turing。** 依頻率的頻率，把機率質量從較高頻事件挪給沒看過的。
3. **插值。** 用可調權重，把 n-gram、(n-1)-gram 等等的估計合在一起。
4. **後退。** n-gram 計數是零，就退回 (n-1)-gram。Katz 後退把這件事正規化。
5. **絕對折扣。** 從所有計數減去固定折扣 `D`，再分給沒看過的。
6. **Kneser-Ney。** 絕對折扣，再加上對較低階模型的一個聰明選擇：用*延續機率*（一個詞出現在多少種脈絡裡），不用原始頻率。

Kneser-Ney 的洞見很深。「San Francisco」是常見的二元組。一元的「Francisco」大多出現在「San」之後。單純的絕對折扣會給「Francisco」很高的一元機率（因為計數高）。Kneser-Ney 注意到「Francisco」只出現在一種脈絡，於是把延續機率調低。結果：一個以「Francisco」結尾的新二元組，得到該有的低機率。

**評估：困惑度。** 留出測試集上，每個詞平均負對數概似（negative log-likelihood）的指數。越低越好。困惑度 100 表示模型和在 100 個詞裡均勻挑一樣困惑。

```text
perplexity = exp(- (1/N) * Σ log P(w_i | context_i))
```

```figure
ngram-backoff
```

## Build It｜動手實作

### 步驟 1：三元計數

```python
from collections import Counter, defaultdict


def train_ngram(corpus_tokens, n=3):
    ngrams = Counter()
    contexts = Counter()
    for sentence in corpus_tokens:
        padded = ["<s>"] * (n - 1) + sentence + ["</s>"]
        for i in range(len(padded) - n + 1):
            ctx = tuple(padded[i:i + n - 1])
            word = padded[i + n - 1]
            ngrams[ctx + (word,)] += 1
            contexts[ctx] += 1
    return ngrams, contexts


def raw_probability(ngrams, contexts, context, word):
    ctx = tuple(context)
    if contexts.get(ctx, 0) == 0:
        return 0.0
    return ngrams.get(ctx + (word,), 0) / contexts[ctx]
```

輸入是已做 tokenization 的句子列表。輸出是 n-gram 計數和脈絡計數。`<s>` 和 `</s>` 是句子邊界。

### 步驟 2：拉普拉斯平滑

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

每個計數加 1。平滑了，但把太多質量分給沒看過的事件，連罕見但見過的事件也受傷。

### 步驟 3：Kneser-Ney（二元，插值）

```python
def kneser_ney_bigram_model(corpus_tokens, discount=0.75):
    unigrams = Counter()
    bigrams = Counter()
    unigram_contexts = defaultdict(set)

    for sentence in corpus_tokens:
        padded = ["<s>"] + sentence + ["</s>"]
        for i, w in enumerate(padded):
            unigrams[w] += 1
            if i > 0:
                prev = padded[i - 1]
                bigrams[(prev, w)] += 1
                unigram_contexts[w].add(prev)

    total_unique_bigrams = sum(len(ctx_set) for ctx_set in unigram_contexts.values())
    continuation_prob = {
        w: len(ctx_set) / total_unique_bigrams for w, ctx_set in unigram_contexts.items()
    }

    context_totals = Counter()
    for (prev, w), count in bigrams.items():
        context_totals[prev] += count

    unique_follow = defaultdict(set)
    for (prev, w) in bigrams:
        unique_follow[prev].add(w)

    def prob(prev, w):
        count = bigrams.get((prev, w), 0)
        denom = context_totals.get(prev, 0)
        if denom == 0:
            return continuation_prob.get(w, 1e-9)
        first_term = max(count - discount, 0) / denom
        lambda_prev = discount * len(unique_follow[prev]) / denom
        return first_term + lambda_prev * continuation_prob.get(w, 1e-9)

    return prob
```

三個關鍵組成部分。`continuation_prob` 捕捉「這個詞出現在多少種不同脈絡？」（Kneser-Ney 的創新）。`lambda_prev` 是折扣釋放出的質量，用來加權後退。最終機率是折扣後的主項，加上加權的延續項。

### 步驟 4：用取樣生成文字

```python
import random


def generate(prob_fn, vocab, prefix, max_len=30, seed=0):
    rng = random.Random(seed)
    tokens = list(prefix)
    for _ in range(max_len):
        candidates = [(w, prob_fn(tokens[-1], w)) for w in vocab]
        total = sum(p for _, p in candidates)
        r = rng.random() * total
        acc = 0.0
        for w, p in candidates:
            acc += p
            if r <= acc:
                tokens.append(w)
                break
        if tokens[-1] == "</s>":
            break
    return tokens
```

依機率取樣（sampling）。每個種子的輸出都不同。要像集束搜尋（beam search）的輸出，每步取 argmax（貪婪），再加一個小的隨機旋鈕（溫度，temperature）。

### 步驟 5：困惑度

```python
import math


def perplexity(prob_fn, sentences):
    total_log_prob = 0.0
    total_tokens = 0
    for sentence in sentences:
        padded = ["<s>"] + sentence + ["</s>"]
        for i in range(1, len(padded)):
            p = prob_fn(padded[i - 1], padded[i])
            total_log_prob += math.log(max(p, 1e-12))
            total_tokens += 1
    return math.exp(-total_log_prob / total_tokens)
```

越低越好。Brown 語料庫上，調校好的四元 KN 模型困惑度大約 140。transformer 語言模型在同一測試集上是 15 到 30。差距大約 10 倍。這個差距是這個領域往前走的原因。

## Use It｜實際應用

- **古典 NLP 教學。** 你能碰到的、對平滑、最大概似（maximum likelihood，MLE）和困惑度最清楚的入門教材。
- **KenLM。** 正式環境（production）的 n-gram 函式庫（library）。在延遲（latency）要緊的語音和機器翻譯系統裡當重打分器。
- **裝置上的自動完成。** 鍵盤裡的三元模型。現在還是。
- **基準模型（baseline）。** 在宣布神經語言模型好之前，永遠先算 n-gram 語言模型的困惑度。若你的 transformer 沒有大幅贏過 KN，就有地方不對。

## Ship It｜交付成果

存成 `outputs/prompt-lm-baseline.md`：

```markdown
---
name: lm-baseline
description: Build a reproducible n-gram language model baseline before training a neural LM.
phase: 5
lesson: 16
---

Given a corpus and target use (next-word prediction, rescoring, perplexity baseline), output:

1. N-gram order. Trigram for general English, 4-gram if corpus is large, 5-gram for speech rescoring.
2. Smoothing. Modified Kneser-Ney is the default; Laplace only for teaching.
3. Library. `kenlm` for production, `nltk.lm` for teaching, roll your own only to learn.
4. Evaluation. Held-out perplexity with consistent tokenization between train and test sets.

Refuse to report perplexity computed with different tokenization between systems being compared — perplexity numbers are comparable only under identical tokenization. Flag OOV rate in test set; KN handles OOV poorly unless you reserve a special <UNK> token during training.
```

## Exercises｜練習

1. **簡單。** 在 1000 句莎士比亞語料庫上訓練三元語言模型。生成 20 句。局部會像，整體不連貫。這是標準示範。
2. **中等。** 在留出的莎士比亞分割上，為你的 KN 模型實作困惑度。對上拉普拉斯。你應該會看到 KN 把困惑度降低 30% 到 50%。
3. **困難。** 做一個三元拼字修正器：給一個拼錯的詞和它的脈絡，生成修正並用語言模型下的脈絡機率排序。在公開的 Birkbeck 拼字語料庫上評估。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| N-gram | 詞序列 | `n` 個連續 token 的序列。 |
| 平滑 | 避開零 | 重新分配機率質量，讓沒看過的事件得到非零機率。 |
| 困惑度 | 語言模型品質指標 | 留出資料上的 `exp(-average log-prob)`。越低越好。 |
| 後退 | 退回較短脈絡 | 三元計數是零，就用二元。Katz 後退把這件事形式化。 |
| Kneser-Ney | n-gram 最好的平滑 | 絕對折扣，加上較低階模型的延續機率。 |
| 延續機率 | KN 專用 | `P(w)` 按 `w` 出現的脈絡數加權，不按原始計數。 |
| 文本的熵 | 每個符號的資訊 | 給定脈絡，編碼下一個符號平均需要的位元。Shannon 1951 年對印刷英文、最多 100 個字母脈絡的估計：每個字母 0.6 到 1.3 位元，在任何模型存在之前就量過。 |

## Further Reading｜延伸閱讀

- [Shannon (1951). Prediction and Entropy of Printed English](https://www.princeton.edu/~wbialek/rome/refs/shannon_51.pdf) ——定義了每個語言模型到現在仍在最小化的目標的猜測遊戲實驗。
- [Jurafsky and Martin — Speech and Language Processing, Chapter 3 (2026 draft)](https://web.stanford.edu/~jurafsky/slp3/3.pdf) ——n-gram 語言模型和平滑的標準講法。
- [Chen and Goodman (1998). An Empirical Study of Smoothing Techniques for Language Modeling](https://dash.harvard.edu/handle/1/25104739) ——把 Kneser-Ney 定成最好的 n-gram 平滑器的論文。
- [Kneser and Ney (1995). Improved Backing-off for M-gram Language Modeling](https://ieeexplore.ieee.org/document/479394) ——原始 KN 論文。
- [KenLM](https://kheafield.com/code/kenlm/) ——很快的正式環境 n-gram 語言模型，2026 年在延遲敏感的應用裡仍在用。
