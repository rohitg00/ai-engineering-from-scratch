# 02 · 词袋、TF-IDF 与文本表示

> 先计数，后思考。在 2026 年，对于定义明确的任务，TF-IDF 依然胜过嵌入模型。

**类型：** 构建
**语言：** Python
**前置：** 第 5 阶段 · 01（文本处理）、第 2 阶段 · 02（从零实现线性回归）
**时长：** 约 75 分钟

## 问题所在

模型需要数字，而你手里只有字符串。

每一条 NLP 流水线都要回答同一个问题：如何把变长的词元（token）流转换成分类器可以消费的定长向量。这个领域最早给出的答案是「最笨但管用」的那种——把单词数出来，做成一个向量。

这个向量承载的生产环境 NLP 工作量，比任何嵌入（embedding）模型都多。垃圾邮件过滤器、主题分类器、日志异常检测、搜索排序（在 BM25 之前）、第一波情感分析、学术 NLP 基准测试的头十年，都靠它。2026 年的从业者在面对范围明确的分类任务时，仍然会第一时间想到它。它快、可解释，而且在「单词是否出现」才是关键的任务上，往往与一个 4 亿参数的嵌入模型难分高下。

本课将从零构建词袋（Bag of Words），再构建 TF-IDF。然后展示 scikit-learn 如何用三行代码做同样的事。最后点明那个会逼你转向嵌入的失效模式。

## 概念

**词袋（Bag of Words，BoW）** 抛弃词序。对每篇文档，数出每个词表单词出现的次数。向量长度即词表大小。位置 `i` 是单词 `i` 的计数。

**TF-IDF** 对 BoW 重新加权。在每篇文档中都出现的单词没有区分度，所以把它的权重调低。在整个语料库中稀有、却在某一篇文档中频繁出现的单词是信号，所以把它的权重调高。

```
TF-IDF(w, d) = TF(w, d) * IDF(w)
             = count(w in d) / |d| * log(N / df(w))
```

其中 `TF` 是该词在文档中的词频（term frequency），`df` 是文档频率（document frequency，即包含该词的文档数），`N` 是文档总数。`log` 把那些无处不在的单词的权重控制在有界范围内。

关键特性：两者产出的都是带有可解释坐标轴的稀疏向量。你可以查看一个训练好的分类器的权重，读出哪些单词把文档推向各个类别。而对于一个 768 维的 BERT 嵌入，你做不到这一点。

## 动手构建

### 第 1 步：构建词表

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

输入：已分词文档的列表（任何词级别分词器都可以；本课的 `code/main.py` 使用了一个简化的小写化变体）。输出：`{word: index}` 字典。稳定的插入顺序意味着索引 0 的单词，就是第一篇文档中最先出现的那个词。这一约定因实现而异；scikit-learn 是按字母顺序排序的。

### 第 2 步：词袋

```python
def bag_of_words(docs, vocab):
    matrix = [[0] * len(vocab) for _ in docs]
    for i, doc in enumerate(docs):
        for token in doc:
            if token in vocab:
                matrix[i][vocab[token]] += 1
    return matrix
```

```python
>>> docs = [["cat", "sat", "on", "mat"], ["cat", "cat", "ran"]]
>>> vocab = build_vocab(docs)
>>> bag_of_words(docs, vocab)
[[1, 1, 1, 1, 0], [2, 0, 0, 0, 1]]
```

行是文档，列是词表索引。条目 `[i][j]` 表示「单词 `j` 在文档 `i` 中出现了几次」。文档 1 里 `cat` 出现两次，因为它确实出现了两次。文档 0 里 `ran` 出现零次，因为它确实没出现。

### 第 3 步：词频与文档频率

```python
import math


def term_frequency(doc_bow, doc_length):
    return [c / doc_length if doc_length else 0 for c in doc_bow]


def document_frequency(bow_matrix):
    df = [0] * len(bow_matrix[0])
    for row in bow_matrix:
        for j, count in enumerate(row):
            if count > 0:
                df[j] += 1
    return df


def inverse_document_frequency(df, n_docs):
    return [math.log((n_docs + 1) / (d + 1)) + 1 for d in df]
```

有两个值得点名的平滑技巧。`(n+1)/(d+1)` 避免了 `log(x/0)`。末尾的 `+1` 确保了在每篇文档中都出现的单词其 IDF 仍为 1（而非 0），与 scikit-learn 的默认行为一致。其他实现使用原始的 `log(N/df)`。两者都能用；平滑版本更友好。

