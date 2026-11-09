#  GloVe,FastText和子词嵌入

> 词2Vec训练每字一个嵌入. GloVe因数化了共发生矩阵. 快文本嵌入了零件. BPE 与变压器桥梁.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec from Scratch)
**Time:** ~45 minutes

## 问题

Word2Vec留下了两个问题.

首先,有一个平行的研究线,直接因子化了共发生矩阵 (LSA,HAL) 而不是在线跳转图更新. Word2Vec的反复方法基本上更好,还是两种方法处理的方式的差异是构成的?**GloVe**答案是:对矩阵因数分解,以精心选择的损失匹配或超过Word2Vec,

第二,这两种方法都没有一个故事,`Zoomer-approved`现在`dogecoin`任何本质的名词,上周发明,每一个曲的罕见根.**FastText**字符是其部分的总和,包括形态,所以即使是词汇之外的字符也得到了合理的向量.

第三,当变革者到达时,问题又发生了变化.**Byte-pair encoding (BPE)**现在,我们在研究中发现,每一个现代的代码符号都是一种代码符号.

这一课将包括三个,然后解释哪个是什么时候.

## 概念

**GloVe (Global Vectors).**构建一个词-词共发生矩阵`X`在哪里`X[i][j]`是多么经常的词`j`在"字"中出现`i`列车向量,这样`v_i · v_j + b_i + b_j ≈ log(X[i][j])`减肥,所以频繁的对子不占主导地位.

**FastText.**一个词是其字符n-grams的总和加上单词本身.`where`成为`<wh, whe, her, ere, re>, <where>`作为 Word2Vec,训练:不可见的单词 (`whereupon`) 由已知n-gram组成.

**BPE (Byte-Pair Encoding).**开始使用单个字节 (或字符) 的词汇库. 计算体内每个相邻的对. 将最频繁的对合并成一个新的代币. 重复为 `k`结果:一个基础符号的词汇库加上`k`合并 (`k + 256`在字节开始时,代币 (`ing`现在`tion`现在`the`单个代币,稀有词被分解成熟悉的部分.

```figure
n5-subword-merge
```

## 建立它

### 聚合物:对合发生矩阵进行因素化

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

值得命名的两个移动件.`f(x) = (x/x_max)^alpha`低权重非常频繁的对 (如`(the, and)`总数是总数,总数是总数,总数是总数,总数是总数.`W`其他`W_tilde`总结两者都是一个公布的技巧,

### 快文:有潜词的嵌入

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

每个词由其 n-gram 集合 (通常是3至6个字符) 表示.词嵌入是其 n-gram 嵌入的总和.对于跳转-gram 训练,在 Word2Vec 使用单个向量时,插入此.

```python
def fasttext_vector(word, ngram_table):
    grams = char_ngrams(word)
    vecs = [ngram_table[g] for g in grams if g in ngram_table]
    if not vecs:
        return None
    return np.sum(vecs, axis=0)
```

对于一个未见的词,只要知道它的n-gram,你仍然得到一个向量.`whereupon`股票`<wh`现在`her`现在`ere`其他`<where`随着`where`两者彼此靠近.

### 语:学习子词汇

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

首先,重复的重复将最常见的邻居对合并.`low`现在`est`现在`tion`) 成为单个代币,稀有词语也会破碎.

实际的GPT/BERT/T5代币化器学习了30k-100k的合并.结果:任何文本都将代币化为已知ID的有限长度序列,没有OOV.

## 用它

实际上,你很少自己训练这些.

```python
import fasttext.util
fasttext.util.download_model("en", if_exists="ignore")
ft = fasttext.load_model("cc.en.300.bin")
print(ft.get_word_vector("whereupon").shape)
print(ft.get_word_vector("zoomerapproved").shape)
```

对于变压器时代的BPE式子词代码化:

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
print(tok.tokenize("unbelievably tokenized"))
```

```
['un', 'bel', 'iev', 'ably', 'Ġtoken', 'ized']
```

其他`Ġ`预सर्ग标志着词界限 (GPT-2 公约).每个现代代币是BPE变体,WordPiece (BERT),或SentencePiece (T5,LLaMA).

### 什么时候选择哪个

| Situation | Pick |
|-----------|------|
| Pretrained general-purpose word vectors, no OOV tolerance needed | GloVe 300d |
| Pretrained general-purpose word vectors, must handle misspellings / neologisms / morphologically rich languages | FastText |
| Anything going into a transformer (training or inference) | Whatever tokenizer the model shipped with. Never swap. |
| Training your own language model from scratch | Train a BPE or SentencePiece tokenizer on your corpus first |
| Production text classification with a linear model | Still TF-IDF. Lesson 02. |

## 运送它

保存如`outputs/skill-embeddings-picker.md`其他:

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

## 运动

1. **Easy.**跑步`char_ngrams("playing")`其他`char_ngrams("played")`计算两个n-gram集合的Jaccard重叠.`pla`现在`lay`现在`play`),这就是为什么FastText很好地转移到其他形式变体中.
2. **Medium.**延长时间`learn_bpe`根据数组合数,绘制每个字符的代码.你应该看到快速的压缩,每代码的压缩量接近2-3个字符.
3. **Hard.**训练一个K合并BPE在莎士比亚的完整作品.比较普通词的标记与罕见的正名词. 测量每字的平均标记前后.写出你惊的东西.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Co-occurrence matrix | Word-word frequency table | `X[i][j]` = how often word `j` appears in a window around word `i`. |
| Subword | Piece of a word | A character n-gram (FastText) or learned token (BPE/WordPiece/SentencePiece). |
| BPE | Byte-pair encoding | Iterative merging of most-frequent adjacent pairs until vocabulary hits target size. |
| OOV | Out of vocabulary | Word the model has never seen. Word2Vec/GloVe fail. FastText and BPE handle it. |
| Byte-level BPE | BPE on raw bytes | GPT-2's scheme. Vocabulary starts with 256 bytes, so nothing is ever OOV. |

## 进一步阅读

- [Pennington, Socher, Manning (2014). GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/pubs/glove.pdf)七页的GloVe论文,仍然是损失的最佳衍生.
- [Bojanowski et al. (2017). Enriching Word Vectors with Subword Information](https://arxiv.org/abs/1607.04606)快讯.
- [Sennrich, Haddow, Birch (2016). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909)是引入BPE到现代NLP的论文.
- [Hugging Face tokenizer summary](https://huggingface.co/docs/transformers/tokenizer_summary)BPE,WordPiece和SentencePiece实际上是如何不同的.
