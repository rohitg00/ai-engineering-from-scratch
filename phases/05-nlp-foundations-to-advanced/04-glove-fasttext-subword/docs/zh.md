# GloVe、FastText 与子词嵌入

> Word2Vec 为每个词训练了一个嵌入。GloVe 对共现矩阵进行分解。FastText 对词的片段进行嵌入。BPE 连接到了 Transformer。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 03（从零实现 Word2Vec）
**时间：** 约45分钟

## 问题

Word2Vec 留下了两个开放性问题。

第一个问题：存在一条并行的研究路线，直接对共现矩阵进行分解（如 LSA、HAL），而不是进行在线 skip-gram 更新。Word2Vec 的迭代方法是否从根本上更好？还是两种方法处理计数的差异导致了不同结果？**GloVe** 给出了答案：使用精心选择的损失函数进行矩阵分解，其效果达到或优于 Word2Vec，且训练成本更低。

第二个问题：两种方法都无法处理从未见过的词。例如 `Zoomer-approved`、`dogecoin`、上周才创造出的专有名词、以及稀有词根的各种屈折形式。**FastText** 通过嵌入字符 n-gram 解决了这个问题：一个词是其组成部分（包括词素）的总和，因此即使是词表外的词也能获得合理的向量。

第三个问题：Transformer 出现后，问题再次转变。词级别的词表容量上限约为一百万条，而真实语言远不止于此。**字节对编码（BPE）**及其衍生方法通过学习一个覆盖所有内容的频繁子词单元词表解决了这个问题。现代所有大语言模型（LLM）的 Tokenizer 都是子词分词器（Subword Tokenizer）。

本课将逐一讲解这三种方法，并说明在何种场景下应选用哪一种。

## 概念

**GloVe（全局向量）。** 构建词-词共现矩阵 `X`，其中 `X[i][j]` 表示词 `j` 在词 `i` 的上下文中出现的次数。训练向量使得 `v_i · v_j + b_i + b_j ≈ log(X[i][j])`。对损失进行加权，以防止频繁共现的词对主导损失函数。完成。

**FastText。** 一个词是其字符 n-gram 加上词本身的总和。`where` 变为 `<wh, whe, her, ere, re>, <where>`。词向量是这些分量向量的总和。训练方式与 Word2Vec 相同。优势：未见过的词（如 `whereupon`）可以由已知的 n-gram 组合而成。

**BPE（字节对编码）。** 从单个字节（或字符）的词表开始。统计语料中所有相邻词对。将最频繁的词对合并为一个新 token。重复执行 `k` 次。结果：得到一个包含 `k + 256` 个 token 的词表，其中频繁序列（如 `ing`、`tion`、`the`）成为单个 token，而稀有词则被分解为熟悉的片段。每个句子都能被 tokenize 成某种形式。

## 构建

### GloVe：分解共现矩阵

```python
import numpy as np
from collections import Counter


def build_cooccurrence(docs, window=5):
    """构建共现矩阵（以字典形式存储）"""
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
    """训练GloVe嵌入"""
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

有两个值得提及的移动部件。加权函数 `f(x) = (x/x_max)^alpha` 降低非常频繁的词对（如 `(the, and)`）的权重，防止它们主导损失。最终的嵌入是 `W`（中心词表）和 `W_tilde`（上下文词表）的总和。将两者相加是已发表的技巧，通常比单独使用其中一个表现更好。

### FastText：子词感知嵌入

```python
def char_ngrams(word, n_min=3, n_max=6):
    """生成字符n-gram，包含边界符号"""
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

每个词由其 n-gram 集合表示（通常为3到6个字符）。词嵌入是其所有 n-gram 嵌入的总和。在 skip-gram 训练中，将 Word2Vec 中使用的单个向量替换为此即可。

```python
def fasttext_vector(word, ngram_table):
    """通过n-gram表获取词向量"""
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

对于未见过的词，只要其部分 n-gram 已知，仍然可以得到向量。`whereupon` 与 `where` 共享 `<wh`、`her`、`ere` 和 `<where`，因此两者在向量空间中相距较近。

### BPE：学习子词词表

```python
def learn_bpe(corpus, k_merges):
    """学习BPE合并规则"""
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
    """应用BPE合并规则对词进行分词"""
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

