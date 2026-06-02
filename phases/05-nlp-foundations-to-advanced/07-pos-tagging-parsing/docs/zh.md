# 词性标注与句法分析（POS Tagging and Syntactic Parsing）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 语法曾经一度不流行。后来每条 LLM 流水线都需要校验结构化抽取的输出，它就又回来了。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## 问题（The Problem）

第 01 课说过：lemmatization（词形还原）需要词性标签（part-of-speech tag）。不知道 `running` 是动词，词形还原器就没法把它还原成 `run`；不知道 `better` 是形容词，也没法还原成 `good`。

那一个承诺背后藏着一整个子领域。词性标注（POS tagging）给词分配语法类别；句法分析（syntactic parsing）则恢复句子的树状结构：哪个词修饰哪个、哪个动词支配哪些参数。经典 NLP 用了二十年时间打磨这两件事。然后深度学习把它们简化为「在预训练 transformer 之上做 token 分类」的任务，研究社区便转身离去。

但应用社区没走。每条结构化抽取流水线背后还在用 POS 和依存树。LLM 生成的 JSON 会用语法约束去校验。问答系统借助依存分析（dependency parse）来分解查询。机器翻译质量评估器会比对解析树（parse tree）的对齐情况。

值得了解。本课介绍 tagset、baseline，以及「在哪一刻应该停止从零实现，转而调用 spaCy」。

## 概念（The Concept）

**POS tagging（词性标注）** 给每个 token 打上一个语法类别标签。**Penn Treebank（PTB）** tagset 是英文默认标准，36 个标签，区分细到让普通读者觉得啰嗦：`NN` 单数名词、`NNS` 复数名词、`NNP` 单数专有名词、`VBD` 动词过去式、`VBZ` 动词第三人称单数现在时，等等。**Universal Dependencies（UD）** tagset 更粗粒度（17 个标签）且与具体语言无关；它已成为跨语言工作的默认选择。

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**句法分析（Syntactic parsing）** 产出一棵树。两大主流风格：

- **成分句法分析（Constituency parsing）。** 名词短语、动词短语、介词短语层层嵌套。输出是一棵以非终结符类别（NP、VP、PP）为内部节点、以词为叶子的树。
- **依存句法分析（Dependency parsing）。** 每个词只有一个所依赖的中心词（head word），边上标注语法关系。输出是一棵每条边都是 (head, dependent, relation) 三元组的树。

依存句法在 2010 年代胜出，因为它能干净地推广到各种语言，特别是那些语序自由的语言。

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

## 动手实现（Build It）

### Step 1：最高频标签 baseline（most-frequent-tag baseline）

最笨但能用的 POS 标注器：对每个词，预测它在训练集里出现频率最高的那个标签。

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

在 Brown 语料上，这个 baseline 能拿到约 85% 准确率。算不上好，但是任何严肃模型都不该跌破的下限。

### Step 2：bigram HMM 标注器

对序列的联合概率建模：

```
P(tags, words) = prod P(tag_i | tag_{i-1}) * P(word_i | tag_i)
```

两张表：转移概率（给定前一个 tag 后当前 tag 的概率）、发射概率（给定 tag 后当前词的概率）。两者都从计数估计，配 Laplace 平滑。解码用 Viterbi（在 tag 网格上做动态规划）。

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

bigram HMM 在 Brown 上能到约 93% 准确率。从 85% 跳到 93% 主要靠转移概率——模型学到 `DET NOUN` 常见，`NOUN DET` 罕见。

### Step 3：现代标注器为什么能打赢这个

转移概率 + 发射概率都是局部的。它们抓不到这种现象：`saw` 在 "I bought a saw" 里是名词，在 "I saw the movie" 里是动词。一个特征任意（后缀、词形、前后词、词本身）的 CRF 能到约 97%；一个 BiLSTM-CRF 或 transformer 能到约 98%+。

