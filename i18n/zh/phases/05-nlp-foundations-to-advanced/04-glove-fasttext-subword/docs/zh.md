# GloVe、FastText 与子词嵌入

> Word2Vec 为每个词训练一个嵌入。GloVe 对共现矩阵做了分解。FastText 对词的组成部分做了嵌入。BPE 由此通向 Transformer。

**Type:** Build
**Languages:** Python
**Prerequisites:** 阶段 5 · 03（从零实现 Word2Vec）
**Time:** 约 45 分钟

## 问题所在

Word2Vec 留下了两个悬而未决的问题。

第一，有一条平行的研究路线直接对共现矩阵做分解（LSA、HAL），而不是进行在线 skip-gram 更新。Word2Vec 的迭代方法是否在本质上更优，还是说差异只是两种方法处理计数方式的产物？**GloVe** 给出了答案：精心选择损失函数的矩阵分解，其效果与 Word2Vec 相当甚至更好，且训练成本更低。

第二，这两种方法都没有处理从未见过的词的方案。`Zoomer-approved`、`dogecoin`、上周刚造出来的专有名词、某个罕见词根的每一种屈折形式。**FastText** 通过嵌入字符 n-gram 解决了这个问题：一个词是其各部分（包括词素）之和，因此即使是词表外的词也能得到一个合理的向量。

第三，当 Transformer 出现后，问题再次转变。词级词表的上限大约是一百万个条目；而真实语言比这更加开放。**字节对编码（BPE）**及其变体通过学习一个由高频子词单元组成的词表解决了这个问题，该词表可以覆盖一切。如今每一个现代 LLM 的每一个现代分词器都是子词分词器。

本课将逐一讲解这三种方法，并说明何时该选用哪一种。

## 核心概念

**GloVe（Global Vectors）。** 构建词-词共现矩阵 `X`，其中 `X[i][j]` 表示词 `j` 出现在词 `i` 上下文中的频率。训练向量使得 `v_i · v_j + b_i + b_j ≈ log(X[i][j])`。对损失加权，使高频词对不会占据主导。完成。

**FastText。** 一个词是其字符 n-gram 与词本身的向量之和。`where` 变为 `<wh, whe, her, ere, re>, <where>`。词向量是这些分量向量之和。按 Word2Vec 的方式训练。好处：未见过的词（`whereupon`）可以由已知的 n-gram 组合而成。

**BPE（Byte-Pair Encoding）。** 从单个字节（或字符）组成的词表开始。统计语料库中每一对相邻元素。将最高频的对合并为新 token。重复 `k` 次迭代。结果：一个包含 `k + 256` 个 token 的词表，其中高频序列（`ing`、`tion`、`the`）成为单个 token，而稀有词被拆分为熟悉的片段。任何句子都能被切分为 token。

```figure
n5-subword-merge
```

## 动手实现

### GloVe：对共现矩阵做分解

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

有两个关键部分值得说明。加权函数 `f(x) = (x/x_max)^alpha` 会降低极高频词对（如 `(the, and)`）的权重，使其不至于主导损失。最终的嵌入是 `W`（中心词）表与 `W_tilde`（上下文词）表之和。将两者相加是一个已发表的技巧，通常优于只用其中一个。

### FastText：子词感知的嵌入

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

每个词由其 n-gram 集合（通常为 3 到 6 个字符）表示。词嵌入是其 n-gram 嵌入之和。在 skip-gram 训练中，把 Word2Vec 使用的单个向量替换为它即可。

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

对于一个未见过的词，只要它的一部分 n-gram 是已知的，仍然可以得到一个向量。`whereupon` 与 `where` 共享 `<wh`、`her`、`ere` 和 `<where`，因此两者会落在相近的位置。

### BPE：学习得到的子词词表

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

第一次迭代合并最常见的相邻对。经过足够多的迭代后，高频子串（`low`、`est`、`tion`）成为单个 token，稀有词被干净地拆分开。

真实的 GPT / BERT / T5 分词器学习 3 万到 10 万次合并。结果：任何文本都会被切分为已知 ID 的有界长度序列，永远不会出现 OOV。

## 使用它

在实践中，你很少亲自训练这些模型。你加载预训练的 checkpoint。

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

对于 Transformer 时代的 BPE 风格子词分词：

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

`Ġ` 前缀标记词边界（这是 GPT-2 的约定）。每一个现代分词器都是 BPE 变体、WordPiece（BERT）或 SentencePiece（T5、LLaMA）。

### 如何选择

| 情形 | 选择 |
|-----------|------|
| 预训练的通用词向量，无需容忍 OOV | GloVe 300d |
| 预训练的通用词向量，必须处理拼写错误 / 新词 / 形态丰富的语言 | FastText |
| 任何输入 Transformer 的内容（训练或推理） | 模型自带的分词器。绝不要替换。 |
| 从零训练自己的语言模型 | 先在你的语料库上训练一个 BPE 或 SentencePiece 分词器 |
| 用线性模型做生产环境的文本分类 | 仍然用 TF-IDF。见第 02 课。 |

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

1. **简单。** 运行 `char_ngrams("playing")` 和 `char_ngrams("played")`。计算两个 n-gram 集合的 Jaccard 重叠度。你应该会看到大量共享的片段（`pla`、`lay`、`play`），这正是 FastText 能在形态变体之间良好迁移的原因。
2. **中等。** 扩展 `learn_bpe` 以跟踪词表增长。绘制每语料字符的 token 数随合并次数变化的曲线。你应该会看到初期压缩迅速，之后渐近于每个 token 约 2-3 个字符。
3. **困难。** 在莎士比亚全集上训练一个 1k 次合并的 BPE。比较常见词与稀有专有名词的分词结果。测量前后每个词的平均 token 数。写下令你惊讶的发现。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 共现矩阵 | 词-词频率表 | `X[i][j]` = 词 `j` 出现在词 `i` 附近窗口内的频率。 |
| 子词 | 词的一部分 | 字符 n-gram（FastText）或学习得到的 token（BPE/WordPiece/SentencePiece）。 |
| BPE | 字节对编码 | 迭代合并最高频的相邻对，直到词表达到目标大小。 |
| OOV | 词表外的词 | 模型从未见过的词。Word2Vec/GloVe 会失败。FastText 和 BPE 能处理。 |
| 字节级 BPE | 在原始字节上运行的 BPE | GPT-2 的方案。词表从 256 个字节开始，因此任何内容都不会 OOV。 |

## 延伸阅读

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf) — GloVe 论文，仅七页，至今仍是该损失函数最好的推导。
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) — FastText。
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) — 将 BPE 引入现代 NLP 的论文。
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) — BPE、WordPiece 与 SentencePiece 在实践中的实际差异。