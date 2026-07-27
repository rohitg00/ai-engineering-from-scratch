# GloVe、FastText 与子词嵌入

> Word2Vec 为每个词训练一个 embedding。GloVe 分解了共现矩阵。FastText 嵌入了部件。BPE 连接到了 transformer。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 03（从零实现 Word2Vec）
**时间：** ~45 分钟

## 问题

Word2Vec 留下了两个悬而未决的问题。

第一，有一条平行的研究方向直接分解共现矩阵（LSA、HAL），而不是做在线 skip-gram 更新。Word2Vec 的迭代方法从根本上更好吗？还是差异只是两种方法处理计数方式的产物？**GloVe** 回答了这个问题：使用精心选择的损失函数进行矩阵分解，匹配或击败了 Word2Vec，而且训练成本更低。

第二，两种方法都无法处理从未见过的词。`Zoomer-approved`、`dogecoin`、任何上周新造的名词、罕见词根的任意屈折形式。**FastText** 通过嵌入字符 n-gram 解决了这个问题：一个词是其组成部分（包括词素）之和，因此即使是词汇表外词也能获得合理的向量。

第三，一旦 transformer 到来，问题再次转变。词级词汇表最多约一百万个条目；真正的语言比这更加开放。**字节对编码（BPE）** 及其变体通过学习覆盖一切的频繁子词单元的词汇表解决了这个问题。每个现代 LLM 的每个现代 tokenizer 都是子词 tokenizer。

本课介绍全部三种方法，然后解释在何时选用哪一种。

## 概念

**GloVe（Global Vectors）。** 构建词-词共现矩阵 `X`，其中 `X[i][j]` 表示词 `j` 出现在词 `i` 上下文中的频率。训练向量使得 `v_i · v_j + b_i + b_j ≈ log(X[i][j])`。对损失进行加权，使高频对不会主导训练。完成。

**FastText。** 一个词是其字符 n-gram 与词本身之和。`where` 变成 `<wh, whe, her, ere, re>, <where>`。词向量是这些分量向量的和。按 Word2Vec 方式训练。好处：未见过的词（`whereupon`）可以从已知的 n-gram 组合而成。

**BPE（Byte-Pair Encoding）。** 从单个字节（或字符）的词汇表开始。统计语料库中每个相邻对的出现次数。将最频繁的对合并成一个新 token。重复 `k` 次。结果：包含 `k + 256` 个 token 的词汇表，其中频繁序列（`ing`、`tion`、`the`）是单个 token，罕见词被拆分为熟悉的片段。每个句子都能 tokenize 成某种形式。

## 开始构建

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

两个值得命名的可动部件。加权函数 `f(x) = (x/x_max)^alpha` 降低非常高频的对（如 `(the, and)`）的权重，使它们不会主导损失。最终的 embedding 是 `W`（中心词）和 `W_tilde`（上下文词）表之和。对两者求和是一个已发表的技巧，通常优于只使用其中一个。

### FastText：子词感知的 embeddings

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

每个词由其 n-gram 集合表示（通常是 3 到 6 个字符）。词 embedding 是其 n-gram embeddings 之和。对于 skip-gram 训练，将其插入 Word2Vec 使用单个向量的位置。

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

对于未见过的词，只要其部分 n-gram 是已知的，你仍然能得到一个向量。`whereupon` 与 `where` 共享 `<wh`、`her`、`ere` 和 `<where`，因此两者在空间中靠得很近。

### BPE：学习子词词汇表

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

第一次迭代合并最常见的相邻对。经过足够多的迭代后，频繁的子字符串（`low`、`est`、`tion`）成为单个 token，罕见词被干净地拆分。

真正的 GPT / BERT / T5 tokenizer 学习 30k-100k 次合并。结果：任何文本都被 tokenize 成有界长度的已知 ID 序列，永远没有 OOV。

## 使用现成工具

在实践中，你很少自己训练这些方法中的任何一种。你加载预训练检查点。

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

在 transformer 时代使用 BPE 风格子词 tokenization：

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

`Ġ` 前缀标记词边界（GPT-2 的约定）。每个现代 tokenizer 都是 BPE 变体、WordPiece（BERT）或 SentencePiece（T5、LLaMA）。

### 何时选择哪个

| 场景 | 选择 |
|-----------|------|
| 预训练通用词向量，无需 OOV 容忍 | GloVe 300d |
| 预训练通用词向量，必须处理拼写错误/新词/形态丰富的语言 | FastText |
| 任何进入 transformer 的内容（训练或推理） | 使用模型自带的 tokenizer。切勿替换。 |
| 从零训练自己的语言模型 | 先在你的语料库上训练 BPE 或 SentencePiece tokenizer |
| 使用线性模型的生产文本分类 | 仍然用 TF-IDF。第 02 课。 |

## 交付

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

1. **简单。** 运行 `char_ngrams("playing")` 和 `char_ngrams("played")`。计算两个 n-gram 集合的 Jaccard 重叠度。你应该看到大量共享片段（`pla`、`lay`、`play`），这就是为什么 FastText 在形态变体之间能很好地迁移。
2. **中等。** 扩展 `learn_bpe` 以跟踪词汇表增长。绘制每个语料字符的 token 数与合并次数的函数关系。你应该首先看到快速压缩，然后渐近接近每个 token 约 2-3 个字符。
3. **困难。** 在莎士比亚全集中训练一个 1k 合并的 BPE。比较常见词与罕见专有名词的 tokenization。测量每个词前后的平均 token 数。写下让你惊讶的地方。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| Co-occurrence matrix | 词-词频率表 | `X[i][j]` = 词 `j` 在词 `i` 周围窗口内出现的频率。 |
| Subword | 词的一部分 | 字符 n-gram（FastText）或学习到的 token（BPE/WordPiece/SentencePiece）。 |
| BPE | 字节对编码 | 迭代合并最频繁的相邻对，直到词汇表达到目标大小。 |
| OOV | 词汇表外 | 模型从未见过的词。Word2Vec/GloVe 会失败。FastText 和 BPE 能处理。 |
| Byte-level BPE | 在原始字节上的 BPE | GPT-2 的方案。词汇表从 256 个字节开始，因此永远不会出现 OOV。 |

## 延伸阅读

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf) —— GloVe 论文，七页，仍然是损失函数的最佳推导。
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) —— FastText。
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) —— 将 BPE 引入现代 NLP 的论文。
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) —— BPE、WordPiece 和 SentencePiece 在实际中如何不同。
