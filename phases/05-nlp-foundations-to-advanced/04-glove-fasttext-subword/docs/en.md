# GloVe、FastText、サブワード埋め込み

> Word2Vecは単語ごとに1つの埋め込みを学習した。GloVeは共起行列を分解した。FastTextは部品を埋め込んだ。BPEはtransformerへの橋を架けた。

**種類:** 実装
**言語:** Python
**前提:** フェーズ 5 · 03 (Word2Vec from Scratch)
**時間:** 約45分

## 問題

Word2Vecには2つの未解決の問いが残りました。

1つ目は、オンラインのskip-gram更新ではなく、共起行列を直接分解する研究の流れ (LSA、HAL) が並行して存在したことです。Word2Vecの反復的なアプローチは根本的に優れていたのでしょうか。それとも、2つの手法がカウントを扱う方法の違いが生んだ見かけの差だったのでしょうか。**GloVe** はこれに答えました。慎重に選んだ損失を使う行列分解はWord2Vecに匹敵、または上回り、学習コストも低くできます。

2つ目は、どちらの手法にも、見たことのない単語を扱う仕組みがなかったことです。`Zoomer-approved`、`dogecoin`、先週作られた固有名詞、まれな語根のあらゆる活用形。**FastText** は文字n-gramを埋め込むことでこれを解決しました。単語は形態素を含む部品の和なので、語彙外の単語にも妥当なベクトルを与えられます。

3つ目は、transformerが登場すると問いがもう一度変わったことです。単語単位の語彙は100万エントリ程度で限界に達しますが、実際の言語はもっと開いています。**Byte-pair encoding (BPE)** とその親戚は、あらゆる入力をカバーする頻出サブワード単位の語彙を学習することで、この問題を解きました。現代のすべてのLLMのtokenizerはサブワードtokenizerです。

このレッスンでは3つすべてを見たうえで、どれをいつ使うべきかを説明します。

## コンセプト

**GloVe (Global Vectors)。** 単語-単語の共起行列 `X` を作ります。`X[i][j]` は、単語 `i` の文脈に単語 `j` が現れる頻度です。`v_i · v_j + b_i + b_j ≈ log(X[i][j])` となるようにベクトルを学習します。頻出ペアが支配しないように損失に重みを付けます。以上です。

**FastText。** 単語は、その文字n-gramと単語自身の和です。`where` は `<wh, whe, her, ere, re>, <where>` になります。単語ベクトルは、それら構成要素ベクトルの和です。学習はWord2Vecと同じです。利点は、未知語 (`whereupon`) を既知のn-gramから合成できることです。

**BPE (Byte-Pair Encoding)。** 個々のbyte (または文字) の語彙から始めます。コーパス内のすべての隣接ペアを数えます。最頻のペアを新しいtokenにマージします。これを `k` 回繰り返します。結果として、頻出列 (`ing`、`tion`、`the`) は単一tokenになり、まれな単語は見慣れた部品に分解される、`k + 256` tokenの語彙が得られます。どんな文でもtoken化できます。

## 実装

### GloVe: 共起行列を分解する

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

名前を付けておくべき可動部分が2つあります。重み関数 `f(x) = (x/x_max)^alpha` は、`(the, and)` のような非常に頻出するペアの重みを下げ、損失を支配しないようにします。最終的な埋め込みは、`W` (中心語) と `W_tilde` (文脈語) のテーブルの和です。両方を足すのは公開論文で使われたテクニックで、片方だけを使うより性能がよくなる傾向があります。

### FastText: サブワードを考慮した埋め込み

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

各単語はn-gram集合、通常は3から6文字の集合で表されます。単語埋め込みは、そのn-gram埋め込みの和です。skip-gram学習では、Word2Vecが単一ベクトルを使っていた場所にこれを差し込みます。

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

未知語でも、そのn-gramの一部が既知であればベクトルが得られます。`whereupon` は `<wh`、`her`、`ere`、`<where` を `where` と共有するため、両者は近い位置に来ます。

### BPE: 学習されたサブワード語彙

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

最初の反復では、最も頻度の高い隣接ペアをマージします。十分な回数を重ねると、頻出部分文字列 (`low`、`est`、`tion`) は単一tokenになり、まれな単語はきれいに分解されます。

実際のGPT / BERT / T5 tokenizerは、30k-100k個のmergeを学習します。結果として、どんなテキストも既知IDの長さが制限された列にtoken化され、OOVは発生しません。

## 使う

実務では、これらを自分で学習することはほとんどありません。事前学習済みチェックポイントを読み込みます。

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

transformer時代のBPE風サブワードtokenizationでは、次のようにします。

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

`Ġ` 接頭辞は単語境界を示します (GPT-2の慣習です)。現代のすべてのtokenizerは、BPEの変種、WordPiece (BERT)、またはSentencePiece (T5、LLaMA) です。

### どれを選ぶべきか

| 状況 | 選択 |
|------|------|
| 事前学習済みの汎用単語ベクトルが欲しく、OOV耐性は不要 | GloVe 300d |
| 事前学習済みの汎用単語ベクトルが欲しく、スペルミス / 新語 / 形態的に豊かな言語を扱う必要がある | FastText |
| transformerに入れるものすべて (学習でも推論でも) | そのモデルに同梱されたtokenizer。差し替えない。 |
| 自分で言語モデルをゼロから学習する | まず自分のコーパスでBPEまたはSentencePiece tokenizerを学習する |
| 線形モデルによる本番テキスト分類 | 今でもTF-IDF。レッスン02。 |

## 成果物

`outputs/skill-embeddings-picker.md` として保存します。

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

## 演習

1. **初級。** `char_ngrams("playing")` と `char_ngrams("played")` を実行してください。2つのn-gram集合のJaccard overlapを計算します。かなり多くの部品 (`pla`、`lay`、`play`) が共有されるはずです。これが、FastTextが形態変化をまたいでうまく転移できる理由です。
2. **中級。** `learn_bpe` を拡張して語彙の成長を追跡してください。merge数の関数として、コーパス1文字あたりのtoken数をプロットします。最初は急速に圧縮され、その後およそ1tokenあたり2-3文字付近に漸近するはずです。
3. **上級。** Shakespeare全集で1k-mergeのBPEを学習してください。一般的な単語とまれな固有名詞のtokenizationを比較します。前後の単語あたり平均token数を測定してください。驚いたことを書き出します。

## 重要用語

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|------------|
| Co-occurrence matrix | 単語-単語の頻度表 | `X[i][j]` = 単語 `i` の周辺ウィンドウに単語 `j` が現れる頻度です。 |
| Subword | 単語の一部 | 文字n-gram (FastText) または学習されたtoken (BPE/WordPiece/SentencePiece) です。 |
| BPE | Byte-pair encoding | 語彙が目標サイズに達するまで、最頻の隣接ペアを反復的にマージします。 |
| OOV | 語彙外 | モデルが見たことのない単語です。Word2Vec/GloVeは失敗します。FastTextとBPEは扱えます。 |
| Byte-level BPE | 生byte上のBPE | GPT-2の方式です。語彙は256個のbyteから始まるため、OOVが発生しません。 |

## 参考資料

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf) — GloVe論文です。7ページで、今でも損失の導出として最良です。
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) — FastText。
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) — BPEを現代NLPに導入した論文です。
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) — BPE、WordPiece、SentencePieceが実務上どのように違うかを説明しています。
