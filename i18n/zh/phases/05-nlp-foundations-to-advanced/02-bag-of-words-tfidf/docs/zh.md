# 词袋、TF-IDF 与文本表示

> 先计数，再思考。在 2026 年，针对边界清晰的任务，TF-IDF 仍然胜过嵌入向量。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 01（文本处理）、Phase 2 · 02（从零实现线性回归）
**Time:** 约 75 分钟

## 问题所在

模型需要数字，而你手上是字符串。

每个 NLP 流水线都必须回答同一个问题：如何把一个长度不定的 token 流转换成分类器可以消化的定长向量。这个领域给出的第一个答案是最笨但有效的那个——数单词，构造向量。

这种向量支撑过的生产级 NLP 系统，比任何嵌入模型都多。垃圾邮件过滤、主题分类、日志异常检测、搜索排序（BM25 之前）、第一波情感分析、学术 NLP 基准的最初十年。2026 年的从业者在窄域分类任务上仍然首先使用它。它快速、可解释，而且在“单词是否出现”才是关键的任务上，往往与 4 亿参数的嵌入模型难分伯仲。

本课从零构建词袋模型，然后是 TF-IDF。接着展示 scikit-learn 如何用三行代码完成同样的事。最后指出哪种失败模式会迫使你转向嵌入向量。

## 概念

**词袋**丢弃词序。对每篇文档，统计每个词汇表单词出现的次数。向量长度等于词汇表大小。位置 `i` 是单词 `i` 的计数。

**TF-IDF** 对词袋重新加权。出现在所有文档中的单词没有信息量，因此调低其权重。在整个语料库中罕见、但在单篇文档中频繁出现的单词才是信号，因此调高其权重。

```
TF-IDF(w, d) = TF(w, d) * IDF(w)
             = count(w in d) / |d| * log(N / df(w))
```

其中 `TF` 是单词在该文档中的词频，`df` 是文档频率（包含该单词的文档数），`N` 是文档总数。`log` 使无处不在的单词的权重保持有界。

关键性质：两者都产生坐标轴可解释的稀疏向量。你可以查看训练好的分类器的权重，直接读出哪些单词把文档推向哪个类别。768 维的 BERT 嵌入做不到这一点。

```figure
bow-tfidf
```

## 动手构建

### 步骤 1：构建词汇表

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

输入：分词后的文档列表（任何词级分词器都可以；本课的 `code/main.py` 使用了简化的 lowercase 变体）。输出：`{word: index}` 字典。稳定的插入顺序意味着单词索引 0 是第一篇文档中最先出现的单词。惯例各有不同；scikit-learn 按字母序排序。

### 步骤 2：词袋

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

行是文档，列是词汇表索引。条目 `[i][j]` 表示"单词 `j` 在文档 `i` 中出现的次数"。文档 1 中 `cat` 出现了两次，因为它确实出现了。文档 0 中 `ran` 的计数是零，因为它没有出现。

### 步骤 3：词频与文档频率

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

两个值得点名的平滑技巧。`(n+1)/(d+1)` 避免了 `log(x/0)`。末尾的 `+1` 确保出现在每篇文档中的单词 IDF 仍为 1（而不是 0），与 scikit-learn 的默认行为一致。其他实现使用原始的 `log(N/df)`。两种都可行；平滑版本更友好。

### 步骤 4：TF-IDF

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

三篇文档，五个词汇表单词（`the`、`cat`、`sat`、`dog`、`ran`）。`the` 出现在全部三篇中，所以它的 IDF 很低。`dog` 只出现在一篇中，所以它的 IDF 很高。向量是稀疏的（大多数条目很小），而有区分力的单词脱颖而出。

### 步骤 5：L2 归一化各行

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

如果不做归一化，较长的文档会得到更大的向量，从而在相似度得分中占据主导。L2 归一化把每篇文档放到单位超球面上。此时行间的余弦相似度就是一个简单的点积。

## 实际使用

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

`CountVectorizer` 一次调用完成分词、词汇表构建和词袋。`TfidfVectorizer` 增加 IDF 加权和 L2 归一化。两者都返回稀疏矩阵。对于 10 万篇文档，稠密版本无法装入内存；在分类器要求稠密输入之前，保持稀疏。

