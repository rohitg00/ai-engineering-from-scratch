# 文本处理 —— 分词、词干提取、词形还原

> 语言是连续的。模型是离散的。预处理是二者之间的桥梁。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 2 · 14 (Naive Bayes)
**Time:** 约45分钟

## 问题所在

模型无法阅读 "The cats were running." 它读的是整数。

每个 NLP 系统都从同样三个问题开始。一个词从哪里开始。一个词的词根是什么。如何在有帮助时把 "run"、"running"、"ran" 视为同一事物，而在无帮助时视为不同事物。

分词做错，模型就从垃圾中学习。如果你的分词器把 `don't` 当作一个 token，却把 `do n't` 拆成两个，训练分布就会分裂。如果你的词干提取器把 `organization` 和 `organ` 归并为同一个词干，主题建模就完蛋了。如果你的词形还原器需要词性上下文而你没有传入，动词就会被当作名词处理。

本课从零构建这三个预处理步骤，然后展示 NLTK 和 spaCy 如何完成同样的工作，以便你看到各自的取舍。

## 概念

三种操作。每种都有自己的职责和失败模式。

**分词(Tokenization)** 把字符串切分为 token。"Token" 一词刻意保持模糊，因为合适的粒度取决于任务。经典 NLP 用词级。Transformer 用子词。没有空格的语言用字符级。

**词干提取(Stemming)** 用规则砍掉后缀。快、激进、笨。`running -> run`。`organization -> organ`。第二个就是失败模式。

**词形还原(Lemmatization)** 借助语法知识把词还原为词典形式。更慢、更准确，需要查找表或形态分析器。`ran -> run`(需要知道 "ran" 是 "run" 的过去式)。`better -> good`(需要知道比较级形式)。

经验法则。速度重要且能容忍噪声时用词干提取(搜索索引、粗分类)。语义重要时用词形还原(问答、语义搜索、任何用户会阅读的内容)。

```figure
edit-distance
```

## 动手构建

### 步骤 1:一个正则表达式词分词器

最简单可用的分词器按非字母数字字符切分，同时把标点保留为独立的 token。不完美，不是终点，但它一行就能运行。

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

三个模式按优先级排列。带可选内部撇号的单词(`don't`、`it's`)。纯数字。任何单个非空白、非字母数字字符作为独立 token(标点)。

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

需要注意的失败模式。`3pm` 被拆成 `['3', 'pm']`,因为我们在字母串和数字串之间交替了。对大多数任务足够了。URL、邮箱、话题标签全都会出错。生产环境要在通用模式之前加上专门模式。

### 步骤 2:Porter 词干提取器(仅步骤 1a)

完整的 Porter 算法有五个阶段的规则。仅步骤 1a 就覆盖了最常见的英语后缀，并展示了这种模式。

```python
def stem_step_1a(word):
    if word.endswith("sses"):
        return word[:-2]
    if word.endswith("ies"):
        return word[:-2]
    if word.endswith("ss"):
        return word
    if word.endswith("s") and len(word) > 1:
        return word[:-1]
    return word
```

```python
>>> [stem_step_1a(w) for w in ["caresses", "ponies", "caress", "cats"]]
['caress', 'poni', 'caress', 'cat']
```

从上往下读规则。`ies -> i` 规则就是为什么得到 `ponies -> poni` 而不是 `pony`。真正的 Porter 有步骤 1b 可以修复它。规则会竞争。先出现的规则获胜。顺序比任何单条规则都重要。

### 步骤 3:基于查找表的词形还原器

真正的词形还原需要形态学。一个可操作的教学版本使用小的词条表加回退策略。

```python
LEMMA_TABLE = {
    ("running", "VERB"): "run",
    ("ran", "VERB"): "run",
    ("runs", "VERB"): "run",
    ("better", "ADJ"): "good",
    ("best", "ADJ"): "good",
    ("cats", "NOUN"): "cat",
    ("cat", "NOUN"): "cat",
    ("were", "VERB"): "be",
    ("was", "VERB"): "be",
    ("is", "VERB"): "be",
}

def lemmatize(word, pos):
    key = (word.lower(), pos)
    if key in LEMMA_TABLE:
        return LEMMA_TABLE[key]
    if pos == "VERB" and word.endswith("ing"):
        return word[:-3]
    if pos == "NOUN" and word.endswith("s"):
        return word[:-1]
    return word.lower()
```

```python
>>> lemmatize("running", "VERB")
'run'
>>> lemmatize("cats", "NOUN")
'cat'
>>> lemmatize("better", "ADJ")
'good'
>>> lemmatize("watched", "VERB")
'watched'
```

最后一种情况是关键的教学时刻。`watched` 不在我们的表中，而我们的回退只能处理 `ing`。真正的词形还原覆盖 `ed`、不规则动词、比较级形容词、带音变的复数(`children -> child`)。这就是为什么生产系统使用 WordNet、spaCy 的 morphologizer 或完整的形态分析器。

### 步骤 4:把它们串成管道

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

缺少的环节是 POS 标注器。Phase 5 · 07 (POS Tagging) 会构建一个。目前先把一切默认为 `NOUN`,并承认这一局限。

