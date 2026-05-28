# Transformer 以前のテキスト生成 — N-gram 言語モデル

> ある単語が予想外なら、そのモデルは悪いモデルです。Perplexity は予想外さを数値にします。Smoothing はそれを有限に保ちます。

**種類:** 構築
**言語:** Python
**前提:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**所要時間:** 約45分

## 問題

transformer より前、RNN より前、単語埋め込みより前の言語モデルは、直前の `n-1` 語のあとに次の語がどれだけ頻繁に続いたかを数えて次単語を予測していました。"the cat" → "sat" が47回、"the cat" → "jumped" が12回、"the cat" → "refrigerator" が0回、と数えます。それを正規化して確率分布を得ます。

これが n-gram 言語モデルです。1980年から2015年ごろまで、あらゆる音声認識器、スペルチェッカー、フレーズベース機械翻訳システムを支えていました。安価なオンデバイス言語モデリングが必要な場面では、今でも動いています。

面白い問題は、未観測の n-gram をどう扱うかです。生のカウントベースのモデルは、見たことがないものに確率0を割り当てます。文は長く、ほぼすべての長文には少なくとも1つの未観測系列が含まれるため、これは致命的です。50年にわたる smoothing 研究がこれを解決しました。その到達点が Kneser-Ney smoothing であり、現代の深層学習もその実証的な伝統を受け継いでいます。

## コンセプト

![N-gram モデル: 数える、平滑化する、生成する](../assets/ngram.svg)

**N-gram 確率:** `P(w_i | w_{i-n+1}, ..., w_{i-1})`。`n` を固定します（典型的には trigram なら3、4-gram なら4）。カウントから次のように計算します。

```text
P(w | context) = count(context, w) / count(context)
```

**ゼロカウント問題。** 訓練中に見なかった n-gram は確率0になります。Brown corpus に関する2007年の研究では、4-gram モデルでさえ、ホールドアウトされた 4-gram の30%が訓練中に未観測でした。smoothing なしでは、現実のテキストを評価できません。

**Smoothing 手法。洗練度の順に並べると次のとおりです。**

1. **Laplace (add-one)。** すべてのカウントに1を足します。単純ですが、希少イベントでは非常に悪いです。
2. **Good-Turing。** frequency-of-frequencies に基づいて、高頻度イベントから未観測イベントへ確率質量を再配分します。
3. **Interpolation。** n-gram、(n-1)-gram などの推定値を、調整可能な重みで組み合わせます。
4. **Backoff。** n-gram のカウントが0なら、(n-1)-gram にフォールバックします。Katz backoff はこれを正規化します。
5. **Absolute discounting。** すべてのカウントから固定の割引値 `D` を引き、未観測へ再配分します。
6. **Kneser-Ney。** Absolute discounting に加え、低次モデルの選び方を工夫します。生の頻度ではなく、*continuation probability*（その単語がいくつの文脈に現れるか）を使います。

Kneser-Ney の洞察は深いものです。"San Francisco" は一般的な bigram です。Unigram の "Francisco" はほとんど "San" の後に現れます。素朴な absolute discounting では、カウントが高いため "Francisco" に高い unigram 確率を与えます。Kneser-Ney は、"Francisco" が1つの文脈にしか現れないことに気づき、それに応じて continuation probability を下げます。結果として、"Francisco" で終わる新しい bigram には適切に低い確率が与えられます。

**評価: perplexity。** ホールドアウトされたテストセット上で、単語あたり平均負対数尤度を指数化したものです。低いほど良いです。perplexity が100であるとは、そのモデルが100語の中から一様に選ぶ場合と同じくらい迷っている、という意味です。

```text
perplexity = exp(- (1/N) * Σ log P(w_i | context_i))
```

## 構築

### Step 1: trigram カウント

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

入力はトークン化済み文のリストです。出力は n-gram カウントと文脈カウントです。`<s>` と `</s>` は文境界です。

### Step 2: Laplace smoothing

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

すべてのカウントに1を足します。平滑化はできますが、未観測イベントに確率質量を割り当てすぎるため、観測済みの希少イベントにも悪影響を与えます。

### Step 3: Kneser-Ney（bigram、補間版）

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

動く部品は3つです。`continuation_prob` は「この単語はいくつの異なる文脈に現れるか」を捉えます（Kneser-Ney の新規性）。`lambda_prev` は割引によって解放された確率質量で、backoff の重み付けに使われます。最終的な確率は、割引された主項と、重み付き continuation 項の和です。

