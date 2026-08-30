# POS Tagging and Syntactic Parsing

> 语法一度不流行。然后每个LLM管道都需要验证结构化提取，然后它回来了。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段5 · 01（文本处理）、阶段2 · 14（天真的Bayes）
** 时间：** ~45分钟

## The Problem

第01课承诺词元化需要词性标签。如果不知道“run”是一个动词，词元化者就不能将其简化为“run”。如果不知道“更好”是一个形容词，它就不能简化为“好”。

这个承诺隐藏了整个子领域。词性标签分配语法类别。语法分析恢复句子的树结构：哪个词修饰哪个，哪个动词支配哪些论点。经典NLP花了二十年的时间完善了两者。然后，深度学习将它们分解为一个预先训练的Transformer之上的标记分类任务，研究社区继续前进。

不是应用社区。每个结构化提取管道仍然在背后使用POS和依赖树。LLM生成的SON根据语法限制进行验证。询问回答系统使用依赖性分析分解查询。机器翻译质量评估器检查解析树的对齐情况。

值得了解。本课介绍标签集、基线以及停止从头实施并调用spaCy的点。

## The Concept

![POS tag + dependency parse example](./assets/pos-parse.svg)

**POS标签 ** 使用语法类别标记每个令牌。**Penn Treebank（PTB）** 标签集是英语默认值。随意的读者发现有36个具有区别的标签：“NN”单数名词、“NNS”复数名词、“NNP”专有名词单数、“VBD”动词过去时态、“WBZ”动词第三人称单数现在等等。**Universal Dependency（UD）** 标签集更粗糙（17个标签）并且语言不可知;它成为跨语言工作的默认标签。

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

** 语法解析 ** 生成树。两大风格：

- ** 选区解析。**名词短语、动词短语、代词短语相互嵌套。输出是一棵非终结类别（NP、VP、PP）树，以单词为叶子。
- ** 依赖解析。**每个词都有一个它所依赖的中心词，并标记有语法关系。输出是一棵树，其中每条边都是（头、依赖、关系）三重组。

依赖性解析在2010年代获胜，因为它可以清晰地概括跨语言，尤其是自由词序语言。

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

## Build It

### Step 1: most-frequent-tag baseline

最愚蠢的POS标签器。对于每个单词，预测它在训练中最常见的标签。

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

在Brown数据库中，该基线的准确率约为85%。不好，但这是一个严肃的模特不应该跌倒的楼层。

### Step 2: bigram HMM tagger

对序列的联合概率进行建模：

```
P(tags, words) = prod P(tag_i | tag_{i-1}) * P(word_i | tag_i)
```

两个表：转移概率（给定先前标签的标签）、发射概率（给定单词的标签）。通过拉普拉斯平滑从计数中估计两者。使用维特比解码（标签网格上的动态编程）。

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

Brown上的Bigram Markov准确率约为93%。从85%到93%的跃升主要是转移概率-模型了解到“DET NOUN”很常见，而“NOUN DET”很罕见。

### Step 3: why modern taggers beat this

转变+排放概率是局部的。他们无法捕捉到“看到”是“我买了一把锯子”中的名词，但是“我看过电影”中的动词。“具有任意特征（后缀、词形、词前和后、词本身）的病例报告率约为97%。BiLSTM-CF或Transformer的命中率约为98%+。

此任务的上限由注释者的分歧决定。人类注释者在Penn Treebank上大约97%的时间都同意这一点。超过98%的模型可能过于适合测试集。

### Step 4: dependency parsing sketch

从头开始的完全依赖解析超出了范围;典型的教科书处理方法是在Jurafsky和Martin中。需要了解的两个古典家庭：

- ** 基于转换的 ** 解析器（arc-eager，arc-standard）就像一个shift-reduce解析器：它们读取标记，将它们转移到堆栈上，并应用创建弧的reduce操作。贪婪解码速度很快。经典的实现是MaltParser。现代神经版本：Chen和Manning基于转换的解析器。
- ** 基于图的 ** 解析器（Insiner算法，Dozat-Manning偏仿射）对每个可能的头部相关边进行评分并选择最大生成树。较慢但更准确。

对于大多数应用工作，请调用spaCy：

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

从下至上阅读“dep”列，句子的语法结构就会消失。

## Use It

每个生产NLP库都将POS和依赖项解析器作为标准管道的一部分运送。

- **spaCy**（' en_core_web_sim '/' td '/' lg ' trf '）。快速、准确、集成了标记化+ NER +表元化。' token.tag_'（Penn）、' token. pos_'（依赖关系）。
- ** 斯坦福大学NLP（节）**。斯坦福大学的CoreNLP继任者。支持60多种语言的最先进技术。
- **trankit**。基于变压器，UD准确性好。
- **NLTK**。' pos_tag '。可用、缓慢、古老。适合教学。

### Where this still matters in 2026

- ** 符号化。**第01课需要POS来正确地分解。总是.
- ** 从LLM输出中结构化提取。**确认生成的句子遵守语法限制（例如，主文协议，需要修饰语）。
- ** 基于杏仁的情绪。**依赖分析告诉您哪个形容词修饰哪个名词。
- ** 查询理解。**“由比尔·默里主演的韦斯·安德森执导的电影”通过解析分解为结构化约束。
- ** 跨语言转移。** UD标签和依赖关系是语言不可知的，可以对新语言进行零冲击结构化分析。
- ** 低计算管道。**如果您无法运送Transformer，POS +依赖性分析+地名录会让您走得出奇。

## Ship It

另存为“输出/skill-grammar-pipeline.md”：

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

## Exercises

1. ** 简单。**在小的标签库上使用最频繁的标签基线（例如，NLTK的Brown子集），衡量已发表句子的准确性。验证~85%的结果。
2. ** 中等。**训练上面的二元模型Markov并报告每个标签的精确度/召回。马尔科夫最容易混淆哪些标签？
3. ** 很难。**使用spaCy的依赖解析从1000个句子的样本中提取主文-宾三重组。对50个手动标记的三重组进行评估。提取失败的文档（通常是被动、协调和省略的主题）。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| POS标签 | 单词类型 | 语法类别。PTB有36; UD有17。 |
| Penn Treebank | 标准标记集 | 英语专用。细粒度的动词时态和名词数。 |
| 普遍的附庸 | 多语言标签集 | 比PTB更粗;语言中立;跨语言工作的默认值。 |
| 依存性解析 | 句子树 | 每个词都有一个中心，每个边都有一个语法关系。 |
| 维特比 | 动态规划 | 在给定发射和转变的情况下查找最高概率的标签序列。 |

## Further Reading

- [Jurafsky和Martin -语音和语言处理，第8章和第18章]（https：//web.stanford.edu/jurafsky/slp3/）-POS和解析的规范教科书处理。
- [Universal Dependencies项目]（https：//universaldependencies.org/）-每个多语言解析器使用的跨语言标签集和树库集合。
- [spaCy语言特征指南]（https：//spacy.io/usage/linguistic-features）-“Token”上暴露的每个属性的实用参考。
- [Chen和曼宁（2014）。使用神经网络的快速准确依赖性解析器]（https：//nlp.stanford.edu/pubs/emnlp2014-depparser.pdf）-将神经解析器带入主流的论文。