### 第 4 步：TF-IDF

```python
def tfidf(bow_matrix):
    n_docs = len(bow_matrix)
    df = document_frequency(bow_matrix)
    idf = inverse_document_frequency(df, n_docs)
    out = []
    for row in bow_matrix:
        length = sum(row)
        tf = term_frequency(row, length)
        out.append([tf_j * idf_j for tf_j, idf_j in zip(tf, idf)])
    return out
```

```python
>>> docs = [
...     ["the", "cat", "sat"],
...     ["the", "dog", "sat"],
...     ["the", "cat", "ran"],
... ]
>>> vocab = build_vocab(docs)
>>> bow = bag_of_words(docs, vocab)
>>> tfidf(bow)
```

三篇文档，五个词表单词（`the`、`cat`、`sat`、`dog`、`ran`）。`the` 在三篇里都出现，所以它的 IDF 很低。`dog` 只在一篇里出现，所以它的 IDF 很高。这些向量是稀疏的（大多数条目都很小），而有区分度的单词会凸显出来。

### 第 5 步：对行做 L2 归一化

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

如果不做归一化，较长的文档会得到一个更大的向量，从而主导相似度得分。L2 归一化把每篇文档都放到单位超球面上。这样一来，行与行之间的余弦相似度（cosine similarity）就只是一个点积。

## 上手使用

scikit-learn 提供了生产级版本。

```python
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

docs = ["the cat sat on the mat", "the dog sat on the mat", "the cat ran"]

bow_vectorizer = CountVectorizer()
bow = bow_vectorizer.fit_transform(docs)
print(bow_vectorizer.get_feature_names_out())
print(bow.toarray())

tfidf_vectorizer = TfidfVectorizer()
tfidf = tfidf_vectorizer.fit_transform(docs)
print(tfidf.toarray().round(3))
```

`CountVectorizer` 一次调用就完成了分词、构建词表和 BoW。`TfidfVectorizer` 在此之上加入了 IDF 加权和 L2 归一化。两者都返回稀疏矩阵。对于 10 万篇文档，稠密版本无法放进内存；在分类器要求稠密格式之前，请一直保持稀疏。

会改变一切的关键旋钮：

| 参数 | 效果 |
|-----|--------|
| `ngram_range=(1, 2)` | 纳入二元词组（bigram）。通常能提升分类效果。 |
| `min_df=2` | 丢弃出现在少于 2 篇文档中的单词。在含噪数据上精简词表。 |
| `max_df=0.95` | 丢弃出现在超过 95% 文档中的单词。在不依赖硬编码停用词表的情况下近似实现停用词移除。 |
| `stop_words="english"` | scikit-learn 内置的停用词表。是否使用取决于任务——情感分析就*不*应该丢弃否定词。 |
| `sublinear_tf=True` | 使用 `1 + log(tf)` 而非原始的 `tf`。当某个词在一篇文档中重复多次时很有帮助。 |

### TF-IDF 仍占上风的场景（截至 2026 年）

- 垃圾邮件检测、主题打标、日志异常标记。关键在于单词是否出现，语义上的微妙差别无关紧要。
- 低数据场景（数百个有标注样本）。TF-IDF 加逻辑回归没有预训练成本。
- 任何对延迟敏感的地方。TF-IDF 加上一个线性模型可在微秒级给出答案。而把一篇文档通过 Transformer 做嵌入要花 10-100 毫秒。
- 必须对预测结果做出解释的系统。检查分类器的系数即可。排名最靠前的正向单词就是原因所在。

### TF-IDF 失效的场景

语义盲区式失效。看下面这两篇文档：

- "The movie was not good at all."（这部电影根本不好。）
- "The movie was excellent."（这部电影很出色。）

一篇是负面评价，一篇是正面评价。它们的 TF-IDF 重叠部分恰好是 `{the, movie, was}`。一个词袋分类器必须靠记忆来学到：`good` 附近出现 `not` 会翻转标签。给足够的数据它能学会，但永远不会像一个理解句法的模型那样优雅。

另一种失效：推理时遇到词表外（out-of-vocabulary）单词。一个在 IMDb 影评上训练的 BoW 模型，如果 `Zoomer-approved` 这个词元从未在训练中出现过，它就完全不知道该拿它怎么办。子词嵌入（subword embeddings，第 04 课）能处理这种情况，TF-IDF 不能。

