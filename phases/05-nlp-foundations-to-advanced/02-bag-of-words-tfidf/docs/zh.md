# 词袋、TF-IDF与文本表示

> 先计数，再思考。TF-IDF在2026年仍然能在定义良好的任务上胜过嵌入（Embeddings）。

**类型：** 构建
**语言：** Python
**前置要求：** 阶段5·01（文本处理），阶段2·02（线性回归从零实现）
**时长：** ~75分钟

## 问题

模型需要数字。你有的却是字符串。

每个自然语言处理（NLP）流程都必须回答同一个问题：如何将一个可变长度的词元流转换成一个固定大小的向量，让分类器能够消费？这个领域最初找到的第一个可行答案，就是那个最朴素但有效的方法：统计单词，构成向量。

这个向量承载的生产级NLP任务比任何嵌入模型都要多。垃圾邮件过滤、主题分类、日志异常检测、搜索排序（在BM25之前）、第一波情感分析、学术NLP基准测试的前十年。2026年的从业者在狭窄的分类任务上仍然首先使用它。它速度很快，可解释性强，并且在那些单词出现与否才是关键的任务上，往往与400M参数的嵌入模型难分伯仲。

本课将从零开始构建词袋（Bag of Words），然后是TF-IDF。然后展示scikit-learn如何用三行代码完成相同的工作。最后指出需要改用嵌入时的失败模式。

## 概念

**词袋（Bag of Words, BoW）** 丢弃了顺序。对于每个文档，统计每个词汇表中的单词出现了多少次。向量的长度就是词汇表的大小。位置 `i` 是单词 `i` 的计数。

**TF-IDF** 重新加权了BoW。出现在每个文档中的单词是无信息量的，因此降低它的权重。在整个语料库中罕见但在单个文档中频繁出现的单词是信号，因此提高它的权重。

```
TF-IDF(w, d) = TF(w, d) * IDF(w)
             = count(w in d) / |d| * log(N / df(w))
```

其中 `TF` 是词项在文档中的频率，`df` 是文档频率（包含该单词的文档数量），`N` 是文档总数。`log` 保证普遍存在的单词的权重不会过大。

关键特性：两者都生成具有可解释轴的稀疏向量。你可以查看训练好的分类器的权重，并读出哪些单词将文档推向每个类别。而使用768维的BERT嵌入是无法做到这一点的。

## 构建它

### 第1步：构建词汇表

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

输入：分词后的文档列表（任何词级分词器都可以；本课中的 `code/main.py` 使用简化的小写变体）。输出：`{word: index}` 字典。稳定的插入顺序意味着单词索引0是第一个文档中遇到的第一个单词。惯例各不相同；scikit-learn 按字母顺序排序。

### 第2步：词袋

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

行是文档，列是词汇表索引。条目 `[i][j]` 表示“单词 `j` 在文档 `i` 中出现了多少次”。文档1包含 `cat` 两次，因为它确实出现了两次。文档0包含 `ran` 零次，因为它没有出现。

### 第3步：词频和文档频率

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

有两个值得提及的平滑技巧。`(n+1)/(d+1)` 避免了 `log(x/0)`。末尾的 `+1` 确保了出现在每个文档中的单词仍然有IDF值1（而不是0），这与scikit-learn的默认设置一致。其他实现使用原始的 `log(N/df)`。两者都有效；平滑版本更友好。

### 第4步：TF-IDF

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

三个文档，五个词汇表单词（`the`, `cat`, `sat`, `dog`, `ran`）。`the` 出现在所有三个文档中，因此其IDF较低。`dog` 出现在一个文档中，因此其IDF较高。向量是稀疏的（大多数条目都很小），具有区分性的单词会凸显出来。

### 第5步：L2归一化行

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

如果不做归一化，较长的文档会得到更大的向量，并在相似度计算中占据主导地位。L2归一化将每个文档放在单位超球面上。行之间的余弦相似度现在就是点积。

## 使用它

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

`CountVectorizer` 在一次调用中完成了分词、词汇表和词袋。`TfidfVectorizer` 增加了IDF加权和L2归一化。两者都返回稀疏矩阵。对于10万篇文档，密集版本无法存入内存；在分类器要求密集表示之前，始终使用稀疏形式。

能够改变一切的参数：

| 参数 | 效果 |
|------|--------|
| `ngram_range=(1, 2)` | 包含二元组。通常能提升分类效果。 |
| `min_df=2` | 丢弃出现在少于2个文档中的单词。针对噪声数据修剪词汇表。 |
| `max_df=0.95` | 丢弃出现在超过95%文档中的单词。无需硬编码列表即可近似去除停用词。 |
| `stop_words="english"` | scikit-learn 内置的停用词列表。任务相关——情感分析*不应*丢弃否定词。 |
| `sublinear_tf=True` | 使用 `1 + log(tf)` 替代原始 `tf`。当某个词项在一个文档中重复多次时很有帮助。 |