这个任务的天花板由标注者一致性决定。人类标注者在 Penn Treebank 上的一致率大约是 97%。超过 98% 的模型大概率在过拟合测试集。

### Step 4：依存句法分析速写

从零实现完整的依存句法分析超出本课范围；权威教科书处理见 Jurafsky 和 Martin。两个值得知道的经典派系：

- **基于转移（Transition-based）** 的解析器（arc-eager、arc-standard）像 shift-reduce 解析器：读 token、把它压到栈上、再用 reduce 动作生成弧。贪心解码很快。经典实现是 MaltParser。现代神经版：Chen 和 Manning 的 transition-based parser。
- **基于图（Graph-based）** 的解析器（Eisner 算法、Dozat-Manning biaffine）给每条可能的「中心词-从属词」边打分，再选一棵最大生成树。慢一点但更准。

绝大多数应用场景，调 spaCy 就行：

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

把 `dep` 这一列从下往上读，整个句子的语法结构就出来了。

## 用起来（Use It）

每个生产级 NLP 库都把 POS 和依存解析器作为标准流水线的一部分发布。

- **spaCy**（`en_core_web_sm` / `md` / `lg` / `trf`）。快、准、和 tokenization + NER + lemmatization 集成在一起。`token.tag_`（Penn）、`token.pos_`（UD）、`token.dep_`（依存关系）。
- **Stanford NLP（stanza）**。Stanford 对 CoreNLP 的继任者。在 60+ 种语言上达到 SOTA。
- **trankit**。基于 transformer，UD 准确率不错。
- **NLTK**。`pos_tag`。可用，但慢、老。教学用足够。

### 2026 年这件事在哪里仍然重要

- **Lemmatization。** 第 01 课需要 POS 才能正确做词形还原。永远需要。
- **从 LLM 输出做结构化抽取。** 校验生成的句子是否满足语法约束（例如主谓一致、必需的修饰成分）。
- **基于方面的情感分析（aspect-based sentiment）。** 依存解析能告诉你哪个形容词修饰哪个名词。
- **查询理解。** "movies directed by Wes Anderson starring Bill Murray" 通过解析能拆成结构化的约束条件。
- **跨语言迁移（cross-lingual transfer）。** UD 标签和依存关系与具体语言无关，能让你对新语言做 zero-shot 的结构化分析。
- **低算力流水线。** 如果上不了 transformer，POS + 依存解析 + gazetteer（词典）能走得出乎意料地远。

## 上线部署（Ship It）

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

## 练习（Exercises）

1. **Easy。** 在一个小的标注语料（例如 NLTK 的 Brown 子集）上用最高频标签 baseline，在留出句子上测准确率。验证那个约 85% 的结果。
2. **Medium。** 训练上面的 bigram HMM，报告每个 tag 的 precision / recall。HMM 最容易把哪些 tag 搞混？
3. **Hard。** 用 spaCy 的依存解析从 1000 个句子样本里抽取主谓宾三元组。在 50 个手工标注的三元组上评估。记录抽取在哪些情况下失败（往往是被动语态、并列结构、省略主语）。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| POS tag | 词的「类型」 | 语法类别。PTB 有 36 个；UD 有 17 个。 |
| Penn Treebank | 标准 tagset | 英文专用。动词时态和名词数粒度很细。 |
| Universal Dependencies | 多语言 tagset | 比 PTB 粗；与语言无关；跨语言工作的默认选择。 |
| Dependency parse | 句子树 | 每个词有一个 head，每条边有一个语法关系。 |
| Viterbi | 动态规划 | 在给定发射和转移概率下找出概率最高的 tag 序列。 |

## 延伸阅读（Further Reading）

- [Jurafsky and Martin — Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/) —— POS 与句法分析的权威教科书处理。
- [Universal Dependencies project](https://universaldependencies.org/) —— 几乎所有多语言解析器都在用的跨语言 tagset 和 treebank 集合。
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features) —— `Token` 上每个属性的实用参考。
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf) —— 把神经解析器带进主流的那篇论文。
