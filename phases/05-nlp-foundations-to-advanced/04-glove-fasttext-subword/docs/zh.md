# 04 · GloVe、FastText 与子词嵌入

> Word2Vec 为每个词训练一个嵌入。GloVe 对共现矩阵做了分解。FastText 嵌入的是词的片段。BPE 则架起了通往 Transformer 的桥梁。

**类型：** 构建（Build）
**语言：** Python
**前置：** 第 5 阶段 · 03（从零实现 Word2Vec）
**时长：** 约 45 分钟

## 问题所在

Word2Vec 留下了两个悬而未决的问题。

第一，曾经有一条平行的研究路线，它直接对共现矩阵做分解（如 LSA、HAL），而不是做在线的 skip-gram 更新。Word2Vec 的迭代式方法是否在本质上更优，还是说这种差异只是两种方法处理计数方式不同所产生的副产物？**GloVe** 给出了答案：用经过精心设计的损失函数做矩阵分解，效果可与 Word2Vec 持平甚至更好，而且训练成本更低。

第二，这两种方法对于从未见过的词都束手无策。`Zoomer-approved`、`dogecoin`，任何上周才造出来的专有名词，以及某个罕见词根的每一种屈折变化形式。**FastText** 通过嵌入字符 n-gram（character n-grams）解决了这一点：一个词是其各组成部分（包括词素）之和，因此即便是「词表外（out-of-vocabulary）」的词也能得到一个合理的向量。

第三，当 Transformer 登场后，问题又发生了转变。词级别（word-level）的词表上限大约在一百万条左右；而真实语言的开放程度远超于此。**字节对编码（Byte-pair encoding，BPE）** 及其衍生方法解决了这一问题：它学习一套由高频子词单元组成的词表，从而能够覆盖一切。如今每一个现代大语言模型的每一个现代分词器，都是子词分词器。

本课会把这三者都走一遍，然后讲清楚在什么场景下应该选用哪一个。

## 核心概念

**GloVe（Global Vectors，全局向量）。** 构建词-词共现矩阵 `X`，其中 `X[i][j]` 表示词 `j` 出现在词 `i` 上下文中的频次。训练向量，使得 `v_i · v_j + b_i + b_j ≈ log(X[i][j])`。对损失进行加权，让高频词对不至于主导整体损失。完成。

**FastText。** 一个词等于其字符 n-gram 之和，再加上这个词本身。`where` 会被拆成 `<wh, whe, her, ere, re>, <where>`。词向量就是这些组成部分向量之和。训练方式与 Word2Vec 相同。好处是：未见过的词（如 `whereupon`）可以由已知的 n-gram 组合而成。

**BPE（Byte-Pair Encoding，字节对编码）。** 从单个字节（或字符）构成的词表出发。统计语料中每一个相邻对的出现次数。把出现最频繁的那一对合并成一个新 token。重复 `k` 次迭代。结果是一个包含 `k + 256` 个 token 的词表，其中高频序列（`ing`、`tion`、`the`）成为单个 token，而罕见词则被拆分为熟悉的片段。任何句子都能被分成可识别的单元。

## 动手构建

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

有两个值得点名的关键部件。加权函数 `f(x) = (x/x_max)^alpha` 会对极高频的词对（比如 `(the, and)`）进行降权，使它们不至于主导损失。最终的嵌入是 `W`（中心词表）与 `W_tilde`（上下文词表）之和。把两者相加是一个已发表的技巧，往往比只用其中一个效果更好。

### FastText：感知子词的嵌入

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

每个词都由它的 n-gram 集合（通常为 3 到 6 个字符）来表示。词嵌入就是其各个 n-gram 嵌入之和。在 skip-gram 训练中，把它接入到原本 Word2Vec 使用单个向量的位置即可。

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

对于一个未见过的词，只要它的部分 n-gram 是已知的，你依然能得到一个向量。`whereupon` 与 `where` 共享 `<wh`、`her`、`ere` 和 `<where`，因此这两个词在向量空间中会落得很近。

### BPE：习得的子词词表

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

第一次迭代会合并出现最频繁的相邻对。经过足够多次迭代后，高频子串（`low`、`est`、`tion`）会成为单个 token，而罕见词则会被干净利落地拆开。

真实的 GPT / BERT / T5 分词器会学习 3 万到 10 万个合并操作。结果是：任何文本都能被分成一段长度有界、由已知 ID 组成的序列，永远不会出现 OOV。

## 实际使用

在实践中，你很少会自己去训练上面这些模型。你会直接加载预训练好的检查点（checkpoint）。

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

在 Transformer 时代进行 BPE 风格的子词分词：

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

`Ġ` 前缀标记的是词边界（这是 GPT-2 的一种约定）。每一个现代分词器要么是 BPE 的变体，要么是 WordPiece（BERT），要么是 SentencePiece（T5、LLaMA）。

### 何时该选哪一个

| 场景 | 选用 |
|-----------|------|
| 预训练的通用词向量，无需容忍 OOV | GloVe 300d |
| 预训练的通用词向量，必须处理拼写错误 / 新造词 / 形态丰富的语言 | FastText |
| 任何要送入 Transformer 的内容（训练或推理） | 模型自带的那个分词器。绝不替换。 |
| 从零训练你自己的语言模型 | 先在你的语料上训练一个 BPE 或 SentencePiece 分词器 |
| 使用线性模型做生产环境的文本分类 | 仍然是 TF-IDF。见第 02 课。 |

## 交付产物

保存为 `outputs/skill-embeddings-picker.md`：

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

## 练习

1. **简单。** 运行 `char_ngrams("playing")` 和 `char_ngrams("played")`。计算两个 n-gram 集合的 Jaccard 重叠度（Jaccard overlap）。你应该会看到大量共享片段（`pla`、`lay`、`play`），这正是 FastText 能在形态变体之间良好迁移的原因。
2. **中等。** 扩展 `learn_bpe`，让它能追踪词表的增长。绘制「每语料字符的 token 数」随合并次数变化的曲线。你应该会先看到快速压缩，随后逐渐趋近于每个 token 约 2-3 个字符的水平。
3. **困难。** 在莎士比亚全集上训练一个含 1k 次合并的 BPE。比较常见词与罕见专有名词的分词结果。测量训练前后每个词的平均 token 数。写下哪些结果让你感到意外。

## 关键术语

| 术语 | 大家通常的说法 | 它实际的含义 |
|------|-----------------|-----------------------|
| 共现矩阵（Co-occurrence matrix） | 词-词频次表 | `X[i][j]` = 词 `j` 出现在词 `i` 周围窗口内的频次。 |
| 子词（Subword） | 词的片段 | 一个字符 n-gram（FastText），或一个习得的 token（BPE/WordPiece/SentencePiece）。 |
| BPE | 字节对编码 | 不断合并出现最频繁的相邻对，直到词表达到目标规模。 |
| OOV | 词表外（Out of vocabulary） | 模型从未见过的词。Word2Vec/GloVe 会失效。FastText 和 BPE 能够处理。 |
| 字节级 BPE（Byte-level BPE） | 在原始字节上做 BPE | GPT-2 采用的方案。词表以 256 个字节起步，因此永远不会出现 OOV。 |

## 延伸阅读

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf) —— GloVe 原始论文，仅七页，至今仍是对该损失函数最好的推导。
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) —— FastText。
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) —— 将 BPE 引入现代 NLP 的那篇论文。
- [Hugging Face 分词器综述](https://huggingface.co/docs/transformers/tokenizer_summary) —— BPE、WordPiece 与 SentencePiece 在实践中究竟有何不同。
