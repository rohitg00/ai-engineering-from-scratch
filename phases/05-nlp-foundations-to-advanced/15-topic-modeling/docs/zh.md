# 主题建模- LDA和BER主题

> LDA：文档是主题的混合体，主题是单词的分布。BER Topic：文档在嵌入空间中集群，集群是主题。相同的目标，不同的原始人。

** 类型：** 学习
** 语言：** Python
** 先决条件：** 阶段5 · 02（BoW + TF-IDF）、阶段5 · 03（Word 2 Vec）
** 时间：** ~45分钟

## 问题

您有10，000份客户支持票、50，000篇新闻文章或200，000条推文。您需要在不阅读该系列的情况下就知道该系列是关于什么的。您没有标记的类别。你甚至不知道有多少个类别。

主题建模在没有监督的情况下回答了这个问题。给它一个文集，取回一小组连贯的主题，并为每个文档提供这些主题的分布。

两个算法家族占主导地位。LDA（2003）将每个文档视为潜在主题的混合物，并将每个主题视为单词的分布。推理是Bayesian的。它仍然在生产中发布，其中您需要混合成员主题作业和可解释的单词级概率分布。

BERTopic（2020）使用BERT编码文档，使用UMAP降维，使用HDBSCAN进行集群，并通过基于类的TF-IDF提取主题词。它在短文本、社交媒体以及任何语义相似性比单词重叠更重要的事物上获胜。一个文档有一个主题，这是长篇内容的限制。

本课为两者建立了直觉，并指定了为给定的数据库选择哪一个。

## 概念

![LDA mixture model vs BERTopic clustering](../assets/topic-modeling.svg)

**LDA生成故事。**每个主题都是单词的分布。每个文档都是主题的混合体。要在文档中生成单词，请从文档的混合物中采样主题，然后从该主题的分布中采样单词。推理相反：给定观察到的单词，推断每个文档的主题分布和每个主题的单词分布。折叠吉布斯抽样或变分Bayes计算数学。

关键LDA输出：

- ' Doc_topic '：矩阵'（n_docs，n_topics）'，每一行总和为1（文档的主题混合）。
- `topic_word`：matrix `（n_topics，vocab_size）`，每行加和为1（topic的单词分布）。

** BER Topic管道。**

1. 使用句子Transformer对每个文档进行编码（例如，' all-MiniLM-L6-v2 '）。384-暗淡的载体。
2. 使用UMAP将维度减少到~5个维度。BERT嵌入的亮度太高，无法进行集群。
3. 使用HDBSCAN进行集群。基于密度，产生可变大小的集群和“离群值”标签。
4. 对于每个集群，在集群的文档上计算基于类的TF-IDF以提取顶级单词。

输出是每个文档一个主题（加上-1离群值标签）。可选地，通过HDSCAN的概率载体获得软成员资格。

## 建设党

### 第1步：通过scikit-learn的LDA

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import numpy as np


def fit_lda(documents, n_topics=5, max_features=1000):
    cv = CountVectorizer(
        max_features=max_features,
        stop_words="english",
        min_df=2,
        max_df=0.9,
    )
    X = cv.fit_transform(documents)
    lda = LatentDirichletAllocation(
        n_components=n_topics,
        random_state=42,
        max_iter=50,
        learning_method="online",
    )
    doc_topic = lda.fit_transform(X)
    feature_names = cv.get_feature_names_out()
    return lda, cv, doc_topic, feature_names


def print_top_words(lda, feature_names, n_top=10):
    for idx, topic in enumerate(lda.components_):
        top_idx = np.argsort(-topic)[:n_top]
        words = [feature_names[i] for i in top_idx]
        print(f"topic {idx}: {' '.join(words)}")
```

注意：删除了停用词，min_df和max_df过滤了罕见和普遍存在的术语，CountVectorizer（而不是TfidfVectorizer），因为LDA需要原始计数。

### 第2步：BER Topic（制作）

```python
from bertopic import BERTopic

topic_model = BERTopic(
    embedding_model="sentence-transformers/all-MiniLM-L6-v2",
    min_topic_size=15,
    verbose=True,
)

topics, probs = topic_model.fit_transform(documents)
info = topic_model.get_topic_info()
print(info.head(20))
valid_topics = info[info["Topic"] != -1]["Topic"].tolist()
for topic_id in valid_topics[:5]:
    print(f"topic {topic_id}: {topic_model.get_topic(topic_id)[:10]}")
