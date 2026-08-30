# 07 · 词性标注与句法分析

> 语法分析曾一度过时。后来每条大语言模型（LLM）流水线都需要校验结构化抽取，它又卷土重来了。

**类型：** 构建
**语言：** Python
**前置：** 第 5 阶段 · 01（文本处理）、第 2 阶段 · 14（朴素贝叶斯）
**时长：** 约 45 分钟

## 问题所在

第 01 课承诺过：词形还原（lemmatization）需要一个词性标签。不知道 `running` 是动词，词形还原器就无法把它还原成 `run`；不知道 `better` 是形容词，就无法把它还原成 `good`。

那条承诺背后藏着整整一个子领域。词性标注（part-of-speech tagging）为每个词分配语法类别。句法分析（syntactic parsing）则恢复句子的树状结构：哪个词修饰哪个词，哪个动词支配哪些论元。经典自然语言处理（NLP）花了二十年打磨这两项任务。后来深度学习把它们坍缩成一个建立在预训练 Transformer 之上的词元分类任务，研究界随之转向了别处。

但应用界没有。每条结构化抽取流水线在底层仍然使用词性和依存树（dependency tree）。LLM 生成的 JSON 会被拿去对照语法约束做校验。问答系统用依存分析来分解查询。机器翻译质量评估器会检查分析树（parse tree）之间的对齐情况。

值得一学。本课介绍各类标签集、各种基线方法，以及那个你该停止从零实现、转而调用 spaCy 的分界点。

## 核心概念

**词性标注** 为每个词元打上一个语法类别标签。**宾州树库（Penn Treebank，PTB）** 标签集是英语的默认选择，包含 36 个标签，其区分之细让普通读者觉得过于讲究：`NN` 单数名词、`NNS` 复数名词、`NNP` 单数专有名词、`VBD` 动词过去式、`VBZ` 动词第三人称单数现在时，等等。**通用依存（Universal Dependencies，UD）** 标签集更粗（17 个标签）且与语言无关，已成为跨语言工作的默认选择。

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**句法分析** 产生一棵树。主要有两种风格：

- **成分句法分析（Constituency parsing）。** 名词短语、动词短语、介词短语相互嵌套。输出是一棵由非终结符类别（NP、VP、PP）构成的树，词语作为叶子节点。
- **依存句法分析（Dependency parsing）。** 每个词都有唯一一个所依赖的中心词（head），并标注语法关系。输出是一棵树，其中每条边都是一个 (head, dependent, relation) 三元组。

依存句法分析在 2010 年代胜出，因为它能干净利落地跨语言推广，尤其适用于那些词序自由的语言。

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

## 动手构建

### 第 1 步：最高频标签基线

能用的最笨的词性标注器。对每个词，预测它在训练数据中出现最频繁的那个标签。

```python
from collections import Counter, defaultdict


def train_mft(train_examples):
    word_tag_counts = defaultdict(Counter)
    all_tags = Counter()
    for tokens, tags in train_examples:
        for token, tag in zip(tokens, tags):
            word_tag_counts[token.lower()][tag] += 1
            all_tags[tag] += 1
    word_best = {w: c.most_common(1)[0][0] for w, c in word_tag_counts.items()}
    default_tag = all_tags.most_common(1)[0][0]
    return word_best, default_tag


def predict_mft(tokens, word_best, default_tag):
    return [word_best.get(t.lower(), default_tag) for t in tokens]
```

在 Brown 语料库上，这条基线能达到约 85% 的准确率。算不上好，但它是任何正经模型都不应跌破的下限。

### 第 2 步：二元 HMM 标注器

对序列的联合概率建模：

```
P(tags, words) = prod P(tag_i | tag_{i-1}) * P(word_i | tag_i)
```

两张表：转移概率（给定上一个标签时当前标签的概率）、发射概率（给定标签时词语的概率）。两者都用拉普拉斯平滑（Laplace smoothing）从计数中估计。再用维特比算法（Viterbi）解码（在标签格上做动态规划）。

