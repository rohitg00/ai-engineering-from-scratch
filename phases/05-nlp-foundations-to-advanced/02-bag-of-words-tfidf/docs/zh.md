# 词袋、TF-IDF 与文本表示（Bag of Words, TF-IDF, and Text Representation）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 先数数，再思考。在 2026 年，对边界清晰的任务，TF-IDF 仍然能打赢 embedding。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 02 (Linear Regression from Scratch)
**Time:** ~75 minutes

## 问题（The Problem）

模型只认数字，你手上却是字符串。

每条 NLP 流水线都要回答同一个问题：怎么把变长的 token 流变成一个定长向量，让分类器能吃下去。这个领域最早给出的答案，就是那个最笨但管用的——把词数一遍，凑成一个向量。

这个向量撑起的生产 NLP 系统比任何 embedding 模型都多。垃圾邮件过滤、主题分类、日志异常检测、搜索排序（BM25 之前的那一代）、第一波情感分析、学术 NLP 基准的头十年，全靠它。2026 年的从业者在面对边界明确的分类任务时，依旧会先伸手抓它。它快、可解释，而且在「词出现与否就是关键」的任务上，往往跟一个 400M 参数的 embedding 模型打得难分高下。

本节从零实现 bag of words，再实现 TF-IDF。然后展示 scikit-learn 怎么用三行代码做同样的事。最后点名让你不得不转向 embedding 的那种失败模式。

## 概念（The Concept）

**词袋（Bag of Words, BoW）** 把顺序扔掉。对每个文档，统计词表中每个词出现了多少次。向量长度就是词表大小。位置 `i` 的值是词 `i` 出现的次数。

**TF-IDF** 给 BoW 重新加权。每篇文档都出现的词没什么信息量，应当压低它的权重；在语料里罕见、却在某一篇文档里频繁出现的词才是信号，应当抬高它的权重。

```
TF-IDF(w, d) = TF(w, d) * IDF(w)
             = count(w in d) / |d| * log(N / df(w))
```

其中 `TF` 是词在文档中的词频（term frequency），`df` 是文档频率（document frequency，包含该词的文档数），`N` 是文档总数。`log` 让那些到处都出现的词不至于权重无限放大。

关键性质：两者都产出**稀疏向量，且每个轴都有可解释含义**。你可以查看一个训练好的分类器的权重，直接读出哪些词把文档推向哪一类。换成 768 维的 BERT embedding，你就读不出来了。

## 动手实现（Build It）

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

输入：一个已分词的文档列表（任何词级 tokenizer 都行；本节的 `code/main.py` 用了一个简化的小写变体）。输出：`{word: index}` 字典。Python 的稳定插入序意味着第 0 号词就是第一篇文档里出现的第一个词。约定不一；scikit-learn 是按字母排序的。

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

行是文档，列是词表索引。`[i][j]` 表示「词 `j` 在文档 `i` 中出现了多少次」。文档 1 里 `cat` 是 2，因为它本来就出现了两次；文档 0 里 `ran` 是 0，因为根本没出现。

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

两个值得点名的平滑技巧。`(n+1)/(d+1)` 是为了避开 `log(x/0)`。结尾的 `+1` 让那些「每篇文档都出现」的词的 IDF 仍是 1（而不是 0），与 scikit-learn 默认行为一致。其他实现会用原始的 `log(N/df)`。两种都能跑；带平滑的版本更友好。

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

三篇文档，五个词（`the`、`cat`、`sat`、`dog`、`ran`）。`the` 三篇都出现，IDF 很低；`dog` 只在一篇里出现，IDF 很高。向量是稀疏的（大部分项数值很小），区分度高的词会跳出来。

### 第 5 步：行做 L2 归一化

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

不归一化的话，长文档的向量会更大，会主导相似度分数。L2 归一化把所有文档放到单位超球面上。这样行向量之间的余弦相似度就直接等于点积。

## 用起来（Use It）

scikit-learn 自带生产级的实现。

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

`CountVectorizer` 一次完成 tokenization、词表构建、BoW。`TfidfVectorizer` 在此之上加 IDF 加权和 L2 归一化。两者都返回稀疏矩阵。10 万级文档的语料，稠密版本根本装不进内存；只要分类器不强求稠密，就一直保持稀疏。

会改变结果的几个旋钮：

