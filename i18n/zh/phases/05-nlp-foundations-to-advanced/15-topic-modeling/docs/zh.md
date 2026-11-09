# 主题建模  LDA 和 BERTopic

> 文件是主题的混合物,主题是词汇上的分布.BERTopic:文件集群在嵌入空间中,集群是主题.相同的目标,不同的分解.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word2Vec)
**Time:** ~45 minutes

## 问题

你有1万张客户支持门票,5万条新闻文章或200万条推文.你需要知道收集内容是什么,而不需要阅读它.你没有标签类别.你甚至不知道有多少类别.

给它一个体积,回来一组连贯的主题,

两个算法家族主导.LDA (2003) 将每个文档视为隐藏的主题的混合,每个主题视为词汇分布.推理是贝耶斯.它仍然在生产中运输,需要混合成员主题分配和可解释的词汇水平概率分布.

BERTopic (2020) 用BERT编码文件,用UMAP减少维度,用HDBSCAN集群,并通过基于类的TF-IDF提取主题词.它在短文本,社交媒体和任何语义相似性比词汇重叠更重要的地方都赢得了胜利. 一份文件得到了一个主题,这是一种长形式内容的限制.

这一课就建立了对两个人的直觉,

## 概念

![LDA mixture model vs BERTopic clustering](../assets/topic-modeling.svg)

**LDA generative story.**每个主题都是单词的分布.每份文件都是单词的混合物.为了生成一个词,在文档中取样一个主题,然后取样一个词从该主题的分布中.推理逆转这一点:给出观察到的单词,推断每份文件的主题分布和每份话题的词分布.崩的吉布斯样本或变化贝斯做了数学.

关键 LDA输出:

- `doc_topic`列表`(n_docs, n_topics)`,每行总数为1 (文档的主题混合).
- `topic_word`列表`(n_topics, vocab_size)`,每行总数为1 (主题的词分布).

**BERTopic pipeline.**

1. 编码每个文档用句子变换器 (例如, `all-MiniLM-L6-v2`它们是384维向量.
2. 通过UMAP将维度降低到5维度.BERT嵌入式太低于结.
3. 基于密度,产生变量尺寸的集群和"异常"标签.
4. 对于每个集群,计算基于类的TF-IDF在集群文件中以提取顶级词.

输出是每份文件的一个主题 (加上 -1 异常标签). 选择性是通过HDBSCAN的概率向量进行软会员.

```figure
topic-drift
```

## 建立它

### 步骤1:通过 scikit-learn进行LDA

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

注意:删除停止字,min_df和max_df过稀有和无处不在的术语, CountVectorizer (不是TfidfVectorizer) 因为LDA预计原始计数.

### 步骤2:BERTopic (生产)

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

镜开了`Topic != -1`降低BERTopic的外向桶 (HDBSCAN无法集结文件). `min_topic_size`控制HDBSCAN的最小集群大小;BERTopic的库默认是10.本例明确设置为15为课程规模.对于超过10,000份文件,增加到50或100.

### 步骤3:评估

问题是,这些词是否一致.

- **Topic coherence (c_v).**结合了在滑动窗口背景下顶级词对的NPMI (标准化的点向互通信息),将分数集成成主题向量,并通过共数相似性进行比较.更高更好.使用 `gensim.models.CoherenceModel`随着`coherence="c_v"`现在,我们要去.
- **Topic diversity.**专题中所有主题的顶级词中独特词的比例.
- **Qualitative inspection.**读一读每一个话题的头条词.它们是否命名一个真实的东西?

## 什么时候选择哪个

| Situation | Pick |
|-----------|------|
| Short text (tweets, reviews, headlines) | BERTopic |
| Long documents with topic mixtures | LDA |
| No GPU / limited compute | LDA or NMF |
| Need document-level multi-topic distributions | LDA |
| LLM integration for topic labeling | BERTopic (direct support) |
| Resource-constrained edge deployment | LDA |
| Max semantic coherence | BERTopic |

文件长度是最大的实际考虑因素.BERT嵌入式缩短;LDA计算工作在任何长度.对于文件长于嵌入式模型的文本,要么使用chunk + agregate或使用LDA.

## 用它

现在,我们要做什么?

- **BERTopic.**默认的短文本和任何语义的东西.
- **`gensim.models.LdaModel`.**经典的LDA生产,成熟,战斗测试.
- **`sklearn.decomposition.LatentDirichletAllocation`.**实验的LDA很容易.
- **NMF.**快速替代LDA,短文本的质量相似.
- **Top2Vec.**类似于BERTopic的设计. 社区较小,但在一些基准上很好.
- **FASTopic.**在非常大的体体上,比BERTopic更快.
- **LLM-based labeling.**运行任何集群,然后要求一个模型命名每个集群.

## 运送它

保存如`outputs/skill-topic-picker.md`其他:

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

## 运动

1. **Easy.**按LDA适应20个新闻群数据集中的5个主题.按主题打印前10个词.手动标记每个主题.算法是否找到真正的类别?
2. **Medium.**根据LDA的数据,比较发现的主题数量,顶尖词汇和质量一致性.哪个更清洁地表现出实际类别?
3. **Hard.**在您的作品中计算LDA和BERTopic的c_v一致性.运行每个 5, 10, 20, 50个主题.图集一致性与主题数量.报告哪种方法在主题数量中更稳定.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Topic | A thing the corpus is about | A probability distribution over words (LDA) or a cluster of similar documents (BERTopic). |
| Mixed membership | Doc is multiple topics | LDA assigns each document a distribution over all topics. |
| UMAP | Dimensionality reduction | Manifold learning that preserves local structure; used in BERTopic. |
| HDBSCAN | Density clustering | Finds variable-size clusters; produces "noise" label (-1) for outliers. |
| c_v coherence | Topic quality metric | NPMI of top topic words over sliding windows, turned into context vectors and compared with cosine similarity. |

## 进一步阅读

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf)LDA的报纸.
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794)BERTopic论文
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf)报纸介绍了C_V和朋友.
- [BERTopic documentation](https://maartengr.github.io/BERTopic/)生产参考. 优秀的例子.
