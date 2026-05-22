# 词性标注与句法分析

> 语法曾一度不受欢迎。后来每个大语言模型（LLM）管道都需要验证结构化提取，它又回来了。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段5·第01课（文本处理），阶段2·第14课（朴素贝叶斯）
**预计时间：** ~45分钟

## 问题

第01课提到词形还原需要词性标签。如果不知道 `running` 是动词，词形还原器就无法将其还原为 `run`。如果不知道 `better` 是形容词，就无法还原为 `good`。

这个承诺掩盖了整整一个子领域。词性标注（Part-of-Speech Tagging）分配语法类别。句法分析（Syntactic Parsing）恢复句子的树形结构：哪个词修饰哪个词，哪个动词支配哪些论元。经典自然语言处理（NLP）花了二十年精细化这两项技术。然后深度学习将它们压缩为基于预训练Transformer的词元分类任务，研究社区便转向了。

但应用社区没有转向。每个结构化提取管道仍在底层使用词性（POS）和依存树。大语言模型（LLM）生成的JSON通过语法约束进行验证。问答系统利用依存句法分析分解查询。机器翻译质量评估器检查句法分析树的对齐。

值得了解。本课介绍标签集、基线方法，以及何时停止从零实现并调用spaCy。

## 概念

**词性标注**为每个词元分配一个语法类别。**宾州树库（Penn Treebank, PTB）** 标签集是英语默认标准。包含36个标签，对普通读者来说有些挑剔：`NN` 单数名词、`NNS` 复数名词、`NNP` 专有名词单数、`VBD` 动词过去式、`VBZ` 动词第三人称单数现在时等。**通用依存关系（Universal Dependencies, UD）** 标签集更粗粒度（17个标签）且语言无关，成为跨语言工作的默认标准。

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**句法分析**生成一棵树。两种主要风格：

- **短语结构分析。** 名词短语、动词短语、介词短语相互嵌套。输出是一棵非终结符类别（NP、VP、PP）的树，叶子为单词。
- **依存句法分析。** 每个单词有一个它依赖的中心词，并用语法关系标记。输出是一棵树，每条边是一个（中心词，依存词，关系）三元组。

依存句法分析在2010年代胜出，因为它能干净地推广到各种语言，尤其是自由语序语言。

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

## 动手构建

### 第1步：最常见标签基线

一个能工作的最笨的词性标注器。对于每个单词，预测其在训练数据中出现最频繁的标签。

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

在布朗语料库（Brown corpus）上，这个基线能达到约85%的准确率。不算好，但这是一个严肃模型不应低于的底限。

### 第2步：二元隐马尔可夫模型标注器

对序列的联合概率建模：

```
P(tags, words) = prod P(tag_i | tag_{i-1}) * P(word_i | tag_i)
```

两个表格：转移概率（给定前一个标签下的当前标签），发射概率（给定标签下的单词）。通过拉普拉斯平滑从计数中估计两者。用维特比（Viterbi）算法（在标签格子上的动态规划）解码。

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

二元隐马尔可夫模型（Bigram HMM）在布朗语料库上能达到约93%的准确率。从85%跃升到93%主要归功于转移概率——模型学会了 `DET NOUN` 很常见而 `NOUN DET` 很罕见。

### 第3步：为什么现代标注器能超越它

转移概率加发射概率是局部的。它们无法捕捉到 `saw` 在"I bought a saw"中是名词，而在"I saw the movie"中是动词。一个带有任意特征（后缀、词形、前后单词、单词本身）的条件随机场（CRF）能达到约97%。双向长短期记忆网络条件随机场（BiLSTM-CRF）或Transformer能达到98%以上。

这个任务的上限由标注者之间的分歧决定。人类标注者在宾州树库上的一致率约为97%。超过98%的模型可能是在过拟合测试集。

### 第4步：依存句法分析概述

从零实现完整的依存句法分析超出了本课范围；经典教材的处理见Jurafsky和Martin。需要了解两个经典家族：

- **基于转移的**分析器（arc-eager、arc-standard）类似于移进-归约分析器：它们读取词元，将其压入堆栈，并应用归约动作来创建弧。贪婪解码速度快。经典实现是MaltParser。现代神经版本：Chen和Manning的基于转移的分析器。
- **基于图的**分析器（Eisner算法、Dozat-Manning双仿射）对每个可能的中心词-依存词边打分，并选出最大生成树。速度较慢但更准确。

对于大多数应用工作，直接调用spaCy：

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

