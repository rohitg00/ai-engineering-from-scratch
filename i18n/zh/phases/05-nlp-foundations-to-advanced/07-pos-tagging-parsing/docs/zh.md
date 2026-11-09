# 标签和语法解析

> 语法一段时间不适用,然后每一个LLM管道都需要验证结构化的提取,

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## 问题

第1课承诺, 化需要部分语音标签.`running`是一个动词,一个 lemmatizer不能把它缩小到`run`没有意识到`better`是一个形容词,不能缩小到`good`现在,我们要去.

语法分析恢复了句子的树结构:哪个词修改哪个,哪个动词控制哪些参数.经典NLP花了二十年时间来完善这两种.然后深度学习将它们分解成一个预训练的变压器之上的代币分类任务,研究社区继续前进.

没有应用社区.每个结构化提取管道仍然使用 POS 和依赖树在罩杯下.LLM生成的JSON得到对语法限制进行验证.问答系统使用依赖解析分解查询.机器翻译质量评估人员检查解析树的对齐.

这一课介绍了标签组,基线,以及你停止从零开始实现的点,

## 概念

**POS tagging**标签每一个符号以语法类别.**Penn Treebank (PTB)**标签是英语默认的. 36个标签有区别,随便读者发现很尬: `NN`单一名词`NNS`复数名词`NNP`个体名词`VBD`过去时代的动词,`VBZ`动词第三个单词存在,等等.**Universal Dependencies (UD)**标签是粗的 (17标签) 和语言不认同的;它成为跨语言工作的默认.

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**Syntactic parsing**树木的生长方式是:

- **Constituency parsing.**词词,动词,预语词,在彼此内嵌. 输出是一个非终端类别的树 (NP,VP,PP) 具有单词的叶子.
- **Dependency parsing.**每个字都有一个单个单词,它依赖于,标记着语法关系.输出是一个树,每个边缘是一个 (头,依赖,关系) 三倍.

依赖性解析在2010年代取得了成功,因为它在语言中,特别是自由单词顺序中,

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

```figure
pos-tagger
```

```figure
dependency-arcs
```

## 建立它

### 步骤1:最常见标签的基线

对于每一个字,预测它在训练中最常用的标签.

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

在布朗体上,这个基线达到85%的准确度. 不好,但没有任何严重的模型应该落下的地板.

### 步骤2:大 HMM标签

模型对序列的联合概率:

```math
P(\text{tags}, \text{words}) = \prod_i P(\text{tag}_i \mid \text{tag}_{i-1}) \cdot P(\text{word}_i \mid \text{tag}_i)
```

两个表:过渡概率 (给前一个标签),排放概率 (给一个词标签). 根据拉普莱斯平滑计算来估算两者. 用维特比解码 (在标签网格上动态编程).

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

黑色的HMM大小是93%的准确度.从85%跳到93%的跳跃主要是过渡概率模型学习`DET NOUN`常见的`NOUN DET`很少见.

### 步骤3:为什么现代标记器比这更好

转变+排放概率是本地的.`saw`在"我买了"中是名词,但在"我看过电影"中是动词.一个任意特征的CRF (后音,字形,字前后,字本身) 达到~97%.一个BiLSTM-CRF或变压器达到~98%+.

们在林银行上约97%的时间都同意.超过98%的模型可能过于适合测试集.

### 步骤4:依赖性分析草图

完全依赖从零开始分析是不适用的;正文教科书处理是Jurafsky和马丁.

- **Transition-based**解析器 (arc-eager,arc-standard) 像一个减变解析器一样:它们读取代币,将它们移到堆上,并应用减少创建弧的操作.贪解码是快速的.经典的实现是MaltParser.现代神经版本:陈和曼宁的过渡基于解析器.
- **Graph-based**子 (Eisner 的算法, Dozat-Manning 白) 测量了每一个可能的根部依赖边缘,然后选择最大的跨度树.

对于大多数应用工作,请拨打 spaCy:

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

阅读`dep`列从下到上,句子的语法结构掉下来.

## 用它

每个生产NLP图书馆都作为标准管道的一部分运送 POS和依赖性解析器.

- **spaCy**(`en_core_web_sm`现在,`md`现在,`lg`现在,`trf`快速,精确,与代币化+NER+Lemmatization集成.`token.tag_`现在,我们要做什么?`token.pos_`其他国家`token.dep_`(依赖关系).
- **Stanford NLP (stanza)**斯坦福大学的继任者,在60多种语言上.
- **trankit**基于变压器,高度的DD准确性.
- **NLTK**现在,我们要去.`pos_tag`很适合教学,很适合教学.

### 在2026年,这仍然是重要的

- **Lemmatization.**第1课需要POS正确的化.
- **Structured extraction from LLM outputs.**验证生成的句子是否遵守语法限制 (例如,主题verb协议,要求修改).
- **Aspect-based sentiment.**依赖性解析告诉你哪个属性修改哪个名词.
- **Query understanding.**"由韦斯安德森导演的电影,由比尔·穆雷主演",通过分析,分解成结构化限制.
- **Cross-lingual transfer.**语言不了解语言,使得新语言的结构分析能够进行零射击.
- **Low-compute pipelines.**如果您无法运送变压器,

## 运送它

保存如`outputs/skill-grammar-pipeline.md`其他:

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

## 运动

1. **Easy.**使用一个小标签组 (例如,NLTK的Brown子组) 上最常见标签基线,测量保留的句子上的准确性. 验证~85%的结果.
2. **Medium.**按每标签的精度/回忆报告.哪些标签最困惑?
3. **Hard.**使用 spaCy 的依赖分析来从1000句的样本中提取主体-动词-对象三倍. 评估50个手动标记的三倍. 抽取失败的文档 (通常是被动,协调和被删除的主体).

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| POS tag | Word's type | Grammatical category. PTB has 36; UD has 17. |
| Penn Treebank | Standard tagset | English-specific. Fine-grained verb tenses and noun number. |
| Universal Dependencies | Multilingual tagset | Coarser than PTB; language-neutral; defaults for cross-lingual work. |
| Dependency parse | Sentence tree | Each word has one head, each edge has a grammatical relation. |
| Viterbi | Dynamic programming | Finds the highest-probability tag sequence given emissions and transitions. |

## 进一步阅读

- [Jurafsky and Martin — Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/)可教教本处理 POS和解析.
- [Universal Dependencies project](https://universaldependencies.org/)每一个多语言分析器使用的跨语言标签和树库集.
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features) 关于每一个被曝光的属性的实际参考`Token`现在,我们要去.
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf)引入神经分辨器的论文.