```python
import math


def train_hmm(train_examples, alpha=0.01):
    transitions = defaultdict(Counter)
    emissions = defaultdict(Counter)
    tags = set()
    vocab = set()

    for tokens, ts in train_examples:
        prev = "<BOS>"
        for token, tag in zip(tokens, ts):
            transitions[prev][tag] += 1
            emissions[tag][token.lower()] += 1
            tags.add(tag)
            vocab.add(token.lower())
            prev = tag
        transitions[prev]["<EOS>"] += 1

    return transitions, emissions, tags, vocab


def log_prob(table, given, key, smooth_denom, alpha):
    return math.log((table[given].get(key, 0) + alpha) / smooth_denom)


def viterbi(tokens, transitions, emissions, tags, vocab, alpha=0.01):
    tags_list = list(tags)
    n = len(tokens)
    V = [[0.0] * len(tags_list) for _ in range(n)]
    back = [[0] * len(tags_list) for _ in range(n)]

    for j, tag in enumerate(tags_list):
        em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
        tr_denom = sum(transitions["<BOS>"].values()) + alpha * (len(tags_list) + 1)
        tr = log_prob(transitions, "<BOS>", tag, tr_denom, alpha)
        em = log_prob(emissions, tag, tokens[0].lower(), em_denom, alpha)
        V[0][j] = tr + em
        back[0][j] = 0

    for i in range(1, n):
        for j, tag in enumerate(tags_list):
            em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
            em = log_prob(emissions, tag, tokens[i].lower(), em_denom, alpha)
            best_prev = 0
            best_score = -1e30
            for k, prev_tag in enumerate(tags_list):
                tr_denom = sum(transitions[prev_tag].values()) + alpha * (len(tags_list) + 1)
                tr = log_prob(transitions, prev_tag, tag, tr_denom, alpha)
                score = V[i - 1][k] + tr + em
                if score > best_score:
                    best_score = score
                    best_prev = k
            V[i][j] = best_score
            back[i][j] = best_prev

    last_best = max(range(len(tags_list)), key=lambda j: V[n - 1][j])
    path = [last_best]
    for i in range(n - 1, 0, -1):
        path.append(back[i][path[-1]])
    return [tags_list[j] for j in reversed(path)]
```

二元 HMM 在 Brown 上能达到约 93% 的准确率。从 85% 跃升到 93%，主要归功于转移概率——模型学到了 `DET NOUN` 很常见，而 `NOUN DET` 很罕见。

### 第 3 步：为什么现代标注器能胜过它

转移概率加发射概率是局部的。它们无法捕捉到这样的现象：`saw` 在 "I bought a saw"（我买了一把锯）中是名词，但在 "I saw the movie"（我看了那部电影）中是动词。一个带任意特征（后缀、词形、前后词、词本身）的条件随机场（CRF）能达到约 97%。BiLSTM-CRF 或 Transformer 能达到约 98% 以上。

这项任务的上限由标注者之间的分歧设定。人工标注者在宾州树库上的一致率约为 97%。准确率超过 98% 的模型很可能是在过拟合测试集。

### 第 4 步：依存句法分析速写

从零实现完整的依存句法分析超出了本课范围；权威的教科书论述见 Jurafsky 和 Martin 的著作。有两大经典流派值得了解：

- **基于转移（Transition-based）** 的分析器（arc-eager、arc-standard）的行为类似移进-归约（shift-reduce）分析器：它们读取词元，将其移进栈中，再施加归约动作来创建弧（arc）。贪心解码速度很快。经典实现是 MaltParser。现代神经网络版本是 Chen 和 Manning 的基于转移的分析器。
- **基于图（Graph-based）** 的分析器（Eisner 算法、Dozat-Manning 双仿射模型）对每一条可能的「中心词-依存词」边打分，再选出最大生成树。速度较慢但更准确。

对于绝大多数应用工作，调用 spaCy 即可：

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running at 3pm.")
for token in doc:
    print(f"{token.text:10s} tag={token.tag_:5s} pos={token.pos_:6s} dep={token.dep_:10s} head={token.head.text}")
