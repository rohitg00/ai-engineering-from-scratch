# 字体包,TF-IDF,文字表示

> 根据F-IDF的数据,在2026年,

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 02 (Linear Regression from Scratch)
**Time:** ~75 minutes

## 问题

模型需要数字,你有字符串.

每个NLP管道都必须回答同一个问题.我们如何将变长的代币流转化为一个固定尺寸的向量,一个分类器可以消耗. 首先答案是最愚蠢的答案. 计算字母. 制作向量.

输出量比任何嵌入式模型都多. 垃圾邮件过器,主题分类器,日志异常检测,搜索排名 (BM25之前),情感分析的第一波, 2026年,从业者仍然在狭窄的分类任务上先达到它. 它是快速的,可解释的,而且往往无法区分于400M参数嵌入模型,

课程将从零开始构建一个词包,然后是TF-IDF,然后将Skit-Learn在三个行中做同样的事情,然后将导致你接触嵌入的失败模式命名.

## 概念

**Bag of Words (BoW)**对于每个文件,计算每个词汇词汇出现的次数. 矢量长度是词汇大小. 位置 `i`是字数`i`现在,我们要去.

**TF-IDF**任何文件中出现的单词都是非信息性的,所以缩小.一个词在整个文件中很少出现,但在单一文件中频繁的,是信号,所以缩小.

```math
\begin{aligned}
\text{TF-IDF}(w, d) &= \text{TF}(w, d) \cdot \text{IDF}(w) \\
&= \frac{\mathop{\mathrm{count}}(w \text{ in } d)}{|d|} \cdot \log\frac{N}{\mathop{\mathrm{df}}(w)}
\end{aligned}
```

在哪里?`TF`是文件中的术语频率,`df`是文件频率 (包含这个词的文件数量),`N`文件是全部的文件.`log`限制了人们使用无处不在的词语的重量.

两个产生的稀疏向量具有可解释轴.你可以看看训练有素的分类器的重量,并读出哪些单词将文档推向每个类.你不能用768维的BERT嵌入来做到这一点.

```figure
bow-tfidf
```

## 建立它

### 步骤1:建立词汇库

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

输入:标记文件列表 (任何字面级标记器都会做; `code/main.py`在本课程中使用简体小写的变体.`{word: index}`标签: 稳定插入顺序 意思是字符指数0是第一个文档中看到的第一字. 公约有所不同; scikit-learn类型以字母顺序.

### 步骤2:字包

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

列是文件,列是词汇指数.`[i][j]`是"多次说话"`j`在文件中显示`i`"第一医生有`cat`医生0已经做了.`ran`没有,因为没有.

### 步骤3:术语频率和文件频率

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

两种滑滑技巧值得命名.`(n+1)/(d+1)`避免`log(x/0)`后面的东西`+1`确保每个文件中的单词仍然具有 IDF 1 (而不是 0),与 scikit-learn的默认匹配.`log(N/df)`两者都能工作,但更友好的版本.

### 步骤4:TF-IDF

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

文件,字母词 (`the`现在`cat`现在`sat`现在`dog`现在`ran`它们是`the`现在,它在三部都出现了,所以 IDF 很低.`dog`由于这些词汇的数量很高,这些向量很稀少 (大多数输入都是零).即使在这个玩具中,歧视性词语也会出现.

### 步骤 5: L2 规范行

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

没有正常化,一个更长的文档得到了更大的向量,并且占据了相似度分数.L2正常化将每个文档放在单元超层上.

## 用它

子学习将生产版本发送.

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

`CountVectorizer`能在一个电话中实现代码化,词汇和BoW. `TfidfVectorizer`增加 IDF 重量和 L2 正规化. 两者都返回稀疏矩阵. 在100k 文件中,密集版本不适合内存;保持稀疏直到分类器要求密集.

改变一切的节点:

| Arg | Effect |
|-----|--------|
| `ngram_range=(1, 2)` | Include bigrams. Usually boosts classification. |
| `min_df=2` | Drop words in fewer than 2 docs. Trims vocabulary on noisy data. |
| `max_df=0.95` | Drop words in more than 95% of docs. Approximates stopword removal without a hardcoded list. |
| `stop_words="english"` | scikit-learn's builtin stopword list. Task-dependent — sentiment analysis should *not* drop negations. |
| `sublinear_tf=True` | Use `1 + log(tf)` instead of raw `tf`. Helps when a term repeats many times in one doc. |

### 尽管TF-IDF仍然在胜利 (2026年)

- 标签,记录异常标记,词存在是重要的,语义细微的不同.
- 低数据模式 (数百个标记的例子).TF-IDF加上物流回归没有预训费用.
- 任何地方延迟都重要.TF-IDF加上线性模型在微秒内回答.通过变压器嵌入文件需要10-100ms.
- 系统必须解释他们的预测,检查分类器的系数. 最好的正面词是原因.

### 当TF-IDF失败时

根据这两个文件:

- "这部电影根本不好.
- "这部电影很棒.

一是负面评价,一个是积极的,他们的TF-IDF重叠是完全的`{the, movie, was}`一个词包分类器必须记住这个词`not`附近`good`它可以从足够的数据中学习,但从来没有像理解语法模型那样优雅.

另一种失败:在推断时,不存在词汇库中的单词.`Zoomer-approved`如果该代币从未出现在训练中. 字母嵌入式 (课4) 处理这一点. TF-IDF不能.

### 混合型:TF-IDF权重嵌入式

2026年中型数据分类的实际默认:使用TF-IDF权重作为关注词嵌入.

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

您从嵌入式中获得语义能力,并从TF-IDF中强调稀有词. 类别列在聚合向量上. 这在约50k标记的例子下,在情感,主题和意图分类方面本身都比较好.

## 运送它

保存如`outputs/prompt-vectorization-picker.md`其他:

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

## 运动

1. **Easy.**实施`cosine_similarity(doc_vec_a, doc_vec_b)`检查相同文件的分数为1.0和分离词汇文件的分数为0.0.
2. **Medium.**加入`n-gram`支持`bag_of_words`参数`n`产量超过了`n`- 试试吧`n=2`现在`["the", "cat", "sat"]`产生了大数的数量.`["the cat", "cat sat"]`现在,我们要去.
3. **Hard.**通过 GloVe 100d 矢量 (下载一次,缓存) 构建上述TF-IDF 重量嵌入式混合式. 根据20新闻组数据集中的简单TF-IDF和简单中共嵌入式进行分类精度比较. 报告哪个获胜.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BoW | Word frequency vector | Counts of vocabulary words in one document. Throws away order. |
| TF | Term frequency | Count of a word in a document, optionally normalized by document length. |
| DF | Document frequency | Count of documents containing the word at least once. |
| IDF | Inverse document frequency | `log(N / df)` smoothed. Downweights words that appear everywhere. |
| Sparse vector | Mostly zeros | Vocabulary is typically 10k-100k words; most are absent from any given document. |
| Cosine similarity | Vector angle | Dot product of L2-normalized vectors. 1 is identical, 0 is orthogonal. |

## 进一步阅读

- [scikit-learn — feature extraction from text](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction)法典API参考,加上每个上的注释.
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210)使TF-IDF成为十年的默认文件.
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) 2026年,当旧方法获胜时,以及为什么.