第一次迭代合并最频繁的相邻词对。经过足够多次迭代后，频繁子串（`low`、`est`、`tion`）变为单个 token，稀有词则被干净地拆分。

真实的 GPT / BERT / T5 tokenizer 会学习 30k-100k 次合并。结果：任何文本都能被 tokenize 成有限长度的已知 ID 序列，不存在 OOV。

## 使用

实际中，你很少自己训练这些模型。你会加载预训练检查点。

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

`Ġ` 前缀标记词边界（GPT-2 的约定）。每个现代 tokenizer 都是 BPE 变体、WordPiece（BERT）或 SentencePiece（T5、LLaMA）。

### 何时选择哪种

| 场景 | 选择 |
|------|------|
| 需要预训练的通用词向量，无需处理 OOV | GloVe 300d |
| 需要预训练的通用词向量，必须处理拼写错误/新词/形态丰富语言 | FastText |
| 任何涉及 Transformer 的任务（训练或推理） | 使用模型自带的 tokenizer。切勿更换。 |
| 从零训练自己的语言模型 | 首先在语料上训练 BPE 或 SentencePiece tokenizer |
| 使用线性模型进行生产文本分类 | 仍然用 TF-IDF。见第二课。 |

## 交付

保存为 `outputs/skill-tokenizer-picker.md`：

```markdown
---
name: tokenizer-picker
description: 为新语言模型或文本流水线选择分词方法。
version: 1.0.0
phase: 5
lesson: 04
tags: [nlp, tokenization, embeddings]
---

给定任务和数据集描述，输出以下内容：

1. 分词策略（词级别、BPE、WordPiece、SentencePiece、字节级别）。一句理由。
2. 词表大小目标（例如，纯英文 LM 用 32k，多语言用 64k-100k）。
3. 库调用及精确的训练命令。指明库名。引用参数。
4. 一个可重现性陷阱。Tokenzier-模型不匹配是最常见的静默生产错误；指出哪一对必须一起使用。

当用户正在微调预训练 LLM 时，拒绝推荐训练自定义 tokenizer。拒绝为面向生产推理的模型推荐词级别分词。对于非英语/多脚本语料，标记为需要使用带字节回退的 SentencePiece。
```

## 练习

1. **简单。** 运行 `char_ngrams("playing")` 和 `char_ngrams("played")`。计算两个 n-gram 集合的杰卡德重叠度。你应该能看到大量的共享片段（`pla`、`lay`、`play`），这就是 FastText 在形态变体上迁移性好的原因。
2. **中等。** 扩展 `learn_bpe` 以跟踪词表增长。绘制每个语料字符的 token 数随合并次数的变化曲线。你应该看到初期快速压缩，然后在大约每 token 2-3 个字符处趋于稳定。
3. **困难。** 在莎士比亚全集上训练一个 1k 次合并的 BPE。比较常见词和稀有专有名词的分词结果。测量前后每个词的平均 token 数。写下令你惊讶的发现。

## 关键术语

| 术语 | 人们通常说的 | 实际含义 |
|------|--------------|----------|
| 共现矩阵 (Co-occurrence matrix) | 词-词频率表 | `X[i][j]` = 词 `j` 在词 `i` 周围窗口内出现的次数。 |
| 子词 (Subword) | 词的一部分 | 字符 n-gram（FastText）或学习到的 token（BPE/WordPiece/SentencePiece）。 |
| BPE | 字节对编码 (Byte-Pair Encoding) | 迭代合并最频繁的相邻词对，直到词表达到目标大小。 |
| OOV | 词表外 (Out of Vocabulary) | 模型从未见过的词。Word2Vec/GloVe 会失效。FastText 和 BPE 可以处理。 |
| 字节级 BPE (Byte-level BPE) | 对原始字节的 BPE | GPT-2 的方案。词表从 256 个字节开始，因此永远不会有 OOV。 |

## 延伸阅读

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf) — GloVe 论文，七页，至今仍是损失函数的最佳推导。
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606) — FastText。
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) — 将 BPE 引入现代 NLP 的论文。
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary) — BPE、WordPiece 和 SentencePiece 在实践中实际差异的概述。