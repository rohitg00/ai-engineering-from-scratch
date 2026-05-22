# 主题建模——LDA与BERTopic

> LDA：文档是主题的混合，主题是单词上的分布。BERTopic：文档在嵌入空间中聚类，聚类即主题。目标相同，基本要素不同。

**类型：** 学习  
**语言：** Python  
**前置知识：** 阶段5·02（词袋+TF-IDF），阶段5·03（Word2Vec）  
**时长：** 约45分钟

## 问题描述

你手上有10,000条客户支持工单、50,000篇新闻文章或200,000条推文。你需要在不阅读它们的情况下了解这些内容的整体主题。你没有标注好的类别，甚至不知道有多少个类别存在。

主题建模（Topic Modeling）可以在无监督的情况下解决这个问题。给一个语料库，它会返回一小组合乎逻辑的主题，并且为每篇文档返回其在这些主题上的分布。

两大算法家族主导了这个领域。LDA（2003年）将每篇文档视为潜在主题的混合，每个主题视为单词上的分布。其推理过程基于贝叶斯方法。它至今仍被用于生产环境，特别是在需要混合成员（mixed-membership）主题分配和可解释的词级概率分布的场景中。

BERTopic（2020年）使用BERT对文档进行编码，用UMAP降维，用HDBSCAN聚类，并通过基于类别的TF-IDF提取主题词。它在短文本、社交媒体以及任何语义相似性比词重叠更重要的场景中表现出色。每篇文档获得一个主题，这对于长文本来说是一个限制。

本课程旨在为这两种方法建立直觉，并指导如何为给定的语料库选择合适的方法。

## 概念

![LDA混合模型与BERTopic聚类对比](../assets/topic-modeling.svg)

**LDA生成故事。** 每个主题是单词上的一个分布。每篇文档是主题的一个混合。要生成文档中的一个词，先从文档的主题混合中采样一个主题，然后从该主题的分布中采样一个词。推理过程则相反：根据观察到的单词，推断每篇文档的主题分布和每个主题的词分布。坍缩吉布斯采样（Collapsed Gibbs sampling）或变分贝叶斯（variational Bayes）完成数学计算。

LDA的关键输出：

- `doc_topic`：矩阵 `(n_docs, n_topics)`，每一行和为1（文档的主题混合）。
- `topic_word`：矩阵 `(n_topics, vocab_size)`，每一行和为1（主题的词分布）。

**BERTopic流程。**

1. 使用句子转换器（如 `all-MiniLM-L6-v2`）对每篇文档进行编码，得到384维向量。
2. 使用UMAP将维度降至约5维。BERT嵌入维度太高，不适合直接聚类。
3. 使用HDBSCAN进行聚类。基于密度的算法，能产生可变大小的聚类和一个“离群点”标签。
4. 对每个聚类，基于该聚类内的文档计算基于类别的TF-IDF，以提取最重要的词。

输出结果是每篇文档一个主题（加上-1离群点标签）。也可通过HDBSCAN的概率向量获得软成员（soft membership）关系。

## 动手实现

### 第一步：通过scikit-learn实现LDA

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

注意：去除了停用词，`min_df` 和 `max_df` 过滤掉了稀有词和过于常见的词，使用 `CountVectorizer`（而非 `TfidfVectorizer`），因为LDA期望的是原始计数值。

### 第二步：BERTopic（生产环境）

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

过滤 `Topic != -1` 是为了剔除BERTopic的离群点桶（HDBSCAN无法聚类的文档）。`min_topic_size` 控制HDBSCAN的最小聚类大小；BERTopic库的默认值是10。本示例为了适配课程的规模，将其显式设为15。对于超过10,000篇文档的语料库，应增加到50或100。

### 第三步：评估

两种方法都会输出主题词。问题在于这些词是否具有连贯性。

- **主题连贯性（c_v）。** 结合了前几个主题词对在滑动窗口上下文中的NPMI（归一化逐点互信息，Normalized Pointwise Mutual Information），将分数聚合成主题向量，然后通过余弦相似度比较这些向量。值越高越好。使用 `gensim.models.CoherenceModel`，参数 `coherence="c_v"`。
- **主题多样性。** 所有主题的前几个词中唯一词的比例。值越高越好（主题不重叠）。
- **定性检查。** 阅读每个主题的前几个词。它们是否指代了一个真实的事物？人工判断仍然是最后一道防线。

## 如何选择