### Step 4: サンプリングによるテキスト生成

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

確率に比例してサンプリングします。seed ごとに常に異なる出力になります。beam search 風の出力が欲しい場合は、各ステップで argmax を選び（greedy）、小さなランダム性のつまみ（temperature）を追加します。

### Step 5: perplexity

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

低いほど良いです。Brown corpus では、よく調整された 4-gram KN モデルが perplexity 約140に到達します。同じテストセットで transformer LM は15から30に到達します。差は約10倍です。この差が、分野が次へ進んだ理由です。

## 使いどころ

- **古典的 NLP の教育。** smoothing、MLE、perplexity をもっとも明快に学べる題材です。
- **KenLM。** 本番向け n-gram ライブラリです。低レイテンシが重要な音声認識や MT システムで、リスコアラーとして使われます。
- **オンデバイス補完。** キーボード内の trigram モデルです。今でも使われています。
- **ベースライン。** ニューラル LM が良いと宣言する前に、必ず n-gram LM の perplexity を計算します。transformer が KN を大きく上回らないなら、何かがおかしいです。

## 仕上げ

`outputs/prompt-lm-baseline.md` として保存します。

```markdown
---
name: lm-baseline
description: ニューラル LM を訓練する前に、再現可能な n-gram 言語モデルのベースラインを構築する。
phase: 5
lesson: 16
---

コーパスと目的（次単語予測、リスコアリング、パープレキシティのベースライン）が与えられたら、次を出力する。

1. N-gram の次数。一般的な英語なら trigram、コーパスが大きければ 4-gram、音声認識のリスコアリングなら 5-gram。
2. Smoothing。デフォルトは Modified Kneser-Ney。Laplace は教育用に限る。
3. ライブラリ。本番では `kenlm`、教育用途では `nltk.lm`、自作は学習目的に限る。
4. 評価。訓練セットとテストセットで一貫したトークン化を使い、ホールドアウトの perplexity を測る。

比較対象のシステム間で異なるトークン化を使って計算された perplexity は報告しない。perplexity の値は、同一のトークン化の下でのみ比較できる。テストセットの OOV 率を指摘する。訓練時に特別な <UNK> トークンを予約していない限り、KN は OOV をうまく扱えない。
```

## 演習

1. **Easy。** 1,000文の Shakespeare コーパスで trigram LM を訓練します。20文を生成します。局所的にはもっともらしいが、大域的には一貫性のない文になるはずです。これは定番のデモです。
2. **Medium。** ホールドアウトした Shakespeare split で、自分の KN モデルの perplexity を実装します。Laplace と比較します。KN によって perplexity が30から50%下がるはずです。
3. **Hard。** trigram スペル修正器を構築します。誤綴りの単語とその文脈が与えられたら、修正候補を生成し、LM の文脈確率で順位付けします。Birkbeck spelling corpus（公開）で評価します。

## 重要用語

| 用語 | よく言われる意味 | 実際の意味 |
|------|-----------------|-----------------------|
| N-gram | 単語列 | `n` 個の連続するトークンの列。 |
| Smoothing | ゼロを避けること | 未観測イベントが非ゼロ確率を得るように、確率質量を再配分すること。 |
| Perplexity | LM の品質指標 | ホールドアウトデータ上の `exp(-average log-prob)`。低いほど良い。 |
| Backoff | 短い文脈へのフォールバック | trigram カウントが0なら bigram を使う。Katz backoff はこれを形式化したもの。 |
| Kneser-Ney | n-gram に最良の smoothing | Absolute discounting + 低次モデルに対する continuation probability。 |
| Continuation probability | KN 固有 | 生カウントではなく、`w` が現れる文脈数で重み付けした `P(w)`。 |

## 参考資料

- [Jurafsky and Martin — Speech and Language Processing, Chapter 3 (2026 draft)](https://web.stanford.edu/~jurafsky/slp3/3.pdf) — n-gram LM と smoothing の標準的な解説。
- [Chen and Goodman (1998). An Empirical Study of Smoothing Techniques for Language Modeling](https://dash.harvard.edu/handle/1/25104739) — Kneser-Ney を最良の n-gram smoothing として定着させた論文。
- [Kneser and Ney (1995). Improved Backing-off for M-gram Language Modeling](https://ieeexplore.ieee.org/document/479394) — 元の KN 論文。
- [KenLM](https://kheafield.com/code/kenlm/) — 高速な本番向け n-gram LM。2026年でもレイテンシに敏感なアプリケーションで使われている。
