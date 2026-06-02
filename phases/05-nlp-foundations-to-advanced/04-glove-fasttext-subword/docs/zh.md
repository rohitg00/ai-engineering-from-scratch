# GloVe、FastText 与 Subword Embeddings

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Word2Vec 给每个词训练一个 embedding。GloVe 直接做共现矩阵分解。FastText 把词的零件 embed 进来。BPE 则架起了通往 transformer 的桥。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 03（Word2Vec from Scratch）
**Time:** ~45 minutes

## 问题（Problem）

Word2Vec 留下了两个未解的问题。

第一，当时还有一条平行的研究路线，是直接对共现矩阵做分解（LSA、HAL），而不是像 skip-gram 那样在线更新。Word2Vec 的迭代式做法是不是真的本质上更好？还是这个差距只是两类方法处理计数方式不同造成的副作用？**GloVe** 给出了答案：只要 loss（损失）选得用心，矩阵分解能追平甚至超过 Word2Vec，而且训练成本更低。

第二，两种方法都没法处理从未见过的词。`Zoomer-approved`、`dogecoin`、上周才有人造的某个专有名词、某个稀有词根的所有屈折形式，统统没辙。**FastText** 的解法是给字符 n-gram 做 embedding：一个词等于它各个零件（包括词素）embedding 的加和，这样即使词表外（out-of-vocabulary）的词也能拿到一个合理的向量。

第三，等到 transformer 登场，问题再次变形。词级别词表撑死也就一百万条；真实语言比这开放得多。**Byte-pair encoding（BPE，字节对编码）** 及其亲戚解决了这一点：学一份高频 subword 单元词表，能覆盖一切。今天每一个现代 LLM 的 tokenizer，都是 subword tokenizer。

本课把这三件事走一遍，然后讲清楚什么时候该用哪个。

## 概念（Concept）

**GloVe（Global Vectors）。** 构造词-词共现矩阵 `X`，其中 `X[i][j]` 是词 `j` 出现在词 `i` 上下文中的频次。训练向量使 `v_i · v_j + b_i + b_j ≈ log(X[i][j])`。给 loss 加权，避免高频对压倒一切。完事。

**FastText。** 一个词等于它的字符 n-gram 加上自身。`where` 拆成 `<wh, whe, her, ere, re>, <where>`。词向量是这些零件向量的加和。训练流程同 Word2Vec。好处：没见过的词（比如 `whereupon`）也能由已知的 n-gram 拼装出来。

**BPE（Byte-Pair Encoding）。** 初始词表是单字节（或单字符）。统计语料里每一对相邻 token 的频次。把最高频的那对合并成一个新 token。重复 `k` 轮。结果：得到一份大小为 `k + 256` 的词表，高频序列（`ing`、`tion`、`the`）成为单个 token，罕见词被拆成熟悉的零件。任意句子都能 tokenize 出一些东西。

## 动手实现（Build It）

### GloVe：分解共现矩阵

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

有两个值得点名的关键部件。加权函数 `f(x) = (x/x_max)^alpha` 会压低非常高频的词对（比如 `(the, and)`），不让它们主导 loss。最终的 embedding 是 `W`（中心）和 `W_tilde`（上下文）两张表之和。把两边加起来是论文里的小技巧，效果通常优于只用其中一边。

### FastText：subword 感知的 embedding

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

每个词由它的 n-gram 集合表示（一般取 3 到 6 个字符）。词的 embedding 就是它各个 n-gram embedding 的加和。在 skip-gram 训练里，把它塞进 Word2Vec 原本只用单一向量的位置即可。

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

对一个没见过的词，只要它的部分 n-gram 已知，你仍然能拿到一个向量。`whereupon` 和 `where` 共享 `<wh`、`her`、`ere`、`<where`，所以两者在向量空间里会落得很近。

### BPE：学出来的 subword 词表

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

第一轮合并最高频的相邻对。迭代足够次数后，高频子串（`low`、`est`、`tion`）成为单个 token，罕见词被干净地拆开。

真实世界里 GPT / BERT / T5 的 tokenizer 学的是 30k-100k 次合并。结果：任何文本都能 tokenize 成一段长度有界、ID 已知的序列，永远不会 OOV。

## 用起来（Use It)

实践中你几乎不会自己训练这些。你直接加载预训练 checkpoint。

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

到了 transformer 时代，要做 BPE 风格的 subword tokenization：

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

`Ġ` 前缀标识词边界（GPT-2 的约定）。今天每一个 tokenizer 要么是 BPE 变体，要么是 WordPiece（BERT），要么是 SentencePiece（T5、LLaMA）。

### 什么时候选哪个

| 场景 | 选择 |
|-----------|------|
| 预训练通用词向量，不需要容忍 OOV | GloVe 300d |
| 预训练通用词向量，必须能处理拼写错误 / 新造词 / 形态丰富的语言 | FastText |
| 任何要塞进 transformer 的内容（训练或推理） | 模型自带的那个 tokenizer。永远别换。 |
| 从零训练自己的语言模型 | 先在你的语料上训练一个 BPE 或 SentencePiece tokenizer |
| 用线性模型做生产环境文本分类 | 还是 TF-IDF。见第 02 课。 |

## 上线部署（Ship It）

存为 `outputs/skill-embeddings-picker.md`：

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

## 练习（Exercises）

1. **Easy.** 跑 `char_ngrams("playing")` 和 `char_ngrams("played")`。计算两个 n-gram 集合的 Jaccard 重叠度。你会看到大量共享零件（`pla`、`lay`、`play`），这正是 FastText 在形态变体之间迁移效果好的原因。
2. **Medium.** 扩展 `learn_bpe` 以追踪词表增长。绘制「每语料字符的 token 数」随合并次数的变化曲线。你会看到一开始压缩很快，之后渐近到大约每 token 2-3 个字符。
3. **Hard.** 在莎士比亚全集上训练一个 1k 合并的 BPE。比较常见词与罕见专有名词的 tokenize 结果。测量训练前后平均每词的 token 数。把让你意外的地方写下来。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际是什么 |
|------|-----------------|-----------------------|
| Co-occurrence matrix（共现矩阵） | 词-词频次表 | `X[i][j]` = 词 `j` 出现在词 `i` 周围窗口里的次数。 |
| Subword（子词） | 词的零件 | 字符 n-gram（FastText）或学到的 token（BPE/WordPiece/SentencePiece）。 |
| BPE | Byte-pair encoding | 迭代合并最高频相邻对，直到词表达到目标大小。 |
| OOV | Out of vocabulary | 模型从未见过的词。Word2Vec/GloVe 失败；FastText 和 BPE 能搞定。 |
| Byte-level BPE | 在原始字节上跑的 BPE | GPT-2 的方案。词表起点是 256 个字节，于是没有任何东西会 OOV。 |

## 延伸阅读（Further Reading）

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf) —— GloVe 论文，七页，至今仍是 loss 推导写得最好的一篇。
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) —— FastText。
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) —— 把 BPE 引入现代 NLP 的那篇论文。
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) —— 实践中 BPE、WordPiece、SentencePiece 究竟差在哪里。