| 参数 | 效果 |
|-----|--------|
| `ngram_range=(1, 2)` | 加入 bigram。通常能提升分类效果。 |
| `min_df=2` | 丢弃出现在少于 2 篇文档里的词。在噪声数据上修剪词表。 |
| `max_df=0.95` | 丢弃出现在 95% 以上文档里的词。等价于一个不写死列表的停用词剔除。 |
| `stop_words="english"` | scikit-learn 内置的英文停用词表。任务相关——情感分析**不应**丢掉否定词。 |
| `sublinear_tf=True` | 用 `1 + log(tf)` 代替原始 `tf`。某个词在一篇文档里反复出现时有用。 |

### 哪些场景下 TF-IDF 仍然能赢（截至 2026）

- 垃圾邮件检测、主题打标、日志异常标记。重要的是词的出现与否，语义细腻度并不关键。
- 低数据场景（几百条标注样本）。TF-IDF + logistic regression 没有预训练（pretraining）成本。
- 任何在意延迟的地方。TF-IDF + 线性模型在微秒级返回。把一篇文档过 transformer 编码要 10–100ms。
- 需要解释自己预测的系统。看分类器的系数，权重最高的正向词就是理由。

### 哪些场景下 TF-IDF 失败

**语义盲区**这种失败模式。看下面两篇文档：

- "The movie was not good at all."
- "The movie was excellent."

一篇是差评，一篇是好评。它们 TF-IDF 的重叠就只有 `{the, movie, was}`。一个词袋分类器必须硬背下「`not` 出现在 `good` 附近时标签翻转」。数据足够多它能学，但永远不如一个理解句法的模型来得优雅。

另一种失败：推理（inference）时的词表外（out-of-vocabulary）词。一个用 IMDb 影评训出来的 BoW 模型，遇到训练里从未出现过的 `Zoomer-approved` 时根本不知道该怎么办。子词 embedding（第 04 节）能搞定这个，TF-IDF 不行。

### 混合方案：TF-IDF 加权的 embedding

2026 年中等数据量分类的务实默认做法：把 TF-IDF 权重当作对词 embedding 的 attention（注意力）。

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

embedding 提供语义容量，TF-IDF 提供罕见词强调。分类器在合并后的向量上训练。在情感、主题、意图分类任务上，标注样本不到 5 万条左右时，这套混合方案优于其中任一单独的方法。

## 上线部署（Ship It）

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

## 练习（Exercises）

1. **简单。** 在 L2 归一化后的 TF-IDF 输出上实现 `cosine_similarity(doc_vec_a, doc_vec_b)`。验证完全相同的文档得分 1.0，词表完全不相交的文档得分 0.0。
2. **中等。** 给 `bag_of_words` 加上 `n-gram` 支持。参数 `n` 产出 `n`-gram 的计数。测试：在 `["the", "cat", "sat"]` 上 `n=2` 应当产出 `["the cat", "cat sat"]` 的 bigram 计数。
3. **困难。** 用 GloVe 100 维向量（下载一次，本地缓存）实现上文那个 TF-IDF 加权 embedding 混合方案。在 20 Newsgroups 数据集上，把它的分类准确率与朴素 TF-IDF、朴素均值池化 embedding 做对比。报告各自在哪种情形下取胜。

## 关键术语（Key Terms）

| 术语 | 大家平时怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| BoW | 词频向量 | 词表中每个词在一篇文档里的计数。顺序丢弃。 |
| TF | 词频 | 一个词在文档中的计数，可选地按文档长度归一化。 |
| DF | 文档频率 | 至少包含一次该词的文档数。 |
| IDF | 逆文档频率 | 平滑后的 `log(N / df)`。压低到处都出现的词的权重。 |
| 稀疏向量 | 大部分是零 | 词表通常 1 万到 10 万，绝大多数词在任何一篇文档里都不出现。 |
| 余弦相似度 | 向量夹角 | L2 归一化后的两个向量的点积。1 表示完全一致，0 表示正交。 |

## 延伸阅读（Further Reading）

- [scikit-learn — feature extraction from text](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) —— 权威 API 参考，每个旋钮都有注解。
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) —— 让 TF-IDF 成为整整十年默认方案的那篇论文。
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) —— 2026 年视角下回顾老方法什么时候依旧能赢，以及为什么。