### 何时TF-IDF仍然胜出（截至2026年）

- 垃圾邮件检测、主题标注、日志异常标记。单词出现与否是关键；语义细微差别不重要。
- 低数据场景（数百个标注样本）。TF-IDF加上逻辑回归没有预训练成本。
- 任何对延迟敏感的地方。TF-IDF加上线性模型在微秒级响应。通过Transformer对文档进行嵌入需要10-100毫秒。
- 必须解释其预测的系统。检查分类器的系数。正向最强的单词就是原因。

### 何时TF-IDF失败

语义盲区。考虑以下两个文档：

- "The movie was not good at all."
- "The movie was excellent."

一个是负面评价，一个是正面评价。它们的TF-IDF重叠正好是 `{the, movie, was}`。词袋分类器必须记住单词 `not` 靠近 `good` 会翻转标签。在足够多的数据上它可以学会这一点，但永远无法像理解句法的模型那样优雅。

另一个失败点：推理时遇到词汇表外的单词。在IMDb评论上训练的词袋模型如果从未见过 `Zoomer-approved` 这个词元，就完全不知道如何处理。子词嵌入（第04课）可以处理这种情况。TF-IDF不行。

### 混合方案：TF-IDF加权嵌入

2026年中等数据分类的实用默认方案：使用TF-IDF权重作为对词嵌入的注意力机制。

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

你从嵌入中获得了语义能力，从TF-IDF中获得了罕见词强调。分类器在池化后的向量上进行训练。在约5万个标注样本以下的情感情感、主题和意图分类中，它的表现优于任何一种单独的方法。

## 产出它

保存为 `outputs/prompt-vectorization-picker.md`：

```markdown
---
name: vectorization-picker
description: 给定一个文本分类任务，推荐词袋、TF-IDF、嵌入或混合方案。
phase: 5
lesson: 02
---

你推荐一种文本向量化策略。给定一个任务描述，输出：

1. 表示方法（词袋、TF-IDF、Transformer嵌入或混合方案）。用一句话解释原因。
2. 具体的向量化器配置。说明使用的库。引用参数（`ngram_range`, `min_df`, `max_df`, `sublinear_tf`, `stop_words`）。
3. 上线前需要测试的一个失败模式。

当用户标注样本少于500个时，拒绝推荐嵌入，除非他们有证据表明TF-IDF基线存在语义失败。对于情感分析，拒绝去除停用词（否定词包含信号）。标记类别不平衡问题，指出这不仅仅是向量化器改变就能解决的。

示例输入："将3万张客服工单分为12个类别。大多数工单长度为2-3句话。仅英文。需要为审计日志提供可解释性。"

示例输出：

- 表示方法：TF-IDF。3万个样本不算少；可解释性要求排除了密集嵌入。
- 配置：`TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_df=0.95, sublinear_tf=True, stop_words=None)`。保留停用词，因为类别关键词有时本身就是停用词（例如"not working" vs "working"）。
- 需要测试的失败：验证 `min_df=3` 没有丢弃罕见的类别关键词。按类别筛选 `get_feature_names_out` 并进行人工检查。
```

## 练习

1. **简单。** 在L2归一化的TF-IDF输出上实现 `cosine_similarity(doc_vec_a, doc_vec_b)`。验证相同文档得分为1.0，词汇表完全不重叠的文档得分为0.0。
2. **中等。** 为 `bag_of_words` 添加 `n-gram` 支持。参数 `n` 产生 `n` 元组的计数。测试 `n=2` 在 `["the", "cat", "sat"]` 上是否能为 `["the cat", "cat sat"]` 生成二元组计数。
3. **困难。** 使用GloVe 100维向量（下载一次，缓存）构建上述TF-IDF加权嵌入混合方案。在20个新闻组数据集上将分类准确率与纯TF-IDF和纯平均池化嵌入进行比较。报告哪种方法在何种情况下胜出。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| BoW | 词频向量 | 一个文档中词汇表单词的计数。丢弃顺序。 |
| TF | 词项频率（Term Frequency） | 一个单词在文档中出现的次数，可选地按文档长度归一化。 |
| DF | 文档频率（Document Frequency） | 至少包含该单词一次的文档数量。 |
| IDF | 逆文档频率（Inverse Document Frequency） | `log(N / df)` 平滑版。降低出现在所有文档中的单词的权重。 |
| 稀疏向量 | 大部分为零 | 词汇表通常为1万到10万个单词；大部分单词在任意给定文档中都不出现。 |
| 余弦相似度 | 向量夹角 | L2归一化向量的点积。1表示完全相同，0表示正交。 |

## 延伸阅读

- [scikit-learn — 文本特征提取](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) — 权威API参考，包含每个参数的注释。
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) — 让TF-IDF成为十年默认方法的论文。
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) — 2026年关于旧方法何时胜出以及为何胜出的观点。