能改变一切的参数：

| 参数 | 作用 |
|-----|--------|
| `ngram_range=(1, 2)` | 包含二元词组。通常能提升分类效果。 |
| `min_df=2` | 丢弃出现在少于 2 篇文档中的单词。在噪声数据上精简词汇表。 |
| `max_df=0.95` | 丢弃出现在超过 95% 文档中的单词。无需硬编码列表即可近似停用词过滤。 |
| `stop_words="english"` | scikit-learn 内置的停用词表。取决于任务——情感分析*不应*丢弃否定词。 |
| `sublinear_tf=True` | 使用 `1 + log(tf)` 而非原始的 `tf`。当某个词在单篇文档中重复很多次时有帮助。 |

### TF-IDF 仍然胜出的场景（截至 2026 年）

- 垃圾邮件检测、主题标注、日志异常标记。关键在于单词是否出现；语义上的细微差别无关紧要。
- 低数据量场景（数百条有标注的样本）。TF-IDF 加逻辑回归没有预训练成本。
- 任何对延迟敏感的场合。TF-IDF 加线性模型在微秒级给出答案。用 Transformer 嵌入一篇文档需要 10–100 毫秒。
- 必须能解释预测结果的系统。查看分类器的系数，排名靠前的正向权重单词就是理由。

### TF-IDF 何时失败

语义盲视失败。考虑这两篇文档：

- "The movie was not good at all."
- "The movie was excellent."

一篇是负面评论，一篇是正面评论。它们的 TF-IDF 重叠恰好是 `{the, movie, was}`。词袋分类器必须靠记忆学到：`good` 附近的单词 `not` 会翻转标签。数据足够多时它可以学会，但永远不如一个理解语法的模型来得优雅。

另一种失败：推理时遇到词汇表之外的单词。在 IMDb 评论上训练的词袋模型，如果 `Zoomer-approved` 这个 token 在训练中从未出现，就不知道如何处理。子词嵌入（第 04 课）可以应对这种情况。TF-IDF 不能。

### 混合方案：TF-IDF 加权嵌入

2026 年中等数据量分类的务实默认方案：用 TF-IDF 权重作为单词嵌入上的注意力。

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

你从嵌入向量获得语义能力，从 TF-IDF 获得对稀有词的强调。分类器在池化后的向量上训练。在大约 5 万条以下有标注样本的情感、主题和意图分类任务上，这种方案优于任何单独使用的方法。

## 发布上线

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

1. **简单。** 在 L2 归一化的 TF-IDF 输出上实现 `cosine_similarity(doc_vec_a, doc_vec_b)`。验证相同文档得分为 1.0，词汇表完全不相交的文档得分为 0.0。
2. **中等。** 为 `bag_of_words` 添加 `n-gram` 支持。参数 `n` 生成 `n`-gram 的计数。测试 `n=2` 在 `["the", "cat", "sat"]` 上会为 `["the cat", "cat sat"]` 生成二元词组计数。
3. **困难。** 使用 GloVe 100d 向量（下载一次并缓存）构建上面的 TF-IDF 加权嵌入混合方案。在 20 Newsgroups 数据集上，将其分类准确率与纯 TF-IDF 和纯均值池化嵌入进行比较。报告各自在哪里胜出。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| BoW | 词频向量 | 单篇文档中词汇表单词的计数。丢弃词序。 |
| TF | 词频 | 一个单词在文档中的计数，可选按文档长度归一化。 |
| DF | 文档频率 | 至少包含该单词一次的文档数。 |
| IDF | 逆文档频率 | 经 `log(N / df)` 平滑。降低无处不在的单词的权重。 |
| 稀疏向量 | 大部分是零 | 词汇表通常有 1 万到 10 万个单词；任何给定文档中大多数都不出现。 |
| 余弦相似度 | 向量夹角 | L2 归一化向量的点积。1 表示相同，0 表示正交。 |

## 延伸阅读

- [scikit-learn — 从文本中提取特征](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) — 权威 API 参考，并附有每个参数的说明。
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) — 让 TF-IDF 成为一项十年默认标准的论文。
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) — 2026 年对这一老方法何时胜出及其原因的看法。