### 混合方案：TF-IDF 加权的嵌入

2026 年针对中等数据量分类任务的务实默认做法：把 TF-IDF 权重当作词嵌入上的注意力（attention）。

```python
def tfidf_weighted_embedding(doc, tfidf_scores, embedding_table, dim):
    vec = [0.0] * dim
    total_weight = 0.0
    for token in doc:
        if token not in embedding_table or token not in tfidf_scores:
            continue
        weight = tfidf_scores[token]
        emb = embedding_table[token]
        for i in range(dim):
            vec[i] += weight * emb[i]
        total_weight += weight
    if total_weight == 0:
        return vec
    return [v / total_weight for v in vec]
```

你既从嵌入中获得了语义容量，又从 TF-IDF 中获得了对稀有词的强调。分类器在这个池化（pooled）后的向量上训练。在约 5 万个有标注样本以下的情感、主题和意图分类任务上，这种方案的表现优于单独使用其中任何一种。

## 交付落地

保存为 `outputs/prompt-vectorization-picker.md`：

```markdown
---
name: vectorization-picker
description: Given a text-classification task, recommend BoW, TF-IDF, embeddings, or a hybrid.
phase: 5
lesson: 02
---

You recommend a text-vectorization strategy. Given a task description, output:

1. Representation (BoW, TF-IDF, transformer embeddings, or a hybrid). Explain why in one sentence.
2. Specific vectorizer configuration. Name the library. Quote the arguments (`ngram_range`, `min_df`, `max_df`, `sublinear_tf`, `stop_words`).
3. One failure mode to test before shipping.

Refuse to recommend embeddings when the user has under 500 labeled examples unless they show evidence of semantic failure in a TF-IDF baseline. Refuse to remove stopwords for sentiment analysis (negations carry signal). Flag class imbalance as needing more than a vectorizer change.

Example input: "Classifying 30k customer support tickets into 12 categories. Most tickets are 2-3 sentences. English only. Need explainability for audit logs."

Example output:

- Representation: TF-IDF. 30k examples is not small; explainability requirement rules out dense embeddings.
- Config: `TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_df=0.95, sublinear_tf=True, stop_words=None)`. Keep stopwords because category keywords sometimes are stopwords ("not working" vs "working").
- Failure to test: verify `min_df=3` does not drop rare category keywords. Run `get_feature_names_out` filtered by class and eyeball.
```

## 练习

1. **简单。** 在 L2 归一化后的 TF-IDF 输出上实现 `cosine_similarity(doc_vec_a, doc_vec_b)`。验证相同文档得分为 1.0，词表不相交的文档得分为 0.0。
2. **中等。** 为 `bag_of_words` 添加 `n-gram` 支持。参数 `n` 产生对 `n` 元词组的计数。测试在 `["the", "cat", "sat"]` 上取 `n=2` 时，会为 `["the cat", "cat sat"]` 产生二元词组计数。
3. **困难。** 使用 GloVe 100 维向量（下载一次并缓存）构建上面的 TF-IDF 加权嵌入混合方案。在 20 Newsgroups 数据集上，将其分类准确率与纯 TF-IDF 以及纯均值池化（mean-pooled）嵌入做对比。报告各自在哪些情形下胜出。

## 关键术语

| 术语 | 大家怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| BoW | 词频向量 | 一篇文档中各词表单词的计数。抛弃词序。 |
| TF | 词频 | 一个词在一篇文档中的计数，可选地按文档长度归一化。 |
| DF | 文档频率 | 至少包含该词一次的文档数量。 |
| IDF | 逆文档频率 | 平滑后的 `log(N / df)`。对无处不在的单词降权。 |
| 稀疏向量 | 大部分是零 | 词表通常有 1 万到 10 万个单词；在任意给定文档中大多数都不出现。 |
| 余弦相似度 | 向量夹角 | L2 归一化后向量的点积。1 表示完全相同，0 表示正交。 |

## 延伸阅读

- [scikit-learn — 文本特征提取](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) —— 权威的 API 参考，外加对每个旋钮的说明。
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) —— 让 TF-IDF 在长达十年里成为默认选择的那篇论文。
- [《Why TF-IDF Still Beats Embeddings》—— Ashfaque Thonikkadavan（Medium）](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) —— 2026 年关于这一老方法何时胜出、为何胜出的观点。
