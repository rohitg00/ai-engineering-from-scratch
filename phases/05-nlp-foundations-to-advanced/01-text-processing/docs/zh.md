# 文本处理 — 分词（Tokenization）、词干提取（Stemming）、词形还原（Lemmatization）

> 语言是连续的。模型是离散的。预处理是桥梁。

**类型：** 构建
**语言：** Python
**前提条件：** 阶段 2 · 14（朴素贝叶斯）
**时长：** ~45 分钟

## 问题

模型无法直接读取“The cats were running.”。它只能读取整数。

每个自然语言处理（NLP）系统都会首先面对这三个相同的问题。单词从哪里开始。单词的词根是什么。如何在有帮助时将“run”、“running”、“ran”视为同一事物，而在无帮助时视为不同事物。

分词做错了，模型就会从垃圾数据中学习。如果你的分词器将 `don't` 视为一个词元（token），而将 `do n't` 视为两个词元，那么训练分布就会分裂。如果你的词干提取器将 `organization` 和 `organ` 归为同一个词干，主题建模就会失效。如果你的词形还原器需要词性（Part-of-Speech）上下文，但你却没有传递它，动词就会被当作名词处理。

本课程将从零开始构建这三个预处理原语，然后展示 NLTK 和 spaCy 如何完成相同的工作，以便你理解其中的权衡。

## 概念

三个操作。每个操作都有其任务和失败模式。

**分词（Tokenization）** 将字符串拆分为词元（tokens）。“词元”这个术语故意定义得比较模糊，因为合适的粒度取决于具体任务。经典 NLP 使用单词级，Transformer 使用子词级，无空格语言使用字符级。

**词干提取（Stemming）** 通过规则来切除后缀。快速、激进、粗暴。`running -> run`。`organization -> organ`。第二个例子就是失败模式。

**词形还原（Lemmatization）** 利用语法知识将单词还原为其词典形式。较慢、准确、需要查找表或形态分析器。`ran -> run`（需要知道“ran”是“run”的过去式）。`better -> good`（需要知道比较级形式）。

经验法则：当速度重要且可以容忍噪声时（如搜索索引、粗略分类），使用词干提取；当语义重要时（如问答、语义搜索、任何用户将阅读的内容），使用词形还原。

## 构建

### 步骤 1：一个正则表达式单词分词器

最简单实用的分词器根据非字母数字字符进行分割，同时将标点符号保留为独立的词元。并非完美，也不是最终方案，但一行代码即可运行。

```python
import re

def tokenize(text):
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]", text)
```

三个模式按优先级排列：带可选内部撇号的单词（`don't`、`it's`）、纯数字、任何单个非空白非字母数字字符作为独立词元（标点符号）。

```python
>>> tokenize("The cats weren't running at 3pm.")
['The', 'cats', "weren't", 'running', 'at', '3', 'pm', '.']
```

需要注意的失败模式：`3pm` 被分割为 `['3', 'pm']`，因为我们在字母序列和数字序列之间交替。对大多数任务来说足够好。URL、电子邮件、话题标签都会出错。生产环境中，应在通用模式之前添加特定模式。

### 步骤 2：一个 Porter 词干提取器（仅第 1a 步）

完整的 Porter 算法有五个阶段的规则。仅第 1a 步就涵盖了最常见的英语后缀，并展示了模式。

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

自上而下阅读规则。`ies -> i` 规则导致 `ponies -> poni` 而不是 `pony`。真正的 Porter 算法有第 1b 步可以修复这个问题。规则之间存在竞争。更早的规则获胜。任何单一规则的重要性都不及规则顺序。

### 步骤 3：基于查找表的词形还原器

真正的词形还原需要形态知识。一个易于教学的版本使用一个小型词形表和一个回退机制。

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

最后一个案例是关键的教学点。`watched` 不在我们的表中，并且我们的回退机制只处理 `ing`。真正的词形还原会处理 `ed`、不规则动词、比较级形容词、带音变的复数（`children -> child`）。这就是生产系统使用 WordNet、spaCy 的形态分析器或完整形态分析器的原因。

### 步骤 4：将它们串联起来

```python
def preprocess(text, pos_tagger=None):
    tokens = tokenize(text)
    stems = [stem_step_1a(t.lower()) for t in tokens]
    tags = pos_tagger(tokens) if pos_tagger else [(t, "NOUN") for t in tokens]
    lemmas = [lemmatize(word, pos) for word, pos in tags]
    return {"tokens": tokens, "stems": stems, "lemmas": lemmas}
```

缺少的部分是词性标注器。阶段 5 · 07（词性标注）将构建一个。目前，将所有词性默认设为 `NOUN` 并承认其局限性。

## 使用

NLTK 和 spaCy 提供了生产级版本。每几行代码即可。

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

`word_tokenize` 处理缩略形式、Unicode、以及你的正则表达式遗漏的边缘情况。`PorterStemmer` 运行所有五个阶段。`WordNetLemmatizer` 需要将词性标签从 NLTK 的 Penn Treebank 方案转换为 WordNet 的缩写集。上面的转换逻辑是大多数教程忽略的部分。

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

spaCy 将整个流水线隐藏在 `nlp(text)` 之后。分词、词性标注和词形还原全都运行。大规模处理时比 NLTK 更快。开箱即用更准确。但代价是无法轻易替换单个组件。

### 何时选择哪个

| 情况 | 选择 |
|-----------|------|
| 教学、研究、组件可替换 | NLTK |
| 生产环境、多语言、速度重要 | spaCy |
| Transformer 流水线（你将使用模型的 tokenizer 进行分词，跳过经典预处理） | 使用 `tokenizers` / `transformers` |

### 没有人警告过的两种失败模式

大多数教程只讲算法就停止了。真实预处理流水线会遇到的两个问题，几乎从未被提及。

**可重现性漂移。** NLTK 和 spaCy 在不同版本之间会改变分词和词形还原行为。在 spaCy 2.x 中产生 `['do', "n't"]` 的代码可能在 3.x 中产生 `["don't"]`。你的模型是在一种分布上训练的。现在推理运行在另一种分布上。准确性悄然下降，没有人知道原因。在 `requirements.txt` 中固定库版本。编写一个预处理回归测试，冻结 20 个示例句子的预期分词结果。每次升级时运行它。

**训练/推理不匹配。** 使用激进的预处理（小写、停用词移除、词干提取）进行训练，对原始用户输入进行部署，然后看着性能暴跌。这是最普遍的生产级 NLP 失败案例。如果在训练期间进行了预处理，那么在推理时必须运行完全相同的函数。将预处理作为函数打包在模型包内，而不是作为服务团队重写的笔记本单元格。

## 出货

一个可复用的提示词，帮助工程师无需阅读三本教科书就能选择预处理策略。

保存为 `outputs/prompt-preprocessing-advisor.md`：

```markdown
---
name: preprocessing-advisor
description: 为一个自然语言处理任务推荐分词、词干提取和词形还原设置。
phase: 5
lesson: 01
---

你对经典自然语言处理预处理提供建议。给定一个任务描述，你输出：

1. 分词选择（正则表达式、NLTK word_tokenize、spaCy 或 transformer tokenizer）。解释原因。
2. 是否进行词干提取、词形还原、两者都做或都不做。解释原因。
3. 具体的库调用。给出函数名。如果涉及 NLTK，引用词性标签转换。
4. 用户应测试的一个失败模式。

拒绝为用户可见的文本推荐词干提取。拒绝在没有词性标签的情况下推荐词形还原。将非英语输入标记为需要不同的流水线。
```

## 练习

1. **简单。** 扩展 `tokenize` 以将 URL 保留为单一词元。测试：`tokenize("Visit https://example.com today.")` 应产生一个 URL 词元。
2. **中等。** 实现 Porter 第 1b 步。如果一个单词包含元音并且以 `ed` 或 `ing` 结尾，则移除它。处理双辅音规则（`hopping -> hop`，而不是 `hopp`）。
3. **困难。** 构建一个词形还原器，使用 WordNet 作为查找表，但在 WordNet 没有条目时回退到你的 Porter 词干提取器。在有标签的语料库上测量准确率，与纯 WordNet 和纯 Porter 进行比较。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| 词元 (Token) | 一个单词 | 模型消费的任何单元。可以是单词、子词、字符或字节。 |
| 词干 (Stem) | 单词的词根 | 基于规则的后缀剥离结果。不一定是真实单词。 |
| 词元 (Lemma) | 词典形式 | 你会在词典中查找的形式。需要语法上下文才能正确计算。 |
| 词性标签 (POS tag) | 词性 | 像 NOUN、VERB、ADJ 这样的类别。需要准确进行词形还原。 |
| 形态学 (Morphology) | 单词形态规则 | 单词如何根据时态、数、格改变形式。词形还原依赖于它。 |

## 进一步阅读

- [Porter, M. F. (1980). An algorithm for suffix stripping](https://tartarus.org/martin/PorterStemmer/def.txt) — 原始论文，五页，仍然是最清晰的解释。
- [spaCy 101 — linguistic features](https://spacy.io/usage/linguistic-features) — 真实流水线的连接方式。
- [NLTK book, chapter 3](https://www.nltk.org/book/ch03.html) — 你尚未想到的分词边缘情况。