```

```
The        tag=DT    pos=DET    dep=det        head=cats
cats       tag=NNS   pos=NOUN   dep=nsubj      head=running
were       tag=VBD   pos=AUX    dep=aux        head=running
running    tag=VBG   pos=VERB   dep=ROOT       head=running
at         tag=IN    pos=ADP    dep=prep       head=running
3pm        tag=NN    pos=NOUN   dep=pobj       head=at
.          tag=.     pos=PUNCT  dep=punct      head=running
```

从下往上读 `dep` 这一列，句子的语法结构便一目了然。

## 实际运用

每个生产级 NLP 库都将词性标注器和依存分析器作为标准流水线的一部分一并提供。

- **spaCy**（`en_core_web_sm` / `md` / `lg` / `trf`）。快速、准确，与分词、命名实体识别（NER）、词形还原集成在一起。`token.tag_`（宾州标签）、`token.pos_`（UD 标签）、`token.dep_`（依存关系）。
- **Stanford NLP（stanza）**。斯坦福对 CoreNLP 的继任者。在 60 多种语言上达到业界领先水平。
- **trankit**。基于 Transformer，UD 准确率出色。
- **NLTK**。`pos_tag`。可用，但偏慢、较老旧。用于教学足够了。

### 这在 2026 年仍然重要的地方

- **词形还原。** 第 01 课需要词性才能正确地做词形还原。永远如此。
- **从 LLM 输出中做结构化抽取。** 校验生成的句子是否遵守语法约束（例如主谓一致、必需的修饰成分）。
- **基于方面的情感分析（Aspect-based sentiment）。** 依存分析能告诉你哪个形容词修饰哪个名词。
- **查询理解。** "movies directed by Wes Anderson starring Bill Murray"（由韦斯·安德森执导、比尔·默瑞主演的电影）可以通过分析拆解成结构化约束。
- **跨语言迁移。** UD 标签和依存关系与语言无关，使得对新语言进行零样本（zero-shot）结构化分析成为可能。
- **低算力流水线。** 如果你无法部署 Transformer，那么词性标注 + 依存分析 + 词表（gazetteer）能让你走得出乎意料地远。

## 交付成果

保存为 `outputs/skill-grammar-pipeline.md`：

```markdown
---
name: grammar-pipeline
description: Design a classical POS + dependency pipeline for a downstream NLP task.
version: 1.0.0
phase: 5
lesson: 07
tags: [nlp, pos, parsing]
---

Given a downstream task (information extraction, rewrite validation, query decomposition, lemmatization), you output:

1. Tagset to use. Penn Treebank for English-only legacy pipelines, Universal Dependencies for multilingual or cross-lingual.
2. Library. spaCy for most production, stanza for academic-grade multilingual, trankit for highest UD accuracy. Name the specific model ID.
3. Integration pattern. Show the 3-5 lines that call the library and consume the needed attributes (`.pos_`, `.dep_`, `.head`).
4. Failure mode to test. Noun-verb ambiguity (`saw`, `book`, `can`) and PP-attachment ambiguity are the classical traps. Sample 20 outputs and eyeball.

Refuse to recommend rolling your own parser. Building parsers from scratch is a research project, not an application task. Flag any pipeline that consumes POS tags without handling lowercase/uppercase variants as fragile.
```

## 练习

1. **简单。** 在一个小型已标注语料库（例如 NLTK 的 Brown 子集）上使用最高频标签基线，在留出的句子上测量准确率。验证约 85% 的结果。
2. **中等。** 训练上面的二元 HMM，并报告每个标签的精确率/召回率。HMM 最容易混淆哪些标签？
3. **困难。** 用 spaCy 的依存分析从 1000 句样本中抽取「主语-谓语-宾语」三元组。在 50 个手工标注的三元组上做评估。记录抽取失败的地方（常见于被动语态、并列结构和省略主语）。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| POS tag（词性标签） | 词的类型 | 语法类别。PTB 有 36 个；UD 有 17 个。 |
| Penn Treebank（宾州树库） | 标准标签集 | 英语专用。动词时态和名词单复数划分细致。 |
| Universal Dependencies（通用依存） | 多语言标签集 | 比 PTB 更粗；与语言无关；跨语言工作的默认选择。 |
| Dependency parse（依存分析） | 句子树 | 每个词有一个中心词，每条边有一个语法关系。 |
| Viterbi（维特比） | 动态规划 | 在给定发射概率和转移概率的情况下，找出概率最高的标签序列。 |

## 延伸阅读

- [Jurafsky 与 Martin —《Speech and Language Processing》第 8 章与第 18 章](https://web.stanford.edu/~jurafsky/slp3/) —— 关于词性标注与句法分析的权威教科书论述。
- [Universal Dependencies 项目](https://universaldependencies.org/) —— 每个多语言分析器都在使用的跨语言标签集与树库合集。
- [spaCy 语言学特征指南](https://spacy.io/usage/linguistic-features) —— `Token` 上暴露的每个属性的实用参考。
- [Chen 与 Manning（2014）。A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf) —— 将神经网络分析器带入主流的那篇论文。
