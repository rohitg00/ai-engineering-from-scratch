# 词性标注与句法分析

> 语法曾一度不受欢迎。然后每个 LLM pipeline 都需要验证结构化提取，它就回来了。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 01（文本处理），阶段 2 · 14（Naive Bayes）
**时间：** ~45 分钟

## 问题

第 01 课承诺过 lemmatization 需要词性标签。不知道 `running` 是动词，lemmatizer 就无法将其还原为 `run`。不知道 `better` 是形容词，就无法将其还原为 `good`。

这个承诺隐藏了一整个子领域。词性标注（POS tagging）分配语法类别。句法分析（Syntactic parsing）恢复句子的树结构：哪个词修饰哪个词，哪个动词支配哪个论元。经典 NLP 花二十年来完善这两者。然后深度学习将它们压缩为预训练 transformer 之上的 token 分类任务，研究社区继续前行。

但应用社区没有。每个结构化提取 pipeline 仍在底层使用 POS 和依存树。LLM 生成的 JSON 根据语法约束进行验证。问答系统使用依存句法分解查询。机器翻译质量评估器检查分析树的对齐。

值得了解。本课介绍标签集、基线，以及你停止从零实现并调用 spaCy 的转折点。

## 概念

**POS tagging** 为每个 token 标记一个语法类别。**Penn Treebank（PTB）** 标签集是英语的默认选择。36 个标签，其细微差别让不经意的读者觉得繁琐：`NN` 单数名词、`NNS` 复数名词、`NNP` 专有名词单数、`VBD` 动词过去式、`VBZ` 动词第三人称单数现在时，等等。**Universal Dependencies（UD）** 标签集更粗粒度（17 个标签），且语言无关；它成为跨语言工作的默认选择。

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**句法分析**生成树。两种主要风格：

- **成分句法分析（Constituency parsing）。** 名词短语、动词短语、介词短语相互嵌套。输出是非终结符类别（NP、VP、PP）的树，词作为叶子。
- **依存句法分析（Dependency parsing）。** 每个词有一个它所依赖的中心词，标有语法关系。输出是一棵树，每条边是一个（中心词、依存词、关系）三元组。

依存句法分析在 2010 年代胜出，因为它能干净地跨语言泛化，尤其是自由词序语言。

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

## 开始构建

### 第 1 步：最常见标签基线

能工作的最简单的 POS tagger。对每个词，预测它在训练中出现频率最高的标签。

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

在 Brown 语料库上，这个基线达到约 85% 的准确率。不高，但这是任何严肃模型不应低于的下限。

### 第 2 步：bigram HMM tagger

对序列的联合概率建模：

```
P(tags, words) = prod P(tag_i | tag_{i-1}) * P(word_i | tag_i)
```

两个表：转移概率（给定前一个标签的当前标签）、发射概率（给定标签的词）。用 Laplace 平滑从计数中估计两者。用 Viterbi（标签格子上的动态规划）解码。

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

在 Brown 上，bigram HMM 达到约 93% 的准确率。从 85% 跃升到 93% 主要是转移概率的贡献——模型学到了 `DET NOUN` 是常见的，而 `NOUN DET` 是罕见的。

### 第 3 步：为什么现代 tagger 能超越这一点

转移 + 发射概率是局部的。它们无法捕捉到 `saw` 在 "I bought a saw" 中是名词，但在 "I saw the movie" 中是动词。具有任意特征（后缀、词形、前后词、词本身）的 CRF 达到约 97%。BiLSTM-CRF 或 transformer 达到约 98%+。

这个任务的上限由标注者不一致性决定。人类标注者在 Penn Treebank 上大约 97% 的时间意见一致。超过 98% 的模型可能在过拟合测试集。

### 第 4 步：依存句法分析草图

从零实现完整的依存句法分析超出范围；经典教科书处理见 Jurafsky 和 Martin。需要了解的两个经典家族：

- **基于转移的** 分析器（arc-eager、arc-standard）像 shift-reduce 分析器一样工作：读取 token，将它们推入栈，并应用创建弧的 reduce 动作。贪婪解码速度快。经典实现是 MaltParser。现代神经版本：Chen 和 Manning 的基于转移的分析器。
- **基于图的** 分析器（Eisner 算法、Dozat-Manning biaffine）对每个可能的中心词-依存词边打分，并选取最大生成树。速度较慢但更准确。

对于大多数应用工作，调用 spaCy：

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

从下到上阅读 `dep` 列，句子的语法结构就显现出来了。

## 使用现成工具

每个生产 NLP 库都将 POS 和依存分析器作为标准 pipeline 的一部分提供。

- **spaCy**（`en_core_web_sm` / `md` / `lg` / `trf`）。快速、准确，与 tokenization + NER + lemmatization 集成。`token.tag_`（Penn）、`token.pos_`（UD）、`token.dep_`（依存关系）。
- **Stanford NLP（stanza）**。Stanford 对 CoreNLP 的继任者。在 60+ 种语言上达到最高水平。
- **trankit**。基于 transformer，UD 准确率好。
- **NLTK**。`pos_tag`。可用，较慢，较老。适合教学。

### 2026 年这仍然重要的场景

- **Lemmatization。** 第 01 课需要 POS 才能正确地进行 lemmatization。始终需要。
- **从 LLM 输出中进行结构化提取。** 验证生成的句子是否遵循语法约束（如主谓一致、所需修饰语）。
- **基于方面的情感分析。** 依存句法告诉你哪个形容词修饰哪个名词。
- **查询理解。** "movies directed by Wes Anderson starring Bill Murray" 通过句法分析分解为结构化约束。
- **跨语言迁移。** UD 标签和依存关系是语言无关的，使得新语言的零样本结构化分析成为可能。
- **低计算 pipeline。** 如果你无法部署 transformer，POS + 依存分析 + 地名录可以让你走得很远。

## 交付

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

1. **简单。** 在使用最常见标签基线的小型标注语料库（如 NLTK 的 Brown 子集）上，测量留出句子的准确率。验证约 85% 的结果。
2. **中等。** 训练上述 bigram HMM，并报告每个标签的精确率/召回率。HMM 最容易混淆哪些标签？
3. **困难。** 使用 spaCy 的依存分析从 1000 句样本中提取主-谓-宾三元组。在 50 个手动标注的三元组上评估。记录提取失败的地方（通常是被动语态、并列结构和省略主语）。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| POS tag | 词的类型 | 语法类别。PTB 有 36 个；UD 有 17 个。 |
| Penn Treebank | 标准标签集 | 英语专用。细粒度的动词时态和名词数。 |
| Universal Dependencies | 多语言标签集 | 比 PTB 更粗粒度；语言中立；跨语言工作的默认选择。 |
| Dependency parse | 句子树 | 每个词有一个中心词，每条边有一个语法关系。 |
| Viterbi | 动态规划 | 在给定发射和转移的情况下找到最高概率的标签序列。 |

## 延伸阅读

- [Jurafsky and Martin —— Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/) —— POS 和分析的经典教科书处理。
- [Universal Dependencies project](https://universaldependencies.org/) —— 每个多语言分析器使用的跨语言标签集和树库集合。
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features) —— `Token` 上暴露的每个属性的实用参考。
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf) —— 将神经分析器引入主流的论文。