| 场景 | 选择 |
|------|------|
| 短文本（推文、评论、标题） | BERTopic |
| 长文档且主题混合 | LDA |
| 无GPU / 计算资源有限 | LDA 或 NMF |
| 需要文档级别的多主题分布 | LDA |
| 需要与LLM集成进行主题标签化 | BERTopic（直接支持） |
| 资源受限的端侧部署 | LDA |
| 追求最大语义连贯性 | BERTopic |

最大的实际考量是文档长度。BERT嵌入会截断；LDA的计数可以处理任意长度。如果文档超过嵌入模型的上下文窗口，要么分块聚合，要么使用LDA。

## 应用实践

2026年技术栈：

- **BERTopic。** 短文本及任何语义重要的场景的默认选择。
- **`gensim.models.LdaModel`。** 经典LDA，用于生产环境，成熟且经过实战检验。
- **`sklearn.decomposition.LatentDirichletAllocation`。** 用于实验的简易LDA。
- **NMF。** 非负矩阵分解（Non-negative Matrix Factorization）。LDA的快速替代方案，在短文本上质量相当。
- **Top2Vec。** 与BERTopic设计类似。社区较小，但在某些基准测试上表现良好。
- **FASTopic。** 较新，在超大语料库上比BERTopic更快。
- **基于LLM的标签化。** 先运行任意聚类方法，然后提示模型为每个聚类命名。

## 产出文档

保存为 `outputs/skill-topic-picker.md`：

```markdown
---
name: topic-picker
description: 为语料库选择LDA或BERTopic。指定库、参数、评估方法。
version: 1.0.0
phase: 5
lesson: 15
tags: [nlp, topic-modeling]
---

给定语料库描述（文档数量、平均长度、领域、语言、计算预算），输出：

1. 算法。LDA / NMF / BERTopic / Top2Vec / FASTopic。用一句话说明原因。
2. 配置。主题数量：`recommended = max(5, round(sqrt(n_docs)))`，对于少于40,000篇文档的语料库，限制在200以内；仅当语料库确实很大（>40k）时才允许超过200，并注明计算成本会增加。对于神经方法，还需说明 `min_df` / `max_df` 过滤器和嵌入模型。
3. 评估。通过 `gensim.models.CoherenceModel` 计算主题连贯性（c_v）、主题多样性，以及20个样本的人工阅读检验。
4. 需要探查的失败模式。对于LDA，注意“垃圾主题”吸收停用词和常见词的问题。对于BERTopic，注意-1离群点分类会吞掉模棱两可的文档。

如果文档超过嵌入模型的上下文窗口且没有分块策略，则拒绝使用BERTopic。如果文档非常短（推文、少于10个词的评论），由于连贯性会崩溃，拒绝使用LDA。将任何低于5的主题数量选择标记为可能错误；对少于40k篇文档的语料库标记超过200的主题数量为可能过度分割。
```

## 练习题

1. **简单。** 在20个新闻组（20 Newsgroups）数据集上使用5个主题拟合LDA。打印每个主题的前10个词。手动为每个主题打标签。算法是否找到了真正的类别？
2. **中等。** 在相同的20个新闻组子集上拟合BERTopic。比较找到的主题数量、主题词以及定性的连贯性与LDA的差别。哪种方法更清晰地呈现了真正的类别？
3. **困难。** 在您的语料库上分别计算LDA和BERTopic的c_v连贯性。分别用5、10、20、50个主题运行每种方法。绘制连贯性 vs 主题数量的图表。报告哪种方法在不同主题数量下更稳定。

## 关键术语

| 术语 | 人们常说的含义 | 实际含义 |
|------|----------------|----------|
| 主题（Topic） | 语料库所关于的一个事物 | 单词上的概率分布（LDA）或相似文档的聚类（BERTopic）。 |
| 混合成员（Mixed membership） | 文档属于多个主题 | LDA为每篇文档分配一个在所有主题上的分布。 |
| UMAP | 降维 | 保留局部结构的流形学习；用于BERTopic。 |
| HDBSCAN | 密度聚类 | 发现可变大小的聚类；为离群点生成“噪声”标签（-1）。 |
| c_v 连贯性（c_v coherence） | 主题质量指标 | 在滑动窗口内，主题前几个词之间的平均逐点互信息。 |

## 扩展阅读

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf) — LDA论文。
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) — BERTopic论文。
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf) — 提出c_v及其相关度量的论文。
- [BERTopic 文档](https://maartengr.github.io/BERTopic/) — 生产环境参考。优秀的示例。