## 使用现成工具

NLTK 和 spaCy 提供了生产级版本。每个只需几行代码。

### NLTK

```python
import nltk
nltk.download("punkt_tab")
nltk.download("wordnet")
nltk.download("averaged_perceptron_tagger_eng")

from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer, WordNetLemmatizer
from nltk import pos_tag

text = "The cats were running."
tokens = word_tokenize(text)
stems = [PorterStemmer().stem(t) for t in tokens]
lemmatizer = WordNetLemmatizer()
tagged = pos_tag(tokens)


def nltk_pos_to_wordnet(tag):
    if tag.startswith("V"):
        return "v"
    if tag.startswith("J"):
        return "a"
    if tag.startswith("R"):
        return "r"
    return "n"


lemmas = [lemmatizer.lemmatize(t, nltk_pos_to_wordnet(tag)) for t, tag in tagged]
```

`word_tokenize` 处理缩写、Unicode 以及你的正则会遗漏的边界情况。`PorterStemmer` 运行全部五个阶段。`WordNetLemmatizer` 需要把 NLTK 的 Penn Treebank 词性方案转换为 WordNet 的缩写集合。上面的转换代码是大多数教程都跳过的部分。

### spaCy

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running.")

for token in doc:
    print(token.text, token.lemma_, token.pos_)
```

```
The      the     DET
cats     cat     NOUN
were     be      AUX
running  run     VERB
.        .       PUNCT
```

spaCy 把整个管道隐藏在 `nlp(text)` 之后。分词、POS 标注和词形还原全部运行。大规模场景下比 NLTK 快。开箱即用更准确。代价是你无法轻易替换单个组件。

### 何时选哪个

| 情况 | 选择 |
|-----------|------|
| 教学、研究、替换组件 | NLTK |
| 生产、多语言、速度重要 | spaCy |
| Transformer 管道(反正你会用模型自带的分词器) | 用 `tokenizers` / `transformers`,跳过经典预处理 |

### 两个没人提醒你的失败模式

大多数教程讲完算法就停了。有两件事会咬到真实的预处理管道，而它们几乎从未被提及。

**可复现性漂移。** NLTK 和 spaCy 在不同版本之间会改变分词和词形还原行为。在 spaCy 2.x 中产生 `['do', "n't"]` 的内容，在 3.x 中可能产生 `["don't"]`。你的模型是在一个分布上训练的，推理时却运行在另一个分布上。准确率悄然下降，没人知道为什么。在 `requirements.txt` 中固定库版本。写一个预处理回归测试，冻结 20 个例句的预期分词结果。每次升级时都运行它。

**训练/推理不一致。** 用激进预处理(小写化、停用词移除、词干提取)训练，却部署在原始用户输入上，性能就会崩塌。这是最常见的生产级 NLP 失败。如果你在训练时做了预处理，推理时必须运行完全相同的函数。把预处理作为函数打包进模型包中交付，而不是作为服务团队会重写的 notebook 单元。

## 交付成果

一个可复用的提示词，帮助工程师无需读三本教科书就能选择预处理策略。

保存为 `outputs/prompt-preprocessing-advisor.md`:

```markdown
---
name: preprocessing-advisor
description: Recommends a tokenization, stemming, and lemmatization setup for an NLP task.
phase: 5
lesson: 01
---

You advise on classical NLP preprocessing. Given a task description, you output:

1. Tokenization choice (regex, NLTK word_tokenize, spaCy, or transformer tokenizer). Explain why.
2. Whether to stem, lemmatize, both, or neither. Explain why.
3. Specific library calls. Name the functions. Quote the POS-tag translation if NLTK is involved.
4. One failure mode the user should test for.

Refuse to recommend stemming for user-visible text. Refuse to recommend lemmatization without POS tags. Flag non-English input as needing a different pipeline.
```

## 练习

1. **简单。** 扩展 `tokenize`,把 URL 保留为单个 token。测试：`tokenize("Visit https://example.com today.")` 应产生一个 URL token。
2. **中等。** 实现 Porter 步骤 1b。如果单词包含元音且以 `ed` 或 `ing` 结尾，则删除它。处理双辅音规则(`hopping -> hop`,而不是 `hopp`)。
3. **困难。** 构建一个词形还原器，使用 WordNet 作为查找表，但在 WordNet 中没有词条时回退到你的 Porter 词干提取器。在有标注的语料库上测量其相对于纯 WordNet 和纯 Porter 的准确率。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Token | 一个词 | 模型消费的任何单位。可以是词、子词、字符或字节。 |
| Stem | 词的词根 | 基于规则的后缀剥离的结果。不一定是真实的词。 |
| Lemma | 词典形式 | 你会去查的词形。需要语法上下文才能正确计算。 |
| POS tag | 词性 | NOUN、VERB、ADJ 等类别。准确词形还原所必需。 |
| Morphology | 词形变化规则 | 一个词如何随时态、数、格变化。词形还原依赖于此。 |

## 延伸阅读

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt) — 原始论文，五页，至今仍是最清晰的讲解。
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features) — 真实管道是如何搭建的。
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html) — 你还没想到过的分词边界情况。