```

过滤器上的`主题！= -1`删除BERTopic的离群值存储桶（文档HDBSCAN无法群集）。`min_topic_size`控制HDBSCAN的最小集群大小; BERTopic的库默认值为10。此示例将课程的音阶显式设置为15。对于超过10，000个文档的文集，增加到50或100个。

### 第3步：评估

这两种方法都输出主题词。问题是这些词是否一致。

- ** 主题连贯性（c_v）。**将滑动窗口上下文中的热门词对的NPMI（归一化逐点互信息）组合起来，将得分聚合成主题向量，并通过余弦相似度比较这些向量。越高越好。使用`gensim.models.CoherenceModel`和`coherence=“c_v”`。
- ** 话题多样性。**所有主题的热门词中独特词的比例。越高越好（主题不重叠）。
- ** 定性检查。**阅读每个主题的重要词。他们有说出真实的东西吗？人类的判断仍然是最后一道防线。

## 何时选择哪个

| 情况 | 接 |
|-----------|------|
| 简短文本（推文、评论、头条新闻） | BER话题 |
| 具有主题混合的长文档 | LDA |
| 无图形处理器/有限计算 | LDA或NMF |
| 需要文档级多主题分发 | LDA |
| LLM集成主题标签 | BER Topic（直接支持） |
| 资源受限的边缘部署 | LDA |
| 最大语义连贯性 | BER话题 |

最大的实际考虑因素是文档长度。BERT嵌入会被截断; LDA计算任何长度的工作。对于比嵌入模型的上下文更长的文档，可以块+聚合或使用LDA。

## 使用它

2026年堆栈：

- ** BER话题。**默认用于短文本和任何语义重要的内容。
- **' gensim.models.LdaModel '。**经典LDA用于生产，成熟，久经考验。
- **' sklearn. decomation.LatentDirichletAllocation '。**用于实验的简单LDA。
- **NMF。**非负矩阵分解快速替代LDA，短文本的质量相当。
- **Top2Vec。**设计与BER Topic相似。社区较小，但在一些基准上表现出色。
- ** 快速电影。**在非常大的数据库上比BER Topic更新、更快。
- ** 基于LLM的标签。**运行任何集群，然后提示模型命名每个集群。

## 把它运

另存为“输出/skill-topic-picker.md”：

```markdown
---
name: topic-picker
description: Pick LDA or BERTopic for a corpus. Specify library, knobs, evaluation.
version: 1.0.0
phase: 5
lesson: 15
tags: [nlp, topic-modeling]
---

Given a corpus description (document count, avg length, domain, language, compute budget), output:

1. Algorithm. LDA / NMF / BERTopic / Top2Vec / FASTopic. One-sentence reason.
2. Configuration. Number of topics: `recommended = max(5, round(sqrt(n_docs)))`, clamped to 200 for corpora under 40,000 docs; permit >200 only when the corpus is genuinely large (>40k) and note the increased compute cost. `min_df` / `max_df` filters and embedding model for neural approaches also belong here.
3. Evaluation. Topic coherence (c_v) via `gensim.models.CoherenceModel`, topic diversity, and a 20-sample human read.
4. Failure mode to probe. For LDA, "junk topics" absorbing stopwords and frequent terms. For BERTopic, the -1 outlier cluster swallowing ambiguous documents.

Refuse BERTopic on documents longer than the embedding model's context window without a chunking strategy. Refuse LDA on very short text (tweets, reviews under 10 tokens) as coherence collapses. Flag any n_topics choice below 5 as likely wrong; flag >200 on corpora under 40k docs as likely over-splitting.
```

## 演习

1. ** 简单。**将LDA与20个新闻组数据集中的5个主题匹配。打印每个主题前10个单词。手工标记每个主题。算法找到了真实的类别吗？
2. ** 中等。**将BER Topic安装到相同的20个新闻组子集上。将发现的主题数量、热门词和定性一致性与LDA进行比较。哪一个更清晰地体现了真实的类别？
3. ** 很难。**在您的数据库上计算LDA和BER Topic的c_v一致性。每个主题运行5、10、20、50个主题。情节连贯性与主题计数。报告哪种方法在主题计数中更稳定。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 话题 | 这是一件事。 | 单词上的概率分布（LDA）或相似文档集群（BER Topic）。 |
| 混合成员 | 文档是多个主题 | LDA为每个文档分配了所有主题的分布。 |
| UMAP | 降维 | 保留本地结构的多样化学习;用于BER Topic。 |
| HDBSCAN | 密度聚类 | 查找可变大小的聚类;为离群值生成“噪声”标签（-1）。 |
| c_v一致性 | 主题质量指标 | 滑动窗口内顶级主题词的平均逐点互信息。 |

## 进一步阅读

- [Blei，Ng，Jordan（2003）。潜在Dirichlet分配]（https：//www.jmlr.org/papers/volume3/blei03a/blei03a.pdf）-LDA论文。
- [Grootendorst（2022）。BERTopic：使用基于类的TF-IDF过程进行神经主题建模]（https：//arxiv.org/ab/2203.05794）-BERTopic论文。
- [Röder，Both，Hinneburg（2015）. Exploring the Space of Topic Coherence Measures]（https：//svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf）-介绍c_v和friends的论文。
- [BERTopic文档]（https：//maartengr.github.io/BERTopic/）-制作参考。很好的例子。