从底部向上阅读 `dep` 列，句子的语法结构便一目了然。

## 使用

每个生产级的自然语言处理（NLP）库都将词性标注和依存句法分析器作为标准管道的一部分。

- **spaCy**（`en_core_web_sm` / `md` / `lg` / `trf`）。快速、准确，与分词、命名实体识别（NER）和词形还原集成。`token.tag_`（Penn）、`token.pos_`（UD）、`token.dep_`（依存关系）。
- **Stanford NLP (stanza)**。斯坦福CoreNLP的继任者。在60多种语言上达到最先进水平。
- **trankit**。基于Transformer，通用依存关系（UD）准确率高。
- **NLTK**。`pos_tag`。可用但速度慢且版本较旧。适合教学。

### 在2026年这仍然重要的地方

- **词形还原。** 第01课需要词性（POS）才能正确进行词形还原。始终如此。
- **从大语言模型（LLM）输出中提取结构化信息。** 验证生成的句子是否符合语法约束（例如主谓一致、所需修饰语）。
- **基于方面的情感分析。** 依存句法分析告诉你哪个形容词修饰哪个名词。
- **查询理解。** "movies directed by Wes Anderson starring Bill Murray"通过句法分析分解为结构化约束。
- **跨语言迁移。** 通用依存关系（UD）标签和依存关系是语言无关的，使得对新语言进行零样本结构化分析成为可能。
- **低算力管道。** 如果你无法部署Transformer，词性（POS）+ 依存句法分析 + 地名词典能让你走得很远。

## 交付

保存为 `outputs/skill-grammar-pipeline.md`：

```markdown
---
name: grammar-pipeline
description: 为一个下游自然语言处理（NLP）任务设计经典的词性（POS）+ 依存句法分析管道。
version: 1.0.0
phase: 5
lesson: 07
tags: [nlp, pos, parsing]
---

给定一个下游任务（信息提取、改写验证、查询分解、词形还原），输出：

1. 要使用的标签集。对于仅英语的传统管道使用宾州树库（Penn Treebank），对于多语言或跨语言使用通用依存关系（Universal Dependencies）。
2. 库。大多数生产环境使用spaCy，学术级多语言使用stanza，最高通用依存关系（UD）准确率使用trankit。指定具体的模型ID。
3. 集成模式。展示调用库并消费所需属性（`.pos_`、`.dep_`、`.head`）的3-5行代码。
4. 要测试的失败模式。名词-动词歧义（`saw`、`book`、`can`）和介词短语（PP）附着歧义是经典陷阱。抽样20个输出并人工检查。

拒绝推荐从头构建自己的分析器。从头构建分析器是一个研究项目，不是应用任务。标记任何消耗词性（POS）标签但不处理大小写变体的管道为脆弱。
```

## 练习

1. **简单。** 使用最常见标签基线在一个小型标注语料库（例如NLTK的布朗语料库子集）上，测量在保留句子上的准确率。验证约85%的结果。
2. **中等。** 训练上述二元隐马尔可夫模型（HMM），并报告每个标签的精确率/召回率。隐马尔可夫模型（HMM）最容易混淆哪些标签？
3. **困难。** 使用spaCy的依存句法分析从1000句样本中提取主谓宾三元组。在50个手动标注的三元组上进行评估。记录提取失败的地方（通常是被动语态、并列结构和省略主语）。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| 词性（POS）标签 | 单词的类型 | 语法类别。宾州树库（PTB）有36个；通用依存关系（UD）有17个。 |
| 宾州树库（Penn Treebank） | 标准标签集 | 英语专用。细粒度的动词时态和名词数。 |
| 通用依存关系（Universal Dependencies） | 多语言标签集 | 比宾州树库（PTB）更粗粒度；语言中立；跨语言工作的默认标准。 |
| 依存句法分析 | 句子树 | 每个单词有一个中心词，每条边有一个语法关系。 |
| 维特比（Viterbi） | 动态规划 | 在给定发射和转移概率下找到最高概率的标签序列。 |

## 扩展阅读

- [Jurafsky和Martin—《语音与语言处理》第8章和第18章](https://web.stanford.edu/~jurafsky/slp3/) — 关于词性（POS）和句法分析的经典教材。
- [通用依存关系项目](https://universaldependencies.org/) — 每个多语言分析器使用的跨语言标签集和树库集合。
- [spaCy语言特征指南](https://spacy.io/usage/linguistic-features) — 关于`Token`上每个属性的实用参考。
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp