# GloVe、Fasttext和Subword嵌入

> Word2Vec每个单词训练了一个嵌入。GloVe对同现矩阵进行了因子分解。Fasttext嵌入了这些碎片。BPE连接到变压器。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段5 · 03（来自Scratch的Word 2 Vec）
** 时间：** ~45分钟

## 问题

Word2Vec留下了两个悬而未决的问题。

首先，有一种平行的研究路线，直接对同现矩阵进行因子分解（LSA、HAL），而不是进行在线跳过语法更新。Word2Vec的迭代方法从根本上更好，还是差异是两种方法处理计数的人为因素？**GloVe** 回答道：经过深思熟虑选择的损失的矩阵分解匹配或击败Word2Vec，并且训练成本更低。

其次，这两种方法都没有它从未见过的单词的故事。“Zoomer-approved”、“dogecoin”，上周创造的任何专有名词，都是罕见词根的每一种变化形式。**Fasttext** 通过嵌入字符n-gram修复了这个问题：一个词是其各部分（包括词素）的总和，因此即使是词汇表外的词也会得到一个合理的载体。

第三，一旦变形金刚到来，问题再次发生转变。单词级词汇表的条目约为一百万个;真正的语言比这更开放。** 字节对编码（BPE）** 及其同类产品通过学习涵盖一切的频繁子词单元词汇来解决这个问题。每个现代LLM的每个现代标记器都是一个子词标记器。

本课将介绍这三个因素，然后解释何时伸手去拿哪一个。

## 概念

![Three embedding approaches: GloVe co-occurrence, FastText subwords, BPE merges](./assets/embeddings.svg)

**GloVe（全球Vectors）。**构建词-词同现矩阵“X”，其中“X[i][j]”是词“j”在词“i”的上下文中出现的频率。训练载体，使“v_i · v_j + b_i + b_j log（X[i][j]）”。体重损失因此频繁的配对并不占主导地位。完了

** 快速文本。**一个单词是其字符n元语法加上单词本身的和。&#39;在那里&#39;变成&#39;&#39;&#39;<where>。单词vector是这些分量vector的总和。作为Word 2 Vec训练。好处：看不见的单词（“thought &#39;）由已知的n元语法组成。

**BPE（字节对编码）。**从单个字节（或字符）的词汇开始。计算文集中的每个相邻对。将最频繁的对合并到新令牌中。重复“k”迭代。结果：由“k + 256”标记组成的词汇表，其中频繁序列（“ing”、“tion”、“the”）是单个标记，罕见单词被分解成熟悉的片段。每一句话都符号化为某种东西。

## 建设党

### GloVe：分解同现矩阵

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

两个值得命名的移动部件。加权函数`f（x）=（x/x_max）^alpha`对非常频繁的对（如`（the，and）`）进行了降权，因此它们不会主导损失。最后的嵌入是`W`（中心）和`W_tilde`（上下文）表的总和。两者相加是一个公开的技巧，往往优于只使用一个。

### FastText：子字感知嵌入

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

每个单词都由其n元语法集（通常为3至6个字符）表示。单词嵌入是其n-gram嵌入的总和。对于跳过语法训练，请将其插入Word 2 Vec使用单个载体的地方。

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

对于一个看不见的单词，只要它的一些n元语法是已知的，您仍然会得到一个载体。“于是‘将‘<whh’、‘her’、‘ere’和‘<where’与‘where’共享，所以两者彼此靠近。

### BPE：习得的子词词汇

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

第一次迭代合并最常见的相邻对。经过足够多的迭代后，频繁的子字符串（“low”、“est”、“tion”）变成单个标记，罕见的单词被彻底打破。

真正的GPT / BERT / T5标记器学习30 k-100 k合并。结果：任何文本都标记为已知ID的有限长度序列，永远不会出现OOV。

## 使用它

在实践中，您很少亲自训练这些内容。您加载预先培训的检查站。

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

对于Transformer时代的BPE风格子词标记化：

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

“”开头标记单词边界（GPT-2惯例）。每个现代标记器都是BPE变体、WordPiece（BERT）或SentencePiece（T5，LLaMA）。

### 何时选择哪个

| 情况 | 接 |
|-----------|------|
| 预训练的通用词载体，不需要OOV容忍度 | GloVe 300 d |
| 预训练的通用词向量，必须处理拼写错误/新词/形态丰富的语言 | fastText |
| 任何进入Transformer的东西（训练或推理） | 无论该模型附带的符号化器。永远不要交换。 |
| 从头开始训练自己的语言模型 | 首先在您的数据库上训练BPE或SentencePiece代币生成器 |
| 使用线性模型的产品文本分类 | 仍然是TF-IDF。课02。 |

## 把它运

另存为“输出/skill-tokenizer-picker.md”：

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

## 演习

1. ** 简单。**运行' char_ngram（“playing”）'和' char_ngram（“played”）'。计算两个n-gram集的Jaccard重叠。您应该看到大量的共享片段（“pla”、“lay”、“play”），这就是为什么Fasttext在形态变体中很好地转移。
2. ** 中等。**扩展“learn_bpe”以跟踪词汇量增长。将每个主体字符的标记绘制为合并数量的函数。首先您应该看到快速压缩，逐渐接近每个令牌约2-3个字符。
3. ** 很难。**对莎士比亚全集进行1公里合并BPE训练。比较常见词的符号化与罕见专有名词的符号化。测量前后每个单词的平均代币。写下让你惊讶的事情。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 共生矩阵 | 字词频率表 | ' X[i][j]'=单词“j”出现在单词“i”周围的窗口中的频率。 |
| 子字 | 一句话 | 字符n-gram（Fasttext）或学习标记（BPE/WordPiece/SentencePiece）。 |
| BPE | 字节对编码 | 迭代合并最频繁的相邻对，直到词汇量达到目标大小。 |
| OOV | 词库外 | 模特从未见过的词。Word 2 Vec/GloVe失败。Fasttext和BPE处理它。 |
| 字节级BPE | 原始字节上的BPE | GPT-2的方案。词汇以256个字节开始，因此没有任何内容是OOV。 |

## 进一步阅读

- [Pennington、Socher、Manning（2014）。GloVe：Global Vectors for Word Representation]（https：//nlp.stanford.edu/pubs/glove.pdf）-GloVe论文，七页，仍然是损失的最佳来源。
- [Bojanowski等人（2017）。使用子词信息丰富Word Vectors]（https：//arxiv.org/abs/1607.04606）- Fasttext。
- [Sennrich、Haddow、Birch（2016）。具有子词单位的稀有词的神经机器翻译]（https：//arxiv.org/ab/1508.07909）-将BPE引入现代NLP的论文。
- [Hugging Face tokenizer摘要]（https：//huggingface.co/docs/transformers/tokenizer_summary）-BPE、WordPiece和SentencePiece在实践中实际上有何不同。
